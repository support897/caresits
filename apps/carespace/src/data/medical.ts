import { collection, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@cc/core";
import type { CarePerms, CareRole } from "./children";

export type AllergyRecord = { name: string; severity: string; notes: string };
export type MedicationRecord = { name: string; dose: string; times: string; notes: string };
export type EmergencyContact = { name: string; phone: string; relationship: string };
export type MedicalRecord = {
  allergies: AllergyRecord[];
  medication: MedicationRecord[];
  emergency: { contacts: EmergencyContact[]; doctor: string; notes: string };
};
export type MedicalAccess = { role: CareRole; perms: CarePerms };
export type MedicalChangeAlert = { kind: "medical-change"; by: string; at: unknown; summary: string };

export const EMPTY_MEDICAL: MedicalRecord = { allergies: [], medication: [], emergency: { contacts: [], doctor: "", notes: "" } };
export const DEMO_MEDICAL: Record<string, MedicalRecord> = {
  "demo-mila": {
    allergies: [{ name: "Peanut", severity: "Severe", notes: "Example only. Ask parent and check every label." }],
    medication: [{ name: "Example medicine", dose: "As directed by parent", times: "As agreed with parent", notes: "Demo record. Not medical advice." }],
    emergency: { contacts: [{ name: "Casey Example", phone: "000", relationship: "Parent" }], doctor: "Example Family Clinic", notes: "Demo record only." },
  },
  "demo-theo": { allergies: [], medication: [], emergency: { contacts: [{ name: "Casey Example", phone: "000", relationship: "Parent" }], doctor: "Example Family Clinic", notes: "Demo record only." } },
};

export function canReadMedicalRecord(access: Pick<MedicalAccess, "role" | "perms">): boolean {
  return access.role === "admin" || (access.perms.allergies && access.perms.medication);
}

export function canWriteMedicalRecord(role: CareRole): boolean {
  return role === "admin";
}

export function buildMedicalChangeAlert(by: string, at: unknown, summary: string): MedicalChangeAlert {
  return { kind: "medical-change", by, at, summary };
}

function normalizeMedical(value: Record<string, unknown>): MedicalRecord {
  const emergency = value.emergency && typeof value.emergency === "object" ? value.emergency as Record<string, unknown> : {};
  return {
    allergies: Array.isArray(value.allergies) ? value.allergies.map((item) => ({ name: String(item?.name ?? ""), severity: String(item?.severity ?? ""), notes: String(item?.notes ?? "") })) : [],
    medication: Array.isArray(value.medication) ? value.medication.map((item) => ({ name: String(item?.name ?? ""), dose: String(item?.dose ?? ""), times: String(item?.times ?? ""), notes: String(item?.notes ?? "") })) : [],
    emergency: {
      contacts: Array.isArray(emergency.contacts) ? emergency.contacts.map((item) => ({ name: String(item?.name ?? ""), phone: String(item?.phone ?? ""), relationship: String(item?.relationship ?? "") })) : [],
      doctor: String(emergency.doctor ?? ""), notes: String(emergency.notes ?? ""),
    },
  };
}

export async function loadMedicalRecord(spaceId: string, childId: string, access: MedicalAccess): Promise<MedicalRecord | null> {
  if (!canReadMedicalRecord(access)) return null;
  const snapshot = await getDoc(doc(db, "careSpaces", spaceId, "medical", childId));
  return snapshot.exists() ? normalizeMedical(snapshot.data()) : EMPTY_MEDICAL;
}

export async function saveMedicalRecord(spaceId: string, childId: string, record: MedicalRecord, by: string, childName: string, role: CareRole): Promise<void> {
  if (!canWriteMedicalRecord(role)) throw new Error("Only an admin can edit medical details.");
  const medicalRef = doc(db, "careSpaces", spaceId, "medical", childId);
  const alertRef = doc(collection(db, "careSpaces", spaceId, "alerts"));
  const summary = `Updated medical and emergency details for ${childName}.`;
  const batch = writeBatch(db);
  batch.set(medicalRef, normalizeMedical(record as unknown as Record<string, unknown>));
  batch.set(alertRef, buildMedicalChangeAlert(by, serverTimestamp(), summary));
  await batch.commit();
}
