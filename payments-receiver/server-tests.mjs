// Caresitters payments receiver shell — fake-dep legs
// over a real loopback HTTP server.
// Run: node server-tests.mjs
import assert from "node:assert/strict";
import { serve } from "./server.mjs";

let n = 0, bad = 0;
async function t(name, fn) { n++; try { await fn(); } catch (e) { bad++; console.log("FAIL:", name, "-", String(e && e.message).split("\n")[0]); } }

const writes = [];
const ledger = new Set();
const logs = [];
const deps = {
  expectedAuth: () => "Bearer test-auth-value",
  seenEvent: async (id) => ledger.has(id),
  writeRecord: async (uid, record) => { writes.push([uid, record]); },
  markEvent: async (id) => { ledger.add(id); },
  log: (line) => logs.push(line),
};
const server = await serve(deps, 0);
const base = `http://127.0.0.1:${server.address().port}`;
const evt = {
  api_version: "1.0",
  event: {
    id: "evt-shell-1", type: "INITIAL_PURCHASE", app_user_id: "uid-9",
    product_id: "caresitters_finding_monthly", entitlement_ids: ["finding"],
    period_type: "NORMAL", purchased_at_ms: 1000, expiration_at_ms: 2000,
    event_timestamp_ms: 1500, store: "APP_STORE", environment: "SANDBOX",
  },
};
const post = (path, body, auth) => fetch(base + path, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

await t("a well-formed authorized purchase writes the record and the ledger", async () => {
  const r = await post("/rc", evt, "Bearer test-auth-value");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.wrote, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "uid-9");
  assert.equal(writes[0][1].entitlement, "finding");
  assert.ok(ledger.has("evt-shell-1"));
});
await t("a redelivery of the same event writes nothing twice (idempotency)", async () => {
  const r = await post("/rc", evt, "Bearer test-auth-value");
  const j = await r.json();
  assert.equal(j.duplicate, true);
  assert.equal(writes.length, 1);
});
await t("a wrong authorization is a 401, writes nothing, and is logged (charter)", async () => {
  const r = await post("/rc", { ...evt, event: { ...evt.event, id: "evt-shell-2" } }, "Bearer nope");
  assert.equal(r.status, 401);
  assert.equal(writes.length, 1);
  assert.equal(logs.length, 1);
  assert.ok(logs[0].startsWith("401 unauthenticated attempt"));
});
await t("a TEST ping is acknowledged and writes nothing", async () => {
  const r = await post("/rc", { event: { id: "evt-t", type: "TEST", app_user_id: "uid-9" } }, "Bearer test-auth-value");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).wrote, false);
  assert.equal(writes.length, 1);
});
await t("bad json is a 400; the wrong path is a 404", async () => {
  assert.equal((await post("/rc", "{nope", "Bearer test-auth-value")).status, 400);
  assert.equal((await post("/other", evt, "Bearer test-auth-value")).status, 404);
});

server.close();
console.log(`\n${n - bad}/${n} receiver shell legs pass`);
if (bad) process.exit(1);
console.log("ALL RECEIVER SHELL CHECKS PASS");
