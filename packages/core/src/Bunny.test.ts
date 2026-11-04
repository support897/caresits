import { describe, expect, it } from "vitest";
import { shouldAnimateBunny } from "./Bunny";

describe("Bunny motion policy", () => {
  it("moves when motion is allowed and bunny is visible", () => {
    expect(shouldAnimateBunny(false, false, true)).toBe(true);
  });

  it("stops when the system asks for reduced motion", () => {
    expect(shouldAnimateBunny(true, false, true)).toBe(false);
  });

  it("stops when the user turns the bunny down", () => {
    expect(shouldAnimateBunny(false, true, true)).toBe(false);
  });

  it("pauses while outside the screen", () => {
    expect(shouldAnimateBunny(false, false, false)).toBe(false);
  });
});
