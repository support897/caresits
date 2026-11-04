import { describe, expect, it } from "vitest";
import { applyTimeOffActionToEvents, transitionTimeOff, type CalendarEventRecord } from "./timeoff";

const request: CalendarEventRecord = {
  id: "off-1", kind: "timeoff", state: "requested", start: "2026-11-08T09:00:00.000Z", end: "2026-11-08T17:00:00.000Z",
};

describe("time-off state machine", () => {
  it("builds valid single-day, multi-day, and full-day periods", async () => {
    const { buildTimeOffPeriod } = await import("./timeoff");
    const single = buildTimeOffPeriod("2026-11-08", "2026-11-08", "09:00", "17:00");
    const multi = buildTimeOffPeriod("2026-11-08", "2026-11-10", "09:00", "17:00");
    const fullDay = buildTimeOffPeriod("2026-11-08", "2026-11-09", "09:00", "17:00", true);
    expect(Date.parse(single.end)).toBeGreaterThan(Date.parse(single.start));
    expect(Date.parse(multi.end)).toBeGreaterThan(Date.parse(single.end));
    expect(Date.parse(fullDay.end) - Date.parse(fullDay.start)).toBeGreaterThanOrEqual(47 * 60 * 60 * 1000);
    expect(() => buildTimeOffPeriod("2026-11-10", "2026-11-08", "09:00", "17:00")).toThrow();
    expect(() => buildTimeOffPeriod("2026-11-08", "2026-11-08", "17:00", "09:00")).toThrow();
  });

  it("identifies only overlapping bookings and shifts without changing them", async () => {
    const { findAffectedScheduleEvents } = await import("./timeoff");
    const rows: CalendarEventRecord[] = [
      { id: "booking", kind: "booking", state: "active", start: "2026-11-08T10:00:00.000Z", end: "2026-11-08T12:00:00.000Z" },
      { id: "shift", kind: "shift", state: "active", start: "2026-11-08T16:00:00.000Z", end: "2026-11-08T18:00:00.000Z" },
      { id: "later", kind: "shift", state: "active", start: "2026-11-08T18:00:00.000Z", end: "2026-11-08T19:00:00.000Z" },
      { id: "declined", kind: "booking", state: "declined", start: "2026-11-08T11:00:00.000Z", end: "2026-11-08T12:00:00.000Z" },
      { id: "another-timeoff", kind: "timeoff", state: "requested", start: "2026-11-08T11:00:00.000Z", end: "2026-11-08T12:00:00.000Z" },
    ];
    expect(findAffectedScheduleEvents("2026-11-08T11:00:00.000Z", "2026-11-08T17:00:00.000Z", rows).map((event) => event.id)).toEqual(["booking", "shift"]);
  });
  it("lets only a family admin approve, decline, or propose a valid swap", () => {
    expect(transitionTimeOff(request, "approve", "admin").state).toBe("approved");
    expect(transitionTimeOff(request, "decline", "admin").state).toBe("declined");
    expect(transitionTimeOff(request, "swap", "admin", {
      start: "2026-11-09T09:00:00.000Z", end: "2026-11-09T17:00:00.000Z",
    })).toMatchObject({ state: "swap", swap: { start: "2026-11-09T09:00:00.000Z" } });
    expect(() => transitionTimeOff(request, "approve", "regular")).toThrow();
    expect(() => transitionTimeOff(request, "swap", "admin", {
      start: "2026-11-09T17:00:00.000Z", end: "2026-11-09T09:00:00.000Z",
    })).toThrow();
  });

  it("does not cancel, remove, or change a booking when time off is decided", () => {
    const booking: CalendarEventRecord = {
      id: "booking-1", kind: "booking", state: "accepted", start: request.start, end: request.end, ownerUid: "carer",
    };
    const after = applyTimeOffActionToEvents([booking, request], "off-1", "approve", "admin");
    expect(after).toHaveLength(2);
    expect(after[0]).toEqual(booking);
    expect(after[0]?.state).toBe("accepted");
    expect(after[1]?.state).toBe("approved");
  });
});
