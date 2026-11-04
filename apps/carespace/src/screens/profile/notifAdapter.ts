import {
  loadNotificationPrefs, markAllNotificationsRead, markNotificationRead,
  readNotificationFeed, saveNotificationPrefs, subscribeNotificationFeed,
  type NotificationApp, type NotificationItem,
} from "@cc/core/src/notifications/store";
import type { NotificationPrefs } from "@cc/core/src/notifications/prefs";

/** Keep the app-facing notification API small so the backing store can be swapped later. */
export function createNotifAdapter(uid: string, app: NotificationApp = "carespace") {
  return {
    getPrefs: (_app: NotificationApp = app): Promise<NotificationPrefs> => loadNotificationPrefs(uid, _app),
    setPrefs: (_app: NotificationApp, prefs: NotificationPrefs): Promise<void> => saveNotificationPrefs(uid, _app, prefs),
    feed: (): NotificationItem[] => readNotificationFeed(uid, app),
    subscribe: (listener: () => void): (() => void) => subscribeNotificationFeed(uid, app, listener),
    markRead: (id: string): void => markNotificationRead(uid, app, id),
    markAllRead: (): void => markAllNotificationsRead(uid, app),
  };
}
