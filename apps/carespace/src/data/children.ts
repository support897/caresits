import {
  arrayUnion, collection, collectionGroup, doc, documentId, getDoc, getDocs, query, setDoc, updateDoc, where,
  serverTimestamp, addDoc,
} from "firebase/firestore";
import { db } from "@cc/core";

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
export type ChildProfile = { id: string; name: string; ageYears: number; interests: string[]; sections: ChildSections };
export type DayStoryKind = "arrival" | "meal" | "drink" | "nap" | "activity" | "mood" | "photo" | "pickup" | "note";
export type DayStoryItem = { id: string; childId: string; day: string; kind: DayStoryKind; at: string; text: string; mood?: string; photoKey?: string; by?: string };

const EMPTY_PERMS: CarePerms = { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false };
const ALL_PERMS: CarePerms = { allergies: true, medication: true, photos: true, calendar: true, privateMessages: true };

export const DEMO_SPACES: CareSpace[] = [{ id: "demo-johnson", name: "Johnson family", ownerUid: "demo-parent", role: "admin", perms: ALL_PERMS, inventory: ["paper", "crayons", "shallow water tray", "large cups", "towel", "books"] }];
export const DEMO_CHILDREN: ChildProfile[] = [
  { id: "demo-mila", name: "Mila", ageYears: 3, interests: ["science", "nature", "stories"], sections: { health: { notes: "Carries a small water bottle. Ask before trying new foods." }, meals: { notes: "Likes fruit cut into small pieces." }, sleep: { notes: "Quiet story before rest." }, mood: { notes: "Settles with a familiar song." }, learning: { notes: "Enjoys water play and picture books." }, memories: ["Found a ladybird in the garden."] } },
  { id: "demo-theo", name: "Theo", ageYears: 7, interests: ["art", "reading", "music"], sections: { health: { notes: "Keep his hat with his bag." }, meals: { notes: "Prefers crunchy vegetables." }, sleep: { notes: "Reading helps him wind down." }, mood: { notes: "Likes a little notice before changes." }, learning: { notes: "Enjoys drawing maps and making up songs." }, memories: ["Built a paper bridge together."] } },
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
    };
  });
}

export async function saveChild(spaceId: string, child: Omit<ChildProfile, "id">, childId?: string): Promise<string> {
  const ref = childId ? doc(db, "careSpaces", spaceId, "children", childId) : doc(collection(db, "careSpaces", spaceId, "children"));
  await setDoc(ref, { name: child.name, ageYears: child.ageYears, interests: child.interests, sections: child.sections }, { merge: true });
  return ref.id;
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
