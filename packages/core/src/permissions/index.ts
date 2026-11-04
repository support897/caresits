export type SpaceRole = "admin" | "regular" | "limited" | "viewer";
export type MemberStatus = "active" | "removed";
export type MemberPermissions = Partial<{
  allergies: boolean;
  medication: boolean;
  photos: boolean;
  calendar: boolean;
  privateMessages: boolean;
}>;
export type PermissionAction =
  | "readAllergies"
  | "readMedication"
  | "editMedical"
  | "viewPhotos"
  | "viewCalendar"
  | "editCalendar"
  | "readPrivateMessages"
  | "postMessage"
  | "editShopping"
  | "manageTeam";

export const PERMISSION_FIELDS = ["allergies", "medication", "photos", "calendar", "privateMessages"] as const;
export type PermissionField = (typeof PERMISSION_FIELDS)[number];

const ROLE_DEFAULTS: Record<SpaceRole, Readonly<Record<PermissionField, boolean>>> = {
  admin: { allergies: true, medication: true, photos: true, calendar: true, privateMessages: true },
  regular: { allergies: true, medication: true, photos: true, calendar: true, privateMessages: true },
  limited: { allergies: true, medication: false, photos: false, calendar: true, privateMessages: false },
  viewer: { allergies: false, medication: false, photos: false, calendar: true, privateMessages: false },
};

/** Return a fresh role default so editors cannot mutate the shared policy table. */
export function defaultPermissionsForRole(role: SpaceRole): Record<PermissionField, boolean> {
  return { ...ROLE_DEFAULTS[role] };
}

/** Resolve role defaults with member-specific choices. Admin access stays complete. */
export function effectivePermissions(role: SpaceRole, perms?: MemberPermissions | null): Record<PermissionField, boolean> {
  if (role === "admin") return defaultPermissionsForRole("admin");
  return { ...ROLE_DEFAULTS[role], ...perms };
}

export function can(
  role: SpaceRole | null | undefined,
  perms: MemberPermissions | null | undefined,
  action: PermissionAction,
): boolean {
  if (!role || !(role in ROLE_DEFAULTS)) return false;
  if (role === "admin") return true;
  const access = effectivePermissions(role, perms);
  switch (action) {
    case "readAllergies": return access.allergies;
    case "readMedication": return access.medication;
    case "editMedical": return false;
    case "viewPhotos": return access.photos;
    case "viewCalendar": return access.calendar;
    case "editCalendar": return role === "regular" && access.calendar;
    case "readPrivateMessages": return role !== "viewer" && access.privateMessages;
    case "postMessage": return role !== "viewer";
    case "editShopping": return role === "regular";
    case "manageTeam": return false;
  }
}

/** A removed member has no access, including when an offline index still lists them. */
export function isMemberActive(status: unknown): status is "active" {
  return status === "active";
}
