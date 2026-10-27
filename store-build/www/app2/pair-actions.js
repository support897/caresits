// Caresitters app2 — Phase C: pair actions, planned as pure shapes.
// Every planner here mirrors the cleared rules text, so the app
// never offers a button the rules would refuse. The live writes
// ride the account layer when the rules publish.
export const pairIdFor = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

export function planContact({ familyUid, carerUid, createdBy, nowIso, createdDay, profileComplete }) {
  // The browse gate (founder ruling, 15 Oct 2026): everyone can look at
  // everyone, free. Messaging anyone takes a finished profile
  // and the full questionnaire. Browsing itself is never gated.
  if (!profileComplete) return { ok: false, reason: "profile-incomplete" };
  if (familyUid === carerUid) return { ok: false, reason: "self-pair" };
  if (createdBy !== familyUid && createdBy !== carerUid) return { ok: false, reason: "creator-not-a-member" };
  return {
    ok: true,
    path: `relationships/${pairIdFor(familyUid, carerUid)}`,
    data: {
      members: [familyUid, carerUid].sort(),
      familyUid, carerUid,
      state: "pending",
      createdBy, createdAt: nowIso, createdDay,
    },
  };
}

// Mirrors the relationships update arms exactly:
// - ended: either member, from any state.
// - contact: from pending, by the member who did NOT create,
//   stamping contactBy in the same write.
// - hired: from contact, by the family member alone.
export function planTransition(rel, actorUid, to) {
  if (!rel.members?.includes(actorUid)) return { ok: false, reason: "not-a-member" };
  if (to === "ended") return { ok: true, patch: { state: "ended" } };
  if (to === "contact") {
    if (rel.state !== "pending") return { ok: false, reason: "not-pending" };
    if (actorUid === rel.createdBy) return { ok: false, reason: "creator-cannot-confirm" };
    return { ok: true, patch: { state: "contact", contactBy: actorUid } };
  }
  if (to === "hired") {
    if (rel.state !== "contact") return { ok: false, reason: "not-in-contact" };
    if (actorUid !== rel.familyUid) return { ok: false, reason: "family-only" };
    return { ok: true, patch: { state: "hired" } };
  }
  return { ok: false, reason: "unknown-state" };
}

// Public jobs can include old QA records. Hide known test labels without
// collapsing legitimate customer posts that happen to share their details.
export function cleanJobListings(jobs) {
  const testLabel = /\burgent(?:cap|job)[a-z0-9_-]*\b|\bmicro[\s_-]*job(?:[\s_-]*[a-z0-9_-]+)?\b|\btest[\s_-]*job\b/i;
  return (Array.isArray(jobs) ? jobs : []).filter((job) => {
    if (!job || typeof job !== "object") return false;
    const words = [job.id, job.title, job.name, job.when, job.note, job.description].map((v) => String(v || "")).join(" ");
    const hasUsefulDetails = [job.postcode, job.title, job.name, job.note, job.description]
      .some((v) => String(v || "").trim());
    return hasUsefulDetails && !testLabel.test(words);
  });
}

export function planJobPost({ familyUid, when, dayParts, postcode, bands, note, latE2, lngE2, nowIso, profileComplete, level }) {
  if (!profileComplete) return { ok: false, reason: "profile-incomplete" };
  const data = { familyUid, when, dayParts, postcode, bands, note, state: "open", createdAt: nowIso };
  if (latE2 != null) data.latE2 = Math.trunc(latE2);
  if (lngE2 != null) data.lngE2 = Math.trunc(lngE2);
  return { ok: true, collection: "jobs", data };
}

export function planInterest({ job, carerUid, note, nowIso, profileComplete }) {
  if (!profileComplete) return { ok: false, reason: "profile-incomplete" };
  if (job.state !== "open") return { ok: false, reason: "job-not-open" };
  return { ok: true, path: `jobs/${job.id}/interest/${carerUid}`, data: { note, createdAt: nowIso } };
}
