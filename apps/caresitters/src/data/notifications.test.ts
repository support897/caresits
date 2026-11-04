import { describe, expect, it } from "vitest";
import { parseNotificationDocument } from "./notifications";

describe("Firestore notification documents", () => {
  it("parses valid notifications and Firestore-style timestamps", () => {
    const item = parseNotificationDocument("notice-1", {
      category: "booking-reminders",
      title: "Booking reminder",
      body: "A booking is scheduled for tomorrow.",
      at: { seconds: 1_800_000_000, nanoseconds: 500_000_000, toDate: () => new Date(1_800_000_000_500) },
      read: false,
    });
    expect(item).toMatchObject({ id: "notice-1", category: "booking-reminders", read: false });
    expect(item?.at).toEqual(new Date(1_800_000_000_500));
  });

  it("drops malformed, unknown-category, and path-like documents", () => {
    expect(parseNotificationDocument("bad", { category: "other", title: "x", body: "y", at: new Date(), read: false })).toBeNull();
    expect(parseNotificationDocument("bad", { category: "messages", title: "x", body: "y", at: null, read: false })).toBeNull();
    expect(parseNotificationDocument("nested/id", { category: "messages", title: "x", body: "y", at: new Date(), read: false })).toBeNull();
  });
});
