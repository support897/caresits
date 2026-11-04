import { z } from "zod";
export const Role = z.enum(["family", "carer"]); export type Role = z.infer<typeof Role>;
export const CareType = z.enum(["babysitter", "nanny", "au_pair"]); export type CareType = z.infer<typeof CareType>;
export const QualStatus = z.enum(["submitted", "under_review", "verified", "expired", "needs_renewal"]); export type QualStatus = z.infer<typeof QualStatus>;
export const Qualification = z.object({ id: z.string(), kind: z.string(), label: z.string(), status: QualStatus, state: z.string().optional(), checkedOn: z.string().optional(), verifiedBy: z.string().optional(), expires: z.string().optional() });
export type Qualification = z.infer<typeof Qualification>;
export const Child = z.object({ id: z.string(), name: z.string().min(1), ageYears: z.number().min(0).max(18), interests: z.array(z.string()).default([]), allergies: z.array(z.string()).default([]) });
export type Child = z.infer<typeof Child>;
export const Profile = z.object({ uid: z.string(), role: Role, name: z.string(), photoUrl: z.string().optional(), headline: z.string().optional(), about: z.string().optional(), postcode: z.string().optional(), suburb: z.string().optional(), lat: z.number().optional(), lng: z.number().optional(), languages: z.array(z.string()).default([]), careTypes: z.array(CareType).default([]), rate: z.number().optional(), budgetMax: z.number().optional(), experienceYears: z.number().optional(), style: z.array(z.string()).default([]), activities: z.array(z.string()).default([]), days: z.array(z.string()).default([]), kids: z.array(Child).default([]), videoKey: z.string().optional(), updatedAt: z.any().optional() });
export type Profile = z.infer<typeof Profile>;
export const BookingRequest = z.object({ carerUid: z.string(), familyUid: z.string(), date: z.string(), from: z.string(), to: z.string(), rate: z.number(), estimate: z.number(), recurring: z.enum(["none", "weekly"]).default("none"), note: z.string().optional() });
export type BookingRequest = z.infer<typeof BookingRequest>;
export type Rel = { id: string; members: string[]; state: "pending" | "contact" | "hired" | "blocked"; createdBy?: string };
export const CarerVerifiedFlagIsServerOnly = true as const; // verified flags are written ONLY by Cloud Functions
