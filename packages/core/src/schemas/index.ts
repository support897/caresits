import { z } from "zod";

export const timestampSchema = z.union([
  z.date(),
  z.string().min(1),
  z.number().int().nonnegative(),
  z.object({
    seconds: z.number().int(),
    nanoseconds: z.number().int().min(0).max(999_999_999),
  }).passthrough(),
]);

const weekdaySchema = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
const careTypeSchema = z.enum(["babysitter", "nanny", "au_pair"]);

const matchingWeightsSchema = z.object({
  experience: z.number().min(0).max(100).optional(),
  personality: z.number().min(0).max(100).optional(),
  availability: z.number().min(0).max(100).optional(),
  budget: z.number().min(0).max(100).optional(),
  location: z.number().min(0).max(100).optional(),
  activities: z.number().min(0).max(100).optional(),
}).strict();

const profileKidSchema = z.object({
  name: z.string().trim().min(1).max(40),
  ageYears: z.number().min(0).max(18),
}).strict();

/** Profile card fields visible to the marketplace. Qualification claims are intentionally absent. */
export const profileCardSchema = z.object({
  // Existing live card keys remain accepted. Their detailed legacy shapes stay owned by the profile flow.
  childrenBands: z.unknown().optional(),
  languages: z.unknown().optional(),
  pets: z.unknown().optional(),
  smokerHousehold: z.unknown().optional(),
  scheduleNeed: z.unknown().optional(),
  payOffered: z.unknown().optional(),
  age: z.unknown().optional(),
  nationality: z.unknown().optional(),
  cultureOffer: z.unknown().optional(),
  smoker: z.unknown().optional(),
  experience: z.unknown().optional(),
  checksLevel: z.unknown().optional(),
  availability: z.unknown().optional(),
  drives: z.unknown().optional(),
  ownCar: z.unknown().optional(),
  cooking: z.unknown().optional(),
  tasks: z.unknown().optional(),
  tasksRefused: z.unknown().optional(),
  activities: z.unknown().optional(),
  personality: z.unknown().optional(),
  routineStyle: z.unknown().optional(),
  agesAccepted: z.unknown().optional(),
  agesPreferred: z.unknown().optional(),
  petsOk: z.unknown().optional(),
  smokerHouseholdOk: z.unknown().optional(),
  nonSmokerHousehold: z.unknown().optional(),
  specialNeeds: z.unknown().optional(),
  payFloor: z.unknown().optional(),
  maxDistanceKm: z.unknown().optional(),
  latE2: z.unknown().optional(),
  lngE2: z.unknown().optional(),
  gallery: z.unknown().optional(),
  auPair: z.unknown().optional(),
  headline: z.string().max(80).optional(),
  rate: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  careTypes: z.array(careTypeSchema).max(3).optional(),
  kids: z.array(profileKidSchema).max(8).optional(),
  videoKey: z.string().max(500).optional(),
  style: z.array(z.string().max(40)).max(20).optional(),
  suburb: z.string().max(80).optional(),
  instantBook: z.boolean().optional(),
  lastActive: z.number().int().nonnegative().optional(),
  weights: matchingWeightsSchema.optional(),
}).strict();

export const profileSchema = z.object({
  side: z.enum(["family", "carer"]),
  displayName: z.string().min(1).max(100),
  postcode: z.string().max(20).optional(),
  photoUrl: z.string().max(2_000).optional(),
  about: z.string().max(300).optional(),
  card: profileCardSchema,
  looking: z.object({ musts: z.record(z.unknown()), prefs: z.record(z.unknown()) }).strict().optional(),
  updatedAt: timestampSchema.optional(),
}).strict();

export const bookingStateSchema = z.enum([
  "requested", "accepted", "declined", "cancelled", "completed",
]);

export const bookingDecisionSchema = z.object({
  pairId: z.string().min(1).max(512).regex(/^[^/]+$/),
  bookingId: z.string().min(1).max(128).regex(/^[^/]+$/),
  decision: z.enum(["accepted", "declined", "cancelled"]),
}).strict();

const bookingDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

export const bookingSchema = z.object({
  familyUid: z.string().min(1),
  carerUid: z.string().min(1),
  date: bookingDateSchema,
  from: timeSchema,
  to: timeSchema,
  rate: z.number().nonnegative(),
  estimate: z.number().nonnegative(),
  recurring: z.enum(["none", "weekly"]),
  weekdays: z.array(weekdaySchema).max(7),
  note: z.string().max(1_000).optional(),
  state: bookingStateSchema,
  createdBy: z.string().min(1),
  createdAt: timestampSchema,
  decidedAt: timestampSchema.optional(),
}).strict().refine((value) => value.familyUid !== value.carerUid, {
  message: "Family and carer must be different users",
  path: ["carerUid"],
});

export const careSpaceSchema = z.object({
  ownerUid: z.string().min(1),
  name: z.string().min(1).max(100),
  createdAt: timestampSchema,
}).strict();

export const careSpaceMemberPermsSchema = z.object({
  allergies: z.boolean().optional(),
  medication: z.boolean().optional(),
  photos: z.boolean().optional(),
  calendar: z.boolean().optional(),
  privateMessages: z.boolean().optional(),
}).strict();

export const careSpaceMemberSchema = z.object({
  role: z.enum(["admin", "regular", "limited", "viewer"]),
  status: z.enum(["active", "removed"]),
  perms: careSpaceMemberPermsSchema.optional(),
  displayName: z.string().max(80).optional(),
  joinedAt: timestampSchema.optional(),
  invitedBy: z.string().optional(),
  inviteId: z.string().optional(),
}).strict();

const sectionNotesSchema = z.object({
  notes: z.string().max(2_000).optional(),
  memories: z.array(z.string().max(500)).max(50).optional(),
}).strict();

export const careSpaceChildSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ageYears: z.number().min(0).max(18).optional(),
  interests: z.array(z.string().max(60)).max(30).optional(),
  sections: z.object({
    health: sectionNotesSchema.optional(),
    meals: sectionNotesSchema.optional(),
    sleep: sectionNotesSchema.optional(),
    mood: sectionNotesSchema.optional(),
    learning: sectionNotesSchema.optional(),
    memories: z.array(z.string().max(500)).max(50).optional(),
  }).strict().optional(),
}).strict();

export const dayStoryKindSchema = z.enum([
  "arrival", "meal", "drink", "nap", "activity", "mood", "photo", "pickup", "note",
]);

export const dayStorySchema = z.object({
  childId: z.string().min(1),
  day: bookingDateSchema,
  kind: dayStoryKindSchema,
  at: timestampSchema,
  text: z.string().max(2_000).optional(),
  mood: z.string().max(40).optional(),
  photoKey: z.string().max(500).optional(),
  by: z.string().min(1),
  asks: z.array(z.object({
    by: z.string().min(1),
    text: z.string().max(500),
    at: timestampSchema,
    answeredAt: timestampSchema.optional(),
  }).strict()).max(20).optional(),
}).strict();

export const calendarKindSchema = z.enum([
  "booking", "shift", "school", "activity", "pickup", "timeoff",
]);

export const calendarEventSchema = z.object({
  kind: calendarKindSchema,
  title: z.string().min(1).max(160),
  start: timestampSchema,
  end: timestampSchema,
  childId: z.string().optional(),
  ownerUid: z.string().min(1),
  state: z.enum(["active", "requested", "approved", "declined", "swap"]),
  swap: z.object({ start: timestampSchema, end: timestampSchema }).strict().optional(),
  bookingRef: z.string().optional(),
}).strict();

export const allergyItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  severity: z.string().min(1).max(32),
  notes: z.string().max(1_000).optional(),
}).strict();

export const medicationItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dose: z.string().max(120),
  times: z.array(z.string().max(40)).max(20),
  notes: z.string().max(1_000).optional(),
}).strict();

export const emergencyContactSchema = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().min(1).max(40),
  relation: z.string().max(60).optional(),
}).strict();

export const emergencyContactsSchema = z.object({
  contacts: z.array(emergencyContactSchema).max(3),
}).strict();

export const medicalRecordSchema = z.object({
  allergies: z.array(allergyItemSchema).max(50),
  medication: z.array(medicationItemSchema).max(50),
  emergency: z.object({
    contacts: z.array(emergencyContactSchema).max(10),
    doctor: z.string().max(160).optional(),
    notes: z.string().max(2_000).optional(),
  }).strict(),
}).strict();

export const medicalSectionRecordSchema = z.object({
  items: z.array(z.unknown()).max(50),
  updatedBy: z.string().min(1),
  updatedAt: timestampSchema,
  alertId: z.string().min(1),
}).strict();

export const careSpaceInviteSchema = z.object({
  spaceId: z.string().min(1),
  role: z.enum(["regular", "limited", "viewer"]),
  createdBy: z.string().min(1),
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
  usedBy: z.string().min(1).nullable(),
}).strict().refine((value) => {
  const created = value.createdAt instanceof Date ? value.createdAt.getTime() : null;
  const expires = value.expiresAt instanceof Date ? value.expiresAt.getTime() : null;
  return created === null || expires === null || expires > created;
}, { message: "Invite expiry must follow creation", path: ["expiresAt"] });

export const notificationPrefsSchema = z.object({
  mode: z.enum(["all", "key", "daily"]).default("all"),
  messages: z.boolean().default(true),
  bookings: z.boolean().default(true),
  careUpdates: z.boolean().default(true),
  requests: z.boolean().default(true),
  calendar: z.boolean().default(true),
  shopping: z.boolean().default(true),
  allergyChanges: z.boolean().default(true),
  muteNonUrgentWhileWorking: z.boolean().default(false),
  dailyRecapTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
}).strict();

export type ProfileCard = z.infer<typeof profileCardSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type CareSpace = z.infer<typeof careSpaceSchema>;
export type CareSpaceMember = z.infer<typeof careSpaceMemberSchema>;
export type CareSpaceChild = z.infer<typeof careSpaceChildSchema>;
export type DayStory = z.infer<typeof dayStorySchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type MedicalRecord = z.infer<typeof medicalRecordSchema>;
export type EmergencyContacts = z.infer<typeof emergencyContactsSchema>;
export type CareSpaceInvite = z.infer<typeof careSpaceInviteSchema>;
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
