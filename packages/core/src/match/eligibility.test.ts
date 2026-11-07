import { describe, expect, it } from "vitest";
import { filterEligible, isEligibleCounterpart, rolesOf, servicesOf, type EligibilityProfile } from "./eligibility";

const fam = (uid: string, careTypes: unknown, card: Record<string, unknown> = {}): EligibilityProfile => ({ uid, side: "family", card: { careTypes, ...card } });
const car = (uid: string, careTypes: unknown, card: Record<string, unknown> = {}): EligibilityProfile => ({ uid, side: "carer", card: { careTypes, ...card } });

describe("reciprocal eligibility", () => {
  const people = [fam("fN", ["nanny"]), fam("fB", ["babysitter"]), fam("fA", ["au_pair"]), car("cN", ["nanny"]), car("cB", ["babysitter"]), car("cA", ["au_pair"])];
  const ids = (viewer: EligibilityProfile) => filterEligible(viewer, people).map((p) => p.uid);
  it("babysitter sees only families seeking babysitters", () => expect(ids(car("me", ["babysitter"]))).toEqual(["fB"]));
  it("family seeking babysitter sees only babysitters", () => expect(ids(fam("me", ["babysitter"]))).toEqual(["cB"]));
  it("nanny and au pair are reciprocal", () => {
    expect(ids(car("me", ["nanny"]))).toEqual(["fN"]);
    expect(ids(fam("me", ["nanny"]))).toEqual(["cN"]);
    expect(ids(car("me", ["au_pair"]))).toEqual(["fA"]);
    expect(ids(fam("me", ["au_pair"]))).toEqual(["cA"]);
  });
  it("never leaks same side or self", () => {
    expect(isEligibleCounterpart(fam("a", ["nanny"]), fam("b", ["nanny"]))).toBe(false);
    expect(isEligibleCounterpart(car("a", ["nanny"]), car("a", ["nanny"]))).toBe(false);
  });
  it("missing or invalid service never matches", () => {
    expect(isEligibleCounterpart(fam("a", []), car("b", ["nanny"]))).toBe(false);
    expect(isEligibleCounterpart(fam("a", ["nanny"]), car("b", undefined))).toBe(false);
    expect(isEligibleCounterpart(fam("a", ["nanny"]), car("b", ["housekeeper"]))).toBe(false);
  });
  it("intent narrows, and cannot widen", () => {
    const v = fam("me", ["nanny", "babysitter"]);
    expect(filterEligible(v, people, "nanny").map((p) => p.uid)).toEqual(["cN"]);
    expect(filterEligible(v, people, "babysitter").map((p) => p.uid)).toEqual(["cB"]);
    expect(filterEligible(v, people, "au_pair")).toEqual([]);
  });
  it("au pair needs shared destination when both state one", () => {
    expect(isEligibleCounterpart(fam("f", ["au_pair"], { auPairHost: { country: "Australia" } }), car("c", ["au_pair"], { auPair: { destinations: ["Canada"] } }))).toBe(false);
    expect(isEligibleCounterpart(fam("f", ["au_pair"], { auPairHost: { country: "Australia" } }), car("c", ["au_pair"], { auPair: { destinations: ["australia", "Canada"] } }))).toBe(true);
    expect(isEligibleCounterpart(fam("f", ["au_pair"]), car("c", ["au_pair"], { auPair: { destinations: ["Canada"] } }))).toBe(true);
  });
  it("derives roles", () => {
    expect(servicesOf(car("a", ["nanny", "nanny", "x"]))).toEqual(["nanny"]);
    expect(rolesOf(fam("a", ["au_pair"]))).toEqual(["family:au_pair"]);
  });
});
