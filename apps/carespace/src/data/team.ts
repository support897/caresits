import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@cc/core";
import {
  defaultPermissionsForRole, effectivePermissions, isMemberActive,
  type MemberPermissions, type SpaceRole,
} from "@cc/core/src/permissions";

export type TeamMember = {
  uid: string;
  role: SpaceRole;
  status: "active" | "removed";
  perms: Record<"allergies" | "medication" | "photos" | "calendar" | "privateMessages", boolean>;
  displayName: string;
  photoUrl?: string;
  joinedAt?: unknown;
  invitedBy?: string;
};

function isRole(value: unknown): value is SpaceRole {
  return value === "admin" || value === "regular" || value === "limited" || value === "viewer";
}

export async function loadTeamMembers(spaceId: string): Promise<TeamMember[]> {
  if (!spaceId) return [];
  const snapshot = await getDocs(collection(db, "careSpaces", spaceId, "members"));
  return Promise.all(snapshot.docs.map(async (memberDoc): Promise<TeamMember> => {
    const raw = memberDoc.data();
    const role: SpaceRole = isRole(raw.role) ? raw.role : "viewer";
    const status = isMemberActive(raw.status) ? "active" : "removed";
    let profile: Record<string, unknown> = {};
    if (typeof raw.displayName !== "string" || !raw.displayName.trim()) {
      try {
        const profileDoc = await getDoc(doc(db, "profiles", memberDoc.id));
        if (profileDoc.exists()) profile = profileDoc.data();
      } catch { /* A member name is optional; access never depends on this profile read. */ }
    }
    const displayName = typeof raw.displayName === "string" && raw.displayName.trim()
      ? raw.displayName.trim()
      : typeof profile.displayName === "string" && profile.displayName.trim()
        ? profile.displayName.trim()
        : "Team member";
    return {
      uid: memberDoc.id,
      role,
      status,
      perms: effectivePermissions(role, raw.perms as MemberPermissions | undefined),
      displayName,
      photoUrl: typeof profile.photoUrl === "string" ? profile.photoUrl : undefined,
      joinedAt: raw.joinedAt,
      invitedBy: typeof raw.invitedBy === "string" ? raw.invitedBy : undefined,
    };
  }));
}

async function requireActiveAdmin(spaceId: string, actingUid: string): Promise<void> {
  if (!spaceId || !actingUid) throw new Error("sign-in-required");
  const actor = await getDoc(doc(db, "careSpaces", spaceId, "members", actingUid));
  const data = actor.data();
  if (!actor.exists() || !isMemberActive(data?.status) || data?.role !== "admin") throw new Error("admin-required");
}

async function requireActiveTarget(spaceId: string, targetUid: string): Promise<Record<string, unknown>> {
  const target = await getDoc(doc(db, "careSpaces", spaceId, "members", targetUid));
  const data = target.data();
  if (!target.exists() || !isMemberActive(data?.status)) throw new Error("member-not-active");
  return data;
}

async function keepAnotherAdmin(spaceId: string, targetUid: string, actorUid: string): Promise<void> {
  const space = await getDoc(doc(db, "careSpaces", spaceId));
  if (space.exists() && space.data().ownerUid === targetUid) throw new Error("space-owner-cannot-be-removed");
  const members = await getDocs(collection(db, "careSpaces", spaceId, "members"));
  const otherAdmins = members.docs.filter((entry) => entry.id !== targetUid
    && entry.data().role === "admin" && isMemberActive(entry.data().status));
  if (!otherAdmins.length) throw new Error("last-admin");
  if (targetUid === actorUid) throw new Error("admin-cannot-leave");
}

export async function updateMemberRole(spaceId: string, actingUid: string, targetUid: string, role: SpaceRole): Promise<void> {
  await requireActiveAdmin(spaceId, actingUid);
  const target = await requireActiveTarget(spaceId, targetUid);
  if (target.role === "admin" && role !== "admin") await keepAnotherAdmin(spaceId, targetUid, actingUid);
  await updateDoc(doc(db, "careSpaces", spaceId, "members", targetUid), {
    role,
    perms: defaultPermissionsForRole(role),
  });
}

export async function updateMemberPermissions(
  spaceId: string,
  actingUid: string,
  targetUid: string,
  perms: MemberPermissions,
): Promise<void> {
  await requireActiveAdmin(spaceId, actingUid);
  const target = await requireActiveTarget(spaceId, targetUid);
  if (target.role === "admin") throw new Error("admin-permissions-are-fixed");
  const role = isRole(target.role) ? target.role : "viewer";
  await updateDoc(doc(db, "careSpaces", spaceId, "members", targetUid), {
    perms: effectivePermissions(role, perms),
  });
}

export async function removeTeamMember(spaceId: string, actingUid: string, targetUid: string): Promise<void> {
  await requireActiveAdmin(spaceId, actingUid);
  const target = await requireActiveTarget(spaceId, targetUid);
  if (target.role === "admin") await keepAnotherAdmin(spaceId, targetUid, actingUid);
  await updateDoc(doc(db, "careSpaces", spaceId, "members", targetUid), { status: "removed" });
}

export async function leaveCareSpace(spaceId: string, uid: string): Promise<void> {
  if (!spaceId || !uid) throw new Error("sign-in-required");
  const memberRef = doc(db, "careSpaces", spaceId, "members", uid);
  const member = await getDoc(memberRef);
  const data = member.data();
  if (!member.exists() || !isMemberActive(data?.status)) throw new Error("member-not-active");
  if (data?.role === "admin") throw new Error("admin-cannot-leave");
  await updateDoc(memberRef, { status: "removed" });
}
