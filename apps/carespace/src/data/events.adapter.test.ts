import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveCalendarEvent } = vi.hoisted(() => ({ saveCalendarEvent: vi.fn() }));
vi.mock("./calendar", () => ({ saveCalendarEvent }));

import { createShiftEvent } from "./events";

describe("shift event writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveCalendarEvent.mockResolvedValue({ queued: false });
  });

  it("stores recurrence through the existing calendar writer", async () => {
    const saved = await createShiftEvent("family-1", {
      id: "shift-1",
      title: "Morning care",
      start: "2026-11-02T09:00:00.000Z",
      end: "2026-11-02T13:00:00.000Z",
      ownerUid: "carer-1",
      recurring: { weekdays: ["Mon", "Wed"], until: "2026-11-30" },
    });
    expect(saveCalendarEvent).toHaveBeenCalledWith("family-1", expect.objectContaining({
      id: "shift-1",
      kind: "shift",
      state: "active",
      recurring: { weekdays: ["Mon", "Wed"], until: "2026-11-30" },
    }));
    expect(saved.queued).toBe(false);
  });
});
