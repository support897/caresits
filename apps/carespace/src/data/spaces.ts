import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@cc/core";
import type { MemberPermissions, SpaceRole } from "../lib/permissions";

export type SpaceMember = {
  role: SpaceRole;
  status: "active" | "removed";
  perms?: MemberPermissions;
  displayName?: string;
  joinedAt?: string;
  invitedBy?: string;
};

export type SpaceSummary = {
  id: string;
  name: string;
  ownerUid: string;
  role: SpaceRole;
  status: "active" | "removed";
  perms?: MemberPermissions;
  member: SpaceMember;
  colorIndex: number;
};

export type SpaceAccess = { space: SpaceSummary; member: SpaceMember };

function colorIndexFor(id: string): number {
  return [...id].reduce((total, character) => total + character.charCodeAt(0), 0) % 4;
}

const indexCacheKey = (uid: string) => `caresits-cs-space-index-v1:${uid}`;
function readCachedSpaces(uid: string): SpaceSummary[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(indexCacheKey(uid)) ?? "[]");
    return Array.isArray(value) ? value as SpaceSummary[] : [];
  } catch { return []; }
}
function saveCachedSpaces(uid: string, spaces: readonly SpaceSummary[]): void {
  try { localStorage.setItem(indexCacheKey(uid), JSON.stringify(spaces)); }
  catch { /* The saved list is only an offline convenience. */ }
}
function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && ["unavailable", "deadline-exceeded", "network-request-failed", "cancelled"].includes(code);
}

function asMember(value: unknown): SpaceMember | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<SpaceMember>;
  if (!["admin", "regular", "limited", "viewer"].includes(String(row.role)) || !row.status) return null;
  return row as SpaceMember;
}

/**
 * The app uses users/{uid}/spaces/{spaceId} as its private space index, not collectionGroup(members).
 * Keep this index in sync when an invite is accepted; every listed entry is still checked against the live member doc.
 */
export async function listUserSpaces(uid: string): Promise<SpaceSummary[]> {
  if (!uid) return [];
  const cached = readCachedSpaces(uid);
  if (typeof navigator !== "undefined" && !navigator.onLine) return cached;
  try {
    const index = await getDocs(collection(db, "users", uid, "spaces"));
    const rows = await Promise.all<SpaceSummary | null>(index.docs.map(async (entry): Promise<SpaceSummary | null> => {
      const spaceId = entry.id;
      const [spaceDoc, memberDoc] = await Promise.all([
        getDoc(doc(db, "careSpaces", spaceId)),
        getDoc(doc(db, "careSpaces", spaceId, "members", uid)),
      ]);
      if (!spaceDoc.exists() || !memberDoc.exists()) return null;
      const member = asMember(memberDoc.data());
      const spaceData = spaceDoc.data() as { name?: unknown; ownerUid?: unknown };
      if (!member || member.status !== "active") return null;
      return {
        id: spaceId,
        name: typeof spaceData.name === "string" && spaceData.name.trim() ? spaceData.name : "Family Care Space",
        ownerUid: typeof spaceData.ownerUid === "string" ? spaceData.ownerUid : "",
        role: member.role,
        status: member.status,
        perms: member.perms,
        member,
        colorIndex: colorIndexFor(spaceId),
      } satisfies SpaceSummary;
    }));
    const spaces = rows.filter((space): space is SpaceSummary => space !== null)
      .sort((left, right) => left.name.localeCompare(right.name));
    saveCachedSpaces(uid, spaces);
    return spaces;
  } catch (error) {
    if (isConnectionError(error)) return cached;
    throw error;
  }
}

export async function getSpaceAccess(uid: string, spaceId: string): Promise<SpaceAccess | null> {
  if (!uid || !spaceId) return null;
  const cached = readCachedSpaces(uid).find((space) => space.id === spaceId);
  if (typeof navigator !== "undefined" && !navigator.onLine) return cached ? { space: cached, member: cached.member } : null;
  try {
    const [spaceDoc, memberDoc] = await Promise.all([
      getDoc(doc(db, "careSpaces", spaceId)),
      getDoc(doc(db, "careSpaces", spaceId, "members", uid)),
    ]);
    if (!spaceDoc.exists() || !memberDoc.exists()) return null;
    const member = asMember(memberDoc.data());
    if (!member || member.status !== "active") return null;
    const data = spaceDoc.data() as { name?: unknown; ownerUid?: unknown };
    const space: SpaceSummary = {
      id: spaceId,
      name: typeof data.name === "string" && data.name.trim() ? data.name : "Family Care Space",
      ownerUid: typeof data.ownerUid === "string" ? data.ownerUid : "",
      role: member.role,
      status: member.status,
      perms: member.perms,
      member,
      colorIndex: colorIndexFor(spaceId),
    };
    saveCachedSpaces(uid, [...readCachedSpaces(uid).filter((row) => row.id !== spaceId), space]);
    return { space, member };
  } catch (error) {
    if (isConnectionError(error)) return cached ? { space: cached, member: cached.member } : null;
    throw error;
  }
}

export async function createCareSpace(uid: string, displayName: string): Promise<{ spaceId: string; created: boolean }> {
  if (!uid) throw new Error("A signed-in user is required.");
  const existing = (await listUserSpaces(uid)).find((space) => space.ownerUid === uid && space.role === "admin");
  if (existing) return { spaceId: existing.id, created: false };

  // The document ID is the owner's uid, matching the live rules' allowed owner/admin bootstrap shape.
  const spaceId = uid;
  const name = `${displayName.trim() || "My"} family`;
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  batch.set(doc(db, "careSpaces", spaceId), { ownerUid: uid, name, createdAt: now });
  batch.set(doc(db, "careSpaces", spaceId, "members", uid), {
    role: "admin",
    status: "active",
    perms: { allergies: true, medication: true, photos: true, calendar: true, privateMessages: true },
    displayName: displayName.trim() || "Admin",
    joinedAt: now,
    invitedBy: uid,
  });
  batch.set(doc(db, "users", uid, "spaces", spaceId), { spaceId, name, memberRole: "admin", joinedAt: now });
  await batch.commit();
  return { spaceId, created: true };
}

/** Call after a member invite is accepted so their own private index stays current. */
export async function recordSpaceJoin(uid: string, spaceId: string, name: string, role: SpaceRole): Promise<void> {
  if (!uid || !spaceId) return;
  await setDoc(doc(db, "users", uid, "spaces", spaceId), {
    spaceId,
    name,
    memberRole: role,
    joinedAt: new Date().toISOString(),
  }, { merge: true });
}

