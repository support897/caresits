import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@cc/core";

export const REPORT_CATEGORIES = [
  ["spam_scam", "Spam or scam"],
  ["rude_abusive", "Rude or abusive"],
  ["fake_profile", "Fake profile"],
  ["child_safety", "Child safety"],
  ["inappropriate", "Inappropriate"],
  ["other", "Other"],
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number][0];
export type EmergencyContact = { name: string; phone: string; relation?: string };
type ReportSurface = "message" | "card" | "job" | "profile";
const REPORT_SURFACES = new Set<ReportSurface>(["message", "card", "job", "profile"]);

export function planReport(input: { reporterUid: string; reportedUid: string; surface: ReportSurface; category: string; words?: string; snapshot?: { items?: unknown[]; text?: unknown; title?: unknown }; nowIso?: string }) {
  if (!input.reporterUid || input.reporterUid === input.reportedUid || !REPORT_SURFACES.has(input.surface) || !REPORT_CATEGORIES.some(([key]) => key === input.category)) return { ok: false as const, reason: "bad-report" };
  return {
    ok: true as const,
    data: {
      reporterUid: input.reporterUid,
      reportedUid: input.reportedUid,
      surface: input.surface,
      category: input.category as ReportCategory,
      reporterWords: String(input.words ?? "").slice(0, 1000),
      snapshot: {
        items: Array.isArray(input.snapshot?.items) ? input.snapshot.items.slice(0, 10).map(String) : [],
        text: String(input.snapshot?.text ?? "").slice(0, 4000),
        title: String(input.snapshot?.title ?? "").slice(0, 120),
      },
      state: "open" as const,
      createdAt: input.nowIso ?? new Date().toISOString(),
    },
  };
}

export function planBlock(uid: string, otherUid: string): { ok: boolean; path?: string } {
  if (!uid || !otherUid || uid === otherUid || uid.includes("/") || otherUid.includes("/")) return { ok: false };
  return { ok: true, path: `users/${uid}/blocks/${otherUid}` };
}

export function cleanEmergencyContacts(value: unknown): EmergencyContact[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).map((entry) => {
    const row = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    return { name: String(row.name ?? "").trim().slice(0, 80), phone: String(row.phone ?? "").trim().slice(0, 40), ...(row.relation ? { relation: String(row.relation).trim().slice(0, 60) } : {}) };
  }).filter((item) => item.name && item.phone);
}

function requireSelf(uid: string): void {
  if (!uid || auth().currentUser?.uid !== uid) throw new Error("sign-in-required");
}

export async function submitSafetyReport(input: { uid: string; otherUid: string; category: string; words?: string; surface?: ReportSurface; title?: string; text?: string }): Promise<void> {
  requireSelf(input.uid);
  const plan = planReport({ reporterUid: input.uid, reportedUid: input.otherUid, surface: input.surface ?? "profile", category: input.category, words: input.words, snapshot: { title: input.title, text: input.text } });
  if (!plan.ok) throw new Error("invalid-report");
  await addDoc(collection(db, "safetyReports"), { ...plan.data, createdAt: serverTimestamp() });
}

export async function blockUser(uid: string, otherUid: string): Promise<void> {
  requireSelf(uid);
  const plan = planBlock(uid, otherUid);
  if (!plan.ok || !plan.path) throw new Error("invalid-block");
  await setDoc(doc(db, plan.path), { createdAt: serverTimestamp() });
}

export async function loadEmergencyContacts(uid: string): Promise<EmergencyContact[]> {
  requireSelf(uid);
  const saved = await getDoc(doc(db, "users", uid, "emergencyContacts", "main"));
  if (saved.exists()) return cleanEmergencyContacts(saved.data().contacts);
  const legacy = await getDoc(doc(db, "users", uid));
  return cleanEmergencyContacts(legacy.data()?.emergencyContacts);
}

export async function saveEmergencyContacts(uid: string, contacts: EmergencyContact[]): Promise<void> {
  requireSelf(uid);
  const clean = cleanEmergencyContacts(contacts);
  if (contacts.length > 3 || clean.length !== contacts.length) throw new Error("invalid-emergency-contacts");
  await setDoc(doc(db, "users", uid, "emergencyContacts", "main"), { contacts: clean, updatedAt: serverTimestamp() });
}

export const EXPORT_MY_DATA_URL = "https://us-central1-caresits-812a0.cloudfunctions.net/exportMyData";
export const DELETE_MY_ACCOUNT_URL = "https://us-central1-caresits-812a0.cloudfunctions.net/deleteMyAccount";
async function callAccountFunction(uid: string, url: string, extra: Record<string, unknown> = {}): Promise<void> {
  requireSelf(uid);
  const token = await auth().currentUser?.getIdToken();
  if (!token) throw new Error("sign-in-required");
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(extra) });
  if (!response.ok) throw new Error("request-failed");
}
export function requestDataExport(uid: string): Promise<void> {
  return callAccountFunction(uid, EXPORT_MY_DATA_URL);
}
export function requestAccountDeletion(uid: string, typedConfirm: string): Promise<void> {
  if (typedConfirm !== "DELETE") return Promise.reject(new Error("confirmation-required"));
  return callAccountFunction(uid, DELETE_MY_ACCOUNT_URL, { confirm: typedConfirm });
}
