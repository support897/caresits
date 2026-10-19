// Caresitters app2 — the live bridge.
// Maps every CARESITS_WRITE kind the surfaces emit onto the
// Firestore shapes the sealed rules accept, and fills the
// CARESITS_* data hooks from the signed in member's own
// world. Routing is a pure function so it can be desk proven
// without a network. The twin is used only when the address
// carries ?twin=1; every other visit uses the production
// config beside this file.
import { levelOf } from "./levels.js";

export function routeWrite(kind, payload, uid) {
  if (!uid) return { ok: false, reason: "signed-out" };
  switch (kind) {
    case "contact": return { ok: true, op: "set", path: payload.path, data: payload.data };
    case "transition": return { ok: true, op: "update", path: "relationships/" + payload.pairId, data: payload.patch };
    case "job": return { ok: true, op: "add", path: "jobs", data: payload.data };
    case "interest": return { ok: true, op: "set", path: payload.path, data: payload.data };
    case "report": return { ok: true, op: "reportPair", path: "safetyReports", data: payload.data, counter: payload.counter };
    case "block": return { ok: true, op: "set", path: payload.path, data: payload.data };
    case "child-add": return { ok: true, op: "add", path: `users/${uid}/children`, data: { name: payload.name, theme: payload.theme, ...(payload.ageYears != null ? { ageYears: payload.ageYears } : {}), ...(Array.isArray(payload.loves) && payload.loves.length ? { loves: payload.loves } : {}) } };
    case "invite-create": return { ok: true, op: "set", path: payload.path, data: payload.data };
    case "invite-accept": return { ok: true, op: "inviteAccept", relPath: payload.relPath, relData: payload.relData, invitePath: payload.invitePath, stamp: payload.stamp };
    case "shopping": return { ok: true, op: "set", path: payload.path, data: payload.data };
    case "child-remove": return { ok: true, op: "delete", path: `users/${uid}/children/${payload.id}` };
    case "bin-move": return { ok: true, op: "set", path: payload.path, data: payload.data };
    case "bin-delete": return { ok: true, op: "delete", path: payload.path };
    case "bin-restore": return { ok: true, op: "binRestore", binPath: payload.binPath, originPath: payload.originPath, originId: payload.originId || null, data: payload.data };
    case "dayStory-remove": return { ok: true, op: "delete", path: `users/${uid}/dayStory/${payload.id}` };
    case "photo": return { ok: true, op: "merge", path: `profiles/${uid}`, data: { photoUrl: payload.photoUrl } };
    case "gallery": return { ok: true, op: "merge", path: `profiles/${uid}`, data: { card: { gallery: (Array.isArray(payload.gallery) ? payload.gallery : []).filter((u) => typeof u === "string" && u).slice(0, 4) } } };
    case "dayStory": return { ok: true, op: "add", path: `users/${uid}/dayStory`, data: { day: payload.day, tile: payload.tile, note: payload.note, at: payload.at } };
    case "photo-request": return { ok: true, op: "add", path: `users/${uid}/dayStory`, data: { day: payload.day, tile: "Photo moment", note: "A photo of the kids was asked for", at: payload.at } };
    case "timesheet": return { ok: true, op: "add", path: `users/${uid}/timesheets`, data: { day: payload.day, hours: payload.hours } };
    case "reminder": return { ok: true, op: "merge", path: `users/${uid}/meta/reminders`, data: { text: payload.text, when: payload.when } };
    case "emergency": return { ok: true, op: "merge", path: `users/${uid}/meta/emergency`, data: { name: payload.name, phone: payload.phone } };
    case "appearance": return { ok: true, op: "merge", path: `users/${uid}/meta/app`, data: { background: payload.choice } };
    case "name": return { ok: true, op: "merge", path: `users/${uid}`, data: { displayName: payload.displayName } };
    case "message": return { ok: true, op: "add", path: `users/${uid}/messages`, data: { pairId: payload.pairId, text: payload.text, at: payload.at, mine: true } };
    case "request": return { ok: true, op: "add", path: payload.path, data: payload.data };
    case "request-decide": return { ok: true, op: "update", path: `schedule/${payload.pairId}/requests/${payload.reqId}`, data: payload.patch };
    case "block-land": return { ok: true, op: "add", path: payload.path, data: payload.data };
    case "week-version": return { ok: true, op: "set", path: payload.path, data: payload.data };
    case "pointer": return { ok: true, op: "pointerMove", pairId: payload.pairId, request: payload.request };
    case "plans": return { ok: true, op: "plans", plan: payload.plan };
    case "device": return { ok: true, op: "merge", path: payload.path, data: payload.data };
    case "device-off": return { ok: true, op: "update", path: `profiles/${uid}/devices/${payload.deviceId}`, data: payload.patch };
    default: return { ok: false, reason: "unknown-kind" };
  }
}

// The trust seam (CARESITS_TRUST) is what trust.js renders My
// Profile, Checks and Reviews from. It is built here, from the
// member's own documents, because the boot is the one place
// that reads them all: the user doc (the name and side of
// record), the public card (the name the questionnaire saved,
// postcode, photo) and the questionnaire doc (country). Name
// precedence follows the save layer's own rule: a carer's card
// carries the name they gave the questionnaire, a family's
// name of record is the user doc's.
export function trustSeamFrom(profile, card, questionnaire) {
  const p = profile || {};
  const c = card || {};
  const q = questionnaire || {};
  const side = c.side || p.side || q.side || "";
  const name = side === "carer" ? (c.displayName || p.displayName || "") : (p.displayName || c.displayName || "");
  const cardBits = c.card || {};
  // The member's depth level, computed from their own saved
  // answers by the one computation of record (levels.js). My
  // Profile presents it; nothing else reads it from the seam.
  const level = (q.answers && Object.keys(q.answers).length && side) ? levelOf(side, q.answers) : (c.level || "");
  return {
    name,
    side,
    level,
    postcode: c.postcode || "",
    photoUrl: c.photoUrl || "",
    // F14: the gallery rides inside the card map, up to four
    // photo URLs in slot order.
    gallery: (Array.isArray(cardBits.gallery) ? cardBits.gallery : []).filter((u) => typeof u === "string" && u).slice(0, 4),
    country: q.country || "",
  };
}

// Publish the trust seam from the three documents. Checks docs
// and reviews a demo or a test already placed on the seam are
// preserved: this refresh owns "me" only. CARESITS_ME gains the
// same facts its readers already look for (country, postcode,
// photo), and the trust surfaces re-render in place when
// trust.js is loaded (it exposes CARESITS_TRUST_RENDER).
// The documents the seam was last published from, retained so a
// name given later in the session (the tour) can re-publish the
// seam without a second read.
let lastTrustInputs = null;

export function publishTrust(profile, card, questionnaire) {
  lastTrustInputs = { profile, card, questionnaire };
  const me = trustSeamFrom(profile, card, questionnaire);
  if (typeof window === "undefined") return me;
  const prev = window.CARESITS_TRUST || {};
  window.CARESITS_TRUST = { docs: prev.docs || [], reviews: prev.reviews || [], me };
  if (window.CARESITS_ME) {
    window.CARESITS_ME = {
      ...window.CARESITS_ME,
      side: me.side || window.CARESITS_ME.side || "",
      name: me.name || window.CARESITS_ME.name || "",
      country: me.country || window.CARESITS_ME.country || "",
      postcode: me.postcode || window.CARESITS_ME.postcode || "",
      photoUrl: me.photoUrl || window.CARESITS_ME.photoUrl || "",
      gallery: me.gallery,
    };
  }
  if (typeof window.CARESITS_TRUST_RENDER === "function") window.CARESITS_TRUST_RENDER();
  return me;
}

// The tour's name write lands on the user doc only. Re-publish
// the seam from the retained documents with that one field
// replaced, so My Profile shows the name in the same session it
// was given (Leg 2): a mirror of the server truth, never a
// second copy of it.
export function refreshTrustName(name) {
  if (!lastTrustInputs || typeof window === "undefined") return;
  const profile = { ...(lastTrustInputs.profile || {}), displayName: name };
  publishTrust(profile, lastTrustInputs.card, lastTrustInputs.questionnaire);
}

// F20 (Security ruling c9ef7b17, app side): exactly two sealed
// fences read a typed timestamp where the planners speak ISO
// strings — the invites fence reads createdAt as a timestamp,
// the shopping fence reads updatedAt as one. The conversion
// lives here, at the one seam where the SDK is in scope, and
// it touches those two kinds only: every other kind's data
// passes through unchanged, by reference.
export function writeDataFor(kind, data, toTimestamp) {
  if (!data || typeof data !== "object") return data;
  if (kind === "invite-create" && typeof data.createdAt === "string") return { ...data, createdAt: toTimestamp(data.createdAt) };
  if (kind === "shopping" && typeof data.updatedAt === "string") return { ...data, updatedAt: toTimestamp(data.updatedAt) };
  return data;
}

// The write executor, lifted out of the boot so it can be desk
// proven against a stubbed SDK (live-tests). It routes through
// routeWrite, converts the two timestamp fields (F20), and
// runs the op the router named.
export function makeWriter(fs, db, uid) {
  const docAt = (path) => fs.doc(db, ...path.split("/"));
  const colAt = (path) => fs.collection(db, ...path.split("/"));
  return async (kind, payload) => {
    const r = routeWrite(kind, payload, uid);
    if (!r.ok) return r;
    const data = writeDataFor(kind, r.data, (iso) => fs.Timestamp.fromDate(new Date(iso)));
    try {
      if (r.op === "set") await fs.setDoc(docAt(r.path), data);
      else if (r.op === "update") await fs.updateDoc(docAt(r.path), data);
      else if (r.op === "merge") await fs.setDoc(docAt(r.path), data, { merge: true });
      else if (r.op === "add") await fs.addDoc(colAt(r.path), data);
      else if (r.op === "delete") await fs.deleteDoc(docAt(r.path));
      else if (r.op === "binRestore") {
        const batch = fs.writeBatch(db);
        if (r.originId) batch.set(docAt(r.originPath), data);
        else batch.set(fs.doc(colAt(r.originPath)), data);
        batch.delete(docAt(r.binPath));
        await batch.commit();
      }
      else if (r.op === "inviteAccept") {
        const batch = fs.writeBatch(db);
        batch.set(docAt(r.relPath), r.relData);
        batch.update(docAt(r.invitePath), r.stamp);
        await batch.commit();
      }
      else if (r.op === "reportPair") {
        const batch = fs.writeBatch(db);
        batch.set(fs.doc(colAt("safetyReports")), data);
        // F22 (Security ruling 46d6b466): the counter lands as a
        // set with merge, never an update. An update cannot
        // create the doc, so on a counter that does not stand
        // yet the first filing would always fail; a merge set
        // is judged by the create arm on first filing and the
        // update arm afterwards. Split-docs (ruling 2c267c79):
        // one counter field per document, one transform per
        // write, so each increment is judged at full strength.
        batch.set(docAt("_owner/aggregates/safetyFiled/main"), { filed: fs.increment(1) }, { merge: true });
        batch.set(docAt("_owner/aggregates/safetyOpen/main"), { open: fs.increment(1) }, { merge: true });
        await batch.commit();
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e?.code || e) };
    }
  };
}

// F19: Matches and the urgent board render from the Phase C
// seam. These are the only names the seam ever needs: the
// other member of each of the viewer's pairs, plus — for a
// carer reading the board — the family who posted each job.
export function phaseCNameTargets(uid, side, rels, jobs) {
  const out = new Set();
  for (const rel of rels || []) for (const m of rel.members || []) if (m && m !== uid) out.add(m);
  if (side === "carer") for (const job of jobs || []) if (job.familyUid && job.familyUid !== uid) out.add(job.familyUid);
  return [...out];
}

// The seam's shape, pinned in one place: the viewer, their
// pairs, the board's jobs, and the names the cards speak.
export function phaseCSeam({ uid, side, rels, jobs, names }) {
  return { viewer: { uid, side: side || "" }, rels: rels || [], jobs: jobs || [], names: names || {} };
}

// The live Phase C fetch: the viewer's pairs (the members
// array-contains query is the read fence's provable shape),
// the open board plus the viewer's own jobs merged by id, and
// the names from the public cards. Lifted out of the boot so
// live-tests can prove the assembly against a stubbed SDK.
export async function fetchPhaseC(fs, db, uid, side) {
  const colAt = (path) => fs.collection(db, ...path.split("/"));
  const docAt = (path) => fs.doc(db, ...path.split("/"));
  const grabQuery = async (coll, constraint) => {
    const snap = await fs.getDocs(fs.query(colAt(coll), constraint));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };
  const rels = await grabQuery("relationships", fs.where("members", "array-contains", uid));
  const openJobs = await grabQuery("jobs", fs.where("state", "==", "open"));
  const ownJobs = await grabQuery("jobs", fs.where("familyUid", "==", uid));
  const byId = new Map();
  for (const job of [...openJobs, ...ownJobs]) byId.set(job.id, job);
  const jobs = [...byId.values()];
  const names = {};
  for (const other of phaseCNameTargets(uid, side, rels, jobs)) {
    try {
      const snap = await fs.getDoc(docAt(`profiles/${other}`));
      if (snap.exists()) names[other] = snap.data().displayName || "";
    } catch { /* a card that will not read leaves the plain member word */ }
  }
  return phaseCSeam({ uid, side, rels, jobs, names });
}

const SDK = "../accounts/sdk";

export async function bootLive() {
  const twin = new URLSearchParams(location.search).get("twin") === "1";
  const cfgMod = await import(twin ? "./test-config.js" : "./firebase-config.js");
  // The two config modules name their export differently
  // (firebaseConfig in production, testFirebaseConfig on the
  // twin); resolve either, never undefined.
  const cfg = cfgMod.firebaseConfig || cfgMod.testFirebaseConfig;
  const appMod = await import(SDK + "/firebase-app.js");
  const authMod = await import(SDK + "/firebase-auth.js");
  const fs = await import(SDK + "/firebase-firestore.js");
  // ONE shared app instance: the DEFAULT app, the same one the door and
  // the accounts module sign in on. Auth sessions persist per app name,
  // so a named app here would never see the signed-in user (the build
  // 103 R1 fault). Every shell module resolves the default app only.
  const app = appMod.getApps().find((a) => a.name === "[DEFAULT]") || appMod.initializeApp(cfg);
  const auth = authMod.getAuth(app);
  const db = fs.getFirestore(app);
  return new Promise((resolve) => {
    authMod.onAuthStateChanged(auth, async (u) => {
      if (!u || u.isAnonymous) {
        // The uid seam is a pointer, not data: clearing it on
        // sign out deletes nothing, it only stops the device
        // keys resolving to the previous account (F16).
        if (typeof window !== "undefined") window.CARESITS_UID = null;
        gateSignedOut();
        resolve({ on: true, signedIn: false });
        return;
      }
      const uid = u.uid;
      if (typeof window !== "undefined") window.CARESITS_UID = uid;
      const docAt = (path) => fs.doc(db, ...path.split("/"));
      const colAt = (path) => fs.collection(db, ...path.split("/"));
      window.CARESITS_WRITE = makeWriter(fs, db, uid);
      window.CARESITS_NAME_SAVED = (v) => refreshTrustName(v);
      window.CARESITS_INVITE_LOOKUP = async (code) => {
        try {
          const snap = await fs.getDoc(docAt(`invites/${code}`));
          return snap.exists() ? snap.data() : null;
        } catch { return null; }
      };
      let profile = {};
      let qData = {};
      try {
        const prof = await fs.getDoc(docAt(`users/${uid}`));
        profile = prof.exists() ? prof.data() : {};
        const q = await fs.getDoc(docAt(`users/${uid}/meta/questionnaire`));
        qData = q.exists() ? q.data() : {};
        window.CARESITS_ME = { uid, side: profile.side || "", name: profile.displayName || "" };
        window.CARESITS_PROFILE_COMPLETE = !!(profile.displayName && q.exists());
      } catch { /* the surfaces stand in their empty states */ }
      try {
        const grab = async (path) => {
          const snap = await fs.getDocs(colAt(path));
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        };
        const binDocs = await grab(`users/${uid}/recentlyDeleted`);
        window.CARESITS_BIN = binDocs;
        const kids = await grab(`users/${uid}/children`);
        const story = await grab(`users/${uid}/dayStory`);
        const msgs = await grab(`users/${uid}/messages`);
        const cardSnap = await fs.getDoc(docAt(`profiles/${uid}`));
        const cardData = cardSnap.exists() ? cardSnap.data() : {};
        window.CARESITS_FAMILY = { children: kids, entries: story, side: window.CARESITS_ME?.side || "family" };
        // F15: My Profile renders from the trust seam, and the
        // seam is published here, from the member's real
        // documents, the moment the boot has read them.
        publishTrust(profile, cardData, qData);
        window.CARESITS_EXPORT_DATA = {
          profile: window.CARESITS_ME || null,
          card: cardSnap.exists() ? cardSnap.data() : null,
          questionnaire: null,
          messages: msgs.filter((m) => m.mine === true),
          calendar: null,
        };
      } catch { /* export and the bin stand in their empty states */ }
      try {
        // F19: Matches and the board read the member's real
        // pairs and jobs. The seam is published here, from the
        // live fetch, and the Phase C surfaces re-render in
        // place when matches.js is loaded (it exposes
        // CARESITS_PHASE_C_RENDER). No pairs or jobs yet means
        // the seam carries empty lists and the designed empty
        // states stand.
        const seam = await fetchPhaseC(fs, db, uid, window.CARESITS_ME?.side || profile.side || "");
        window.CARESITS_PHASE_C = seam;
        if (typeof window.CARESITS_PHASE_C_RENDER === "function") window.CARESITS_PHASE_C_RENDER();
      } catch { /* matches and the board stand in their empty states */ }
      resolve({ on: true, signedIn: true, uid });
    });
  });
}

// The signed out gate (HQ ruling on the remainder round's
// Leg 19): a signed out entry into the shell routes back to
// the door; the full shell never stands open signed out. A
// deliberate Explore entry (the door's demo button, the
// journey's Explore pick) carries the session demo marker
// and is exempt: browsing was never gated. Only the shell
// page carries the layout element, so only it can bounce.
function gateSignedOut() {
  try {
    if (typeof document === "undefined" || !document.getElementById("layout")) return;
    if (sessionStorage.getItem("caresits-demo") === "1") return;
  } catch { return; }
  location.href = "door.html";
}

if (typeof document !== "undefined" && !window.CARESITS_LIVE_OFF) {
  bootLive().catch(() => {});
}
