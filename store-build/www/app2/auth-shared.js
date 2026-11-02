// ONE way to make the Auth object, for every page and every module.
// Build 140 failed to remember the login on iPhone because (a) three
// modules still called plain getAuth (IndexedDB first, which can lose
// the saved session in the iPhone webview), and whichever module ran
// first fixed the storage choice for the whole page, and (b) the shell
// judged "signed out" before the saved session had finished loading.
// Now: every caller goes through sharedAuth(); the storage order is the
// same on every platform (localStorage first, IndexedDB second); the
// saved session is also mirrored to a second store and put back if the
// first one was wiped; and the shell waits (waitForSession) before it
// sends anyone to the door.
const AUTH_KEY_RE = /^firebase:authUser:/;
const MIRROR_DB = "caresits-session-mirror";

export function isNative() {
  try { const c = window.Capacitor; return !!(c && typeof c.isNativePlatform === "function" && c.isNativePlatform()); }
  catch { return false; }
}

function idb() {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(MIRROR_DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore("kv");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function idbPut(key, value) {
  const db = await idb(); if (!db) return;
  await new Promise((r) => { try { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, key); tx.oncomplete = r; tx.onerror = r; tx.onabort = r; } catch { r(); } });
  db.close();
}
async function idbAll() {
  const db = await idb(); if (!db) return {};
  const out = {};
  await new Promise((r) => {
    try {
      const store = db.transaction("kv").objectStore("kv");
      const req = store.openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out[c.key] = c.value; c.continue(); } else r(); };
      req.onerror = r;
    } catch { r(); }
  });
  db.close();
  return out;
}
function localKeys() {
  const keys = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (AUTH_KEY_RE.test(k)) keys.push(k); } } catch { /* storage off */ }
  return keys;
}
export function hasSavedSession() { return localKeys().length > 0; }

// Put a mirrored session back into localStorage when localStorage lost it.
export async function restoreSessionMirror() {
  try {
    if (hasSavedSession()) return false;
    const saved = await idbAll();
    let put = false;
    for (const [k, v] of Object.entries(saved)) {
      if (AUTH_KEY_RE.test(k) && typeof v === "string" && v) { localStorage.setItem(k, v); put = true; }
    }
    return put;
  } catch { return false; }
}
// Copy the session to the second store whenever it changes.
function startMirror() {
  if (startMirror.on) return; startMirror.on = true;
  const copy = () => { for (const k of localKeys()) { try { idbPut(k, localStorage.getItem(k)); } catch { /* skip */ } } };
  copy();
  window.addEventListener("pagehide", copy);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") copy(); });
  setInterval(copy, 15000);
}

export function sharedAuth(authMod, app) {
  let auth = null;
  if (typeof authMod.initializeAuth === "function" && authMod.browserLocalPersistence) {
    const persistence = [authMod.browserLocalPersistence];
    if (authMod.indexedDBLocalPersistence) persistence.push(authMod.indexedDBLocalPersistence);
    try { auth = authMod.initializeAuth(app, { persistence }); }
    catch { /* already made on this page: use that one */ }
  }
  if (!auth) auth = authMod.getAuth(app);
  try { startMirror(); } catch { /* the mirror is a bonus */ }
  return auth;
}

// Wait for the saved session to finish loading, bounded, before anyone
// is called "signed out". A saved session on disk gets a longer wait
// and one more look, so a slow webview never bounces a member.
export async function waitForSession(auth, { fast = 3000, slow = 9000 } = {}) {
  const ms = hasSavedSession() ? slow : fast;
  try { if (auth && typeof auth.authStateReady === "function") await Promise.race([auth.authStateReady(), new Promise((r) => setTimeout(r, ms))]); } catch { /* judge on what stands */ }
  if (auth && !auth.currentUser && hasSavedSession()) await new Promise((r) => setTimeout(r, 1500));
  return auth ? auth.currentUser : null;
}
