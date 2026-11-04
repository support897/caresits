import { beforeEach, describe, expect, it, vi } from "vitest";

const { readSnapshot, saveSnapshot, writeSpaceDocument } = vi.hoisted(() => ({
  readSnapshot: vi.fn(() => null),
  saveSnapshot: vi.fn(),
  writeSpaceDocument: vi.fn(),
}));

vi.mock("./offline", () => ({
  isConnectivityError: vi.fn(),
  readSnapshot,
  saveSnapshot,
  writeSpaceDocument,
}));

import { addTodayItem, answerTodayAsk, askForTodayUpdate, normalizeCareSpacePhotos } from "./today";
import type { TimelineItem } from "../lib/timeline";

const item: TimelineItem = {
  id: "item-1", day: "2026-11-04", kind: "meal", at: "2026-11-04T08:00:00.000Z", text: "Breakfast",
};

describe("Today queued writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeSpaceDocument.mockResolvedValue({ queued: true });
  });

  it("returns queued state outside the saved timeline item", async () => {
    const result = await addTodayItem("family-1", {
      day: item.day, kind: item.kind, at: item.at, text: item.text,
    });
    expect(result).toMatchObject({ queued: true, item: { day: item.day, kind: "meal", text: "Breakfast" } });
    expect(result.item).not.toHaveProperty("queued");
    expect(writeSpaceDocument).toHaveBeenCalledWith(expect.objectContaining({
      path: expect.stringMatching(/^careSpaces\/family-1\/dayStory\//),
    }));
  });

  it("returns queued state for item-attached update requests", async () => {
    const result = await askForTodayUpdate("family-1", item, {
      by: "parent-1", text: "How long was the nap?", at: "2026-11-04T09:00:00.000Z",
    });
    expect(result.queued).toBe(true);
    expect(result.item.asks).toEqual([{ by: "parent-1", text: "How long was the nap?", at: "2026-11-04T09:00:00.000Z" }]);
    expect(result.item).not.toHaveProperty("queued");
  });

  it("returns queued state when an item-attached request is answered", async () => {
    const itemWithAsk: TimelineItem = {
      ...item, asks: [{ by: "parent-1", text: "How long was the nap?", at: "2026-11-04T09:00:00.000Z" }],
    };
    const result = await answerTodayAsk("family-1", itemWithAsk, 0, {
      answeredAt: "2026-11-04T10:00:00.000Z", answerText: "About an hour.",
    });
    expect(result.queued).toBe(true);
    expect(result.item.asks?.[0]).toMatchObject({ answerText: "About an hour.", answeredAt: "2026-11-04T10:00:00.000Z" });
    expect(result.item).not.toHaveProperty("queued");
  });

  it("keeps the newest shared photos first and leaves non-photo notes out", () => {
    const result = normalizeCareSpacePhotos([
      { ...item, id: "old-photo", kind: "photo", at: "2026-11-03T08:00:00.000Z", photoKey: "spaces/family/gallery/photo-old.jpg" },
      { ...item, id: "meal", kind: "meal", at: "2026-11-04T08:00:00.000Z" },
      { ...item, id: "new-photo", kind: "photo", at: "2026-11-04T10:00:00.000Z", photoKey: "spaces/family/gallery/photo-new.jpg" },
    ]);
    expect(result.map((entry) => entry.id)).toEqual(["new-photo", "old-photo"]);
  });

  it("adds a newly shared photo to the offline gallery snapshot", async () => {
    const result = await addTodayItem("family-1", {
      day: item.day, kind: "photo", at: item.at, text: "Garden photo", photoKey: "spaces/family/gallery/photo-1.jpg",
    });
    expect(result.queued).toBe(true);
    expect(saveSnapshot).toHaveBeenCalledWith("care-photos:family-1", [expect.objectContaining({ kind: "photo", photoKey: "spaces/family/gallery/photo-1.jpg" })]);
  });
});
