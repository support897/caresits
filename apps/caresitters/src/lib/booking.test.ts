import { describe, expect, it } from "vitest";
import {
  BOOKING_REQUEST_TAP_STEPS,
  MAX_PROFILE_TO_REQUEST_TAPS,
  canTransitionBooking,
  checkAvailability,
  estimateCost,
  bookingAcceptanceRelationshipPatch,
  bookingUpdateFor,
  canRequestOnExistingRelationship,
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

  it("keeps cancellation writes within the Firestore rule allowlist", () => {
    expect(bookingUpdateFor("cancelled", "server-time")).toEqual({ state: "cancelled" });
    expect(bookingUpdateFor("accepted", "server-time")).toEqual({ state: "accepted", decidedAt: "server-time" });
    expect(bookingUpdateFor("declined", "server-time")).toEqual({ state: "declined", decidedAt: "server-time" });
  });

  it("keeps the profile-to-request path within five taps", () => {
    expect(BOOKING_REQUEST_TAP_STEPS).toHaveLength(5);
    expect(BOOKING_REQUEST_TAP_STEPS.length).toBeLessThanOrEqual(MAX_PROFILE_TO_REQUEST_TAPS);
  });

  it("allows another booking only on a matching, open relationship", () => {
    const relationship = { familyUid: "family", carerUid: "carer", members: ["family", "carer"], state: "contact" };
    expect(canRequestOnExistingRelationship(relationship, "family", "carer")).toBe(true);
    expect(canRequestOnExistingRelationship({ ...relationship, state: "pending" }, "family", "carer")).toBe(false);
    expect(canRequestOnExistingRelationship({ ...relationship, state: "ended" }, "family", "carer")).toBe(false);
    expect(canRequestOnExistingRelationship({ ...relationship, members: ["family"] }, "family", "carer")).toBe(false);
    expect(canRequestOnExistingRelationship({ ...relationship, carerUid: "other" }, "family", "carer")).toBe(false);
  });

  it("opens the relationship only when the carer accepts the family's first request", () => {
    const pending = { familyUid: "family", carerUid: "carer", members: ["family", "carer"], state: "pending", createdBy: "family" };
    expect(bookingAcceptanceRelationshipPatch(pending, "family", "carer", "carer")).toEqual({ state: "contact", contactBy: "carer" });
    expect(bookingAcceptanceRelationshipPatch(pending, "family", "carer", "family")).toBeNull();
    expect(bookingAcceptanceRelationshipPatch({ ...pending, createdBy: "carer" }, "family", "carer", "carer")).toBeNull();
    expect(bookingAcceptanceRelationshipPatch({ ...pending, state: "contact" }, "family", "carer", "carer")).toBeNull();
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
