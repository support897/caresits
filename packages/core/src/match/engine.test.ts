import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, distanceScore, explain, inRadius, normalizeWeights, scoreMatch } from "./engine";
import { parseNeeds, requirementsFromSuggestions } from "./text";
import type { MatchProfile } from "./types";

const family: MatchProfile = {
  side: "family",
  card: {
    scheduleNeed: { Mon: true, Tue: true },
    payOffered: 30,
    personality: ["calm"],
    activities: ["art"],
  },
};
const carer: MatchProfile = {
  side: "carer",
  card: {
    availability: { Mon: true, Tue: true },
    payFloor: 28,
    experience: { toddler: 4 },
    personality: ["calm", "playful"],
    activities: ["art", "music"],
  },
};

describe("matching engine", () => {
  it("uses the brief's default weights and normalises custom weights to 100", () => {
    expect(Object.values(DEFAULT_WEIGHTS).reduce((sum, value) => sum + value, 0)).toBe(100);
    const weights = normalizeWeights({ experience: 50, personality: 0, availability: 10, budget: 10, location: 10, activities: 10 });
    expect(Object.values(weights).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(weights.experience).toBe(56);
  });

  it("ports the strong and weak match cases from match6-tests.mjs", () => {
    const strong = scoreMatch({ viewer: family, candidate: carer, km: 2, radiusKm: 25 });
    const empty = scoreMatch({ viewer: { side: "family", card: {} }, candidate: { side: "carer", card: {} }, km: null, radiusKm: 25 });
    const weak = scoreMatch({ viewer: { ...family, card: { ...family.card, payOffered: 10 } }, candidate: carer, km: 40, radiusKm: 10 });
    expect(strong.score).toBeGreaterThanOrEqual(85);
    expect(empty.score).toBeNull();
    expect(empty.criteria.every((row) => row.fit === null)).toBe(true);
    expect(weak.score).toBeLessThan(strong.score as number);
  });

  it("withholds a percentage when too few weighted facts are stated", () => {
    const result = scoreMatch({ viewer: { side: "family", card: { scheduleNeed: { Fri: true } } }, candidate: { side: "carer", card: { availability: { Fri: true } } } });
    expect(result.coverage).toBe(20);
    expect(result.score).toBeNull();
  });

  it("requires the full requested date and time window", () => {
    const viewer: MatchProfile = { side: "family", card: {} };
    const available: MatchProfile = { side: "carer", card: { availability: { Fri: [{ from: "16:00", to: "18:00" }] } } };
    const options = { viewer, candidate: available, requirements: { availability: [{ day: "Fri", from: "16:00", to: "18:00" }] } };
    expect(scoreMatch(options).eligible).toBe(true);
    const unavailable = { ...available, card: { availability: { Fri: [{ from: "17:00", to: "20:00" }] } } };
    expect(scoreMatch({ ...options, candidate: unavailable }).unmetEssentials).toContain("Availability: Friday 16:00–18:00 is not covered.");
  });

  it("fails closed when required check is absent or below level, ignoring card claims", () => {
    const viewer: MatchProfile = { side: "family", card: {}, looking: { musts: { requiredChecksLevel: "register" } } };
    const unchecked: MatchProfile = { side: "carer", card: { checksLevel: "register" } };
    expect(scoreMatch({ viewer, candidate: unchecked }).unmetEssentials[0]).toContain("Not checked yet");
    const sighted: MatchProfile = { side: "carer", verifiedLevel: "sighted", card: { checksLevel: "register" } };
    expect(scoreMatch({ viewer, candidate: sighted }).eligible).toBe(false);
    const registered: MatchProfile = { side: "carer", verifiedLevel: "register", card: { checksLevel: "none" } };
    expect(scoreMatch({ viewer, candidate: registered }).eligible).toBe(true);
  });

  it("checks accepted child ages and strict maximum budget", () => {
    const viewer: MatchProfile = { side: "family", card: { kids: [{ ageYears: 2 }], budgetMax: 30 } };
    const good: MatchProfile = { side: "carer", card: { agesAccepted: ["toddler"], rate: 30 } };
    expect(scoreMatch({ viewer, candidate: good }).eligible).toBe(true);
    expect(scoreMatch({ viewer, candidate: { ...good, card: { ...good.card, rate: 30.01 } } }).unmetEssentials).toContain("Rate: $30.01/hr is above the $30/hr maximum.");
    expect(scoreMatch({ viewer, candidate: { ...good, card: { ...good.card, agesAccepted: ["school age"] } } }).eligible).toBe(false);
  });

  it("matches families to a carer's rate, area, schedule, and style", () => {
    const carerViewer: MatchProfile = { side: "carer", card: { payFloor: 30, availability: { Fri: true }, agesAccepted: ["toddler"], style: ["calm"] } };
    const familyCandidate: MatchProfile = { side: "family", card: { payOffered: 32, scheduleNeed: { Fri: true }, kids: [{ ageYears: 2 }], style: ["calm"] } };
    expect(scoreMatch({ viewer: carerViewer, candidate: familyCandidate, km: 3, radiusKm: 25 }).eligible).toBe(true);
    expect(scoreMatch({ viewer: carerViewer, candidate: { ...familyCandidate, card: { ...familyCandidate.card, payOffered: 29 } } }).eligible).toBe(false);
  });

  it("keeps visa separate and explains missing facts plainly", () => {
    const viewer: MatchProfile = { side: "family", card: {} };
    const candidate: MatchProfile = { side: "carer", card: {} };
    const result = scoreMatch({ viewer, candidate });
    const sentences = explain(viewer, candidate, result);
    expect(sentences.some((sentence) => sentence.includes("Not stated"))).toBe(true);
    expect(sentences.some((sentence) => sentence.includes("Not checked yet"))).toBe(true);
    expect(result.visaStatus.status).toBe("unknown");
  });

  it("uses distance and radius without admitting unknown distances to a limited radius", () => {
    expect(distanceScore(2, 25)).toBeCloseTo(0.96);
    expect(inRadius(2, 5)).toBe(true);
    expect(inRadius(6, 5)).toBe(false);
    expect(inRadius(null, 5)).toBe(false);
    expect(inRadius(null, 0)).toBe(true);
  });

  it("extracts natural-language needs as confirmable suggestions", () => {
    const suggestions = parseNeeds("someone experienced with a 2 year old available Friday from 4pm who can cook");
    expect(suggestions.map((item) => item.id)).toEqual(["child-age-2", "experience-age-2", "availability-fri-1600", "activity-cooking"]);
    const confirmed = requirementsFromSuggestions(suggestions, ["child-age-2", "availability-fri-1600"]);
    expect(confirmed.childAges).toEqual([2]);
    expect(confirmed.availability?.[0]).toMatchObject({ day: "Fri", from: "16:00" });
    expect(confirmed.activities).toBeUndefined();
  });
});
