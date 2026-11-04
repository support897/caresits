import { arrayUnion, collection, doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "@cc/core";
import type { CareRole } from "./children";
import type { Recipe } from "../content/recipes";
import type { NewShoppingItem } from "./shopping";
import type { AllergyStatus } from "../lib/allergy";
import { canApproveMealPlan } from "../lib/recipes";

export type MealPlanEntry = { childId: string; name: string; ingredients: string[] };

export function recipeShoppingItems(recipe: Recipe, childId: string, due: string): NewShoppingItem[] {
  return recipe.ingredients.map((item) => ({ item, childId, source: "meal", sourceId: recipe.id, due }));
}

export async function loadMealPlan(spaceId: string, day: string): Promise<MealPlanEntry[]> {
  const snapshot = await getDoc(doc(db, "careSpaces", spaceId, "mealPlan", day));
  const meals = snapshot.exists() ? snapshot.data().meals : [];
  return Array.isArray(meals) ? meals.map((item) => ({ childId: String(item.childId ?? ""), name: String(item.name ?? ""), ingredients: Array.isArray(item.ingredients) ? item.ingredients.map(String) : [] })) : [];
}

export async function approveMealPlanItem(input: {
  spaceId: string;
  childId: string;
  childName: string;
  day: string;
  recipe: Recipe;
  role: CareRole;
  labelsChecked: boolean;
  allergyVerified: boolean;
  allergyStatus: AllergyStatus;
}): Promise<void> {
  if (!canApproveMealPlan(input.role, input.labelsChecked, input.allergyVerified, { status: input.allergyStatus })) {
    throw new Error("Confirm allergy details, check full labels, and resolve all ingredient warnings before approving.");
  }
  const batch = writeBatch(db);
  const mealRef = doc(db, "careSpaces", input.spaceId, "mealPlan", input.day);
  batch.set(mealRef, { meals: arrayUnion({ childId: input.childId, name: input.recipe.name, ingredients: input.recipe.ingredients }) }, { merge: true });
  for (const item of recipeShoppingItems(input.recipe, input.childId, input.day)) {
    const ref = doc(collection(db, "careSpaces", input.spaceId, "shopping"));
    batch.set(ref, { ...item, bought: false, reimbursed: false });
  }
  await batch.commit();
}
