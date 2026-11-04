import { collection, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db, t } from "@cc/core";
import type { CarePerms, CareRole } from "./children";

export type AllergyRecord = { name: string; severity: string; notes: string };
export type MedicationRecord = { name: string; dose: string; times: string; notes: string };
export type EmergencyContact = { name: string; phone: string; relationship: string };
export type EmergencyRecord = { contacts: EmergencyContact[]; doctor: string; notes: string };
export type MedicalRecord = {
  allergies: AllergyRecord[] | null;
  medication: MedicationRecord[] | null;
  emergency: EmergencyRecord | null;
};
export type MedicalAccess = { role: CareRole; perms: CarePerms };
export type MedicalSection = "allergies" | "medication" | "emergency";
export type MedicalChangeAlert = {
  kind: "medical-change";
  by: string;
  at: unknown;
  summary: string;
  childId: string;
  section: MedicalSection;
  recordId: "main";
};
export type MedicalSectionChange = {
  section: MedicalSection;
  recordId: "main";
  record: Record<string, unknown>;
  alert: MedicalChangeAlert & { id: string };
};

export const EMPTY_MEDICAL: MedicalRecord = { allergies: null, medication: null, emergency: null };
export const DEMO_MEDICAL: Record<string, MedicalRecord> = {
  "demo-mila": {
    allergies: [{ name: "Peanut", severity: "Severe", notes: "Example only. Ask parent and check every label." }],
    medication: [{ name: "Example medicine", dose: "As directed by parent", times: "As agreed with parent", notes: "Demo record. Not medical advice." }],
    emergency: { contacts: [{ name: "Casey Example", phone: "000", relationship: "Parent" }], doctor: "Example Family Clinic", notes: "Demo record only." },
  },
  "demo-theo": { allergies: [], medication: [], emergency: { contacts: [{ name: "Casey Example", phone: "000", relationship: "Parent" }], doctor: "Example Family Clinic", notes: "Demo record only." } },
};

export function canReadAllergies(access: Pick<MedicalAccess, "role" | "perms">): boolean {
  return access.role === "admin" || access.perms.allergies === true;
}

export function canReadMedication(access: Pick<MedicalAccess, "role" | "perms">): boolean {
  return access.role === "admin" || access.perms.medication === true;
}

export function canReadEmergencyRecord(access: Pick<MedicalAccess, "role" | "perms">): boolean {
  return access.role === "admin";
}

export function canReadMedicalRecord(access: Pick<MedicalAccess, "role" | "perms">): boolean {
  return canReadAllergies(access) || canReadMedication(access) || canReadEmergencyRecord(access);
}

export function canWriteMedicalRecord(role: CareRole): boolean {
  return role === "admin";
}

const SECTION_LABELS: Record<MedicalSection, [string, string]> = {
  allergies: ["care.medical.alert.allergies", "allergy"],
  medication: ["care.medical.alert.medication", "medication"],
  emergency: ["care.medical.alert.emergency", "emergency"],
};

export function buildMedicalSectionChanges(
  record: MedicalRecord,
  by: string,
  childId: string,
  childName: string,
  at: unknown,
  alertIds: Record<MedicalSection, string>,
): MedicalSectionChange[] {
  const sections: MedicalSection[] = ["allergies", "medication", "emergency"];
  return sections.map((section) => {
    const recordId = "main" as const;
    const alertId = alertIds[section];
    const [key, label] = SECTION_LABELS[section];
    const summary = t(key, "Updated {section} details for {child}.", { section: label, child: childName });
    const sectionRecord = section === "allergies"
      ? { items: record.allergies ?? [], updatedBy: by, updatedAt: at, alertId }
      : section === "medication"
        ? { items: record.medication ?? [], updatedBy: by, updatedAt: at, alertId }
        : { ...(record.emergency ?? { contacts: [], doctor: "", notes: "" }), updatedBy: by, updatedAt: at, alertId };
    return {
      section,
      recordId,
      record: sectionRecord,
      alert: { id: alertId, kind: "medical-change", by, at, summary, childId, section, recordId },
    };
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function normalizeAllergies(value: unknown): AllergyRecord[] | null {
  return Array.isArray(value) ? value.map((item) => {
    const row = asRecord(item);
    return { name: String(row.name ?? ""), severity: String(row.severity ?? ""), notes: String(row.notes ?? "") };
  }) : null;
}

export function normalizeMedication(value: unknown): MedicationRecord[] | null {
  return Array.isArray(value) ? value.map((item) => {
    const row = asRecord(item);
    return { name: String(row.name ?? ""), dose: String(row.dose ?? ""), times: String(row.times ?? ""), notes: String(row.notes ?? "") };
  }) : null;
}

function normalizeEmergency(value: Record<string, unknown>): EmergencyRecord {
  return {
    contacts: Array.isArray(value.contacts) ? value.contacts.map((item) => {
      const row = asRecord(item);
      return { name: String(row.name ?? ""), phone: String(row.phone ?? ""), relationship: String(row.relationship ?? "") };
    }) : [],
    doctor: String(value.doctor ?? ""),
    notes: String(value.notes ?? ""),
  };
}

async function readSection(spaceId: string, childId: string, section: MedicalSection) {
  return getDoc(doc(db, "careSpaces", spaceId, "medical", childId, section, "main"));
}

export async function loadMedicalRecord(spaceId: string, childId: string, access: MedicalAccess): Promise<MedicalRecord | null> {
  const canAllergies = canReadAllergies(access);
  const canMedication = canReadMedication(access);
  const canEmergency = canReadEmergencyRecord(access);
  if (!canAllergies && !canMedication && !canEmergency) return null;
  const [allergyDoc, medicationDoc, emergencyDoc] = await Promise.all([
    canAllergies ? readSection(spaceId, childId, "allergies") : Promise.resolve(null),
    canMedication ? readSection(spaceId, childId, "medication") : Promise.resolve(null),
    canEmergency ? readSection(spaceId, childId, "emergency") : Promise.resolve(null),
  ]);
  return {
    allergies: canAllergies ? normalizeAllergies(allergyDoc?.data()?.items) : null,
    medication: canMedication ? normalizeMedication(medicationDoc?.data()?.items) : null,
    emergency: canEmergency && emergencyDoc?.exists() ? normalizeEmergency(emergencyDoc.data() ?? {}) : null,
  };
}

export async function saveMedicalRecord(spaceId: string, childId: string, record: MedicalRecord, by: string, childName: string, role: CareRole): Promise<void> {
  if (!canWriteMedicalRecord(role)) throw new Error("Only an admin can edit medical details.");
  const batch = writeBatch(db);
  const sections: MedicalSection[] = ["allergies", "medication", "emergency"];
  const alertRefs = Object.fromEntries(sections.map((section) => [section, doc(collection(db, "careSpaces", spaceId, "alerts"))])) as Record<MedicalSection, ReturnType<typeof doc>>;
  const changes = buildMedicalSectionChanges(record, by, childId, childName, serverTimestamp(), {
    allergies: alertRefs.allergies.id,
    medication: alertRefs.medication.id,
    emergency: alertRefs.emergency.id,
  });
  for (const change of changes) {
    const recordRef = doc(db, "careSpaces", spaceId, "medical", childId, change.section, change.recordId);
    batch.set(recordRef, change.record);
    const { id: _id, ...alert } = change.alert;
    batch.set(alertRefs[change.section], alert);
  }
  await batch.commit();
}
