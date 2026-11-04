import { describe, expect, expectTypeOf, it } from "vitest";
import { ALLERGY_SAFETY_COPY, checkAllergy, type AllergyStatus } from "./allergy";

describe("checkAllergy", () => {
  it("has no safety-claim status", () => {
    expectTypeOf<AllergyStatus>().not.toEqualTypeOf<"safe">();
  });

  it.each([
    ["peanut", "peanut butter", "contains"],
    ["tree nut", "almond flour", "contains"],
    ["milk", "casein", "contains"],
    ["egg", "mayonnaise", "contains"],
    ["wheat", "pasta", "contains"],
    ["gluten", "barley", "contains"],
    ["soy", "tofu", "contains"],
    ["sesame", "tahini", "contains"],
    ["fish", "salmon", "contains"],
    ["shellfish", "prawn", "contains"],
  ] as const)("flags %s in %s", (allergy, ingredients, status) => {
    expect(checkAllergy(ingredients, [allergy]).status).toBe(status);
  });

  it("returns a cautious status for cross-contact statements", () => {
    const result = checkAllergy("rice, made on shared equipment with peanuts", ["peanut"]);
    expect(result.status).toBe("may-contain");
    expect(result.crossContamination.length).toBeGreaterThan(0);
  });

  it("marks words it cannot identify as unknown", () => {
    const result = checkAllergy("rice, mystery sauce", ["egg"]);
    expect(result.status).toBe("unknown-ingredient");
    expect(result.reasons.join(" ")).toMatch(/mystery sauce/i);
    expect(result.crossContamination.length).toBeGreaterThan(0);
  });

  it("uses no-match-found without calling food safe", () => {
    const result = checkAllergy("rice, pear", ["milk"]);
    expect(result.status).toBe("no-match-found");
    expect(result.reasons).toContain(ALLERGY_SAFETY_COPY);
    expect(result.crossContamination).toHaveLength(1);
  });

  it("keeps cross-contamination copy even with no listed allergy", () => {
    const result = checkAllergy("mystery sauce", []);
    expect(result.status).toBe("unknown-ingredient");
    expect(result.reasons).toContain(ALLERGY_SAFETY_COPY);
  });
});
