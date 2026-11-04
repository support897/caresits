import { describe, expect, it } from "vitest";
import {
  buildShiftCalendarEvent,
  expandCalendarEventsForRange,
  findShiftWarnings,
  type CalendarEventWithRecurrence,
} from "./events";

const recurringShift: CalendarEventWithRecurrence = {
  id: "shift-1",
  title: "Morning care",
  kind: "shift",
  start: "2026-11-02T09:00:00.000Z",
  end: "2026-11-02T13:00:00.000Z",
  ownerUid: "carer-1",
  state: "active",
  recurring: { weekdays: ["Mon", "Wed"], until: "2026-11-11" },
};

describe("recurring calendar shifts", () => {
  it("expands weekday instances through the inclusive until date", () => {
    const instances = expandCalendarEventsForRange([recurringShift], "2026-11-02", "2026-11-15");
    expect(instances.map((event) => event.occurrenceDate)).toEqual([
      "2026-11-02", "2026-11-04", "2026-11-09", "2026-11-11",
    ]);
  });

  it("keeps a non-recurring event on its one date", () => {
    const single = { ...recurringShift, start: "2026-11-04T09:00:00.000Z", end: "2026-11-04T13:00:00.000Z", recurring: undefined };
    expect(expandCalendarEventsForRange([single], "2026-11-03", "2026-11-04").map((event) => event.occurrenceDate))
      .toEqual(["2026-11-04"]);
  });

  it("rejects an invalid date or empty recurrence", () => {
    expect(() => buildShiftCalendarEvent({
      title: "Shift", start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T13:00:00.000Z", ownerUid: "carer-1",
      recurring: { weekdays: ["Mon"], until: "2026-02-31" },
    })).toThrow("invalid-recurrence");
    expect(() => buildShiftCalendarEvent({
      title: "Shift", start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T13:00:00.000Z", ownerUid: "carer-1",
      recurring: { weekdays: [], until: "2026-11-30" },
    })).toThrow("invalid-recurrence");
  });

  it("returns overlap warnings without changing or rejecting the shift", () => {
    const candidate = buildShiftCalendarEvent({
      id: "candidate",
      title: "New shift",
      start: "2026-11-02T11:00:00.000Z",
      end: "2026-11-02T14:00:00.000Z",
      ownerUid: "carer-1",
      recurring: { weekdays: ["Mon"], until: "2026-11-30" },
    });
    const existing: CalendarEventWithRecurrence[] = [{
      id: "other-shift",
      title: "Existing shift",
      kind: "shift",
      start: "2026-11-09T12:00:00.000Z",
      end: "2026-11-09T15:00:00.000Z",
      ownerUid: "carer-1",
      state: "active",
    }];
    expect(findShiftWarnings(candidate, existing)).toEqual([{
      id: "other-shift",
      start: Date.parse("2026-11-09T12:00:00.000Z"),
      end: Date.parse("2026-11-09T14:00:00.000Z"),
      eventTitle: "Existing shift",
    }]);
    expect(candidate.state).toBe("active");
  });
});
