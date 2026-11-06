import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@cc/core";

/** Child photos live in the parent's private area (users/{uid}/children/{id}). They never go on the public profile. */
export type KidRow = { id: string; name: string; ageYears: number | null; photoKey: string };
export const kidDocId = (index: number): string => `kid${index + 1}`;

type RawKid = { name?: unknown; ageYears?: unknown };
/** Pure: joins the kids listed on the profile (first name and age only) with the private photo records. */
export function mergeKids(kids: unknown, photos: Record<string, string>): KidRow[] {
  if (!Array.isArray(kids)) return [];
  return kids.slice(0, 8).flatMap((raw: RawKid, index) => {
    const name = typeof raw?.name === "string" ? raw.name.trim().split(/\s+/)[0] ?? "" : "";
    if (!name) return [];
    const id = kidDocId(index);
    const age = typeof raw.ageYears === "number" && Number.isFinite(raw.ageYears) ? raw.ageYears : null;
    return [{ id, name, ageYears: age, photoKey: photos[id] ?? "" }];
  });
}
export async function loadChildPhotoKeys(uid: string): Promise<Record<string, string>> {
  const rows = await getDocs(collection(db, "users", uid, "children"));
  const out: Record<string, string> = {};
  rows.docs.forEach((row) => { const key = row.data().photoKey; if (typeof key === "string" && key) out[row.id] = key; });
  return out;
}
export async function saveChildPhotoKey(uid: string, kid: { id: string; name: string }, photoKey: string): Promise<void> {
  await setDoc(doc(db, "users", uid, "children", kid.id), { name: kid.name, photoKey, updatedAt: serverTimestamp() }, { merge: true });
}
