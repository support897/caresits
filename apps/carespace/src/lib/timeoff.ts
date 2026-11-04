import type { SpaceRole } from "./permissions";

export type TimeOffState = "requested" | "approved" | "declined" | "swap";
export type CalendarEventRecord = {
  id: string;
  kind: string;
  state?: string;
  start: string;
  end: string;
  ownerUid?: string;
  swap?: { start: string; end: string };
  [key: string]: unknown;
};
export type TimeOffAction = "approve" | "decline" | "swap";
export type TimeOffPeriod = { start: string; end: string };

function localDateTime(date: string, time: string): Date {
  const dateParts = date.split("-").map(Number);
  const timeParts = time.split(":").map(Number);
  if (dateParts.length !== 3 || timeParts.length !== 2 || [...dateParts, ...timeParts].some((part) => !Number.isInteger(part))) {
    throw new Error("Choose a valid date and time.");
  }
  const [year, month, day] = dateParts;
  const [hour, minute] = timeParts;
  if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined) {
    throw new Error("Choose a valid date and time.");
  }
  const result = new Date(year, month - 1, day, hour, minute);
  if (result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("Choose a valid date and time.");
  }
  return result;
}

export function buildTimeOffPeriod(
  startDate: string,
  endDate: string,
  from: string,
  to: string,
  allDay = false,
): TimeOffPeriod {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) {
    throw new Error("Choose a valid start and end date.");
  }
  const start = localDateTime(startDate, allDay ? "00:00" : from);
  const end = allDay ? localDateTime(endDate, "23:59") : localDateTime(endDate, to);
  if (end.getTime() <= start.getTime()) throw new Error("End time must be after start time.");
  return { start: start.toISOString(), end: end.toISOString() };
}

export function findAffectedScheduleEvents<T extends CalendarEventRecord>(
  start: string,
  end: string,
  events: readonly T[],
): T[] {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
  return events.filter((event) => {
    if (event.kind !== "booking" && event.kind !== "shift") return false;
    if (event.state === "declined") return false;
    const eventStart = Date.parse(event.start);
    const eventEnd = Date.parse(event.end);
    return Number.isFinite(eventStart) && Number.isFinite(eventEnd) && eventStart < endMs && eventEnd > startMs;
  }).sort((left, right) => left.start.localeCompare(right.start));
}

export function transitionTimeOff(
  event: CalendarEventRecord,
  action: TimeOffAction,
  role: SpaceRole,
  swap?: { start: string; end: string },
): CalendarEventRecord {
  if (event.kind !== "timeoff") throw new Error("Only time-off requests can change here.");
  if (event.state !== "requested") throw new Error("This time-off request is no longer waiting.");
  if (role !== "admin") throw new Error("Only a family admin can decide this request.");
  if (action === "swap") {
    if (!swap?.start || !swap.end || swap.end <= swap.start) throw new Error("Choose a valid swap time.");
    return { ...event, state: "swap", swap: { ...swap } };
  }
  return { ...event, state: action === "approve" ? "approved" : "declined" };
}

export function applyTimeOffActionToEvents<T extends CalendarEventRecord>(
  events: readonly T[],
  eventId: string,
  action: TimeOffAction,
  role: SpaceRole,
  swap?: { start: string; end: string },
): T[] {
  return events.map((event) => event.id === eventId
    ? transitionTimeOff(event, action, role, swap) as T
    : event);
}
