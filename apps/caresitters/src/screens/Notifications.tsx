import { useEffect, useState } from "react";
import { Bunny, t } from "@cc/core";
import { markNotificationRead, subscribeToNotifications, type UserNotification } from "../data/notifications";

type Params = { uid: string; onBack: () => void };

type LauncherProps = { uid: string; onOpen: () => void };

function BellIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M10 21h4" />
  </svg>;
}

export function NotificationsLauncher({ uid, onOpen }: LauncherProps) {
  const [unread, setUnread] = useState(0);
  useEffect(() => subscribeToNotifications(uid, (rows) => setUnread(rows.filter((row) => !row.read).length), () => setUnread(0)), [uid]);
  const label = unread > 0
    ? t("notifications.launcher.ariaUnread", "Open notifications, {count} unread", { count: unread })
    : t("notifications.launcher.aria", "Open notifications");

  return <button type="button" className="card" onClick={onOpen} aria-label={label} style={{ width: "100%", minHeight: 68, display: "flex", alignItems: "center", gap: 14, textAlign: "start" }}>
    <span aria-hidden="true" style={{ width: 44, height: 44, display: "grid", placeItems: "center", flex: "0 0 auto", borderRadius: 22, background: "var(--soft)", color: "var(--ink)" }}><BellIcon /></span>
    <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block" }}>{t("notifications.launcher.title", "Notifications")}</strong><span className="muted">{t("notifications.launcher.body", "Messages, booking reminders and care updates")}</span></span>
    {unread > 0 && <span aria-hidden="true" style={{ minWidth: 26, height: 26, paddingInline: 7, display: "grid", placeItems: "center", borderRadius: 13, background: "var(--ink)", color: "var(--cream)", fontWeight: 700 }}>{unread > 99 ? "99+" : unread}</span>}
  </button>;
}

function notificationDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === "number") return Number.isFinite(value) ? new Date(value) : null;
  if (typeof value === "string") {
    const millis = Date.parse(value);
    return Number.isFinite(millis) ? new Date(millis) : null;
  }
  if (!value || typeof value !== "object") return null;
  const timestamp = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  if (typeof timestamp.toDate === "function") {
    try { const date = timestamp.toDate(); return date instanceof Date && Number.isFinite(date.getTime()) ? date : null; }
    catch { return null; }
  }
  if (typeof timestamp.seconds === "number") {
    const date = new Date(timestamp.seconds * 1_000 + Math.floor((timestamp.nanoseconds ?? 0) / 1_000_000));
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
}

function timeLabel(item: UserNotification): { text: string; iso?: string } {
  const date = notificationDate(item.at);
  if (!date) return { text: t("notifications.time.unknown", "Time unavailable") };
  return { text: new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date), iso: date.toISOString() };
}

export default function Notifications({ params }: { params: Params }) {
  const { uid, onBack } = params;
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(false);
    const stop = subscribeToNotifications(uid, (rows) => {
      if (!live) return;
      setItems(rows);
      setLoading(false);
      setError(false);
    }, () => {
      if (!live) return;
      setLoading(false);
      setError(true);
    });
    return () => { live = false; stop(); };
  }, [uid, attempt]);

  async function markRead(id: string) {
    setBusyId(id);
    setError(false);
    try { await markNotificationRead(uid, id); }
    catch { setError(true); }
    finally { setBusyId(""); }
  }

  return <main className="scroll" aria-labelledby="notifications-title" style={{ height: "100%", minHeight: 0, overflowY: "auto", padding: 16, background: "var(--cream)", color: "var(--ink)" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 12, marginBlockEnd: 18 }}>
      <button type="button" className="btn alt" aria-label={t("notifications.back", "Back to your account")} onClick={onBack} style={{ width: 48, minWidth: 48, minHeight: 48, padding: 0, fontSize: 24 }}>‹</button>
      <div style={{ minWidth: 0, flex: 1 }}><p className="muted" style={{ margin: 0 }}>{t("notifications.kicker", "A calm place for updates")}</p><h1 id="notifications-title" style={{ marginBlock: 2 }}>{t("notifications.title", "Notifications")}</h1></div>
      <BellIcon />
    </header>

    {loading && <p role="status">{t("notifications.loading", "Loading notifications…")}</p>}
    {error && <section className="card" role="alert" style={{ marginBlockEnd: 12 }}>
      <p>{t("notifications.error", "Notifications could not load or update.")}</p>
      <button type="button" className="btn alt" onClick={() => setAttempt((value) => value + 1)} style={{ minHeight: 48 }}>{t("notifications.retry", "Try again")}</button>
    </section>}
    {!loading && !error && items.length === 0 && <section className="card" style={{ display: "grid", justifyItems: "center", gap: 8, paddingBlock: 24, textAlign: "center" }}>
      <Bunny mood="rest" size={96} caption={t("notifications.empty.caption", "Your care updates will appear here.")} />
      <h2 style={{ marginBlock: 0 }}>{t("notifications.empty.title", "A quiet inbox")}</h2>
      <p style={{ marginBlock: 0 }}>{t("notifications.empty.body", "Booking reminders and other updates will show here when they are ready.")}</p>
    </section>}
    {!loading && items.length > 0 && <section aria-label={t("notifications.list", "Your notifications")} style={{ display: "grid", gap: 10 }}>
      {items.map((item) => {
        const time = timeLabel(item);
        return <article key={item.id} aria-label={!item.read ? t("notifications.item.unread", "Unread notification: {title}", { title: item.title }) : item.title} className="card" style={{ display: "grid", gap: 10, background: item.read ? "var(--cream)" : "var(--soft)", borderInlineStart: item.read ? undefined : "4px solid var(--ink)" }}>
          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}><h2 style={{ fontSize: 20, marginBlock: 0, overflowWrap: "anywhere" }}>{item.title}</h2><p style={{ marginBlock: "8px 0", overflowWrap: "anywhere" }}>{item.body}</p></div>
            {!item.read && <span aria-label={t("notifications.unread", "Unread")} style={{ width: 12, height: 12, flex: "0 0 auto", marginBlockStart: 6, borderRadius: 6, background: "var(--ink)" }} />}
          </div>
          <time dateTime={time.iso} className="muted">{time.text}</time>
          {!item.read && <button type="button" className="btn alt" onClick={() => void markRead(item.id)} disabled={busyId === item.id} style={{ minHeight: 48, justifySelf: "start" }}>
            {busyId === item.id ? t("notifications.marking", "Marking as read…") : t("notifications.markRead", "Mark as read")}
          </button>}
        </article>;
      })}
    </section>}
  </main>;
}
