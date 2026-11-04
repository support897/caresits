import { z } from "zod";

/** Optional booking fields that reveal no child details or exact address. */
export const bookingExtrasSchema = z.object({
  childIds: z.array(z.string().trim().min(1).max(128)).max(8).default([]),
  shareAddress: z.boolean().default(false),
}).strict();

export type BookingExtras = z.infer<typeof bookingExtrasSchema>;

export { findBookingConflicts } from "./availability.js";
