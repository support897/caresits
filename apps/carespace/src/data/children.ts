import {
  arrayUnion, collection, collectionGroup, doc, documentId, getDoc, getDocs, query, setDoc, updateDoc, where,
  serverTimestamp, addDoc,
} from "firebase/firestore";
import { db, schemas, t } from "@cc/core";

export type CareRole = "admin" | "regular" | "limited" | "viewer";
export type CarePerms = { allergies: boolean; medication: boolean; photos: boolean; calendar: boolean; privateMessages: boolean };
export type CareSpace = { id: string; name: string; ownerUid?: string; role: CareRole; perms: CarePerms; inventory: string[] };
export type ChildSectionId = "health" | "meals" | "sleep" | "mood" | "learning";
export type ChildSections = {
  health: { notes: string };
  meals: { notes: string };
  sleep: { notes: string };
  mood: { notes: string };
  learning: { notes: string };
  memories: string[];
};
export type ChildNap = { from: string; to: string };
export type ChildRoutine = { wake?: string; bed?: string; naps: ChildNap[] };
export type ChildMilestone = { title: string; at: Date; note?: string; photoKey?: string };
export type ChildProfile = {
  id: string; name: string; ageYears: number; interests: string[]; sections: ChildSections;
  foodPreferences: string[]; learningGoals: string[]; milestones: ChildMilestone[]; routine: ChildRoutine;
};
export type ChildDetails = Pick<ChildProfile, "foodPreferences" | "learningGoals" | "milestones" | "routine">;
export type DayStoryKind = "arrival" | "meal" | "drink" | "nap" | "activity" | "mood" | "photo" | "pickup" | "note";
export type DayStoryItem = { id: string; childId: string; day: string; kind: DayStoryKind; at: string; text: string; mood?: string; photoKey?: string; by?: string };

const EMPTY_PERMS: CarePerms = { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false };
const ALL_PERMS: CarePerms = { allergies: true, medication: true, photos: true, calendar: true, privateMessages: true };
const ROUTINE_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function canEditChildDetails(role: CareRole): boolean {
  return role === "admin";
}

export function parseChildList(value: string, maxItems: number, maxLength: number): string[] {
  const seen = new Set<string>();
  return value.split(/[\n,]/).map((item) => item.trim().slice(0, maxLength)).filter((item) => {
    const key = item.toLocaleLowerCase();
    if (!item || seen.has(key) || seen.size >= maxItems) return false;
    seen.add(key);
    return true;
  });
}

export function isRoutineTime(value: unknown): value is string {
  return typeof value === "string" && ROUTINE_TIME.test(value);
}

export function normalizeChildRoutine(value: unknown): ChildRoutine {
  if (!value || typeof value !== "object") return { naps: [] };
  const raw = value as Record<string, unknown>;
  const naps = Array.isArray(raw.naps) ? raw.naps.slice(0, 10).filter((nap): nap is Record<string, unknown> => Boolean(nap && typeof nap === "object"))
    .filter((nap) => isRoutineTime(nap.from) && isRoutineTime(nap.to)).map((nap) => ({ from: nap.from as string, to: nap.to as string })) : [];
  return { ...(isRoutineTime(raw.wake) ? { wake: raw.wake } : {}), ...(isRoutineTime(raw.bed) ? { bed: raw.bed } : {}), naps };
}

function milestoneDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  if (value && typeof value === "object") {
    const timestamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof timestamp.toDate === "function") {
      try { const parsed = timestamp.toDate(); return Number.isFinite(parsed.getTime()) ? parsed : null; } catch { return null; }
    }
    if (typeof timestamp.seconds === "number") {
      const date = new Date(timestamp.seconds * 1_000);
      return Number.isFinite(date.getTime()) ? date : null;
    }
  }
  return null;
}

export function normalizeChildMilestones(value: unknown): ChildMilestone[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    const at = milestoneDate(raw.at);
    if (typeof raw.title !== "string" || !raw.title.trim() || !at) return [];
    return [{ title: raw.title.slice(0, 120), at, ...(typeof raw.note === "string" ? { note: raw.note.slice(0, 600) } : {}), ...(typeof raw.photoKey === "string" ? { photoKey: raw.photoKey } : {}) }];
  });
}

export const DEMO_SPACES: CareSpace[] = [{ id: "demo-johnson", name: "Johnson family", ownerUid: "demo-parent", role: "admin", perms: ALL_PERMS, inventory: ["paper", "crayons", "shallow water tray", "large cups", "towel", "books"] }];
export const DEMO_CHILDREN: ChildProfile[] = [
  { id: "demo-mila", name: "Mila", ageYears: 3, interests: ["science", "nature", "stories"], sections: { health: { notes: "Carries a small water bottle. Ask before trying new foods." }, meals: { notes: "Likes fruit cut into small pieces." }, sleep: { notes: "Quiet story before rest." }, mood: { notes: "Settles with a familiar song." }, learning: { notes: "Enjoys water play and picture books." }, memories: ["Found a ladybird in the garden."] }, foodPreferences: ["Fruit cut into small pieces"], learningGoals: ["Notice changes in water play"], milestones: [], routine: { wake: "07:00", bed: "19:30", naps: [{ from: "13:00", to: "14:00" }] } },
  { id: "demo-theo", name: "Theo", ageYears: 7, interests: ["art", "reading", "music"], sections: { health: { notes: "Keep his hat with his bag." }, meals: { notes: "Prefers crunchy vegetables." }, sleep: { notes: "Reading helps him wind down." }, mood: { notes: "Likes a little notice before changes." }, learning: { notes: "Enjoys drawing maps and making up songs." }, memories: ["Built a paper bridge together."] }, foodPreferences: ["Crunchy vegetables"], learningGoals: ["Build stories through drawing"], milestones: [], routine: { wake: "06:45", bed: "20:00", naps: [] } },
];

function toRole(value: unknown): CareRole {
  return value === "admin" || value === "regular" || value === "limited" || value === "viewer" ? value : "viewer";
}

function memberPerms(raw: Record<string, unknown>, role: CareRole): CarePerms {
  if (role === "admin") return ALL_PERMS;
  const value = raw.perms ?? raw.permissions;
  if (Array.isArray(value)) {
    const set = new Set(value.map(String));
    if (set.has("all")) return ALL_PERMS;
    return { allergies: set.has("allergies"), medication: set.has("medication"), photos: set.has("photos"), calendar: set.has("calendar"), privateMessages: set.has("privateMessages") };
  }
  if (value && typeof value === "object") return { ...EMPTY_PERMS, ...(value as Partial<CarePerms>) };
  return EMPTY_PERMS;
}

function spaceFrom(id: string, data: Record<string, unknown>, role: CareRole, perms: CarePerms): CareSpace {
  return { id, name: typeof data.name === "string" ? data.name : "Family care space", ownerUid: typeof data.ownerUid === "string" ? data.ownerUid : undefined, role, perms, inventory: Array.isArray(data.inventory) ? data.inventory.map(String) : [] };
}

export function canReadAllergies(space: Pick<CareSpace, "role" | "perms">): boolean {
  return space.role === "admin" || space.perms.allergies;
}

export function canEditMedical(role: CareRole): boolean {
  return role === "admin";
}

export async function loadCareSpaces(uid: string): Promise<CareSpace[]> {
  const spaces = new Map<string, CareSpace>();
  try {
    const owned = await getDocs(query(collection(db, "careSpaces"), where("ownerUid", "==", uid)));
    owned.docs.forEach((snapshot) => spaces.set(snapshot.id, spaceFrom(snapshot.id, snapshot.data(), "admin", ALL_PERMS)));
  } catch { /* membership-specific reads below may still work */ }

  try {
    const memberships = await getDocs(query(collectionGroup(db, "members"), where(documentId(), "==", uid)));
    for (const member of memberships.docs) {
      const access = member.data();
      if (access.status !== "active") continue;
      const spaceRef = member.ref.parent.parent;
      if (!spaceRef || spaces.has(spaceRef.id)) continue;
      const snapshot = await getDoc(spaceRef);
      if (!snapshot.exists()) continue;
      const role = toRole(access.role);
      spaces.set(spaceRef.id, spaceFrom(spaceRef.id, snapshot.data(), role, memberPerms(access, role)));
    }
  } catch { /* Firestore rules can deny collection-group discovery; never broaden reads to other spaces */ }

  try {
    const legacySpace = await getDoc(doc(db, "careSpaces", uid));
    if (legacySpace.exists() && !spaces.has(legacySpace.id)) {
      const member = await getDoc(doc(db, "careSpaces", legacySpace.id, "members", uid));
      const access = member.exists() ? member.data() : {};
      const role = member.exists() && access.status === "active" ? toRole(access.role) : legacySpace.data().ownerUid === uid ? "admin" : "viewer";
      if (role !== "viewer") spaces.set(legacySpace.id, spaceFrom(legacySpace.id, legacySpace.data(), role, memberPerms(access, role)));
    }
  } catch { /* no readable legacy space */ }
  return [...spaces.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadCareSpace(spaceId: string): Promise<CareSpace | null> {
  const snapshot = await getDoc(doc(db, "careSpaces", spaceId));
  return snapshot.exists() ? spaceFrom(snapshot.id, snapshot.data(), "viewer", EMPTY_PERMS) : null;
}

export async function loadChildren(spaceId: string): Promise<ChildProfile[]> {
  const result = await getDocs(collection(db, "careSpaces", spaceId, "children"));
  return result.docs.map((snapshot) => {
    const value = snapshot.data();
    const sections = value.sections && typeof value.sections === "object" ? value.sections as Partial<ChildSections> : {};
    return {
      id: snapshot.id,
      name: typeof value.name === "string" ? value.name : "Child",
      ageYears: Number.isFinite(Number(value.ageYears)) ? Number(value.ageYears) : 0,
      interests: Array.isArray(value.interests) ? value.interests.map(String) : [],
      sections: {
        health: sections.health ?? { notes: "" }, meals: sections.meals ?? { notes: "" }, sleep: sections.sleep ?? { notes: "" },
        mood: sections.mood ?? { notes: "" }, learning: sections.learning ?? { notes: "" }, memories: Array.isArray(sections.memories) ? sections.memories : [],
      },
      foodPreferences: Array.isArray(value.foodPreferences) ? value.foodPreferences.filter((item): item is string => typeof item === "string").slice(0, 30) : [],
      learningGoals: Array.isArray(value.learningGoals) ? value.learningGoals.filter((item): item is string => typeof item === "string").slice(0, 30) : [],
      milestones: normalizeChildMilestones(value.milestones),
      routine: normalizeChildRoutine(value.routine),
    };
  });
}

export async function saveChild(spaceId: string, child: Omit<ChildProfile, "id">, childId?: string): Promise<string> {
  const ref = childId ? doc(db, "careSpaces", spaceId, "children", childId) : doc(collection(db, "careSpaces", spaceId, "children"));
  const record = { name: child.name, ageYears: child.ageYears, interests: child.interests, sections: child.sections, foodPreferences: child.foodPreferences, learningGoals: child.learningGoals, milestones: child.milestones, routine: child.routine };
  const parsed = schemas.careSpaceChildRecordSchema.safeParse(record);
  if (!parsed.success) throw new Error(t("care.childDetailsInvalid", "Check the child profile details and try again."));
  await setDoc(ref, parsed.data, { merge: true });
  return ref.id;
}

export async function saveChildDetails(spaceId: string, childName: string, childId: string, details: ChildDetails): Promise<void> {
  const record = { name: childName, foodPreferences: details.foodPreferences, learningGoals: details.learningGoals, milestones: details.milestones, routine: details.routine };
  const parsed = schemas.careSpaceChildRecordSchema.safeParse(record);
  if (!parsed.success) throw new Error(t("care.childDetailsInvalid", "Check the child profile details and try again."));
  await updateDoc(doc(db, "careSpaces", spaceId, "children", childId), {
    foodPreferences: parsed.data.foodPreferences ?? [],
    learningGoals: parsed.data.learningGoals ?? [],
    milestones: parsed.data.milestones ?? [],
    routine: parsed.data.routine ?? { naps: [] },
    updatedAt: serverTimestamp(),
  });
}

export async function saveChildSection(spaceId: string, childId: string, section: ChildSectionId, notes: string): Promise<void> {
  await updateDoc(doc(db, "careSpaces", spaceId, "children", childId), { [`sections.${section}.notes`]: notes });
}

export async function addChildMemory(spaceId: string, childId: string, memory: string): Promise<void> {
  await updateDoc(doc(db, "careSpaces", spaceId, "children", childId), { "sections.memories": arrayUnion(memory) });
}

export async function saveSpaceInventory(spaceId: string, inventory: string[]): Promise<void> {
  await updateDoc(doc(db, "careSpaces", spaceId), { inventory: [...new Set(inventory.map((item) => item.trim()).filter(Boolean))] });
}

export async function loadDayStory(spaceId: string, childId: string, day: string): Promise<DayStoryItem[]> {
  const snapshot = await getDocs(collection(db, "careSpaces", spaceId, "dayStory"));
  return snapshot.docs.map((item) => {
    const value = item.data();
    const rawAt = value.at as { toDate?: () => Date } | string | undefined;
    const at = typeof rawAt === "string" ? rawAt : rawAt?.toDate ? rawAt.toDate().toISOString() : "";
    return { ...value, id: item.id, at } as DayStoryItem;
  }).filter((item) => item.childId === childId && item.day === day).sort((a, b) => b.at.localeCompare(a.at));
}

export async function addDayStoryItem(spaceId: string, item: Omit<DayStoryItem, "id" | "at"> & { at?: string }): Promise<string> {
  const ref = await addDoc(collection(db, "careSpaces", spaceId, "dayStory"), { ...item, at: serverTimestamp() });
  return ref.id;
}
