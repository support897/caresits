import { describe, expect, it } from "vitest";
import { buildProfilePatch, createOnboardingDraft, profileCompletenessPercent, progressPercent } from "./onboarding";

describe("onboarding progress", () => {
  it("counts the current step in the progress ring", () => {
    expect(progressPercent(0, 5)).toBe(20);
    expect(progressPercent(2, 5)).toBe(60);
    expect(progressPercent(4, 5)).toBe(100);
  });

  it("keeps progress within valid bounds", () => {
    expect(progressPercent(-2, 5)).toBe(20);
    expect(progressPercent(9, 5)).toBe(100);
    expect(progressPercent(0, 0)).toBe(0);
  });

  it("keeps children private and saves only first names", () => {
    const draft = createOnboardingDraft();
    draft.displayName = "Pat Example";
    draft.postcode = "4005";
    draft.kids = [{ name: "Ava Example", ageYears: "4" }];
    const patch = buildProfilePatch("family", draft);
    expect(patch.card.kids).toEqual([{ name: "Ava", ageYears: 4 }]);
    expect(patch).not.toHaveProperty("address");
    expect(patch.card).not.toHaveProperty("childPhotos");
  });

  it("builds a complete carer profile without adding trust claims", () => {
    const draft = createOnboardingDraft();
    draft.displayName = "Alex Carer";
    draft.postcode = "4005";
    draft.suburb = "New Farm";
    draft.headline = "Calm after-school care";
    draft.intro = "I enjoy reading and outdoor play.";
    draft.languages = ["English"];
    draft.experienceYears = "3";
    draft.style = ["patient", "creative"];
    draft.activities = ["reading"];
    draft.rate = 35;
    draft.distanceKm = 20;
    draft.carerDays = ["Mon", "Fri"];
    draft.carerCareTypes = ["babysitter"];
    const patch = buildProfilePatch("carer", draft);
    expect(patch).toMatchObject({ displayName: "Alex Carer", postcode: "4005", about: "I enjoy reading and outdoor play." });
    expect(patch.card).toMatchObject({
      suburb: "New Farm",
      headline: "Calm after-school care",
      languages: ["English"],
      experienceYears: 3,
      style: ["patient", "creative"],
      activities: ["reading"],
      rate: 35,
      maxDistanceKm: 20,
      availability: { Mon: {}, Fri: {} },
      careTypes: ["babysitter"],
    });
    expect(patch.card).not.toHaveProperty("verified");
    expect(patch.card).not.toHaveProperty("qualifications");
  });

  it("shows optional profile completeness without blocking unfinished drafts", () => {
    const draft = createOnboardingDraft();
    expect(profileCompletenessPercent(draft, "family")).toBeGreaterThan(0);
    expect(profileCompletenessPercent(draft, "family")).toBeLessThan(100);
    draft.displayName = "Pat";
    draft.suburb = "New Farm";
    draft.kids = [{ name: "Ava", ageYears: "4" }];
    draft.familyCareTypes = ["nanny"];
    draft.familyDays = ["Mon"];
    draft.style = ["caring"];
    expect(profileCompletenessPercent(draft, "family")).toBeGreaterThan(50);
    expect(profileCompletenessPercent(draft, "family")).toBeLessThanOrEqual(100);
  });

  it("stores a second role on the same profile card", () => {
    const patch = buildProfilePatch("carer", createOnboardingDraft(), "family");
    expect(patch).not.toHaveProperty("side");
    expect(patch).not.toHaveProperty("displayName");
    expect(patch.card.alsoSide).toMatchObject({ side: "carer" });
  });
});
