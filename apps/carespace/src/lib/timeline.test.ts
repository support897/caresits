import { describe, expect, it } from "vitest";
import { answerAskOnItem, appendVoiceTranscript, attachAskToItem, groupTimelineByDay, timelineItemsForChild, type TimelineItem } from "./timeline";

const item = (id: string, day: string, at: string): TimelineItem => ({ id, day, at, kind: "activity", text: id });

describe("timeline", () => {
  it("appends dictated words without losing the note already typed", () => {
    expect(appendVoiceTranscript("Meal note", "  drank more water  ")).toBe("Meal note drank more water");
    expect(appendVoiceTranscript("Meal note", "  ")).toBe("Meal note");
  });

  it("groups entries by day and sorts each day by time", () => {
    const grouped = groupTimelineByDay([
      item("late", "2026-11-04", "2026-11-04T15:00:00.000Z"),
      item("next", "2026-11-05", "2026-11-05T08:00:00.000Z"),
      item("early", "2026-11-04", "2026-11-04T07:00:00.000Z"),
    ]);
    expect(grouped.map((day) => [day.day, day.items.map((entry) => entry.id)])).toEqual([
      ["2026-11-04", ["early", "late"]],
      ["2026-11-05", ["next"]],
    ]);
  });

  it("keeps each child's timeline separate and retains family-wide notes", () => {
    const rows: TimelineItem[] = [
      { ...item("child-a", "2026-11-04", "2026-11-04T08:00:00.000Z"), childId: "a" },
      { ...item("child-b", "2026-11-04", "2026-11-04T08:30:00.000Z"), childId: "b" },
      item("family-note", "2026-11-04", "2026-11-04T09:00:00.000Z"),
    ];
    expect(timelineItemsForChild(rows, "a").map((row) => row.id)).toEqual(["child-a", "family-note"]);
    expect(timelineItemsForChild(rows, "b").map((row) => row.id)).toEqual(["child-b", "family-note"]);
  });

  it("attaches a request to its own timeline item and records its answer", () => {
    const source = item("painting", "2026-11-04", "2026-11-04T10:00:00.000Z");
    const asked = attachAskToItem(source, { by: "parent", text: "Send a photo of the painting", at: "2026-11-04T10:01:00.000Z" });
    const answered = answerAskOnItem(asked, 0, {
      answeredAt: "2026-11-04T10:10:00.000Z",
      answerText: "Here is the finished painting.",
      answerPhotoKey: "spaces/family/gallery/art.jpg",
    });
    expect(source.asks).toBeUndefined();
    expect(answered.asks?.[0]).toMatchObject({
      by: "parent",
      text: "Send a photo of the painting",
      answerText: "Here is the finished painting.",
      answerPhotoKey: "spaces/family/gallery/art.jpg",
      answeredAt: "2026-11-04T10:10:00.000Z",
    });
  });
});
