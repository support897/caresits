// Caresitters app2 — Amendment 4: report and block, planned as
// pure shapes mirroring the sealed safety delta. A report is
// write-only: the filer never reads it back and never hears
// the outcome. Its snapshot obeys the envelope the rules
// fence (items at most 10, text at most 4000, title at most
// 120, the filer's words at most 1000). A block is a private
// record in the filer's own space; it deletes nothing and
// the blocked side is never told.
export const REPORT_CATEGORIES = [
  ["spam_scam", "Spam or scam"],
  ["rude_abusive", "Rude or abusive"],
  ["fake_profile", "Fake profile"],
  ["child_safety", "Child safety"],
  ["inappropriate", "Inappropriate"],
  ["other", "Other"],
];
const CATEGORY_KEYS = REPORT_CATEGORIES.map(([k]) => k);
const SURFACES = ["message", "card", "job", "profile"];

export function planReport({ reporterUid, reportedUid, surface, category, words, snapshot, nowIso }) {
  if (!reporterUid || reporterUid === reportedUid) return { ok: false, reason: "bad-parties" };
  if (!SURFACES.includes(surface)) return { ok: false, reason: "bad-surface" };
  if (!CATEGORY_KEYS.includes(category)) return { ok: false, reason: "bad-category" };
  const snap = {
    items: Array.isArray(snapshot?.items) ? snapshot.items.slice(0, 10).map(String) : [],
    text: String(snapshot?.text || "").slice(0, 4000),
    title: String(snapshot?.title || "").slice(0, 120),
  };
  return {
    ok: true,
    collection: "safetyReports",
    data: {
      reporterUid, reportedUid, surface, category,
      reporterWords: String(words || "").slice(0, 1000),
      snapshot: snap, state: "open", createdAt: nowIso,
    },
    counter: { path: "_owner/aggregates/safety/main", delta: { filed: 1, open: 1 } },
    acknowledgement: "Your report is with the operator. You will not hear the outcome, and that is on purpose: a report is a question for the operator, never a lever on another person.",
  };
}

export function planBlock({ uid, otherUid, nowIso }) {
  if (!uid || uid === otherUid) return { ok: false, reason: "bad-parties" };
  return { ok: true, path: `users/${uid}/blocks/${otherUid}`, data: { createdAt: nowIso } };
}
