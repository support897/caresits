// Caresitters app2 — the live bridge.
// Maps every CARESITS_WRITE kind the surfaces emit onto the
// Firestore shapes the sealed rules accept, and fills the
// CARESITS_* data hooks from the signed in member's own
// world. Routing is a pure function so it can be desk proven
// without a network. The twin is used only when the address
// carries ?twin=1; every other visit uses the production
// config beside this file.
import { levelOf, mergeDeepAnswers } from "./levels.js";
import { accountKey } from "./storage-keys.js";
import { applyI18n } from "./lang.js";
import { resolvePlan, entitlementFromRecord, plusExtrasOpen, withTimeout } from "../accounts/account.js";

// The photo lifecycle stamp path (HQ spec, 19 Oct 2026):
// carers only, at the root, beside _comp and _entitlements.
// The stamp is guarded by the rules arm in the v5 fold: the
// one key must equal the server's own clock, so it can never
// be forged or backdated by any client.
export function activityStampPath(uid, side) {
  return uid && side === "carer" ? `_activity/${uid}` : null;
}

export const ENTRY_ROLES = Object.freeze(["career", "family", "communicate"]);

export function routeWrite(kind, payload, uid) {
  if (!uid) return { ok: false, reason: "signed-out" };
  switch (kind) {
    case "contact": return { ok: true, op: "set", path: payload.path, data: payload.data };
    case "transition": return { ok: true, op: "update", path: "relationships/" + payload.pairId, data: payload.patch };
    case "job": return { ok: true, op: "add", path: "jobs", data: payload.data };
    case "interest": return { ok: true, op: "set", path: payload.path, data: payload.data };
    case "report": return { ok: true, op: "reportPair", path: "safetyReports", data: payload.data, counter: payload.counter };
    case "block": return { ok: true, op: "set", path: payload.path, data: payload.data };
    // Id unity (QA b104 Leg 7): the child is written under its
    // own local id, so the mirror, the bin record, the remove
    // and the restore all speak ONE id. An addDoc random id
    // left every later delete speaking an id the server never
    // held — a silent no-op at permanent deletion.
    case "child-add": return { ok: true, op: "set", path: `users/${uid}/children/${payload.id}`, data: { name: payload.name, theme: payload.theme, ...(payload.ageYears != null ? { ageYears: payload.ageYears } : {}), ...(Array.isArray(payload.loves) && payload.loves.length ? { loves: payload.loves } : {}) } };
    case "invite-create": return { ok: true, op: "set", path: payload.path, data: payload.data };
    case "invite-accept": return { ok: true, op: "inviteAccept", relPath: payload.relPath, relData: payload.relData, invitePath: payload.invitePath, stamp: payload.stamp };
    case "shopping": return { ok: true, op: "set", path: payload.path, data: payload.data };
    case "child-remove": return { ok: true, op: "delete", path: `users/${uid}/children/${payload.id}` };
    case "bin-move": return { ok: true, op: "set", path: payload.path, data: payload.data };
    case "bin-delete": return { ok: true, op: "delete", path: payload.path };
    case "bin-restore": return { ok: true, op: "binRestore", binPath: payload.binPath, originPath: payload.originPath, originId: payload.originId || null, data: payload.data };
    case "dayStory-remove": return { ok: true, op: "delete", path: `users/${uid}/dayStory/${payload.id}` };
    // A fresh photo also clears the lifecycle's swept stamp
    // (Ilse's ruling, 19 Oct 2026): the carer returns, adds a
    // photo, and the profile is back in family search. A
    // manual remove leaves the stamp as it stands.
    case "photo": return { ok: true, op: "merge", path: `profiles/${uid}`, data: payload.photoUrl ? { photoUrl: payload.photoUrl, photoClearedAt: null } : { photoUrl: payload.photoUrl } };
    case "gallery": return { ok: true, op: "merge", path: `profiles/${uid}`, data: { card: { gallery: (Array.isArray(payload.gallery) ? payload.gallery : []).filter((u) => typeof u === "string" && u).slice(0, 4) } } };
    // The resume file record names a TEMPORARY object only
    // (Ilse's resume model, 19 Oct 2026): an uploaded resume is
    // an extraction waiting to be confirmed, never a kept or
    // family visible document. The name rides the profile doc
    // so the discard, the confirm and the account deletion can
    // each remove the object itself.
    case "dayStory": return { ok: true, op: "set", path: `users/${uid}/dayStory/${payload.id}`, data: { day: payload.day, tile: payload.tile, note: payload.note, at: payload.at } };
    case "photo-request": return { ok: true, op: "add", path: `users/${uid}/dayStory`, data: { day: payload.day, tile: "Photo moment", note: "A photo of the kids was asked for", at: payload.at } };
    case "timesheet": return { ok: true, op: "add", path: `users/${uid}/timesheets`, data: { day: payload.day, hours: payload.hours } };
    case "reminder": return { ok: true, op: "merge", path: `users/${uid}/meta/reminders`, data: { text: payload.text, when: payload.when } };
    case "emergency": return { ok: true, op: "merge", path: `users/${uid}/meta/emergency`, data: { name: payload.name, phone: payload.phone } };
    case "appearance": return { ok: true, op: "merge", path: `users/${uid}/meta/app`, data: { background: payload.choice } };
    case "entry-role": return ENTRY_ROLES.includes(payload.entryRole) ? { ok: true, op: "merge", path: `users/${uid}/meta/app`, data: { entryRole: payload.entryRole } } : { ok: false, reason: "invalid-role" };
    case "language": return { ok: true, op: "merge", path: `users/${uid}/meta/app`, data: { language: payload.code } };
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

// A name the tour saved can arrive BEFORE the boot's first
// publication (QA b104 Leg 2's race): the refresh then has no
// retained documents to re-publish from, and the boot's own
// publication — read earlier still — would land the
// placeholder over a saved name. The name is therefore held
// here and applied at every publication until the documents
// themselves carry it.
let pendingTrustName = "";

export function publishTrust(profile, card, questionnaire) {
  if (pendingTrustName) profile = { ...(profile || {}), displayName: pendingTrustName };
  lastTrustInputs = { profile, card, questionnaire };
  const me = trustSeamFrom(profile, card, questionnaire);
  if (typeof window === "undefined") return me;
  // The connect gate's completeness, judged from the saved
  // facts the seam itself stands on (QA b107 Legs 9 + 10): a
  // finished questionnaire, a side, a name. It was computed at
  // boot from the user doc's name field alone, which the save
  // never completes, so landed profiles read incomplete to
  // every gate for the whole session.
  window.CARESITS_PROFILE_COMPLETE = Boolean(
    me.side && me.name && questionnaire && questionnaire.answers && Object.keys(questionnaire.answers).length
  );
  // The progress seam (QA night N1): Home reads the member's
  // questionnaire truth from here, never from the device keys
  // alone — the drain consumes the done envelope by design,
  // and a completed member must not read 0% on a fresh boot.
  window.CARESITS_QUESTIONS = {
    answered: questionnaire && questionnaire.answers ? Object.keys(questionnaire.answers).length : 0,
    level: me.level || "explore",
    side: me.side || "",
  };
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
  // Home derives its progress card from this seam, and the
  // seam lands after the first paint (the deep answers read
  // rides the boot): a Home painted before this publication
  // must re-derive when it lands, or it can stand on a false
  // 0% for a member whose questionnaire is complete (QA
  // F-CS-RT-1, found on the real-account round trip).
  if (typeof window.CARESITS_RENDER_HOME === "function") window.CARESITS_RENDER_HOME();
  return me;
}

// The tour's name write lands on the user doc only. Re-publish
// the seam from the retained documents with that one field
// replaced, so My Profile shows the name in the same session it
// was given (Leg 2): a mirror of the server truth, never a
// second copy of it.
export function refreshTrustName(name) {
  if (name) pendingTrustName = name;
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

// The week seam (QA b104 ROOT B): the boot reads the member's
// own meta documents and timesheet entries and publishes them
// in the shape week.js boots from. The reminder and the
// emergency contact are single merge documents server-side;
// the surfaces render lists, so each becomes a one-entry list
// when it carries its words. Sessions (the pair roster) keep
// their own calendar source and are not this seam's to fill.
export function weekSeamFrom({ timesheets, reminderDoc, emergencyDoc }) {
  const reminders = reminderDoc && reminderDoc.text ? [{ text: reminderDoc.text, when: reminderDoc.when || "" }] : [];
  const emergency = emergencyDoc && emergencyDoc.name ? [{ name: emergencyDoc.name, phone: emergencyDoc.phone || "" }] : [];
  return { sessions: [], entries: timesheets || [], reminders, emergency };
}

// The thread seam (QA b104 Leg 14): the boot's message mirror
// plus the Phase C pairs become the one thread the surface
// opens — the first live pair, its messages in order, the
// other member's card name, and today's free-taste count
// from the viewer's own sent messages. No pair yet publishes
// the designed empty thread, which renders its empty state.
export function threadSeamFrom({ rels, names, msgs, uid }) {
  const rel = (rels || []).find((r) => r.state === "contact" || r.state === "hired") || (rels || [])[0];
  if (!rel) return { pairId: "", otherName: "", messages: [], plan: null, tasteUsedToday: 0 };
  const other = (rel.members || []).find((m) => m && m !== uid) || "";
  const messages = (msgs || []).filter((m) => m.pairId === rel.id)
    .map((m) => ({ text: m.text || "", mine: m.mine === true, at: m.at || "" }));
  const today = new Date().toDateString();
  const tasteUsedToday = messages.filter((m) => m.mine && m.at && new Date(m.at).toDateString() === today).length;
  return { pairId: rel.id, otherName: (names || {})[other] || "", messages, plan: null, tasteUsedToday };
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
        if (typeof window !== "undefined") { window.CARESITS_UID = null; delete document.documentElement.dataset.entryRole; }
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
      let qExists = false;
      try {
        // First-data reads are bounded (fleet census cure):
        // a wedged read takes the same missing-data path as
        // an error, so the seams publish with what stands
        // instead of never publishing at all.
        const prof = await withTimeout(fs.getDoc(docAt(`users/${uid}`)), 15000, "profile read");
        profile = prof.exists() ? prof.data() : {};
        const q = await withTimeout(fs.getDoc(docAt(`users/${uid}/meta/questionnaire`)), 15000, "questionnaire read");
        qExists = q.exists();
        qData = q.exists() ? q.data() : {};
        // The tier answers live as their own documents under
        // profiles/{uid}/answers (QA night N1): judged from
        // the questionnaire alone, a completed member's level
        // read "explore" and their progress read zero, because
        // the map the boot publishes by never contained the
        // tiers. Merge the documents back in, so every seam
        // below judges the member's FULL saved state. A failed
        // read publishes with the base map; it never blocks
        // the boot.
        try {
          const aSnap = await withTimeout(fs.getDocs(colAt(`profiles/${uid}/answers`)), 15000, "answers read");
          const byPair = {};
          aSnap.forEach((d) => { byPair[d.id] = d.data(); });
          const merged = mergeDeepAnswers(qData.answers || {}, byPair, qData.side || profile.side || "");
          if (Object.keys(merged).length > Object.keys(qData.answers || {}).length) qData = { ...qData, answers: merged };
        } catch { /* the base map stands */ }
        window.CARESITS_ME = { uid, side: profile.side || "", name: profile.displayName || "", entryRole: "" };
        window.CARESITS_PROFILE_COMPLETE = !!(profile.displayName && q.exists());
      } catch { /* the surfaces stand in their empty states */ }
      // The entitlement record (payments chapter §3): read at boot
      // for family accounts only. Carers never read it, and no free
      // feature reads it; the gates take the resolved plan from this
      // seam. A missing or unreachable record resolves to the free
      // taste, which is the record's own answer for most families.
      try {
        const side = profile.side || "";
        const createdRaw = u.metadata && u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : NaN;
        const createdAtMs = Number.isNaN(createdRaw) ? null : createdRaw;
        let payment = null;
        if (side !== "carer") {
          const ent = await withTimeout(fs.getDoc(docAt(`_entitlements/${uid}`)), 15000, "entitlement read");
          payment = entitlementFromRecord(ent.exists() ? ent.data() : null, Date.now());
        }
        const plan = resolvePlan({ side, comp: null, payment, now: Date.now() });
        window.CARESITS_PLAN = plan;
        window.CARESITS_ME = {
          ...(window.CARESITS_ME || { uid }),
          plan,
          plusExtras: plusExtrasOpen({ plan, side, createdAtMs, now: Date.now() }),
        };
        // The purchase flow's refresh seam (enabling build):
        // after a buy or a restore, the webhook writes the
        // record within moments; this re-reads it and
        // republishes the same seams, so the gates open in
        // the same session without a restart. Retried a few
        // times because the webhook can lag the store's own
        // answer by seconds.
        window.CARESITS_REFRESH_PLAN = async () => {
          for (const wait of [0, 2500, 5000]) {
            if (wait) await new Promise((r) => setTimeout(r, wait));
            try {
              const ent2 = await withTimeout(fs.getDoc(docAt(`_entitlements/${uid}`)), 15000, "entitlement refresh");
              const payment2 = entitlementFromRecord(ent2.exists() ? ent2.data() : null, Date.now());
              const plan2 = resolvePlan({ side, comp: null, payment: payment2, now: Date.now() });
              const before = window.CARESITS_PLAN && window.CARESITS_PLAN.tier;
              window.CARESITS_PLAN = plan2;
              window.CARESITS_ME = {
                ...(window.CARESITS_ME || { uid }),
                plan: plan2,
                plusExtras: plusExtrasOpen({ plan: plan2, side, createdAtMs, now: Date.now() }),
              };
              if (plan2.tier !== before || plan2.pass) break;
            } catch { /* a later attempt or the next boot reads it */ }
          }
        };
      } catch { /* no record reachable: the free taste stands */ }
      // The photo lifecycle stamp (HQ spec, 19 Oct 2026): a
      // carer opening the signed-in app refreshes lastActiveAt.
      // The value is the server's own clock and nothing else,
      // which is the only value the rules arm admits. Fail
      // soft: until the arm is published the write refuses,
      // and the boot never breaks over a stamp.
      try {
        const stampPath = activityStampPath(uid, profile.side || "");
        if (stampPath) await fs.setDoc(docAt(stampPath), { lastActiveAt: fs.serverTimestamp() }, { merge: true });
      } catch { /* the stamp waits for its rules arm */ }
      let bootMsgs = [];
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
        bootMsgs = msgs;
        const cardSnap = await fs.getDoc(docAt(`profiles/${uid}`));
        const cardData = cardSnap.exists() ? cardSnap.data() : {};
        window.CARESITS_FAMILY = { children: kids, entries: story, side: window.CARESITS_ME?.side || "family" };
        // The family surfaces booted before this publication
        // landed (QA b104 ROOT B): they re-render from the
        // seam now, the Phase C way.
        if (typeof window.CARESITS_FAMILY_RENDER === "function") window.CARESITS_FAMILY_RENDER();
        // ROOT B, the rest of the member's own records: the
        // week seam (timesheets, the reminder, the emergency
        // contact) and the appearance record. The saved
        // background choice re-seeds the device key BEFORE
        // the trust publication below re-renders Settings, so
        // the boot applies the member's own background, not
        // the device default. An uploaded photo itself is
        // device data and is never seeded from the record.
        try {
          const docOr = async (path) => {
            const s = await withTimeout(fs.getDoc(docAt(path)), 15000, "meta read");
            return s.exists() ? s.data() : null;
          };
          const sheets = await grab(`users/${uid}/timesheets`);
          const reminderDoc = await docOr(`users/${uid}/meta/reminders`);
          const emergencyDoc = await docOr(`users/${uid}/meta/emergency`);
          const appDoc = await docOr(`users/${uid}/meta/app`);
          let pendingRole = "";
          try { pendingRole = sessionStorage.getItem("caresits-entry-role") || ""; } catch { /* session storage off */ }
          let entryRole = ENTRY_ROLES.includes(appDoc && appDoc.entryRole) ? appDoc.entryRole : "";
          if (ENTRY_ROLES.includes(pendingRole)) {
            try {
              const savedRole = await window.CARESITS_WRITE("entry-role", { entryRole: pendingRole });
              if (savedRole && savedRole.ok) {
                entryRole = pendingRole;
                try { sessionStorage.removeItem("caresits-entry-role"); } catch { /* session storage off */ }
              } else if (!entryRole) entryRole = pendingRole;
            } catch { if (!entryRole) entryRole = pendingRole; }
          }
          if (entryRole) {
            window.CARESITS_ME = { ...(window.CARESITS_ME || { uid }), entryRole };
            document.documentElement.dataset.entryRole = entryRole;
            if (typeof window.CARESITS_RENDER_HOME === "function") window.CARESITS_RENDER_HOME();
          } else {
            delete document.documentElement.dataset.entryRole;
          }
          window.CARESITS_WEEK = weekSeamFrom({ timesheets: sheets, reminderDoc, emergencyDoc });
          if (typeof window.CARESITS_WEEK_RENDER === "function") window.CARESITS_WEEK_RENDER();
          if (appDoc && appDoc.background) {
            try { const bgKey = accountKey("caresits-app2-bg", uid); if (bgKey) localStorage.setItem(bgKey, JSON.stringify({ choice: appDoc.background })); } catch { /* storage off */ }
          }
          // The member's language rides the account beside
          // their background. Seed the device key, then refresh
          // translated text in place so the first-run tour and
          // any open questionnaire survive account restoration.
          if (appDoc && appDoc.language) {
            try {
              const langKey = accountKey("caresits-lang", uid);
              if (langKey && localStorage.getItem(langKey) !== appDoc.language) {
                localStorage.setItem(langKey, appDoc.language);
              }
            } catch { /* storage off */ }
          }
          // The tour and questionnaire can render before auth restores
          // the account's language key. Refresh the shell and both live
          // overlays after the account document has settled.
          applyI18n();
          window.CARESITS_TOUR_REFRESH_LANGUAGE?.();
          document.getElementById("journeyFrame")?.contentWindow?.CARESITS_REFRESH_LANGUAGE?.();
        } catch { /* the week surfaces stand in their empty states */ }
        // F15: My Profile renders from the trust seam, and the
        // seam is published here, from the member's real
        // documents, the moment the boot has read them.
        publishTrust(profile, cardData, qData);
        // Land a finished journey still standing on this
        // device (QA b108): when the account holds no
        // questionnaire yet and a done envelope waits under
        // this member's key, the shell drains it now — the
        // save completes at a warm moment even when the
        // journey's own attempt judged local at a cold one.
        // The guard reads the snapshot's EXISTENCE (QA b110
        // member 3): qData is an object in both states, so a
        // truthiness guard never fired once. The drain fires
        // now and again seconds later — the firing instant's
        // state is not ours to trust, the envelope read is
        // cheap, and a drained key makes later attempts
        // no-ops.
        if (!qExists) {
          const drain = () => { import("./account-save.js").then((m) => m.drainOutbox()).catch(() => {}); };
          drain();
          setTimeout(drain, 4000);
        }
        window.CARESITS_EXPORT_DATA = {
          profile: window.CARESITS_ME || null,
          card: cardSnap.exists() ? cardSnap.data() : null,
          questionnaire: null,
          messages: msgs.filter((m) => m.mine === true),
          calendar: null,
        };
      } catch { /* export and the bin stand in their empty states */ }
      // Find's pool publisher, named so a later save can call
      // it again (Test b112 Leg C): the boot publishes before
      // a first session's journey exists, truthfully null, and
      // the profile that lands minutes later must republish
      // the pool, not leave Find waiting until the next boot.
      // The save's own publication fires this seam.
      const publishFind = async () => {
        const fm = await import("./find.js");
        window.CARESITS_FIND_DATA = await fm.fetchFindData(fs, db, uid);
        if (typeof window.CARESITS_FIND_RENDER === "function") window.CARESITS_FIND_RENDER();
      };
      window.CARESITS_FIND_REFRESH = () => { publishFind().catch(() => {}); };
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
        // Leg 14: the thread seam publishes from the same
        // fetch — pairs plus the boot's message mirror — so
        // the Messages surface and its empty state can render.
        window.CARESITS_THREAD = threadSeamFrom({ rels: seam.rels, names: seam.names, msgs: bootMsgs, uid });
        if (typeof window.CARESITS_THREAD_RENDER === "function") window.CARESITS_THREAD_RENDER();
        // Find's data seam (QA b110 FLAGREAD): the pool was
        // designed to publish from this warm fetch and never
        // did, so Find judged every session by its own cold
        // fetch at page load and waited forever. Publish it
        // here, where the session and the documents stand,
        // and let Find re-render from it.
        try { await publishFind(); } catch { /* Find stands on its own fetch */ }
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
