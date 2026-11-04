import "../lib/i18n";
import { useEffect, useState } from "react";
import { BackBar, Bunny, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { defaultPermissionsForRole, type SpaceRole } from "@cc/core/src/permissions";
import { getSpaceAccess } from "../data/spaces";
import { createSpaceInvite } from "../data/invites";
import { PermissionEditor } from "./profile/PermissionEditor";
import "./profile/profile.css";

type InviteParams = { spaceId: string };
type InviteResult = { code: string; expiresAt: Date; link: string };
const INVITABLE_ROLES: SpaceRole[] = ["regular", "limited", "viewer"];
const ROLE_LABELS: Record<SpaceRole, [string, string]> = {
  admin: ["csInvite.role.admin", "Admin (parent)"],
  regular: ["csInvite.role.regular", "Regular carer"],
  limited: ["csInvite.role.limited", "Limited carer"],
  viewer: ["csInvite.role.viewer", "Family viewer"],
};

export default function Invite({ params }: ScreenProps<InviteParams>) {
  const nav = useNav();
  const { user } = useAuth();
  const [spaceName, setSpaceName] = useState("");
  const [role, setRole] = useState<SpaceRole>("regular");
  const [perms, setPerms] = useState(defaultPermissionsForRole("regular"));
  const [result, setResult] = useState<InviteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let live = true;
    if (!user?.uid || !params.spaceId) return;
    void getSpaceAccess(user.uid, params.spaceId).then((access) => {
      if (!live) return;
      setAllowed(access?.member.role === "admin" && access.member.status === "active");
      setSpaceName(access?.space.name ?? "");
      if (!access || access.member.role !== "admin") setError(t("csInvite.adminOnly", "Only a parent admin can create invites."));
    }).catch(() => { if (live) setError(t("csInvite.loadError", "This care space could not load.")); });
    return () => { live = false; };
  }, [params.spaceId, user?.uid]);

  function changeRole(nextRole: SpaceRole) {
    setRole(nextRole);
    setPerms(defaultPermissionsForRole(nextRole));
    setResult(null); setNotice(""); setError("");
  }

  async function makeInvite() {
    if (!user?.uid || !allowed || busy) return;
    setBusy(true); setError(""); setNotice(""); setResult(null);
    try {
      const invite = await createSpaceInvite(params.spaceId, user.uid, role, perms);
      const link = `https://caresits.xyz/join?spaceId=${encodeURIComponent(params.spaceId)}&code=${encodeURIComponent(invite.code)}`;
      setResult({ ...invite, link });
    } catch {
      setError(t("csInvite.createError", "Invite could not be created. Check your connection and parent access."));
    } finally { setBusy(false); }
  }

  async function copy(value: string, successText: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(successText); setError("");
    } catch {
      setError(t("csInvite.copyError", "Copy did not work. Select and copy the invite text instead."));
    }
  }

  async function shareInvite() {
    if (!result) return;
    if (navigator.share) {
      try { await navigator.share({ title: t("csInvite.shareTitle", "Care team invite"), text: t("csInvite.shareText", "Join {space} with this private invite.", { space: spaceName }), url: result.link }); }
      catch { /* The person may close the share sheet. */ }
    } else await copy(result.link, t("csInvite.linkCopied", "Invite link copied."));
  }

  return <div className="app">
    <BackBar title={t("csInvite.title", "Invite someone")} onBack={nav.back} />
    <div className="scroll"><div className="profile-screen">
      <header className="profile-hero"><div className="profile-hero-copy"><p className="profile-eyebrow">{t("csInvite.kicker", "Your trusted people")}</p><h1>{t("csInvite.heading", "Invite your own helper")}</h1><p>{spaceName}</p></div><Bunny mood="hello" size={76} /></header>
      <section className="profile-card">
        <p>{t("csInvite.intro", "Share a private link or code with your nanny, grandparent or au pair. They do not need a marketplace profile.")}</p>
        <label className="profile-field"><span>{t("csInvite.roleLabel", "Choose their role")}</span><select value={role} disabled={!allowed} onChange={(event) => changeRole(event.currentTarget.value as SpaceRole)}>
          {INVITABLE_ROLES.map((item) => <option key={item} value={item}>{t(ROLE_LABELS[item][0], ROLE_LABELS[item][1])}</option>)}
        </select></label>
        <PermissionEditor role={role} value={perms} disabled={!allowed} onChange={(next) => { setPerms(next as typeof perms); setResult(null); }} />
        <p className="muted">{t("csInvite.expiry", "Invites expire after 7 days and can be used once.")}</p>
        <button type="button" className="btn" disabled={!allowed || busy} onClick={() => void makeInvite()}>{busy ? t("csInvite.creating", "Making invite…") : t("csInvite.create", "Create invite link and code")}</button>
      </section>
      {error && <p className="profile-notice" role="alert">{error}</p>}
      {notice && <p className="profile-notice" role="status">{notice}</p>}
      {result && <section className="profile-card" aria-label={t("csInvite.ready", "Invite ready")}>
        <div className="profile-card-head"><h2>{t("csInvite.ready", "Invite ready")}</h2><span className="tag good">{t("csInvite.private", "Private")}</span></div>
        <p>{t("csInvite.codeLabel", "Full join code")}</p>
        <p className="profile-code" dir="ltr">{params.spaceId}.{result.code}</p>
        <button type="button" className="profile-action" style={{ width: "100%" }} onClick={() => void copy(`${params.spaceId}.${result.code}`, t("csInvite.codeCopied", "Join code copied."))}>{t("csInvite.copyCode", "Copy join code")}</button>
        <label className="profile-field" style={{ marginTop: 12 }}><span>{t("csInvite.linkLabel", "Invite link")}</span><input value={result.link} readOnly aria-label={t("csInvite.linkLabel", "Invite link")} /></label>
        <div className="profile-inline" style={{ marginTop: 10 }}>
          <button type="button" className="btn" onClick={() => void shareInvite()}>{t("csInvite.share", "Share invite")}</button>
          <button type="button" className="btn alt" onClick={() => void copy(result.link, t("csInvite.linkCopied", "Invite link copied."))}>{t("csInvite.copyLink", "Copy link")}</button>
        </div>
        <p className="muted">{t("csInvite.expiresAt", "Use by {date}", { date: result.expiresAt.toLocaleDateString() })}</p>
      </section>}
    </div></div>
  </div>;
}
