import { t } from "@cc/core";
import { effectivePermissions, PERMISSION_FIELDS, type MemberPermissions, type SpaceRole } from "@cc/core/src/permissions";

const LABELS: Record<(typeof PERMISSION_FIELDS)[number], [string, string]> = {
  allergies: ["csProfile.permission.allergies", "Allergies"],
  medication: ["csProfile.permission.medication", "Medication"],
  photos: ["csProfile.permission.photos", "Child photos"],
  calendar: ["csProfile.permission.calendar", "Calendar"],
  privateMessages: ["csProfile.permission.messages", "Private messages"],
};

export function PermissionEditor({
  role,
  value,
  disabled = false,
  onChange,
}: {
  role: SpaceRole;
  value?: MemberPermissions;
  disabled?: boolean;
  onChange?: (next: MemberPermissions) => void;
}) {
  const permissions = effectivePermissions(role, value);
  if (role === "viewer") permissions.privateMessages = false;
  const locked = disabled || role === "admin";
  return <fieldset className="profile-permissions" disabled={locked}>
    <legend className="profile-permissions-title">{t("csProfile.permission.title", "This person can see")}</legend>
    {PERMISSION_FIELDS.map((field) => {
      const [key, english] = LABELS[field];
      const viewerPrivate = role === "viewer" && field === "privateMessages";
      return <label className="profile-permission" key={field}>
        <span>{t(key, english)}</span>
        <input
          type="checkbox"
          checked={permissions[field]}
          disabled={locked || viewerPrivate}
          aria-label={t("csProfile.permission.allow", "Allow {item}", { item: t(key, english) })}
          onChange={(event) => onChange?.({ ...permissions, [field]: event.currentTarget.checked })}
        />
      </label>;
    })}
    {role === "admin" && <p className="muted profile-permission-note">{t("csProfile.permission.parent", "Parents keep full access to manage the family space.")}</p>}
    {role === "viewer" && <p className="muted profile-permission-note">{t("csProfile.permission.viewer", "Family viewers never see private messages.")}</p>}
  </fieldset>;
}
