// Caresitters app2 — one resolver for browser-held account data.
// A real account always receives a uid-suffixed key. While auth is
// still loading, or while signed out, no account data key is exposed.
// Deliberate demo data gets its own isolated suffix. Legacy plain keys
// are never adopted because the device cannot prove who owns them.

export function currentUid() {
  try {
    if (typeof window !== "undefined" && window.CARESITS_UID) return String(window.CARESITS_UID);
  } catch { /* no window */ }
  try {
    // The journey runs inside the app shell's frame; the shell
    // window is where the live bridge publishes the uid.
    if (typeof window !== "undefined" && window.parent && window.parent !== window && window.parent.CARESITS_UID) {
      return String(window.parent.CARESITS_UID);
    }
  } catch { /* top level or cross origin: the plain keys stand */ }
  return null;
}

export function accountKey(base, uid = currentUid()) {
  return uid ? `${base}-${uid}` : null;
}

function localDataKey(base) {
  const uid = currentUid();
  if (uid) return `${base}-${uid}`;
  // Keep pure Node tests and non-browser callers compatible; a
  // browser never falls back to an unowned, shared key.
  if (typeof window === "undefined") return base;
  try {
    if (window.CARESITS_AUTH_STATE === "signed-out" && sessionStorage.getItem("caresits-demo") === "1") return `${base}-demo`;
  } catch { /* storage is unavailable: do not expose shared data */ }
  return null;
}

export function draftKey() {
  return localDataKey("caresits-app2-draft");
}

export function doneKey() {
  return localDataKey("caresits-app2-questionnaire");
}

// Session markers are not account data, but they can steer a later
// sign-in. Clear them without touching any account's saved data.
export function clearSessionMarkers({ preserveEntryRole = false, preserveLanguage = true } = {}) {
  try {
    for (const key of ["caresits-demo", "caresits-tour", "caresits-session"]) sessionStorage.removeItem(key);
    if (!preserveEntryRole) sessionStorage.removeItem("caresits-entry-role");
    if (!preserveLanguage) sessionStorage.removeItem("caresits-door-language");
  } catch { /* session storage is optional */ }
}
