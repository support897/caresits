import type { ServiceType } from "@cc/core";

/** Role-specific question sets (6 journeys). Data-driven, validated here, stored in card.serviceDetails[service]. */
export type FieldType = "text" | "number" | "bool" | "multi" | "choice";
export type DetailField = { key: string; label: string; type: FieldType; required?: boolean; options?: string[]; min?: number; max?: number };
export type Side = "family" | "carer";

const DUTIES = ["meals", "laundry", "school run", "homework", "cooking", "light housework", "bedtime routine"];
const AGES = ["newborn", "infant", "toddler", "preschool", "school"];

export const SERVICE_DETAIL_FIELDS: Record<`${Side}:${ServiceType}`, DetailField[]> = {
  "family:nanny": [
    { key: "duties", label: "Duties you need", type: "multi", options: DUTIES, required: true },
    { key: "routines", label: "Daily routine (short)", type: "text", required: true },
    { key: "smokingPreference", label: "Smoking preference", type: "choice", options: ["any", "non_smoker"], required: true },
    { key: "requiresDriver", label: "Driver's licence needed", type: "bool", required: true },
    { key: "petsAtHome", label: "Pets at home", type: "bool", required: true },
  ],
  "family:babysitter": [
    { key: "careInstructions", label: "Care instructions (short)", type: "text", required: true },
    { key: "dates", label: "Date needed (YYYY-MM-DD)", type: "text", required: true },
    { key: "durationHours", label: "Hours needed", type: "number", min: 1, max: 24, required: true },
    { key: "transportNeeded", label: "Sitter needs own transport", type: "bool", required: true },
  ],
  "family:au_pair": [
    { key: "accommodation", label: "Room and accommodation", type: "text", required: true },
    { key: "pocketMoneyPerWeek", label: "Pocket money per week (A$)", type: "number", min: 1, max: 2000, required: true },
    { key: "meals", label: "Meals provided", type: "text", required: true },
    { key: "hoursPerWeek", label: "Hours per week", type: "number", min: 1, max: 60, required: true },
    { key: "duties", label: "Duties", type: "multi", options: DUTIES, required: true },
    { key: "durationMonths", label: "Placement length (months)", type: "number", min: 1, max: 36, required: true },
  ],
  "carer:nanny": [
    { key: "ageGroups", label: "Age groups you have cared for", type: "multi", options: AGES, required: true },
    { key: "duties", label: "Duties you offer", type: "multi", options: DUTIES, required: true },
    { key: "drives", label: "I drive", type: "bool", required: true },
    { key: "ownVehicle", label: "I have a vehicle", type: "bool", required: true },
    { key: "firstAid", label: "Current first aid / CPR", type: "bool" },
  ],
  "carer:babysitter": [
    { key: "ageGroups", label: "Age groups you have cared for", type: "multi", options: AGES, required: true },
    { key: "minBookingHours", label: "Shortest booking (hours)", type: "number", min: 1, max: 24, required: true },
    { key: "transport", label: "How you travel", type: "choice", options: ["own_vehicle", "public_transport", "walk_only"], required: true },
    { key: "duties", label: "Duties you offer", type: "multi", options: DUTIES, required: true },
    { key: "firstAid", label: "Current first aid / CPR", type: "bool" },
  ],
  "carer:au_pair": [
    { key: "homeCountry", label: "Home country", type: "text", required: true },
    { key: "currentCountry", label: "Where you live now", type: "text", required: true },
    { key: "arrivalWindow", label: "When can you arrive", type: "text", required: true },
    { key: "durationMonths", label: "Preferred length (months)", type: "number", min: 1, max: 36, required: true },
    { key: "accommodationPreference", label: "Accommodation preference", type: "text", required: true },
    { key: "pocketMoneyExpectation", label: "Pocket money expectation", type: "text", required: true },
    { key: "duties", label: "Duties you are happy with", type: "multi", options: DUTIES, required: true },
    { key: "visaStatus", label: "Visa / work status", type: "choice", options: ["unknown", "has_visa", "needs_visa"], required: true },
  ],
};

export type DetailValues = Record<string, string | number | boolean | string[]>;

export function missingServiceDetails(side: Side, service: ServiceType, values: DetailValues | undefined): string[] {
  const v = values ?? {};
  return SERVICE_DETAIL_FIELDS[`${side}:${service}`].filter((f) => {
    if (!f.required) return false;
    const x = v[f.key];
    if (f.type === "bool") return typeof x !== "boolean";
    if (f.type === "number") return typeof x !== "number" || !Number.isFinite(x) || (f.min !== undefined && x < f.min) || (f.max !== undefined && x > f.max);
    if (f.type === "multi") return !Array.isArray(x) || x.length === 0;
    if (f.type === "choice") return typeof x !== "string" || !f.options?.includes(x);
    return typeof x !== "string" || x.trim() === "";
  }).map((f) => f.key);
}

/** First incomplete service across all chosen services. */
export function firstIncompleteService(side: Side, services: ServiceType[], all: Record<string, DetailValues | undefined>): { service: ServiceType; missing: string[] } | null {
  for (const service of services) { const missing = missingServiceDetails(side, service, all[service]); if (missing.length) return { service, missing }; }
  return null;
}

// ---- persistence: profiles/{uid}/service/{service} ----
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@cc/core";

export async function saveServiceDetails(uid: string, side: Side, all: Record<string, DetailValues | undefined>, services: ServiceType[]): Promise<void> {
  await Promise.all(services.map((service) => setDoc(doc(db, "profiles", uid, "service", service), { service, side, values: all[service] ?? {}, updatedAt: serverTimestamp() })));
}
export async function loadServiceDetails(uid: string): Promise<Record<string, DetailValues>> {
  const snap = await getDocs(collection(db, "profiles", uid, "service"));
  return Object.fromEntries(snap.docs.map((d) => [d.id, (d.data().values ?? {}) as DetailValues]));
}
