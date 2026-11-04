import { doc, getDoc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@cc/core";
import {
  defaultPermissionsForRole, effectivePermissions, isMemberActive,
  type MemberPermissions, type SpaceRole,
} from "@cc/core/src/permissions";
import { recordSpaceJoin } from "./spaces";

export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

type TimeValue = { toMillis?: () => number; toDate?: () => Date } | Date | number | string | null | undefined;
export type InviteAccess = {
  spaceId?: string;
  role: SpaceRole;
  perms?: MemberPermissions;
  createdBy?: string;
  expiresAt?: TimeValue;
  usedBy?: string | null;
  targetUid?: string;
  bookingId?: string;
};
export type JoinTarget = { spaceId: string; code: string };

export function cleanInviteCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isInviteCode(value: string): boolean {
  const code = cleanInviteCode(value);
  return code.length === INVITE_CODE_LENGTH && [...code].every((character) => INVITE_CODE_ALPHABET.includes(character));
}

/** Reuses the existing Caresitters invite alphabet: no visually ambiguous I, L, O, 0, or 1. */
function secureRandomUnit(): number {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error("secure-random-unavailable");
  const value = new Uint32Array(1);
  cryptoApi.getRandomValues(value);
  return value[0]! / 0x1_0000_0000;
}

export function makeInviteCode(random: () => number = secureRandomUnit): string {
  let code = "";
  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error("invalid-random-source");
    const pick = Math.floor(sample * INVITE_CODE_ALPHABET.length);
    code += INVITE_CODE_ALPHABET[pick];
  }
  return code;
}

function timeMillis(value: TimeValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object") {
    try {
      const millis = typeof value.toMillis === "function" ? value.toMillis() : value.toDate?.().getTime();
      return typeof millis === "number" && Number.isFinite(millis) ? millis : null;
    } catch { return null; }
  }
  return null;
}

export function isInviteExpired(expiresAt: TimeValue, now = Date.now()): boolean {
  const expiry = timeMillis(expiresAt);
  return expiry === null || expiry <= now;
}

export function canAcceptInvite(invite: InviteAccess | null | undefined, now = Date.now()): boolean {
  return !!invite && !invite.usedBy && !isInviteExpired(invite.expiresAt, now);
}

export function parseJoinInput(input: string): JoinTarget | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const spaceId = url.searchParams.get("spaceId") ?? url.searchParams.get("space") ?? "";
    const code = cleanInviteCode(url.searchParams.get("code") ?? "");
    return spaceId && isInviteCode(code) ? { spaceId, code } : null;
  } catch { /* typed code below */ }
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const spaceId = value.slice(0, separator).trim();
  const code = cleanInviteCode(value.slice(separator + 1));
  return spaceId && isInviteCode(code) ? { spaceId, code } : null;
}

async function requireActiveAdmin(spaceId: string, uid: string): Promise<void> {
  if (!spaceId || !uid) throw new Error("sign-in-required");
  const member = await getDoc(doc(db, "careSpaces", spaceId, "members", uid));
  const data = member.data();
  if (!member.exists() || !isMemberActive(data?.status) || data?.role !== "admin") throw new Error("admin-required");
}

export async function createSpaceInvite(
  spaceId: string,
  createdBy: string,
  role: SpaceRole,
  perms: MemberPermissions = defaultPermissionsForRole(role),
  expiresInDays = 7,
): Promise<{ code: string; expiresAt: Date }> {
  await requireActiveAdmin(spaceId, createdBy);
  if (role === "admin") throw new Error("admin-invites-not-allowed");
  const safeDays = Math.max(1, Math.min(30, Math.floor(expiresInDays)));
  const expiresAt = new Date(Date.now() + safeDays * DAY_MS);
  const inviteData = {
    spaceId,
    role,
    perms: effectivePermissions(role, perms),
    createdBy,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    usedBy: null,
  };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeInviteCode();
    const inviteRef = doc(db, "careSpaceInvites", code);
    try {
      await runTransaction(db, async (transaction) => {
        const existing = await transaction.get(inviteRef);
        if (existing.exists()) throw new Error("invite-code-collision");
        transaction.set(inviteRef, inviteData);
      });
      return { code, expiresAt };
    } catch (error) {
      if (error instanceof Error && error.message === "invite-code-collision") continue;
      throw error;
    }
  }
  throw new Error("invite-code-unavailable");
}

export async function joinCareSpaceWithInvite(
  target: JoinTarget,
  uid: string,
  displayName: string,
): Promise<{ role: SpaceRole; spaceName: string }> {
  if (!uid || !target.spaceId || !isInviteCode(target.code)) throw new Error("invite-invalid");
  const inviteRef = doc(db, "careSpaceInvites", cleanInviteCode(target.code));
  const result = await runTransaction(db, async (transaction) => {
    const inviteSnapshot = await transaction.get(inviteRef);
    if (!inviteSnapshot.exists()) throw new Error("invite-not-found");
    const invite = inviteSnapshot.data() as InviteAccess;
    if (!canAcceptInvite(invite)) throw new Error(invite.usedBy ? "invite-used" : "invite-expired");
    const spaceId = invite.spaceId ?? "";
    if (!spaceId || spaceId !== target.spaceId) throw new Error("invite-not-found");
    if (invite.createdBy === uid) throw new Error("invite-own-space");
    if (invite.targetUid && invite.targetUid !== uid) throw new Error("invite-not-for-you");
    const memberRef = doc(db, "careSpaces", spaceId, "members", uid);
    const memberSnapshot = await transaction.get(memberRef);
    if (memberSnapshot.exists() && isMemberActive(memberSnapshot.data().status)) throw new Error("already-a-member");
    if (invite.role !== "regular" && invite.role !== "limited" && invite.role !== "viewer") throw new Error("invite-invalid");
    const role = invite.role;
    const perms = invite.perms
      ? effectivePermissions(role, invite.perms)
      : { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false };
    transaction.update(inviteRef, { usedBy: uid });
    transaction.set(memberRef, {
      role,
      status: "active",
      perms,
      displayName: displayName.trim() || "Care team member",
      joinedAt: serverTimestamp(),
      invitedBy: invite.createdBy ?? "",
      inviteId: cleanInviteCode(target.code),
    });
    transaction.set(doc(db, "users", uid, "spaces", spaceId), {
      spaceId,
      name: "Family care space",
      memberRole: role,
      joinedAt: serverTimestamp(),
    }, { merge: true });
    return { role, spaceId };
  });
  const spaceSnapshot = await getDoc(doc(db, "careSpaces", result.spaceId));
  const spaceName = typeof spaceSnapshot.data()?.name === "string" ? spaceSnapshot.data()?.name as string : "Family care space";
  await recordSpaceJoin(uid, result.spaceId, spaceName, result.role);
  return { role: result.role, spaceName };
}
