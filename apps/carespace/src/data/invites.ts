import { collection, doc, getDoc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
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
export type InviteAccess = { role: SpaceRole; perms?: MemberPermissions; createdBy?: string; expiresAt?: TimeValue; usedBy?: string };
export type JoinTarget = { spaceId: string; code: string };

export function cleanInviteCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isInviteCode(value: string): boolean {
  const code = cleanInviteCode(value);
  return code.length === INVITE_CODE_LENGTH && [...code].every((character) => INVITE_CODE_ALPHABET.includes(character));
}

/** Reuses the existing Caresitters invite alphabet: no visually ambiguous I, L, O, 0, or 1. */
export function makeInviteCode(random: () => number = Math.random): string {
  let code = "";
  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    const pick = Math.min(INVITE_CODE_ALPHABET.length - 1, Math.floor(random() * INVITE_CODE_ALPHABET.length));
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
  const safeDays = Math.max(1, Math.min(30, Math.floor(expiresInDays)));
  const expiresAt = new Date(Date.now() + safeDays * DAY_MS);
  const inviteData = {
    role,
    perms: effectivePermissions(role, perms),
    createdBy,
    expiresAt: Timestamp.fromDate(expiresAt),
  };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeInviteCode();
    const inviteRef = doc(db, "careSpaces", spaceId, "invites", code);
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
  const spaceRef = doc(db, "careSpaces", target.spaceId);
  const inviteRef = doc(db, "careSpaces", target.spaceId, "invites", cleanInviteCode(target.code));
  const memberRef = doc(db, "careSpaces", target.spaceId, "members", uid);
  const result = await runTransaction(db, async (transaction) => {
    const [inviteSnapshot, spaceSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(inviteRef), transaction.get(spaceRef), transaction.get(memberRef),
    ]);
    if (!inviteSnapshot.exists() || !spaceSnapshot.exists()) throw new Error("invite-not-found");
    const invite = inviteSnapshot.data() as InviteAccess;
    if (!canAcceptInvite(invite)) throw new Error(invite.usedBy ? "invite-used" : "invite-expired");
    if (invite.createdBy === uid) throw new Error("invite-own-space");
    if (memberSnapshot.exists() && isMemberActive(memberSnapshot.data().status)) throw new Error("already-a-member");
    const role: SpaceRole = invite.role === "admin" || invite.role === "regular" || invite.role === "limited" || invite.role === "viewer" ? invite.role : "viewer";
    const perms = effectivePermissions(role, invite.perms);
    const spaceName = typeof spaceSnapshot.data().name === "string" ? spaceSnapshot.data().name : "Family care space";
    transaction.set(memberRef, {
      role,
      status: "active",
      perms,
      displayName: displayName.trim() || "Care team member",
      joinedAt: serverTimestamp(),
      invitedBy: invite.createdBy ?? "",
    });
    transaction.update(inviteRef, { usedBy: uid });
    return { role, spaceName };
  });
  await recordSpaceJoin(uid, target.spaceId, result.spaceName, result.role);
  return result;
}
