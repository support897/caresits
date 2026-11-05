import { useEffect, useMemo, useState } from "react";
import { Button, t, useNav } from "@cc/core";
import { ACTIVITIES } from "../content/activities";
import { RECIPES } from "../content/recipes";
import { filterActivities } from "../lib/activities";
import { loadApprovals, planApprovalRequests, planApprovalStatus, requestWeeklyPlanReview, type ApprovalItem } from "../data/approvals";
import {
  addPlanEntry, approveWeeklyPlan, buildEmptyPlanDays, decodePlanEntry, encodePlanEntry,
  hasPlanEntries, loadWeeklyPlan, PLAN_WEEKDAYS, removePlanEntry, saveWeeklyPlan, weekIdFor,
  type PlanDays, type PlanWeekday, type WeeklyPlan,
} from "../data/plans";
import type { CareSpace, ChildProfile } from "../data/children";
import { CareEmpty, DemoNotice } from "./care/common";

type WeeklyPlanProps = {
  uid: string;
  space: CareSpace;
  children: ChildProfile[];
  demo: boolean;
  onBack: () => void;
  onOpenApprovals: () => void;
};

const DAY_LABELS: Record<PlanWeekday, [string, string]> = {
  Mon: ["care.weekly.day.mon", "Monday"], Tue: ["care.weekly.day.tue", "Tuesday"],
  Wed: ["care.weekly.day.wed", "Wednesday"], Thu: ["care.weekly.day.thu", "Thursday"],
  Fri: ["care.weekly.day.fri", "Friday"], Sat: ["care.weekly.day.sat", "Saturday"],
  Sun: ["care.weekly.day.sun", "Sunday"],
};

function demoWeeklyPlan(): WeeklyPlan {
  const days = buildEmptyPlanDays();
  days.Mon = [encodePlanEntry({ kind: "activity", itemId: "scoop-and-pour", childId: "demo-mila" })];
  days.Wed = [encodePlanEntry({ kind: "meal", itemId: "apple-oat-porridge", childId: "demo-mila" })];
  return { days };
}

function planEntryTitle(value: string, children: ChildProfile[]): string {
  const entry = decodePlanEntry(value);
  if (entry.kind === "other") return entry.label;
  const childName = children.find((child) => child.id === entry.childId)?.name ?? "";
  const activity = entry.kind === "activity" ? ACTIVITIES.find((item) => item.id === entry.itemId) : undefined;
  const recipe = entry.kind === "meal" ? RECIPES.find((item) => item.id === entry.itemId) : undefined;
  const name = activity
    ? t(`care.activity.${activity.id}.title`, activity.title)
    : recipe
      ? t(`care.recipe.${recipe.id}.name`, recipe.name)
      : t("care.weekly.unknownItem", "Saved item");
  const kind = entry.kind === "activity" ? t("care.weekly.activity", "Activity") : t("care.weekly.meal", "Meal");
  const forChild = childName ? t("care.weekly.forChild", "for {child}", { child: childName }) : "";
  return t("care.weekly.entryTitle", "{kind} · {name}{child}", { kind, name, child: forChild ? ` · ${forChild}` : "" });
}

export default function WeeklyPlan({ uid, space, children, demo, onBack, onOpenApprovals }: WeeklyPlanProps) {
  const nav = useNav();
  const weekId = useMemo(() => weekIdFor(), []);
  const [plan, setPlan] = useState<WeeklyPlan>({ days: buildEmptyPlanDays() });
  const [childId, setChildId] = useState(children[0]?.id ?? "");
  const [activityId, setActivityId] = useState("");
  const [mealId, setMealId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [approvalRows, setApprovalRows] = useState<ApprovalItem[]>([]);
  const [reviewStatusUnknown, setReviewStatusUnknown] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const approvalStatus = useMemo(() => planApprovalStatus(weekId, plan.days, approvalRows), [weekId, plan.days, approvalRows]);
  const canEdit = !approvalStatus.pending && !reviewStatusUnknown
    && (space.role === "admin" || ((space.role === "regular" || space.role === "limited") && !plan.approvedBy));
  const canRequestReview = space.role === "regular" || space.role === "limited";
  const selectedChild = children.find((child) => child.id === childId);
  const activityChoices = useMemo(() => selectedChild
    ? filterActivities(ACTIVITIES, { ageYears: selectedChild.ageYears, interests: selectedChild.interests, owns: space.inventory, ownedOnly: false })
    : [], [selectedChild, space.inventory]);

  useEffect(() => {
    setChildId((current) => children.some((child) => child.id === current) ? current : children[0]?.id ?? "");
  }, [children]);

  useEffect(() => {
    setActivityId((current) => activityChoices.some((activity) => activity.id === current) ? current : "");
  }, [activityChoices]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(""); setApprovalRows([]); setReviewStatusUnknown(false);
    const planRequest = demo ? Promise.resolve(demoWeeklyPlan()) : loadWeeklyPlan(space.id, weekId);
    const approvalRequest = demo ? Promise.resolve([] as ApprovalItem[]) : loadApprovals(space.id).catch(() => {
      if (alive) {
        setReviewStatusUnknown(true);
        setError(t("care.weekly.reviewStatusError", "Parent review status could not load. Editing is paused until access returns."));
      }
      return [];
    });
    Promise.all([planRequest, approvalRequest]).then(([value, approvals]) => {
      if (!alive) return;
      setPlan(value);
      setApprovalRows(approvals);
    }).catch(() => { if (alive) setError(t("care.weekly.loadError", "The weekly plan could not load. Try again.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [demo, space.id, weekId]);

  async function persistDays(nextDays: PlanDays) {
    if (loading || saving || reviewing || !canEdit) return;
    const previous = plan;
    setPlan({ ...previous, days: nextDays });
    setSaving(true); setError(""); setNotice("");
    try {
      if (!demo) await saveWeeklyPlan(space.id, weekId, nextDays, space.role);
      setNotice(t("care.weekly.saved", "Weekly plan saved."));
    } catch {
      setPlan(previous);
      setError(t("care.weekly.saveError", "The weekly plan could not save. Check your connection and access."));
    } finally { setSaving(false); }
  }

  async function addItem(day: PlanWeekday, kind: "activity" | "meal") {
    if (loading || saving || reviewing || !canEdit) return;
    if (!childId) { setError(t("care.weekly.chooseChild", "Choose a child before adding an item.")); return; }
    const itemId = kind === "activity" ? activityId : mealId;
    if (!itemId) return;
    if (kind === "activity" && !activityChoices.some((activity) => activity.id === itemId)) {
      setError(t("care.weekly.activityAgeMismatch", "Choose an activity matched to this child’s age and interests."));
      return;
    }
    try {
      const nextDays = addPlanEntry(plan.days, day, { kind, itemId, childId });
      if (nextDays !== plan.days) await persistDays(nextDays);
    } catch (reason) {
      setError(reason instanceof Error && reason.message === "plan-day-full"
        ? t("care.weekly.dayFull", "This day already has 20 items. Remove one before adding another.")
        : t("care.weekly.addError", "This item could not be added. Try again."));
    }
  }

  async function removeItem(day: PlanWeekday, index: number) {
    if (loading || !canEdit || saving || reviewing) return;
    await persistDays(removePlanEntry(plan.days, day, index));
  }

  async function approvePlan() {
    if (space.role !== "admin" || !uid || !hasPlanEntries(plan.days) || plan.approvedBy || saving || reviewing || approvalStatus.pending || approvalStatus.declined || reviewStatusUnknown) return;
    setSaving(true); setError(""); setNotice("");
    try {
      if (!demo) await approveWeeklyPlan(space.id, weekId, uid, space.role);
      setPlan((current) => ({ ...current, approvedBy: uid }));
      setNotice(t("care.weekly.approved", "Weekly plan approved."));
    } catch {
      setError(t("care.weekly.approveError", "The plan could not be approved. Parent admin access and a saved plan are required."));
    } finally { setSaving(false); }
  }

  async function requestParentReview() {
    if (!canRequestReview || !uid || !hasPlanEntries(plan.days) || loading || reviewing || saving) return;
    setReviewing(true); setError(""); setNotice("");
    try {
      const count = demo
        ? Object.values(plan.days).flat().length
        : await requestWeeklyPlanReview(space.id, weekId, plan.days, uid);
      const requests = planApprovalRequests(weekId, plan.days, uid);
      setApprovalRows((current) => {
        const existing = new Set(current.map((item) => `${item.kind}|${item.ref}`));
        const added = requests.map((request, index) => ({ id: `local-${weekId}-${index}`, ...request }))
          .filter((item) => !existing.has(`${item.kind}|${item.ref}`));
        return [...current, ...added];
      });
      setNotice(count
        ? t("care.weekly.reviewSent", "Sent {count} plan items to the parent approvals inbox.", { count })
        : t("care.weekly.reviewAlreadySent", "These plan items are already waiting for parent review."));
    } catch {
      setError(t("care.weekly.reviewError", "The plan could not be sent for review. Save an activity or meal first, then try again."));
    } finally { setReviewing(false); }
  }

  return <div className="care-wrap">
    <div className="care-head"><div><h1>{t("care.weekly.title", "Weekly plan")}</h1><p>{t("care.weekly.weekLabel", "Week {week}", { week: weekId })}</p></div><div className="care-row"><Button alt onClick={onOpenApprovals}>{t("care.weekly.openApprovals", "Approvals")}</Button><Button alt onClick={onBack}>{t("care.weekly.back", "Activities")}</Button></div></div>
    {demo && <DemoNotice />}
    {error && <div className="care-info care-warning" role="alert">{error}</div>}
    {notice && <div className="care-status" role="status">{notice}</div>}
    <div className="care-info" role="note">
      <p>{t("care.weekly.safetyNote", "Plans don't check allergies. Use Meals to check labels.")}</p>
      <Button alt small disabled={!selectedChild} onClick={() => selectedChild && nav.push("meals", { spaceId: space.id, childId: selectedChild.id, childName: selectedChild.name, uid, ownerUid: space.ownerUid, role: space.role, perms: space.perms, demo })}>{t("care.weekly.reviewMeals", "Check meals and allergies")}</Button>
    </div>
    <section className="care-card care-section">
      <h2>{t("care.weekly.addItems", "Choose what to add")}</h2>
      <div className="care-grid">
        <label className="care-field"><span>{t("care.selectChild", "Choose a child")}</span><select value={childId} disabled={!children.length || !canEdit || saving || loading || reviewing} onChange={(event) => setChildId(event.target.value)}>
          {!children.length && <option value="">{t("care.weekly.noChildren", "No children in this space")}</option>}
          {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
        </select></label>
        <label className="care-field"><span>{t("care.weekly.activityChoice", "Activity")}</span><select value={activityId} disabled={!canEdit || saving || loading || reviewing || !selectedChild} onChange={(event) => setActivityId(event.target.value)}>
          <option value="">{t("care.weekly.chooseActivity", "Choose an activity")}</option>
          {activityChoices.map((activity) => <option key={activity.id} value={activity.id}>{t(`care.activity.${activity.id}.title`, activity.title)}</option>)}
        </select></label>
        <label className="care-field"><span>{t("care.weekly.mealChoice", "Meal")}</span><select value={mealId} disabled={!canEdit || saving || loading || reviewing || !selectedChild} onChange={(event) => setMealId(event.target.value)}>
          <option value="">{t("care.weekly.chooseMeal", "Choose a meal")}</option>
          {RECIPES.map((recipe) => <option key={recipe.id} value={recipe.id}>{t(`care.recipe.${recipe.id}.name`, recipe.name)}</option>)}
        </select></label>
      </div>
      {!canEdit && <p className="care-muted">{reviewStatusUnknown
        ? t("care.weekly.reviewStatusError", "Parent review status could not load. Editing is paused until access returns.")
        : approvalStatus.pending
          ? t("care.weekly.reviewPendingLock", "Waiting for a parent. Changes paused.")
          : space.role === "viewer"
            ? t("care.weekly.viewerReadOnly", "View only.")
            : t("care.weekly.locked", "Approved by a parent. Locked.")}</p>}
    </section>
    {loading ? <div className="sk" style={{ height: 240 }} /> : children.length === 0 ? <CareEmpty title={t("care.weekly.noChildren", "No children in this space")} detail={t("care.weekly.noChildrenHint", "Add a child before making a weekly plan.")} /> : <section className="care-grid" aria-label={t("care.weekly.daysLabel", "Weekly plan days")}>
      {PLAN_WEEKDAYS.map((day) => {
        const [dayKey, dayName] = DAY_LABELS[day];
        const entries = plan.days[day];
        return <article className="care-card" key={day}>
          <h2>{t(dayKey, dayName)}</h2>
          {entries.length ? <ul className="care-list">{entries.map((value, index) => <li key={`${value}-${index}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ minWidth: 0, flex: 1 }}>{planEntryTitle(value, children)}</span>
            <button type="button" className="profile-action" disabled={!canEdit || saving || loading || reviewing} aria-label={t("care.weekly.removeEntry", "Remove {item}", { item: planEntryTitle(value, children) })} onClick={() => void removeItem(day, index)}>{t("care.weekly.remove", "Remove")}</button>
          </li>)}</ul> : <p className="care-muted">{t("care.weekly.dayEmpty", "Nothing planned yet.")}</p>}
          <div className="care-row" style={{ marginTop: 10 }}>
            <Button alt small disabled={!canEdit || saving || loading || reviewing || !activityId || !childId} onClick={() => void addItem(day, "activity")}>{t("care.weekly.addActivity", "Add activity")}</Button>
            <Button alt small disabled={!canEdit || saving || loading || reviewing || !mealId || !childId} onClick={() => void addItem(day, "meal")}>{t("care.weekly.addMeal", "Add meal")}</Button>
          </div>
        </article>;
      })}
    </section>}
    <section className="care-card care-section">
      <div className="care-head"><div><h2>{t("care.weekly.parentReview", "Parent review")}</h2><p>{plan.approvedBy ? t("care.weekly.approvedByParent", "A parent admin approved this week’s plan.") : t("care.weekly.waitingParent", "A parent admin can approve this saved plan.")}</p></div><span className="care-badge">{plan.approvedBy ? t("care.weekly.statusApproved", "Approved") : t("care.weekly.statusPending", "Needs approval")}</span></div>
      {approvalStatus.pending && <p className="care-muted" role="status">{t("care.weekly.reviewPendingLock", "Waiting for a parent. Changes paused.")}</p>}
      {approvalStatus.declined && <p className="care-muted" role="note">{t("care.weekly.reviewDeclined", "Some items were declined. Replace them first.")}</p>}
      {space.role === "admin" && <Button onClick={() => void approvePlan()} disabled={saving || loading || reviewing || !hasPlanEntries(plan.days) || !uid || Boolean(plan.approvedBy) || approvalStatus.pending || approvalStatus.declined || reviewStatusUnknown}>{saving ? t("care.weekly.saving", "Saving…") : plan.approvedBy ? t("care.weekly.approvedAction", "Plan approved") : t("care.weekly.approveAction", "Approve weekly plan")}</Button>}
      {canRequestReview && <>
        <p className="care-muted">{t("care.weekly.requestHint", "Send items to the parent for review.")}</p>
        <Button alt onClick={() => void requestParentReview()} disabled={reviewing || saving || loading || approvalStatus.pending || reviewStatusUnknown || !hasPlanEntries(plan.days) || !uid}>{reviewing ? t("care.weekly.sendingReview", "Sending for review…") : t("care.weekly.requestReview", "Send to parent for review")}</Button>
      </>}
      {space.role === "viewer" && <p className="care-muted">{t("care.weekly.viewerReview", "A caregiver can send this plan to a parent for review.")}</p>}
    </section>
  </div>;
}
