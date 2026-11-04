import { describe, expect, it } from "vitest";
import { findBookingConflicts, findShiftConflicts } from "./availability.js";

describe("availability conflict helpers", () => {
  it("finds overlapping active and requested bookings, but not touching or declined slots", () => {
    const conflicts = findBookingConflicts(
      { date: "2026-11-09", from: "10:00", to: "12:00" },
      [
        { id: "overlap", date: "2026-11-09", from: "11:30", to: "13:00", state: "accepted" },
        { id: "touch", date: "2026-11-09", from: "12:00", to: "13:00", state: "requested" },
        { id: "old", date: "2026-11-09", from: "10:30", to: "11:00", state: "declined" },
        { id: "other-day", date: "2026-11-10", from: "10:30", to: "11:00", state: "accepted" },
      ],
    );
    expect(conflicts).toEqual([{ kind: "booking", id: "overlap", date: "2026-11-09", from: "11:30", to: "13:00" }]);
  });

  it("finds weekly series occurrences only inside date and weekday bounds", () => {
    const series = [{ id: "monday", weekdays: ["Mon" as const], from: "09:00", to: "11:00", startDate: "2026-11-02", endDate: "2026-11-30", state: "active" as const }];
    expect(findBookingConflicts({ date: "2026-11-09", from: "10:00", to: "12:00" }, [], series)).toHaveLength(1);
    expect(findBookingConflicts({ date: "2026-11-10", from: "10:00", to: "12:00" }, [], series)).toHaveLength(0);
    expect(findBookingConflicts({ date: "2026-12-07", from: "10:00", to: "12:00" }, [], series)).toHaveLength(0);
  });

  it("ignores malformed date and time values", () => {
    expect(findBookingConflicts({ date: "2026-02-31", from: "09:00", to: "12:00" }, [], [])).toEqual([]);
    expect(findBookingConflicts({ date: "2026-11-09", from: "12:00", to: "10:00" }, [], [])).toEqual([]);
  });

  it("finds direct and recurring calendar shift overlaps", () => {
    const candidate = { id: "candidate", start: "2026-11-09T09:00:00.000Z", end: "2026-11-09T12:00:00.000Z", state: "active" as const };
    const events = [
      { ...candidate },
      { id: "other", start: "2026-11-09T11:00:00.000Z", end: "2026-11-09T13:00:00.000Z", state: "approved" as const },
    ];
    expect(findShiftConflicts(candidate, events)).toEqual([{ id: "other", start: Date.parse("2026-11-09T11:00:00.000Z"), end: Date.parse("2026-11-09T12:00:00.000Z") }]);

    const recurring = { id: "weekly", start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T11:00:00.000Z", state: "active" as const, recurring: { weekdays: ["Mon" as const], until: "2026-11-30" } };
    const monday = { id: "later", start: "2026-11-16T10:00:00.000Z", end: "2026-11-16T12:00:00.000Z", state: "requested" as const };
    expect(findShiftConflicts(monday, [recurring])).toHaveLength(1);
  });

  it("does not warn for inactive calendar rows", () => {
    const candidate = { start: "2026-11-09T09:00:00Z", end: "2026-11-09T12:00:00Z", state: "active" as const };
    const previous = { start: "2026-11-09T10:00:00Z", end: "2026-11-09T11:00:00Z", state: "declined" as const };
    expect(findShiftConflicts(candidate, [previous])).toEqual([]);
  });
});
