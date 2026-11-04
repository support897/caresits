import type { BookingSeries, CalendarEvent } from "./index.js";

export type BookingSlot = {
  id?: string;
  date: string;
  from: string;
  to: string;
  state: "requested" | "accepted" | "declined" | "cancelled" | "completed";
};

export type BookingSeriesSlot = Pick<BookingSeries, "weekdays" | "from" | "to" | "startDate" | "endDate" | "state"> & { id?: string };
export type BookingClash = { kind: "booking" | "series"; id?: string; date: string; from: string; to: string };

const activeBookingStates = new Set(["requested", "accepted"]);
const activeSeriesStates = new Set(["requested", "active"]);
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function minuteOfDay(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function weekday(date: string): string | null {
  if (!validDate(date)) return null;
  return dayNames[new Date(`${date}T00:00:00.000Z`).getUTCDay()] ?? null;
}

function rangesOverlap(fromA: string, toA: string, fromB: string, toB: string): boolean {
  const a0 = minuteOfDay(fromA);
  const a1 = minuteOfDay(toA);
  const b0 = minuteOfDay(fromB);
  const b1 = minuteOfDay(toB);
  return a0 !== null && a1 !== null && b0 !== null && b1 !== null
    && a1 > a0 && b1 > b0 && a0 < b1 && b0 < a1;
}

/** Finds same-day booking and weekly-series overlaps. No network or clock reads. */
export function findBookingConflicts(
  candidate: { id?: string; date: string; from: string; to: string },
  bookings: readonly BookingSlot[],
  series: readonly BookingSeriesSlot[] = [],
): BookingClash[] {
  if (!validDate(candidate.date) || !rangesOverlap(candidate.from, candidate.to, candidate.from, candidate.to)) return [];
  const clashes: BookingClash[] = [];
  for (const booking of bookings) {
    if (booking.id === candidate.id || booking.date !== candidate.date || !activeBookingStates.has(booking.state)) continue;
    if (rangesOverlap(candidate.from, candidate.to, booking.from, booking.to)) {
      clashes.push({ kind: "booking", ...(booking.id ? { id: booking.id } : {}), date: candidate.date, from: booking.from, to: booking.to });
    }
  }
  const day = weekday(candidate.date);
  for (const item of series) {
    if (!activeSeriesStates.has(item.state) || candidate.date < item.startDate || (item.endDate && candidate.date > item.endDate)) continue;
    if (day && item.weekdays.includes(day as BookingSeries["weekdays"][number]) && rangesOverlap(candidate.from, candidate.to, item.from, item.to)) {
      clashes.push({ kind: "series", ...(item.id ? { id: item.id } : {}), date: candidate.date, from: item.from, to: item.to });
    }
  }
  return clashes;
}

export type ShiftWindow = Pick<CalendarEvent, "start" | "end" | "recurring" | "state"> & { id?: string };
export type ShiftConflict = { id?: string; start: number; end: number };

function millis(value: unknown): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === "string" || typeof value === "number") {
    const result = typeof value === "number" ? value : Date.parse(value);
    return Number.isFinite(result) ? result : null;
  }
  if (value && typeof value === "object") {
    const object = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof object.toDate === "function") return millis(object.toDate());
    if (typeof object.seconds === "number") return object.seconds * 1_000 + Math.floor((object.nanoseconds ?? 0) / 1_000_000);
  }
  return null;
}

function eventOccurrences(event: ShiftWindow): Array<{ start: number; end: number }> {
  const start = millis(event.start);
  const end = millis(event.end);
  if (start === null || end === null || end <= start) return [];
  if (!event.recurring) return [{ start, end }];
  const until = Date.parse(`${event.recurring.until}T23:59:59.999Z`);
  if (!Number.isFinite(until)) return [];
  const duration = end - start;
  const startDate = new Date(start);
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const limit = Math.min(until, cursor.getTime() + 3660 * 86_400_000);
  const result: Array<{ start: number; end: number }> = [];
  const offset = start - cursor.getTime();
  for (; cursor.getTime() <= limit; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dayName = dayNames[cursor.getUTCDay()];
    if (dayName && event.recurring.weekdays.includes(dayName as BookingSeries["weekdays"][number])) {
      const occurrenceStart = cursor.getTime() + offset;
      result.push({ start: occurrenceStart, end: occurrenceStart + duration });
    }
  }
  return result;
}

/** Returns conflict warnings for active, requested, approved, or swapped CareSpace shifts. */
export function findShiftConflicts(candidate: ShiftWindow, events: readonly ShiftWindow[]): ShiftConflict[] {
  const allowed = new Set(["active", "requested", "approved", "swap"]);
  if (!allowed.has(candidate.state)) return [];
  const candidateOccurrences = eventOccurrences(candidate);
  if (candidateOccurrences.length === 0) return [];
  const conflicts: ShiftConflict[] = [];
  for (const event of events) {
    if (event.id && event.id === candidate.id || !allowed.has(event.state)) continue;
    const existingOccurrences = eventOccurrences(event);
    let hit: ShiftConflict | null = null;
    for (const a of candidateOccurrences) {
      for (const b of existingOccurrences) {
        if (a.start < b.end && b.start < a.end) { hit = { ...(event.id ? { id: event.id } : {}), start: Math.max(a.start, b.start), end: Math.min(a.end, b.end) }; break; }
      }
      if (hit) break;
    }
    if (hit) conflicts.push(hit);
  }
  return conflicts;
}
