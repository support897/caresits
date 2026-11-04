import { addDoc, collection, doc, getDoc, getDocs, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@cc/core";
import {
  careSpaceApprovalRecordSchema,
  type CareSpaceApprovalRecord,
} from "@cc/core/src/schemas/space-extras";
import type { SpaceRole } from "@cc/core/src/permissions";
import { decodePlanEntry, PLAN_WEEKDAYS, type PlanDays, type PlanWeekday } from "./plans";

export type ApprovalKind = CareSpaceApprovalRecord["kind"];
export type ApprovalDecision = Extract<CareSpaceApprovalRecord["state"], "approved" | "declined">;
export type ApprovalItem = CareSpaceApprovalRecord & { id: string };

export function normalizeApproval(id: string, value: unknown): ApprovalItem | null {
  const parsed = careSpaceApprovalRecordSchema.safeParse(value);
  return parsed.success ? { id, ...parsed.data } : null;
}

export function makePendingApproval(kind: ApprovalKind, ref: string, by: string): CareSpaceApprovalRecord {
  const parsed = careSpaceApprovalRecordSchema.safeParse({ kind, ref: ref.trim(), state: "pending", by: by.trim() });
  if (!parsed.success) throw new Error("invalid-approval");
  return parsed.data;
}

export type PlanApprovalReference = { weekId: string; day: PlanWeekday; itemId: string; childId?: string };
const VALID_PLAN_DAYS = new Set<string>(PLAN_WEEKDAYS);

export function makePlanApprovalRef(weekId: string, day: PlanWeekday, itemId: string, childId?: string): string {
  const cleanItemId = itemId.trim();
  const cleanChildId = childId?.trim() ?? "";
  if (!/^\d{4}-W\d{2}$/.test(weekId) || !VALID_PLAN_DAYS.has(day) || !cleanItemId || cleanChildId.length > 128) throw new Error("invalid-plan-approval-ref");
  const ref = `plan|${weekId}|${day}|${encodeURIComponent(cleanItemId)}|${encodeURIComponent(cleanChildId)}`;
  if (ref.length > 128) throw new Error("invalid-plan-approval-ref");
  return ref;
}

export function parsePlanApprovalRef(ref: string): PlanApprovalReference | null {
  const [prefix, weekId, day, encodedItemId, encodedChildId, ...rest] = ref.split("|");
  if (prefix !== "plan" || rest.length || !weekId || !/^\d{4}-W\d{2}$/.test(weekId) || !day || !VALID_PLAN_DAYS.has(day) || !encodedItemId || encodedChildId === undefined) return null;
  try {
    const itemId = decodeURIComponent(encodedItemId);
    const childId = decodeURIComponent(encodedChildId);
    return itemId ? { weekId, day: day as PlanWeekday, itemId, ...(childId ? { childId } : {}) } : null;
  } catch { return null; }
}

export function planApprovalRequests(weekId: string, days: PlanDays, by: string): CareSpaceApprovalRecord[] {
  const requests: CareSpaceApprovalRecord[] = [];
  for (const day of PLAN_WEEKDAYS) {
    for (const value of days[day]) {
      const entry = decodePlanEntry(value);
      if (entry.kind === "other") continue;
      requests.push(makePendingApproval(entry.kind, makePlanApprovalRef(weekId, day, entry.itemId, entry.childId), by));
    }
  }
  return requests;
}

export function planApprovalStatus(
  weekId: string,
  days: PlanDays,
  approvals: readonly ApprovalItem[],
): { pending: boolean; declined: boolean } {
  const requests = planApprovalRequests(weekId, days, "plan-status");
  const keys = new Set(requests.map((item) => `${item.kind}|${item.ref}`));
  const related = approvals.filter((item) => keys.has(`${item.kind}|${item.ref}`));
  const pending = related.some((item) => item.state === "pending");
  const approved = related.some((item) => item.state === "approved");
  return { pending, declined: !pending && !approved && related.some((item) => item.state === "declined") };
}

export function pendingApprovals(items: readonly ApprovalItem[]): ApprovalItem[] {
  return items.filter((item) => item.state === "pending");
}

export function canDecideApproval(role: SpaceRole, item: Pick<ApprovalItem, "state">): boolean {
  return role === "admin" && item.state === "pending";
}

export async function loadApprovals(spaceId: string): Promise<ApprovalItem[]> {
  if (!spaceId) return [];
  const snapshot = await getDocs(collection(db, "careSpaces", spaceId, "approvals"));
  return snapshot.docs.map((row) => normalizeApproval(row.id, row.data()))
    .filter((item): item is ApprovalItem => item !== null)
    .sort((left, right) => Number(right.state === "pending") - Number(left.state === "pending") || left.id.localeCompare(right.id));
}

export async function requestApproval(
  spaceId: string,
  kind: ApprovalKind,
  ref: string,
  by: string,
): Promise<string> {
  if (!spaceId) throw new Error("invalid-approval-target");
  const record = makePendingApproval(kind, ref, by);
  const result = await addDoc(collection(db, "careSpaces", spaceId, "approvals"), record);
  return result.id;
}

export async function requestWeeklyPlanReview(
  spaceId: string,
  weekId: string,
  days: PlanDays,
  by: string,
): Promise<number> {
  if (!spaceId || !by) throw new Error("invalid-approval-target");
  const requests = planApprovalRequests(weekId, days, by);
  if (!requests.length) throw new Error("plan-empty");
  const approvalsRef = collection(db, "careSpaces", spaceId, "approvals");
  const existing = await getDocs(approvalsRef);
  const alreadyPending = new Set(existing.docs.flatMap((row) => {
    const approval = normalizeApproval(row.id, row.data());
    return approval?.state === "pending" ? [`${approval.kind}|${approval.ref}`] : [];
  }));
  const needed = requests.filter((request) => !alreadyPending.has(`${request.kind}|${request.ref}`));
  if (!needed.length) return 0;
  const batch = writeBatch(db);
  for (const request of needed) batch.set(doc(approvalsRef), request);
  await batch.commit();
  return needed.length;
}

export async function decideApproval(
  spaceId: string,
  approvalId: string,
  uid: string,
  role: SpaceRole,
  decision: ApprovalDecision,
): Promise<void> {
  if (!spaceId || !approvalId || !uid) throw new Error("invalid-approval-target");
  if (role !== "admin") throw new Error("approval-decision-not-allowed");
  const ref = doc(db, "careSpaces", spaceId, "approvals", approvalId);
  const snapshot = await getDoc(ref);
  const item = snapshot.exists() ? normalizeApproval(snapshot.id, snapshot.data()) : null;
  if (!item || !canDecideApproval(role, item)) throw new Error("approval-no-longer-pending");
  await updateDoc(ref, { state: decision, decidedBy: uid });
}
