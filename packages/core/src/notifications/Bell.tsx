import { useEffect, useState } from "react";
import { Bunny } from "../Bunny";
import { t, useLang } from "../i18n";
import { NOTIFICATION_CATEGORIES, notificationCategoryLabel, type NotificationPrefs } from "./prefs";
import { loadNotificationPrefs, markAllNotificationsRead, markNotificationRead, saveNotificationPrefs, useNotificationFeed, type NotificationApp } from "./store";

export type BellProps = { uid: string; side: "family" | "carer"; app?: NotificationApp };
export function Bell({ uid, side, app = "caresitters" }: BellProps) {
  useLang();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>({ muted: {}, frequency: "every", muteNonUrgentWhileWorking: false });
  const [saveError, setSaveError] = useState("");
  const items = useNotificationFeed(uid, app);
  const unread = items.filter((item) => !item.read).length;

  useEffect(() => {
    let live = true;
    void loadNotificationPrefs(uid, app).then((next) => { if (live) setPrefs(next); }).catch(() => { if (live) setSaveError(t("notify.load.error", "Notification choices could not load.")); });
    return () => { live = false; };
  }, [uid, app]);

  async function update(next: NotificationPrefs) {
    setPrefs(next);
    setSaveError("");
    try { await saveNotificationPrefs(uid, app, next); }
    catch { setSaveError(t("notify.save.error", "Notification choices could not save.")); }
  }

  return <div style={{ position: "relative", zIndex: 1 }}>
    <button type="button" aria-label={t("notify.open", "Notifications") + (unread ? `, ${unread} unread` : "")} aria-expanded={open} onClick={() => setOpen((value) => !value)} style={{ position: "relative", width: 48, height: 48, borderRadius: 24, display: "grid", placeItems: "center", background: "var(--soft)", border: "1px solid var(--line)" }}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
      {unread > 0 && <span aria-label={`${unread} unread`} style={{ position: "absolute", insetBlockStart: 0, insetInlineEnd: 0, minWidth: 20, height: 20, paddingInline: 4, borderRadius: 99, background: "var(--danger)", color: "var(--cream)", fontSize: 13, fontWeight: 700, display: "grid", placeItems: "center" }}>{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <>
      <button type="button" aria-label={t("notify.close", "Close notifications")} onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10, cursor: "default" }} />
      <section aria-label={t("notify.panel", "Notifications")} style={{ position: "fixed", zIndex: 11, insetBlockStart: "calc(12px + env(safe-area-inset-top))", insetInline: "max(12px, calc((100vw - 360px) / 2))", width: "min(360px, calc(100vw - 24px))", maxHeight: "min(78vh, 700px)", overflowY: "auto", marginInlineStart: "auto", padding: 16, borderRadius: 22, background: "var(--cream)", color: "var(--text)", boxShadow: "var(--shadow)", border: "1px solid var(--line)" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div><p className="muted" style={{ margin: 0 }}>{t("notify.kicker", "Your care updates")}</p><h2 style={{ fontSize: 24 }}>{t("notify.title", "Notifications")}</h2></div>
          <button type="button" className="chip" onClick={() => markAllNotificationsRead(uid, app)}>{t("notify.markRead", "Mark read")}</button>
        </header>
        {saveError && <p role="alert" style={{ color: "var(--danger)" }}>{saveError}</p>}
        <fieldset style={{ margin: "14px 0", padding: 0, border: 0 }}>
          <legend style={{ fontWeight: 700, marginBlockEnd: 6 }}>{t("notify.categories", "Categories")}</legend>
          <div style={{ display: "grid", gap: 2 }}>
            {NOTIFICATION_CATEGORIES.map((category) => {
              const cannotMute = category.id === "allergyChanges";
              return <label key={category.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 44, borderBlockEnd: "1px solid var(--line)" }}>
                <span>{notificationCategoryLabel(category.id)}</span>
                <input type="checkbox" checked={cannotMute || !prefs.muted[category.id]} disabled={cannotMute} aria-label={t("notify.receive.category", "Receive {category}", { category: notificationCategoryLabel(category.id) })} onChange={(event) => void update({ ...prefs, muted: { ...prefs.muted, [category.id]: !event.currentTarget.checked } })} style={{ width: 22, height: 22, accentColor: "var(--ink)" }} />
              </label>;
            })}
          </div>
          <p className="muted" style={{ marginBlock: 8 }}>{t("notify.safety.always", "Safety and allergy alerts always come through.")}</p>
        </fieldset>
        {side === "carer" && <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, marginBlockEnd: 12 }}>
          <input type="checkbox" checked={prefs.muteNonUrgentWhileWorking} onChange={(event) => void update({ ...prefs, muteNonUrgentWhileWorking: event.currentTarget.checked })} style={{ width: 22, height: 22, accentColor: "var(--ink)" }} />
          <span>{t("notify.carer.mute", "Mute non-urgent while working")}</span>
        </label>}
        <div style={{ display: "grid", gap: 8 }}>
          {items.length ? items.map((item) => {
            const label = notificationCategoryLabel(item.category);
            return <button key={item.id} type="button" onClick={() => markNotificationRead(uid, app, item.id)} style={{ minHeight: 56, padding: 12, borderRadius: 14, textAlign: "start", background: item.read ? "var(--soft)" : "var(--card)", border: "1px solid var(--line)" }}>
              <span style={{ display: "block", fontSize: 15, color: "var(--muted)" }}>{label} · {new Date(item.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
              <strong>{item.title ?? label}</strong>{item.body && <span style={{ display: "block", overflowWrap: "anywhere" }}>{item.body}</span>}
            </button>;
          }) : <div className="empty"><Bunny mood="rest" size={72} /><p>{t("notify.empty", "Care updates will show here.")}</p></div>}
        </div>
      </section>
    </>}
  </div>;
}
