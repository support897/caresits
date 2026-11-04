import { describe, expect, it } from "vitest";
import { filterChatsByTab, getUnreadCount, mergeMessageStreams, messageCollectionPath, timeMs } from "./merge";

describe("shared chat helpers", () => {
  it("merges both sides, removes duplicate ids, and sorts by time", () => {
    const first = [{ id: "b", from: "carer", text: "later", at: 20 }, { id: "a", from: "family", text: "first", at: 10 }];
    const second = [{ id: "a", from: "family", text: "duplicate", at: 10 }, { id: "c", from: "carer", text: "last", at: 30 }];
    expect(mergeMessageStreams(first, second).map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(mergeMessageStreams(first, second)[0]?.text).toBe("first");
  });

  it("counts only newer messages from other people", () => {
    expect(getUnreadCount([
      { from: "me", at: 20 }, { from: "them", at: 10 }, { from: "them", at: 21 },
    ], "me", 20)).toBe(1);
  });

  it("filters unique active relationships and keeps pending requests", () => {
    const rels = [
      { id: "one", familyUid: "f", carerUid: "c", state: "contact" },
      { id: "one", familyUid: "f", carerUid: "c", state: "contact" },
      { id: "two", familyUid: "f", carerUid: "d", state: "pending" },
    ];
    expect(filterChatsByTab(rels, "Families", { uid: "c", side: "carer" }).map((row) => row.id)).toEqual(["one"]);
    expect(filterChatsByTab(rels, "Requests", { uid: "c" }).map((row) => row.id)).toEqual(["two"]);
    expect(filterChatsByTab(rels, "Unread", { uid: "c" }, { one: 1 }).map((row) => row.id)).toEqual(["one"]);
  });

  it("normalizes supported dates and uses the shared relationship path", () => {
    expect(timeMs("2026-11-04T00:00:00.000Z")).toBe(Date.parse("2026-11-04T00:00:00.000Z"));
    expect(messageCollectionPath("a_b")).toBe("relationships/a_b/messages");
    expect(() => messageCollectionPath("a/b")).toThrow("Invalid relationship id");
  });
});
