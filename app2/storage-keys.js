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

function authState() {
  // The journey runs inside the app shell's frame; the live
  // bridge publishes the auth state on the shell window, the
  // same seam currentUid reads for the uid. Without this, the
  // framed journey never saw "signed-out" and an explorer's
  // draft and finished bundle silently never saved.
  try { if (typeof window !== "undefined" && window.CARESITS_AUTH_STATE) return window.CARESITS_AUTH_STATE; } catch { /* no window */ }
  try {
    if (typeof window !== "undefined" && window.parent && window.parent !== window) return window.parent.CARESITS_AUTH_STATE || null;
  } catch { /* top level or cross origin */ }
  return null;
}

function localDataKey(base) {
  const uid = currentUid();
  if (uid) return `${base}-${uid}`;
  // Keep pure Node tests and non-browser callers compatible; a
  // browser never falls back to an unowned, shared key. Signed
  // out is signed out (fleet rule, Ilse 29 Oct 2026): there
  // is no demo slot and no shared key, ever.
  if (typeof window === "undefined") return base;
  return null;
}

export function draftKey() {
  return localDataKey("caresits-app2-draft");
}

export function doneKey() {
  return localDataKey("caresits-app2-questionnaire");
}

// The device copy of the member's Finding / Connected view
// pick (the whole view mode, Ilse's ruling of 28 Oct 2026),
// beside the account copy on the meta/app doc: the account
// copy is the truth, the device copy lets the shell stand in
// the right view as soon as this account is known on this
// device. Keyed like every other account key here, through
// the one resolver: the signed in member's own slot, and no
// key at all while the uid is unknown.
export function modeKey() {
  return localDataKey("caresits-app2-mode");
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
