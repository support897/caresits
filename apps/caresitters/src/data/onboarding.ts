export type OnboardingSide = "family" | "carer";
export type KidDraft = { name: string; ageYears: string };
export type OnboardingDraft = {
  displayName: string;
  postcode: string;
  suburb: string;
  kids: KidDraft[];
  familyCareTypes: string[];
  carerCareTypes: string[];
  familyDays: string[];
  familyFrom: string;
  familyTo: string;
  budgetMax: number;
  distanceKm: number;
  style: string[];
  activities: string[];
  familyLanguages: string[];
  freeText: string;
  photoKey: string;
  headline: string;
  intro: string;
  videoKey: string;
  languages: string[];
  experienceYears: string;
  qualifications: Array<{ id: string; label: string; status: string }>;
  rate: number;
  carerDays: string[];
  carerFrom: string;
  carerTo: string;
};

export const FAMILY_STEP_KEYS = ["family", "children", "care-type", "schedule", "budget", "distance", "values"] as const;
export const CARER_STEP_KEYS = ["photo", "headline", "intro", "video", "languages", "experience", "qualifications", "rate", "availability", "care-types"] as const;

export function progressPercent(stepIndex: number, totalSteps: number): number {
  if (!Number.isFinite(totalSteps) || totalSteps <= 0) return 0;
  const lastIndex = Math.max(0, Math.floor(totalSteps) - 1);
  const index = Math.max(0, Math.min(lastIndex, Number.isFinite(stepIndex) ? Math.floor(stepIndex) : 0));
  return Math.round(((index + 1) / Math.floor(totalSteps)) * 100);
}

export function createOnboardingDraft(): OnboardingDraft {
  return {
    displayName: "", postcode: "", suburb: "", kids: [{ name: "", ageYears: "" }],
    familyCareTypes: [], carerCareTypes: [], familyDays: [], familyFrom: "", familyTo: "", budgetMax: 30, distanceKm: 10,
    style: [], activities: [], familyLanguages: [], freeText: "", photoKey: "", headline: "", intro: "", videoKey: "",
    languages: [], experienceYears: "", qualifications: [], rate: 30, carerDays: [], carerFrom: "", carerTo: "",
  };
}

export function onboardingDraftKey(uid: string, side: OnboardingSide): string {
  return `caresits-onboarding-${uid}-${side}`;
}

export function saveOnboardingDraft(uid: string, side: OnboardingSide, draft: OnboardingDraft, stepIndex: number): void {
  if (!uid || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(onboardingDraftKey(uid, side), JSON.stringify({ draft, stepIndex }));
    localStorage.setItem(`caresits-onboarding-side-${uid}`, side);
  } catch { /* local save is a convenience */ }
}

export function loadOnboardingSide(uid: string): OnboardingSide | null {
  try {
    const value = localStorage.getItem(`caresits-onboarding-side-${uid}`);
    return value === "family" || value === "carer" ? value : null;
  } catch { return null; }
}

export function loadOnboardingDraft(uid: string, side: OnboardingSide): { draft: OnboardingDraft; stepIndex: number } | null {
  if (!uid || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(onboardingDraftKey(uid, side));
    if (!raw) return null;
    const value = JSON.parse(raw) as { draft?: Partial<OnboardingDraft>; stepIndex?: number };
    if (!value.draft || typeof value.draft !== "object") return null;
    return { draft: { ...createOnboardingDraft(), ...value.draft }, stepIndex: Number.isFinite(value.stepIndex) ? Math.max(0, Math.floor(value.stepIndex ?? 0)) : 0 };
  } catch { return null; }
}

export function clearOnboardingDraft(uid: string, side: OnboardingSide): void {
  try {
    localStorage.removeItem(onboardingDraftKey(uid, side));
    if (localStorage.getItem(`caresits-onboarding-side-${uid}`) === side) localStorage.removeItem(`caresits-onboarding-side-${uid}`);
  } catch { /* storage may be blocked */ }
}

function firstName(value: string): string {
  return value.trim().split(/\s+/)[0] ?? "";
}
function daySchedule(days: string[], from: string, to: string): Record<string, { from?: string; to?: string }> {
  return Object.fromEntries(days.map((day) => [day, { ...(from ? { from } : {}), ...(to ? { to } : {}) }]));
}
function finiteNumber(value: number | string, fallback?: number): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export type ProfilePatch = {
  side?: OnboardingSide;
  displayName?: string;
  postcode?: string;
  photoUrl?: string;
  about?: string;
  card: Record<string, unknown>;
};

/** Builds only public profile fields. Child names are reduced to first names; no exact address or child photos are included. */
export function buildProfilePatch(side: OnboardingSide, draft: OnboardingDraft, primarySide?: OnboardingSide): ProfilePatch {
  const about = draft.intro.trim().slice(0, 300);
  const sharedLocation = {
    ...(draft.suburb.trim() ? { suburb: draft.suburb.trim() } : {}),
  };
  const roleCard: Record<string, unknown> = side === "family" ? {
    ...sharedLocation,
    kids: draft.kids.filter((kid) => kid.name.trim() && Number.isFinite(Number(kid.ageYears))).map((kid) => ({ name: firstName(kid.name), ageYears: Math.max(0, Math.min(18, Number(kid.ageYears))) })),
    careTypes: [...draft.familyCareTypes],
    scheduleNeed: daySchedule(draft.familyDays, draft.familyFrom, draft.familyTo),
    budgetMax: finiteNumber(draft.budgetMax, 30),
    maxDistanceKm: finiteNumber(draft.distanceKm, 10),
    style: [...draft.style],
    activities: [...draft.activities],
    ...(draft.familyLanguages.length ? { languages: [...draft.familyLanguages] } : {}),
  } : {
    ...sharedLocation,
    ...(draft.headline.trim() ? { headline: draft.headline.trim().slice(0, 80) } : {}),
    ...(draft.photoKey ? { photoUrl: draft.photoKey } : {}),
    ...(draft.videoKey ? { videoKey: draft.videoKey } : {}),
    languages: [...draft.languages],
    ...(finiteNumber(draft.experienceYears) !== undefined ? { experienceYears: finiteNumber(draft.experienceYears) } : {}),
    ...(finiteNumber(draft.rate) !== undefined ? { rate: finiteNumber(draft.rate) } : {}),
    availability: daySchedule(draft.carerDays, draft.carerFrom, draft.carerTo),
    careTypes: [...draft.carerCareTypes],
  };

  if (primarySide && side !== primarySide) {
    return {
      card: {
        alsoSide: {
          side,
          ...roleCard,
          ...(about ? { about } : {}),
        },
      },
    };
  }

  return {
    side,
    displayName: draft.displayName.trim(),
    postcode: draft.postcode.trim(),
    ...(draft.photoKey ? { photoUrl: draft.photoKey } : {}),
    ...(about ? { about } : {}),
    card: roleCard,
  };
}
