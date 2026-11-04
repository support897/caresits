import { describe, expect, it } from "vitest";
import { buildProfilePatch, createOnboardingDraft, progressPercent } from "./onboarding";

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

  it("stores a second role on the same profile card", () => {
    const patch = buildProfilePatch("carer", createOnboardingDraft(), "family");
    expect(patch).not.toHaveProperty("side");
    expect(patch).not.toHaveProperty("displayName");
    expect(patch.card.alsoSide).toMatchObject({ side: "carer" });
  });
});
