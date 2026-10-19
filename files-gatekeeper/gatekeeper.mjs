// Caresitters files gatekeeper: the pure core.
//
// The design of record is next-phase/FILES-SERVER-DESIGN.md
// as amended by Security's R2 addendum (19 Oct 2026),
// which governs. This module is the testable core: key
// planning, the authorisation matrix, Firebase ID token
// verification (public certs route), R2 presigning
// (SigV4), and the confirm-time check. The HTTP shell and
// the R2 calls live in server.mjs; everything here is
// pure or takes its transport as an argument, so the
// battery runs synthetic end to end.
//
// The law it implements, in brief: files live only in one
// private R2 bucket. The app asks with its Firebase login
// token; the gatekeeper verifies the token itself, checks
// the matrix, and signs one short lived link for one
// object with one verb. Uploads are verified at CONFIRM
// TIME (size + magic bytes) before any app state may
// reference the object. Nothing here ever sees a resume:
// the resume is device only, and there is no resume key,
// verb or class in this file.
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Key planning. Keys are composed HERE, server side, from
// verified facts; a client names a class and a slot, never
// a key. Shapes:
//   profile photos  <uid>/profile-photos/photo.jpg | extra-<1..4>.jpg
//   certificates    <uid>/certificates/<sanitised name>.pdf
//   day story       pairs/<pairId>/<sanitised name>.jpg   (A5)
// Versioning is ON at the bucket (Security's governing
// call, 19 Oct 2026): user deletes leave delete markers
// the bin window restores from; ruled deletes remove ALL
// versions. There are no trash keys.

export const CLASSES = {
  "profile-photos": { maxBytes: 5 * 1024 * 1024, magic: "jpeg", ext: ".jpg" },
  certificates: { maxBytes: 10 * 1024 * 1024, magic: "pdf", ext: ".pdf" },
  "day-story": { maxBytes: 5 * 1024 * 1024, magic: "jpeg", ext: ".jpg" },
};

const UID_RE = /^[A-Za-z0-9]{8,128}$/;
const PAIR_RE = /^[A-Za-z0-9_-]{8,160}$/;

export function safeName(name) {
  if (typeof name !== "string" || !name) return null;
  const safe = name.replace(/[^A-Za-z0-9._]/g, "_");
  return safe && safe.length <= 120 ? safe : null;
}

export function planUserKey({ uid, cls, name } = {}) {
  if (!UID_RE.test(uid || "")) return null;
  if (cls === "profile-photos") {
    if (name !== "photo.jpg" && !/^extra-[1-4]\.jpg$/.test(name || "")) return null;
    return `${uid}/profile-photos/${name}`;
  }
  if (cls === "certificates") {
    const safe = safeName(name);
    if (!safe || !safe.toLowerCase().endsWith(".pdf")) return null;
    return `${uid}/certificates/${safe}`;
  }
  return null;
}

export function planPairKey({ pairId, name } = {}) {
  if (!PAIR_RE.test(pairId || "")) return null;
  const safe = safeName(name);
  if (!safe || !safe.toLowerCase().endsWith(".jpg")) return null;
  return `pairs/${pairId}/${safe}`;
}

// ---------------------------------------------------------------------------
// The authorisation matrix (Q1, confirmed as amended;
// Q2: day story delete is family side only, and the carer
// holds no day story delete verb at all).
//
// authorise(input) -> { ok: true } | { ok: false, reason }
// input: {
//   uid,            // from the VERIFIED token, never the body
//   op,             // "put" | "get" | "del" | "confirm"
//   cls,            // a CLASSES key
//   key,            // the planned key
//   keyUid,         // for user classes: the key's owner uid
//   pair,           // for day-story: { familyUid, carerUid } | null,
//                   // read from Firestore under the CALLER's token,
//                   // so Firestore's rules judged the read
//   side,           // the caller's profile side: "family" | "carer" | ""
// }

export function authorise({ uid, op, cls, key, keyUid, pair, side } = {}) {
  if (!uid || !key || !CLASSES[cls]) return { ok: false, reason: "shape" };
  if (!["put", "get", "del", "confirm"].includes(op)) return { ok: false, reason: "op" };
  if (cls === "profile-photos" || cls === "certificates") {
    if (keyUid !== uid) {
      // Cross-user: the only door is a certificate READ by
      // the family side of a contact/hired pair, judged by
      // the pair facts the caller supplies (themselves read
      // under the caller's token).
      if (cls === "certificates" && op === "get" && pair && pair.familyUid === uid && pair.carerUid === keyUid
        && (pair.state === "contact" || pair.state === "hired")) return { ok: true };
      if (cls === "profile-photos" && op === "get") return { ok: true }; // Find renders profile photos to signed-in members
      return { ok: false, reason: "not-owner" };
    }
    return { ok: true };
  }
  // day-story: pair members read and write; delete is the
  // FAMILY side's alone (Q2).
  if (!pair || (pair.familyUid !== uid && pair.carerUid !== uid)) return { ok: false, reason: "not-pair" };
  if (op === "del") {
    if (pair.familyUid === uid && side === "family") return { ok: true };
    return { ok: false, reason: "family-only-delete" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Firebase ID token verification, public certs route.
// verifyIdToken(token, { jwks, nowMs, projectId }) -> claims | null
// Checks RS256 signature, issuer, audience, expiry, and
// refuses anonymous sign-ins (the sealed stance). No
// Firebase key is held for this (design, revocation
// posture: the one hour token bound accepted in writing).

export function decodeJwt(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return { header, claims, signed: `${parts[0]}.${parts[1]}`, signature: Buffer.from(parts[2], "base64url") };
  } catch { return null; }
}

export function verifyIdToken(token, { jwks, nowMs, projectId } = {}) {
  const decoded = decodeJwt(token);
  if (!decoded || decoded.header.alg !== "RS256" || !decoded.header.kid) return null;
  const jwk = (jwks && jwks.keys || []).find((k) => k.kid === decoded.header.kid);
  if (!jwk) return null;
  let key;
  try { key = crypto.createPublicKey({ key: jwk, format: "jwk" }); } catch { return null; }
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(decoded.signed);
  let sigOk = false;
  try { sigOk = verifier.verify(key, decoded.signature); } catch { return null; }
  if (!sigOk) return null;
  const c = decoded.claims;
  const nowSec = Math.floor((typeof nowMs === "number" ? nowMs : Date.now()) / 1000);
  if (c.iss !== `https://securetoken.google.com/${projectId}`) return null;
  if (c.aud !== projectId) return null;
  if (typeof c.exp !== "number" || c.exp <= nowSec) return null;
  if (typeof c.iat !== "number" || c.iat > nowSec + 300) return null;
  if (!c.sub || typeof c.sub !== "string") return null;
  if (c.firebase && c.firebase.sign_in_provider === "anonymous") return null;
  return c;
}

// ---------------------------------------------------------------------------
// R2 presigning (SigV4 query signing). presign() returns
// the URL; the signature binds the bucket endpoint, the
// exact key, the verb and the expiry (R3). PUT binds the
// exact Content Length as a signed header; GET binds the
// no-store response overrides (A9).

const sha256hex = (s) => crypto.createHash("sha256").update(s).digest("hex");
const hmac = (key, s) => crypto.createHmac("sha256", key).update(s).digest();

export function presign({ method, accountId, bucket, key, expiresSec, accessKeyId, secretAccessKey, nowMs, contentLength, responseOverrides } = {}) {
  if (!["PUT", "GET", "DELETE"].includes(method)) return null;
  if (!accountId || !bucket || !key || !accessKeyId || !secretAccessKey) return null;
  const now = new Date(typeof nowMs === "number" ? nowMs : Date.now());
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const signedHeaders = ["host"];
  const headerValues = { host };
  if (method === "PUT" && typeof contentLength === "number") {
    signedHeaders.push("content-length");
    headerValues["content-length"] = String(contentLength);
  }
  signedHeaders.sort();
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSec),
    "X-Amz-SignedHeaders": signedHeaders.join(";"),
  };
  if (method === "GET" && responseOverrides) {
    if (responseOverrides.cacheControl) query["response-cache-control"] = responseOverrides.cacheControl;
    if (responseOverrides.contentType) query["response-content-type"] = responseOverrides.contentType;
  }
  const qs = Object.keys(query).sort().map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join("&");
  const canonicalHeaders = signedHeaders.map((h) => `${h}:${headerValues[h]}\n`).join("");
  const canonicalRequest = [method, `/${bucket}/${encodedKey}`, qs, canonicalHeaders, signedHeaders.join(";"), "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  return `https://${host}/${bucket}/${encodedKey}?${qs}&X-Amz-Signature=${signature}`;
}

// TTLs as ruled (Q4 as restated by A2).
export const TTL = { put: 300, del: 300, get: 600 };

// ---------------------------------------------------------------------------
// Confirm-time verification (A3): the object is inert
// until these pass. confirmCheck({ cls, size, head }) ->
// { ok: true } | { ok: false, reason }. head = the
// object's first bytes (Buffer/Uint8Array, >= 4 bytes).

export function magicOf(bytes) {
  if (!bytes || bytes.length < 3) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  return null;
}

export function confirmCheck({ cls, size, head } = {}) {
  const spec = CLASSES[cls];
  if (!spec) return { ok: false, reason: "class" };
  if (typeof size !== "number" || size <= 0) return { ok: false, reason: "missing" };
  if (size > spec.maxBytes) return { ok: false, reason: "too-big" };
  if (magicOf(head) !== spec.magic) return { ok: false, reason: "type" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Issuance budget (Q5/A7): a simple in-memory per-uid
// counter with a generous ceiling, enforced at issuance.
// makeBudget({ limit, windowMs }) -> { take(uid, nowMs) }

export function makeBudget({ limit = 300, windowMs = 60 * 60 * 1000 } = {}) {
  const seen = new Map();
  return {
    take(uid, nowMs) {
      const now = typeof nowMs === "number" ? nowMs : Date.now();
      const row = seen.get(uid) || { count: 0, from: now };
      if (now - row.from >= windowMs) { row.count = 0; row.from = now; }
      row.count += 1;
      seen.set(uid, row);
      return row.count <= limit;
    },
  };
}
