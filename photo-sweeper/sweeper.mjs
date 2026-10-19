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
export const WARN_BEFORE_MS = 7 * DAY_MS;
export const WARN_AT_MS = INACTIVE_MS - WARN_BEFORE_MS;

// The warning email, in her words first: open the app to
// keep your photo. Drafted for the wave's mail route (no
// mail transport exists for this app yet; the words are
// settled, the sending is the wave's).
export const WARN_COPY = {
  subject: "Your Caresitters photo needs you",
  body: "Open the app to keep your photo. If the app stays closed for 7 more days, your profile photo will be removed, and your profile will pause in family search until you add a fresh photo.",
};

// The objects a sweep removes, per account: the main profile
// photo AND the four gallery photos. Her words were "the
// images" for the carer's profile (HQ ruling, 19 Oct 2026):
// the gallery is the same class, the carer's own profile
// images with the same intent. The only carve-out she has
// ever made is Day Story, which never appears here.
export const PHOTO_OBJECTS = ["photo.jpg", "extra-1.jpg", "extra-2.jpg", "extra-3.jpg", "extra-4.jpg"];

// planSweep(accounts, nowMs) -> steps. An account is swept
// only when ALL of these hold: it is a carer (the photo lives
// in family search), it still holds a stored photo, it has
// not already been swept, it carries a trusted stamp, and
// the stamp is 90 or more days old. The missing-stamp
// policy is RULED (HQ, 19 Oct 2026): missing stamp = never
// swept. An account the stamp has never reached is never
// guessed at, on any fallback signal, ever.
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

// planWarn(accounts, nowMs) -> the carers to warn: inside
// the warning window (stamp 83 or more days old, not yet
// 90), photo still stored, never swept, and not already
// warned in THIS inactivity window. A warning counts for
// the window only when it was sent after the last activity
// (photoWarnedAtMs later than lastActiveAtMs): a carer who
// returned and went quiet again is warned again.
export function planWarn(accounts, nowMs) {
  if (!Array.isArray(accounts) || typeof nowMs !== "number" || !Number.isFinite(nowMs)) return [];
  const out = [];
  for (const a of accounts) {
    if (!a || typeof a.uid !== "string" || !a.uid) continue;
    if (a.side !== "carer") continue;
    if (!a.photoUrl) continue;
    if (a.photoClearedAtMs) continue;
    if (typeof a.lastActiveAtMs !== "number" || !Number.isFinite(a.lastActiveAtMs)) continue;
    const age = nowMs - a.lastActiveAtMs;
    if (age < WARN_AT_MS || age >= INACTIVE_MS) continue;
    if (typeof a.photoWarnedAtMs === "number" && a.photoWarnedAtMs > a.lastActiveAtMs) continue;
    out.push({ uid: a.uid, copy: WARN_COPY });
  }
  return out;
}

// runWarn(deps, nowMs): deps = {
//   listAccounts(): Promise<account facts>,
//   sendWarning(uid, copy): Promise<void>,      the wave's mail route
//   markWarned(uid, atMs): Promise<void>,       stamps photoWarnedAt
// }
// Send FIRST, mark second: a warning that never sent is
// never marked, so it is retried on the next run instead of
// being believed sent.
export async function runWarn(deps, nowMs) {
  const accounts = await deps.listAccounts();
  const plan = planWarn(accounts, nowMs);
  const summary = { planned: plan.length, warned: [], failed: [] };
  for (const step of plan) {
    try {
      await deps.sendWarning(step.uid, step.copy);
      await deps.markWarned(step.uid, nowMs);
      summary.warned.push(step.uid);
    } catch (e) {
      summary.failed.push({ uid: step.uid, reason: String((e && (e.code || e.message)) || e) });
    }
  }
  return summary;
}

// runSweep(deps, nowMs): deps = {
//   listAccounts(): Promise<account facts>,           admin plane read
//   deleteObject(path): Promise<void>,                storage admin delete
//   clearPhotoSlot(uid, clearedAtMs): Promise<void>,  clears photoUrl + the card gallery + stamps photoClearedAt
// }
// Order per account is the safety property: the objects go
// FIRST, the slots clear SECOND, in the same pass, so no
// surface ever renders a broken image and no cleared slot
// ever orphans a live object. A failed delete leaves the
// slots untouched, lands loudly in the summary, and the pass
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
