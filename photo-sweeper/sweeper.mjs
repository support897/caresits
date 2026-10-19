// Caresitters photo lifecycle sweeper — core.
//
// Design of record: Ilse's ruling of 19 Oct 2026 (profile
// photos auto delete after 3 months of app inactivity) and
// HQ's build spec of the same day. The module is a pure
// planner over account facts plus an executor whose every
// effect rides injected dependencies, so the whole behaviour
// is provable without a network (sweeper-tests.mjs) long
// before it deploys with the storage wave on Blaze.
//
// Scope fence, from her save-forever rule: PHOTOS ONLY.
// Profile words, answers and the account itself are never
// touched. Day Story objects are never in scope either: the
// object list below names profile-photos only, ever.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const INACTIVE_MS = 90 * DAY_MS;

// The objects a sweep removes, per account: the main profile
// photo only, on HQ's spec. The gallery slots join this list
// only if Ilse rules so; the fence is named, not an oversight.
export const PHOTO_OBJECTS = ["photo.jpg"];

// planSweep(accounts, nowMs) -> steps. An account is swept
// only when ALL of these hold: it is a carer (the photo lives
// in family search), it still holds a stored photo, it has
// not already been swept, it carries a trusted stamp, and
// the stamp is 90 or more days old. No stamp, no sweep: an
// account the stamp has never reached is never guessed at.
export function planSweep(accounts, nowMs) {
  if (!Array.isArray(accounts) || typeof nowMs !== "number" || !Number.isFinite(nowMs)) return [];
  const out = [];
  for (const a of accounts) {
    if (!a || typeof a.uid !== "string" || !a.uid) continue;
    if (a.side !== "carer") continue;
    if (!a.photoUrl) continue;
    if (a.photoClearedAtMs) continue;
    if (typeof a.lastActiveAtMs !== "number" || !Number.isFinite(a.lastActiveAtMs)) continue;
    if (nowMs - a.lastActiveAtMs < INACTIVE_MS) continue;
    out.push({
      uid: a.uid,
      deletePaths: PHOTO_OBJECTS.map((name) => `profile-photos/${a.uid}/${name}`),
      clearPhotoSlot: true,
    });
  }
  return out;
}

// runSweep(deps, nowMs): deps = {
//   listAccounts(): Promise<account facts>,           admin plane read
//   deleteObject(path): Promise<void>,                storage admin delete
//   clearPhotoSlot(uid, clearedAtMs): Promise<void>,  clears photoUrl + stamps photoClearedAt
// }
// Order per account is the safety property: the object goes
// FIRST, the slot clears SECOND, in the same pass, so no
// surface ever renders a broken image and no cleared slot
// ever orphans a live object. A failed delete leaves the
// slot untouched, lands loudly in the summary, and the pass
// continues with the next account.
export async function runSweep(deps, nowMs) {
  const accounts = await deps.listAccounts();
  const plan = planSweep(accounts, nowMs);
  const summary = { planned: plan.length, swept: [], failed: [] };
  for (const step of plan) {
    try {
      for (const p of step.deletePaths) await deps.deleteObject(p);
      await deps.clearPhotoSlot(step.uid, nowMs);
      summary.swept.push(step.uid);
    } catch (e) {
      summary.failed.push({ uid: step.uid, reason: String((e && (e.code || e.message)) || e) });
    }
  }
  return summary;
}
