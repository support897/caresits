import { useEffect, useMemo, useState } from "react";
import { BackBar, Button, t, useNav, type ScreenProps } from "@cc/core";
import { ACTIVITIES, type ActivityVariant } from "../content/activities";
import { DEMO_SPACES, loadCareSpace, type CarePerms, type CareRole } from "../data/children";
import { addShoppingItems } from "../data/shopping";
import { missingMaterials } from "../lib/activities";
import { CareEmpty, DemoNotice } from "./care/common";
import "./care/care.css";

type Params = { activityId?: string; spaceId?: string; childId?: string; childName?: string; uid?: string; ownerUid?: string; role?: CareRole; perms?: CarePerms; demo?: boolean };
type VariantKey = "base" | "simpler" | "moreKids" | "spanish";
const demoMode = (explicit?: boolean) => explicit === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");

export default function ActivityDetail({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const demo = demoMode(params.demo);
  const activity = ACTIVITIES.find((item) => item.id === params.activityId);
  const [inventory, setInventory] = useState<string[]>([]);
  const [variant, setVariant] = useState<VariantKey>("base");
  const [due, setDue] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    if (!params.spaceId) return;
    (demo ? Promise.resolve(DEMO_SPACES[0]) : loadCareSpace(params.spaceId))
      .then((space) => { if (live && space) setInventory(space.inventory); })
      .catch(() => { if (live) setError(t("care.activityInventoryError", "Could not load this family’s materials. You can still add materials to its list.")); });
    return () => { live = false; };
  }, [params.spaceId, demo]);

  const version = useMemo<ActivityVariant | null>(() => {
    if (!activity || variant === "base") return null;
    return activity[variant];
  }, [activity, variant]);
  const missing = activity ? missingMaterials(activity, inventory) : [];
  const displayedMaterials = variant === "spanish" && activity ? activity.spanish.materials : activity?.materials.map((material, index) => t(`care.activity.${activity.id}.material.${index}`, material)) ?? [];
  const displayedSteps = variant === "base" && activity ? activity.steps.map((step, index) => t(`care.activity.${activity.id}.step.${index}`, step)) : variant === "spanish" && activity ? activity.spanish.steps : version?.steps.map((step, index) => t(`care.activity.${activity?.id}.${variant}.step.${index}`, step)) ?? [];
  const displayedTitle = variant === "base" && activity ? t(`care.activity.${activity.id}.title`, activity.title) : variant === "spanish" ? activity?.spanish.title ?? "" : version && activity ? t(`care.activity.${activity.id}.${variant}.title`, version.title) : "";
  const displayedGoal = variant === "base" && activity ? t(`care.activity.${activity.id}.goal`, activity.learningGoal) : variant === "spanish" && activity ? activity.spanish.learningGoal : version && activity ? t(`care.activity.${activity.id}.${variant}.goal`, version.learningGoal) : "";

  async function addMaterials() {
    if (!params.spaceId || !activity || !missing.length) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (!demo) await addShoppingItems(params.spaceId, missing.map((item) => ({ item, childId: params.childId, source: "activity", sourceId: activity.id, buyer: params.uid, due: due || undefined })));
      setNotice(t("care.activityMaterialsAdded", "Missing materials added to {family}’s shopping list.", { family: demo ? DEMO_SPACES[0]!.name : t("care.family", "this family") }));
    } catch { setError(t("care.activityShoppingError", "Could not add these materials to the family list.")); }
    finally { setBusy(false); }
  }

  if (!activity) return <div className="app"><BackBar title={t("care.activityTitle", "Activity")} onBack={nav.back} /><div className="scroll"><CareEmpty title={t("care.activityNotFound", "Activity not found")} detail={t("care.activityNotFoundHint", "Go back and choose another idea.")} /></div></div>;
  return <div className="app">
    <BackBar title={t("care.activityTitle", "Activity")} onBack={nav.back} />
    <div className="scroll"><div className="care-wrap">
      {demo && <DemoNotice />}
      {error && <div className="care-info care-warning" role="alert">{error}</div>}
      {notice && <div className="care-status" role="status">{notice}</div>}
      <div className="care-head"><div><h1>{displayedTitle}</h1><p>{t("care.activityDetailLength", "{minutes} minutes · for ages {min}–{max}", { minutes: activity.minutes, min: activity.minAge, max: activity.maxAge })}</p></div></div>
      {params.childName && <p className="care-muted">{t("care.activityForChild", "For {child}", { child: params.childName })}</p>}
      <div className="care-row">{activity.interests.map((interest) => <span className="care-badge" key={interest}>{t(`care.interest.${interest.replaceAll(" ", "-")}`, interest)}</span>)}</div>
      <section className="care-card care-section"><h2>{t("care.materials", "Materials")}</h2><ul className="care-list">{displayedMaterials.map((material, index) => { const baseMaterial = variant === "base" ? activity.materials[index] ?? material : material; const hasIt = inventory.some((item) => item.toLowerCase().includes(baseMaterial.toLowerCase()) || baseMaterial.toLowerCase().includes(item.toLowerCase())); return <li key={`${index}-${material}`}>{material}{variant === "base" && <span className="care-muted">{hasIt ? ` · ${t("care.haveMaterial", "we have this")}` : ` · ${t("care.needMaterial", "not on the family list")}`}</span>}</li>; })}</ul></section>
      <section className="care-card care-section"><h2>{t("care.steps", "Steps")}</h2><ol className="care-steps">{displayedSteps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol></section>
      <section className="care-card care-section"><h2>{t("care.learningGoal", "Learning goal")}</h2><p>{displayedGoal}</p></section>
      <section className="care-card care-section">
        <h2>{t("care.tryVersion", "Try another version")}</h2>
        <div className="care-actions">
          <Button alt aria-pressed={variant === "simpler"} onClick={() => setVariant(variant === "simpler" ? "base" : "simpler")}>{t("care.simpler", "Simpler")}</Button>
          <Button alt aria-pressed={variant === "moreKids"} onClick={() => setVariant(variant === "moreKids" ? "base" : "moreKids")}>{t("care.moreKids", "More kids")}</Button>
          <Button alt aria-pressed={variant === "spanish"} onClick={() => setVariant(variant === "spanish" ? "base" : "spanish")}>{t("care.spanishVersion", "Spanish version")}</Button>
        </div>
      </section>
      <section className="care-card care-section">
        <h2>{t("care.addMaterialsShopping", "Add materials to shopping list")}</h2>
        {missing.length ? <p>{t("care.missingMaterialsLabel", "Missing: {items}", { items: missing.join(", ") })}</p> : <p>{t("care.allMaterialsOwned", "The family checklist has all these materials.")}</p>}
        <label className="care-field"><span>{t("care.dueDate", "Needed by")}</span><input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label>
        <Button onClick={() => void addMaterials()} disabled={busy || !params.spaceId || !missing.length}>{t("care.addMaterialsShoppingButton", "Add materials to shopping list")}</Button>
      </section>
    </div></div>
  </div>;
}
