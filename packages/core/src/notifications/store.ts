import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth } from "../auth";
import { db } from "../firebase";
import { canDeliverNotification, DEFAULT_NOTIFICATION_PREFS, normalizeNotificationPrefs, type NotificationEvent, type NotificationFrequency, type NotificationPrefs } from "./prefs";

export type NotificationApp = "caresitters" | "carespace";
export type NotificationItem = NotificationEvent & { id: string; at: number; read: boolean };
const cache = new Map<string, NotificationItem[]>();
const listeners = new Map<string, Set<() => void>>();
const feedKey = (uid: string, app: NotificationApp) => `caresits-notifications-v1:${app}:${uid}`;
const prefsDoc = (uid: string) => doc(db, "users", uid, "prefs", "main");

function getFeed(uid: string, app: NotificationApp): NotificationItem[] {
  const key = feedKey(uid, app);
  const current = cache.get(key);
  if (current) return current;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as NotificationItem[];
    const rows = Array.isArray(parsed) ? parsed : [];
    cache.set(key, rows);
    return rows;
  } catch { cache.set(key, []); return []; }
}
function saveFeed(uid: string, app: NotificationApp, rows: NotificationItem[]) {
  const key = feedKey(uid, app);
  cache.set(key, rows);
  try { localStorage.setItem(key, JSON.stringify(rows)); } catch { /* feed stays in memory if local storage is full */ }
  listeners.get(key)?.forEach((listener) => listener());
}

export function subscribeNotificationFeed(uid: string, app: NotificationApp, listener: () => void): () => void {
  const key = feedKey(uid, app);
  const set = listeners.get(key) ?? new Set<() => void>();
  set.add(listener);
  listeners.set(key, set);
  return () => { set.delete(listener); if (!set.size) listeners.delete(key); };
}

export function readNotificationFeed(uid: string, app: NotificationApp): NotificationItem[] {
  return [...getFeed(uid, app)].sort((a, b) => b.at - a.at);
}

export function addLocalNotification(
  uid: string,
  app: NotificationApp,
  event: NotificationEvent,
  options: { role?: "family" | "carer"; working?: boolean; prefs?: NotificationPrefs } = {},
): NotificationItem | null {
  const prefs = options.prefs ?? DEFAULT_NOTIFICATION_PREFS;
  const role = options.role ?? "family";
  if (!canDeliverNotification(event, prefs, role, options.working)) return null;
  const row: NotificationItem = {
    ...event,
    id: globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: Date.now(),
    read: false,
  };
  saveFeed(uid, app, [row, ...getFeed(uid, app)].slice(0, 100));
  return row;
}

export function markNotificationRead(uid: string, app: NotificationApp, id: string): void {
  saveFeed(uid, app, getFeed(uid, app).map((item) => item.id === id ? { ...item, read: true } : item));
}
export function markAllNotificationsRead(uid: string, app: NotificationApp): void {
  saveFeed(uid, app, getFeed(uid, app).map((item) => ({ ...item, read: true })));
}

export function useNotificationFeed(uid: string, app: NotificationApp): NotificationItem[] {
  const [items, setItems] = useState(() => uid ? readNotificationFeed(uid, app) : []);
  useEffect(() => {
    if (!uid) { setItems([]); return; }
    const refresh = () => setItems(readNotificationFeed(uid, app));
    const stop = subscribeNotificationFeed(uid, app, refresh);
    refresh();
    return stop;
  }, [uid, app]);
  return items;
}

export async function loadNotificationPrefs(uid: string, app: NotificationApp): Promise<NotificationPrefs> {
  if (!uid || auth().currentUser?.uid !== uid) return { ...DEFAULT_NOTIFICATION_PREFS, muted: {} };
  const snapshot = await getDoc(prefsDoc(uid));
  const apps = snapshot.exists() ? snapshot.data().apps : undefined;
  return normalizeNotificationPrefs(apps && typeof apps === "object" ? apps[app] : undefined);
}

export async function saveNotificationPrefs(uid: string, app: NotificationApp, prefs: NotificationPrefs): Promise<void> {
  if (!uid || auth().currentUser?.uid !== uid) throw new Error("sign-in-required");
  const clean = normalizeNotificationPrefs(prefs);
  await setDoc(prefsDoc(uid), { apps: { [app]: clean } }, { merge: true });
}

export type { NotificationFrequency, NotificationPrefs };
