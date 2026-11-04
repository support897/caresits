import { describe, expect, it } from "vitest";
import { applyTimeOffActionToEvents, transitionTimeOff, type CalendarEventRecord } from "./timeoff";

const request: CalendarEventRecord = {
  id: "off-1", kind: "timeoff", state: "requested", start: "2026-11-08T09:00:00.000Z", end: "2026-11-08T17:00:00.000Z",
};

describe("time-off state machine", () => {
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
