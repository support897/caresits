import { collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc } from "firebase/firestore";
import { counterpartQueries, db, filterEligible, fromDoc, loadPeople, loadProfile, type Person, type ServiceType } from "@cc/core";

export type DiscoveryPerson = Person & { verifiedLevel?: string; verifiedAt?: number };
export type VerifiedRecordReader = (uid: string) => Promise<Record<string, unknown> | null>;

export function verifiedLevelFromRecord(record: Record<string, unknown> | null): string | undefined {
  const status = typeof record?.status === "string" ? record.status.trim().toLowerCase() : "";
  if (status && status !== "verified") return undefined;
  if (status === "verified") return "verified";
  const value = record?.level ?? record?.checksLevel ?? record?.checkLevel;
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim().toLowerCase();
}

export function verifiedAtFromRecord(record: Record<string, unknown> | null): number | undefined {
  const value = record?.checkedOn ?? record?.verifiedAt ?? record?.updatedAt;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : undefined; }
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    const parsed = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

async function readVerifiedRecord(uid: string): Promise<Record<string, unknown> | null> {
  const snapshot = await getDoc(doc(db, "verified", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

/** Adds check levels only from the server-written verified/{uid} records. */
export async function enrichWithVerifiedLevels(people: Person[], readRecord: VerifiedRecordReader = readVerifiedRecord): Promise<DiscoveryPerson[]> {
  const results: DiscoveryPerson[] = new Array(people.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < people.length) {
      const index = cursor;
      cursor += 1;
      const person = people[index];
      if (!person) continue;
      let verifiedLevel: string | undefined;
      let verifiedAt: number | undefined;
      try {
        const serverRecord = await readRecord(person.uid);
        verifiedLevel = verifiedLevelFromRecord(serverRecord);
        verifiedAt = verifiedAtFromRecord(serverRecord);
      } catch { verifiedLevel = undefined; verifiedAt = undefined; }
      results[index] = { ...person, ...(verifiedLevel ? { verifiedLevel } : {}), ...(verifiedAt !== undefined ? { verifiedAt } : {}) };
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, people.length) }, () => worker()));
  return results.filter((person): person is DiscoveryPerson => person !== undefined);
}

export async function loadDiscoveryPeople(me: Person, max = 200, intent?: ServiceType | null): Promise<DiscoveryPerson[]> {
  return enrichWithVerifiedLevels(await loadPeople(me, max, intent));
}

export function subscribeDiscoveryPeople(
  me: Person,
  onPeople: (people: DiscoveryPerson[]) => void,
  onError: (error: Error) => void,
  max = 200,
  intent?: ServiceType | null,
): () => void {
  let generation = 0;
  const queries = counterpartQueries(me, max, intent);
  const latest = new Map<number, Person[]>();
  const emit = () => {
    const current = ++generation;
    const merged = new Map<string, Person>();
    for (const rows of latest.values()) for (const person of rows) merged.set(person.uid, person);
    void enrichWithVerifiedLevels(filterEligible(me, [...merged.values()], intent)).then((enriched) => {
      if (current === generation) onPeople(enriched);
    }).catch((error: unknown) => {
      if (current === generation) onError(error instanceof Error ? error : new Error("Could not read profiles"));
    });
  };
  if (!queries.length) { onPeople([]); return () => undefined; }
  const stops = queries.map((q, index) => onSnapshot(q, (snapshot) => {
    latest.set(index, snapshot.docs.filter((item) => item.id !== me.uid).map((item) => fromDoc(item.id, item.data())));
    if (latest.size === queries.length) emit();
  }, onError));
  return () => { generation += 1; stops.forEach((stop) => stop()); };
}

export async function loadSavedIds(uid: string): Promise<string[]> {
  const snapshot = await getDocs(collection(db, "users", uid, "saved"));
  return snapshot.docs.map((item) => item.id);
}

export function subscribeSavedIds(uid: string, onIds: (ids: string[]) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(collection(db, "users", uid, "saved"), (snapshot) => {
    onIds(snapshot.docs.map((item) => item.id));
  }, onError);
}

export async function loadSavedPeople(me: Person, intent?: ServiceType | null): Promise<DiscoveryPerson[]> {
  const ids = await loadSavedIds(me.uid);
  const profiles = await Promise.all(ids.map((uid) => loadProfile(uid)));
  const people = filterEligible(me, profiles.filter((person): person is Person => person !== null), intent);
  return enrichWithVerifiedLevels(people);
}

export async function savePerson(uid: string, personUid: string): Promise<void> {
  await setDoc(doc(db, "users", uid, "saved", personUid), { at: serverTimestamp() });
}

export async function removeSavedPerson(uid: string, personUid: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "saved", personUid));
}
