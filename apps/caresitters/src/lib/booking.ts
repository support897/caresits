import type { Person } from "@cc/core";

export const BOOKING_REQUEST_TAP_STEPS = ["open-book", "choose-date", "choose-from", "choose-to", "send-request"] as const;
export const MAX_PROFILE_TO_REQUEST_TAPS = 5;

export type BookingState = "requested" | "accepted" | "declined" | "cancelled" | "completed";
export type BookingSide = "family" | "carer";
export type BookingTargetState = Exclude<BookingState, "requested">;
export type AvailabilityDays = Record<string, unknown> | string[] | null | undefined;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();
const canonicalDay = (value: unknown) => {
  const key = norm(value);
  const short = WEEKDAYS.find((day) => norm(day) === key || key.startsWith(norm(day)));
  return short ? norm(short) : key;
};
const list = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : value == null || value === "" ? [] : [String(value)];

function minutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function estimateCost(from: string, to: string, rate: number): number | null {
  const start = minutes(from);
  const end = minutes(to);
  if (start == null || end == null || end <= start || !Number.isFinite(rate) || rate < 0) return null;
  const total = ((end - start) / 60) * rate;
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

function isAvailable(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0 && !["false", "off", "unavailable", "no"].includes(value.trim().toLowerCase());
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.available === "boolean") return record.available;
    return Object.values(record).some(isAvailable);
  }
  return Boolean(value);
}

/** Returns known conflicts; an empty/unshared calendar stays unknown, not falsely available. */
export function checkAvailability(days: AvailabilityDays, weekdays: string[]): string[] {
  if (!days || (Array.isArray(days) ? days.length === 0 : Object.keys(days).length === 0)) return [];
  const entries: Record<string, unknown> = Array.isArray(days)
    ? Object.fromEntries(days.map((day) => [canonicalDay(day), true]))
    : Object.fromEntries(Object.entries(days).map(([day, value]) => [canonicalDay(day), value]));
  if (Object.keys(entries).length === 0) return [];
  return weekdays.filter((day) => {
    const entry = entries[canonicalDay(day)];
    return entry === undefined || !isAvailable(entry);
  });
}

export function canTransitionBooking(from: BookingState, to: BookingTargetState, actor: BookingSide): boolean {
  if (to === "cancelled") return from === "requested" || from === "accepted";
  if (from === "requested" && (to === "accepted" || to === "declined")) return actor === "carer";
  if (from === "accepted" && to === "completed") return actor === "carer";
  return false;
}

export type ContactPlanInput = {
  familyUid: string;
  carerUid: string;
  createdBy: string;
  nowIso: string;
  createdDay: string;
  profileComplete: boolean;
  learningPlan?: unknown;
  learningMatches?: unknown[];
};

export const pairIdFor = (a: string, b: string): string => a < b ? `${a}_${b}` : `${b}_${a}`;

/** Port of the existing app2 planContact gate; pair ids and membership rules stay aligned. */
export function planContact(input: ContactPlanInput):
  | { ok: true; path: string; data: Record<string, unknown> }
  | { ok: false; reason: "profile-incomplete" | "self-pair" | "creator-not-a-member" } {
  const { familyUid, carerUid, createdBy, nowIso, createdDay, profileComplete, learningPlan = null, learningMatches = [] } = input;
  if (!profileComplete) return { ok: false, reason: "profile-incomplete" };
  if (familyUid === carerUid) return { ok: false, reason: "self-pair" };
  if (createdBy !== familyUid && createdBy !== carerUid) return { ok: false, reason: "creator-not-a-member" };
  return {
    ok: true,
    path: `relationships/${pairIdFor(familyUid, carerUid)}`,
    data: {
      members: [familyUid, carerUid].sort(),
      familyUid,
      carerUid,
      state: "pending",
      createdBy,
      createdAt: nowIso,
      createdDay,
      ...(learningPlan && typeof learningPlan === "object" ? { learningPlan } : {}),
      ...(Array.isArray(learningMatches) && learningMatches.length ? { learningMatches: learningMatches.slice(0, 3) } : {}),
    },
  };
}

/** The app's published profile record is the current completed-profile gate. */
export function isProfileComplete(profile: Person | null | undefined): boolean {
  return Boolean(profile?.uid && profile.name && (profile.side === "family" || profile.side === "carer"));
}

/** Clearly marked fallback until @cc/core exports its named explain match engine. */
export function explainMatchAdapter(family: Person, carer: Person): string[] {
  const reasons: string[] = [];
  const familyStyles = list(family.card.style ?? family.card.personality ?? family.card.careStyle).map(norm);
  const carerStyles = list(carer.card.style ?? carer.card.personality ?? carer.card.careStyle).map(norm);
  const sharedStyles = familyStyles.filter((style) => carerStyles.includes(style));
  if (sharedStyles.length) reasons.push(`You both value ${sharedStyles.slice(0, 3).join(", ")}.`);

  const wantedDays = Object.entries(family.card.scheduleNeed ?? {}).filter(([, value]) => isAvailable(value)).map(([day]) => day);
  const offeredDays = Object.entries(carer.card.availability ?? {}).filter(([, value]) => isAvailable(value)).map(([day]) => day);
  const sharedDays = wantedDays.filter((day) => offeredDays.some((offered) => norm(offered).slice(0, 3) === norm(day).slice(0, 3)));
  if (sharedDays.length) reasons.push(`Your listed schedules overlap on ${sharedDays.slice(0, 3).join(", ")}.`);

  const rate = Number(carer.card.rate ?? carer.card.payFloor ?? carer.card.hourlyRate);
  const budget = Number(family.card.budgetMax ?? family.card.maxBudget ?? family.card.payOffered);
  if (Number.isFinite(rate) && rate > 0 && Number.isFinite(budget) && budget > 0) {
    reasons.push(rate <= budget ? `The A$${rate}/hour rate is within your A$${budget}/hour budget.` : `The A$${rate}/hour rate is above your A$${budget}/hour budget.`);
  }
  return reasons.length ? reasons : ["Not enough shared profile details yet to explain this match."];
}
