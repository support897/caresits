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

import { calendarDaysForPeriod, createCalendarEvent, localDateKey, saveCalendarEvent, shiftCalendarMonth, type CalendarEvent } from "./calendar";

describe("calendar date ranges", () => {
  it("returns selected day and Sunday-to-Saturday week ranges", () => {
    expect(calendarDaysForPeriod("2026-11-04", "day").map((day) => day.key)).toEqual(["2026-11-04"]);
    expect(calendarDaysForPeriod("2026-11-04", "week").map((day) => day.key)).toEqual([
      "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07",
    ]);
  });

  it("returns no days for an invalid date", () => {
    expect(calendarDaysForPeriod("not-a-day", "week")).toEqual([]);
  });

  it("formats dates from the local calendar fields for event forms", () => {
    expect(localDateKey(new Date(2026, 10, 4, 23, 30))).toBe("2026-11-04");
  });

  it("moves calendar selection with month navigation and clamps long months", () => {
    expect(shiftCalendarMonth("2026-03-31", -1)).toBe("2026-02-28");
    expect(shiftCalendarMonth("2024-01-31", 1)).toBe("2024-02-29");
    expect(shiftCalendarMonth("not-a-day", 1)).toBe("not-a-day");
  });
});

describe("calendar offline writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeSpaceDocument.mockResolvedValue({ queued: true });
  });

  it("returns queued status to the caller without storing it in the calendar document", async () => {
    const created = await createCalendarEvent("family-1", {
      title: "School pickup",
      kind: "pickup",
      start: "2026-11-04T07:00:00.000Z",
      end: "2026-11-04T07:30:00.000Z",
      ownerUid: "carer-1",
      state: "active",
    });
    expect(created.queued).toBe(true);
    expect(writeSpaceDocument).toHaveBeenCalledWith(expect.objectContaining({
      path: `careSpaces/family-1/calendar/${created.id}`,
      method: "set",
      data: expect.not.objectContaining({ queued: true }),
    }));
  });

  it("strips a local queued marker when saving a calendar event", async () => {
    const event: CalendarEvent = {
      id: "event-1", spaceId: "family-1", title: "Shift", kind: "shift",
      start: "2026-11-04T07:00:00.000Z", end: "2026-11-04T15:00:00.000Z",
      ownerUid: "carer-1", state: "active", queued: true,
    };
    await saveCalendarEvent("family-1", event);
    expect(writeSpaceDocument).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ queued: true }),
    }));
  });
});
