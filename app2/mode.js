// The whole view mode (Phase 3 of the redesign plan, §c): the
// app stands in one of two postures. "finding" is the Finding
// world (Home is the Finding home, the menu carries Find,
// Matches and the Urgent board). "connected" is the dreaming
// pair's daily world (Home is the Connected daily home, the
// menu carries Today, Calendar, Day Story and Messages).
//
// The switch lives in the side bar menu and in Settings, never
// on a home page. The choice is saved on the account (the
// meta/app doc, beside language and appearance, through the
// live write route) and read back at boot, so it follows the
// member across devices. A device copy rides beside it (the
// language pattern) so the first paint stands in the right
// posture before the boot lands.
//
// A member who never touches the switch keeps the standing
// default: Connected when a live pair exists, else Finding.
// Once chosen, the account choice wins over the default.

export const MODE_FINDING = "finding";
export const MODE_CONNECTED = "connected";

// A mode value read from anywhere untrusted (a doc, a device
// key, a legacy posture key): a known mode, or null.
export function cleanMode(value) {
  if (value === MODE_FINDING || value === MODE_CONNECTED) return value;
  return null;
}

// The legacy device posture key spoke "days" for the daily
// home; it maps to Connected so an old pick still means what
// it meant. Anything else reads as no pick.
export function modeFromLegacyPosture(value) {
  if (value === "days") return MODE_CONNECTED;
  if (value === "finding") return MODE_FINDING;
  return null;
}

// The account choice rides the meta/app doc beside language
// and appearance.
export function modeFromAppDoc(appDoc) {
  return cleanMode(appDoc && appDoc.mode);
}

// The boot decision: the account choice wins, then a device
// copy of a past pick, then the standing default. `chosen`
// names the mode the member picked (null when the default is
// standing in).
export function resolveBootMode({ accountMode = null, deviceMode = null, hasLivePair = false } = {}) {
  const chosen = cleanMode(accountMode) || cleanMode(deviceMode);
  if (chosen) return { mode: chosen, chosen };
  return { mode: hasLivePair ? MODE_CONNECTED : MODE_FINDING, chosen: null };
}
