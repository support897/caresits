export type MatchSide = "family" | "carer";

export const MATCH_CRITERIA = [
  "experience",
  "personality",
  "availability",
  "budget",
  "location",
  "activities",
] as const;
export type MatchCriterionId = (typeof MATCH_CRITERIA)[number];
export type MatchWeights = Record<MatchCriterionId, number>;

export type AvailabilityNeed = {
  date?: string;
  day?: string;
  from?: string;
  to?: string;
};

export type MatchRequirements = {
  availability?: AvailabilityNeed[];
  requiredChecksLevel?: string;
  childAges?: Array<number | string>;
  maxBudget?: number;
  activities?: string[];
  experienceWithAges?: Array<number | string>;
  experienceYears?: number;
};

export type VisaStatus = {
  status: "unknown" | "not-checked" | "eligible" | "ineligible" | "not-applicable";
  source?: string;
  checkedOn?: string;
};

export type MatchProfile = {
  uid?: string;
  side: MatchSide;
  name?: string;
  card?: Record<string, unknown>;
  looking?: { musts?: Record<string, unknown>; prefs?: Record<string, unknown> };
  verifiedLevel?: string;
  verification?: { level?: string };
  lat?: number;
  lng?: number;
  raw?: Record<string, unknown>;
};

export type MatchCriterion = {
  id: MatchCriterionId;
  label: string;
  weight: number;
  fit: number | null;
};

export type MatchResult = {
  score: number | null;
  coverage: number;
  eligible: boolean;
  unmetEssentials: string[];
  criteria: MatchCriterion[];
  weights: MatchWeights;
  visaStatus: VisaStatus;
};

export type ScoreMatchOptions = {
  viewer: MatchProfile;
  candidate: MatchProfile;
  km?: number | null;
  radiusKm?: number | null;
  requirements?: MatchRequirements;
  weights?: Partial<MatchWeights>;
  visaStatus?: VisaStatus;
};

export type RequirementSuggestion = {
  id: string;
  label: string;
  kind: "essential" | "preference";
  value: Partial<MatchRequirements>;
};
