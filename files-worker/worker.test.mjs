import test from "node:test"; import assert from "node:assert/strict";
import worker from "./worker.mjs";
const b64u = (b) => Buffer.from(b).toString("base64url");
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "k1", alg: "RS256", use: "sig" };
async function token(uid, over = {}) {
  const h = b64u(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" })); const s = Math.floor(Date.now() / 1000);
  const p = b64u(JSON.stringify({ iss: "https://securetoken.google.com/caresits-812a0", aud: "caresits-812a0", sub: uid, iat: s - 5, exp: s + 3000, ...over }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${h}.${p}`)); return `${h}.${p}.${b64u(sig)}`;
}
const store = new Map();
const BUCKET = { head: async (k) => (store.has(k) ? {} : null), get: async (k) => (store.has(k) ? { body: store.get(k), httpMetadata: { contentType: "image/jpeg" } } : null), put: async (k, v) => { store.set(k, v); } };
const env = { BUCKET, SIGNING_SECRET: "test-secret" };
const members = new Set(["sp1:alice"]);
const fetcher = async (u, init) => {
  if (String(u).includes("jwk")) return new Response(JSON.stringify({ keys: [jwk] }));
  const m = /careSpaces\/(\w+)\/members\/(\w+)/.exec(String(u)); return new Response("{}", { status: members.has(`${m[1]}:${m[2]}`) ? 200 : 403 });
};
const call = (method, path, body, tok, raw) => worker.fetch(new Request(`https://f.test${path}`, { method, headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), "content-type": "application/json" }, body: raw ?? (body ? JSON.stringify(body) : undefined) }), env, null, fetcher);
const jpg = (extra = []) => new Uint8Array([0xff, 0xd8, ...extra, 0xff, 0xda, 0, 2, 0xff, 0xd9]);
const putBody = { op: "put", class: "user-media", name: "avatar-abc123.jpg", ownerUid: "alice", bytes: jpg().length, contentType: "image/jpeg" };

test("no token, forged token, wrong project: refused", async () => {
  assert.equal((await call("POST", "/v1/link", putBody)).status, 401);
  const t = await token("alice"); assert.equal((await call("POST", "/v1/link", putBody, t.slice(0, -4) + "AAAA")).status, 401);
  assert.equal((await call("POST", "/v1/link", putBody, await token("alice", { aud: "other" }))).status, 401);
  assert.equal((await call("POST", "/v1/link", putBody, await token("alice", { exp: 1 }))).status, 401);
});
test("upload round trip: link, put, confirm, read link, bytes", async () => {
  const t = await token("alice"); const l = await (await call("POST", "/v1/link", putBody, t)).json();
  assert.equal(l.expiresIn, 300); assert.equal(l.key, "users/alice/photos/avatar-abc123.jpg");
  const u = new URL(l.url); const put = await call("PUT", u.pathname + u.search, null, null, jpg()); assert.equal(put.status, 200);
  assert.equal((await (await call("POST", "/v1/confirm", putBody, t)).json()).ok, true);
  const g = await (await call("POST", "/v1/link", { op: "get", key: l.key, ownerUid: "alice" }, t)).json(); const gu = new URL(g.url);
  const got = await call("GET", gu.pathname + gu.search); assert.equal(got.status, 200); assert.equal(got.headers.get("cache-control"), "private, no-store");
});
test("cannot upload as someone else, or with a bad name", async () => {
  const t = await token("mallory");
  assert.equal((await call("POST", "/v1/link", putBody, t)).status, 403);
  assert.equal((await call("POST", "/v1/link", { ...putBody, ownerUid: "mallory", name: "../../x.jpg" }, t)).status, 400);
});
test("size and content rules", async () => {
  const t = await token("alice");
  assert.equal((await call("POST", "/v1/link", { ...putBody, bytes: 9e6 }, t)).status, 413);
  const l = await (await call("POST", "/v1/link", putBody, t)).json(); const u = new URL(l.url);
  assert.equal((await call("PUT", u.pathname + u.search, null, null, new Uint8Array([1, 2, 3]))).status, 413);
  const exifJpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 8, 0x45, 0x78, 0x69, 0x66, 0, 0, 0xff, 0xda, 0, 2]);
  const l2 = await (await call("POST", "/v1/link", { ...putBody, bytes: exifJpg.length }, t)).json(); const u2 = new URL(l2.url);
  assert.equal((await call("PUT", u2.pathname + u2.search, null, null, exifJpg)).status, 422);
  assert.equal((await call("PUT", u.pathname + u.search.replace(/sig=.{5}/, "sig=AAAAA"), null, null, jpg())).status, 403);
});
test("privacy: children and documents only for the owner; profile photos for signed-in users", async () => {
  store.set("users/alice/children/child-x1.jpg", new Uint8Array([1])); store.set("users/alice/photos/avatar-abc123.jpg", new Uint8Array([1])); store.set("users/alice/documents/qual-d1.pdf", new Uint8Array([1]));
  const bob = await token("bob"), alice = await token("alice");
  const get = (k, tok) => call("POST", "/v1/link", { op: "get", key: k, ownerUid: "x" }, tok);
  assert.equal((await get("users/alice/children/child-x1.jpg", bob)).status, 403);
  assert.equal((await get("users/alice/documents/qual-d1.pdf", bob)).status, 403);
  assert.equal((await get("users/alice/photos/avatar-abc123.jpg", bob)).status, 200);
  assert.equal((await get("users/alice/children/child-x1.jpg", alice)).status, 200);
});
test("care space files: members only, checked against Firestore", async () => {
  const body = { op: "put", class: "space-media", name: "photo-s1.jpg", ownerUid: "alice", spaceId: "sp1", bytes: jpg().length, contentType: "image/jpeg" };
  assert.equal((await call("POST", "/v1/link", body, await token("alice"))).status, 200);
  assert.equal((await call("POST", "/v1/link", { ...body, ownerUid: "bob" }, await token("bob"))).status, 403);
  store.set("spaces/sp1/gallery/photo-s1.jpg", new Uint8Array([1]));
  assert.equal((await call("POST", "/v1/link", { op: "get", key: "spaces/sp1/gallery/photo-s1.jpg" }, await token("bob"))).status, 403);
  assert.equal((await call("POST", "/v1/link", { op: "get", key: "spaces/sp1/gallery/photo-s1.jpg" }, await token("alice"))).status, 200);
});
