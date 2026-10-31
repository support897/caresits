import { withTimeout } from "../accounts/account.js";
import { doneKey } from "./storage-keys.js";
import { levelOf, mergeDeepAnswers } from "./levels.js";
import { areaCoordsFor } from "./browse.js";

// The card carries its postcode AREA coordinates from the
// save (Polar C1): the map and the distance read them, and
// a postcode the area table cannot place writes none, so
// no position is ever invented.
function withAreaCoords(card, postcode) {
  const a = areaCoordsFor(postcode);
  return a ? { ...card, latE2: a.latE2, lngE2: a.lngE2 } : card;
}

// Caresitters app2 — Phase A slice 2: the journey finish, saved.
// journey.js calls window.CARESITS_SAVE(bundle) when this file
// is loaded beside it. Three writes, in the shapes the rules
// demand:
//   1. users/{uid}/meta/questionnaire — the full private answers.
//   2. profiles/{uid} — the public card, with "looking" split out
//      of the card into its own top level field, exactly as the
//      rules fence names them.
//   3. The activation pairing: when the profile does not yet
//      carry activatedAt, the same batch stamps it on
//      users/{uid} and adds one (and only one) to the people
//      counter's activatedWithin7d.
// Signed out, nothing here fires: the journey's own local copy
// stands, and the save runs at the next signed in finish.

// F14: the gallery lives outside the questionnaire (it is
// managed on My Profile), so a questionnaire save must carry
// the stored list forward untouched or the batch set below
// would wipe it. With no stored gallery the card is unchanged.
function cardWithGallery(card, gallery) {
  const kept = (Array.isArray(gallery) ? gallery : []).filter((u) => typeof u === "string" && u).slice(0, 4);
  if (!kept.length) return card;
  return { ...card, gallery: kept };
}

export function planSave(bundle, opts) {
  const { uid, displayName = "", alreadyActivated = false, nowIso, photoUrl = "", gallery = [] } = opts;
  const cardIn = bundle.card || {};
  // Normalise both bundle shapes (the family card carries its
  // musts and prefs directly; the carer's rides in "looking")
  // into the rules shape: looking at the top, neither inside.
  const { looking: lookingIn, musts, prefs, side: _s, postcode: _pc, displayName: _dn, ...card } = cardIn;
  const looking = lookingIn || { musts: musts || {}, prefs: prefs || {} };
  // The deep answers ride as their own documents (the fallback
  // construction): one per answer under profiles/{uid}/answers,
  // each carrying its bucket. The card keeps no deep at all.
  const answers = [];
  for (const bucket of ["musts", "prefs"]) {
    const deep = looking[bucket]?.deep;
    if (deep) {
      for (const [code, val] of Object.entries(deep)) {
        // A deep entry is the shaped { v, s, feed } object; a
        // raw value (a string, a list, a map) is wrapped, never
        // read for a ".v" it does not carry — an undefined field
        // here throws at the batch and takes every other
        // document of the save with it (QA b107 FAIL 1). An
        // entry whose value cannot be recovered is skipped:
        // one bad answer never loses the whole journey.
        const shaped = val && typeof val === "object" && !Array.isArray(val) && "v" in val ? val : { v: val };
        if (shaped.v === undefined) continue;
        const data = { bucket, v: shaped.v };
        if (shaped.s) data.s = shaped.s;
        else if (bucket === "musts") data.s = "must";
        if (shaped.feed) data.feed = shaped.feed;
        answers.push({ path: `profiles/${uid}/answers/${code}`, data });
      }
      delete looking[bucket].deep;
    }
  }
  // The user doc carries the member's side of record from the
  // save that proves it (QA b107 FAIL 2): the gates and the
  // plan resolution read the side there, and a save that wrote
  // it only to the card left every gate reading a blank. A
  // carer's questionnaire name is their name of record and
  // rides too; a family's name belongs to the tour and the
  // user doc already, so it is never overwritten here.
  const profileSide = bundle.side
    ? { path: `users/${uid}`, data: bundle.side === "carer" && cardIn.displayName ? { side: bundle.side, displayName: cardIn.displayName } : { side: bundle.side } }
    : null;
  const plan = {
    profileSide,
    questionnaire: {
      path: `users/${uid}/meta/questionnaire`,
      data: { side: bundle.side, answers: bundle.answers || {}, strengths: bundle.strengths || {}, savedAt: nowIso, country: bundle.country || (bundle.answers && bundle.answers.country) || "" },
    },
    card: {
      path: `profiles/${uid}`,
      data: {
        side: bundle.side,
        displayName: cardIn.displayName || displayName,
        postcode: cardIn.postcode || "",
        photoUrl: photoUrl || "",
        card: withAreaCoords(cardWithGallery(card, gallery), cardIn.postcode || ""),
        looking: looking || { musts: {}, prefs: {} },
        updatedAt: nowIso,
      },
    },
    answers,
    activation: null,
  };
  if (!alreadyActivated) {
    plan.activation = {
      profilePath: `users/${uid}`,
      profileMerge: { activatedAt: nowIso },
      counterPath: "_owner/aggregates/people/main",
      counterField: "activatedWithin7d",
    };
  }
  return plan;
}

const SDK = "../accounts/sdk";

// The frame's user, judged honestly (QA b104 ROOT A): a
// synchronous currentUser read in a frame whose session is
// still restoring answers null for a user who IS signed in,
// and a save judged on that read writes nothing while the
// Done screen claims it saved. Wait for the restore to
// settle, bounded, and judge on what then stands. (The
// mutable bound object is the battery's shrink handle;
// production never writes it.)
export const FRAME_WAIT = { ms: 10000 };
export async function frameUser(auth) {
  let user = auth ? auth.currentUser : null;
  if (!user && auth && typeof auth.authStateReady === "function") {
    try { await withTimeout(auth.authStateReady(), FRAME_WAIT.ms, "session restore"); } catch { /* judge on what stands */ }
    user = auth.currentUser;
  }
  return user || null;
}

// QA b108: the journey realm used to initialise its auth
// lazily at Finish, the worst moment — the cold restore then
// raced the save's one bounded judgement. The realm now warms
// at page entry: the app stands up and its session restore
// starts minutes before any save is asked of it.
let warmPromise = null;
export function warmSave() {
  if (!warmPromise) {
    warmPromise = (async () => {
      try {
        const { firebaseConfig } = await import("./firebase-config.js");
        const appMod = await import(`${SDK}/firebase-app.js`);
        const authMod = await import(`${SDK}/firebase-auth.js`);
        const app = appMod.getApps().find((a) => a.name === "[DEFAULT]") || appMod.initializeApp(firebaseConfig);
        const { sharedAuth } = await import("./auth-shared.js");
        const auth = sharedAuth(authMod, app);
        if (auth && typeof auth.authStateReady === "function") await auth.authStateReady();
        return auth;
      } catch { return null; }
    })();
  }
  return warmPromise;
}

// The finished bundle already persists on the device (the
// journey writes it to its done key before the save attempt).
// Undrained, a save that judged local at a cold moment is a
// grave; drained at every shell boot and every journey entry
// it is a waypoint: the account save lands at the next warm
// moment, at any pace, after any teardown (QA b108).
export async function drainOutbox(save) {
  let raw = null;
  const key = doneKey();
  if (!key) return false;
  try { raw = localStorage.getItem(key); } catch { return false; }
  if (!raw) return false;
  let bundle = null;
  try { bundle = JSON.parse(raw); } catch { return false; }
  if (!bundle || typeof bundle !== "object") return false;
  const saver = save || ((b) => import("./firebase-config.js").then(({ firebaseConfig }) => saveBundle(b, firebaseConfig)));
  try {
    const r = await saver(bundle);
    if (r && r.saved === "account") {
      try { localStorage.removeItem(key); } catch { /* storage off */ }
      return true;
    }
  } catch { /* the envelope stands for the next drain */ }
  return false;
}

export async function saveBundle(bundle, firebaseConfig) {
  const appMod = await import(`${SDK}/firebase-app.js`);
  const authMod = await import(`${SDK}/firebase-auth.js`);
  const fsMod = await import(`${SDK}/firebase-firestore.js`);
  // The DEFAULT app only, shared with the door: a named app carries its
  // own auth session and would never see the signed-in user (R1).
  const app = appMod.getApps().find((a) => a.name === "[DEFAULT]") || appMod.initializeApp(firebaseConfig);
  const { sharedAuth } = await import("./auth-shared.js");
  const auth = sharedAuth(authMod, app);
  const user = await frameUser(auth);
  if (!user || user.isAnonymous) return { saved: "local", reason: "signed-out" };
  // The restored session's user can stand before its token
  // is effective for Firestore (QA b108 naming probe: past
  // frameUser, an unguarded step refused permission-denied
  // in the young realm while the same call committed minutes
  // later). Await a live token before the first Firestore
  // step, so the save's requests carry credentials the
  // server accepts. A failed mint judges on the save's own
  // outcome; the envelope drains regardless.
  try { await withTimeout(user.getIdToken(true), 10000, "token mint"); } catch { /* the save speaks for itself */ }
  const db = fsMod.getFirestore(app);
  let profSnap = await fsMod.getDoc(fsMod.doc(db, "users", user.uid));
  if (!profSnap.exists()) {
    // The activation pairing reads this doc's PRE-state:
    // it must exist before the batch or the counter member
    // refuses and the batch dies whole (Test naming probe,
    // b108: commit permission-denied on accounts the browser
    // door flow left doc-less — the door's bounded ensure
    // can miss its birth in a young realm). The save births
    // the doc itself, in the door's own shape, ahead of the
    // batch — with the token awaited above, the birth lands.
    try {
      // A birth stamps only what a birth owns (QA b110
      // member 1): createdAt, merged — never side or name,
      // which a late writer has no business resetting. The
      // batch behind this one stamps the side itself.
      await fsMod.setDoc(fsMod.doc(db, "users", user.uid), { createdAt: fsMod.serverTimestamp() }, { merge: true });
      profSnap = await fsMod.getDoc(fsMod.doc(db, "users", user.uid));
    } catch { /* the batch speaks for itself */ }
  }
  const alreadyActivated = profSnap.exists() && "activatedAt" in profSnap.data();
  const cardSnap = await fsMod.getDoc(fsMod.doc(db, "profiles", user.uid)).catch(() => null);
  const appSnap = await fsMod.getDoc(fsMod.doc(db, "users", user.uid, "meta", "app")).catch(() => null);
  const cardData = cardSnap && cardSnap.exists() ? cardSnap.data() : {};
  const appData = appSnap && appSnap.exists() ? appSnap.data() : {};
  const keptPhoto = cardData.photoUrl || "";
  const keptGallery = (cardData.card || {}).gallery || [];
  const keptLearningPlan = cardData.learningPlan || appData.learningPlan || null;
  const plan = planSave(bundle, {
    uid: user.uid,
    displayName: profSnap.exists() ? (profSnap.data().displayName || "") : "",
    alreadyActivated,
    // a photo chosen in the questionnaire rides along, in case the profile
    // document did not exist yet when the photo was first written
    photoUrl: keptPhoto || (bundle && bundle.answers && bundle.answers.photoUrl) || "",
    gallery: keptGallery,
    nowIso: new Date().toISOString(),
  });
  if (keptLearningPlan) plan.card.data.learningPlan = keptLearningPlan;
  const batch = fsMod.writeBatch(db);
  if (plan.profileSide) {
    batch.set(fsMod.doc(db, ...plan.profileSide.path.split("/")), plan.profileSide.data, { merge: true });
  }
  batch.set(fsMod.doc(db, ...plan.questionnaire.path.split("/")), plan.questionnaire.data);
  batch.set(fsMod.doc(db, ...plan.card.path.split("/")), plan.card.data);
  for (const a of plan.answers || []) {
    batch.set(fsMod.doc(db, ...a.path.split("/")), a.data);
  }
  if (plan.activation) {
    batch.set(fsMod.doc(db, "users", user.uid), plan.activation.profileMerge, { merge: true });
    batch.set(fsMod.doc(db, ...plan.activation.counterPath.split("/")),
      { [plan.activation.counterField]: fsMod.increment(1) }, { merge: true });
  }
  await batch.commit();
  publishSavedProfile(bundle, plan, user.uid);
  return { saved: "account", activated: Boolean(plan.activation) };
}

// F15, the save side of the seam: a finished questionnaire
// changes who My Profile shows (a carer who just finished must
// see her resume card without a reload). The save runs inside
// the questionnaire frame; the app shell is its parent window.
// Both windows get the uid seam (F16) and a refreshed trust
// seam carrying the facts the save just wrote, and the shell
// re-renders its trust surfaces through the render seam
// trust.js exposes. Empty facts never overwrite standing ones.
export function publishSavedProfile(bundle, plan, uid) {
  // The member's full saved state, judged the boot's way
  // (QA night N1): the plan's per-code documents merge back
  // into the field map, so the level and the progress seam
  // this publication stands up agree with a fresh boot's.
  const byPair = {};
  for (const a of plan.answers || []) {
    const code = String(a.path || "").split("/").pop();
    if (code) byPair[code] = a.data || {};
  }
  const mergedAnswers = mergeDeepAnswers(bundle.answers || {}, byPair, bundle.side || "");
  const savedLevel = Object.keys(mergedAnswers).length ? levelOf(bundle.side || "", mergedAnswers) : "";
  const fresh = {
    name: plan.card.data.displayName || "",
    side: bundle.side || plan.card.data.side || "",
    postcode: plan.card.data.postcode || "",
    photoUrl: plan.card.data.photoUrl || "",
    country: bundle.country || "",
    ...(savedLevel ? { level: savedLevel } : {}),
  };
  // F14: the gallery the save just carried forward rides too,
  // so the seam and the stored card agree after a save.
  const savedGallery = (plan.card.data.card || {}).gallery;
  const hosts = [];
  try { if (typeof window !== "undefined") hosts.push(window); } catch { /* no window */ }
  try {
    if (typeof window !== "undefined" && window.parent && window.parent !== window) hosts.push(window.parent);
  } catch { /* top level or cross origin */ }
  for (const h of hosts) {
    try {
      h.CARESITS_UID = uid;
      const prev = h.CARESITS_TRUST || {};
      const prevMe = prev.me || {};
      const me = { ...prevMe };
      for (const [k, v] of Object.entries(fresh)) if (v) me[k] = v;
      if (Array.isArray(savedGallery)) me.gallery = savedGallery;
      h.CARESITS_TRUST = { docs: prev.docs || [], reviews: prev.reviews || [], me };
      if (h.CARESITS_ME) {
        h.CARESITS_ME = { ...h.CARESITS_ME, side: me.side || h.CARESITS_ME.side || "", name: me.name || h.CARESITS_ME.name || "", ...(Array.isArray(savedGallery) ? { gallery: savedGallery } : {}) };
      }
      // The gates read the completeness flag the boot set
      // before this save existed (QA b107 Legs 9+10, the
      // same-session half): a finisher posting in the session
      // they finished in was refused on the stale flag. The
      // save that just landed IS the finished profile.
      if (bundle.answers && Object.keys(bundle.answers).length) h.CARESITS_PROFILE_COMPLETE = true;
      h.CARESITS_QUESTIONS = { answered: Object.keys(mergedAnswers).length, level: savedLevel || "explore", side: bundle.side || "" };
      if (typeof h.CARESITS_TRUST_RENDER === "function") h.CARESITS_TRUST_RENDER();
      // Find's pool was published at boot, before this save
      // existed (Test b112 Leg C): a member who finishes the
      // journey in their first session met a Find still
      // holding the boot's empty read. The save that just
      // landed republishes the pool on the shell host.
      if (typeof h.CARESITS_FIND_REFRESH === "function") h.CARESITS_FIND_REFRESH();
    } catch { /* a seam refresh never breaks a save */ }
  }
}

if (typeof window !== "undefined") {
  window.CARESITS_SAVE_PLAN = planSave;
  window.CARESITS_SAVE = (bundle) =>
    import("./firebase-config.js").then(({ firebaseConfig }) => saveBundle(bundle, firebaseConfig))
      .catch(() => ({ saved: "local", reason: "offline" }));
}
