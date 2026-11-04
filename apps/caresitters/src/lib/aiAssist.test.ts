import { describe, expect, it } from "vitest";
import { extractPrefs, suggestIntro } from "./aiAssist";

describe("onboarding AI suggestions", () => {
  it("only restates facts supplied by the carer", () => {
    const suggestion = suggestIntro({
      languages: ["English", "Spanish"],
      experienceYears: 3,
      careTypes: ["babysitter"],
      style: ["outdoor play"],
    });
    expect(suggestion).toContain("3 years");
    expect(suggestion).toContain("English");
    expect(suggestion).toContain("babysitter");
    expect(suggestion).toContain("outdoor play");
  });

  it("does not invent trust claims", () => {
    const empty = suggestIntro({});
    const facts = suggestIntro({ languages: ["English"], experienceYears: "", careTypes: ["qualified nanny"], style: ["verified care"] });
    for (const word of ["verified", "qualified", "experienced"]) {
      expect(empty.toLowerCase()).not.toContain(word);
      expect(facts.toLowerCase()).not.toContain(word);
    }
    expect(facts).not.toContain("0 years");
  });

  it("only extracts preference words that appear in the text", () => {
    const result = extractPrefs("We want outdoor play and someone who speaks Spanish.");
    expect(result.prefs.activities).toEqual(["outdoor play"]);
    expect(result.prefs.languages).toEqual(["Spanish"]);
    expect(result.matchedPhrases).toEqual(["outdoor play", "Spanish"]);
  });

  it("extracts only supported care traits found in the family's own words", () => {
    const result = extractPrefs("We need someone caring, patient, creative and safety focused.");
    expect(result.prefs.style).toEqual(["caring", "patient", "creative", "safety focused"]);
    expect(result.matchedPhrases).toEqual(["caring", "patient", "creative", "safety focused"]);
  });

  it("returns no preferences for unrelated text", () => {
    expect(extractPrefs("A kind person would be lovely.")).toEqual({ prefs: {}, matchedPhrases: [] });
  });
});
