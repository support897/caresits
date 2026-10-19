// Caresitters files gatekeeper: synthetic tests for the
// pure core. Plain Node asserts, no network, no bucket:
// the battery against the real bucket runs after R1, on
// PB's creation, in the same leg shapes.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { planUserKey, planPairKey, planTrashKey, authorise, verifyIdToken, presign, presignPutRequest, confirmCheck, makeBudget, TTL } from "./gatekeeper.mjs";

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log("ok -", name); };
const U = "userA1234567890";
const V = "userB1234567890";

// key planning
t("photo keys: main + gallery slots only", () => {
  assert.equal(planUserKey({ uid: U, cls: "profile-photos", name: "photo.jpg" }), `${U}/profile-photos/photo.jpg`);
  assert.equal(planUserKey({ uid: U, cls: "profile-photos", name: "extra-4.jpg" }), `${U}/profile-photos/extra-4.jpg`);
  assert.equal(planUserKey({ uid: U, cls: "profile-photos", name: "extra-5.jpg" }), null);
  assert.equal(planUserKey({ uid: U, cls: "profile-photos", name: "../photo.jpg" }), null);
});
t("certificate keys: pdf only, name sanitised", () => {
  assert.equal(planUserKey({ uid: U, cls: "certificates", name: "first aid.pdf" }), `${U}/certificates/first_aid.pdf`);
  assert.equal(planUserKey({ uid: U, cls: "certificates", name: "check.jpg" }), null);
  assert.equal(planUserKey({ uid: "", cls: "certificates", name: "x.pdf" }), null);
});
t("day story keys live under pairs/<pairId>/day-story/ (A5 as folded in)", () => {
  assert.equal(planPairKey({ pairId: "pair-12345678", name: "day one.jpg" }), "pairs/pair-12345678/day-story/day_one.jpg");
  assert.equal(planPairKey({ pairId: "pair-12345678", name: "doc.pdf" }), null);
});
t("trash keys wrap an original, never nest (the bin window rides them)", () => {
  assert.equal(planTrashKey({ uid: U, key: `${U}/profile-photos/photo.jpg` }), `trash/${U}/${U}/profile-photos/photo.jpg`);
  assert.equal(planTrashKey({ uid: U, key: "trash/x" }), null);
});
t("there is no resume shape anywhere in the planners", () => {
  assert.equal(planUserKey({ uid: U, cls: "resumes", name: "cv.pdf" }), null);
  assert.equal(planPairKey({ pairId: "pair-12345678", name: "cv.pdf" }), null);
});

// the matrix
const mine = { uid: U, keyUid: U, pair: null, side: "carer", referenced: true };
t("owner: every verb on own profile + certificates", () => {
  for (const cls of ["profile-photos", "certificates"]) for (const op of ["put", "get", "del", "confirm"])
    assert.equal(authorise({ ...mine, cls, op, key: "k" }).ok, true, `${cls}/${op}`);
});
t("Q6 (iii): an unreferenced key reads for NOBODY, owner included", () => {
  assert.equal(authorise({ uid: U, keyUid: U, cls: "profile-photos", op: "get", key: "k", referenced: false }).reason, "unreferenced");
  assert.equal(authorise({ uid: V, keyUid: U, cls: "profile-photos", op: "get", key: "k", referenced: false, side: "family" }).ok, false);
  assert.equal(authorise({ uid: V, keyUid: U, cls: "certificates", op: "get", key: "k", referenced: true, side: "family", pair: { familyUid: V, carerUid: U, state: "hired" } }).ok, true);
});
t("another user: referenced photo read only (Find), never write or delete", () => {
  const other = { uid: V, keyUid: U, pair: null, side: "family", referenced: true };
  assert.equal(authorise({ ...other, cls: "profile-photos", op: "get", key: "k" }).ok, true);
  assert.equal(authorise({ ...other, cls: "profile-photos", op: "put", key: "k" }).ok, false);
  assert.equal(authorise({ ...other, cls: "profile-photos", op: "del", key: "k" }).ok, false);
});
t("certificates: a contact pair family reads; open pair and strangers do not", () => {
  const fam = { uid: V, keyUid: U, side: "family", referenced: true };
  assert.equal(authorise({ ...fam, cls: "certificates", op: "get", key: "k", pair: { familyUid: V, carerUid: U, state: "contact" } }).ok, true);
  assert.equal(authorise({ ...fam, cls: "certificates", op: "get", key: "k", pair: { familyUid: V, carerUid: U, state: "open" } }).ok, false);
  assert.equal(authorise({ ...fam, cls: "certificates", op: "get", key: "k", pair: null }).ok, false);
  assert.equal(authorise({ ...fam, cls: "certificates", op: "del", key: "k", pair: { familyUid: V, carerUid: U, state: "hired" } }).ok, false);
});
t("day story: members read + write; delete is the family side's alone (Q2)", () => {
  const pair = { familyUid: V, carerUid: U, state: "hired" };
  assert.equal(authorise({ uid: U, cls: "day-story", op: "put", key: "k", pair, side: "carer" }).ok, true);
  assert.equal(authorise({ uid: U, cls: "day-story", op: "get", key: "k", pair, side: "carer" }).ok, true);
  assert.equal(authorise({ uid: U, cls: "day-story", op: "del", key: "k", pair, side: "carer" }).ok, false);
  assert.equal(authorise({ uid: V, cls: "day-story", op: "del", key: "k", pair, side: "family" }).ok, true);
  assert.equal(authorise({ uid: "stranger123", cls: "day-story", op: "get", key: "k", pair, side: "family" }).ok, false);
});

// token verification with a local keypair standing in for Google's
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });
jwk.kid = "test-kid-1";
const JWKS = { keys: [jwk] };
const NOW = 1800000000000;
function mint(claims, { kid = "test-kid-1", key = privateKey } = {}) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg: "RS256", kid, typ: "JWT" });
  const body = enc(claims);
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(key).toString("base64url");
  return `${head}.${body}.${sig}`;
}
const goodClaims = { iss: "https://securetoken.google.com/caresits-812a0", aud: "caresits-812a0", sub: U, iat: NOW / 1000 - 60, exp: NOW / 1000 + 600, firebase: { sign_in_provider: "password" } };
const verify = (tok, over = {}) => verifyIdToken(tok, { jwks: JWKS, nowMs: NOW, projectId: "caresits-812a0", ...over });
t("token: a true token verifies and yields the uid", () => {
  const c = verify(mint(goodClaims));
  assert.equal(c && c.sub, U);
});
t("token: tamper, expiry, wrong audience, wrong key all refuse", () => {
  const good = mint(goodClaims);
  assert.equal(verify(good.slice(0, -2) + "xx"), null);
  assert.equal(verify(mint({ ...goodClaims, exp: NOW / 1000 - 5 })), null);
  assert.equal(verify(mint({ ...goodClaims, aud: "other-project" })), null);
  assert.equal(verify(mint(goodClaims, { kid: "unknown-kid" })), null);
  assert.equal(verify("not-a-jwt"), null);
});
t("token: anonymous sign-ins refuse (the sealed stance)", () => {
  assert.equal(verify(mint({ ...goodClaims, firebase: { sign_in_provider: "anonymous" } })), null);
});

// presigning
const SIGN = { accountId: "acct123", bucket: "caresitters-files", accessKeyId: "AKID", secretAccessKey: "secret", nowMs: NOW };
t("presign: PUT binds bucket, key, verb, expiry and the exact length (R3)", () => {
  const url = presign({ ...SIGN, method: "PUT", key: `${U}/profile-photos/photo.jpg`, expiresSec: TTL.put, contentLength: 12345 });
  assert.ok(url.startsWith(`https://acct123.r2.cloudflarestorage.com/caresitters-files/${U}/profile-photos/photo.jpg?`));
  assert.ok(url.includes("X-Amz-Expires=300"));
  assert.ok(url.includes("X-Amz-SignedHeaders=content-length%3Bhost"));
  assert.ok(url.includes("X-Amz-Signature="));
});
t("presign: a different declared length signs differently (length tamper breaks the signature)", () => {
  const a = presign({ ...SIGN, method: "PUT", key: "k.jpg", expiresSec: 300, contentLength: 100 });
  const b = presign({ ...SIGN, method: "PUT", key: "k.jpg", expiresSec: 300, contentLength: 101 });
  assert.notEqual(a.split("X-Amz-Signature=")[1], b.split("X-Amz-Signature=")[1]);
});
t("presign: GET carries the no-store override (A9); DELETE signs no length", () => {
  const g = presign({ ...SIGN, method: "GET", key: "k.jpg", expiresSec: TTL.get, responseOverrides: { cacheControl: "no-store", contentType: "image/jpeg" } });
  assert.ok(g.includes("response-cache-control=no-store"));
  assert.ok(g.includes("X-Amz-Expires=600"));
  const d = presign({ ...SIGN, method: "DELETE", key: "k.jpg", expiresSec: TTL.del });
  assert.ok(d.includes("X-Amz-SignedHeaders=host"));
  assert.ok(d.includes("X-Amz-Expires=300"));
});

t("PUT is header signed: length + type ride the signature, no query presign (Security's strengthening)", () => {
  const r = presignPutRequest({ ...SIGN, key: `${U}/profile-photos/photo.jpg`, contentLength: 12345, contentType: "image/jpeg" });
  assert.ok(r && r.url === `https://acct123.r2.cloudflarestorage.com/caresitters-files/${U}/profile-photos/photo.jpg`);
  assert.ok(!r.url.includes("?"), "the URL carries no query string");
  assert.ok(r.headers.Authorization.includes("SignedHeaders=content-length;content-type;host"));
  assert.equal(r.headers["Content-Length"], "12345");
  assert.equal(r.headers["Content-Type"], "image/jpeg");
  const tampered = presignPutRequest({ ...SIGN, key: `${U}/profile-photos/photo.jpg`, contentLength: 12346, contentType: "image/jpeg" });
  assert.notEqual(tampered.headers.Authorization, r.headers.Authorization);
  const wrongType = presignPutRequest({ ...SIGN, key: `${U}/profile-photos/photo.jpg`, contentLength: 12345, contentType: "application/pdf" });
  assert.notEqual(wrongType.headers.Authorization, r.headers.Authorization);
});

// confirm-time checks
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const PDF = Buffer.from("%PDF-1.4 xxxx");
t("confirm: size + magic decide (A3)", () => {
  assert.deepEqual(confirmCheck({ cls: "profile-photos", size: 1000, head: JPEG }), { ok: true });
  assert.equal(confirmCheck({ cls: "profile-photos", size: 1000, head: PDF }).ok, false);
  assert.equal(confirmCheck({ cls: "certificates", size: 1000, head: PDF }).ok, true);
  assert.equal(confirmCheck({ cls: "certificates", size: 1000, head: JPEG }).ok, false);
  assert.equal(confirmCheck({ cls: "profile-photos", size: 6 * 1024 * 1024, head: JPEG }).reason, "too-big");
  assert.equal(confirmCheck({ cls: "profile-photos", size: 0, head: JPEG }).reason, "missing");
});

// budget
t("budget: the ceiling holds inside the window and resets after it", () => {
  const b = makeBudget({ limit: 3, windowMs: 1000 });
  assert.equal(b.take(U, 0), true); assert.equal(b.take(U, 1), true); assert.equal(b.take(U, 2), true);
  assert.equal(b.take(U, 3), false);
  assert.equal(b.take(U, 2000), true);
  assert.equal(b.take(V, 3), true);
});

console.log(`\nALL ${n} gatekeeper checks passed`);
