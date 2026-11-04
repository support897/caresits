import { useEffect, useMemo, useState } from "react";
import { Button, t } from "@cc/core";
import { ACTIVITIES } from "../content/activities";
import { RECIPES } from "../content/recipes";
import { decideApproval, loadApprovals, parsePlanApprovalRef, pendingApprovals, type ApprovalDecision, type ApprovalItem } from "../data/approvals";
import { DEMO_CHILDREN, loadChildren, type CareSpace, type ChildProfile } from "../data/children";
import { loadShoppingItems, type ShoppingItem } from "../data/shopping";
import { CareEmpty, DemoNotice } from "./care/common";

type ApprovalsProps = { uid: string; space: CareSpace; demo: boolean; onBack: () => void };

const DEMO_APPROVALS: ApprovalItem[] = [
  { id: "demo-activity", kind: "activity", ref: "scoop-and-pour", state: "pending", by: "demo-carer" },
  { id: "demo-meal", kind: "meal", ref: "apple-oat-porridge", state: "pending", by: "demo-carer" },
  { id: "demo-purchase", kind: "purchase", ref: "demo-shopping-item", state: "pending", by: "demo-carer" },
];
const DEMO_PURCHASES: ShoppingItem[] = [{ id: "demo-shopping-item", spaceId: "demo-johnson", item: "Large paper roll", source: "activity", bought: false, reimbursed: false }];

function kindLabel(kind: ApprovalItem["kind"]): string {
  if (kind === "activity") return t("care.approvals.kind.activity", "Activity");
  if (kind === "purchase") return t("care.approvals.kind.purchase", "Purchase");
  return t("care.approvals.kind.meal", "Meal");
}

function approvalTitle(item: ApprovalItem, purchases: readonly ShoppingItem[], children: readonly ChildProfile[]): string {
  const planRef = parsePlanApprovalRef(item.ref);
  const ref = planRef?.itemId ?? item.ref;
  const activity = item.kind === "activity" ? ACTIVITIES.find((entry) => entry.id === ref) : undefined;
  const recipe = item.kind === "meal" ? RECIPES.find((entry) => entry.id === ref) : undefined;
  const purchase = item.kind === "purchase" ? purchases.find((entry) => entry.id === item.ref) : undefined;
  const name = activity
    ? t(`care.activity.${activity.id}.title`, activity.title)
    : recipe
      ? t(`care.recipe.${recipe.id}.name`, recipe.name)
      : purchase
        ? item.id === "demo-purchase" ? t("care.approvals.demoPurchase", "Large paper roll") : purchase.item
        : item.kind === "activity"
          ? t("care.approvals.unknownActivity", "Activity request {ref}", { ref })
          : item.kind === "meal"
            ? t("care.approvals.unknownMeal", "Meal request {ref}", { ref })
            : t("care.approvals.unknownPurchase", "Purchase request {ref}", { ref: item.ref });
  if (!planRef) return name;
  const dayLabels: Record<string, [string, string]> = {
    Mon: ["care.weekly.day.mon", "Monday"], Tue: ["care.weekly.day.tue", "Tuesday"],
    Wed: ["care.weekly.day.wed", "Wednesday"], Thu: ["care.weekly.day.thu", "Thursday"],
    Fri: ["care.weekly.day.fri", "Friday"], Sat: ["care.weekly.day.sat", "Saturday"],
    Sun: ["care.weekly.day.sun", "Sunday"],
  };
  const [dayKey, englishDay] = dayLabels[planRef.day] ?? ["care.approvals.planDay", "Planned day"];
  const title = t("care.approvals.planTitle", "{day} · {kind}: {name}", {
    day: t(dayKey, englishDay), kind: kindLabel(item.kind), name,
  });
  const child = planRef.childId ? children.find((entry) => entry.id === planRef.childId) : undefined;
  return child ? t("care.approvals.planTitleChild", "{title} · {child}", { title, child: child.name }) : title;
}

function approvalDetails(item: ApprovalItem, purchases: readonly ShoppingItem[], children: readonly ChildProfile[]): string | null {
  const planRef = parsePlanApprovalRef(item.ref);
  const childName = planRef?.childId ? children.find((child) => child.id === planRef.childId)?.name : undefined;
  if (item.kind === "activity") {
    const activity = ACTIVITIES.find((entry) => entry.id === (planRef?.itemId ?? item.ref));
    if (!activity) return null;
    const detail = t("care.approvals.activityDetail", "{minutes} minutes · {goal}", {
      minutes: activity.minutes,
      goal: t(`care.activity.${activity.id}.goal`, activity.learningGoal),
    });
    return childName ? t("care.approvals.childDetail", "{detail} · For {child}", { detail, child: childName }) : detail;
  }
  if (item.kind === "meal") {
    const recipe = RECIPES.find((entry) => entry.id === (planRef?.itemId ?? item.ref));
    if (!recipe) return null;
    const ingredients = recipe.ingredients.map((ingredient, index) => t(`care.recipe.${recipe.id}.ingredient.${index}`, ingredient)).join(", ");
    const detail = t("care.approvals.mealDetail", "Ingredients: {items}", { items: ingredients });
    return childName ? t("care.approvals.childDetail", "{detail} · For {child}", { detail, child: childName }) : detail;
  }
  const purchase = purchases.find((entry) => entry.id === item.ref);
  if (!purchase) return null;
  const child = purchase.childId ? children.find((entry) => entry.id === purchase.childId)?.name : undefined;
  const due = purchase.due ? purchase.due : t("care.approvals.noDueDate", "No due date");
  const source = t(`care.approvals.source.${purchase.source}`, purchase.source);
  return t("care.approvals.purchaseDetail", "{source} · {child} · Needed: {due}", {
    source,
    child: child ? t("care.approvals.forChild", "For {child}", { child }) : t("care.approvals.familyItem", "For this family"),
    due,
  });
}

export default function Approvals({ uid, space, demo, onBack }: ApprovalsProps) {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [purchases, setPurchases] = useState<ShoppingItem[]>([]);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isAdmin = space.role === "admin";
  const waiting = useMemo(() => pendingApprovals(items), [items]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    const request = demo
      ? Promise.resolve([DEMO_APPROVALS, DEMO_PURCHASES, DEMO_CHILDREN] as const)
      : Promise.all([
        loadApprovals(space.id),
        loadShoppingItems(space.id).catch(() => [] as ShoppingItem[]),
        loadChildren(space.id).catch(() => [] as ChildProfile[]),
      ] as const);
    request.then(([approvals, shopping, childRows]) => {
      if (alive) { setItems(approvals); setPurchases(shopping); setChildren(childRows); }
    }).catch(() => { if (alive) setError(t("care.approvals.loadError", "Approvals could not load. Check your connection and try again.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [demo, space.id]);

  async function decide(item: ApprovalItem, decision: ApprovalDecision) {
    if (!isAdmin || !uid || busyId) return;
    setBusyId(item.id); setError(""); setNotice("");
    try {
      if (!demo) await decideApproval(space.id, item.id, uid, space.role, decision);
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, state: decision, decidedBy: uid } : row));
      setNotice(decision === "approved" ? t("care.approvals.approvedNotice", "Request approved.") : t("care.approvals.declinedNotice", "Request declined."));
    } catch {
      setError(t("care.approvals.decisionError", "This request could not be updated. It may already have been decided."));
    } finally { setBusyId(""); }
  }

  return <div className="care-wrap">
    <div className="care-head"><div><h1>{t("care.approvals.title", "Approvals")}</h1><p>{t("care.approvals.subtitle", "Review activity, purchase, and meal requests for {family}.", { family: space.name })}</p></div><Button alt onClick={onBack}>{t("care.approvals.back", "Back")}</Button></div>
    {demo && <DemoNotice />}
    {error && <div className="care-info care-warning" role="alert">{error}</div>}
    {notice && <div className="care-status" role="status">{notice}</div>}
    {!isAdmin && <div className="care-info" role="note"><p>{t("care.approvals.parentOnly", "Only a parent admin can approve or decline. You can still see what is waiting for review.")}</p></div>}
    {loading ? <div className="sk" style={{ height: 150 }} /> : waiting.length ? <section className="care-section" aria-label={t("care.approvals.waitingLabel", "Waiting for parent review")}>
      {waiting.map((item) => {
        const details = approvalDetails(item, purchases, children);
        return <article className="care-card" key={item.id}>
          <div className="care-head"><div><span className="care-badge">{kindLabel(item.kind)}</span><h2 style={{ marginTop: 8 }}>{approvalTitle(item, purchases, children)}</h2></div><span className="care-badge">{t("care.approvals.pending", "Needs review")}</span></div>
          <p>{t("care.approvals.requested", "Requested by a care team member.")}</p>
          {details && <p>{details}</p>}
          {item.kind === "purchase" && <p>{t("care.approvals.purchaseHint", "Check the item, family, and child before approving this purchase.")}</p>}
          {item.kind === "meal" && <div className="care-alert" role="note">{t("care.approvals.mealSafety", "Plan approval does not confirm food is safe. Check the child’s recorded allergies and every full ingredient label before serving.")}</div>}
          {isAdmin && <div className="care-actions">
            <Button disabled={Boolean(busyId)} onClick={() => void decide(item, "approved")}>{busyId === item.id ? t("care.approvals.working", "Saving…") : t("care.approvals.approve", "Approve")}</Button>
            <Button alt disabled={Boolean(busyId)} onClick={() => void decide(item, "declined")}>{t("care.approvals.decline", "Decline")}</Button>
          </div>}
        </article>;
      })}
    </section> : <CareEmpty title={t("care.approvals.emptyTitle", "Nothing needs approval")} detail={t("care.approvals.emptyBody", "New activity, purchase, and meal requests will show here.")} />}
  </div>;
}
