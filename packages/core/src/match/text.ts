import type { AvailabilityNeed, MatchRequirements, RequirementSuggestion } from "./types";

const DAYS: Array<[RegExp, string]> = [
  [/\bmon(?:day)?\b/i, "Mon"],
  [/\btue(?:s|sday)?\b/i, "Tue"],
  [/\bwed(?:nesday)?\b/i, "Wed"],
  [/\bthu(?:r|rs|rsday|rsday)?\b/i, "Thu"],
  [/\bfri(?:day)?\b/i, "Fri"],
  [/\bsat(?:urday)?\b/i, "Sat"],
  [/\bsun(?:day)?\b/i, "Sun"],
];

function clock(value: string): string | undefined {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  if (hour > 24 || minute > 59 || (hour === 24 && minute > 0)) return undefined;
  if (match[3] === "pm" && hour < 12) hour += 12;
  if (match[3] === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function ageValue(value: string): number { return Number(value); }
function idPart(value: number): string { return String(value).replace(".", "-"); }

/** Rule-based suggestions only. The caller must ask the user to confirm before using them. */
export function parseNeeds(input: string): RequirementSuggestion[] {
  const source = input.trim();
  if (!source) return [];
  const suggestions: RequirementSuggestion[] = [];
  const ageMatch = source.match(/\b(\d+(?:\.\d+)?)\s*(?:-\s*)?(?:years?|yrs?|y)\s*old\b|\b(\d+(?:\.\d+)?)\s*yo\b/i);
  const ageText = ageMatch?.[1] ?? ageMatch?.[2];
  if (ageText) {
    const age = ageValue(ageText);
    suggestions.push({ id: `child-age-${idPart(age)}`, label: `Child age: ${age} years`, kind: "essential", value: { childAges: [age] } });
    if (/\b(experienc(?:e|ed)|cared for|looked after)\b/i.test(source)) {
      suggestions.push({ id: `experience-age-${idPart(age)}`, label: `Experience with a ${age}-year-old`, kind: "preference", value: { experienceWithAges: [age] } });
    }
  }

  const day = DAYS.find(([pattern]) => pattern.test(source))?.[1];
  const fromMatch = source.match(/\bfrom\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
  if (day && /\b(available|availability|care|help|someone|sitter|nanny)\b/i.test(source)) {
    const fromText = fromMatch?.[1];
    const from = fromText ? clock(fromText) : undefined;
    const need: AvailabilityNeed = { day, ...(from ? { from } : {}) };
    const dayName = ({ Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" } as Record<string, string>)[day];
    suggestions.push({ id: `availability-${day.toLowerCase()}${from ? `-${from.replace(":", "")}` : ""}`, label: `Available ${dayName}${from ? ` from ${from}` : ""}`, kind: "essential", value: { availability: [need] } });
  }

  const money = source.match(/\b(?:under|below|no\s+more\s+than|at\s+most|maximum|max|up\s+to|budget(?:\s+of)?)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i);
  if (money) {
    const maxBudget = Number(money[1]);
    suggestions.push({ id: `max-budget-${idPart(maxBudget)}`, label: `Maximum rate: $${maxBudget}/hour`, kind: "essential", value: { maxBudget } });
  }

  const experience = source.match(/\b(\d+)\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience\b/i);
  if (experience && !ageText) {
    const years = Number(experience[1]);
    suggestions.push({ id: `experience-years-${years}`, label: `${years}+ years of experience`, kind: "preference", value: { experienceYears: years } });
  }

  if (/\b(cook(?:ing)?|prepare\s+(?:dinner|meals?)|make\s+dinner)\b/i.test(source)) {
    suggestions.push({ id: "activity-cooking", label: "Can cook or prepare meals", kind: "preference", value: { activities: ["cooking"] } });
  }

  const requiredChecksLevel = /\bregister\s+verified\b/i.test(source)
    ? "register"
    : /\bdocument\s+sighted\b/i.test(source) ? "sighted" : undefined;
  if (requiredChecksLevel) {
    suggestions.push({ id: `checks-${requiredChecksLevel}`, label: `Required check: ${requiredChecksLevel}`, kind: "essential", value: { requiredChecksLevel } });
  }
  return suggestions;
}

export function requirementsFromSuggestions(suggestions: RequirementSuggestion[], confirmedIds: string[]): MatchRequirements {
  const chosen = new Set(confirmedIds);
  const result: MatchRequirements = {};
  for (const suggestion of suggestions) {
    if (!chosen.has(suggestion.id)) continue;
    const value = suggestion.value;
    if (value.availability) result.availability = [...(result.availability ?? []), ...value.availability];
    if (value.childAges) result.childAges = [...(result.childAges ?? []), ...value.childAges];
    if (value.activities) result.activities = [...(result.activities ?? []), ...value.activities];
    if (value.experienceWithAges) result.experienceWithAges = [...(result.experienceWithAges ?? []), ...value.experienceWithAges];
    if (value.requiredChecksLevel) result.requiredChecksLevel = value.requiredChecksLevel;
    if (value.maxBudget !== undefined) result.maxBudget = value.maxBudget;
    if (value.experienceYears !== undefined) result.experienceYears = value.experienceYears;
  }
  return result;
}
