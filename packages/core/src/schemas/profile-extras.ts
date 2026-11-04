import { z } from "zod";

export const ageGroupSchema = z.enum(["newborn", "infant", "toddler", "preschool", "school"]);

const weekdaySchema = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
const weekdayListSchema = z.array(weekdaySchema).max(7);
const galleryKeySchema = z.string().min(1).max(500).regex(/^users\/[^/]+\/.+$/);

export const profileEssentialsSchema = z.object({
  schedule: z.enum(["essential", "flexible"]).optional(),
  budget: z.enum(["essential", "flexible"]).optional(),
  minAgeGroupsOk: z.boolean().optional(),
}).strict();

export const householdPrefsSchema = z.object({
  pets: z.boolean().optional(),
  smoking: z.boolean().optional(),
  languagesAtHome: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  houseRules: z.string().max(300).optional(),
}).strict();

export const reviewSummarySchema = z.object({
  count: z.number().int().nonnegative(),
  avg: z.number().min(0).max(5),
}).strict();

export const auPairHostSchema = z.object({
  country: z.string().max(80).optional(),
  room: z.string().max(300).optional(),
  accommodation: z.string().max(300).optional(),
  meals: z.string().max(300).optional(),
  daysOff: weekdayListSchema.optional(),
  location: z.object({
    suburb: z.string().max(80).optional(),
    city: z.string().max(80).optional(),
  }).strict().optional(),
  expectations: z.string().max(300).optional(),
  durationMonths: z.number().int().min(1).max(36).optional(),
  visaSupport: z.boolean().optional(),
  pocketMoneyPerWeek: z.number().nonnegative().nullable().optional(),
  hoursPerWeek: z.number().nonnegative().nullable().optional(),
  childcareDuties: z.array(z.string().max(120)).max(30).optional(),
  otherHousework: z.array(z.string().max(120)).max(30).optional(),
  languages: z.array(z.string().max(60)).max(20).optional(),
  visaHelp: z.boolean().optional(),
  infantCareNeeded: z.boolean().optional(),
}).strict();

export const auPairProfileSchema = z.object({
  on: z.boolean().optional(),
  arrival: z.string().max(200).optional(),
  durationMonths: z.number().int().min(1).max(36).optional(),
  homeCountry: z.string().max(80).optional(),
  english: z.string().max(60).optional(),
  infant: z.boolean().optional(),
  drives: z.boolean().optional(),
  swim: z.boolean().optional(),
  destinations: z.array(z.string().max(80)).max(20).optional(),
  languages: z.array(z.string().max(60)).max(20).optional(),
  preferredAges: z.array(ageGroupSchema).max(5).optional(),
  ageGroups: z.array(ageGroupSchema).max(5).optional(),
  accommodation: z.string().max(300).optional(),
  pocketMoneyExpectation: z.string().max(160).optional(),
  culturalInterests: z.array(z.string().max(100)).max(30).optional(),
  expectations: z.string().max(300).optional(),
  visaNotes: z.string().max(300).optional(),
}).strict();

export const profileGalleryItemSchema = galleryKeySchema;
export const profileParentNamesSchema = z.array(z.string().trim().min(1).max(40)).max(4);
