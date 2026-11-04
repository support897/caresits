import { describe, expect, it } from "vitest";
import { buildEmptyPlanDays, encodePlanEntry } from "./plans";
import {
  canDecideApproval, makePendingApproval, makePlanApprovalRef, normalizeApproval, parsePlanApprovalRef,
  pendingApprovals, planApprovalRequests, planApprovalStatus, type ApprovalItem,
} from "./approvals";

const pending: ApprovalItem = {
  id: "approval-1",
  kind: "meal",
  ref: "apple-oat-porridge",
  state: "pending",
  by: "carer-1",
};

describe("care-space approvals", () => {
  it("normalizes only valid approval documents", () => {
    expect(normalizeApproval("approval-1", { kind: pending.kind, ref: pending.ref, state: pending.state, by: pending.by })).toEqual(pending);
    expect(normalizeApproval("bad", { ...pending, state: "waiting" })).toBeNull();
  });

  it("makes new approval requests pending and actor-owned", () => {
    expect(makePendingApproval("activity", "scoop-and-pour", "carer-1")).toEqual({
      kind: "activity", ref: "scoop-and-pour", state: "pending", by: "carer-1",
    });
    expect(() => makePendingApproval("meal", " ", "carer-1")).toThrow("invalid-approval");
  });

  it("shows only pending rows in the inbox", () => {
    expect(pendingApprovals([pending, { ...pending, id: "done", state: "approved" }])).toEqual([pending]);
  });

  it("allows decisions only for parent admins and pending rows", () => {
    expect(canDecideApproval("admin", pending)).toBe(true);
    expect(canDecideApproval("regular", pending)).toBe(false);
    expect(canDecideApproval("admin", { ...pending, state: "declined" })).toBe(false);
  });

  it("reports pending and declined decisions for entries in a weekly plan", () => {
    const days = buildEmptyPlanDays();
    days.Mon = [encodePlanEntry({ kind: "activity", itemId: "scoop-and-pour", childId: "mila" })];
    const ref = makePlanApprovalRef("2026-W45", "Mon", "scoop-and-pour", "mila");
    const row: ApprovalItem = { ...pending, id: "plan-approval", kind: "activity", ref };

    expect(planApprovalStatus("2026-W45", days, [row])).toEqual({ pending: true, declined: false });
    expect(planApprovalStatus("2026-W45", days, [{ ...row, state: "declined" }])).toEqual({ pending: false, declined: true });
    expect(planApprovalStatus("2026-W45", days, [
      { ...row, state: "declined" }, { ...row, id: "later", state: "approved" },
    ])).toEqual({ pending: false, declined: false });
    expect(planApprovalStatus("2026-W46", days, [row])).toEqual({ pending: false, declined: false });
  });

  it("round-trips weekly plan references and makes typed activity and meal requests", () => {
    const activityRef = makePlanApprovalRef("2026-W45", "Mon", "scoop-and-pour", "mila");
    expect(parsePlanApprovalRef(activityRef)).toEqual({ weekId: "2026-W45", day: "Mon", itemId: "scoop-and-pour", childId: "mila" });
    expect(parsePlanApprovalRef("not-a-plan-reference")).toBeNull();
    const days = buildEmptyPlanDays();
    days.Mon = [encodePlanEntry({ kind: "activity", itemId: "scoop-and-pour", childId: "mila" })];
    days.Tue = [encodePlanEntry({ kind: "meal", itemId: "apple-oat-porridge", childId: "mila" })];
    expect(planApprovalRequests("2026-W45", days, "carer-1")).toEqual([
      { kind: "activity", ref: "plan|2026-W45|Mon|scoop-and-pour|mila", state: "pending", by: "carer-1" },
      { kind: "meal", ref: "plan|2026-W45|Tue|apple-oat-porridge|mila", state: "pending", by: "carer-1" },
    ]);
  });
});
