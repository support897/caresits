// Caresitters files gatekeeper shell — fake-dep legs
// over a real loopback HTTP server. The bucket, the
// token verifier and Firestore are stubs; the core
// (gatekeeper.mjs) is the real one.
// Run: node server-tests.mjs
import assert from "node:assert/strict";
import { serve } from "./server.mjs";

let n = 0, bad = 0;
async function t(name, fn) { n++; try { await fn(); } catch (e) { bad++; console.log("FAIL:", name, "-", String(e && e.message).split("\n")[0]); } }

const FAM = "fam1000000000000000000000001";
const CAR = "car1000000000000000000000001";
const CAR2 = "car2000000000000000000000002";
const PAIR = "pairA00001";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const objects = new Map(); // key -> { size, head }
const issued = new Map();
const confirmed = [];
const profiles = {
  [FAM]: { side: "family", photoUrl: "" },
  [CAR]: { side: "carer", photoUrl: `${CAR}/profile-photos/photo.jpg`, card: { gallery: [] }, certificates: [`${CAR}/certificates/check.pdf`] },
  [CAR2]: { side: "carer", photoUrl: "" },
};
const pairs = { [PAIR]: { familyUid: FAM, carerUid: CAR, state: "hired" } };
const deps = {
  verifyToken: async (tok) => (tok.startsWith("tok-") ? { uid: tok.slice(4) } : null),
  readProfile: async (uid) => profiles[uid] || null,
  readPair: async (id) => pairs[id] || null,
  slotNamesKey: (doc, key) => JSON.stringify(doc).includes(key),
  s3Head: async (key) => objects.get(key) || null,
  s3HeadBytes: async (key) => objects.get(key).head,
  s3Delete: async (key) => { objects.delete(key); },
  creds: { accountId: "acct123", bucket: "bkt", accessKeyId: "AKID", secretAccessKey: "SECRET" },
  ledger: {
    noteIssued: (key) => issued.set(key, Date.now()),
    issuedAt: (key) => issued.get(key) || null,
    markConfirmed: (key) => confirmed.push(key),
  },
  budgetTake: () => true,
  log: () => {},
};
const server = await serve(deps, 0);
const base = `http://127.0.0.1:${server.address().port}`;
const post = (path, body, uid) => fetch(base + path, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(uid ? { Authorization: `Bearer tok-${uid}` } : {}) },
  body: JSON.stringify(body),
});

await t("no token is a plain 401", async () => {
  assert.equal((await post("/v1/link", { op: "get", class: "profile-photos", name: "photo.jpg" })).status, 401);
});
await t("an owner PUT door is header-signed and noted in the ledger", async () => {
  const r = await post("/v1/link", { op: "put", class: "profile-photos", name: "photo.jpg", bytes: 1200 }, CAR);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.url.includes(`${CAR}/profile-photos/photo.jpg`));
  assert.equal(j.headers["Content-Length"], "1200");
  assert.equal(j.headers["Content-Type"], "image/jpeg");
  assert.ok(issued.has(`${CAR}/profile-photos/photo.jpg`));
});
await t("a PUT for another user's key is refused", async () => {
  const r = await post("/v1/link", { op: "put", class: "profile-photos", name: "photo.jpg", bytes: 10, ownerUid: CAR2 }, CAR);
  assert.equal(r.status, 403);
});
await t("a GET for an unreferenced key is refused even for its owner (Q6 iii)", async () => {
  const r = await post("/v1/link", { op: "get", class: "profile-photos", name: "photo.jpg", ownerUid: CAR2 }, CAR2);
  assert.equal(r.status, 403);
});
await t("a GET for a referenced profile photo opens to any signed-in member", async () => {
  const r = await post("/v1/link", { op: "get", class: "profile-photos", name: "photo.jpg", ownerUid: CAR }, FAM);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.url.includes("response-cache-control"));
});
await t("a certificate GET by a family outside the pair is refused; inside, it opens", async () => {
  const out = await post("/v1/link", { op: "get", class: "certificates", name: "check.pdf", ownerUid: CAR }, FAM);
  assert.equal(out.status, 403);
  const inside = await post("/v1/link", { op: "get", class: "certificates", name: "check.pdf", ownerUid: CAR, pairId: PAIR }, FAM);
  assert.equal(inside.status, 200);
});
await t("day story: a member writes; a stranger is refused; the carer cannot delete; the family can (Q2)", async () => {
  const w = await post("/v1/link", { op: "put", class: "day-story", name: "2026-10-19-1.jpg", bytes: 900, pairId: PAIR }, CAR);
  assert.equal(w.status, 200);
  const s = await post("/v1/link", { op: "put", class: "day-story", name: "2026-10-19-1.jpg", bytes: 900, pairId: PAIR }, CAR2);
  assert.equal(s.status, 403);
  const cd = await post("/v1/link", { op: "del", class: "day-story", name: "2026-10-19-1.jpg", pairId: PAIR }, CAR);
  assert.equal(cd.status, 403);
  const fd = await post("/v1/link", { op: "del", class: "day-story", name: "2026-10-19-1.jpg", pairId: PAIR }, FAM);
  assert.equal(fd.status, 200);
});
await t("confirm: a good object passes and is marked; the ledger entry is the proof", async () => {
  objects.set(`${CAR}/profile-photos/photo.jpg`, { size: 1200, head: JPEG });
  const r = await post("/v1/confirm", { class: "profile-photos", name: "photo.jpg" }, CAR);
  assert.equal(r.status, 200);
  assert.deepEqual(confirmed, [`${CAR}/profile-photos/photo.jpg`]);
});
await t("confirm: a wrong-magic object is deleted at once and refused", async () => {
  await post("/v1/link", { op: "put", class: "profile-photos", name: "extra-1.jpg", bytes: 10 }, CAR);
  objects.set(`${CAR}/profile-photos/extra-1.jpg`, { size: 10, head: Buffer.from("%PDF-1.4") });
  const r = await post("/v1/confirm", { class: "profile-photos", name: "extra-1.jpg" }, CAR);
  assert.equal(r.status, 422);
  assert.equal(objects.has(`${CAR}/profile-photos/extra-1.jpg`), false);
});
await t("confirm without a live issuance is a 409", async () => {
  objects.set(`${CAR2}/profile-photos/photo.jpg`, { size: 10, head: JPEG });
  const r = await post("/v1/confirm", { class: "profile-photos", name: "photo.jpg" }, CAR2);
  assert.equal(r.status, 409);
});
await t("an oversize PUT declaration is refused at issuance", async () => {
  const r = await post("/v1/link", { op: "put", class: "profile-photos", name: "photo.jpg", bytes: 6 * 1024 * 1024 }, CAR);
  assert.equal(r.status, 400);
});
await t("unknown doors are 404", async () => {
  assert.equal((await fetch(base + "/v1/list")).status, 404);
});

server.close();
console.log(`\n${n - bad}/${n} gatekeeper shell legs pass`);
if (bad) process.exit(1);
console.log("ALL GATEKEEPER SHELL CHECKS PASS");
