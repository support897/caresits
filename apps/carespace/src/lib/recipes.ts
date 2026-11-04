import { checkAllergy, type AllergyCheck, type AllergyInput } from "./allergy";
import type { Recipe } from "../content/recipes";

export function checkRecipe(recipe: Pick<Recipe, "ingredients">, allergies: readonly AllergyInput[]): AllergyCheck {
  return checkAllergy(recipe.ingredients.join(", "), allergies);
}

export function recipeIngredientText(recipe: Pick<Recipe, "ingredients">): string {
  return recipe.ingredients.join(", ");
}

export function canApproveMealPlan(
  role: string,
  labelsChecked: boolean,
  allergyVerified: boolean,
  result: Pick<AllergyCheck, "status"> | null,
): boolean {
  return role === "admin" && labelsChecked && allergyVerified && result?.status === "no-match-found";
}
