import { describe, expect, it } from "vitest";
import { canEditChildDetails, normalizeChildMilestones, normalizeChildRoutine, parseChildList } from "./children";

describe("structured child profile data", () => {
  it("cleans food and learning lists without duplicates or empty items", () => {
    expect(parseChildList(" Oats, fruit\nfruit,  Toast ", 30, 120)).toEqual(["Oats", "fruit", "Toast"]);
    expect(parseChildList("one,two,three", 2, 20)).toEqual(["one", "two"]);
  });

  it("keeps only valid wake, bed, and nap times", () => {
    expect(normalizeChildRoutine({
      wake: "07:15", bed: "19:30", naps: [{ from: "12:30", to: "13:45" }, { from: "25:00", to: "14:00" }, { from: "11:00", to: "noon" }],
    })).toEqual({ wake: "07:15", bed: "19:30", naps: [{ from: "12:30", to: "13:45" }] });
    expect(normalizeChildRoutine({ wake: "7am", bed: null, naps: [] })).toEqual({ naps: [] });
  });

  it("normalizes stored milestone dates and drops malformed entries", () => {
    expect(normalizeChildMilestones([
      { title: "First steps", at: { seconds: 1_700_000_000, nanoseconds: 0 }, note: "At home", photoKey: "spaces/s1/gallery/photo.jpg" },
      { title: "Missing date" },
      { title: "", at: new Date("2026-01-01T00:00:00.000Z") },
    ])).toEqual([{
      title: "First steps", at: new Date(1_700_000_000_000), note: "At home", photoKey: "spaces/s1/gallery/photo.jpg",
    }]);
  });

  it("allows only admins to edit structured child details", () => {
    expect(canEditChildDetails("admin")).toBe(true);
    expect(canEditChildDetails("regular")).toBe(false);
    expect(canEditChildDetails("limited")).toBe(false);
    expect(canEditChildDetails("viewer")).toBe(false);
  });
});
