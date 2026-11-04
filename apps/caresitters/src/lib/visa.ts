import { VISA_SOURCES, visaSourceFor, type VisaSource } from "./visaSources";

export type VisaEligibilityStatus = "eligible" | "unknown";
export type VisaAssessment = {
  status: VisaEligibilityStatus;
  source?: VisaSource;
  message: string;
};

const normalizePassport = (passport: string) => passport.trim().toLocaleLowerCase();

/** A positive result needs a checked source with an explicit passport list. */
export function assessVisa(
  destination: string,
  passport: string,
  sources: readonly VisaSource[] = VISA_SOURCES,
): VisaAssessment {
  const key = destination.trim().toLocaleLowerCase();
  const source = sources.find((row) => row.destination.toLocaleLowerCase() === key);
  const passportKey = normalizePassport(passport);
  const listed = source?.passportRules?.eligiblePassports;
  const isExplicitlyListed = source?.checked === true
    && passportKey.length > 0
    && Array.isArray(listed)
    && listed.length > 0
    && listed.some((entry) => normalizePassport(entry) === passportKey);

  if (isExplicitlyListed) {
    return {
      status: "eligible",
      source,
      message: "The official page explicitly lists this passport for the checked pathway. The government decides the application.",
    };
  }
  return {
    status: "unknown",
    source,
    message: "Unknown for your passport - check the official site",
  };
}

/** The home screen uses only these neutral chips, never an eligibility label. */
export function visaChipLabel(source: VisaSource | undefined, passport: string): "Unknown" | "Guidance available" {
  return source?.checked === true && passport.trim().length > 0 ? "Guidance available" : "Unknown";
}

/**
 * Share of selected duties that are unrelated household work, by item count.
 * A warning starts at half of the listed duties; this is a boundary signal,
 * not a legal test or a measure of hours.
 */
export function houseworkShare(childcareDuties: readonly string[], otherHousework: readonly string[]): number {
  const unique = (items: readonly string[]) => new Set(items.map((item) => item.trim().toLocaleLowerCase()).filter(Boolean)).size;
  const childcareCount = unique(childcareDuties);
  const houseworkCount = unique(otherHousework);
  const total = childcareCount + houseworkCount;
  return total === 0 ? 0 : houseworkCount / total;
}

export function hasHighHouseworkShare(childcareDuties: readonly string[], otherHousework: readonly string[]): boolean {
  return houseworkShare(childcareDuties, otherHousework) >= 0.5;
}

export { visaSourceFor };
