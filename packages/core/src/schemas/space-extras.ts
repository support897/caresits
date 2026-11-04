import { z } from "zod";

const fireTimestampSchema = z.union([
  z.date(),
  z.object({
    seconds: z.number().int(),
    nanoseconds: z.number().int().min(0).max(999_999_999),
  }).passthrough(),
]);

const eventTimestampSchema = z.union([
  z.date(),
  z.string().min(1),
  z.number().int().nonnegative(),
  z.object({
    seconds: z.number().int(),
    nanoseconds: z.number().int().min(0).max(999_999_999),
  }).passthrough(),
]);

const weekdaySchema = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
const routineTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const spaceMediaKeySchema = z.string().min(1).max(500).regex(/^spaces\/[^/]+\/.+$/);
const childNotesSchema = z.object({
  notes: z.string().max(2_000).optional(),
  memories: z.array(z.string().max(500)).max(50).optional(),
}).strict();

const milestoneSchema = z.object({
  title: z.string().trim().min(1).max(120),
  at: fireTimestampSchema,
  note: z.string().max(600).optional(),
  photoKey: spaceMediaKeySchema.optional(),
}).strict();

/** Writable child profile fields. Medical records stay in the separate admin-only medical paths. */
export const careSpaceChildRecordSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ageYears: z.number().min(0).max(18).optional(),
  interests: z.array(z.string().max(60)).max(30).optional(),
  foodPreferences: z.array(z.string().max(120)).max(30).optional(),
  learningGoals: z.array(z.string().max(200)).max(30).optional(),
  milestones: z.array(milestoneSchema).max(100).optional(),
  routine: z.object({
    wake: routineTimeSchema.optional(),
    bed: routineTimeSchema.optional(),
    naps: z.array(z.object({ from: routineTimeSchema, to: routineTimeSchema }).strict()).max(10).optional(),
  }).strict().optional(),
  sections: z.object({
    health: childNotesSchema.optional(),
    meals: childNotesSchema.optional(),
    sleep: childNotesSchema.optional(),
    mood: childNotesSchema.optional(),
    learning: childNotesSchema.optional(),
    memories: z.array(z.string().max(500)).max(50).optional(),
  }).strict().optional(),
  createdAt: fireTimestampSchema.optional(),
  updatedAt: fireTimestampSchema.optional(),
}).strict();

/** Recurrence shape shared with CalendarEvent: weekdays use Mon-Sun and until is YYYY-MM-DD. */
export const careSpaceEventRecurrenceSchema = z.object({
  weekdays: z.array(weekdaySchema).min(1).max(7),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

/** CareSpace calendar record, including the optional recurring event fields. */
export const careSpaceCalendarEventSchema = z.object({
  kind: z.enum(["booking", "shift", "school", "activity", "pickup", "timeoff"]),
  title: z.string().min(1).max(160),
  start: eventTimestampSchema,
  end: eventTimestampSchema,
  childId: z.string().optional(),
  ownerUid: z.string().min(1),
  state: z.enum(["active", "requested", "approved", "declined", "swap"]),
  swap: z.object({ start: eventTimestampSchema, end: eventTimestampSchema }).strict().optional(),
  bookingRef: z.string().optional(),
  recurring: careSpaceEventRecurrenceSchema.optional(),
}).strict();

export const careSpaceRequestRecordSchema = z.object({
  kind: z.enum(["time-off", "photo", "meal", "shopping", "swap"]),
  by: z.string().trim().min(1).max(128),
  to: z.string().trim().min(1).max(128).optional(),
  text: z.string().max(300),
  state: z.enum(["open", "done", "declined"]),
  at: fireTimestampSchema,
}).strict();

const weekDaySchema = z.record(z.array(z.string().min(1).max(128)).max(20)).superRefine((days, context) => {
  const allowedDays = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  if (Object.keys(days).length > 7 || Object.keys(days).some((day) => !allowedDays.has(day))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Plan days must use Mon-Sun keys" });
  }
});

export const careSpacePlanRecordSchema = z.object({
  days: weekDaySchema,
  approvedBy: z.string().trim().min(1).max(128).optional(),
}).strict();

export const careSpaceApprovalRecordSchema = z.object({
  kind: z.enum(["activity", "purchase", "meal"]),
  ref: z.string().trim().min(1).max(128),
  state: z.enum(["pending", "approved", "declined"]),
  by: z.string().trim().min(1).max(128),
  decidedBy: z.string().trim().min(1).max(128).optional(),
}).strict();

export const spaceGalleryRecordSchema = z.object({
  key: spaceMediaKeySchema,
  kind: z.enum(["photo", "video"]),
  by: z.string().trim().min(1).max(128),
  at: fireTimestampSchema,
  childId: z.string().trim().min(1).max(128).optional(),
  sharedByParent: z.boolean(),
}).strict();

export type CareSpaceChildRecord = z.infer<typeof careSpaceChildRecordSchema>;
export type CareSpaceEventRecurrence = z.infer<typeof careSpaceEventRecurrenceSchema>;
export type CareSpaceCalendarEvent = z.infer<typeof careSpaceCalendarEventSchema>;
export type CareSpaceRequestRecord = z.infer<typeof careSpaceRequestRecordSchema>;
export type CareSpacePlanRecord = z.infer<typeof careSpacePlanRecordSchema>;
export type CareSpaceApprovalRecord = z.infer<typeof careSpaceApprovalRecordSchema>;
export type SpaceGalleryRecord = z.infer<typeof spaceGalleryRecordSchema>;
