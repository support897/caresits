import "../lib/i18n";
import { useCallback, useEffect, useState } from "react";
import { Avatar, BackBar, Bunny, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { defaultPermissionsForRole, type SpaceRole } from "@cc/core/src/permissions";
import { getSpaceAccess, type SpaceAccess } from "../data/spaces";
import { leaveCareSpace, loadTeamMembers, removeTeamMember, updateMemberPermissions, updateMemberRole, type TeamMember } from "../data/team";
import { PermissionEditor } from "./profile/PermissionEditor";
import "./profile/profile.css";

type TeamParams = { spaceId: string };
const ROLE_LABEL: Record<SpaceRole, [string, string]> = {
  admin: ["csTeam.role.admin", "Admin (parent)"],
  regular: ["csTeam.role.regular", "Regular carer"],
  limited: ["csTeam.role.limited", "Limited carer"],
  viewer: ["csTeam.role.viewer", "Family viewer"],
};
const ROLES: SpaceRole[] = ["admin", "regular", "limited", "viewer"];

export default function Team({ params }: ScreenProps<TeamParams>) {
  const nav = useNav();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const [access, setAccess] = useState<SpaceAccess | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const admin = access?.member.role === "admin" && access.member.status === "active";

  const refresh = useCallback(async () => {
    if (!uid || !params.spaceId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [current, list] = await Promise.all([getSpaceAccess(uid, params.spaceId), loadTeamMembers(params.spaceId)]);
      setAccess(current);
      setMembers(list);
      setError(current ? "" : t("csTeam.unavailable", "This care space is not available to your account."));
    } catch {
      setError(t("csTeam.loadError", "The care team could not load. Check your connection and try again."));
    } finally { setLoading(false); }
  }, [params.spaceId, uid]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function changeRole(member: TeamMember, role: SpaceRole) {
    if (!admin || !uid || member.uid === uid || member.status !== "active") return;
    setBusyUid(member.uid); setNotice(""); setError("");
    try {
      await updateMemberRole(params.spaceId, uid, member.uid, role);
      setMembers((rows) => rows.map((row) => row.uid === member.uid ? { ...row, role, perms: defaultPermissionsForRole(role) } : row));
      setNotice(t("csTeam.roleSaved", "Role updated."));
    } catch {
      setError(t("csTeam.roleError", "Role could not change. Keep at least one parent admin in this space."));
      await refresh();
    } finally { setBusyUid(""); }
  }

  async function changePermissions(member: TeamMember, perms: TeamMember["perms"]) {
    if (!admin || !uid || member.uid === uid || member.status !== "active" || member.role === "admin") return;
    setMembers((rows) => rows.map((row) => row.uid === member.uid ? { ...row, perms } : row));
    setBusyUid(member.uid); setNotice(""); setError("");
    try {
      await updateMemberPermissions(params.spaceId, uid, member.uid, perms);
      setNotice(t("csTeam.permissionsSaved", "Permissions updated."));
    } catch {
      setError(t("csTeam.permissionsError", "Permissions could not be saved. Try again."));
      await refresh();
    } finally { setBusyUid(""); }
  }

  async function remove(member: TeamMember) {
    if (!admin || !uid || member.uid === uid || member.status !== "active") return;
    const confirmed = window.confirm(t("csTeam.removeConfirm", "Remove {name} from this care space? Their access will end. Your family keeps its records.", { name: member.displayName }));
    if (!confirmed) return;
    setBusyUid(member.uid); setNotice(""); setError("");
    try {
      await removeTeamMember(params.spaceId, uid, member.uid);
      setMembers((rows) => rows.map((row) => row.uid === member.uid ? { ...row, status: "removed" } : row));
      setNotice(t("csTeam.removed", "Access removed. Family records stay here."));
    } catch {
      setError(t("csTeam.removeError", "Access could not be removed. Keep at least one parent admin."));
      await refresh();
    } finally { setBusyUid(""); }
  }

  async function leave() {
    if (!uid || admin) return;
    const confirmed = window.confirm(t("csTeam.leaveConfirm", "Leave this care space? You will lose access. The family keeps its records."));
    if (!confirmed) return;
    setBusyUid(uid); setNotice(""); setError("");
    try {
      await leaveCareSpace(params.spaceId, uid);
      nav.back();
    } catch {
      setError(t("csTeam.leaveError", "You could not leave this care space. Check your access and try again."));
    } finally { setBusyUid(""); }
  }

  const activeCount = members.filter((member) => member.status === "active").length;
  return <div className="app">
    <BackBar title={t("csTeam.title", "Care Team")} onBack={nav.back}
      right={admin ? <button type="button" className="profile-action" onClick={() => nav.push("invite", { spaceId: params.spaceId })}>{t("csTeam.invite", "Invite")}</button> : undefined} />
    <div className="scroll"><div className="profile-screen">
      <header className="profile-hero"><div className="profile-hero-copy"><p className="profile-eyebrow">{t("csTeam.private", "Private family space")}</p><h1>{access?.space.name ?? t("csTeam.title", "Care Team")}</h1><p>{t("csTeam.memberCount", "{count} team members", { count: activeCount })}</p></div><Bunny mood="point" size={74} /></header>
      {error && <p className="profile-notice" role="alert">{error}</p>}
      {notice && <p className="profile-notice" role="status">{notice}</p>}
      {loading ? <div className="sk" style={{ height: 150 }} /> : !access ? <div className="profile-card"><Bunny mood="oops" size={72} /><p>{t("csTeam.unavailable", "This care space is not available to your account.")}</p></div> : <>
        <section className="profile-card" aria-label={t("csTeam.membersLabel", "Care team members")}>
          <div className="profile-card-head"><h2>{t("csTeam.members", "People in this space")}</h2><span className="tag">{t("csTeam.privateTag", "Private")}</span></div>
          <div className="profile-items">
            {members.map((member) => {
              const [roleKey, roleEnglish] = ROLE_LABEL[member.role];
              const ownAccount = member.uid === uid;
              return <article className="profile-card profile-member" key={member.uid} style={{ boxShadow: "none", padding: 12 }}>
                <div className="profile-inline" style={{ minWidth: 0 }}><Avatar name={member.displayName} url={member.photoUrl} size={46} /><div className="profile-row-copy"><strong>{member.displayName}{ownAccount ? ` · ${t("csTeam.you", "You")}` : ""}</strong><span>{t(roleKey, roleEnglish)}</span></div></div>
                <span className={`tag${member.status === "active" ? " good" : ""}`}>{member.status === "active" ? t("csTeam.active", "Active") : t("csTeam.removed", "Access ended")}</span>
                {admin && !ownAccount && member.status === "active" && <>
                  <label className="profile-field"><span>{t("csTeam.changeRole", "Role")}</span><select value={member.role} disabled={busyUid === member.uid} onChange={(event) => void changeRole(member, event.currentTarget.value as SpaceRole)} aria-label={t("csTeam.roleFor", "Role for {name}", { name: member.displayName })}>
                    {ROLES.map((role) => <option value={role} key={role}>{t(ROLE_LABEL[role][0], ROLE_LABEL[role][1])}</option>)}
                  </select></label>
                  <details><summary className="profile-action">{t("csTeam.editPermissions", "Edit permissions")}</summary>
                    <PermissionEditor role={member.role} value={member.perms} disabled={busyUid === member.uid} onChange={(next) => void changePermissions(member, next as TeamMember["perms"])} />
                  </details>
                  <button type="button" className="profile-action profile-danger" disabled={busyUid === member.uid} onClick={() => void remove(member)}>{t("csTeam.removeAccess", "Remove access")}</button>
                </>}
                {(!admin || ownAccount || member.status !== "active") && member.status === "active" && <details><summary className="profile-action">{t("csTeam.permissions", "Permissions")}</summary><PermissionEditor role={member.role} value={member.perms} disabled /></details>}
              </article>;
            })}
            {!members.length && <div className="empty"><Bunny mood="hello" size={82} /><p>{t("csTeam.empty", "Invite a nanny, grandparent or another trusted helper.")}</p></div>}
          </div>
        </section>
        <section className="profile-card">
          <h2>{t("csTeam.accessTitle", "Access can change")}</h2>
          <p className="muted">{t("csTeam.accessBody", "Parents choose who sees allergies, medication, photos, calendar and private messages. Removing a member ends their access; the family keeps its records.")}</p>
          {!admin && <button type="button" className="profile-action profile-danger" style={{ width: "100%", marginTop: 8 }} disabled={busyUid === uid} onClick={() => void leave()}>{t("csTeam.leave", "Leave this Care Space")}</button>}
        </section>
      </>}
    </div></div>
  </div>;
}
