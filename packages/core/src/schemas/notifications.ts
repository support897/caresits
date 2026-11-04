import { z } from "zod";

const notificationTimestampSchema = z.union([
  z.date(),
  z.string().min(1),
  z.number().int().nonnegative(),
  z.object({
    seconds: z.number().int(),
    nanoseconds: z.number().int().min(0).max(999_999_999),
  }).passthrough(),
]);

export const notificationCategorySchema = z.enum([
  "messages", "booking-reminders", "care-updates", "requests", "calendar-changes", "activity-reminders", "shopping", "allergy-changes",
]);

export const notificationSchema = z.object({
  category: notificationCategorySchema,
  title: z.string().min(1).max(120),
  body: z.string().max(500),
  at: notificationTimestampSchema,
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

export type AppNotification = z.infer<typeof notificationSchema>;
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
