import { describe, expect, it } from "vitest";
import { notificationCategorySchema, notificationPrefsSchema, notificationSchema } from "./notifications.js";

describe("notification schemas", () => {
  it("accepts the inbox notification shape and all supported categories", () => {
    for (const category of notificationCategorySchema.options) {
      expect(notificationSchema.safeParse({ category, title: "Booking reminder", body: "A booking is scheduled.", at: new Date(0), read: false }).success).toBe(true);
    }
  });

  it("rejects unknown fields, invalid categories, and invalid read state", () => {
    expect(notificationSchema.safeParse({ category: "unknown", title: "Notice", body: "Body", at: Date.now(), read: false }).success).toBe(false);
    expect(notificationSchema.safeParse({ category: "messages", title: "Notice", body: "Body", at: Date.now(), read: "no" }).success).toBe(false);
    expect(notificationSchema.safeParse({ category: "messages", title: "Notice", body: "Body", at: Date.now(), read: false, uid: "other" }).success).toBe(false);
  });

  it("keeps notification preference defaults and rejects invalid times", () => {
    expect(notificationPrefsSchema.parse({})).toMatchObject({ mode: "all", bookings: true, muteNonUrgentWhileWorking: false });
    expect(notificationPrefsSchema.safeParse({ dailyRecapTime: "25:00" }).success).toBe(false);
  });
});
