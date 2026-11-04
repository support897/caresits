// Base profile data layer (profiles/{uid}). Doc shape is the LIVE one: side, displayName, postcode, photoUrl, about, card{}, looking{}, updatedAt.
// New fields live inside `card` (additive; rules updated in packages/rules). Verified flags are NEVER read from here: see data/checks.ts.
import { doc, getDoc, setDoc, getDocs, collection, serverTimestamp, query, limit } from "firebase/firestore";
import { db } from "../firebase";
export type Card = Record<string, any>;
export type Person = { uid: string; side: "family" | "carer"; name: string; firstName: string; photoUrl?: string; postcode?: string; about?: string; card: Card; looking: { musts?: Card; prefs?: Card }; updatedAt?: number; raw: Record<string, any> };
const ms = (v: any): number | undefined => (v?.toMillis ? v.toMillis() : typeof v === "number" ? v : undefined);
export function fromDoc(uid: string, d: Record<string, any>): Person {
  const name = String(d.displayName || "Member");
  return { uid, side: d.side === "carer" || d.side === "career" ? "carer" : "family", name, firstName: name.split(" ")[0] || name, photoUrl: d.photoUrl, postcode: d.postcode, about: d.about, card: d.card ?? {}, looking: d.looking ?? {}, updatedAt: ms(d.updatedAt), raw: d };
}
export async function loadProfile(uid: string): Promise<Person | null> { const s = await getDoc(doc(db, "profiles", uid)); return s.exists() ? fromDoc(uid, s.data()) : null; }
/** Merge a patch into the profile. `card` and `looking` patches are merged shallowly into the existing maps. */
export async function saveProfile(uid: string, patch: { side?: string; displayName?: string; postcode?: string; photoUrl?: string; about?: string; card?: Card; looking?: { musts?: Card; prefs?: Card } }): Promise<void> {
  const cur = (await getDoc(doc(db, "profiles", uid))).data() ?? {};
  const next: Record<string, any> = { ...cur, ...patch, card: { ...(cur.card ?? { }), ...(patch.card ?? {}) }, looking: { musts: { ...(cur.looking?.musts ?? {}), ...(patch.looking?.musts ?? {}) }, prefs: { ...(cur.looking?.prefs ?? {}), ...(patch.looking?.prefs ?? {}) } }, updatedAt: serverTimestamp() };
  await setDoc(doc(db, "profiles", uid), next);
}
export async function loadPeople(me: Person, max = 200): Promise<Person[]> {
  const s = await getDocs(query(collection(db, "profiles"), limit(max)));
  return s.docs.filter((x) => x.id !== me.uid).map((x) => fromDoc(x.id, x.data())).filter((p) => p.side !== me.side);
}
