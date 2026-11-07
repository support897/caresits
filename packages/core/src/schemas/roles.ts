import { z } from "zod";

/** Six role journeys. Each has its own required fields; no single generic form. Persisted as card.careTypes + side. */
const money = z.number().nonnegative();
const days = z.array(z.string().min(2)).min(1, "Pick at least one day");
const langs = z.array(z.string().min(2)).min(1);
const kids = z.array(z.object({ name: z.string().min(1).max(40), ageYears: z.number().min(0).max(18) })).min(1, "Add at least one child");
const location = z.string().min(2).max(120);

const familyBase = { displayName: z.string().min(1), location, kids, languages: langs.optional() };
const carerBase = { displayName: z.string().min(1), location, languages: langs, experienceYears: z.number().min(0).max(60), ageGroups: z.array(z.string()).min(1, "Pick age groups") };

export const familyNannySchema = z.object({ role: z.literal("family:nanny"), ...familyBase, schedule: days, budgetMax: money.positive(), duties: z.array(z.string()).min(1), routines: z.string().min(1), smokingPreference: z.enum(["any", "non_smoker"]), requiresDriver: z.boolean(), pets: z.boolean() });
export const familyBabysitterSchema = z.object({ role: z.literal("family:babysitter"), ...familyBase, careInstructions: z.string().min(1), dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1), from: z.string().regex(/^\d{2}:\d{2}$/), to: z.string().regex(/^\d{2}:\d{2}$/), durationHours: z.number().positive().max(24), budgetMax: money.positive(), transportNeeded: z.boolean() });
export const familyAuPairSchema = z.object({ role: z.literal("family:au_pair"), ...familyBase, country: z.string().min(2), accommodation: z.string().min(1), pocketMoneyPerWeek: money.positive(), meals: z.string().min(1), hoursPerWeek: z.number().positive().max(60), duties: z.array(z.string()).min(1), daysOff: days, durationMonths: z.number().int().min(1).max(36), houseRules: z.string().optional() });
export const nannySchema = z.object({ role: z.literal("carer:nanny"), ...carerBase, rate: money.positive(), availability: days, duties: z.array(z.string()).min(1), drives: z.boolean(), ownVehicle: z.boolean(), firstAidCurrent: z.boolean().optional(), workAuthorization: z.string().optional(), references: z.number().int().min(0).max(5) });
export const babysitterSchema = z.object({ role: z.literal("carer:babysitter"), ...carerBase, rate: money.positive(), availability: days, minBookingHours: z.number().positive().max(24), transport: z.enum(["own_vehicle", "public_transport", "walk_only"]), duties: z.array(z.string()).min(1) });
export const auPairSchema = z.object({ role: z.literal("carer:au_pair"), displayName: z.string().min(1), homeCountry: z.string().min(2), currentCountry: z.string().min(2), destinations: z.array(z.string().min(2)).min(1), languages: langs, experienceYears: z.number().min(0).max(60), arrivalWindow: z.string().min(1), durationMonths: z.number().int().min(1).max(36), accommodationPreference: z.string().min(1), pocketMoneyExpectation: z.string().min(1), duties: z.array(z.string()).min(1), visaStatus: z.enum(["unknown", "has_visa", "needs_visa", "not_applicable"]) });

export const roleProfileSchema = z.discriminatedUnion("role", [familyNannySchema, familyBabysitterSchema, familyAuPairSchema, nannySchema, babysitterSchema, auPairSchema]);
export type RoleProfile = z.infer<typeof roleProfileSchema>;
export type RoleId = RoleProfile["role"];
export const ROLE_IDS: RoleId[] = ["family:nanny", "family:babysitter", "family:au_pair", "carer:nanny", "carer:babysitter", "carer:au_pair"];

export function roleOf(side: "family" | "carer", service: string): RoleId | null {
  const id = `${side}:${service}`;
  return (ROLE_IDS as string[]).includes(id) ? (id as RoleId) : null;
}
/** Field names (human) that are missing/invalid for the given role. Never converts one role into another. */
export function missingFields(role: RoleId, data: Record<string, unknown>): string[] {
  const schema = roleProfileSchema.options.find((o) => o.shape.role.value === role)!;
  const res = schema.safeParse({ ...data, role });
  return res.success ? [] : [...new Set(res.error.issues.map((i) => String(i.path[0] ?? "role")))];
}
/** Child details are visible only to the owner or an authorised relationship. */
export function canSeeChildDetails(viewerUid: string, ownerUid: string, hasRelationship: boolean): boolean { return viewerUid === ownerUid || hasRelationship; }
