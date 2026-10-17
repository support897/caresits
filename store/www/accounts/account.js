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

// ---------- Browser shell (dormant until the config lands) ----------

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
let _auth = null;
let _db = null;
let _user = null;

export function currentUser() {
  return _user;
}

export async function initAccounts(config, onUser) {
  if (!config || !config.apiKey || !config.projectId || !config.appId) {
    return { on: false };
  }
  const { initializeApp } = await import(`${SDK}/firebase-app.js`);
  const authMod = await import(`${SDK}/firebase-auth.js`);
  const fsMod = await import(`${SDK}/firebase-firestore.js`);
  const app = initializeApp(config);
  _auth = authMod.getAuth(app);
  _db = fsMod.getFirestore(app);
  authMod.onAuthStateChanged(_auth, async (u) => {
    _user = u;
    if (u && !u.isAnonymous) {
      await ensureProfile(fsMod, u);
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
  const { doc, getDoc, setDoc, writeBatch, increment } = fsMod;
  const ref = doc(_db, "users", u.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  // The name asked at sign up (her 16:28 ruling) rides the profile
  // from birth, so the app can greet the user by their own name.
  const profile = { createdAt: new Date().toISOString(), side: "", displayName: u.displayName || _pendingName || "" };
  try {
    const batch = writeBatch(_db);
    batch.set(ref, profile);
    batch.set(
      doc(_db, "_owner", "aggregates", "people", "main"),
      { total: increment(1), weekly: { [isoWeekKey(new Date())]: increment(1) } },
      { merge: true }
    );
    await batch.commit();
  } catch (e) {
    await setDoc(ref, profile);
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

export async function signInGoogle() {
  const m = await import(`${SDK}/firebase-auth.js`);
  return m.signInWithPopup(_auth, new m.GoogleAuthProvider());
}

export async function signInApple() {
  const m = await import(`${SDK}/firebase-auth.js`);
  const provider = new m.OAuthProvider("apple.com");
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
  batch.delete(doc(_db, "users", _user.uid, "meta", "app"));
  batch.delete(doc(_db, "users", _user.uid));
  await batch.commit();
  const m = await import(`${SDK}/firebase-auth.js`);
  await m.deleteUser(_user);
}
