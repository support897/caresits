import { findShiftConflicts } from "@cc/core/src/schemas/availability";
import {
  careSpaceCalendarEventSchema,
  careSpaceEventRecurrenceSchema,
  type CareSpaceEventRecurrence,
} from "@cc/core/src/schemas/space-extras";
import { saveCalendarEvent, type CalendarEvent } from "./calendar";

export type CalendarEventWithRecurrence = CalendarEvent & {
  recurring?: CareSpaceEventRecurrence;
  occurrenceDate?: string;
};

export type ShiftDraft = {
  id?: string;
  title: string;
  start: string;
  end: string;
  ownerUid: string;
  recurring?: CareSpaceEventRecurrence;
};

export type ShiftConflictWarning = {
  id?: string;
  start: number;
  end: number;
  eventTitle?: string;
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function validDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.().replaceAll("-", "")
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function localWallClockAsUtc(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds())).toISOString();
}

function utcWallClockAsLocal(value: number): number {
  const date = new Date(value);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()).getTime();
}

/** Creates a validated shift record. Conflict warnings do not change this record or block saving. */
export function buildShiftCalendarEvent(input: ShiftDraft): CalendarEventWithRecurrence {
  const title = input.title.trim();
  const start = Date.parse(input.start);
  const end = Date.parse(input.end);
  if (!title || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || !input.ownerUid.trim()) {
    throw new Error("invalid-shift");
  }
  if (input.recurring) {
    const recurrence = careSpaceEventRecurrenceSchema.safeParse(input.recurring);
    if (!recurrence.success || !validDateKey(input.recurring.until) || input.recurring.until < dateKey(new Date(start))) {
      throw new Error("invalid-recurrence");
    }
  }

  const event: CalendarEventWithRecurrence = {
    id: input.id ?? makeId(),
    title,
    kind: "shift",
    start: input.start,
    end: input.end,
    ownerUid: input.ownerUid,
    state: "active",
    ...(input.recurring ? { recurring: input.recurring } : {}),
  };
  const { id: _id, ...record } = event;
  if (!careSpaceCalendarEventSchema.safeParse(record).success) throw new Error("invalid-shift");
  return event;
}

export async function createShiftEvent(spaceId: string, input: ShiftDraft): Promise<CalendarEventWithRecurrence> {
  if (!spaceId) throw new Error("space-required");
  const event = buildShiftCalendarEvent(input);
  const result = await saveCalendarEvent(spaceId, event);
  return { ...event, spaceId, queued: result.queued };
}

/** Uses the shared core conflict finder. Conflicts are returned as warnings only. */
export function findShiftWarnings(
  candidate: CalendarEventWithRecurrence,
  events: readonly CalendarEventWithRecurrence[],
): ShiftConflictWarning[] {
  const relevant = events.filter((event) => event.kind === "shift" || event.kind === "booking" || event.kind === "timeoff");
  const conflicts = findShiftConflicts({
    id: candidate.id,
    start: localWallClockAsUtc(candidate.start),
    end: localWallClockAsUtc(candidate.end),
    recurring: candidate.recurring,
    state: candidate.state,
  }, relevant.map((event) => ({
    id: event.id,
    start: localWallClockAsUtc(event.start),
    end: localWallClockAsUtc(event.end),
    recurring: event.recurring,
    state: event.state,
  })));
  return conflicts.map((conflict) => {
    const event = relevant.find((row) => row.id === conflict.id);
    return {
      ...conflict,
      start: utcWallClockAsLocal(conflict.start),
      end: utcWallClockAsLocal(conflict.end),
      ...(event ? { eventTitle: event.title } : {}),
    };
  });
}

function eventOccurrenceOnDay(event: CalendarEventWithRecurrence, day: string): CalendarEventWithRecurrence | null {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return null;
  if (!event.recurring) return dateKey(start) === day ? { ...event, occurrenceDate: day } : null;

  const startDay = dateKey(start);
  const dayDate = new Date(`${day}T12:00:00`);
  if (!validDateKey(day) || day < startDay || day > event.recurring.until || !Number.isFinite(dayDate.getTime())) return null;
  const weekday = weekdays[dayDate.getDay()];
  if (!weekday || !event.recurring.weekdays.includes(weekday)) return null;

  const occurrenceStart = new Date(
    dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(),
    start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds(),
  );
  const occurrenceEnd = new Date(occurrenceStart.getTime() + end.getTime() - start.getTime());
  return {
    ...event,
    start: occurrenceStart.toISOString(),
    end: occurrenceEnd.toISOString(),
    occurrenceDate: day,
  };
}

/** Expands stored recurrence into local calendar-day instances for a visible range. */
export function expandCalendarEventsForRange(
  events: readonly CalendarEventWithRecurrence[],
  firstDay: string,
  lastDay: string,
): CalendarEventWithRecurrence[] {
  if (!validDateKey(firstDay) || !validDateKey(lastDay) || firstDay > lastDay) return [];
  const cursor = new Date(`${firstDay}T12:00:00`);
  const last = new Date(`${lastDay}T12:00:00`);
  const result: CalendarEventWithRecurrence[] = [];
  while (cursor <= last) {
    const day = dateKey(cursor);
    for (const event of events) {
      const occurrence = eventOccurrenceOnDay(event, day);
      if (occurrence) result.push(occurrence);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result.sort((left, right) => left.start.localeCompare(right.start));
}
