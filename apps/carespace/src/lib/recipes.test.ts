import { describe, expect, it } from "vitest";
import { RECIPES } from "../content/recipes";
import { canApproveMealPlan, checkRecipe } from "./recipes";

describe("recipe allergy checks", () => {
  it("checks each recipe ingredient against child allergies", () => {
    const pasta = RECIPES.find((recipe) => recipe.id === "pumpkin-pasta");
    expect(pasta).toBeDefined();
    expect(checkRecipe(pasta!, ["gluten"]).status).toBe("contains");
  });

  it("keeps an explicit non-guarantee when there is no match", () => {
    const stew = RECIPES.find((recipe) => recipe.id === "bean-tomato-stew");
    const result = checkRecipe(stew!, ["egg"]);
    expect(result.status).toBe("no-match-found");
    expect(result.reasons.join(" ")).toContain("No match found is not a safety guarantee.");
  });

  it("allows meal planning only for an admin after label confirmation and no warnings", () => {
    expect(canApproveMealPlan("admin", true, true, { status: "no-match-found" })).toBe(true);
    expect(canApproveMealPlan("admin", true, false, { status: "no-match-found" })).toBe(false);
    expect(canApproveMealPlan("regular", true, true, { status: "no-match-found" })).toBe(false);
    expect(canApproveMealPlan("admin", false, true, { status: "no-match-found" })).toBe(false);
    expect(canApproveMealPlan("admin", true, true, { status: "unknown-ingredient" })).toBe(false);
    expect(canApproveMealPlan("admin", true, true, { status: "contains" })).toBe(false);
    expect(canApproveMealPlan("admin", true, true, { status: "may-contain" })).toBe(false);
    expect(canApproveMealPlan("admin", true, true, null)).toBe(false);
  });
});
