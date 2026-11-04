import type { Activity } from "../content/activities";

export type ActivityFilter = {
  ageYears: number;
  interests?: readonly string[];
  owns?: readonly string[];
  ownedOnly?: boolean;
};

const clean = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function hasMaterial(owned: readonly string[], needed: string): boolean {
  const target = clean(needed);
  return owned.some((entry) => {
    const item = clean(entry);
    return item === target || item.includes(target) || target.includes(item);
  });
}

function interestMatches(activity: Activity, interests: readonly string[]): boolean {
  if (!interests.length) return true;
  const wanted = interests.map(clean).filter(Boolean);
  return activity.interests.some((interest) => wanted.some((item) => item === clean(interest) || item.includes(clean(interest)) || clean(interest).includes(item)));
}

export function filterActivities(activities: readonly Activity[], filter: ActivityFilter): Activity[] {
  const interests = filter.interests ?? [];
  const owns = filter.owns ?? [];
  return activities
    .filter((activity) => filter.ageYears >= activity.minAge && filter.ageYears <= activity.maxAge)
    .filter((activity) => interestMatches(activity, interests))
    .filter((activity) => !filter.ownedOnly || activity.materials.every((material) => hasMaterial(owns, material)))
    .map((activity, index) => ({ activity, index, owned: activity.materials.filter((material) => hasMaterial(owns, material)).length }))
    .sort((a, b) => b.owned - a.owned || a.index - b.index)
    .map(({ activity }) => activity);
}

export function missingMaterials(activity: Activity, owns: readonly string[]): string[] {
  return activity.materials.filter((material) => !hasMaterial(owns, material));
}
