// Caresitters accounts — the account layer.
// Identity: Firebase Authentication, three doors (Google, Apple,
// email plus password — HQ order 15 Oct 2026). Every record is
// keyed to the Firebase uid under users/{uid}.
// DORMANT while firebase-config.js is empty: connects to nothing,
// changes nothing, and the certified app runs as it does today.

// ---------- Pure plan logic (unit tested in accounts/tests.mjs) ----------

export const PLANS = {
  FREE: "free",
  FINDING: "finding",
  FAMILY_PLUS: "familyplus",
  CARER: "carer",
};

// Finding has NO free month (her word, 15 Oct 2026). There is no
// trial state for Finding anywhere in this layer, on purpose.
export function isPassOpen(pass, now) {
  if (!pass || !pass.endsAt) return false;
  return now < pass.endsAt;
}

// comp: null or { plan: "finding", forever: true } from _comp/{uid}
// payment: null or { plan, status, currentPeriodEnd, pass: {endsAt} }
export function resolvePlan({ side, comp, payment, now }) {
  if (side === "carer") {
    return { tier: PLANS.CARER, doorOpen: true, source: "carers free forever" };
  }
  if (comp && comp.plan === PLANS.FINDING && comp.forever) {
    return { tier: PLANS.FINDING, doorOpen: true, source: "comp" };
  }
  if (payment && payment.status === "active") {
    if (payment.plan === PLANS.FINDING || payment.plan === PLANS.FAMILY_PLUS) {
      return { tier: payment.plan, doorOpen: true, source: "subscription" };
    }
  }
  if (payment && isPassOpen(payment.pass, now)) {
    return { tier: PLANS.FINDING, doorOpen: true, source: "search pass" };
  }
  return { tier: PLANS.FREE, doorOpen: false, source: "free taste" };
}

// The free taste: families browse and view free, and send ONE
// message per day (her word, standing since 14 Oct 2026). A paid
// door or a carer side sends without the taste limit.
export function canSendMessage({ plan, tasteUsedToday }) {
  if (!plan) return false;
  if (plan.tier === PLANS.CARER) return true;
  if (plan.doorOpen) return true;
  return (tasteUsedToday || 0) < 1;
}

export function tasteDayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

// ---------- The entitlement record (payments chapter, Finance §3) ----------
// One record per user, at _entitlements/{uid}, written ONLY by the
// payment path (the RevenueCat and Stripe webhook receivers). The
// client reads its own record and can never write it: the rules deny
// every client write to that path. Free features never read the
// record at all, and carers never touch it: no products, no
// entitlement, no paywall for carers, ever.
//
// Record fields (Finance §3, verbatim): app_user_id, entitlement,
// status (trialing, active, past_due, cancelled, expired), product,
// lane, trial_ends_at, period_ends_at, expires_at, updated_at,
// source_event_id. The entitlement words are the chapter §2 IDs;
// family_plus is the record's word for PLANS.FAMILY_PLUS here.
const ENTITLEMENT_TIERS = { finding: PLANS.FINDING, family_plus: PLANS.FAMILY_PLUS };

// Record times may arrive as Firestore timestamps, millis, or ISO
// strings; the adapter reads all three and trusts none blindly.
function tsToMs(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") { const t = Date.parse(v); return Number.isNaN(t) ? null : t; }
  if (typeof v.toMillis === "function") { try { return v.toMillis(); } catch { return null; } }
  if (typeof v.seconds === "number") return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  return null;
}

// Maps one record onto the payment shape resolvePlan understands, or
// null when the record opens nothing. The unlock rule is Finance §3:
// status trialing or active with the period still running opens the
// door; a cancelled plan stays open until its period ends and shuts
// after; past_due, expired, and no record stay shut. A Search Pass
// opens the Finding door only inside its own window (chapter §4):
// the window lives in expires_at, never in the store product.
export function entitlementFromRecord(rec, now) {
  if (!rec || typeof rec !== "object") return null;
  if (rec.entitlement === "search_pass") {
    const ends = tsToMs(rec.expires_at);
    if (rec.status === "active" && ends != null && now < ends) return { pass: { endsAt: ends } };
    return null;
  }
  const tier = ENTITLEMENT_TIERS[rec.entitlement];
  if (!tier) return null;
  const periodEnd = tsToMs(rec.period_ends_at) ?? tsToMs(rec.trial_ends_at);
  // A trialing status opens Family Plus only. Finding has NO trial
  // ever (her word, 15 Oct 2026): a trialing Finding record opens
  // nothing, whatever wrote it.
  if (rec.status === "trialing" && tier !== PLANS.FAMILY_PLUS) return null;
  if (rec.status === "active" || rec.status === "trialing") {
    if (periodEnd != null && now >= periodEnd) return null;
    return { plan: tier, status: "active", currentPeriodEnd: periodEnd };
  }
  if (rec.status === "cancelled") {
    if (periodEnd != null && now < periodEnd) return { plan: tier, status: "active", currentPeriodEnd: periodEnd };
    return null;
  }
  return null;
}

// ---------- The in-app free month (chapter §9, SR flag adopted) ----------
// Family Plus carries one free month, and the mechanism is IN-APP:
// account age, no payment method, no store intro offer anywhere. It
// is derived here from the server issued account creation time,
// never a local flag and never cached, and it ends into the free
// taste on its own. FEATURE-SPLIT's Free Month column is the scope:
// the month opens the Family Plus extras (Day Story, roster,
// timesheets, day summaries) and NOT the Finding door, so messaging
// stays on the free taste all month. Finding has no free month of
// any kind, and nothing in this section can open its door.
export const PLUS_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function plusExtrasOpen({ plan, side, createdAtMs, now }) {
  if (side === "carer") return true;
  if (plan && plan.tier === PLANS.FAMILY_PLUS) return true;
  if (createdAtMs != null && now >= createdAtMs && now - createdAtMs < PLUS_MONTH_MS) return true;
  return false;
}

// ---------- Browser shell (dormant until the config lands) ----------

const SDK = "./sdk";
let _auth = null;
let _db = null;
let _user = null;

export function currentUser() {
  return _user;
}

// ---------- Bounded waits (fleet census cure, 19 Oct 2026) ----------
// No promise on the door or boot path may hang forever: a
// native bridge that never settles, a wedged first read —
// each gets a bound and an honest failure, never a silent
// spin. The rejection carries the auth/timeout code so the
// door's own no-net line can speak for a stall.
// DRIFT WATCH (Efficiency's condition on the cure wave's
// PASS): app2/door.js carries a local twin of this helper
// (the door loads accounts dynamically by design). Any
// change to the bounds or the helper's shape lands in
// BOTH copies in the same change, never one alone.
export function withTimeout(promise, ms, label) {
  let timer;
  const bound = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`${label || "operation"} timed out`);
      e.code = "auth/timeout";
      reject(e);
    }, ms);
  });
  return Promise.race([promise, bound]).finally(() => clearTimeout(timer));
}
export const DOOR_TIMEOUTS = { native: 20000, ensure: 10000 };

// The JS Auth's persistence decides whether sign in results
// and the auth state listener ever settle inside the packaged
// webview (the door bisect of record, 21 Oct 2026: her Google
// sign in completed at Firebase, lastLogin stamped at the
// film's minute, and the app never walked her in and never
// spoke). Plain getAuth names no persistence, so the default
// chain settles through IndexedDB, the layer that can stall
// inside WKWebView under the packaged app's scheme
// (firebase-js-sdk #5552). On native the Auth is created the
// way the fleet's device completing modular control (Ruefly)
// creates it, like for like: initializeAuth naming
// browserLocalPersistence, the reliable settler in that
// webview. The web keeps getAuth.
export function authInitShape(native) { return native ? "browserLocal" : "default"; }
function isNativePlatform() {
  try { const cap = window.Capacitor; return !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()); }
  catch { return false; }
}
function initAuthForPlatform(authMod, app, native) {
  if (authInitShape(native) === "browserLocal" && typeof authMod.initializeAuth === "function") {
    try {
      const auth = authMod.initializeAuth(app, { persistence: authMod.browserLocalPersistence });
      console.info("[door] auth init: native named persistence (browserLocal)");
      return auth;
    } catch { /* an instance already stands: fall through */ }
  }
  console.info("[door] auth init: web default");
  return authMod.getAuth(app);
}

export async function initAccounts(config, onUser) {
  if (!config || !config.apiKey || !config.projectId || !config.appId) {
    return { on: false };
  }
  const { initializeApp } = await import(`${SDK}/firebase-app.js`);
  const authMod = await import(`${SDK}/firebase-auth.js`);
  const fsMod = await import(`${SDK}/firebase-firestore.js`);
  const app = initializeApp(config);
  _auth = initAuthForPlatform(authMod, app, isNativePlatform());
  _db = fsMod.getFirestore(app);
  authMod.onAuthStateChanged(_auth, async (u) => {
    _user = u;
    if (u && !u.isAnonymous) {
      // The walk-in never waits on Firestore (fleet census
      // cure): the profile ensure is bounded, and a failed
      // or timed-out ensure re-fires once behind the door;
      // the next page's initAccounts tries again by itself.
      try { await withTimeout(ensureProfile(fsMod, u), DOOR_TIMEOUTS.ensure, "profile ensure"); }
      catch { ensureProfile(fsMod, u).catch(() => {}); }
    }
    if (onUser) onUser(u);
  });
  return { on: true };
}

// The profile doc is created EMPTY at first sign in (Empty Start
// law): no plan keys, no answers, nothing prefilled. The signup IS
// this create, so the CEO people counter rides in the SAME batch
// (the programme writer's exact shape: no aggregate read, increment
// writes with merge). If the batch fails, the profile create
// retries alone, so a counter can never break a sign in.
async function ensureProfile(fsMod, u) {
  const { doc, getDoc, setDoc, runTransaction, increment } = fsMod;
  const ref = doc(_db, "users", u.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  // The name asked at sign up (her 16:28 ruling) rides the profile
  // from birth, so the app can greet the user by their own name.
  const profile = { createdAt: new Date().toISOString(), side: "", displayName: u.displayName || _pendingName || "" };
  try {
    // The birth and its counters commit in a TRANSACTION
    // (QA b110 member 1): this writer can land AFTER the
    // journey's save has stamped the doc, and a plain late
    // set replaced the whole doc (side and activatedAt
    // wiped) and counted the signup twice. Inside a
    // transaction the read and the write are one judgement:
    // a doc born meanwhile stands the birth down, counters
    // included.
    await runTransaction(_db, async (tx) => {
      const cur = await tx.get(ref);
      if (cur.exists()) return;
      tx.set(ref, profile);
      tx.set(
        doc(_db, "_owner", "aggregates", "peopleTotal", "main"),
        { total: increment(1) },
        { merge: true }
      );
      tx.set(
        doc(_db, "_owner", "aggregates", "peopleWeekly", isoWeekKey(new Date())),
        { count: increment(1) },
        { merge: true }
      );
    });
  } catch (e) {
    // The profile create retries alone, so a counter can
    // never break a sign in; it merges, so even this late
    // write preserves stamps the save already landed.
    await setDoc(ref, profile, { merge: true });
  }
}

export function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------- The three doors ----------

// Native shell: inside the packaged app the social doors run
// through the Capacitor Firebase Authentication plugin (the
// native Google and Apple sheets), and the plugin's credential
// is handed to this same JS SDK session with
// signInWithCredential, so the profile machinery above never
// learns which road was taken. cap sync registers the plugin
// on the native side; the web layer reaches it through the
// bridge at window.Capacitor.Plugins.FirebaseAuthentication.
// The plugin's own JS entry does registerPlugin under that
// same name, but importing it would need a bundler and this
// app has none, so the guarded bridge access is the road.
// On the web there is no native bridge and the popup stands.
function nativeAuthPlugin() {
  if (typeof window === "undefined") return null;
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== "function" || !cap.isNativePlatform()) return null;
  const plugin = cap.Plugins && cap.Plugins.FirebaseAuthentication;
  if (!plugin || typeof plugin.signInWithGoogle !== "function" || typeof plugin.signInWithApple !== "function") return null;
  return plugin;
}

export async function signInGoogle() {
  const m = await import(`${SDK}/firebase-auth.js`);
  const plugin = nativeAuthPlugin();
  if (plugin) {
    const result = await withTimeout(plugin.signInWithGoogle(), DOOR_TIMEOUTS.native, "native sign in");
    const credential = result && result.credential;
    if (!credential || !credential.idToken) throw new Error("native sign in returned no credential");
    return withTimeout(m.signInWithCredential(_auth, m.GoogleAuthProvider.credential(credential.idToken)), DOOR_TIMEOUTS.native, "credential exchange");
  }
  // On native, a missing plugin fails LOUD, never falls
  // through to the web popup (the fleet door chapter,
  // 21 Oct 2026): the popup's return cannot complete inside
  // the webview, and its silence is indistinguishable from
  // a door that never spoke. The popup stands only where it
  // belongs: the open web.
  if (isNativePlatform()) throw new Error("native sign in unavailable in this build");
  return m.signInWithPopup(_auth, new m.GoogleAuthProvider());
}

export async function signInApple() {
  const m = await import(`${SDK}/firebase-auth.js`);
  const provider = new m.OAuthProvider("apple.com");
  const plugin = nativeAuthPlugin();
  if (plugin) {
    const result = await withTimeout(plugin.signInWithApple(), DOOR_TIMEOUTS.native, "native sign in");
    const credential = result && result.credential;
    if (!credential || !credential.idToken) throw new Error("native sign in returned no credential");
    // The plugin's nonce is the raw nonce Apple signed into
    // the id token: it rides verbatim as rawNonce below,
    // never hashed a second time (the plugin presented the
    // hashed nonce to Apple when it opened the sheet).
    return withTimeout(m.signInWithCredential(_auth, provider.credential({ idToken: credential.idToken, rawNonce: credential.nonce })), DOOR_TIMEOUTS.native, "credential exchange");
  }
  if (isNativePlatform()) throw new Error("native sign in unavailable in this build");
  return m.signInWithPopup(_auth, provider);
}

let _pendingName = "";
export async function signInEmail(email, password, name) {
  const m = await import(`${SDK}/firebase-auth.js`);
  try {
    return await m.signInWithEmailAndPassword(_auth, email, password);
  } catch (e) {
    if (e && (e.code === "auth/user-not-found" || e.code === "auth/invalid-credential")) {
      // A refused sign in may be a first visit in disguise: try the
      // create once, and let its own error speak if it is not.
      try {
        _pendingName = name || "";
        const cred = await m.createUserWithEmailAndPassword(_auth, email, password);
        if (name) { try { await m.updateProfile(cred.user, { displayName: name }); } catch { /* name rides the profile doc */ } }
        // A creation at sign in is never silent (HQ ruling on the
        // remainder round's Leg 19): the credential carries the
        // mark, so every door announces the creation out loud.
        cred.createdAccount = true;
        return cred;
      } catch {
        throw e;
      }
    }
    throw e;
  }
}

export async function signOutUser() {
  // Push hygiene (Security fence 2): a signed out device must
  // never receive the previous account's pushes. This device's
  // push doc is stamped inactive BEFORE the session ends,
  // while the write is still allowed. Fail soft throughout:
  // hygiene never blocks a sign out.
  await deactivateOwnDevice();
  const m = await import(`${SDK}/firebase-auth.js`);
  return m.signOut(_auth);
}

// The device id key is owned by app2/push.js
// (DEVICE_STORAGE_KEY); the account layer reads the same key
// because sign out lives here, on the account page, where the
// app bridge does not run.
const DEVICE_ID_KEY = "caresits-app2-device";
async function deactivateOwnDevice() {
  try {
    if (typeof window !== "undefined" && typeof window.CARESITS_PUSH_DEACTIVATE === "function") {
      await window.CARESITS_PUSH_DEACTIVATE();
      return;
    }
    if (!_user || !_db) return;
    let deviceId = null;
    try {
      const raw = localStorage.getItem(DEVICE_ID_KEY);
      if (raw) deviceId = JSON.parse(raw).deviceId || null;
    } catch { /* storage may be closed */ }
    if (!deviceId) return;
    const fsMod = await import(`${SDK}/firebase-firestore.js`);
    await fsMod.updateDoc(
      fsMod.doc(_db, "profiles", _user.uid, "devices", deviceId),
      { active: false, updatedAt: new Date().toISOString() }
    );
  } catch { /* a missing doc or a closed network changes nothing */ }
}

// Account deletion is the user's own act (Never Delete law): the
// app never deletes for them. This removes the user's folder and
// then the account itself; it needs a fresh sign in, which the
// page asks for. A hire shared with another user keeps only the
// other side's own copy, per the isolation model.
export async function deleteMyAccount() {
  if (!_user) throw new Error("not signed in");
  const fsMod = await import(`${SDK}/firebase-firestore.js`);
  const { doc, collection, getDocs, writeBatch } = fsMod;
  // Storage objects (HQ deletion ruling, 19 Oct 2026): the
  // profile photo, the four gallery slots and any temporary
  // resume file are the user's personal files in the bucket,
  // and the account deletion removes them too, here, while
  // the session is live. Each delete is fail soft: a missing
  // object must never block the account deletion itself.
  // The resume carries no stored object at all (device only
  // extraction, 19 Oct 2026), so the walk is the photo set.
  try {
    const appMod = await import(`${SDK}/firebase-app.js`);
    const stMod = await import(`${SDK}/firebase-storage.js`);
    let app = null;
    try { app = appMod.getApp(); } catch { app = (appMod.getApps() || [])[0] || null; }
    if (app) {
      const storage = stMod.getStorage(app);
      const uid = _user.uid;
      const paths = [
        `profile-photos/${uid}/photo.jpg`,
        ...[1, 2, 3, 4].map((s) => `profile-photos/${uid}/extra-${s}.jpg`),
      ];
      for (const p of paths) {
        try { await stMod.deleteObject(stMod.ref(storage, p)); } catch { /* not there: nothing to orphan */ }
      }
    }
  } catch { /* storage may be closed; the deletion proceeds */ }
  const subs = ["children", "dayStory", "roster", "timesheets", "documents", "messages", "jobs"];
  const batch = writeBatch(_db);
  for (const sub of subs) {
    const snap = await getDocs(collection(_db, "users", _user.uid, sub));
    snap.forEach((d) => batch.delete(d.ref));
  }
  // Device docs live under the card, not the user folder
  // (Security fence 1), so the walk names them on their own
  // (fence 2: enumerate, do not assume). A device token is a
  // rotating credential, not user data, so it dies here as
  // hygiene under the Never Delete distinction.
  const devSnap = await getDocs(collection(_db, "profiles", _user.uid, "devices"));
  devSnap.forEach((d) => batch.delete(d.ref));
  // Connect link invites live at the top level, keyed by the
  // family who made them (Security's zero orphans fence): the
  // walk enumerates the caller's own invites by familyUid and
  // removes them, so no live code outlives its maker's account.
  const { query, where } = fsMod;
  const invSnap = await getDocs(query(collection(_db, "invites"), where("familyUid", "==", _user.uid)));
  invSnap.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(_db, "users", _user.uid, "meta", "app"));
  // The lifecycle stamp dies with the account (its rules arm
  // allows the owner delete for exactly this walk).
  batch.delete(doc(_db, "_activity", _user.uid));
  batch.delete(doc(_db, "users", _user.uid));
  await batch.commit();
  const m = await import(`${SDK}/firebase-auth.js`);
  await m.deleteUser(_user);
}
