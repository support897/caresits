import { describe, expect, it } from "vitest";
import { ROLE_IDS, canSeeChildDetails, missingFields, roleOf, roleProfileSchema } from "./roles.js";

const kids = [{ name: "Mia", ageYears: 4 }];
const ok: Record<string, Record<string, unknown>> = {
  "family:nanny": { displayName: "A", location: "Brisbane", kids, schedule: ["mon"], budgetMax: 35, duties: ["meals"], routines: "x", smokingPreference: "any", requiresDriver: false, pets: false },
  "family:babysitter": { displayName: "A", location: "Brisbane", kids, careInstructions: "bed 7", dates: ["2026-12-01"], from: "18:00", to: "22:00", durationHours: 4, budgetMax: 30, transportNeeded: false },
  "family:au_pair": { displayName: "A", location: "Brisbane", kids, country: "Australia", accommodation: "room", pocketMoneyPerWeek: 300, meals: "all", hoursPerWeek: 30, duties: ["school run"], daysOff: ["sun"], durationMonths: 6 },
  "carer:nanny": { displayName: "B", location: "Brisbane", languages: ["English"], experienceYears: 3, ageGroups: ["toddler"], rate: 30, availability: ["mon"], duties: ["meals"], drives: true, ownVehicle: true, references: 2 },
  "carer:babysitter": { displayName: "B", location: "Brisbane", languages: ["English"], experienceYears: 1, ageGroups: ["toddler"], rate: 25, availability: ["fri"], minBookingHours: 3, transport: "walk_only", duties: ["bedtime"] },
  "carer:au_pair": { displayName: "B", homeCountry: "Germany", currentCountry: "Germany", destinations: ["Australia"], languages: ["German"], experienceYears: 1, arrivalWindow: "Feb 2027", durationMonths: 9, accommodationPreference: "own room", pocketMoneyExpectation: "A$250/wk", duties: ["school run"], visaStatus: "unknown" },
};
describe("six role schemas", () => {
  for (const role of ROLE_IDS) {
    it(`${role} accepts complete data`, () => expect(roleProfileSchema.safeParse({ role, ...ok[role] }).success).toBe(true));
    it(`${role} reports missing fields`, () => expect(missingFields(role, { displayName: "x" }).length).toBeGreaterThan(2));
  }
  it("a babysitter profile is never accepted as a nanny", () => expect(roleProfileSchema.safeParse({ ...ok["carer:babysitter"], role: "carer:nanny" }).success).toBe(false));
  it("au pair requires destination and no home-country-only profile", () => expect(missingFields("carer:au_pair", { ...ok["carer:au_pair"], destinations: [] })).toContain("destinations"));
  it("roleOf only accepts the six", () => { expect(roleOf("family", "nanny")).toBe("family:nanny"); expect(roleOf("family", "housekeeper")).toBeNull(); });
  it("child data privacy", () => { expect(canSeeChildDetails("u2", "u1", false)).toBe(false); expect(canSeeChildDetails("u2", "u1", true)).toBe(true); expect(canSeeChildDetails("u1", "u1", false)).toBe(true); });
});
