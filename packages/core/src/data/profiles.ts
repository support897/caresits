// Base profile data layer (profiles/{uid}). Doc shape is the LIVE one: side, displayName, postcode, photoUrl, about, card{}, looking{}, updatedAt.
// New fields live inside `card` (additive; rules updated in packages/rules). Verified flags are NEVER read from here: see data/checks.ts.
import { doc, getDoc, setDoc, getDocs, collection, serverTimestamp, query, limit, where } from "firebase/firestore";
import { filterEligible, servicesOf, type ServiceType } from "../match/eligibility";
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
/** One query per service (rules require side + card.careTypes array-contains). Same rule is re-applied on the result. */
export function counterpartQueries(me: Person, max = 200, intent?: ServiceType | null) {
  const wanted = servicesOf(me).filter((svc) => !intent || svc === intent);
  return wanted.map((svc) => query(collection(db, "profiles"), where("side", "==", me.side === "family" ? "carer" : "family"), where("card.careTypes", "array-contains", svc), limit(max)));
}
export async function loadPeople(me: Person, max = 200, intent?: ServiceType | null): Promise<Person[]> {
  const snaps = await Promise.all(counterpartQueries(me, max, intent).map((q) => getDocs(q)));
  const seen = new Map<string, Person>();
  for (const snap of snaps) for (const x of snap.docs) if (x.id !== me.uid) seen.set(x.id, fromDoc(x.id, x.data()));
  return filterEligible(me, [...seen.values()], intent);
}
