import { useEffect, useMemo, useState } from "react";
import { BackBar, Button, t, useNav, type ScreenProps } from "@cc/core";
import { DEMO_CHILDREN, loadChildren, type CarePerms, type CareRole, type ChildProfile } from "../data/children";
import { canReadMedicalRecord, DEMO_MEDICAL, loadMedicalRecord } from "../data/medical";
import { approveMealPlanItem, loadMealPlan, type MealPlanEntry } from "../data/meals";
import { RECIPES, type Recipe } from "../content/recipes";
import { checkRecipe } from "../lib/recipes";
import { AllergyBanner, AllergyCheckNotice, CareEmpty, DemoNotice } from "./care/common";
import "./care/care.css";

type Params = { spaceId?: string; childId?: string; childName?: string; uid?: string; ownerUid?: string; role?: CareRole; perms?: CarePerms; demo?: boolean };
const demoMode = (explicit?: boolean) => explicit === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");
const todayKey = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); };
const recipeLabel = (name: string) => { const recipe = RECIPES.find((item) => item.name === name); return recipe ? t(`care.recipe.${recipe.id}.name`, recipe.name) : name; };
const recipeIngredientsLabel = (name: string, ingredients: string[]) => { const recipe = RECIPES.find((item) => item.name === name); return ingredients.map((ingredient, index) => recipe ? t(`care.recipe.${recipe.id}.ingredient.${index}`, ingredient) : ingredient).join(", "); };

export default function Meals({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const demo = demoMode(params.demo);
  const spaceId = params.spaceId ?? "";
  const childId = params.childId ?? "";
  const uid = params.uid ?? "";
  const role = params.role ?? (demo ? "admin" : "viewer");
  const perms = params.perms ?? { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false };
  const canReadMedical = canReadMedicalRecord({ role, perms });
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChild, setSelectedChild] = useState(childId);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [labelsChecked, setLabelsChecked] = useState(false);
  const [plan, setPlan] = useState<MealPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const day = useMemo(todayKey, []);
  const selected = children.find((child) => child.id === selectedChild);
  const selectedCheck = selectedRecipe ? checkRecipe(selectedRecipe, allergies) : null;
  const mayApprove = role === "admin" && canReadMedical && selectedRecipe !== null && labelsChecked && selectedCheck?.status !== "contains" && selectedCheck?.status !== "may-contain";

  useEffect(() => {
    let live = true;
    if (!spaceId) { setLoading(false); return; }
    setLoading(true);
    setAllergies([]);
    const childrenRequest = demo ? Promise.resolve(DEMO_CHILDREN) : loadChildren(spaceId);
    childrenRequest.then(async (list) => {
      if (!live) return;
      setChildren(list);
      if (!selectedChild && list[0]) setSelectedChild(list[0].id);
      const target = list.find((child) => child.id === (selectedChild || childId)) ?? list[0];
      if (demo) setAllergies(DEMO_MEDICAL[target?.id ?? ""]?.allergies.map((item) => item.name) ?? []);
      else if (target && canReadMedical) {
        const medical = await loadMedicalRecord(spaceId, target.id, { role, perms });
        if (live) setAllergies(medical?.allergies.map((item) => item.name) ?? []);
      } else if (live) setAllergies([]);
    }).catch(() => { if (live) setError(t("care.mealLoadError", "Could not load meal planning details.")); });
    const planRequest = demo ? Promise.resolve([] as MealPlanEntry[]) : loadMealPlan(spaceId, day);
    planRequest.then((value) => { if (live) setPlan(value); }).catch(() => { if (live) setError(t("care.mealPlanLoadError", "Could not load today’s meal plan.")); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [spaceId, childId, selectedChild, demo, day, canReadMedical, role, perms]);

  async function approve() {
    if (!selectedRecipe || !selected || !mayApprove) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (!demo) await approveMealPlanItem({ spaceId, childId: selected.id, childName: selected.name, day, recipe: selectedRecipe, role, labelsChecked });
      setPlan((current) => [...current, { childId: selected.id, name: selectedRecipe.name, ingredients: selectedRecipe.ingredients }]);
      setNotice(t("care.mealApproved", "Meal approved. Its ingredients were added to this family’s shopping list."));
      setSelectedRecipe(null); setLabelsChecked(false);
    } catch { setError(t("care.mealApproveError", "Could not approve this meal. Check admin access and try again.")); }
    finally { setBusy(false); }
  }

  return <div className="app">
    <BackBar title={t("care.mealsTitle", "Meals and recipes")} onBack={nav.back} right={<span className="care-badge">{day}</span>} />
    <div className="scroll"><div className="care-wrap">
      {demo && <DemoNotice />}
      {error && <div className="care-info care-warning" role="alert">{error}</div>}
      {notice && <div className="care-status" role="status">{notice}<div className="care-row"><Button alt small onClick={() => nav.push("shopping", { spaceId, childId: selectedChild, uid, ownerUid: params.ownerUid, role, perms, demo })}>{t("care.openShopping", "Open shopping list")}</Button></div></div>}
      <div className="care-head"><div><h1>{t("care.mealsTitle", "Meals and recipes")}</h1><p>{t("care.mealsSubtitle", "Check ingredients against the child’s recorded allergies before planning.")}</p></div></div>
      {!canReadMedical && <div className="care-alert" role="alert"><strong>{t("care.allergyInfoMissing", "Allergy details are not available to you.")}</strong><p>{t("care.allergyInfoMissingHint", "This meal list is not checked for this child. Ask a parent before planning or serving food.")}</p></div>}
      {children.length > 0 && <label className="care-field"><span>{t("care.selectChild", "Choose a child")}</span><select value={selectedChild} onChange={(event) => { setSelectedChild(event.target.value); setSelectedRecipe(null); setLabelsChecked(false); }}><option value="" disabled>{t("care.selectChildPlaceholder", "Choose a child")}</option>{children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}</select></label>}
      {!!allergies.length && <AllergyBanner names={allergies} />}
      {selected && canReadMedical && <section className="care-card care-section"><h2>{t("care.allergyHooks", "Ingredient checks for {child}", { child: selected.name })}</h2><p>{t("care.allergyHookHint", "Each recipe is checked with a conservative word match. A missing match does not confirm that food is suitable.")}</p></section>}
      <section className="care-section">
        <h2>{t("care.recipes", "Recipes")}</h2>
        {RECIPES.map((recipe) => {
          const result = checkRecipe(recipe, allergies);
          return <article className="care-card care-recipe" key={recipe.id}>
            <div className="care-head"><div><h3>{t(`care.recipe.${recipe.id}.name`, recipe.name)}</h3><p>{t("care.recipeMeta", "{meal} · {minutes} minutes", { meal: t(`care.mealType.${recipe.meal}`, recipe.meal), minutes: recipe.minutes })}</p></div><span className="care-badge">{t("care.ingredientsCount", "{count} ingredients", { count: recipe.ingredients.length })}</span></div>
            <p><b>{t("care.ingredients", "Ingredients")}</b> · {recipe.ingredients.map((ingredient, index) => t(`care.recipe.${recipe.id}.ingredient.${index}`, ingredient)).join(", ")}</p>
            {canReadMedical ? <AllergyCheckNotice result={result} /> : <p className="care-muted">{t("care.recipeNotChecked", "Allergy match not checked. Ask the parent before using this recipe.")}</p>}
            <Button alt onClick={() => { setSelectedRecipe(recipe); setLabelsChecked(false); }}>{t("care.viewRecipe", "View recipe and plan")}</Button>
          </article>;
        })}
      </section>
      {selectedRecipe && <section className="care-card care-section">
        <h2>{t(`care.recipe.${selectedRecipe.id}.name`, selectedRecipe.name)}</h2>
        <ol className="care-steps">{selectedRecipe.steps.map((step, index) => <li key={`${index}-${step}`}>{t(`care.recipe.${selectedRecipe.id}.step.${index}`, step)}</li>)}</ol>
        {canReadMedical && selectedCheck && <AllergyCheckNotice result={selectedCheck} />}
        {!canReadMedical && <div className="care-alert" role="alert">{t("care.allergyInfoMissingHint", "This meal list is not checked for this child. Ask a parent before planning or serving food.")}</div>}
        {canReadMedical && role === "admin" && <>
          <label className="care-check"><input type="checkbox" checked={labelsChecked} onChange={(event) => setLabelsChecked(event.target.checked)} /><span>{t("care.labelsChecked", "I checked the full labels and confirmed this meal with the parent.")}</span></label>
          {(selectedCheck?.status === "contains" || selectedCheck?.status === "may-contain") && <p className="care-muted">{t("care.blockFlaggedMeal", "This recipe has a matching allergy or cross-contact warning. Do not add it to the plan.")}</p>}
          <Button onClick={() => void approve()} disabled={!mayApprove || busy}>{t("care.approveMeal", "Approve meal and add ingredients to shopping")}</Button>
        </>}
        {role !== "admin" && <p className="care-muted">{t("care.mealAdminOnly", "Only an admin can approve a meal plan.")}</p>}
        <Button alt onClick={() => setSelectedRecipe(null)}>{t("care.close", "Close recipe")}</Button>
      </section>}
      <section className="care-section">
        <h2>{t("care.mealPlanToday", "Today’s meal plan")}</h2>
        {loading ? <div className="sk" style={{ height: 96 }} /> : plan.length ? <ul className="care-list">{plan.map((meal, index) => <li key={`${meal.childId}-${meal.name}-${index}`}><b>{recipeLabel(meal.name)}</b><p>{children.find((child) => child.id === meal.childId)?.name ?? selected?.name ?? ""} · {recipeIngredientsLabel(meal.name, meal.ingredients)}</p></li>)}</ul> : <CareEmpty title={t("care.noMealsPlanned", "No meals planned yet")} detail={t("care.noMealsPlannedHint", "Choose a recipe to see the ingredient checks and plan it for a child.")} />}
      </section>
    </div></div>
  </div>;
}
