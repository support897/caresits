import { useEffect, useMemo, useState } from "react";
import { Button, t, useNav, type ScreenProps } from "@cc/core";
import { DEMO_CHILDREN, DEMO_SPACES, loadCareSpaces, loadChildren, saveSpaceInventory, type CareSpace, type ChildProfile } from "../data/children";
import { ACTIVITIES } from "../content/activities";
import { filterActivities, missingMaterials } from "../lib/activities";
import { CareEmpty, DemoNotice } from "./care/common";
import WeeklyPlan from "./WeeklyPlan";
import Approvals from "./Approvals";
import "./care/care.css";

type Params = { uid?: string; demo?: boolean };
const INVENTORY_OPTIONS = [
  ["paper", "Paper"], ["crayons", "Crayons"], ["books", "Books"], ["water", "Water"], ["towel", "Towel"], ["large cups", "Large cups"], ["large blocks", "Large blocks"], ["pencils", "Pencils"], ["clean empty boxes", "Clean empty boxes"], ["chalk", "Chalk"], ["shallow water tray", "Shallow water tray"], ["basket", "Basket"], ["small watering can", "Small watering can"], ["large safe objects", "Large age-appropriate objects"], ["fallen leaves", "Fallen leaves"],
] as const;
const demoMode = (explicit?: boolean) => explicit === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");
const materialLabel = (value: string) => INVENTORY_OPTIONS.find(([item]) => item === value)?.[1] ?? value;

export default function Activities({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const demo = demoMode(params.demo);
  const uid = params.uid ?? "";
  const [spaces, setSpaces] = useState<CareSpace[]>([]);
  const [space, setSpace] = useState<CareSpace | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childId, setChildId] = useState("");
  const [inventory, setInventory] = useState<string[]>([]);
  const [customItem, setCustomItem] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"activities" | "weekly" | "approvals">("activities");
  const [approvalReturnsToWeekly, setApprovalReturnsToWeekly] = useState(false);

  useEffect(() => {
    let live = true;
    (demo ? Promise.resolve(DEMO_SPACES) : uid ? loadCareSpaces(uid) : Promise.resolve([]))
      .then((value) => { if (live) setSpaces(value); })
      .catch(() => { if (live) setError(t("care.activitiesSpaceError", "Could not load family spaces.")); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [uid, demo]);

  useEffect(() => {
    if (!space) return;
    let live = true;
    setLoading(true); setInventory(space.inventory);
    (demo ? Promise.resolve(DEMO_CHILDREN) : loadChildren(space.id))
      .then((value) => { if (live) { setChildren(value); setChildId(value[0]?.id ?? ""); } })
      .catch(() => { if (live) setError(t("care.activitiesChildrenError", "Could not load children for this space.")); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [space, demo]);

  const child = children.find((item) => item.id === childId);
  const canManageInventory = space?.role === "admin" || space?.role === "regular";
  const ideas = useMemo(() => child ? filterActivities(ACTIVITIES, { ageYears: child.ageYears, interests: child.interests, owns: inventory, ownedOnly }) : [], [child, inventory, ownedOnly]);

  async function toggleOwned(item: string) {
    if (!canManageInventory) return;
    const next = inventory.includes(item) ? inventory.filter((value) => value !== item) : [...inventory, item];
    setInventory(next);
    if (!space || demo) { if (space) setSpace({ ...space, inventory: next }); return; }
    try { await saveSpaceInventory(space.id, next); setSpace({ ...space, inventory: next }); }
    catch { setError(t("care.inventorySaveError", "Could not save the family’s materials. Try again.")); }
  }

  async function addCustomItem() {
    if (!canManageInventory) return;
    const value = customItem.trim();
    if (!value || inventory.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    const next = [...inventory, value]; setInventory(next); setCustomItem("");
    if (!space || demo) { if (space) setSpace({ ...space, inventory: next }); return; }
    try { await saveSpaceInventory(space.id, next); setSpace({ ...space, inventory: next }); }
    catch { setError(t("care.inventorySaveError", "Could not save the family’s materials. Try again.")); }
  }

  if (space && panel === "weekly") return <div className="scroll"><WeeklyPlan
    uid={uid} space={space} children={children} demo={demo}
    onBack={() => setPanel("activities")}
    onOpenApprovals={() => { setApprovalReturnsToWeekly(true); setPanel("approvals"); }}
  /></div>;
  if (space && panel === "approvals") return <div className="scroll"><Approvals
    uid={uid} space={space} demo={demo}
    onBack={() => setPanel(approvalReturnsToWeekly ? "weekly" : "activities")}
  /></div>;

  return <div className="scroll"><div className="care-wrap">
    <div className="care-head"><div><h1>{t("care.activitiesTitle", "Activities")}</h1><p>{t("care.activitiesSubtitle", "Ideas shaped around a child’s age, interests, and family materials.")}</p></div></div>
    <div className="care-alert" role="note">{t("care.activityInspirationNotice", "Ideas for play. Adapt to the child and supervise.")}</div>
    {demo && <DemoNotice />}
    {error && <div className="care-info care-warning" role="alert">{error}</div>}
    {!space ? <section className="care-section">
      {spaces.map((item) => <button className="care-space-card" key={item.id} onClick={() => { setPanel("activities"); setSpace(item); }}><span className="care-badge">{item.name.slice(0, 1)}</span><span className="care-card-copy"><b>{item.name}</b><p>{t("care.chooseSpaceActivities", "Pick activities for this family only.")}</p></span><span aria-hidden="true" className="flip">›</span></button>)}
      {!loading && !spaces.length && <CareEmpty title={t("care.noActivitySpaces", "No family space selected")} detail={t("care.noActivitySpacesHint", "Activities and family materials stay separate for every care space.")} />}
    </section> : <>
      <div className="care-row"><Button alt onClick={() => { setSpace(null); setChildren([]); setChildId(""); setPanel("activities"); }}>{t("care.changeSpace", "Change family")}</Button><span className="care-badge">{space.name}</span></div>
      <div className="care-row" style={{ marginTop: 10 }}>
        <Button alt onClick={() => setPanel("weekly")}>{t("care.weekly.open", "Weekly plan")}</Button>
        <Button alt onClick={() => { setApprovalReturnsToWeekly(false); setPanel("approvals"); }}>{t("care.approvals.open", "Approvals inbox")}</Button>
      </div>
      <label className="care-field"><span>{t("care.selectChild", "Choose a child")}</span><select value={childId} onChange={(event) => setChildId(event.target.value)}>{children.map((item) => <option value={item.id} key={item.id}>{t("care.childAgeOption", "{name} · age {age}", { name: item.name, age: item.ageYears })}</option>)}</select></label>
      {child && <>
        <div className="care-card"><h2>{t("care.weHave", "We have")}</h2><p>{t("care.weHaveHint", "Choose what this family owns. This checklist is saved on the family space.")}</p>
          {!canManageInventory && <p className="care-muted">{t("care.inventoryReadOnly", "Only a family admin or regular carer can change this family checklist.")}</p>}
          <div className="care-inventory">{INVENTORY_OPTIONS.map(([item, label]) => <label className="care-check" key={item}><input type="checkbox" checked={inventory.includes(item)} disabled={!canManageInventory} onChange={() => void toggleOwned(item)} /><span>{t(`care.material.${item.replaceAll(" ", "-")}`, label)}</span></label>)}</div>
          {inventory.filter((item) => !INVENTORY_OPTIONS.some(([value]) => value === item)).map((item) => <label className="care-check" key={item}><input type="checkbox" checked disabled={!canManageInventory} onChange={() => void toggleOwned(item)} /><span>{item}</span></label>)}
          <div className="care-row"><label className="care-field" style={{ flex: 1 }}><span>{t("care.addMaterial", "Add another material")}</span><input value={customItem} disabled={!canManageInventory} onChange={(event) => setCustomItem(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addCustomItem(); } }} /></label><Button alt small onClick={() => void addCustomItem()} disabled={!customItem.trim()}>{t("care.addMaterialAction", "Add")}</Button></div>
          <label className="care-check"><input type="checkbox" checked={ownedOnly} onChange={(event) => setOwnedOnly(event.target.checked)} /><span>{t("care.onlyOwnedActivities", "Show only activities with materials we have")}</span></label>
        </div>
        <div className="care-row"><span className="care-badge">{t("care.ageBadge", "Age {age}", { age: child.ageYears })}</span>{child.interests.map((interest) => <span className="care-badge" key={interest}>{interest}</span>)}</div>
        <section className="care-section">
          {ideas.map((activity) => {
            const missing = missingMaterials(activity, inventory);
            return <button className="care-child-card" key={activity.id} onClick={() => nav.push("activity", { activityId: activity.id, spaceId: space.id, childId: child.id, childName: child.name, uid, ownerUid: space.ownerUid, role: space.role, perms: space.perms, demo })}>
              <span className="care-badge">{t("care.minutesShort", "{minutes} min", { minutes: activity.minutes })}</span>
              <span className="care-card-copy"><b>{t(`care.activity.${activity.id}.title`, activity.title)}</b><p>{t("care.activityLength", "{minutes} minutes · {goal}", { minutes: activity.minutes, goal: t(`care.activity.${activity.id}.goal`, activity.learningGoal) })}</p><p>{missing.length ? t("care.materialsMissing", "Needs: {items}", { items: missing.map(materialLabel).join(", ") }) : t("care.materialsReady", "Ready with what this family has")}</p></span>
              <span aria-hidden="true" className="flip">›</span>
            </button>;
          })}
          {!ideas.length && <CareEmpty title={t("care.noActivitiesMatch", "No activity matches these choices")} detail={t("care.noActivitiesMatchHint", "Try turning off the materials filter or add more family materials.")} />}
        </section>
      </>}
    </>}
  </div></div>;
}
