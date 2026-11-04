import { useEffect, useState } from "react";
import { BackBar, getLang, isBunnyCalm, LANGS, setBunnyCalm, setLang, signOutUser, t, useLang, useNav, type Person } from "@cc/core";
import { DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_CATEGORIES, notificationCategoryLabel, type NotificationPrefs } from "../../../../packages/core/src/notifications/prefs";
import { loadNotificationPrefs, saveNotificationPrefs } from "../../../../packages/core/src/notifications/store";
import { requestAccountDeletion, requestDataExport } from "../data/safety";

type Params = { me: Person };
type ThemeMode = "auto" | "light" | "dark";
function readThemeMode(): ThemeMode {
  try { const mode = localStorage.getItem("caresits-theme-mode"); return mode === "light" || mode === "dark" ? mode : "auto"; }
  catch { return "auto"; }
}
function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.body.dataset.theme = mode === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
}

export default function Settings({ params }: { params: Params }) {
  const nav = useNav();
  useLang();
  const { me } = params;
  const [language, setLanguage] = useState(() => getLang());
  const [calm, setCalm] = useState(isBunnyCalm);
  const [theme, setTheme] = useState<ThemeMode>(readThemeMode);
  const [prefs, setPrefs] = useState<NotificationPrefs>({ ...DEFAULT_NOTIFICATION_PREFS, muted: {} });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState("");
  const [dataBusy, setDataBusy] = useState("");
  const [dataMessage, setDataMessage] = useState("");
  const [dataError, setDataError] = useState("");
  const [deleteText, setDeleteText] = useState("");

  useEffect(() => {
    let live = true;
    void loadNotificationPrefs(me.uid, "caresitters").then((next) => { if (live) setPrefs(next); }).catch(() => { if (live) setPrefsMessage(t("settings.notify.loadError", "Notification choices could not load.")); });
    return () => { live = false; };
  }, [me.uid]);
  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem("caresits-theme-mode", theme); } catch { /* browser storage is optional */ }
    if (theme !== "auto" || typeof matchMedia === "undefined") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const change = () => applyTheme("auto");
    query.addEventListener?.("change", change);
    return () => query.removeEventListener?.("change", change);
  }, [theme]);

  async function updatePrefs(next: NotificationPrefs) {
    setPrefs(next);
    setSavingPrefs(true);
    setPrefsMessage("");
    try { await saveNotificationPrefs(me.uid, "caresitters", next); setPrefsMessage(t("settings.notify.saved", "Notification choices saved.")); }
    catch { setPrefsMessage(t("settings.notify.saveError", "Notification choices could not save.")); }
    finally { setSavingPrefs(false); }
  }

  async function downloadData() {
    setDataBusy("export"); setDataMessage(""); setDataError("");
    try { await requestDataExport(me.uid); setDataMessage(t("settings.export.requested", "Data download requested.")); }
    catch { setDataError(t("settings.export.error", "Data download request could not be sent.")); }
    finally { setDataBusy(""); }
  }
  async function deleteAccount() {
    if (deleteText !== "DELETE") return;
    setDataBusy("delete"); setDataMessage(""); setDataError("");
    try { await requestAccountDeletion(me.uid, deleteText); setDataMessage(t("settings.delete.requested", "Account deletion requested.")); }
    catch { setDataError(t("settings.delete.error", "Account deletion request could not be sent.")); }
    finally { setDataBusy(""); }
  }

  return <div className="app">
    <BackBar title={t("settings.title", "Settings")} onBack={nav.back} />
    <div className="scroll" style={{ display: "grid", gap: 14 }}>
      <header><p className="muted" style={{ margin: 0 }}>{t("settings.kicker", "Make the app fit you")}</p><h1>{t("settings.title", "Settings")}</h1></header>

      <section className="card" aria-labelledby="settings-language-title">
        <h2 id="settings-language-title">{t("settings.language.title", "Language")}</h2>
        <label>{t("settings.language.label", "Choose a language")}<select className="field" value={language} onChange={(event) => { const next = event.target.value as typeof language; setLanguage(next); setLang(next); }}>
          {LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select></label>
        <p className="muted">{t("settings.language.rtl", "Arabic displays from right to left.")}</p>
      </section>

      <section className="card" aria-labelledby="settings-bunny-title">
        <h2 id="settings-bunny-title">{t("settings.bunny.title", "The bunny")}</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48 }}><input type="checkbox" checked={calm} onChange={(event) => { setCalm(event.target.checked); setBunnyCalm(event.target.checked); }} style={{ width: 22, height: 22, accentColor: "var(--ink)" }} /><span>{t("settings.bunny.calm", "Turn the bunny down")}</span></label>
      </section>

      <section className="card" aria-labelledby="settings-notifications-title">
        <h2 id="settings-notifications-title">{t("settings.notifications.title", "Notifications")}</h2>
        {me.side === "family" && <label>{t("settings.frequency.label", "Care update frequency")}<select className="field" value={prefs.frequency} disabled={savingPrefs} onChange={(event) => void updatePrefs({ ...prefs, frequency: event.target.value as NotificationPrefs["frequency"] })}>
          <option value="every">{t("settings.frequency.every", "Every update")}</option><option value="key">{t("settings.frequency.key", "Key events")}</option><option value="daily">{t("settings.frequency.daily", "Daily recap")}</option>
        </select></label>}
        <fieldset style={{ border: 0, padding: 0, margin: "12px 0" }}><legend>{t("settings.notifications.categories", "Choose categories")}</legend>
          {NOTIFICATION_CATEGORIES.map((category) => {
            const protectedCategory = category.id === "allergyChanges";
            return <label key={category.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 46, borderBlockEnd: "1px solid var(--line)" }}>
              <span>{notificationCategoryLabel(category.id)}</span><input type="checkbox" checked={protectedCategory || !prefs.muted[category.id]} disabled={savingPrefs || protectedCategory} aria-label={t("settings.notifications.receive", "Receive {category}", { category: notificationCategoryLabel(category.id) })} onChange={(event) => void updatePrefs({ ...prefs, muted: { ...prefs.muted, [category.id]: !event.currentTarget.checked } })} style={{ width: 22, height: 22, accentColor: "var(--ink)" }} />
            </label>;
          })}
        </fieldset>
        {me.side === "carer" && <label style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48 }}><input type="checkbox" checked={prefs.muteNonUrgentWhileWorking} disabled={savingPrefs} onChange={(event) => void updatePrefs({ ...prefs, muteNonUrgentWhileWorking: event.target.checked })} style={{ width: 22, height: 22, accentColor: "var(--ink)" }} /><span>{t("settings.notifications.working", "Mute non-urgent while working")}</span></label>}
        <p className="muted">{t("settings.notifications.safety", "Safety and allergy alerts always come through.")}</p>
        {prefsMessage && <p role="status" className="muted">{prefsMessage}</p>}
      </section>

      <section className="card" aria-labelledby="settings-theme-title">
        <h2 id="settings-theme-title">{t("settings.theme.title", "Theme")}</h2>
        <label>{t("settings.theme.mode", "Theme mode")}<select className="field" value={theme} onChange={(event) => setTheme(event.target.value as ThemeMode)}><option value="auto">{t("settings.theme.auto", "Auto")}</option><option value="light">{t("settings.theme.light", "Light")}</option><option value="dark">{t("settings.theme.dark", "Dark")}</option></select></label>
      </section>

      <section className="card" aria-labelledby="settings-privacy-title">
        <h2 id="settings-privacy-title">{t("settings.privacy.title", "Privacy and account")}</h2>
        <p className="muted">{t("settings.privacy.note", "Your profile and child details stay private until you share them.")}</p>
        <button className="btn alt" type="button" onClick={() => nav.push("safety", { uid: me.uid })}>{t("settings.privacy.safety", "Open safety tools")}</button>
        <button className="btn alt" type="button" onClick={() => void downloadData()} disabled={Boolean(dataBusy)} style={{ marginBlockStart: 8 }}>{dataBusy === "export" ? t("settings.export.sending", "Sending request…") : t("settings.export.button", "Download my data")}</button>
        <label style={{ display: "block", marginBlockStart: 10 }}>{t("settings.delete.confirm.label", "Type DELETE to confirm account deletion")}<input className="field" value={deleteText} onChange={(event) => setDeleteText(event.target.value)} autoComplete="off" /></label>
        <button className="btn" type="button" onClick={() => void deleteAccount()} disabled={deleteText !== "DELETE" || Boolean(dataBusy)} style={{ marginBlockStart: 8, background: "var(--danger)" }}>{dataBusy === "delete" ? t("settings.delete.sending", "Sending request…") : t("settings.delete.button", "Delete my account")}</button>
        <p className="muted">{t("settings.delete.note", "This sends a request. The account is not removed from this screen.")}</p>
        {dataMessage && <p role="status">{dataMessage}</p>}{dataError && <p role="alert" style={{ color: "var(--danger)" }}>{dataError}</p>}
      </section>

      <button className="btn alt" type="button" onClick={() => void signOutUser()}>{t("settings.signOut", "Sign out")}</button>
      <p className="muted center">{t("settings.lang.current", "Current display: {direction}", { direction: language === "ar" ? "RTL" : "LTR" })}</p>
    </div>
  </div>;
}
