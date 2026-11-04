import { describe, expect, it } from "vitest";
import type { Person } from "@cc/core";
import { matchesPlacementDestination, placementCompatibility, placementCompatibilityFacts } from "./aupair";

function person(uid: string, side: "family" | "carer", card: Record<string, unknown>): Person {
  return { uid, side, name: uid, firstName: uid, card, looking: {}, raw: {} };
}

describe("au pair matching", () => {
  it("fails closed when selected destination facts are missing", () => {
    const emptyHost = person("host", "family", { auPair: { on: true } });
    const emptyAuPair = person("aupair", "carer", { auPair: { on: true } });
    expect(matchesPlacementDestination(emptyHost, "host", "Australia")).toBe(false);
    expect(matchesPlacementDestination(emptyAuPair, "aupair", "Australia")).toBe(false);
    expect(matchesPlacementDestination(emptyHost, "host", "")).toBe(true);
  });

  it("accepts only declared host countries and au pair destination choices", () => {
    const host = person("host", "family", { auPairHost: { country: "Australia" } });
    const auPair = person("aupair", "carer", { auPair: { arrival: "2027-02;t=aupair;d=AU" } });
    expect(matchesPlacementDestination(host, "host", "Australia")).toBe(true);
    expect(matchesPlacementDestination(auPair, "aupair", "Australia")).toBe(true);
    expect(matchesPlacementDestination(auPair, "aupair", "New Zealand")).toBe(false);
  });

  it("shows shared non-visa reasons and scores only three comparable facts", () => {
    const host = person("host", "family", {
      auPairHost: { country: "Australia", languages: ["English"], infantCareNeeded: true },
      kids: [{ ageYears: 1 }],
    });
    const auPair = person("aupair", "carer", {
      languages: ["English"],
      auPair: { arrival: "2027-02;t=aupair;d=AU", infant: true },
    });
    expect(placementCompatibilityFacts(host, auPair)).toEqual([
      { id: "destination", matches: true },
      { id: "languages", matches: true },
      { id: "infant", matches: true },
    ]);
    expect(placementCompatibility(host, auPair)).toBe(100);
    expect(placementCompatibility(host, person("incomplete", "carer", { auPair: { arrival: "" } }))).toBeNull();
  });
});
