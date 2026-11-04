import "../lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { BackBar, Bunny, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { updateMemberPermissions, type TeamMember } from "../data/team";
import { listUserSpaces, type SpaceSummary } from "../data/spaces";
import { PermissionEditor } from "./profile/PermissionEditor";
import { requestMyDataExport } from "./profile/dataExport";
import "./profile/profile.css";

type PrivacyParams = { uid?: string; spaceId?: string };

export default function PrivacyPerms({ params }: ScreenProps<PrivacyParams>) {
  const nav = useNav();
  const { user } = useAuth();
  const uid = params.uid || user?.uid || "";
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [spaceId, setSpaceId] = useState(params.spaceId ?? "");
  const [memberUid, setMemberUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedSpace = spaces.find((space) => space.id === spaceId) ?? null;
  const selectedMember = members.find((member) => member.uid === memberUid) ?? null;
  const canEdit = selectedSpace?.role === "admin" && selectedMember?.status === "active" && selectedMember.uid !== uid;

  useEffect(() => {
    let alive = true;
    if (!uid) { setLoading(false); return; }
    void listUserSpaces(uid).then((next) => {
      if (!alive) return;
      setSpaces(next);
      setSpaceId((current) => next.some((space) => space.id === current) ? current : next.find((space) => space.role === "admin")?.id ?? next[0]?.id ?? "");
    }).catch(() => { if (alive) setError(t("csPrivacy.loadSpacesError", "Care spaces could not load.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uid]);

  useEffect(() => {
    let alive = true;
    const currentSpace = spaces.find((space) => space.id === spaceId);
    if (!currentSpace) { setMembers([]); setMemberUid(""); return; }
    void import("../data/team").then(({ loadTeamMembers }) => loadTeamMembers(spaceId)).then((next) => {
      if (!alive) return;
      setMembers(next);
      const first = next.find((member) => member.status === "active" && member.uid !== uid) ?? next.find((member) => member.status === "active");
      setMemberUid((current) => next.some((member) => member.uid === current && member.status === "active") ? current : first?.uid ?? "");
    }).catch(() => { if (alive) setError(t("csPrivacy.loadMembersError", "Team permissions could not load.")); });
    return () => { alive = false; };
  }, [spaceId, spaces, uid]);

  const selectableMembers = useMemo(() => members.filter((member) => member.status === "active"), [members]);

  async function savePermissions(next: TeamMember["perms"]) {
    if (!uid || !selectedSpace || !selectedMember || !canEdit || saving) return;
    setMembers((rows) => rows.map((member) => member.uid === selectedMember.uid ? { ...member, perms: next } : member));
    setSaving(true); setError(""); setNotice("");
    try {
      await updateMemberPermissions(selectedSpace.id, uid, selectedMember.uid, next);
      setNotice(t("csPrivacy.saved", "Permissions saved."));
    } catch {
      setError(t("csPrivacy.saveError", "Permissions could not save. Check that you are a parent admin."));
    } finally { setSaving(false); }
  }

  async function requestExport() {
    if (!uid || exporting) return;
    setExporting(true); setError(""); setNotice("");
    try {
      await requestMyDataExport();
      setNotice(t("csPrivacy.exportSent", "Your data export request was sent."));
    } catch {
      setError(t("csPrivacy.exportError", "The export service is not ready. Your data was not changed; try again later."));
    } finally { setExporting(false); }
  }

  return <div className="app">
    <BackBar title={t("csPrivacy.title", "Privacy and permissions")} onBack={nav.back} />
    <div className="scroll"><div className="profile-screen">
      <header className="profile-hero"><div className="profile-hero-copy"><p className="profile-eyebrow">{t("csPrivacy.kicker", "Your family’s information")}</p><h1>{t("csPrivacy.heading", "Privacy comes first")}</h1><p>{t("csPrivacy.subtitle", "You choose what each trusted person can see.")}</p></div><Bunny mood="think" size={74} /></header>
      <section className="profile-card" aria-label={t("csPrivacy.privateTitle", "Children’s data is private by default and shared only by a parent")}>
        <h2>{t("csPrivacy.privateTitle", "Children’s data is private by default and shared only by a parent")}</h2>
        <p className="muted">{t("csPrivacy.privateBody", "Each care space stays separate. A parent can share allergies, medication, photos, calendar details and private messages with each member. Access can be changed or removed at any time.")}</p>
      </section>
      {error && <p className="profile-notice" role="alert">{error}</p>}
      {notice && <p className="profile-notice" role="status">{notice}</p>}
      {loading ? <div className="sk" style={{ height: 130 }} /> : <section className="profile-card">
        <div className="profile-card-head"><h2>{t("csPrivacy.editorTitle", "Member permissions")}</h2><span className="tag">{t("csPrivacy.parentOnly", "Parent managed")}</span></div>
        {spaces.length > 0 ? <>
          <label className="profile-field"><span>{t("csPrivacy.spaceLabel", "Care space")}</span><select value={spaceId} onChange={(event) => { setSpaceId(event.target.value); setNotice(""); }}>
            {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
          </select></label>
          {selectableMembers.length > 0 && <label className="profile-field" style={{ marginTop: 12 }}><span>{t("csPrivacy.memberLabel", "Team member")}</span><select value={memberUid} onChange={(event) => setMemberUid(event.target.value)}>
            {selectableMembers.map((member) => <option key={member.uid} value={member.uid}>{member.displayName}{member.uid === uid ? ` · ${t("csPrivacy.you", "You")}` : ""}</option>)}
          </select></label>}
          {selectedMember ? <>
            <PermissionEditor role={selectedMember.role} value={selectedMember.perms} disabled={!canEdit || saving} onChange={(next) => void savePermissions(next as TeamMember["perms"])} />
            {!canEdit && <p className="muted">{t("csPrivacy.adminOnly", "Only a parent admin can edit another member’s access.")}</p>}
            {selectedMember.role === "admin" && <p className="muted">{t("csPrivacy.adminFull", "Parent admins keep full access to manage the family space.")}</p>}
          </> : <div className="empty"><Bunny mood="rest" size={72} /><p>{t("csPrivacy.noMembers", "No active team members to edit yet.")}</p></div>}
          {selectedSpace?.role === "admin" && <button type="button" className="profile-action" style={{ width: "100%", marginTop: 12 }} onClick={() => nav.push("team", { spaceId })}>{t("csPrivacy.openTeam", "Open Care Team")}</button>}
        </> : <div className="empty"><Bunny mood="rest" size={72} /><p>{t("csPrivacy.noSpaces", "Care spaces you join will appear here.")}</p></div>}
      </section>}
      <section className="profile-card">
        <h2>{t("csPrivacy.exportTitle", "Your data")}</h2>
        <p className="muted">{t("csPrivacy.exportBody", "Ask for a copy of your account and care-space data. The secure export service prepares it for you.")}</p>
        <button type="button" className="btn alt" disabled={!uid || exporting} onClick={() => void requestExport()}>{exporting ? t("csPrivacy.exporting", "Sending request…") : t("csPrivacy.export", "Request data export")}</button>
      </section>
    </div></div>
  </div>;
}
