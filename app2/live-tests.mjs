import assert from "node:assert/strict";
import { routeWrite, trustSeamFrom, publishTrust, refreshTrustName, writeDataFor, makeWriter, phaseCNameTargets, phaseCSeam, fetchPhaseC } from "./live.js";
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log("ok -", name); };
const ta = async (name, fn) => { await fn(); n += 1; console.log("ok -", name); };
t("router: signed out refuses everything", () => { assert.equal(routeWrite("job", { data: {} }, "").ok, false); });
t("router: contact sets the relationship at the planner path", () => { const r = routeWrite("contact", { path: "relationships/a_b", data: { state: "pending" } }, "a"); assert.equal(r.op, "set"); assert.equal(r.path, "relationships/a_b"); });
t("router: a report pairs its counts", () => { const r = routeWrite("report", { data: { state: "open" }, counter: { delta: { filed: 1, open: 1 } } }, "a"); assert.equal(r.op, "reportPair"); });
t("router: a block lands in the filer's own space", () => { const r = routeWrite("block", { path: "users/a/blocks/b", data: {} }, "a"); assert.equal(r.path, "users/a/blocks/b"); });
t("router: children and story ride the owner's own folders", () => { assert.equal(routeWrite("child-add", { name: "Leo", theme: "space" }, "a").path, "users/a/children"); assert.equal(routeWrite("dayStory", { day: "2026-10-15", tile: "Meal", note: "", at: "x" }, "a").path, "users/a/dayStory"); });
t("router: a message is the sender's own copy", () => { assert.equal(routeWrite("message", { pairId: "p", text: "hi", at: "x" }, "a").path, "users/a/messages"); });
t("router: calendar kinds map to their delta homes", () => { assert.equal(routeWrite("request-decide", { pairId: "p", reqId: "R1", patch: {} }, "a").path, "schedule/p/requests/R1"); assert.equal(routeWrite("block-land", { path: "schedule/p/blocks", data: {} }, "a").op, "add"); });
t("router: unknown kinds are refused", () => { assert.equal(routeWrite("teleport", {}, "a").ok, false); });
t("router: the two homes kinds land on their ruled shapes", () => {
  const inv = routeWrite("invite-create", { path: "invites/K7P2Q9AB", data: { familyUid: "a", label: "", createdAt: "x", usedBy: null } }, "a");
  assert.equal(inv.op, "set"); assert.equal(inv.path, "invites/K7P2Q9AB");
  const acc = routeWrite("invite-accept", { relPath: "relationships/a_b", relData: { state: "pending" }, invitePath: "invites/K7P2Q9AB", stamp: { usedBy: "b" } }, "b");
  assert.equal(acc.op, "inviteAccept"); assert.equal(acc.relPath, "relationships/a_b"); assert.deepEqual(acc.stamp, { usedBy: "b" });
  const shop = routeWrite("shopping", { path: "relationships/a_b/lists/shoppingList", data: { items: [], updatedAt: "x", updatedBy: "a" } }, "a");
  assert.equal(shop.op, "set"); assert.equal(shop.path, "relationships/a_b/lists/shoppingList");
  const kid = routeWrite("child-add", { name: "Mia", theme: "space", ageYears: 4, loves: ["water"] }, "a");
  assert.deepEqual(kid.data, { name: "Mia", theme: "space", ageYears: 4, loves: ["water"] });
});
t("router: a gallery save merges the list into the card map at the profile, capped and cleaned", () => {
  const r = routeWrite("gallery", { gallery: ["a", 7, "b", "c", "d", "e"] }, "u1");
  assert.equal(r.op, "merge"); assert.equal(r.path, "profiles/u1");
  assert.deepEqual(r.data, { card: { gallery: ["a", "b", "c", "d"] } });
});
t("trust seam (F15): a carer's me comes from her card, questionnaire name first", () => {
  const me = trustSeamFrom(
    { side: "carer", displayName: "Tour Name" },
    { side: "carer", displayName: "Ana Carer", postcode: "2021", photoUrl: "https://x/p.jpg", card: { gallery: ["https://x/1.jpg", "https://x/2.jpg"] } },
    { country: "Australia" }
  );
  assert.deepEqual(me, { name: "Ana Carer", side: "carer", postcode: "2021", photoUrl: "https://x/p.jpg", resumeFile: "", gallery: ["https://x/1.jpg", "https://x/2.jpg"], country: "Australia", level: "" });
});
t("trust seam (F15): a family's name of record is the user doc's", () => {
  const me = trustSeamFrom({ side: "family", displayName: "Fay" }, { side: "family", displayName: "Fay", postcode: "2000", photoUrl: "" }, {});
  assert.equal(me.name, "Fay"); assert.equal(me.side, "family"); assert.equal(me.postcode, "2000"); assert.equal(me.country, "");
});
t("trust seam (F15): empty documents give the empty default, never an invention", () => {
  assert.deepEqual(trustSeamFrom(null, null, null), { name: "", side: "", postcode: "", photoUrl: "", resumeFile: "", gallery: [], country: "", level: "" });
});
t("trust publish (F15): docs and reviews already on the seam survive, me is replaced, the render seam fires", () => {
  let rendered = 0;
  globalThis.window = {
    CARESITS_TRUST: { docs: [{ title: "WWCC" }], reviews: [{ stars: 5 }], me: { name: "Old" } },
    CARESITS_TRUST_RENDER: () => { rendered += 1; },
  };
  const me = publishTrust({ side: "carer", displayName: "Tour" }, { side: "carer", displayName: "Ana", postcode: "2021" }, { country: "Australia" });
  assert.equal(me.name, "Ana");
  assert.equal(globalThis.window.CARESITS_TRUST.docs.length, 1);
  assert.equal(globalThis.window.CARESITS_TRUST.reviews.length, 1);
  assert.equal(globalThis.window.CARESITS_TRUST.me.side, "carer");
  assert.equal(rendered, 1);
  delete globalThis.window;
});
t("trust publish (F14): the card's gallery rides onto the seam and the member record", () => {
  globalThis.window = { CARESITS_ME: { uid: "u1", side: "carer", name: "Ana" } };
  const me = publishTrust(
    { side: "carer", displayName: "Ana" },
    { side: "carer", displayName: "Ana", card: { gallery: ["https://x/1.jpg", "https://x/2.jpg", "https://x/3.jpg", "https://x/4.jpg", "https://x/5.jpg"] } },
    {}
  );
  assert.deepEqual(me.gallery, ["https://x/1.jpg", "https://x/2.jpg", "https://x/3.jpg", "https://x/4.jpg"]);
  assert.deepEqual(globalThis.window.CARESITS_ME.gallery, me.gallery);
  delete globalThis.window;
});
// ---- Leg 11 + Leg 2: the seam carries the computed level, and
// a name given in the tour re-publishes the seam in-session ----
const { FAMILY_PAGES } = await import("./questions.js");
const { EXPANSION } = await import("./questions2.js");
const valFor = (f) => {
  if (f.type === "chips") return [(f.options || []).find((o) => o !== "") ?? "x"];
  if (f.type === "select") return (f.options || []).find((o) => o !== "") ?? "x";
  if (f.type === "yesno") return true;
  if (f.type === "number") return 1;
  if (f.type === "grid") return { Mon: ["Morning"] };
  if (f.type === "band") return [0, 5];
  if (f.type === "experience") return { "0 to 1 years": "1" };
  if (f.type === "expchecks") return { checks: "Register verified", years: {} };
  if (f.type === "homefacts") return { petsOk: true };
  return "x";
};
const quickAnswers = { country: "Australia" };
for (const pg of FAMILY_PAGES) for (const f of pg.fields) if (f.required) quickAnswers[f.id] = valFor(f);
for (const pg of EXPANSION.family) for (const f of pg.fields) if (f.level === "quick") quickAnswers[f.id] = valFor(f);
t("trust seam (Leg 11): the member's level is computed from their saved answers", () => {
  const me = trustSeamFrom({ side: "family", displayName: "Fay" }, { side: "family" }, { side: "family", answers: quickAnswers });
  assert.equal(me.level, "quick");
});
t("trust seam (Leg 11): no answers, no level claimed", () => {
  const me = trustSeamFrom({ side: "family", displayName: "Fay" }, { side: "family" }, { side: "family" });
  assert.equal(me.level, "");
});
t("name refresh (Leg 2): a tour name re-publishes the seam and the member record in-session", () => {
  let rendered = 0;
  globalThis.window = { CARESITS_TRUST: { docs: [], reviews: [] }, CARESITS_ME: { uid: "u1", side: "family", name: "" }, CARESITS_TRUST_RENDER: () => { rendered += 1; } };
  publishTrust({ side: "family", displayName: "" }, { side: "family" }, { side: "family", answers: quickAnswers });
  assert.equal(globalThis.window.CARESITS_TRUST.me.name, "");
  refreshTrustName("QaTourName");
  assert.equal(globalThis.window.CARESITS_TRUST.me.name, "QaTourName");
  assert.equal(globalThis.window.CARESITS_ME.name, "QaTourName");
  assert.equal(globalThis.window.CARESITS_TRUST.me.level, "quick");
  assert.equal(rendered, 2);
  delete globalThis.window;
});
// ---- F18: reminder + emergency are singleton documents ----
// The old routing sent an "add" at these even segment paths;
// a collection reference there is invalid and the SDK throws
// before the write ever reaches the network. Both kinds now
// land as document merges on their singleton paths.
t("router (F18): a reminder is a document merge on its singleton path", () => {
  const r = routeWrite("reminder", { text: "Ring the school", when: "15:00" }, "a");
  assert.equal(r.op, "merge"); assert.equal(r.path, "users/a/meta/reminders");
  assert.deepEqual(r.data, { text: "Ring the school", when: "15:00" });
});
t("router (F18): an emergency contact is a document merge on its singleton path", () => {
  const r = routeWrite("emergency", { name: "Gran", phone: "0400 000 000" }, "a");
  assert.equal(r.op, "merge"); assert.equal(r.path, "users/a/meta/emergency");
  assert.deepEqual(r.data, { name: "Gran", phone: "0400 000 000" });
});

// A stub SDK with the real one's reference discipline: a
// collection reference must carry an odd number of segments
// and a document reference an even number, or it throws.
function stubSdk(fixtures = {}) {
  const store = new Map(Object.entries(fixtures.store || {}));
  const batchLog = [];
  let autoN = 0;
  class StubTimestamp { constructor(date) { this.date = date; } static fromDate(date) { return new StubTimestamp(date); } }
  const count = (p) => p.split("/").length;
  const fs = {
    Timestamp: StubTimestamp,
    doc: (db, ...segs) => {
      // The SDK also mints a document reference straight from
      // a collection reference (the batch report + restore
      // shapes ride it); the stub mirrors that with a made id.
      if (db && typeof db === "object" && typeof db.path === "string" && segs.length === 0) return { path: db.path + "/autoDoc" + (autoN += 1) };
      const p = segs.join("/");
      if (count(p) % 2 !== 0) throw new Error(`Invalid document reference. Document references must have an even number of segments, but ${p} has ${count(p)}.`);
      return { path: p };
    },
    collection: (db, ...segs) => {
      const p = segs.join("/");
      if (count(p) % 2 !== 1) throw new Error(`Invalid collection reference. Collection references must have an odd number of segments, but ${p} has ${count(p)}.`);
      return { path: p };
    },
    setDoc: async (ref, data, opts) => { store.set(ref.path, opts && opts.merge ? { ...(store.get(ref.path) || {}), ...data } : data); },
    updateDoc: async (ref, data) => { store.set(ref.path, { ...(store.get(ref.path) || {}), ...data }); },
    addDoc: async (col, data) => { const id = "auto" + (store.size + 1) + "x"; store.set(col.path + "/" + id, data); return { id }; },
    deleteDoc: async (ref) => { store.delete(ref.path); },
    writeBatch: () => {
      const ops = [];
      return {
        set: (ref, data, opts) => { batchLog.push({ op: "set", path: ref.path, data, opts }); ops.push(() => store.set(ref.path, opts && opts.merge ? { ...(store.get(ref.path) || {}), ...data } : data)); },
        update: (ref, data) => { batchLog.push({ op: "update", path: ref.path, data }); ops.push(() => store.set(ref.path, { ...(store.get(ref.path) || {}), ...data })); },
        delete: (ref) => { batchLog.push({ op: "delete", path: ref.path }); ops.push(() => store.delete(ref.path)); },
        commit: async () => { for (const op of ops) op(); },
      };
    },
    increment: (m) => ({ __increment: m }),
    getDoc: async (ref) => ({ exists: () => store.has(ref.path), data: () => store.get(ref.path) }),
    where: (field, op, value) => ({ field, op, value }),
    query: (col, constraint) => ({ path: col.path, constraint }),
    getDocs: async (q) => {
      const rows = fixtures[q.path] || [];
      const c = q.constraint;
      const hit = rows.filter((d) => {
        if (!c) return true;
        if (c.op === "array-contains") return Array.isArray(d.data[c.field]) && d.data[c.field].includes(c.value);
        return d.data[c.field] === c.value;
      });
      return { docs: hit.map((d) => ({ id: d.id, data: () => d.data })) };
    },
  };
  return { fs, store, StubTimestamp, batchLog };
}

await ta("F18 regression: the old add shape throws Invalid collection reference on the reminder path; the routed write lands as a document", async () => {
  const { fs, store } = stubSdk();
  assert.throws(() => fs.collection(null, "users", "u1", "meta", "reminders"), /Invalid collection reference/);
  const write = makeWriter(fs, null, "u1");
  const res = await write("reminder", { text: "Ring the school", when: "15:00" });
  assert.equal(res.ok, true);
  assert.deepEqual(store.get("users/u1/meta/reminders"), { text: "Ring the school", when: "15:00" });
});
await ta("F18 regression: the routed emergency write lands as a document on its singleton path", async () => {
  const { fs, store } = stubSdk();
  const write = makeWriter(fs, null, "u1");
  const res = await write("emergency", { name: "Gran", phone: "0400 000 000" });
  assert.equal(res.ok, true);
  assert.deepEqual(store.get("users/u1/meta/emergency"), { name: "Gran", phone: "0400 000 000" });
});

// ---- F20: the timestamp conversion pin (Security c9ef7b17) ----
class FakeTs { constructor(iso) { this.iso = iso; } }
const toTs = (iso) => new FakeTs(iso);
t("F20 pin: invite-create createdAt converts to a timestamp; the rest of the payload stands", () => {
  const data = { familyUid: "a", label: "", createdAt: "2026-10-18T00:00:00.000Z", usedBy: null };
  const out = writeDataFor("invite-create", data, toTs);
  assert.ok(out.createdAt instanceof FakeTs);
  assert.equal(out.createdAt.iso, "2026-10-18T00:00:00.000Z");
  assert.equal(out.familyUid, "a"); assert.equal(out.label, ""); assert.strictEqual(out.usedBy, null);
});
t("F20 pin: shopping updatedAt converts to a timestamp; items and updatedBy stand", () => {
  const items = [{ text: "Milk", by: "a", done: false }];
  const out = writeDataFor("shopping", { items, updatedAt: "2026-10-18T00:00:00.000Z", updatedBy: "a" }, toTs);
  assert.ok(out.updatedAt instanceof FakeTs);
  assert.strictEqual(out.items, items); assert.equal(out.updatedBy, "a");
});
t("F20 pin: every other kind passes through by reference, its shape unmoved", () => {
  const iso = "2026-10-18T00:00:00.000Z";
  for (const [kind, data] of [
    ["job", { familyUid: "a", createdAt: iso, state: "open" }],
    ["contact", { members: ["a", "b"], createdAt: iso }],
    ["dayStory", { day: "2026-10-18", at: iso }],
    ["message", { pairId: "p", at: iso }],
    ["request", { kind: "extra", createdAt: iso }],
    ["device", { token: "t", updatedAt: iso }],
    ["gallery", { card: { gallery: [] } }],
  ]) assert.strictEqual(writeDataFor(kind, data, toTs), data, kind);
});
t("F20 pin: a value that is not an ISO string is left exactly as it stands", () => {
  const data = { familyUid: "a", createdAt: new FakeTs("already") };
  assert.strictEqual(writeDataFor("invite-create", data, toTs), data);
});
await ta("F20: the writer lands an invite carrying a real Timestamp; a job's createdAt stays the string it was", async () => {
  const { fs, store, StubTimestamp } = stubSdk();
  const write = makeWriter(fs, null, "u1");
  const iso = "2026-10-18T01:02:03.000Z";
  const r1 = await write("invite-create", { path: "invites/K7P2Q9AB", data: { familyUid: "u1", label: "", createdAt: iso, usedBy: null } });
  assert.equal(r1.ok, true);
  const doc = store.get("invites/K7P2Q9AB");
  assert.ok(doc.createdAt instanceof StubTimestamp);
  assert.equal(doc.createdAt.date.getTime(), new Date(iso).getTime());
  assert.equal(doc.familyUid, "u1"); assert.strictEqual(doc.usedBy, null);
  const r2 = await write("job", { data: { familyUid: "u1", when: "Today", dayParts: [], postcode: "2021", bands: [], note: "", state: "open", createdAt: iso } });
  assert.equal(r2.ok, true);
  const job = [...store.entries()].find(([p]) => p.startsWith("jobs/"));
  assert.strictEqual(job[1].createdAt, iso);
});
await ta("F20: the writer lands a shopping save carrying a real Timestamp for updatedAt", async () => {
  const { fs, store, StubTimestamp } = stubSdk();
  const write = makeWriter(fs, null, "u1");
  const iso = "2026-10-18T01:02:03.000Z";
  const res = await write("shopping", { path: "relationships/a_b/lists/shoppingList", data: { items: [], updatedAt: iso, updatedBy: "u1" } });
  assert.equal(res.ok, true);
  const doc = store.get("relationships/a_b/lists/shoppingList");
  assert.ok(doc.updatedAt instanceof StubTimestamp);
  assert.equal(doc.updatedAt.date.getTime(), new Date(iso).getTime());
  assert.deepEqual(doc.items, []); assert.equal(doc.updatedBy, "u1");
});

// ---- F22: the safety counters land as merge sets, one
// field per document ----
// (Security ruling 46d6b466: an update can never create the
// counter doc, so the first filing would always fail; the
// merge set is judged by the create arm first, then the
// update arm. Ruling 2c267c79: filed and open each live in
// their own document, one transform per write.)
await ta("F22: the report pair's counters land as merge sets, one per split doc, each carrying exactly its own increment", async () => {
  const { fs, store, batchLog } = stubSdk();
  const write = makeWriter(fs, null, "u1");
  const res = await write("report", { data: { reporterUid: "u1", reportedUid: "u2", surface: "profile", category: "spam_scam", state: "open" }, counter: { delta: { filed: 1, open: 1 } } });
  assert.equal(res.ok, true);
  const filedDoc = batchLog.find((b) => b.path === "_owner/aggregates/safetyFiled/main");
  assert.equal(filedDoc.op, "set");
  assert.deepEqual(filedDoc.opts, { merge: true });
  assert.deepEqual(filedDoc.data, { filed: { __increment: 1 } });
  const openDoc = batchLog.find((b) => b.path === "_owner/aggregates/safetyOpen/main");
  assert.equal(openDoc.op, "set");
  assert.deepEqual(openDoc.opts, { merge: true });
  assert.deepEqual(openDoc.data, { open: { __increment: 1 } });
  assert.ok(!batchLog.some((b) => b.path === "_owner/aggregates/safety/main"), "the retired shared safety counter is never written");
  const filed = [...store.entries()].find(([p]) => p.startsWith("safetyReports/"));
  assert.equal(filed[1].category, "spam_scam");
  assert.equal(filed[1].state, "open");
});

// ---- F19: the live Phase C assembly ----
t("phase C names (F19): a family needs the other side of each pair only, never the board's posters", () => {
  const rels = [{ members: ["f1", "c1"] }, { members: ["f1", "c2"] }];
  assert.deepEqual(phaseCNameTargets("f1", "family", rels, [{ familyUid: "f9" }]).sort(), ["c1", "c2"]);
});
t("phase C names (F19): a carer also needs the families who posted the board jobs, never herself", () => {
  const rels = [{ members: ["c9", "f1"] }];
  const jobs = [{ familyUid: "f1" }, { familyUid: "f2" }, { familyUid: "c9" }];
  assert.deepEqual(phaseCNameTargets("c9", "carer", rels, jobs).sort(), ["f1", "f2"]);
});
t("phase C seam (F19): the shape is viewer, pairs, jobs and names, empty by default", () => {
  assert.deepEqual(phaseCSeam({ uid: "f1", side: "family" }), { viewer: { uid: "f1", side: "family" }, rels: [], jobs: [], names: {} });
});
await ta("phase C fetch (F19): pairs, the open board plus own jobs merged by id, and the pair names assemble", async () => {
  const { fs } = stubSdk({
    store: { "profiles/c1": { displayName: "Ana" }, "profiles/f9": { displayName: "Faye" } },
    relationships: [{ id: "c1_f1", data: { members: ["c1", "f1"], familyUid: "f1", carerUid: "c1", state: "contact", createdBy: "f1" } }],
    jobs: [
      { id: "j1", data: { familyUid: "f9", state: "open", postcode: "2021" } },
      { id: "j2", data: { familyUid: "f1", state: "open", postcode: "2000" } },
      { id: "j3", data: { familyUid: "f1", state: "closed", postcode: "2000" } },
    ],
  });
  const seam = await fetchPhaseC(fs, null, "f1", "family");
  assert.deepEqual(seam.viewer, { uid: "f1", side: "family" });
  assert.equal(seam.rels.length, 1); assert.equal(seam.rels[0].id, "c1_f1");
  assert.deepEqual(seam.jobs.map((j) => j.id).sort(), ["j1", "j2", "j3"]);
  assert.deepEqual(seam.names, { c1: "Ana" });
});
await ta("phase C fetch (F19): a carer reads the posting families' names from their cards", async () => {
  const { fs } = stubSdk({
    store: { "profiles/f9": { displayName: "Faye" }, "profiles/f1": { displayName: "Fay" } },
    relationships: [{ id: "c9_f1", data: { members: ["c9", "f1"], familyUid: "f1", carerUid: "c9", state: "pending", createdBy: "f1" } }],
    jobs: [{ id: "j1", data: { familyUid: "f9", state: "open", postcode: "2021" } }],
  });
  const seam = await fetchPhaseC(fs, null, "c9", "carer");
  assert.deepEqual(seam.names, { f1: "Fay", f9: "Faye" });
  assert.equal(seam.jobs.length, 1);
  assert.equal(seam.rels.length, 1);
});
await ta("phase C fetch (F19): a member with nothing yet gets the empty seam, so the empty states stand", async () => {
  const { fs } = stubSdk();
  const seam = await fetchPhaseC(fs, null, "u9", "family");
  assert.deepEqual(seam, { viewer: { uid: "u9", side: "family" }, rels: [], jobs: [], names: {} });
});

t("router: the resume file record names the temp object on the profile doc", () => { const r = routeWrite("resume-file", { name: "cv.pdf" }, "a"); assert.equal(r.op, "merge"); assert.equal(r.path, "profiles/a"); assert.deepEqual(r.data, { resumeFile: "cv.pdf" }); });
t("router: clearing the resume record writes an empty name, and a non string name never lands", () => { assert.deepEqual(routeWrite("resume-file", { name: "" }, "a").data, { resumeFile: "" }); assert.deepEqual(routeWrite("resume-file", { name: 42 }, "a").data, { resumeFile: "" }); });

console.log(`\nALL ${n} live-router checks passed`);
