import { onSchedule } from "firebase-functions/v2/scheduler";
import { notificationSchema, type AppNotification } from "../../packages/core/src/schemas/index.js";
import { adminDb } from "./admin.js";

export const BOOKING_REMINDER_WINDOW_MS = 15 * 60 * 1_000;
export const BOOKING_REMINDER_LEAD_MS = 24 * 60 * 60 * 1_000;
export const DEFAULT_BOOKING_TIME_ZONE = "Australia/Brisbane";

export type ReminderBooking = {
  id: string;
  pairId: string;
  familyUid: string;
  carerUid: string;
  date: string;
  from: string;
  state: string;
  timeZone?: string;
};

export type BookingReminderWrite = {
  path: string;
  sourcePath: string;
  data: AppNotification;
};

function userPathSegment(value: string): boolean {
  return value.length > 0 && value.length <= 256 && !value.includes("/");
}

function localDateTimeMillis(date: string, time: string, timeZone: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  const validCalendarDate = new Date(wallTime).toISOString().slice(0, 10) === date;
  if (!validCalendarDate) return null;

  try {
    const formatter = new Intl.DateTimeFormat("en-AU", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    let candidate = wallTime;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]));
      const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
      candidate += wallTime - represented;
    }
    const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]));
    return parts.year === dateMatch[1] && parts.month === dateMatch[2] && parts.day === dateMatch[3]
      && parts.hour === timeMatch[1] && parts.minute === timeMatch[2] ? candidate : null;
  } catch {
    return null;
  }
}

function reminderId(booking: ReminderBooking, uid: string): string {
  return `booking-24h-${encodeURIComponent(booking.pairId)}-${encodeURIComponent(booking.id)}-${encodeURIComponent(uid)}`;
}

function reminderDateText(startMillis: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(startMillis));
}

/** Build idempotent notification writes for accepted bookings whose 24-hour point is due. */
export function buildBookingReminders(
  bookings: readonly ReminderBooking[],
  now: Date,
  windowMs = BOOKING_REMINDER_WINDOW_MS,
  defaultTimeZone = DEFAULT_BOOKING_TIME_ZONE,
): BookingReminderWrite[] {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs) || !Number.isFinite(windowMs) || windowMs <= 0) return [];
  const reminders: BookingReminderWrite[] = [];
  for (const booking of bookings) {
    if (booking.state !== "accepted" || !userPathSegment(booking.id) || !userPathSegment(booking.pairId)) continue;
    if (!userPathSegment(booking.familyUid) || !userPathSegment(booking.carerUid) || booking.familyUid === booking.carerUid) continue;
    const timeZone = booking.timeZone || defaultTimeZone;
    const startMillis = localDateTimeMillis(booking.date, booking.from, timeZone);
    if (startMillis === null) continue;
    const reminderMillis = startMillis - BOOKING_REMINDER_LEAD_MS;
    if (reminderMillis < nowMs - windowMs || reminderMillis > nowMs) continue;

    const when = reminderDateText(startMillis, timeZone);
    const data = notificationSchema.parse({
      category: "booking-reminders",
      title: "Booking reminder",
      body: `A booking is scheduled for ${when}.`,
      at: new Date(nowMs),
      read: false,
    });
    const sourcePath = `relationships/${booking.pairId}/bookings/${booking.id}`;
    for (const uid of new Set([booking.familyUid, booking.carerUid])) {
      reminders.push({
        path: `users/${uid}/notifications/${reminderId(booking, uid)}`,
        sourcePath,
        data,
      });
    }
  }
  return reminders;
}

export const writeBookingReminders = onSchedule(
  { schedule: "every 15 minutes", timeZone: DEFAULT_BOOKING_TIME_ZONE },
  async () => {
    const db = adminDb();
    const snapshots = await db.collectionGroup("bookings").where("state", "==", "accepted").get();
    const bookings: ReminderBooking[] = snapshots.docs.flatMap((snapshot) => {
      const value = snapshot.data();
      const pairId = snapshot.ref.parent.parent?.id ?? "";
      if (!pairId || typeof value.familyUid !== "string" || typeof value.carerUid !== "string"
        || typeof value.date !== "string" || typeof value.from !== "string") return [];
      return [{
        id: snapshot.id,
        pairId,
        familyUid: value.familyUid,
        carerUid: value.carerUid,
        date: value.date,
        from: value.from,
        state: String(value.state ?? ""),
        ...(typeof value.timeZone === "string" ? { timeZone: value.timeZone } : {}),
      }];
    });
    const due = buildBookingReminders(bookings, new Date());
    await Promise.all(due.map(async (reminder) => {
      const notificationRef = db.doc(reminder.path);
      const bookingRef = db.doc(reminder.sourcePath);
      await db.runTransaction(async (transaction) => {
        const booking = await transaction.get(bookingRef);
        if (!booking.exists || booking.get("state") !== "accepted") return;
        const existing = await transaction.get(notificationRef);
        if (!existing.exists) transaction.create(notificationRef, reminder.data);
      });
    }));
  },
);
