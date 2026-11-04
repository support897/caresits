import { describe, expect, it } from "vitest";
import { canDeliverNotification, DEFAULT_NOTIFICATION_PREFS, hasManipulativeNotificationCopy, normalizeNotificationPrefs, NOTIFICATION_CATEGORIES, notificationCategoryLabel } from "./prefs";

describe("notification choices", () => {
  it("lists every care category in one place", () => {
    expect(NOTIFICATION_CATEGORIES.map((category) => category.id)).toEqual([
      "messages", "bookingReminders", "careUpdates", "requests", "calendarChanges", "activityReminders", "shopping", "allergyChanges",
    ]);
  });

  it("resolves category labels at render time", () => {
    expect(notificationCategoryLabel("messages")).toBe("Messages");
    expect(notificationCategoryLabel("allergyChanges")).toBe("Allergy changes");
    expect(notificationCategoryLabel("activityReminders")).toBe("Activity reminders");
  });

  it("always delivers safety and allergy alerts", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, muted: { allergyChanges: true, messages: true }, muteNonUrgentWhileWorking: true };
    expect(canDeliverNotification({ category: "allergyChanges" }, prefs, "carer", true)).toBe(true);
    expect(canDeliverNotification({ category: "messages", safety: true }, prefs, "carer", true)).toBe(true);
  });

  it("lets carers mute non-urgent updates while working", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, muteNonUrgentWhileWorking: true };
    expect(canDeliverNotification({ category: "messages" }, prefs, "carer", true)).toBe(false);
    expect(canDeliverNotification({ category: "messages" }, prefs, "carer", false)).toBe(true);
  });

  it("supports parent every, key-event, and daily-recap choices", () => {
    const keyPrefs = normalizeNotificationPrefs({ frequency: "key" });
    const dailyPrefs = normalizeNotificationPrefs({ frequency: "daily" });
    expect(canDeliverNotification({ category: "careUpdates" }, keyPrefs, "family")).toBe(false);
    expect(canDeliverNotification({ category: "careUpdates", keyEvent: true }, keyPrefs, "family")).toBe(true);
    expect(canDeliverNotification({ category: "careUpdates" }, dailyPrefs, "family")).toBe(false);
    expect(canDeliverNotification({ category: "careUpdates", dailyRecap: true }, dailyPrefs, "family")).toBe(true);
  });

  it("flags manipulative notification language", () => {
    expect(hasManipulativeNotificationCopy("Hurry, last chance")).toBe(true);
    expect(hasManipulativeNotificationCopy("A care update is ready to read.")).toBe(false);
  });
});
