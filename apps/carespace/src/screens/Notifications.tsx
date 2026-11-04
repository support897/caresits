import "../lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { BackBar, Bunny, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { Bell } from "@cc/core/src/notifications/Bell";
import { NOTIFICATION_CATEGORIES, notificationCategoryLabel, normalizeNotificationPrefs, type NotificationCategory, type NotificationFrequency, type NotificationPrefs } from "@cc/core/src/notifications/prefs";
import { listUserSpaces } from "../data/spaces";
import { createNotifAdapter } from "./profile/notifAdapter";
import "./profile/profile.css";

type NotificationParams = { uid: string };
const FREQUENCIES: Array<[NotificationFrequency, string, string]> = [
  ["every", "csNotifications.every", "Every update"],
  ["key", "csNotifications.key", "Key events"],
  ["daily", "csNotifications.daily", "Daily recap"],
];

export default function Notifications({ params }: ScreenProps<NotificationParams>) {
  const nav = useNav();
  const { user } = useAuth();
  const uid = params.uid || user?.uid || "";
  const adapter = useMemo(() => createNotifAdapter(uid), [uid]);
  const [prefs, setPrefs] = useState<NotificationPrefs>(normalizeNotificationPrefs(undefined));
  const [items, setItems] = useState(() => adapter.feed());
  const [hasParentSpace, setHasParentSpace] = useState(false);
  const [hasCarerSpace, setHasCarerSpace] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    void Promise.all([
      adapter.getPrefs("carespace"),
      listUserSpaces(uid),
    ]).then(([next, spaces]) => {
      if (!live) return;
      setPrefs(normalizeNotificationPrefs(next));
      setHasParentSpace(spaces.some((space) => space.role === "admin"));
      setHasCarerSpace(spaces.some((space) => space.role !== "admin"));
      setItems(adapter.feed());
    }).catch(() => { if (live) setError(t("csNotifications.loadError", "Notification choices could not load. Your saved choices are unchanged.")); })
      .finally(() => { if (live) setLoading(false); });
    const stop = adapter.subscribe(() => setItems(adapter.feed()));
    return () => { live = false; stop(); };
  }, [adapter, uid]);

  async function save(next: NotificationPrefs) {
    setPrefs(next); setSaving(true); setNotice(""); setError("");
    try {
      await adapter.setPrefs("carespace", next);
      setNotice(t("csNotifications.saved", "Notification choices saved."));
    } catch {
      setError(t("csNotifications.saveError", "Choices could not save. Check your connection and try again."));
    } finally { setSaving(false); }
  }

  function toggleCategory(category: NotificationCategory, enabled: boolean) {
    if (category === "allergyChanges") return;
    void save({ ...prefs, muted: { ...prefs.muted, [category]: !enabled } });
  }

  const unread = items.filter((item) => !item.read).length;
  return <div className="app">
    <BackBar title={t("csNotifications.title", "Notifications")} onBack={nav.back} right={<Bell uid={uid} side={hasParentSpace ? "family" : "carer"} app="carespace" />} />
    <div className="scroll"><div className="profile-screen">
      <header className="profile-hero"><div className="profile-hero-copy"><p className="profile-eyebrow">{t("csNotifications.kicker", "One calm bell")}</p><h1>{t("csNotifications.heading", "Your care updates")}</h1><p>{t("csNotifications.subtitle", "Choose what reaches you and when.")}</p></div><Bunny mood="hello" size={74} /></header>
      {error && <p className="profile-notice" role="alert">{error}</p>}
      {notice && <p className="profile-notice" role="status">{notice}</p>}
      {loading ? <div className="sk" style={{ height: 130 }} /> : <>
        {(hasParentSpace || !hasCarerSpace) && <section className="profile-card">
          <h2>{t("csNotifications.parentTitle", "For parents")}</h2>
          <p className="muted">{t("csNotifications.parentHint", "Choose how often ordinary care updates arrive.")}</p>
          <div className="profile-items" role="radiogroup" aria-label={t("csNotifications.parentTitle", "For parents")}>
            {FREQUENCIES.map(([value, key, english]) => <label className="profile-permission" key={value}>
              <span>{t(key, english)}</span>
              <input type="radio" name="notification-frequency" checked={prefs.frequency === value} disabled={saving} onChange={() => void save({ ...prefs, frequency: value })} />
            </label>)}
          </div>
        </section>}
        {(hasCarerSpace || !hasParentSpace) && <section className="profile-card">
          <h2>{t("csNotifications.carerTitle", "For carers")}</h2>
          <label className="profile-permission">
            <span>{t("csNotifications.muteWorking", "Mute non-urgent items while I’m working")}</span>
            <input type="checkbox" checked={prefs.muteNonUrgentWhileWorking} disabled={saving} onChange={(event) => void save({ ...prefs, muteNonUrgentWhileWorking: event.currentTarget.checked })} />
          </label>
          <p className="muted profile-permission-note">{t("csNotifications.safetyAlways", "Safety and allergy alerts always come through.")}</p>
        </section>}
        <section className="profile-card">
          <h2>{t("csNotifications.categoriesTitle", "Categories")}</h2>
          <div className="profile-items">
            {NOTIFICATION_CATEGORIES.map((category) => {
              const safety = category.id === "allergyChanges";
              return <label className="profile-permission" key={category.id}>
                <span>{notificationCategoryLabel(category.id)}</span>
                <input type="checkbox" checked={safety || !prefs.muted[category.id]} disabled={saving || safety} aria-label={t("csNotifications.receive", "Receive {category}", { category: notificationCategoryLabel(category.id) })} onChange={(event) => toggleCategory(category.id, event.currentTarget.checked)} />
              </label>;
            })}
          </div>
          <p className="muted profile-permission-note">{t("csNotifications.allergyLock", "Allergy changes cannot be muted.")}</p>
        </section>
        <section className="profile-card">
          <div className="profile-card-head"><h2>{t("csNotifications.feedTitle", "Recent updates")}</h2><button type="button" className="profile-action" disabled={!unread} onClick={() => { adapter.markAllRead(); setItems(adapter.feed()); }}>{t("csNotifications.markRead", "Mark all read")}</button></div>
          {items.length ? <div className="profile-items">
            {items.map((item) => {
              const label = notificationCategoryLabel(item.category);
              return <button type="button" key={item.id} className={`profile-feed-item${item.read ? "" : " unread"}`} onClick={() => { adapter.markRead(item.id); setItems(adapter.feed()); }}>
                <small>{label} · {new Date(item.at).toLocaleString()}</small>
                <strong>{item.title ?? label}</strong>
                {item.body && <span>{item.body}</span>}
                {!item.read && <span className="tag">{t("csNotifications.unread", "Unread")}</span>}
              </button>;
            })}
          </div> : <div className="empty"><Bunny mood="rest" size={86} /><h3>{t("csNotifications.emptyTitle", "A quiet inbox")}</h3><p className="muted">{t("csNotifications.emptyBody", "Care messages and safety updates will appear here.")}</p></div>}
        </section>
      </>}
    </div></div>
  </div>;
}
