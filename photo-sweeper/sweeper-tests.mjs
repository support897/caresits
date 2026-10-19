// Caresitters photo sweeper tests — plain Node asserts, no
// network, no Firebase. The executor legs run on fake deps
// that record their calls, so ordering and failure handling
// are proven, not described.
import assert from "node:assert/strict";
import { planSweep, runSweep, INACTIVE_MS, PHOTO_OBJECTS } from "./sweeper.mjs";

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log("ok -", name); };
const ta = async (name, fn) => { await fn(); n += 1; console.log("ok -", name); };

const NOW = 1800000000000;
const stale = { uid: "carer-1", side: "carer", photoUrl: "https://x/p.jpg", lastActiveAtMs: NOW - INACTIVE_MS - 1000 };
const edge = { ...stale, uid: "carer-edge", lastActiveAtMs: NOW - INACTIVE_MS };

t("planner: a stale carer with a photo is planned, with the exact object path", () => {
  const plan = planSweep([stale], NOW);
  assert.equal(plan.length, 1);
  assert.deepEqual(plan[0].deletePaths, ["profile-photos/carer-1/photo.jpg"]);
  assert.equal(plan[0].clearPhotoSlot, true);
});
t("planner: exactly 90 days old sweeps; one millisecond under does not", () => {
  assert.equal(planSweep([edge], NOW).length, 1);
  assert.equal(planSweep([{ ...edge, lastActiveAtMs: NOW - INACTIVE_MS + 1 }], NOW).length, 0);
});
t("planner: a recent carer is never planned", () => {
  assert.equal(planSweep([{ ...stale, lastActiveAtMs: NOW - 1000 }], NOW).length, 0);
});
t("planner: families are never planned, however stale", () => {
  assert.equal(planSweep([{ ...stale, side: "family" }], NOW).length, 0);
});
t("planner: no stored photo, nothing to sweep", () => {
  assert.equal(planSweep([{ ...stale, photoUrl: "" }], NOW).length, 0);
});
t("planner: an already swept account is never planned again", () => {
  assert.equal(planSweep([{ ...stale, photoClearedAtMs: NOW - 1000 }], NOW).length, 0);
});
t("planner: no trusted stamp, no sweep (never guessed)", () => {
  assert.equal(planSweep([{ ...stale, lastActiveAtMs: null }], NOW).length, 0);
  assert.equal(planSweep([{ ...stale, lastActiveAtMs: "long ago" }], NOW).length, 0);
});
t("planner: the object list names profile photos only (Day Story never in scope)", () => {
  assert.deepEqual(PHOTO_OBJECTS, ["photo.jpg"]);
});
t("planner: malformed input gives an empty plan, never a crash", () => {
  assert.deepEqual(planSweep(null, NOW), []);
  assert.deepEqual(planSweep([null, {}, { uid: 7 }], NOW), []);
  assert.deepEqual(planSweep([stale], NaN), []);
});

await ta("executor: the object is deleted BEFORE the slot clears, in one pass", async () => {
  const calls = [];
  const deps = {
    listAccounts: async () => [stale],
    deleteObject: async (p) => { calls.push(["delete", p]); },
    clearPhotoSlot: async (uid, at) => { calls.push(["clear", uid, at]); },
  };
  const s = await runSweep(deps, NOW);
  assert.deepEqual(calls, [["delete", "profile-photos/carer-1/photo.jpg"], ["clear", "carer-1", NOW]]);
  assert.deepEqual(s, { planned: 1, swept: ["carer-1"], failed: [] });
});
await ta("executor: a failed delete leaves the slot untouched and reports loudly", async () => {
  const calls = [];
  const deps = {
    listAccounts: async () => [stale],
    deleteObject: async () => { throw new Error("storage down"); },
    clearPhotoSlot: async (uid) => { calls.push(uid); },
  };
  const s = await runSweep(deps, NOW);
  assert.deepEqual(calls, []);
  assert.equal(s.planned, 1);
  assert.deepEqual(s.swept, []);
  assert.equal(s.failed.length, 1);
  assert.equal(s.failed[0].uid, "carer-1");
});
await ta("executor: one failure does not stop the next account", async () => {
  const deps = {
    listAccounts: async () => [stale, { ...stale, uid: "carer-2" }],
    deleteObject: async (p) => { if (p.includes("carer-1")) throw new Error("gone wrong"); },
    clearPhotoSlot: async () => {},
  };
  const s = await runSweep(deps, NOW);
  assert.deepEqual(s.swept, ["carer-2"]);
  assert.equal(s.failed.length, 1);
});
await ta("executor: nothing planned, nothing touched", async () => {
  let touched = false;
  const deps = {
    listAccounts: async () => [{ ...stale, lastActiveAtMs: NOW }],
    deleteObject: async () => { touched = true; },
    clearPhotoSlot: async () => { touched = true; },
  };
  const s = await runSweep(deps, NOW);
  assert.deepEqual(s, { planned: 0, swept: [], failed: [] });
  assert.equal(touched, false);
});

console.log(`\nALL ${n} sweeper checks passed`);
