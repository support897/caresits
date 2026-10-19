// Caresitters photo sweeper tests — plain Node asserts, no
// network, no Firebase. The executor legs run on fake deps
// that record their calls, so ordering and failure handling
// are proven, not described.
import assert from "node:assert/strict";
import { planSweep, runSweep, planWarn, runWarn, planPurge, runPurge, QUARANTINE_MS, INACTIVE_MS, WARN_AT_MS, WARN_BEFORE_MS, PHOTO_OBJECTS, WARN_COPY, ARM_LIVE_MS, DAY_MS } from "./sweeper.mjs";

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log("ok -", name); };
const ta = async (name, fn) => { await fn(); n += 1; console.log("ok -", name); };

const NOW = 1800000000000;
const stale = { uid: "carer-1", side: "carer", photoUrl: "https://x/p.jpg", lastActiveAtMs: NOW - INACTIVE_MS - 1000 };
const edge = { ...stale, uid: "carer-edge", lastActiveAtMs: NOW - INACTIVE_MS };

t("planner: a stale carer with a photo is planned, with the exact quarantine moves (main + gallery)", () => {
  const plan = planSweep([stale], NOW);
  assert.equal(plan.length, 1);
  assert.deepEqual(plan[0].movePaths, ["photo.jpg", "extra-1.jpg", "extra-2.jpg", "extra-3.jpg", "extra-4.jpg"].map((n) => ({ from: `profile-photos/carer-1/${n}`, to: `quarantine/profile-photos/carer-1/${n}` })));
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
t("planner: the object list is the profile images only (Day Story never in scope)", () => {
  assert.deepEqual(PHOTO_OBJECTS, ["photo.jpg", "extra-1.jpg", "extra-2.jpg", "extra-3.jpg", "extra-4.jpg"]);
});
t("planner: malformed input gives an empty plan, never a crash", () => {
  assert.deepEqual(planSweep(null, NOW), []);
  assert.deepEqual(planSweep([null, {}, { uid: 7 }], NOW), []);
  assert.deepEqual(planSweep([stale], NaN), []);
});

await ta("executor: the objects MOVE to quarantine BEFORE the slot clears, in one pass", async () => {
  const calls = [];
  const deps = {
    listAccounts: async () => [stale],
    moveToQuarantine: async (from, to) => { calls.push(["move", from, to]); },
    clearPhotoSlot: async (uid, at) => { calls.push(["clear", uid, at]); },
  };
  const s = await runSweep(deps, NOW);
  assert.deepEqual(calls, [["move", "profile-photos/carer-1/photo.jpg", "quarantine/profile-photos/carer-1/photo.jpg"], ["move", "profile-photos/carer-1/extra-1.jpg", "quarantine/profile-photos/carer-1/extra-1.jpg"], ["move", "profile-photos/carer-1/extra-2.jpg", "quarantine/profile-photos/carer-1/extra-2.jpg"], ["move", "profile-photos/carer-1/extra-3.jpg", "quarantine/profile-photos/carer-1/extra-3.jpg"], ["move", "profile-photos/carer-1/extra-4.jpg", "quarantine/profile-photos/carer-1/extra-4.jpg"], ["clear", "carer-1", NOW]]);
  assert.deepEqual(s, { planned: 1, swept: ["carer-1"], failed: [] });
});
await ta("executor: a failed move leaves the slot untouched and reports loudly", async () => {
  const calls = [];
  const deps = {
    listAccounts: async () => [stale],
    moveToQuarantine: async () => { throw new Error("storage down"); },
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
    moveToQuarantine: async (from) => { if (from.includes("carer-1")) throw new Error("gone wrong"); },
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
    moveToQuarantine: async () => { touched = true; },
    clearPhotoSlot: async () => { touched = true; },
  };
  const s = await runSweep(deps, NOW);
  assert.deepEqual(s, { planned: 0, swept: [], failed: [] });
  assert.equal(touched, false);
});
t("purge planner: quarantine purges at +7 days exactly, never before, never outside the prefix", () => {
  const q = { key: "quarantine/profile-photos/carer-1/photo.jpg", sinceMs: NOW - QUARANTINE_MS };
  assert.deepEqual(planPurge([q], NOW), [q.key]);
  assert.deepEqual(planPurge([{ ...q, sinceMs: NOW - QUARANTINE_MS + 1 }], NOW), []);
  assert.deepEqual(planPurge([{ ...q, key: "profile-photos/carer-1/photo.jpg" }], NOW), []);
  assert.deepEqual(planPurge([{ key: "quarantine/x", sinceMs: NaN }], NOW), []);
  assert.deepEqual(planPurge(null, NOW), []);
});
await ta("purge executor: aged entries hard delete; young ones rest; a failure reports and continues", async () => {
  const gone = [];
  const deps = {
    listQuarantine: async () => [
      { key: "quarantine/a", sinceMs: NOW - QUARANTINE_MS - 1 },
      { key: "quarantine/b", sinceMs: NOW - 1000 },
      { key: "quarantine/c", sinceMs: NOW - QUARANTINE_MS - 5 },
    ],
    hardDelete: async (k) => { if (k === "quarantine/c") throw new Error("stuck"); gone.push(k); },
  };
  const s = await runPurge(deps, NOW);
  assert.deepEqual(gone, ["quarantine/a"]);
  assert.deepEqual(s.purged, ["quarantine/a"]);
  assert.equal(s.failed.length, 1);
  assert.equal(s.failed[0].key, "quarantine/c");
});

const warnAge = { ...stale, uid: "carer-w", lastActiveAtMs: NOW - WARN_AT_MS - 1000 };
t("warn: a carer inside the warning window is planned, with her copy", () => {
  const plan = planWarn([warnAge], NOW);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].uid, "carer-w");
  assert.equal(plan[0].copy, WARN_COPY);
});
t("warn: exactly 83 days warns; one millisecond under does not; at 90 the sweep owns it", () => {
  assert.equal(planWarn([{ ...warnAge, lastActiveAtMs: NOW - WARN_AT_MS }], NOW).length, 1);
  assert.equal(planWarn([{ ...warnAge, lastActiveAtMs: NOW - WARN_AT_MS + 1 }], NOW).length, 0);
  assert.equal(planWarn([{ ...warnAge, lastActiveAtMs: NOW - INACTIVE_MS }], NOW).length, 0);
});
t("warn: already warned in this window is not warned again", () => {
  const a = { ...warnAge, photoWarnedAtMs: warnAge.lastActiveAtMs + 5000 };
  assert.equal(planWarn([a], NOW).length, 0);
});
t("warn: a warning from before the last activity does not count (a returned carer is warned again)", () => {
  const a = { ...warnAge, photoWarnedAtMs: warnAge.lastActiveAtMs - 5000 };
  assert.equal(planWarn([a], NOW).length, 1);
});
t("warn: families, swept carers and photoless carers are never warned", () => {
  assert.equal(planWarn([{ ...warnAge, side: "family" }], NOW).length, 0);
  assert.equal(planWarn([{ ...warnAge, photoClearedAtMs: NOW - 1 }], NOW).length, 0);
  assert.equal(planWarn([{ ...warnAge, photoUrl: "" }], NOW).length, 0);
});
await ta("warn executor: sends first, marks second", async () => {
  const calls = [];
  const deps = {
    listAccounts: async () => [warnAge],
    sendWarning: async (uid, copy) => { calls.push(["send", uid, copy.subject]); },
    markWarned: async (uid, at) => { calls.push(["mark", uid, at]); },
  };
  const s = await runWarn(deps, NOW);
  assert.deepEqual(calls, [["send", "carer-w", WARN_COPY.subject], ["mark", "carer-w", NOW]]);
  assert.deepEqual(s, { planned: 1, warned: ["carer-w"], failed: [] });
});
await ta("warn executor: a failed send is never marked and reports loudly", async () => {
  let marked = false;
  const deps = {
    listAccounts: async () => [warnAge],
    sendWarning: async () => { throw new Error("mail down"); },
    markWarned: async () => { marked = true; },
  };
  const s = await runWarn(deps, NOW);
  assert.equal(marked, false);
  assert.equal(s.failed.length, 1);
  assert.deepEqual(s.warned, []);
});

const noStamp = { uid: "carer-ns", side: "carer", photoUrl: "https://x/p.jpg", lastActiveAtMs: null };
t("never-stamped: before arm+90 days the class is not eligible at all", () => {
  const warnedLongAgo = { ...noStamp, photoWarnedAtMs: ARM_LIVE_MS + 10 * DAY_MS };
  assert.equal(planSweep([warnedLongAgo], ARM_LIVE_MS + 89 * DAY_MS).length, 0);
});
t("never-stamped: arm+90 and a warning 7+ days old, unrescued, sweeps", () => {
  const a = { ...noStamp, photoWarnedAtMs: ARM_LIVE_MS + 83 * DAY_MS };
  const plan = planSweep([a], ARM_LIVE_MS + 90 * DAY_MS);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].uid, "carer-ns");
});
t("never-stamped: a warning younger than 7 days does not sweep yet", () => {
  const a = { ...noStamp, photoWarnedAtMs: ARM_LIVE_MS + 87 * DAY_MS };
  assert.equal(planSweep([a], ARM_LIVE_MS + 90 * DAY_MS).length, 0);
});
t("never-stamped: never warned, never swept (the warning is a condition, not a courtesy)", () => {
  assert.equal(planSweep([noStamp], ARM_LIVE_MS + 120 * DAY_MS).length, 0);
});
t("never-stamped: a rescue (an open stamps them) moves them to the stamped class with a fresh clock", () => {
  const a = { ...noStamp, photoWarnedAtMs: ARM_LIVE_MS + 83 * DAY_MS, lastActiveAtMs: ARM_LIVE_MS + 89 * DAY_MS };
  assert.equal(planSweep([a], ARM_LIVE_MS + 90 * DAY_MS).length, 0);
});
t("never-stamped warn: the class warns once the arm is 83 days old, and only once", () => {
  assert.equal(planWarn([noStamp], ARM_LIVE_MS + 82 * DAY_MS).length, 0);
  assert.equal(planWarn([noStamp], ARM_LIVE_MS + WARN_AT_MS).length, 1);
  assert.equal(planWarn([{ ...noStamp, photoWarnedAtMs: ARM_LIVE_MS + 83 * DAY_MS }], ARM_LIVE_MS + 84 * DAY_MS).length, 0);
});

console.log(`\nALL ${n} sweeper checks passed`);
