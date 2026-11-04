import { describe, expect, it, vi } from "vitest";
import {
  applyBookingDecision,
  BookingDecisionError,
  type BookingDecisionStore,
  type BookingRecord,
} from "./bookingDecide.js";

const record = (state: BookingRecord["state"] = "requested"): BookingRecord => ({
  familyUid: "family-1",
  carerUid: "carer-1",
  state,
});

function fakeStore(current: BookingRecord | undefined) {
  const updates: Array<{ path: string; patch: Record<string, unknown> }> = [];
  const store: BookingDecisionStore = {
    get: vi.fn(async () => current),
    update: vi.fn(async (path, patch) => { updates.push({ path, patch }); }),
  };
  return { store, updates };
}

describe("booking decision state machine", () => {
  it("lets only the carer accept a request", async () => {
    const { store, updates } = fakeStore(record());
    await expect(applyBookingDecision(store, "relationships/p/bookings/b", "family-1", "accepted", "now"))
      .rejects.toMatchObject({ code: "permission-denied" });
    await expect(applyBookingDecision(store, "relationships/p/bookings/b", "carer-1", "accepted", "now"))
      .resolves.toEqual({ state: "accepted", decidedAt: "now" });
    expect(updates).toHaveLength(1);
  });

  it("lets the carer decline a request", async () => {
    const { store } = fakeStore(record());
    await expect(applyBookingDecision(store, "b", "carer-1", "declined", "stamp"))
      .resolves.toEqual({ state: "declined", decidedAt: "stamp" });
  });

  it("lets either booking member cancel requested or accepted bookings", async () => {
    for (const [actor, state] of [["family-1", "requested"], ["carer-1", "accepted"]] as const) {
      const { store } = fakeStore(record(state));
      await expect(applyBookingDecision(store, "b", actor, "cancelled", "stamp"))
        .resolves.toEqual({ state: "cancelled" });
    }
  });

  it("rejects outsiders, repeated decisions, and missing bookings", async () => {
    const { store } = fakeStore(record("accepted"));
    await expect(applyBookingDecision(store, "b", "other", "cancelled", "stamp"))
      .rejects.toBeInstanceOf(BookingDecisionError);
    await expect(applyBookingDecision(store, "b", "carer-1", "declined", "stamp"))
      .rejects.toMatchObject({ code: "failed-precondition" });
    const empty = fakeStore(undefined);
    await expect(applyBookingDecision(empty.store, "b", "carer-1", "accepted", "stamp"))
      .rejects.toMatchObject({ code: "not-found" });
  });
});
