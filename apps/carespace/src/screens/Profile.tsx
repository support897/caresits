import "../lib/i18n";
import { useEffect, useState } from "react";
import { APP1, Avatar, Bunny, LANGS, t, useLang, useNav, signOutUser, isBunnyCalm, setBunnyCalm, setLang, type ScreenProps } from "@cc/core";
import { listUserSpaces, type SpaceSummary } from "../data/spaces";
import { SafetyTools } from "./profile/SafetyTools";
import "./profile/profile.css";

type ProfileParams = { uid: string; name: string; email: string };
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "2.0.0";
const languageName = (id: string, english: string) => id === "ar" ? t("csProfile.language.arabic", "Arabic · right to left") : english;

export default function Profile({ params }: ScreenProps<ProfileParams>) {
  const nav = useNav();
  const lang = useLang();
  const uid = params.uid ?? "";
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bunnyCalm, setCalm] = useState(isBunnyCalm());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    if (!uid) { setLoading(false); return; }
    void listUserSpaces(uid).then((next) => { if (live) setSpaces(next); })
      .catch(() => { if (live) setError(t("csProfile.spacesError", "Your Care Team list could not load.")); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [uid]);

  async function signOut() {
    setBusy(true); setError(""); setNotice("");
    try { await signOutUser(); }
    catch { setError(t("csProfile.signOutError", "You could not sign out. Try again.")); }
    finally { setBusy(false); }
  }

  function changeCalm(value: boolean) {
    setCalm(value);
    setBunnyCalm(value);
    setNotice(value ? t("csProfile.bunnyCalmOn", "The bunny will stay still.") : t("csProfile.bunnyCalmOff", "The bunny’s gentle motion is on."));
  }

  const fallbackUrl = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? "https://apps.apple.com/au/search?term=Caresitters"
    : "https://play.google.com/store/search?q=Caresitters&c=apps";

  return <div className="scroll"><div className="profile-screen">
    <header className="profile-head"><div><p className="profile-eyebrow">{t("csProfile.kicker", "Your account")}</p><h1>{t("csProfile.title", "Profile")}</h1></div><Avatar name={params.name || params.email || t("csProfile.you", "You")} size={50} /></header>
    {error && <p className="profile-notice" role="alert">{error}</p>}
    {notice && <p className="profile-notice" role="status">{notice}</p>}
    <section className="profile-hero profile-account">
      <div className="profile-hero-copy"><p className="profile-eyebrow">{t("csProfile.account", "Account")}</p><h2>{params.name || t("csProfile.you", "You")}</h2><p>{params.email || t("csProfile.noEmail", "Email not added")}</p></div>
      <button type="button" className="profile-action profile-danger" disabled={busy} onClick={() => void signOut()}>{busy ? t("csProfile.signingOut", "Signing out…") : t("csProfile.signOut", "Sign out")}</button>
    </section>
    <section className="profile-card">
      <div className="profile-card-head"><h2>{t("csProfile.languageTitle", "Language")}</h2><span className="tag">{LANGS.length} {t("csProfile.languages", "languages")}</span></div>
      <label className="profile-language"><span>{t("csProfile.languageLabel", "App language")}</span><select aria-label={t("csProfile.languageLabel", "App language")} value={lang} onChange={(event) => setLang(event.target.value as (typeof LANGS)[number][0])}>
        {LANGS.map(([id, label]) => <option key={id} value={id}>{languageName(id, label)}</option>)}
      </select></label>
      {lang === "ar" && <p className="muted">{t("csProfile.rtl", "Arabic uses a right-to-left layout.")}</p>}
    </section>
    <section className="profile-card">
      <div className="profile-card-head"><h2>{t("csProfile.settingsTitle", "Your choices")}</h2></div>
      <div className="profile-items">
        <button type="button" className="profile-row" onClick={() => nav.push("notifications", { uid })}>
          <span className="profile-row-copy"><strong>{t("csProfile.notifications", "Notification choices")}</strong><span>{t("csProfile.notificationsHint", "Messages, care updates and safety alerts")}</span></span><span aria-hidden="true" className="flip">›</span>
        </button>
        <button type="button" className="profile-row" onClick={() => nav.push("privacy", { uid })}>
          <span className="profile-row-copy"><strong>{t("csProfile.permissions", "Permissions")}</strong><span>{t("csProfile.permissionsHint", "Choose what each team member can see")}</span></span><span aria-hidden="true" className="flip">›</span>
        </button>
        <button type="button" className="profile-row" onClick={() => nav.push("privacy", { uid })}>
          <span className="profile-row-copy"><strong>{t("csProfile.privacy", "Privacy")}</strong><span>{t("csProfile.privacyHint", "Private child records and data export")}</span></span><span aria-hidden="true" className="flip">›</span>
        </button>
      </div>
    </section>
    <section className="profile-card">
      <div className="profile-card-head"><h2>{t("csProfile.teamTitle", "Care Team")}</h2></div>
      <p className="muted">{t("csProfile.teamHint", "Every family’s records stay in its own private space.")}</p>
      {loading ? <div className="sk" style={{ height: 66 }} /> : spaces.length ? <div className="profile-items">
        {spaces.map((space) => <button type="button" className="profile-row" key={space.id} onClick={() => nav.push("team", { spaceId: space.id })}>
          <span className="profile-row-copy"><strong>{space.name}</strong><span>{space.role === "admin" ? t("csProfile.role.parent", "Parent admin") : t("csProfile.role.carer", "Care team member")}</span></span><span aria-hidden="true" className="flip">›</span>
        </button>)}
      </div> : <div className="empty"><Bunny mood="point" size={78} /><h3>{t("csProfile.noSpaces", "Your care circle starts here")}</h3><p className="muted">{t("csProfile.noSpacesHint", "Create a space in Chats or ask a parent to invite you.")}</p><button type="button" className="profile-action" onClick={() => nav.push("privacy", { uid })}>{t("csProfile.privacy", "Privacy")}</button></div>}
      {spaces.length > 0 && <button type="button" className="profile-action" style={{ width: "100%", marginTop: 10 }} onClick={() => nav.push("privacy", { uid, spaceId: spaces.find((space) => space.role === "admin")?.id ?? spaces[0]?.id })}>{t("csProfile.managePermissions", "Manage permissions")}</button>}
    </section>
    <SafetyTools uid={uid} spaces={spaces} />
    <section className="profile-card">
      <div className="profile-card-head"><h2>{t("csProfile.bunnyTitle", "The bunny")}</h2><Bunny mood="encourage" size={52} /></div>
      <label className="profile-permission"><span>{t("csProfile.bunnyCalm", "Turn the bunny down")}</span><input type="checkbox" checked={bunnyCalm} onChange={(event) => changeCalm(event.currentTarget.checked)} /></label>
      <p className="muted">{t("csProfile.bunnyHint", "Reduce movement any time. Your phone’s reduced-motion setting also works.")}</p>
    </section>
    <section className="profile-card">
      <div className="profile-card-head"><h2>{t("csProfile.findCareTitle", "Need care?")}</h2><span className="tag">{t("csProfile.findCareBrand", APP1)}</span></div>
      <p className="muted">{t("csProfile.findCareHint", "Open Caresitters to find care and meet trusted people.")}</p>
      <a className="btn" href="https://caresits.xyz/caresitters" target="_blank" rel="noreferrer">{t("csProfile.openCaresitters", "Open Caresitters to find care")}</a>
      <p className="muted">{t("csProfile.storeFallback", "If it is not installed, find {name} in your app store.", { name: APP1 })}</p>
      <a className="profile-action" href={fallbackUrl} target="_blank" rel="noreferrer">{t("csProfile.openStore", "Open app store")}</a>
    </section>
    <footer className="center muted" style={{ padding: "4px 0 10px", fontSize: 15 }}>{t("csProfile.version", "App version {version}", { version: APP_VERSION })}</footer>
  </div></div>;
}
