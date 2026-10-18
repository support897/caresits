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
        const data = { bucket, v: val.v };
        if (val.s) data.s = val.s;
        if (val.feed) data.feed = val.feed;
        answers.push({ path: `profiles/${uid}/answers/${code}`, data });
      }
      delete looking[bucket].deep;
    }
  }
  const plan = {
    questionnaire: {
      path: `users/${uid}/meta/questionnaire`,
      data: { side: bundle.side, answers: bundle.answers || {}, strengths: bundle.strengths || {}, savedAt: nowIso, country: bundle.country || (bundle.answers && bundle.answers.country) || "" },
    },
    card: {
      path: `profiles/${uid}`,
      data: {
        side: bundle.side,
        displayName: bundle.side === "carer" ? (cardIn.displayName || displayName) : displayName,
        postcode: cardIn.postcode || "",
        photoUrl: photoUrl || "",
        card: cardWithGallery(card, gallery),
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

export async function saveBundle(bundle, firebaseConfig) {
  const { initializeApp } = await import(`${SDK}/firebase-app.js`);
  const authMod = await import(`${SDK}/firebase-auth.js`);
  const fsMod = await import(`${SDK}/firebase-firestore.js`);
  const app = initializeApp(firebaseConfig, "app2-save");
  const auth = authMod.getAuth(app);
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return { saved: "local", reason: "signed-out" };
  const db = fsMod.getFirestore(app);
  const profSnap = await fsMod.getDoc(fsMod.doc(db, "users", user.uid));
  const alreadyActivated = profSnap.exists() && "activatedAt" in profSnap.data();
  const cardSnap = await fsMod.getDoc(fsMod.doc(db, "profiles", user.uid)).catch(() => null);
  const keptPhoto = cardSnap && cardSnap.exists() ? (cardSnap.data().photoUrl || "") : "";
  const keptGallery = cardSnap && cardSnap.exists() ? ((cardSnap.data().card || {}).gallery || []) : [];
  const plan = planSave(bundle, {
    uid: user.uid,
    displayName: profSnap.exists() ? (profSnap.data().displayName || "") : "",
    alreadyActivated,
    photoUrl: keptPhoto,
    gallery: keptGallery,
    nowIso: new Date().toISOString(),
  });
  const batch = fsMod.writeBatch(db);
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
function publishSavedProfile(bundle, plan, uid) {
  const fresh = {
    name: plan.card.data.displayName || "",
    side: bundle.side || plan.card.data.side || "",
    postcode: plan.card.data.postcode || "",
    photoUrl: plan.card.data.photoUrl || "",
    country: bundle.country || "",
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
      if (typeof h.CARESITS_TRUST_RENDER === "function") h.CARESITS_TRUST_RENDER();
    } catch { /* a seam refresh never breaks a save */ }
  }
}

if (typeof window !== "undefined") {
  window.CARESITS_SAVE_PLAN = planSave;
  window.CARESITS_SAVE = (bundle) =>
    import("./firebase-config.js").then(({ firebaseConfig }) => saveBundle(bundle, firebaseConfig))
      .catch(() => ({ saved: "local", reason: "offline" }));
}
