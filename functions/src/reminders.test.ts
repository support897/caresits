import { describe, expect, it } from "vitest";
import { buildBookingReminders, BOOKING_REMINDER_LEAD_MS, BOOKING_REMINDER_WINDOW_MS, type ReminderBooking } from "./reminders.js";

const booking = (patch: Partial<ReminderBooking> = {}): ReminderBooking => ({
  id: "book-1",
  pairId: "family-1_carer-1",
  familyUid: "family-1",
  carerUid: "carer-1",
  date: "2026-11-05",
  from: "10:00",
  state: "accepted",
  ...patch,
});

describe("24-hour booking reminders", () => {
  const dueAt = new Date("2026-11-04T00:00:00.000Z");

  it("creates one calm, unread notification for each booking member", () => {
    const reminders = buildBookingReminders([booking()], dueAt);
    expect(reminders).toHaveLength(2);
    expect(reminders.map((row) => row.path)).toEqual([
      expect.stringMatching(/^users\/family-1\/notifications\/booking-24h-/),
      expect.stringMatching(/^users\/carer-1\/notifications\/booking-24h-/),
    ]);
    for (const reminder of reminders) {
      expect(reminder.data).toMatchObject({
        category: "booking-reminders",
        title: "Booking reminder",
        body: expect.stringMatching(/^A booking is scheduled for /),
        at: dueAt,
        read: false,
      });
      expect(reminder.data.body).not.toMatch(/urgent|hurry|last chance|limited/i);
      expect(reminder.sourcePath).toBe("relationships/family-1_carer-1/bookings/book-1");
    }
  });

  it("includes only accepted bookings in the due 24-hour window", () => {
    const notAccepted = ["requested", "declined", "cancelled", "completed"].map((state) => booking({ id: state, state }));
    expect(buildBookingReminders(notAccepted, dueAt)).toEqual([]);
    expect(buildBookingReminders([booking()], new Date(dueAt.getTime() - 1))).toEqual([]);
    expect(buildBookingReminders([booking()], new Date(dueAt.getTime() + BOOKING_REMINDER_WINDOW_MS + 1))).toEqual([]);
    expect(buildBookingReminders([booking()], new Date(dueAt.getTime() + BOOKING_REMINDER_WINDOW_MS))).toHaveLength(2);
  });

  it("uses exactly 24 hours before the booking start and keeps ids stable", () => {
    const reminders = buildBookingReminders([booking()], dueAt);
    const localStart = new Date("2026-11-05T00:00:00.000Z");
    expect(localStart.getTime() - BOOKING_REMINDER_LEAD_MS).toBe(dueAt.getTime());
    expect(buildBookingReminders([booking()], dueAt).map((row) => row.path)).toEqual(reminders.map((row) => row.path));
  });

  it("skips malformed bookings, self-pairs, invalid dates, and invalid time zones", () => {
    const invalid = [
      booking({ state: "requested" }),
      booking({ id: "" }),
      booking({ pairId: "bad/path" }),
      booking({ familyUid: "same", carerUid: "same" }),
      booking({ date: "2026-02-31" }),
      booking({ from: "25:00" }),
      booking({ timeZone: "No/Such_Zone" }),
    ];
    expect(buildBookingReminders(invalid, dueAt)).toEqual([]);
  });

  it("supports explicit time zones and drops nonexistent daylight-saving wall times", () => {
    const melbourne = booking({ date: "2026-11-06", from: "10:00", timeZone: "Australia/Melbourne" });
    expect(buildBookingReminders([melbourne], new Date("2026-11-04T23:00:00.000Z"))).toHaveLength(2);
    const gap = booking({ date: "2026-10-04", from: "02:30", timeZone: "Australia/Melbourne" });
    expect(buildBookingReminders([gap], new Date("2026-10-02T15:30:00.000Z"))).toEqual([]);
  });

  it("returns no writes for invalid clocks or windows", () => {
    expect(buildBookingReminders([booking()], new Date(Number.NaN))).toEqual([]);
    expect(buildBookingReminders([booking()], dueAt, 0)).toEqual([]);
  });
});
