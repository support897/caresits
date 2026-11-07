/**
 * One shared rule for who may see whom (map, discovery, search, saved, recommendations).
 * Family looking for X sees only carers who offer X. Carer offering X sees only families looking for X.
 * Missing service data never matches. Mirrors the Firestore rule `eligibleCounterpart` in packages/rules.
 */
export const SERVICE_TYPES = ["nanny", "babysitter", "au_pair"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];
export type EligibilitySide = "family" | "carer";
export type EligibilityProfile = { uid?: string; side: EligibilitySide; card?: Record<string, unknown> };
/** The 6 role journeys: side + service. */
export type RoleKey = `${EligibilitySide}:${ServiceType}`;

export function isServiceType(value: unknown): value is ServiceType {
  return typeof value === "string" && (SERVICE_TYPES as readonly string[]).includes(value);
}

/** Services a profile looks for (family) or offers (carer). Unknown values are dropped, never guessed. */
export function servicesOf(profile: EligibilityProfile): ServiceType[] {
  const raw = profile.card?.careTypes;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isServiceType))];
}

export function rolesOf(profile: EligibilityProfile): RoleKey[] {
  return servicesOf(profile).map((service) => `${profile.side}:${service}` as RoleKey);
}

const COUNTRY_CODES: Record<string, string> = { au: "australia", nz: "new zealand", ca: "canada", us: "united states", ie: "ireland", uk: "united kingdom", gb: "united kingdom", no: "norway", se: "sweden", dk: "denmark", nl: "netherlands", de: "germany", fr: "france", ch: "switzerland", es: "spain", it: "italy" };
const normCountry = (x: string) => { const k = x.trim().toLowerCase(); return COUNTRY_CODES[k] ?? k; };

function destinationsOf(profile: EligibilityProfile): string[] {
  const card = profile.card ?? {};
  const host = card.auPairHost as Record<string, unknown> | undefined;
  const pair = card.auPair as Record<string, unknown> | undefined;
  const raw = profile.side === "family" ? [host?.country] : Array.isArray(pair?.destinations) ? pair.destinations : [pair?.destination, pair?.country];
  return raw.filter((x): x is string => typeof x === "string" && x.trim() !== "").map(normCountry);
}

/** `intent` narrows the viewer to one service (e.g. a family that wants a nanny today). */
export function isEligibleCounterpart(viewer: EligibilityProfile, candidate: EligibilityProfile, intent?: ServiceType | null): boolean {
  if (viewer.uid && candidate.uid && viewer.uid === candidate.uid) return false;
  if (viewer.side === candidate.side) return false;
  const mine = intent ? servicesOf(viewer).filter((s) => s === intent) : servicesOf(viewer);
  if (intent && !servicesOf(viewer).includes(intent)) return false;
  const theirs = servicesOf(candidate);
  const shared = mine.filter((s) => theirs.includes(s));
  if (!shared.length) return false;
  // Au pair placement context: when both name a country, they must share one.
  if (shared.length === 1 && shared[0] === "au_pair") {
    const a = destinationsOf(viewer), b = destinationsOf(candidate);
    if (a.length && b.length && !a.some((x) => b.includes(x))) return false;
  }
  return true;
}

export function filterEligible<T extends EligibilityProfile>(viewer: EligibilityProfile, candidates: T[], intent?: ServiceType | null): T[] {
  return candidates.filter((c) => isEligibleCounterpart(viewer, c, intent));
}
