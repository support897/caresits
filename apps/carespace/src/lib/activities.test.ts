import { describe, expect, it } from "vitest";
import { ACTIVITIES } from "../content/activities";
import { filterActivities, missingMaterials } from "./activities";

describe("activity ideas", () => {
  it("contains authored ideas across ages 0 through 12 with all three variants", () => {
    expect(ACTIVITIES.length).toBeGreaterThanOrEqual(24);
    for (let age = 0; age <= 12; age += 1) {
      expect(ACTIVITIES.some((activity) => age >= activity.minAge && age <= activity.maxAge)).toBe(true);
    }
    for (const activity of ACTIVITIES) {
      expect(activity.simpler.steps.length).toBeGreaterThan(0);
      expect(activity.moreKids.steps.length).toBeGreaterThan(0);
      expect(activity.spanish.title).not.toBe(activity.title);
      expect(activity.spanish.steps.join(" ")).toMatch(/\b(?:el|la|los|las|un|una|de|del|que|con|y|para|por|en|al)\b/i);
    }
  });

  it("filters by age and interests and puts owned materials first", () => {
    const results = filterActivities(ACTIVITIES, { ageYears: 3, interests: ["science"], owns: ["shallow water tray", "large safe objects", "towel"] });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.id).toBe("float-and-sink");
    expect(results.every((activity) => activity.minAge <= 3 && activity.maxAge >= 3)).toBe(true);
    expect(results.every((activity) => activity.interests.includes("science"))).toBe(true);
  });

  it("can show only activities whose materials family owns", () => {
    const results = filterActivities(ACTIVITIES, { ageYears: 5, owns: ["paper", "crayons", "favourite book"], ownedOnly: true });
    expect(results.some((activity) => activity.id === "story-map")).toBe(true);
    expect(results.every((activity) => missingMaterials(activity, ["paper", "crayons", "favourite book"]).length === 0)).toBe(true);
  });
});
