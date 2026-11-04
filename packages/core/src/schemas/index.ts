import { z } from "zod";
import { ageGroupSchema, auPairHostSchema, auPairProfileSchema, householdPrefsSchema, profileEssentialsSchema, profileGalleryItemSchema, profileParentNamesSchema, reviewSummarySchema } from "./profile-extras.js";
export * from "./profile-extras.js";
export * from "./reviews.js";

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
const mediaKeySchema = z.string().min(1).max(500).regex(/^(users|spaces)\/[^/]+\/.+$/);
const weekdayListSchema = z.array(weekdaySchema).max(7);

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

const alsoSideSchema = z.object({
  side: z.enum(["family", "carer"]),
  about: z.string().max(300).optional(),
  headline: z.string().max(80).optional(),
  photoUrl: z.string().max(2_000).optional(),
  videoKey: z.string().max(500).optional(),
  experienceYears: z.number().nonnegative().optional(),
  rate: z.number().nonnegative().optional(),
  availability: z.unknown().optional(),
  careTypes: z.array(careTypeSchema).max(3).optional(),
  kids: z.array(profileKidSchema).max(8).optional(),
  languages: z.unknown().optional(),
  suburb: z.string().max(80).optional(),
  scheduleNeed: z.unknown().optional(),
  budgetMax: z.number().nonnegative().optional(),
  maxDistanceKm: z.number().nonnegative().optional(),
  style: z.array(z.string().max(40)).max(20).optional(),
  activities: z.unknown().optional(),
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
  gallery: z.array(profileGalleryItemSchema).max(6).optional(),
  mainPhotoIndex: z.number().int().min(0).max(5).optional(),
  parentNames: profileParentNamesSchema.optional(),
  householdPrefs: householdPrefsSchema.optional(),
  essentials: profileEssentialsSchema.optional(),
  ageGroups: z.array(ageGroupSchema).max(5).optional(),
  idealFamily: z.string().max(300).optional(),
  reviewsSummary: reviewSummarySchema.optional(),
  auPair: auPairProfileSchema.optional(),
  auPairHost: auPairHostSchema.optional(),
  alsoSide: alsoSideSchema.optional(),
  experienceYears: z.number().nonnegative().optional(),
  photoUrl: z.string().max(2_000).optional(),
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

/** Client-safe profile card schema. Server review aggregates are read-only. */
export const profileCardWriteSchema = profileCardSchema.omit({ reviewsSummary: true }).strict();

const profileShape = {
  side: z.enum(["family", "carer"]),
  displayName: z.string().min(1).max(100),
  postcode: z.string().max(20).optional(),
  photoUrl: z.string().max(2_000).optional(),
  about: z.string().max(300).optional(),
  card: profileCardSchema,
  looking: z.object({ musts: z.record(z.unknown()), prefs: z.record(z.unknown()) }).strict().optional(),
  updatedAt: timestampSchema.optional(),
};

export const profileSchema = z.object(profileShape).strict().superRefine((profile, context) => {
  if (profile.card.mainPhotoIndex !== undefined
      && (profile.card.gallery === undefined || profile.card.mainPhotoIndex >= profile.card.gallery.length)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["card", "mainPhotoIndex"], message: "Main photo index must point to an uploaded gallery item" });
  }
});

export const profileWriteSchema = z.object({
  ...profileShape,
  card: profileCardWriteSchema,
}).strict().superRefine((profile, context) => {
  if (profile.card.mainPhotoIndex !== undefined
      && (profile.card.gallery === undefined || profile.card.mainPhotoIndex >= profile.card.gallery.length)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["card", "mainPhotoIndex"], message: "Main photo index must point to an uploaded gallery item" });
  }
});

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
  childIds: z.array(z.string().min(1).max(128)).max(8).optional(),
  shareAddress: z.boolean().optional(),
  seriesId: z.string().min(1).max(128).optional(),
  endAt: timestampSchema.optional(),
  completedAt: timestampSchema.optional(),
  state: bookingStateSchema,
  createdBy: z.string().min(1),
  createdAt: timestampSchema,
  decidedAt: timestampSchema.optional(),
}).strict().refine((value) => value.familyUid !== value.carerUid, {
  message: "Family and carer must be different users",
  path: ["carerUid"],
});

export const bookingPrefsSchema = z.object({
  childIds: z.array(z.string().min(1).max(128)).max(8).optional(),
  shareAddress: z.boolean().optional(),
  from: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  to: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  weekdays: weekdayListSchema.optional(),
  note: z.string().max(1_000).optional(),
}).strict();

export const bookingSeriesStateSchema = z.enum(["requested", "active", "paused", "ended"]);
export const bookingSeriesSchema = z.object({
  familyUid: z.string().min(1),
  carerUid: z.string().min(1),
  weekdays: weekdayListSchema.min(1),
  from: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  to: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rate: z.number().nonnegative(),
  state: bookingSeriesStateSchema,
  createdAt: timestampSchema,
  decidedAt: timestampSchema.optional(),
}).strict().refine((value) => value.familyUid !== value.carerUid, {
  message: "Family and carer must be different users",
  path: ["carerUid"],
}).refine((value) => value.to > value.from, {
  message: "Series end time must follow start time",
  path: ["to"],
}).refine((value) => value.endDate === undefined || value.endDate >= value.startDate, {
  message: "Series end date must not precede start date",
  path: ["endDate"],
});

export const reviewSchema = z.object({
  relId: z.string().min(1).max(512).regex(/^[^/]+$/),
  bookingId: z.string().min(1).max(128).regex(/^[^/]+$/),
  familyUid: z.string().min(1),
  carerUid: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(600),
  at: timestampSchema,
}).strict().refine((value) => value.familyUid !== value.carerUid, {
  message: "Family and carer must be different users",
  path: ["carerUid"],
});

export const reviewReplySchema = z.object({
  by: z.string().min(1),
  text: z.string().max(600),
  at: timestampSchema,
}).strict();

export const careSpaceSchema = z.object({
  ownerUid: z.string().min(1),
  name: z.string().min(1).max(100),
  imageKey: z.string().max(500).regex(/^spaces\/[^/]+\/.+$/).optional(),
  createdAt: timestampSchema,
}).strict();

export const careSpaceMemberPermsSchema = z.object({
  allergies: z.boolean().optional(),
  medication: z.boolean().optional(),
  photos: z.boolean().optional(),
  calendar: z.boolean().optional(),
  privateMessages: z.boolean().optional(),
  canInvite: z.boolean().optional(),
  canEditAllergies: z.boolean().optional(),
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

const routineTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const childMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(120),
  at: timestampSchema,
  photoKey: mediaKeySchema.optional(),
  note: z.string().max(600).optional(),
}).strict();

export const careSpaceChildSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ageYears: z.number().min(0).max(18).optional(),
  interests: z.array(z.string().max(60)).max(30).optional(),
  foodPreferences: z.array(z.string().max(120)).max(30).optional(),
  learningGoals: z.array(z.string().max(200)).max(30).optional(),
  milestones: z.array(childMilestoneSchema).max(100).optional(),
  routine: z.object({
    wake: routineTimeSchema.optional(),
    bed: routineTimeSchema.optional(),
    naps: z.array(z.object({ from: routineTimeSchema, to: routineTimeSchema }).strict()).max(10).optional(),
  }).strict().optional(),
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
  "arrival", "meal", "drink", "nap", "activity", "mood", "photo", "pickup", "note", "voice",
]);

export const dayStorySchema = z.object({
  childId: z.string().min(1),
  day: bookingDateSchema,
  kind: dayStoryKindSchema,
  at: timestampSchema,
  text: z.string().max(2_000).optional(),
  mood: z.string().max(40).optional(),
  photoKey: z.string().max(500).optional(),
  mediaKey: mediaKeySchema.optional(),
  mediaSize: z.number().int().nonnegative().max(10 * 1024 * 1024).optional(),
  start: timestampSchema.optional(),
  end: timestampSchema.optional(),
  by: z.string().min(1),
  asks: z.array(z.object({
    by: z.string().min(1),
    text: z.string().max(500),
    at: timestampSchema,
    answeredAt: timestampSchema.optional(),
    answerText: z.string().max(2_000).optional(),
    answerPhotoKey: z.string().max(500).optional(),
  }).strict()).max(20).optional(),
}).strict();

export const careSpaceMessageSchema = z.object({
  from: z.string().min(1),
  kind: z.enum(["text", "photo", "photoAsk", "file", "video", "voice"]),
  text: z.string().max(1_000),
  img: z.string().max(400_000).optional(),
  mediaKey: mediaKeySchema.optional(),
  mediaSize: z.number().int().positive().max(50 * 1024 * 1024).optional(),
  mimeType: z.string().max(100).optional(),
  durationMs: z.number().int().positive().max(3_600_000).optional(),
  at: timestampSchema,
}).strict().superRefine((value, ctx) => {
  if (value.kind === "text" || value.kind === "photoAsk") {
    if (value.img !== undefined || value.mediaKey !== undefined || value.mediaSize !== undefined || value.mimeType !== undefined || value.durationMs !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Text messages cannot contain media" });
    }
  } else if (value.kind === "photo") {
    const inline = value.img !== undefined && value.mediaKey === undefined && value.mediaSize === undefined && value.mimeType === undefined && value.durationMs === undefined;
    const stored = value.img === undefined && value.mediaKey !== undefined && value.mediaSize !== undefined && value.durationMs === undefined;
    if (!inline && !stored) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Photos need one valid media form" });
    if (value.mediaKey !== undefined && value.mediaSize !== undefined && value.mediaSize > 10 * 1024 * 1024) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Photos are limited to 10 MB" });
    }
  } else if (value.kind === "file") {
    if (value.img !== undefined || value.mediaKey === undefined || value.mediaSize === undefined || value.mediaSize > 20 * 1024 * 1024 || value.durationMs !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Files are limited to 20 MB" });
    }
  } else {
    const maxSize = value.kind === "video" ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    const maxDuration = value.kind === "video" ? 3_600_000 : 600_000;
    if (value.img !== undefined || value.mediaKey === undefined || value.mediaSize === undefined || value.mediaSize > maxSize || value.durationMs === undefined || value.durationMs > maxDuration) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Media fields do not match the message kind" });
    }
  }
});

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
  recurring: z.object({ weekdays: weekdayListSchema.min(1), until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict().optional(),
}).strict();

export const careSpaceRequestSchema = z.object({
  kind: z.enum(["time-off", "photo", "meal", "shopping", "swap"]),
  by: z.string().min(1),
  to: z.string().min(1).optional(),
  text: z.string().max(600),
  state: z.enum(["open", "done", "declined"]),
  at: timestampSchema,
}).strict();

export const weeklyPlanSchema = z.object({
  days: z.record(z.array(z.string().min(1).max(128)).max(20)).refine((days) =>
    Object.keys(days).length <= 7 && Object.keys(days).every((day) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].includes(day)),
  ),
  approvedBy: z.string().min(1).optional(),
}).strict();

export const careSpaceApprovalSchema = z.object({
  kind: z.enum(["activity", "purchase", "meal"]),
  ref: z.string().min(1).max(128),
  state: z.enum(["pending", "approved", "declined"]),
  by: z.string().min(1),
  decidedBy: z.string().min(1).optional(),
}).strict();

export const spaceGalleryItemSchema = z.object({
  key: z.string().min(1).max(500).regex(/^spaces\/[^/]+\/.+$/),
  kind: z.enum(["photo", "video"]),
  by: z.string().min(1),
  at: timestampSchema,
  childId: z.string().min(1).max(128).optional(),
  sharedByParent: z.boolean(),
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
  updatedAt: timestampSchema.optional(),
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
  perms: careSpaceMemberPermsSchema.optional(),
  targetUid: z.string().min(1).optional(),
  bookingId: z.string().min(1).optional(),
}).strict().refine((value) => {
  const created = value.createdAt instanceof Date ? value.createdAt.getTime() : null;
  const expires = value.expiresAt instanceof Date ? value.expiresAt.getTime() : null;
  return created === null || expires === null || expires > created;
}, { message: "Invite expiry must follow creation", path: ["expiresAt"] }).refine(
  (value) => (value.targetUid === undefined) === (value.bookingId === undefined),
  { message: "Targeted invites must name their accepted booking", path: ["bookingId"] },
);

export const userSpaceIndexSchema = z.object({
  spaceId: z.string().min(1),
  name: z.string().max(100).optional(),
  memberRole: z.enum(["admin", "regular", "limited", "viewer"]),
  joinedAt: timestampSchema,
}).strict();

export const mealPlanSchema = z.object({
  meals: z.array(z.object({
    childId: z.string().min(1),
    name: z.string().min(1).max(160),
    ingredients: z.array(z.string().max(160)).max(100),
  }).strict()).max(50),
}).strict();

export const shoppingItemSchema = z.object({
  item: z.string().trim().min(1).max(200),
  childId: z.string().optional(),
  source: z.enum(["meal", "activity", "manual"]),
  sourceId: z.string().optional(),
  buyer: z.string().optional(),
  due: z.string().optional(),
  bought: z.boolean(),
  reimbursed: z.boolean(),
}).strict();

export const notificationCategorySchema = z.enum([
  "messages", "booking-reminders", "care-updates", "requests", "calendar-changes", "activity-reminders", "shopping", "allergy-changes",
]);

export const notificationSchema = z.object({
  category: notificationCategorySchema,
  title: z.string().min(1).max(120),
  body: z.string().max(500),
  at: timestampSchema,
  read: z.boolean(),
}).strict();

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
export type ProfileCardWrite = z.infer<typeof profileCardWriteSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type ProfileWrite = z.infer<typeof profileWriteSchema>;
export type ProfileEssentials = z.infer<typeof profileEssentialsSchema>;
export type HouseholdPrefs = z.infer<typeof householdPrefsSchema>;
export type AgeGroup = z.infer<typeof ageGroupSchema>;
export type AuPairProfile = z.infer<typeof auPairProfileSchema>;
export type AuPairHost = z.infer<typeof auPairHostSchema>;
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type BookingPrefs = z.infer<typeof bookingPrefsSchema>;
export type BookingSeries = z.infer<typeof bookingSeriesSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type ReviewReply = z.infer<typeof reviewReplySchema>;
export type CareSpace = z.infer<typeof careSpaceSchema>;
export type CareSpaceMember = z.infer<typeof careSpaceMemberSchema>;
export type CareSpaceMemberPerms = z.infer<typeof careSpaceMemberPermsSchema>;
export type CareSpaceChild = z.infer<typeof careSpaceChildSchema>;
export type DayStory = z.infer<typeof dayStorySchema>;
export type CareSpaceMessage = z.infer<typeof careSpaceMessageSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CareSpaceRequest = z.infer<typeof careSpaceRequestSchema>;
export type WeeklyPlan = z.infer<typeof weeklyPlanSchema>;
export type CareSpaceApproval = z.infer<typeof careSpaceApprovalSchema>;
export type SpaceGalleryItem = z.infer<typeof spaceGalleryItemSchema>;
export type AppNotification = z.infer<typeof notificationSchema>;
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;
export type MedicalRecord = z.infer<typeof medicalRecordSchema>;
export type EmergencyContacts = z.infer<typeof emergencyContactsSchema>;
export type CareSpaceInvite = z.infer<typeof careSpaceInviteSchema>;
export type UserSpaceIndex = z.infer<typeof userSpaceIndexSchema>;
export type MealPlan = z.infer<typeof mealPlanSchema>;
export type ShoppingItemData = z.infer<typeof shoppingItemSchema>;
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
