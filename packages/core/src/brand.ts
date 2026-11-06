// ONE place for names + palette. Never hard-code the second app's name anywhere else (trademark risk unresolved).
export const APP1 = "Caresitters";
export const APP2 = "CareSpace";
export const TOKENS = { ink: "#3B2A33", cream: "#FFFBF2", sage: "#FFE08A", blush: "#FFE3EC", bunny: "#F4A9BC" } as const;
export const STORAGE_PREFIX = "caresits-"; // keep old keys so no user loses data
export const TAGLINE = "Find care. Share the day.";
export const PLAN_PRICES = { finding: "A$14.95", familyPlus: "A$24.95", searchPass: "A$49", carers: "Free" } as const;
// OWNER TO CONFIRM: cancellation policy wording on the Book screen.
export const CANCEL_POLICY = "Free to cancel up to 24 hours before the start. Later changes are agreed between family and carer.";
export type AppId = "caresitters" | "carespace";
