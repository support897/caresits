import { t } from "../i18n/base";
import { MATCH_CRITERIA, type AvailabilityNeed, type MatchCriterion, type MatchProfile, type MatchRequirements, type MatchResult, type MatchWeights, type ScoreMatchOptions, type VisaStatus } from "./types";

export { MATCH_CRITERIA } from "./types";
export type { AvailabilityNeed, MatchCriterion, MatchCriterionId, MatchProfile, MatchRequirements, MatchResult, MatchSide, MatchWeights, ScoreMatchOptions, VisaStatus } from "./types";

export const DEFAULT_WEIGHTS: MatchWeights = {
  experience: 25,
  personality: 20,
  availability: 20,
  budget: 15,
  location: 10,
  activities: 10,
};

const LABELS: Record<keyof MatchWeights, string> = {
  experience: t("match.criterion.experience", "Experience"),
  personality: t("match.criterion.personality", "Personality and care style"),
  availability: t("match.criterion.availability", "Availability"),
  budget: t("match.criterion.budget", "Budget"),
  location: t("match.criterion.location", "Location"),
  activities: t("match.criterion.activities", "Activities"),
};
const DAY_NAMES: Record<string, string> = {
  mon: "Mon", monday: "Mon", tue: "Tue", tues: "Tue", tuesday: "Tue", wed: "Wed", wednesday: "Wed",
  thu: "Thu", thur: "Thu", thurs: "Thu", thursday: "Thu", fri: "Fri", friday: "Fri", sat: "Sat", saturday: "Sat", sun: "Sun", sunday: "Sun",
};
const DAY_FULL: Record<string, string> = { Mon: t("match.day.monday", "Monday"), Tue: t("match.day.tuesday", "Tuesday"), Wed: t("match.day.wednesday", "Wednesday"), Thu: t("match.day.thursday", "Thursday"), Fri: t("match.day.friday", "Friday"), Sat: t("match.day.saturday", "Saturday"), Sun: t("match.day.sunday", "Sunday") };
const LEVEL_RANK: Record<string, number> = { none: 0, unchecked: 0, sighted: 1, "document sighted": 1, register: 2, verified: 2 };

type RecordValue = Record<string, unknown>;
type Slot = AvailabilityNeed;

function record(value: unknown): RecordValue | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
}
function cardOf(profile: MatchProfile): RecordValue { return profile.card ?? {}; }
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function finite(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : value === undefined || value === null || value === "" ? [] : [value]; }
function clean(value: unknown): string { return String(value ?? "").trim().toLowerCase(); }
function normalDay(value: unknown): string | undefined {
  const key = clean(value).replace(/\./g, "");
  if (DAY_NAMES[key]) return DAY_NAMES[key];
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return dayForDate(key);
  return undefined;
}
function dayForDate(value: string): string | undefined {
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return undefined;
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getUTCDay()];
}
function parseTime(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value >= 0 && value <= 24 ? Math.round(value * 60) : undefined;
  const match = text(value).toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  if (minute > 59 || hour > 24 || (hour === 24 && minute > 0)) return undefined;
  if (match[3] === "pm" && hour < 12) hour += 12;
  if (match[3] === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}
function labelRange(value: string): { from?: string; to?: string } | undefined {
  const normalized = value.trim().toLowerCase();
  const ranges: Record<string, { from: string; to: string }> = {
    morning: { from: "06:00", to: "12:00" },
    afternoon: { from: "12:00", to: "17:00" },
    evening: { from: "17:00", to: "22:00" },
    overnight: { from: "22:00", to: "06:00" },
    night: { from: "20:00", to: "06:00" },
  };
  if (ranges[normalized]) return ranges[normalized];
  const match = normalized.match(/^(.+?)\s*(?:-|–|to)\s*(.+)$/);
  if (!match) return undefined;
  const from = parseTime(match[1]);
  const to = parseTime(match[2]);
  return from === undefined || to === undefined ? undefined : { from: minutesToTime(from), to: minutesToTime(to) };
}
function minutesToTime(minutes: number): string { return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
function slotFromItem(day: string | undefined, value: unknown): Slot[] {
  if (value === false || value === null || value === undefined) return [];
  if (value === true) return [{ ...(day ? { day } : {}) }];
  if (typeof value === "string") {
    const raw = value.trim();
    const range = labelRange(raw);
    if (range) return [{ ...(day ? { day } : {}), ...range }];
    const itemDay = normalDay(raw);
    return itemDay ? [{ day: itemDay }] : [];
  }
  if (Array.isArray(value)) return value.flatMap((part) => slotFromItem(day, part));
  const obj = record(value);
  if (!obj) return [];
  if (obj.available === false || obj.isAvailable === false) return [];
  const nested = obj.slots ?? obj.times;
  if (Array.isArray(nested)) return nested.flatMap((part) => slotFromItem(day, part));
  const date = text(obj.date) || (day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined);
  const slotDay = text(obj.day) || (day && !/^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined);
  const from = obj.from ?? obj.start ?? obj.startTime;
  const to = obj.to ?? obj.end ?? obj.endTime;
  const parsedFrom = parseTime(from);
  const parsedTo = parseTime(to);
  if (from !== undefined || to !== undefined) {
    return [{ ...(date ? { date } : {}), ...(slotDay ? { day: normalDay(slotDay) ?? slotDay } : {}), ...(parsedFrom !== undefined ? { from: minutesToTime(parsedFrom) } : {}), ...(parsedTo !== undefined ? { to: minutesToTime(parsedTo) } : {}) }];
  }
  return [];
}
function slotsFrom(value: unknown): Slot[] {
  if (Array.isArray(value)) return value.flatMap((item) => slotFromItem(undefined, item));
  if (typeof value === "string") return slotFromItem(undefined, value);
  const obj = record(value);
  if (!obj) return [];
  const out: Slot[] = [];
  for (const [key, item] of Object.entries(obj)) {
    if (key === "days" && Array.isArray(item)) {
      out.push(...item.flatMap((day) => slotFromItem(normalDay(day), true)));
      continue;
    }
    const day = /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : normalDay(key);
    out.push(...slotFromItem(day ?? key, item));
  }
  return out;
}
function requiredNeeds(value: unknown): Slot[] { return slotsFrom(value); }
function needsFor(viewer: MatchProfile, candidate: MatchProfile, requirements: MatchRequirements): Slot[] {
  const family = viewer.side === "family" ? viewer : candidate.side === "family" ? candidate : undefined;
  if (!family) return requirements.availability ? requiredNeeds(requirements.availability) : [];
  const mustNeed = record(family.looking?.musts)?.availability;
  const familyNeed = mustNeed !== undefined ? requiredNeeds(mustNeed) : requiredNeeds(cardOf(family).scheduleNeed ?? cardOf(family).availabilityNeed);
  if (!requirements.availability) return familyNeed;
  const queryNeed = requiredNeeds(requirements.availability);
  return viewer.side === "family" ? queryNeed : [...familyNeed, ...queryNeed];
}
function availableValue(viewer: MatchProfile, candidate: MatchProfile): unknown {
  return viewer.side === "family" ? cardOf(candidate).availability : cardOf(viewer).availability;
}
function slotDay(slot: Slot): string | undefined {
  if (slot.date) return dayForDate(slot.date);
  return normalDay(slot.day);
}
function needLabel(slot: Slot): string {
  const day = slot.date ? normalDay(slot.date) : normalDay(slot.day);
  const dayText = (day ? DAY_FULL[day] : undefined) || slot.date || slot.day || t("match.requiredTime", "Required time");
  const from = parseTime(slot.from);
  const to = parseTime(slot.to);
  if (from === undefined && to === undefined) return dayText;
  if (from !== undefined && to !== undefined) return t("match.timeRange", "{day} {from}–{to}", { day: dayText, from: minutesToTime(from), to: minutesToTime(to) });
  if (from !== undefined) return t("match.timeFrom", "{day} from {time}", { day: dayText, time: minutesToTime(from) });
  return t("match.timeUntil", "{day} until {time}", { day: dayText, time: minutesToTime(to as number) });
}
function slotCoverage(need: Slot, available: Slot): number | undefined {
  if (need.date && available.date && need.date !== available.date) return undefined;
  const requiredDay = slotDay(need);
  const availableDay = slotDay(available);
  if (requiredDay && availableDay && requiredDay !== availableDay) return undefined;
  if (need.date && available.date && need.date !== available.date) return undefined;
  const start = parseTime(need.from) ?? 0;
  let end = parseTime(need.to) ?? (need.from ? start + 1 : 1440);
  let availableStart = parseTime(available.from) ?? 0;
  let availableEnd = parseTime(available.to) ?? 1440;
  if (end <= start) end += 1440;
  if (availableEnd <= availableStart) availableEnd += 1440;
  if (availableEnd < start && end > 1440) { availableStart += 1440; availableEnd += 1440; }
  const overlap = Math.max(0, Math.min(end, availableEnd) - Math.max(start, availableStart));
  return Math.min(1, overlap / Math.max(1, end - start));
}
function availabilityFit(needs: Slot[], available: Slot[]): number | null {
  if (!needs.length || !available.length) return null;
  let sum = 0;
  for (const need of needs) {
    const fits = available.map((slot) => slotCoverage(need, slot)).filter((value): value is number => value !== undefined);
    if (!fits.length) return 0;
    sum += Math.max(...fits);
  }
  return sum / needs.length;
}
function availabilityEssentials(needs: Slot[], available: Slot[]): string[] {
  if (!needs.length) return [];
  if (!available.length) return needs.map((need) => t("match.availabilityNotStated", "Availability for {need}: Not stated.", { need: needLabel(need) }));
  return needs.flatMap((need) => {
    const fits = available.map((slot) => slotCoverage(need, slot)).filter((value): value is number => value !== undefined);
    if (!fits.length || Math.max(...fits) < 1) return [t("match.availabilityNotCovered", "Availability: {need} is not covered.", { need: needLabel(need) })];
    return [];
  });
}
function numericExperience(card: RecordValue): number | undefined {
  const direct = finite(card.experienceYears);
  if (direct !== undefined) return direct;
  const experience = card.experience;
  const scalar = finite(experience);
  if (scalar !== undefined) return scalar;
  const obj = record(experience);
  if (!obj) return undefined;
  const years = Object.values(obj).map(finite).filter((value): value is number => value !== undefined);
  return years.length ? Math.max(...years) : undefined;
}
function ageBand(value: string): string {
  const normalized = clean(value).replace(/[_-]/g, " ");
  if (["baby", "newborn", "infant"].includes(normalized)) return "infant";
  if (["toddler", "toddlers"].includes(normalized)) return "toddler";
  if (["preschool", "preschooler"].includes(normalized)) return "preschool";
  if (["school age", "schoolage", "school aged"].includes(normalized)) return "school";
  return normalized;
}
function matchesAge(age: number | string, acceptedValue: unknown): boolean {
  const accepted = list(acceptedValue).map((value) => clean(value)).filter(Boolean);
  if (!accepted.length) return false;
  const ageNumber = finite(age);
  if (ageNumber === undefined) {
    const target = ageBand(String(age));
    return accepted.some((value) => ageBand(value) === target);
  }
  const bands = new Set<string>();
  if (ageNumber < 1) bands.add("infant");
  if (ageNumber >= 1 && ageNumber < 4) bands.add("toddler");
  if (ageNumber >= 3 && ageNumber < 6) bands.add("preschool");
  if (ageNumber >= 5) bands.add("school");
  return accepted.some((value) => {
    const band = ageBand(value);
    if (bands.has(band)) return true;
    const range = value.match(/^(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)$/);
    if (range) return ageNumber >= Number(range[1]) && ageNumber <= Number(range[2]);
    const exact = finite(value);
    return exact !== undefined && ageNumber === exact;
  });
}
function agesFromCard(card: RecordValue): Array<number | string> {
  const direct = list(card.childAges ?? card.childrenAges).map((value) => typeof value === "number" || typeof value === "string" ? value : undefined).filter((value): value is number | string => value !== undefined);
  if (direct.length) return direct;
  return list(card.kids).flatMap((kid) => {
    const obj = record(kid);
    const age = obj?.ageYears ?? obj?.age;
    return typeof age === "number" || typeof age === "string" ? [age] : [];
  });
}
function acceptedAges(card: RecordValue): unknown[] { return list(card.agesAccepted ?? card.acceptedAges ?? card.acceptedChildAges); }
function checkAges(viewer: MatchProfile, candidate: MatchProfile, requirements: MatchRequirements): string[] {
  const family = viewer.side === "family" ? viewer : candidate.side === "family" ? candidate : undefined;
  const carer = viewer.side === "carer" ? viewer : candidate.side === "carer" ? candidate : undefined;
  if (!family || !carer) return [];
  const wanted = [...new Set([...agesFromCard(cardOf(family)), ...(requirements.childAges ?? [])])];
  const accepted = acceptedAges(cardOf(carer));
  if (!wanted.length) return [];
  if (!accepted.length) return viewer.side === "family" ? [t("match.acceptedAgesNotStated", "Accepted ages: Not stated.")] : [];
  const missed = wanted.filter((age) => !matchesAge(age, accepted));
  return missed.map((age) => viewer.side === "family"
    ? t("match.childAgeNotAccepted", "Child age {age} is not in the carer's stated accepted ages.", { age })
    : t("match.childAgeOutsideAccepted", "Child age {age} is outside your stated accepted ages.", { age }));
}
function rateOf(card: RecordValue): number | undefined { return finite(card.rate ?? card.payFloor ?? card.hourlyRate); }
function budgetOf(viewer: MatchProfile, requirements: MatchRequirements): number | undefined {
  if (viewer.side !== "family") return undefined;
  const musts = record(viewer.looking?.musts);
  return finite(requirements.maxBudget ?? musts?.maxBudget ?? cardOf(viewer).budgetMax ?? cardOf(viewer).maxBudget);
}
function strictBudgetOf(viewer: MatchProfile, requirements: MatchRequirements): number | undefined {
  if (viewer.side !== "family") return undefined;
  const musts = record(viewer.looking?.musts);
  const card = cardOf(viewer);
  const strictValues = [
    requirements.maxBudgetStrict === true ? finite(requirements.maxBudget) : undefined,
    musts?.maxBudgetStrict === true ? finite(musts.maxBudget) : undefined,
    card.maxBudgetStrict === true ? finite(card.budgetMax ?? card.maxBudget) : undefined,
  ].filter((value): value is number => value !== undefined);
  return strictValues.length ? Math.min(...strictValues) : undefined;
}
function payFloorOf(card: RecordValue): number | undefined { return finite(card.payFloor ?? card.rate ?? card.minimumRate); }
function payOfferedOf(card: RecordValue): number | undefined { return finite(card.payOffered ?? card.rate ?? card.budgetMax ?? card.maxBudget); }
function budgetFit(viewer: MatchProfile, candidate: MatchProfile, requirements: MatchRequirements): number | null {
  if (viewer.side === "family") {
    const max = budgetOf(viewer, requirements);
    const rate = rateOf(cardOf(candidate));
    if (max !== undefined && rate !== undefined) return rate <= max ? 1 : 0;
    const offered = finite(cardOf(viewer).payOffered);
    const floor = finite(cardOf(candidate).payFloor);
    return offered !== undefined && floor !== undefined ? (offered >= floor ? 1 : 0) : null;
  }
  const floor = payFloorOf(cardOf(viewer));
  const offer = payOfferedOf(cardOf(candidate));
  return floor !== undefined && offer !== undefined ? (offer >= floor ? 1 : 0) : null;
}
function budgetEssentials(viewer: MatchProfile, candidate: MatchProfile, requirements: MatchRequirements): string[] {
  if (viewer.side === "family") {
    const max = strictBudgetOf(viewer, requirements);
    if (max === undefined) return [];
    const rate = rateOf(cardOf(candidate));
    if (rate === undefined) return [t("match.rateNotStated", "Rate: Not stated.")];
    return rate > max ? [t("match.rateAboveMaximum", "Rate: ${rate}/hr is above the ${max}/hr maximum.", { rate, max })] : [];
  }
  const floor = payFloorOf(cardOf(viewer));
  if (floor === undefined) return [];
  const offer = payOfferedOf(cardOf(candidate));
  if (offer === undefined) return [t("match.payNotStated", "Pay offered: Not stated.")];
  return offer < floor ? [t("match.payBelowMinimum", "Pay offered: ${offer}/hr is below your ${floor}/hr minimum.", { offer, floor })] : [];
}
function requiredCheckLevel(viewer: MatchProfile, candidate: MatchProfile, requirements: MatchRequirements): string | undefined {
  const family = viewer.side === "family" ? viewer : candidate.side === "family" ? candidate : undefined;
  if (!family) return undefined;
  const musts = record(family.looking?.musts);
  const card = cardOf(family);
  const explicitLevel = viewer.side === "family" ? requirements.requiredChecksLevel : undefined;
  const raw = explicitLevel ?? (text(musts?.requiredChecksLevel) || text(musts?.checksLevel) || text(musts?.requiredChecks) || text(card.requiredChecksLevel) || text(card.requiredChecks));
  return raw ? raw.toLowerCase() : undefined;
}
function checksEssentials(viewer: MatchProfile, candidate: MatchProfile, requirements: MatchRequirements): string[] {
  const required = requiredCheckLevel(viewer, candidate, requirements);
  if (!required) return [];
  const carer = viewer.side === "carer" ? viewer : candidate.side === "carer" ? candidate : undefined;
  const checked = carer?.verifiedLevel ?? carer?.verification?.level;
  if (!checked) return [t("match.checksNotChecked", "Required checks: Not checked yet (needs {required}).", { required })];
  const have = checked.toLowerCase();
  const requiredRank = LEVEL_RANK[required];
  const haveRank = LEVEL_RANK[have];
  const meets = requiredRank !== undefined && haveRank !== undefined ? haveRank >= requiredRank : have === required;
  return meets ? [] : [t("match.checksBelowRequired", "Required checks: {have} is below the required {required} level.", { have, required })];
}
function essentialsFor(viewer: MatchProfile, candidate: MatchProfile, requirements: MatchRequirements): string[] {
  const needs = needsFor(viewer, candidate, requirements);
  const available = slotsFrom(availableValue(viewer, candidate));
  return [
    ...availabilityEssentials(needs, available),
    ...checksEssentials(viewer, candidate, requirements),
    ...checkAges(viewer, candidate, requirements),
    ...budgetEssentials(viewer, candidate, requirements),
  ];
}
function overlaps(left: unknown[], right: unknown[]): number | null {
  const a = [...new Set(left.map(clean).filter(Boolean))];
  const b = new Set(right.map(clean).filter(Boolean));
  if (!a.length || !b.size) return null;
  return a.filter((value) => b.has(value)).length / a.length;
}
function experienceFit(viewer: MatchProfile, candidate: MatchProfile, requirements: MatchRequirements): number | null {
  const card = cardOf(candidate);
  if (requirements.experienceWithAges?.length) {
    const byAge = record(card.experienceByAge ?? card.experience);
    if (!byAge) return null;
    const ages = requirements.experienceWithAges;
    const values = ages.map((age) => {
      const numeric = finite(age);
      const labels = [String(age), numeric !== undefined && numeric < 1 ? "infant" : "", numeric !== undefined && numeric >= 1 && numeric < 4 ? "toddler" : "", numeric !== undefined && numeric >= 3 && numeric < 6 ? "preschool" : ""].filter(Boolean);
      const key = Object.keys(byAge).find((candidateKey) => labels.some((label) => clean(candidateKey) === clean(label) || ageBand(candidateKey) === ageBand(label)));
      return key ? finite(byAge[key]) : undefined;
    });
    if (values.every((value) => value === undefined)) return null;
    return values.filter((value) => value !== undefined && value > 0).length / values.length;
  }
  const years = numericExperience(card);
  if (years === undefined) return null;
  if (requirements.experienceYears !== undefined) return Math.min(1, years / Math.max(1, requirements.experienceYears));
  if (viewer.side === "family" || card.experience !== undefined || card.experienceYears !== undefined) return years >= 5 ? 1 : years >= 3 ? 0.8 : years >= 1 ? 0.5 : 0.2;
  return null;
}
function activityFit(viewer: MatchProfile, candidate: MatchProfile, requirements: MatchRequirements): number | null {
  const desired = requirements.activities?.length ? requirements.activities : list(cardOf(viewer).activities ?? cardOf(viewer).tasks).map(String);
  const offered = list(cardOf(candidate).activities ?? cardOf(candidate).tasks ?? cardOf(candidate).skills).map(String);
  const cooking = cardOf(candidate).cooking;
  if (desired.some((item) => /cook|meal|dinner/i.test(item)) && typeof cooking === "boolean") offered.push(cooking ? "cooking" : "does not cook");
  if (desired.length) {
    if (offered.length) return overlaps(desired, offered);
    return null;
  }
  return overlaps(list(cardOf(viewer).activities ?? cardOf(viewer).tasks).map(String), list(cardOf(candidate).activities ?? cardOf(candidate).tasks ?? cardOf(candidate).skills).map(String));
}
function personalityFit(viewer: MatchProfile, candidate: MatchProfile): number | null {
  const viewerCard = cardOf(viewer);
  const otherCard = cardOf(candidate);
  const left = [viewerCard.personality, viewerCard.careStyle, viewerCard.style].flatMap(list);
  const right = [otherCard.personality, otherCard.careStyle, otherCard.style].flatMap(list);
  return overlaps(left, right);
}
function criteriaFor(viewer: MatchProfile, candidate: MatchProfile, requirements: MatchRequirements, weights: MatchWeights, km?: number | null, radiusKm?: number | null): MatchCriterion[] {
  const needs = needsFor(viewer, candidate, requirements);
  const availability = availabilityFit(needs, slotsFrom(availableValue(viewer, candidate)));
  const distance = km === undefined || km === null ? null : distanceScore(km, radiusKm);
  const fit: Record<keyof MatchWeights, number | null> = {
    experience: experienceFit(viewer, candidate, requirements),
    personality: personalityFit(viewer, candidate),
    availability,
    budget: budgetFit(viewer, candidate, requirements),
    location: distance,
    activities: activityFit(viewer, candidate, requirements),
  };
  return MATCH_CRITERIA.map((id) => ({ id, label: LABELS[id], weight: weights[id], fit: fit[id] }));
}

export function normalizeWeights(input?: Partial<MatchWeights>): MatchWeights {
  const values = MATCH_CRITERIA.map((key) => {
    const value = input?.[key];
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : DEFAULT_WEIGHTS[key];
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return { ...DEFAULT_WEIGHTS };
  const exact = values.map((value) => value * 100 / total);
  const out = exact.map(Math.floor);
  let remaining = 100 - out.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remaining; index += 1) {
    const selected = order[index % order.length];
    if (selected) out[selected.index] = (out[selected.index] ?? 0) + 1;
  }
  return Object.fromEntries(MATCH_CRITERIA.map((key, index) => [key, out[index]])) as MatchWeights;
}

export function distanceScore(km: number | null | undefined, radiusKm: number | null | undefined): number | null {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  const radius = Math.max(1, radiusKm || 25);
  if (km <= radius) return 1 - 0.5 * (km / radius);
  return Math.max(0, 0.5 - 0.5 * ((km - radius) / radius));
}

export function inRadius(km: number | null | undefined, radiusKm: number | null | undefined): boolean {
  if (radiusKm === null || radiusKm === undefined || radiusKm <= 0) return true;
  return km !== null && km !== undefined && Number.isFinite(km) && km <= radiusKm;
}

export function scoreMatch(options: ScoreMatchOptions): MatchResult {
  const { viewer, candidate } = options;
  const requirements = options.requirements ?? {};
  const weights = normalizeWeights(options.weights ?? viewer.card?.weights as Partial<MatchWeights> | undefined);
  const unmetEssentials = essentialsFor(viewer, candidate, requirements);
  const criteria = criteriaFor(viewer, candidate, requirements, weights, options.km, options.radiusKm);
  const known = criteria.filter((item) => item.fit !== null);
  const weightTotal = known.reduce((sum, item) => sum + item.weight, 0);
  const coverage = weightTotal;
  const score = coverage < 40 ? null : Math.round(known.reduce((sum, item) => sum + (item.fit ?? 0) * item.weight, 0) / coverage * 100);
  const visaStatus: VisaStatus = options.visaStatus ?? { status: "unknown" };
  return { score, coverage, eligible: unmetEssentials.length === 0, unmetEssentials, criteria, weights, visaStatus };
}

function visaLabel(status: VisaStatus): string {
  if (status.status === "eligible") return t("match.visa.eligible", "Eligible");
  if (status.status === "ineligible") return t("match.visa.ineligible", "Not eligible");
  if (status.status === "not-applicable") return t("match.visa.notApplicable", "Not applicable");
  if (status.status === "not-checked") return t("match.visa.notChecked", "Not checked yet");
  return t("match.visa.unknown", "Unknown");
}

export function explain(viewer: MatchProfile, candidate: MatchProfile, result: MatchResult): string[] {
  const sentences = result.criteria.map((criterion) => criterion.fit === null
    ? t("match.factNotStated", "{criterion}: Not stated.", { criterion: criterion.label })
    : t("match.factFit", "{criterion}: {fit}% fit ({weight}% weight).", { criterion: criterion.label, fit: Math.round(criterion.fit * 100), weight: criterion.weight }));
  if (result.score === null) sentences.unshift(t("match.scoreHidden", "Match score not shown yet: only {coverage}% of weighted facts are stated.", { coverage: result.coverage }));
  const carer = viewer.side === "carer" ? viewer : candidate.side === "carer" ? candidate : undefined;
  const checkLevel = carer?.verifiedLevel ?? carer?.verification?.level;
  sentences.push(checkLevel ? t("match.checksOnRecord", "Checks: {level} level is on record.", { level: checkLevel }) : t("match.checksNotCheckedGeneral", "Checks: Not checked yet."));
  if (result.unmetEssentials.length) sentences.push(...result.unmetEssentials.map((item) => t("match.unmetEssential", "Unmet essential: {item}", { item })));
  else sentences.push(t("match.noUnmetEssentials", "No stated essential is unmet."));
  const visaSource = result.visaStatus.source ? t("match.visaSource", " Source: {source}.", { source: result.visaStatus.source }) : "";
  sentences.push(t("match.visaSeparate", "Visa status: {status}; checked separately and not part of the match score.{source}", { status: visaLabel(result.visaStatus), source: visaSource }));
  return sentences;
}
