import { describe, expect, it, vi } from "vitest";
import type { BookingSlot } from "../../packages/core/src/schemas/availability.js";
import {
  applyBookingDecision,
  BookingDecisionError,
  bookingDecide,
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


describe("instant booking decision", () => {
  const carerCard = { instantBook: true };
  const familyProfile = { side: "family", card: { kids: [{ name: "Child", ageYears: 2 }] } };
  const request = { id: "new", date: "2026-11-05", from: "10:00", to: "12:00" };

  it("accepts only an opted-in carer and a family profile with every child age", () => {
    expect(bookingDecide(carerCard, familyProfile, [], request)).toBe("accept");
    expect(bookingDecide({ instantBook: false }, familyProfile, [], request)).toBe("leave");
    expect(bookingDecide({}, familyProfile, [], request)).toBe("leave");
    expect(bookingDecide(carerCard, null, [], request)).toBe("leave");
    expect(bookingDecide(carerCard, { side: "carer", card: familyProfile.card }, [], request)).toBe("leave");
    expect(bookingDecide(carerCard, { side: "family", card: { kids: [] } }, [], request)).toBe("leave");
    expect(bookingDecide(carerCard, { side: "family", card: { kids: [{ name: "Child" }] } }, [], request)).toBe("leave");
    expect(bookingDecide(carerCard, { side: "family", card: { kids: [{ ageYears: "2" }] } }, [], request)).toBe("leave");
    expect(bookingDecide(carerCard, { side: "family", card: { kids: [{ ageYears: -1 }] } }, [], request)).toBe("leave");
    expect(bookingDecide(carerCard, { side: "family", card: { kids: [{ ageYears: 18.5 }] } }, [], request)).toBe("leave");
    expect(bookingDecide(carerCard, { side: "family", card: { kids: [{ ageYears: 1 }, { ageYears: null }] } }, [], request)).toBe("leave");
  });

  it("leaves overlapping requested or accepted bookings and accepts clear or inactive slots", () => {
    const booking = (state: BookingSlot["state"], from = "11:00", to = "13:00", date = request.date): BookingSlot => ({ state, from, to, date });
    expect(bookingDecide(carerCard, familyProfile, [booking("requested")], request)).toBe("leave");
    expect(bookingDecide(carerCard, familyProfile, [booking("accepted")], request)).toBe("leave");
    expect(bookingDecide(carerCard, familyProfile, [booking("accepted", "12:00", "13:00")], request)).toBe("accept");
    expect(bookingDecide(carerCard, familyProfile, [booking("accepted", "09:00", "10:00")], request)).toBe("accept");
    expect(bookingDecide(carerCard, familyProfile, [booking("accepted", "11:00", "13:00", "2026-11-06")], request)).toBe("accept");
    for (const state of ["declined", "cancelled", "completed"] as const) {
      expect(bookingDecide(carerCard, familyProfile, [booking(state)], request)).toBe("accept");
    }
  });

  it("fails closed for invalid dates and times", () => {
    expect(bookingDecide(carerCard, familyProfile, [], { ...request, date: "2026-02-31" })).toBe("leave");
    expect(bookingDecide(carerCard, familyProfile, [], { ...request, from: "24:00" })).toBe("leave");
    expect(bookingDecide(carerCard, familyProfile, [], { ...request, to: "10:00" })).toBe("leave");
    expect(bookingDecide(carerCard, familyProfile, [], { ...request, to: "09:00" })).toBe("leave");
  });
});
