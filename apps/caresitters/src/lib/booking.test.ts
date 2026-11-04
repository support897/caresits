import { describe, expect, it } from "vitest";
import {
  BOOKING_REQUEST_TAP_STEPS,
  MAX_PROFILE_TO_REQUEST_TAPS,
  canTransitionBooking,
  checkAvailability,
  estimateCost,
  pairIdFor,
  planContact,
} from "./booking";

describe("booking logic", () => {
  it("estimates cost from hours and hourly rate", () => {
    expect(estimateCost("09:30", "13:00", 28)).toBe(98);
    expect(estimateCost("18:00", "20:15", 32.5)).toBe(73.13);
  });

  it("rejects invalid times and rates", () => {
    expect(estimateCost("13:00", "09:00", 30)).toBeNull();
    expect(estimateCost("09:00", "09:00", 30)).toBeNull();
    expect(estimateCost("09:00", "10:00", -1)).toBeNull();
  });

  it("returns selected weekdays that conflict with a shared schedule", () => {
    expect(checkAvailability({ Mon: true, Tue: false, Wed: true }, ["Mon", "Tue", "Wed"])).toEqual(["Tue"]);
    expect(checkAvailability(["Mon", "Fri"], ["Mon", "Wed"])).toEqual(["Wed"]);
    expect(checkAvailability({ Monday: true, Wednesday: true }, ["Mon", "Wed"])).toEqual([]);
    expect(checkAvailability({}, ["Mon", "Wed"])).toEqual([]);
  });

  it("keeps the booking state machine role-safe", () => {
    expect(canTransitionBooking("requested", "accepted", "carer")).toBe(true);
    expect(canTransitionBooking("requested", "accepted", "family")).toBe(false);
    expect(canTransitionBooking("requested", "declined", "carer")).toBe(true);
    expect(canTransitionBooking("requested", "cancelled", "family")).toBe(true);
    expect(canTransitionBooking("accepted", "completed", "carer")).toBe(true);
    expect(canTransitionBooking("completed", "accepted", "carer")).toBe(false);
  });

  it("keeps the profile-to-request path within five taps", () => {
    expect(BOOKING_REQUEST_TAP_STEPS).toHaveLength(5);
    expect(BOOKING_REQUEST_TAP_STEPS.length).toBeLessThanOrEqual(MAX_PROFILE_TO_REQUEST_TAPS);
  });

  it("ports sorted relationship ids and the contact plan", () => {
    expect(pairIdFor("z", "a")).toBe("a_z");
    expect(planContact({ familyUid: "family", carerUid: "carer", createdBy: "family", nowIso: "2026-01-01T00:00:00.000Z", createdDay: "2026-01-01", profileComplete: true })).toMatchObject({
      ok: true,
      path: "relationships/carer_family",
      data: { members: ["carer", "family"], familyUid: "family", carerUid: "carer", state: "pending", createdBy: "family" },
    });
    expect(planContact({ familyUid: "family", carerUid: "carer", createdBy: "family", nowIso: "", createdDay: "", profileComplete: false })).toMatchObject({ ok: false, reason: "profile-incomplete" });
  });
});
