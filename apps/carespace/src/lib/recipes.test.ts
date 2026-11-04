import { describe, expect, it } from "vitest";
import { RECIPES } from "../content/recipes";
import { checkRecipe } from "./recipes";

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
});
