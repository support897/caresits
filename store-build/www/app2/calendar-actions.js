// Caresitters app2 — Amendment 5: pair calendar planners.
// Pure shapes mirroring the sealed calendar delta, so the app
// never offers a move the rules would refuse. Requests are
// proposals only; a block lands only when it EQUALS an
// accepted proposal and is written by the accepter; the
// regular week moves only through the version pointer.
export const REQUEST_KINDS = ["extra", "off", "move", "week-change"];
const BLOCK_KIND_FOR = { extra: "extra", off: "off", move: "moved" };

export function planRequest({ pairId, kind, askedBy, day, days, start, end, proposedVersionId, effectiveFrom, nowIso }) {
  if (!REQUEST_KINDS.includes(kind)) return { ok: false, reason: "bad-kind" };
  const data = { kind, askedBy, state: "waiting", createdAt: nowIso };
  if (day) data.day = day;
  if (days) data.days = days;
  if (start) data.start = start;
  if (end) data.end = end;
  if (kind === "week-change") {
    if (!proposedVersionId || !effectiveFrom) return { ok: false, reason: "week-change-needs-version" };
    data.proposedVersionId = proposedVersionId;
    data.effectiveFrom = effectiveFrom;
  }
  return { ok: true, path: `schedule/${pairId}/requests`, data };
}

export function planDecision(request, actorUid, accept) {
  if (request.state !== "waiting") return { ok: false, reason: "not-waiting" };
  if (actorUid === request.askedBy) return { ok: false, reason: "asker-cannot-decide" };
  return { ok: true, patch: { state: accept ? "accepted" : "declined", decidedBy: actorUid } };
}

export function planBlockLanding({ pairId, request, block, actorUid, otherUid, nowIso }) {
  if (request.state !== "accepted") return { ok: false, reason: "not-accepted" };
  if (request.decidedBy !== actorUid) return { ok: false, reason: "only-the-accepter-lands" };
  const kind = BLOCK_KIND_FOR[request.kind];
  if (!kind || block.kind !== kind) return { ok: false, reason: "kind-mismatch" };
  const dayOk = block.day === request.day || (Array.isArray(request.days) && request.days.includes(block.day));
  if (!dayOk) return { ok: false, reason: "day-mismatch" };
  if ((block.start || "") !== (request.start || "") || (block.end || "") !== (request.end || "")) return { ok: false, reason: "time-mismatch" };
  return {
    ok: true,
    path: `schedule/${pairId}/blocks`,
    data: { day: block.day, start: block.start || "", end: block.end || "", kind, withUid: otherUid, state: "live", sourceRequest: request.id, createdBy: actorUid, createdAt: nowIso },
  };
}

export function planWeekVersion({ pairId, versionId, pattern, effectiveFrom, proposedBy, sourceRequest, nowIso }) {
  const data = { pattern, effectiveFrom, proposedBy, createdAt: nowIso };
  if (sourceRequest) data.sourceRequest = sourceRequest;
  return { ok: true, path: `schedule/${pairId}/weekVersions/${versionId}`, data };
}

// The pointer: formation points at the creator's own version;
// every later move binds to one accepted week change and the
// pointer's values must equal that request's proposal.
export function planPointer({ pairId, versionId, effectiveFrom, actorUid, nowIso, boundRequest, current }) {
  const data = { versionId, effectiveFrom, updatedBy: actorUid, updatedAt: nowIso };
  if (!current) return { ok: true, path: `schedule/${pairId}/weekCurrent/main`, data, formation: true };
  if (!boundRequest) return { ok: false, reason: "needs-bound-request" };
  if (boundRequest.kind !== "week-change" || boundRequest.state !== "accepted") return { ok: false, reason: "request-not-accepted" };
  if (boundRequest.decidedBy !== actorUid) return { ok: false, reason: "only-the-accepter-moves" };
  if (boundRequest.askedBy === actorUid) return { ok: false, reason: "asker-cannot-move" };
  if (boundRequest.proposedVersionId !== versionId || boundRequest.effectiveFrom !== effectiveFrom) return { ok: false, reason: "values-must-equal-proposal" };
  return { ok: true, path: `schedule/${pairId}/weekCurrent/main`, data: { ...data, boundRequest: boundRequest.id }, formation: false };
}

// PIN C: a request whose day already carries an accepted one
// time block must say so on the accept screen, before the tap.
export function clashLine(request, blocks) {
  if (!request?.day) return null;
  const hit = (blocks || []).find((b) => b.day === request.day && b.state === "live");
  return hit ? `Heads up: ${request.day} already has a one time block (${hit.start || ""} to ${hit.end || ""}). Accepting adds this on top.` : null;
}

// The clash as parts, so the render layer can speak it in the
// user's language; clashLine above stays the English of record.
export function clashParts(request, blocks) {
  if (!request?.day) return null;
  const hit = (blocks || []).find((b) => b.day === request.day && b.state === "live");
  return hit ? { day: request.day, start: hit.start || "", end: hit.end || "" } : null;
}
