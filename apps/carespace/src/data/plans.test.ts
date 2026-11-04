import { describe, expect, it } from "vitest";
import {
  addPlanEntry, buildEmptyPlanDays, decodePlanEntry, encodePlanEntry, normalizeWeeklyPlan,
  removePlanEntry, weekIdFor,
  type PlanEntry,
} from "./plans";

const entry: PlanEntry = { kind: "activity", itemId: "scoop-and-pour", childId: "mila" };

describe("weekly care plans", () => {
  it("uses ISO week IDs across year boundaries", () => {
    expect(weekIdFor(new Date("2026-12-31T12:00:00.000Z"))).toBe("2026-W53");
    expect(weekIdFor(new Date("2027-01-01T12:00:00.000Z"))).toBe("2026-W53");
    expect(weekIdFor(new Date("2027-01-04T12:00:00.000Z"))).toBe("2027-W01");
  });

  it("encodes and decodes child-specific activity and meal entries", () => {
    const encoded = encodePlanEntry(entry);
    expect(decodePlanEntry(encoded)).toEqual(entry);
    expect(decodePlanEntry(encodePlanEntry({ kind: "meal", itemId: "apple-oat-porridge", childId: "theo" })))
      .toEqual({ kind: "meal", itemId: "apple-oat-porridge", childId: "theo" });
  });

  it("keeps unknown saved entries visible as plain notes", () => {
    expect(decodePlanEntry("Family walk")).toEqual({ kind: "other", label: "Family walk" });
  });

  it("adds without duplicates and removes by day and position", () => {
    const empty = buildEmptyPlanDays();
    const monday = addPlanEntry(empty, "Mon", entry);
    expect(monday.Mon).toEqual([encodePlanEntry(entry)]);
    expect(addPlanEntry(monday, "Mon", entry)).toBe(monday);
    expect(removePlanEntry(monday, "Mon", 0).Mon).toEqual([]);
    expect(monday.Tue).toEqual([]);
  });

  it("fills every weekday and drops invalid day keys when loading old data", () => {
    expect(normalizeWeeklyPlan({ days: { Mon: [encodePlanEntry(entry)], Funday: ["bad"] }, approvedBy: "parent" })).toEqual({
      days: { Mon: [encodePlanEntry(entry)], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] },
      approvedBy: "parent",
    });
  });
});
