import { can } from "@cc/core/src/permissions";
import type { MemberPermissions, SpaceRole } from "@cc/core/src/permissions";

export type { MemberPermissions, SpaceRole } from "@cc/core/src/permissions";
export { can, defaultPermissionsForRole, effectivePermissions, isMemberActive, PERMISSION_FIELDS } from "@cc/core/src/permissions";

export function canPost(role: SpaceRole | null | undefined): boolean {
  return can(role, undefined, "postMessage");
}

export function canEditShopping(role: SpaceRole | null | undefined): boolean {
  return can(role, undefined, "editShopping");
}

export function canManageTimeOff(role: SpaceRole | null | undefined): boolean {
  return role === "admin";
}

export function canSeePhotos(role: SpaceRole | null | undefined, perms?: MemberPermissions): boolean {
  return can(role, perms, "viewPhotos");
}
