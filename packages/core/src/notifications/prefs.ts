import { t } from "../i18n";

export const NOTIFICATION_CATEGORIES = [
  { id: "messages", key: "notify.category.messages", english: "Messages" },
  { id: "bookingReminders", key: "notify.category.bookings", english: "Booking reminders" },
  { id: "careUpdates", key: "notify.category.care", english: "Care updates" },
  { id: "requests", key: "notify.category.requests", english: "Requests" },
  { id: "calendarChanges", key: "notify.category.calendar", english: "Calendar changes" },
  { id: "shopping", key: "notify.category.shopping", english: "Shopping" },
  { id: "allergyChanges", key: "notify.category.allergies", english: "Allergy changes" },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["id"];
export function notificationCategoryLabel(id: NotificationCategory): string {
  const category = NOTIFICATION_CATEGORIES.find((item) => item.id === id);
  return category ? t(category.key, category.english) : t("notify.update", "Care update");
}
export type NotificationFrequency = "every" | "key" | "daily";
export type NotificationPrefs = {
  muted: Partial<Record<NotificationCategory, boolean>>;
  frequency: NotificationFrequency;
  muteNonUrgentWhileWorking: boolean;
};
export type NotificationEvent = {
  category: NotificationCategory;
  safety?: boolean;
  keyEvent?: boolean;
  dailyRecap?: boolean;
  title?: string;
  body?: string;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  muted: {},
  frequency: "every",
  muteNonUrgentWhileWorking: false,
};

export function normalizeNotificationPrefs(value: unknown): NotificationPrefs {
  if (!value || typeof value !== "object") return { ...DEFAULT_NOTIFICATION_PREFS, muted: {} };
  const input = value as Partial<NotificationPrefs>;
  const muted: NotificationPrefs["muted"] = {};
  for (const category of NOTIFICATION_CATEGORIES) muted[category.id] = input.muted?.[category.id] === true;
  const frequency: NotificationFrequency = input.frequency === "key" || input.frequency === "daily" ? input.frequency : "every";
  return { muted, frequency, muteNonUrgentWhileWorking: input.muteNonUrgentWhileWorking === true };
}

export function canDeliverNotification(
  event: NotificationEvent,
  prefs: NotificationPrefs,
  role: "family" | "carer",
  working = false,
): boolean {
  if (event.safety || event.category === "allergyChanges") return true;
  if (role === "carer" && working && prefs.muteNonUrgentWhileWorking) return false;
  if (prefs.muted[event.category]) return false;
  if (role === "family" && prefs.frequency === "key" && !event.keyEvent) return false;
  if (role === "family" && prefs.frequency === "daily" && !event.dailyRecap) return false;
  return true;
}

const BANNED_NOTIFICATION_WORDS = /\b(hurry|last chance|only|don't miss)\b/i;
export function hasManipulativeNotificationCopy(text: string): boolean {
  return BANNED_NOTIFICATION_WORDS.test(text);
}
