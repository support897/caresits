// Caresitters app2 — the live bridge.
// Maps every CARESITS_WRITE kind the surfaces emit onto the
// Firestore shapes the sealed rules accept, and fills the
// CARESITS_* data hooks from the signed in member's own
// world. Routing is a pure function so it can be desk proven
// without a network. The twin is used only when the address
// carries ?twin=1; every other visit uses the production
// config beside this file.
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
    case "dayStory": return { ok: true, op: "add", path: `users/${uid}/dayStory`, data: { day: payload.day, tile: payload.tile, note: payload.note, at: payload.at } };
    case "photo-request": return { ok: true, op: "add", path: `users/${uid}/dayStory`, data: { day: payload.day, tile: "Photo moment", note: "A photo of the kids was asked for", at: payload.at } };
    case "timesheet": return { ok: true, op: "add", path: `users/${uid}/timesheets`, data: { day: payload.day, hours: payload.hours } };
    case "reminder": return { ok: true, op: "add", path: `users/${uid}/meta/reminders`, data: { text: payload.text, when: payload.when } };
    case "emergency": return { ok: true, op: "add", path: `users/${uid}/meta/emergency`, data: { name: payload.name, phone: payload.phone } };
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

const SDK = "../accounts/sdk";

export async function bootLive() {
  const twin = new URLSearchParams(location.search).get("twin") === "1";
  const cfgMod = await import(twin ? "./test-config.js" : "./firebase-config.js");
  const appMod = await import(SDK + "/firebase-app.js");
  const authMod = await import(SDK + "/firebase-auth.js");
  const fs = await import(SDK + "/firebase-firestore.js");
  const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(cfgMod.firebaseConfig, "app2-live");
  const auth = authMod.getAuth(app);
  const db = fs.getFirestore(app);
  return new Promise((resolve) => {
    authMod.onAuthStateChanged(auth, async (u) => {
      if (!u || u.isAnonymous) { resolve({ on: true, signedIn: false }); return; }
      const uid = u.uid;
      const docAt = (path) => fs.doc(db, ...path.split("/"));
      const colAt = (path) => fs.collection(db, ...path.split("/"));
      window.CARESITS_WRITE = async (kind, payload) => {
        const r = routeWrite(kind, payload, uid);
        if (!r.ok) return r;
        try {
          if (r.op === "set") await fs.setDoc(docAt(r.path), r.data);
          else if (r.op === "update") await fs.updateDoc(docAt(r.path), r.data);
          else if (r.op === "merge") await fs.setDoc(docAt(r.path), r.data, { merge: true });
          else if (r.op === "add") await fs.addDoc(colAt(r.path), r.data);
          else if (r.op === "delete") await fs.deleteDoc(docAt(r.path));
          else if (r.op === "binRestore") {
            const batch = fs.writeBatch(db);
            if (r.originId) batch.set(docAt(r.originPath), r.data);
            else batch.set(fs.doc(colAt(r.originPath)), r.data);
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
            batch.set(fs.doc(colAt("safetyReports")), r.data);
            batch.update(docAt("_owner/aggregates/safety/main"), { filed: fs.increment(1), open: fs.increment(1) });
            await batch.commit();
          }
          return { ok: true };
        } catch (e) {
          return { ok: false, reason: String(e?.code || e) };
        }
      };
      window.CARESITS_INVITE_LOOKUP = async (code) => {
        try {
          const snap = await fs.getDoc(docAt(`invites/${code}`));
          return snap.exists() ? snap.data() : null;
        } catch { return null; }
      };
      try {
        const prof = await fs.getDoc(docAt(`users/${uid}`));
        const profile = prof.exists() ? prof.data() : {};
        const q = await fs.getDoc(docAt(`users/${uid}/meta/questionnaire`));
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
        window.CARESITS_FAMILY = { children: kids, entries: story, side: window.CARESITS_ME?.side || "family" };
        window.CARESITS_EXPORT_DATA = {
          profile: window.CARESITS_ME || null,
          card: cardSnap.exists() ? cardSnap.data() : null,
          questionnaire: null,
          messages: msgs.filter((m) => m.mine === true),
          calendar: null,
        };
      } catch { /* export and the bin stand in their empty states */ }
      resolve({ on: true, signedIn: true, uid });
    });
  });
}

if (typeof document !== "undefined" && !window.CARESITS_LIVE_OFF) {
  bootLive().catch(() => {});
}
