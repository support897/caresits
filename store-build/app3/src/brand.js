// ONE place for names + palette. Never hard-code the CareSpace name elsewhere.
export const APP1 = "Caresitters";
export const APP2 = "CareSpace"; // working name, trademark risk unresolved
export const TOKENS = { ink: "#1E4D44", cream: "#FDF8F0", sage: "#9CC5B5", blush: "#F6CBD3", bunny: "#F4A9BC" };
export const STORAGE_PREFIX = "caresits-"; // keep old keys so no user loses data
export const TAGLINE = "Find care. Share the day.";
// OWNER TO CONFIRM: wording of the cancellation policy shown on the Book screen.
export const CANCEL_POLICY = "Free to cancel up to 24 hours before the start. Later changes are agreed between family and carer.";

// true inside the second app (opened with ?app=cs)
export const IS_CS = typeof location !== "undefined" && new URLSearchParams(location.search).get("app") === "cs";
export const APP_NAME = IS_CS ? APP2 : APP1;
export const APP_TAGLINE = IS_CS ? "Run the care day." : TAGLINE;
