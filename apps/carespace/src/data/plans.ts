import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@cc/core";
import { careSpacePlanRecordSchema, type CareSpacePlanRecord } from "@cc/core/src/schemas/space-extras";
import type { SpaceRole } from "@cc/core/src/permissions";

export const PLAN_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type PlanWeekday = (typeof PLAN_WEEKDAYS)[number];
export type PlanDays = Record<PlanWeekday, string[]>;
export type PlanEntry = { kind: "activity" | "meal"; itemId: string; childId?: string };
export type DecodedPlanEntry = PlanEntry | { kind: "other"; label: string };
export type WeeklyPlan = CareSpacePlanRecord & { days: PlanDays };

const MAX_PLAN_ITEMS_PER_DAY = 20;
const PLAN_SEPARATOR = "|";
const VALID_DAYS = new Set<string>(PLAN_WEEKDAYS);

export function buildEmptyPlanDays(): PlanDays {
  return { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] };
}

export function weekIdFor(date: Date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new Error("invalid-date");
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - weekday);
  const year = value.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((value.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function encodePlanEntry(entry: PlanEntry): string {
  const itemId = entry.itemId.trim();
  const childId = entry.childId?.trim() ?? "";
  if (!itemId || !["activity", "meal"].includes(entry.kind) || itemId.length > 128 || childId.length > 128) {
    throw new Error("invalid-plan-entry");
  }
  const encoded = [entry.kind, itemId, childId].map((part) => encodeURIComponent(part)).join(PLAN_SEPARATOR);
  if (encoded.length > 128) throw new Error("plan-entry-too-long");
  return encoded;
}

export function decodePlanEntry(value: string): DecodedPlanEntry {
  const parts = value.split(PLAN_SEPARATOR);
  if (parts.length !== 3 || (parts[0] !== "activity" && parts[0] !== "meal")) return { kind: "other", label: value };
  try {
    const [, rawItemId, rawChildId] = parts;
    const itemId = decodeURIComponent(rawItemId ?? "");
    const childId = decodeURIComponent(rawChildId ?? "");
    if (!itemId || itemId.length > 128 || childId.length > 128) return { kind: "other", label: value };
    return { kind: parts[0], itemId, ...(childId ? { childId } : {}) };
  } catch {
    return { kind: "other", label: value };
  }
}

export function addPlanEntry(days: PlanDays, day: PlanWeekday, entry: PlanEntry): PlanDays {
  const encoded = encodePlanEntry(entry);
  const current = days[day] ?? [];
  if (current.includes(encoded)) return days;
  if (current.length >= MAX_PLAN_ITEMS_PER_DAY) throw new Error("plan-day-full");
  return { ...days, [day]: [...current, encoded] };
}

export function removePlanEntry(days: PlanDays, day: PlanWeekday, index: number): PlanDays {
  const current = days[day] ?? [];
  if (!Number.isInteger(index) || index < 0 || index >= current.length) return days;
  return { ...days, [day]: current.filter((_, position) => position !== index) };
}

export function normalizeWeeklyPlan(value: unknown): WeeklyPlan {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawDays = raw.days && typeof raw.days === "object" ? raw.days as Record<string, unknown> : {};
  const days = buildEmptyPlanDays();
  for (const [day, entries] of Object.entries(rawDays)) {
    if (!VALID_DAYS.has(day) || !Array.isArray(entries)) continue;
    days[day as PlanWeekday] = entries.filter((entry): entry is string => typeof entry === "string" && entry.length > 0 && entry.length <= 128).slice(0, MAX_PLAN_ITEMS_PER_DAY);
  }
  const approvedBy = typeof raw.approvedBy === "string" && raw.approvedBy.trim().length <= 128
    ? raw.approvedBy.trim() || undefined
    : undefined;
  const parsed = careSpacePlanRecordSchema.safeParse({ days, ...(approvedBy ? { approvedBy } : {}) });
  if (!parsed.success) return { days: buildEmptyPlanDays() };
  return parsed.data as WeeklyPlan;
}

export function hasPlanEntries(days: PlanDays): boolean {
  return PLAN_WEEKDAYS.some((day) => days[day].length > 0);
}

export async function loadWeeklyPlan(spaceId: string, weekId: string): Promise<WeeklyPlan> {
  if (!spaceId || !weekId) return { days: buildEmptyPlanDays() };
  const snapshot = await getDoc(doc(db, "careSpaces", spaceId, "plans", weekId));
  return snapshot.exists() ? normalizeWeeklyPlan(snapshot.data()) : { days: buildEmptyPlanDays() };
}

export async function saveWeeklyPlan(
  spaceId: string,
  weekId: string,
  days: PlanDays,
  role: SpaceRole,
): Promise<void> {
  if (!spaceId || !weekId) throw new Error("invalid-plan-target");
  const parsed = careSpacePlanRecordSchema.safeParse({ days });
  if (!parsed.success) throw new Error("invalid-plan");
  const ref = doc(db, "careSpaces", spaceId, "plans", weekId);
  const existing = await getDoc(ref);
  const current = existing.exists() ? normalizeWeeklyPlan(existing.data()) : null;
  if (current?.approvedBy && role !== "admin") throw new Error("approved-plan-locked");
  await setDoc(ref, { days: parsed.data.days }, { merge: true });
}

export async function approveWeeklyPlan(spaceId: string, weekId: string, uid: string, role: SpaceRole): Promise<void> {
  if (!spaceId || !weekId || !uid) throw new Error("invalid-plan-target");
  if (role !== "admin") throw new Error("admin-required");
  const member = await getDoc(doc(db, "careSpaces", spaceId, "members", uid));
  if (!member.exists() || member.data().status !== "active" || member.data().role !== "admin") throw new Error("admin-required");
  const ref = doc(db, "careSpaces", spaceId, "plans", weekId);
  const plan = await getDoc(ref);
  if (!plan.exists() || !hasPlanEntries(normalizeWeeklyPlan(plan.data()).days)) throw new Error("plan-empty");
  await updateDoc(ref, { approvedBy: uid });
}
