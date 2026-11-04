import { collection, getDocs } from "firebase/firestore";
import { db } from "@cc/core";
import { transitionTimeOff, type CalendarEventRecord, type TimeOffAction } from "../lib/timeoff";
import type { SpaceRole } from "../lib/permissions";
import { isConnectivityError, readSnapshot, saveSnapshot, writeSpaceDocument } from "./offline";
import type { SpaceSummary } from "./spaces";

export type CalendarKind = "booking" | "shift" | "school" | "activity" | "pickup" | "timeoff";
export type CalendarEvent = CalendarEventRecord & {
  title: string;
  kind: CalendarKind;
  start: string;
  end: string;
  ownerUid: string;
  childId?: string;
  state: "active" | "requested" | "approved" | "declined" | "swap";
  spaceId?: string;
  spaceName?: string;
  queued?: boolean;
};
export type CalendarRead = { events: CalendarEvent[]; fromCache: boolean };
const calendarKey = (spaceId: string) => `calendar:${spaceId}`;
const makeId = () => globalThis.crypto?.randomUUID?.().replaceAll("-", "") ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function readCalendar(spaceId: string): Promise<CalendarRead> {
  const cached = readSnapshot<CalendarEvent[]>(calendarKey(spaceId));
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { events: cached?.data ?? [], fromCache: cached !== null };
  }
  try {
    const result = await getDocs(collection(db, "careSpaces", spaceId, "calendar"));
    const events = result.docs.map((snapshot) => ({ ...snapshot.data(), id: snapshot.id, spaceId } as CalendarEvent));
    saveSnapshot(calendarKey(spaceId), events);
    return { events, fromCache: false };
  } catch (error) {
    if (!isConnectivityError(error)) throw error;
    return { events: cached?.data ?? [], fromCache: cached !== null };
  }
}

export async function readCalendarForSpaces(spaces: readonly SpaceSummary[]): Promise<{ events: CalendarEvent[]; fromCache: boolean }> {
  const reads = await Promise.all(spaces.map((space) => readCalendar(space.id)));
  return {
    events: reads.flatMap((result, index) => result.events.map((event) => ({
      ...event,
      spaceId: spaces[index]!.id,
      spaceName: spaces[index]!.name,
    }))),
    fromCache: reads.some((result) => result.fromCache),
  };
}

export async function saveCalendarEvent(spaceId: string, event: CalendarEvent): Promise<{ queued: boolean }> {
  const { id, spaceId: _spaceId, spaceName: _spaceName, queued: _queued, ...data } = event;
  const result = await writeSpaceDocument({ path: `careSpaces/${spaceId}/calendar/${id}`, method: "set", data });
  const cached = readSnapshot<CalendarEvent[]>(calendarKey(spaceId));
  saveSnapshot(calendarKey(spaceId), [...(cached?.data ?? []).filter((entry) => entry.id !== id), event]);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("carespace:calendar-changed"));
  return result;
}

export type NewCalendarEvent = {
  id?: string;
  title: string;
  kind: CalendarKind;
  start: string;
  end: string;
  ownerUid: string;
  state: CalendarEvent["state"];
  childId?: string;
  swap?: { start: string; end: string };
};

export async function createCalendarEvent(
  spaceId: string,
  event: NewCalendarEvent,
): Promise<CalendarEvent> {
  const next: CalendarEvent = { ...event, id: event.id ?? makeId(), spaceId };
  const result = await saveCalendarEvent(spaceId, next);
  return { ...next, queued: result.queued };
}

export async function createTimeOffRequest(input: {
  spaceId: string;
  ownerUid: string;
  start: string;
  end: string;
  title: string;
}): Promise<CalendarEvent> {
  return createCalendarEvent(input.spaceId, {
    title: input.title,
    kind: "timeoff",
    start: input.start,
    end: input.end,
    ownerUid: input.ownerUid,
    state: "requested",
  });
}

export async function decideTimeOffRequest(
  spaceId: string,
  event: CalendarEvent,
  action: TimeOffAction,
  role: SpaceRole,
  swap?: { start: string; end: string },
): Promise<CalendarEvent> {
  const next = transitionTimeOff(event, action, role, swap) as CalendarEvent;
  const result = await saveCalendarEvent(spaceId, next);
  return { ...next, queued: result.queued };
}

export async function getCalendarEvent(spaceId: string, eventId: string): Promise<CalendarEvent | null> {
  const result = await readCalendar(spaceId);
  return result.events.find((event) => event.id === eventId) ?? null;
}

export function eventsForDay(events: readonly CalendarEvent[], day: string): CalendarEvent[] {
  return events.filter((event) => event.start.slice(0, 10) === day)
    .sort((left, right) => left.start.localeCompare(right.start));
}

export type CalendarPeriod = "day" | "week" | "month";
export type CalendarDay = { key: string; date: Date };

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calendarDaysForPeriod(selectedDay: string, period: CalendarPeriod): CalendarDay[] {
  const anchor = new Date(`${selectedDay}T12:00:00`);
  if (Number.isNaN(anchor.getTime())) return [];
  const first = period === "week"
    ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay())
    : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const count = period === "week" ? 7 : 1;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + index);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`, date };
  });
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftCalendarMonth(selectedDay: string, direction: -1 | 1): string {
  const selected = new Date(`${selectedDay}T12:00:00`);
  if (Number.isNaN(selected.getTime())) return selectedDay;
  const next = new Date(selected.getFullYear(), selected.getMonth() + direction, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(selected.getDate(), lastDay));
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}
