import { describe, expect, it } from "vitest";
import { canSendChat, isSafeChatMediaKey, mapChatBooking, normalizeChatOutbox } from "./chat";

describe("chat safety helpers", () => {
  it("allows sending only after an active relationship and clear block check", () => {
    expect(canSendChat("contact", false, true)).toBe(true);
    expect(canSendChat("hired", false, true)).toBe(true);
    expect(canSendChat("contact", true, true)).toBe(false);
    expect(canSendChat("contact", false, false)).toBe(false);
    expect(canSendChat("pending", false, true)).toBe(false);
  });

  it("accepts only private media keys owned by the sender", () => {
    expect(isSafeChatMediaKey("users/family_1/gallery/photo-abc123.jpg", "family_1")).toBe(true);
    expect(isSafeChatMediaKey("users/family_1/attachments/attachment-abc123.pdf", "family_1")).toBe(true);
    expect(isSafeChatMediaKey("users/carer_1/gallery/photo-abc123.jpg", "family_1")).toBe(false);
    expect(isSafeChatMediaKey("https://example.invalid/child.jpg", "family_1")).toBe(false);
    expect(isSafeChatMediaKey("users/family_1/attachments/attachment-abc123.exe", "family_1")).toBe(false);
  });

  it("keeps only valid, bounded offline text messages", () => {
    const valid = { id: "msg-1", meUid: "family_1", relId: "carer_1_family_1", text: "Hello", queuedAt: 10 };
    expect(normalizeChatOutbox([valid, { ...valid, id: "bad/path" }, { ...valid, text: "x".repeat(1001) }, { ...valid, relId: "a/b" }])).toEqual([valid]);
    expect(normalizeChatOutbox(Array.from({ length: 105 }, (_, index) => ({ ...valid, id: `msg-${index}` })))).toHaveLength(100);
    expect(normalizeChatOutbox("not a queue")).toEqual([]);
  });

  it("maps relationship booking records without trusting unknown state or values", () => {
    const record = mapChatBooking("book-1", "family_1_carer_1", {
      familyUid: "family_1", carerUid: "carer_1", date: "2026-11-04", from: "09:00", to: "12:00",
      rate: 32, estimate: 96, recurring: "weekly", weekdays: ["Wed"], state: "accepted", note: "Care plan",
    });
    expect(record).toMatchObject({ id: "book-1", state: "accepted", rate: 32, estimate: 96, weekdays: ["Wed"] });
    expect(mapChatBooking("book-2", "pair", { state: "verified", rate: "NaN", estimate: -Infinity }).state).toBe("requested");
    expect(mapChatBooking("book-3", "pair", { rate: "bad", estimate: "bad" })).toMatchObject({ rate: 0, estimate: 0 });
  });
});
