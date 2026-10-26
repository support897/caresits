// Caresitters app2 — the connect link planners (the two homes
// build; shapes from Security's ruling, 17 Oct 2026).
// A family makes a short code. The invite doc at invites/{code}
// is exactly {familyUid, label, createdAt, usedBy: null}: the
// family who made it, a label, when, and nobody yet. Whoever
// opens the link and accepts becomes the pair: the accept
// stamp moves ONLY usedBy to the accepter's uid, and the
// relationship is created beside it in the SEALED shape
// (members sorted, state born pending, createdBy the
// ACCEPTER), exactly as the rules' relationship arms expect.

// The code alphabet, fenced by the rules regex: no I, L, O,
// 0 or 1, so a code read aloud or copied by hand cannot be
// misread.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

export function isCode(text) {
  const c = String(text || "").trim().toUpperCase();
  return c.length === CODE_LENGTH && [...c].every((ch) => CODE_ALPHABET.includes(ch));
}
export function cleanCode(text) {
  return String(text || "").trim().toUpperCase();
}

export function makeCode(rand = Math.random) {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[Math.min(CODE_ALPHABET.length - 1, Math.floor(rand() * CODE_ALPHABET.length))];
  }
  return out;
}

export function planInviteCreate({ familyUid, code, label, nowIso }) {
  if (!familyUid) return { ok: false, reason: "signed-out" };
  if (!isCode(code)) return { ok: false, reason: "bad-code" };
  const c = cleanCode(code);
  return {
    ok: true,
    kind: "invite-create",
    code: c,
    path: `invites/${c}`,
    data: { familyUid, label: String(label || "").slice(0, 60), createdAt: nowIso, usedBy: null },
  };
}

export function planInviteAccept({ code, invite, accepterUid, nowIso }) {
  if (!isCode(code)) return { ok: false, reason: "bad-code" };
  if (!invite || !invite.familyUid) return { ok: false, reason: "not-found" };
  if (!accepterUid) return { ok: false, reason: "signed-out" };
  if (invite.usedBy) return { ok: false, reason: "already-used" };
  if (invite.familyUid === accepterUid) return { ok: false, reason: "own-link" };
  const familyUid = invite.familyUid;
  const carerUid = accepterUid;
  const pairId = pairIdFor(familyUid, carerUid);
  return {
    ok: true,
    kind: "invite-accept",
    pairId,
    relPath: `relationships/${pairId}`,
    relData: {
      members: [familyUid, carerUid].sort(),
      familyUid,
      carerUid,
      state: "pending",
      createdBy: accepterUid,
      createdAt: nowIso,
      createdDay: String(nowIso || "").slice(0, 10),
    },
    invitePath: `invites/${cleanCode(code)}`,
    stamp: { usedBy: accepterUid },
  };
}

export function inviteLinkText(code) {
  return `caresitters.app/connect/${cleanCode(code)}`;
}

import { pairIdFor } from "./pair-actions.js";
