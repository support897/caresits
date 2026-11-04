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
