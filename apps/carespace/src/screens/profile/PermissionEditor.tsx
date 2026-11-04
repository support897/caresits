import { t } from "@cc/core";
import { effectivePermissions, PERMISSION_FIELDS, type MemberPermissions, type SpaceRole } from "@cc/core/src/permissions";

type ExtraMemberPermissions = { canInvite: boolean; canEditAllergies: boolean };

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
  extraValues,
  onChange,
  onExtraChange,
}: {
  role: SpaceRole;
  value?: MemberPermissions;
  disabled?: boolean;
  extraValues?: ExtraMemberPermissions;
  onChange?: (next: MemberPermissions) => void;
  onExtraChange?: (next: ExtraMemberPermissions) => void;
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
    {extraValues && role !== "admin" && <>
      <label className="profile-permission">
        <span>{t("csPrivacy.permission.canInvite", "Invite other people")}</span>
        <input type="checkbox" checked={extraValues.canInvite} disabled={locked} aria-label={t("csPrivacy.permission.allowInvite", "Allow this person to invite others")} onChange={(event) => onExtraChange?.({ ...extraValues, canInvite: event.currentTarget.checked })} />
      </label>
      <label className="profile-permission">
        <span>{t("csPrivacy.permission.canEditAllergies", "Edit allergy information")}</span>
        <input type="checkbox" checked={extraValues.canEditAllergies} disabled={locked} aria-label={t("csPrivacy.permission.allowAllergyEdit", "Allow this person to edit allergy information")} onChange={(event) => onExtraChange?.({ ...extraValues, canEditAllergies: event.currentTarget.checked })} />
      </label>
      <p className="muted profile-permission-note">{t("csPrivacy.permission.viewerDefaults", "A grandparent or family viewer starts with photos and calendar access. Allergies, medication, private messages, inviting people, and allergy edits start off.")}</p>
      <p className="muted profile-permission-note">{t("csPrivacy.permission.allergyLimit", "Turning on allergy edits does not let a carer save medical changes. Only a parent admin can change medical records.")}</p>
    </>}
    {role === "admin" && <p className="muted profile-permission-note">{t("csProfile.permission.parent", "Parents keep full access to manage the family space.")}</p>}
    {role === "viewer" && <p className="muted profile-permission-note">{t("csProfile.permission.viewer", "Family viewers never see private messages.")}</p>}
  </fieldset>;
}
