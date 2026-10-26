// Caresitters app2 — the device local questionnaire keys.
// ONE helper resolves them, so every reader and writer agrees.
// The draft and the finished bundle are device local by design,
// but they hold one person's answers: when a signed in uid is
// known, the keys carry that uid, so on a shared device the
// next account's journey never opens the previous account's
// draft. Signed out and demo keep the plain keys. Keying is the
// whole fix: nothing is deleted on sign out (Never Delete), and
// a plain draft is never adopted into an account's slot,
// because the device cannot prove whose it is.

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

export function draftKey() {
  const uid = currentUid();
  return uid ? "caresits-app2-draft-" + uid : "caresits-app2-draft";
}

export function doneKey() {
  const uid = currentUid();
  return uid ? "caresits-app2-questionnaire-" + uid : "caresits-app2-questionnaire";
}
