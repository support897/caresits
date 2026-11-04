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
  const { id, spaceId: _spaceId, spaceName: _spaceName, ...data } = event;
  const cached = readSnapshot<CalendarEvent[]>(calendarKey(spaceId));
  saveSnapshot(calendarKey(spaceId), [...(cached?.data ?? []).filter((entry) => entry.id !== id), event]);
  const result = await writeSpaceDocument({ path: `careSpaces/${spaceId}/calendar/${id}`, method: "set", data });
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
  await saveCalendarEvent(spaceId, next);
  return next;
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
  await saveCalendarEvent(spaceId, next);
  return next;
}

export async function getCalendarEvent(spaceId: string, eventId: string): Promise<CalendarEvent | null> {
  const result = await readCalendar(spaceId);
  return result.events.find((event) => event.id === eventId) ?? null;
}

export function eventsForDay(events: readonly CalendarEvent[], day: string): CalendarEvent[] {
  return events.filter((event) => event.start.slice(0, 10) === day)
    .sort((left, right) => left.start.localeCompare(right.start));
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
