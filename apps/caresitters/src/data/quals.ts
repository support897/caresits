import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@cc/core";
import { uploadQualificationDocument } from "../../../../packages/core/src/media/upload";

export type AustralianStateCode = "ACT" | "NSW" | "NT" | "QLD" | "SA" | "TAS" | "VIC" | "WA";
export type QualificationStatus = "submitted" | "under review" | "verified" | "expired" | "needs renewal";
export type OfficialChildCheck = { code: AustralianStateCode; state: string; name: string; guidance: string; validity: string; officialUrl: string; lastChecked: string };
export type Qualification = { id: string; label: string; status: QualificationStatus; state?: string; checkedOn?: unknown; expiresOn?: unknown; fileKey?: string; verifiedBy?: string };

export const AUSTRALIAN_CHILD_CHECKS: readonly OfficialChildCheck[] = [
  { code: "ACT", state: "Australian Capital Territory", name: "Working with Vulnerable People (WWVP) registration", guidance: "Check whether your role is a regulated activity; some registrations have restrictions.", validity: "5 years", officialUrl: "https://www.accesscanberra.act.gov.au/business-and-work/working-with-vulnerable-people/apply-for-or-renew-a-wwvp-registration", lastChecked: "2026-11-04" },
  { code: "NSW", state: "New South Wales", name: "Working with Children Check (WWCC)", guidance: "A clearance allows child-related work; a bar does not. Holders are continuously monitored.", validity: "5 years", officialUrl: "https://www.service.nsw.gov.au/transaction/apply-for-a-working-with-children-check", lastChecked: "2026-11-04" },
  { code: "NT", state: "Northern Territory", name: "Working with Children Clearance (WWCC; Ochre Card)", guidance: "The NT government calls this a Working with Children Clearance, also known as an Ochre Card.", validity: "2 years", officialUrl: "https://nt.gov.au/emergency/child-safety/working-with-children-clearance/wwcc-before-you-apply", lastChecked: "2026-11-04" },
  { code: "QLD", state: "Queensland", name: "Blue Card (Queensland Working with Children Check)", guidance: "Queensland uses Blue Card Services; check the card's current status and expiry.", validity: "3 years", officialUrl: "https://www.qld.gov.au/jobs/blue-card", lastChecked: "2026-11-04" },
  { code: "SA", state: "South Australia", name: "Working with Children Check (WWCC)", guidance: "The DHS Screening Unit conducts the check; employers verify through the organisation portal.", validity: "5 years", officialUrl: "https://www.sa.gov.au/topics/rights-and-law/rights-and-responsibilities/screening-checks/screening-wwcc", lastChecked: "2026-11-04" },
  { code: "TAS", state: "Tasmania", name: "Registration to work with vulnerable people (including children)", guidance: "Tasmania requires registration before work or volunteering with vulnerable people, including children.", validity: "5 years", officialUrl: "https://www.service.tas.gov.au/services/education-and-skills/working-with-vulnerable-people-including-children/apply-for-registration-to-work-with-vulnerable-people/", lastChecked: "2026-11-04" },
  { code: "VIC", state: "Victoria", name: "Working with Children (WWC) Check / WWC Clearance", guidance: "Passing the check gives a WWC Clearance, unless an exemption applies; holders are monitored.", validity: "5 years", officialUrl: "https://www.vic.gov.au/WWC-Check-explained", lastChecked: "2026-11-04" },
  { code: "WA", state: "Western Australia", name: "Working with Children (WWC) Check", guidance: "A WA check is WA-specific and cannot be used in other states or territories.", validity: "3 years", officialUrl: "https://www.wa.gov.au/organisation/department-of-communities/working-children-check-what-the-wwc-check", lastChecked: "2026-11-04" },
];

const DAY_MS = 86_400_000;
export function qualificationDateDay(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const row = value as { toDate?: () => Date; seconds?: number };
    if (typeof row.toDate === "function") return qualificationDateDay(row.toDate());
    if (typeof row.seconds === "number") return qualificationDateDay(new Date(row.seconds * 1000));
  }
  if (typeof value === "number") return qualificationDateDay(new Date(value));
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = text.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
  if (dmy && dmy[1] && dmy[2] && dmy[3]) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

export function qualificationDates(docValue: Record<string, unknown>): { checkedOn?: unknown; expiresOn?: unknown } {
  return {
    checkedOn: docValue.checkedOn ?? docValue.dateChecked ?? docValue.checkedAt ?? docValue.verifiedOn ?? docValue.verifiedAt,
    expiresOn: docValue.expiresOn ?? docValue.expires ?? docValue.expiry ?? docValue.expiryDate ?? docValue.expiryAt ?? docValue.expiresAt,
  };
}

export function qualificationStatus(docValue: Record<string, unknown>, today = new Date()): QualificationStatus {
  const { checkedOn, expiresOn } = qualificationDates(docValue);
  const todayDay = qualificationDateDay(today) || new Date().toISOString().slice(0, 10);
  const expiresDay = qualificationDateDay(expiresOn);
  if (expiresDay && expiresDay < todayDay) return "expired";
  if (expiresDay && (Date.parse(`${expiresDay}T00:00:00Z`) - Date.parse(`${todayDay}T00:00:00Z`)) / DAY_MS <= 30) return "needs renewal";
  const raw = String(docValue.status ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (["under review", "in review", "reviewing", "review"].includes(raw)) return "under review";
  if (raw === "expired") return "expired";
  if (["needs renewal", "renew"].includes(raw)) return "needs renewal";
  const checkedByReviewer = Boolean(checkedOn && docValue.verifiedBy);
  if (raw === "verified" || checkedByReviewer) return checkedByReviewer ? "verified" : "under review";
  return "submitted";
}

function recordArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([id, row]) => ({ ...(row && typeof row === "object" ? row as Record<string, unknown> : {}), id }));
  return [];
}
function mapQualification(id: string, value: Record<string, unknown>): Qualification {
  const dates = qualificationDates(value);
  return {
    id,
    label: String(value.label ?? value.name ?? value.kind ?? value.qualification ?? "Qualification"),
    status: qualificationStatus(value),
    ...(typeof value.state === "string" ? { state: value.state } : {}),
    ...(dates.checkedOn != null ? { checkedOn: dates.checkedOn } : {}),
    ...(dates.expiresOn != null ? { expiresOn: dates.expiresOn } : {}),
    ...(typeof value.fileKey === "string" ? { fileKey: value.fileKey } : {}),
    ...(typeof value.verifiedBy === "string" ? { verifiedBy: value.verifiedBy } : {}),
  };
}

export async function loadQualifications(uid: string): Promise<Qualification[]> {
  if (!uid || auth().currentUser?.uid !== uid) return [];
  const [submitted, verifiedSnapshot] = await Promise.all([
    getDocs(collection(db, "users", uid, "documents")),
    getDoc(doc(db, "verified", uid)).catch(() => null),
  ]);
  const verified = verifiedSnapshot?.exists() ? verifiedSnapshot.data() : {};
  const serverRows = [...recordArray(verified.qualifications), ...recordArray(verified.checks), ...recordArray(verified.documents)];
  const docs = submitted.docs.map((row) => ({ id: row.id, value: row.data() }));
  const seen = new Set<string>();
  const result: Qualification[] = [];
  for (const docRow of docs) {
    const server = serverRows.find((row) => row.documentId === docRow.id || row.id === docRow.id);
    result.push(mapQualification(docRow.id, server ? { ...docRow.value, ...server } : docRow.value));
    seen.add(docRow.id);
  }
  for (const [index, row] of serverRows.entries()) {
    const id = String(row.id ?? row.documentId ?? `server-${index}`);
    if (!seen.has(id)) result.push(mapQualification(id, row));
  }
  return result;
}

export async function uploadQualification(input: { uid: string; label: string; file: File; state?: AustralianStateCode }): Promise<string> {
  if (!input.uid || auth().currentUser?.uid !== input.uid) throw new Error("sign-in-required");
  const label = input.label.trim().slice(0, 100);
  if (!label) throw new Error("qualification-name-required");
  const fileKey = await uploadQualificationDocument({ uid: input.uid, file: input.file });
  const result = await addDoc(collection(db, "users", input.uid, "documents"), {
    label,
    fileKey,
    ...(input.state ? { state: input.state } : {}),
    status: "submitted",
    submittedAt: serverTimestamp(),
  });
  return result.id;
}
