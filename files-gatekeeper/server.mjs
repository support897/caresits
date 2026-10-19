// Caresitters files gatekeeper — the HTTP shell over
// gatekeeper.mjs (design of record: next-phase/
// FILES-SERVER-DESIGN.md). Node standard library only.
// Two doors, nothing else:
//
//   POST /v1/link    { op, class, name, bytes, ownerUid,
//                      pairId } + the caller's Firebase
//                      ID token -> one signed door
//                      (header-signed PUT | presigned
//                      GET | presigned DELETE)
//   POST /v1/confirm { class, name, pairId } + token
//                      -> the synchronous verification:
//                      size + magic read back from the
//                      bucket; a failure deletes the
//                      object at once and refuses.
//
// Every fact the core's authorise() judges is gathered
// HERE, from Firestore under the CALLER's token, so the
// rules judge every read: the pair document, the
// caller's side, and whether the owner's profile slot
// names the key (Q6 iii). The shell holds the
// gatekeeper's own R2 credential only for signing and
// for the confirm reads; the client never sees it.
//
// deps = {
//   verifyToken(token): Promise<claims|null>,
//   readProfile(uid, token): Promise<doc|null>,
//   readPair(pairId, token): Promise<doc|null>,
//   slotNamesKey(profileDoc, key): boolean,
//   s3Head(key): Promise<{ size } | null>,
//   s3HeadBytes(key, n): Promise<Buffer>,
//   s3Delete(key): Promise<void>,
//   creds: { accountId, bucket, accessKeyId, secretAccessKey },
//   ledger: { noteIssued(key, uid), issuedAt(key), markConfirmed(key, uid) },
//   budgetTake(uid): boolean,
//   log(line): void (optional),
// }
import http from "node:http";
import {
  CLASSES, planUserKey, planPairKey, authorise,
  presign, presignPutRequest, confirmCheck, TTL,
} from "./gatekeeper.mjs";

const MAX_BODY = 64 * 1024;
// The class fixes the content type (the design: the
// class fixes the type); the sealed core names the magic,
// the shell names the wire type that rides it.
const CLASS_TYPE = { "profile-photos": "image/jpeg", certificates: "application/pdf", "day-story": "image/jpeg" };

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) return null;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return null; }
}

function planKey(body, uid) {
  if (body.class === "day-story") {
    if (!body.pairId) return null;
    return { key: planPairKey({ pairId: body.pairId, name: body.name }), keyUid: null };
  }
  const owner = body.ownerUid || uid;
  const key = planUserKey({ uid: owner, cls: body.class, name: body.name });
  return key ? { key, keyUid: owner } : null;
}

export function makeHandler(deps) {
  return async (req, res) => {
    const send = (code, obj) => {
      const body = JSON.stringify(obj);
      res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
      res.end(body);
    };
    const log = (line) => { if (typeof deps.log === "function") deps.log(line); };
    try {
      const path = String(req.url || "").split("?")[0];
      if (req.method !== "POST" || (path !== "/v1/link" && path !== "/v1/confirm")) return send(404, { error: "not found" });
      const auth = String(req.headers.authorization || "");
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      const claims = token ? await deps.verifyToken(token) : null;
      if (!claims || !claims.uid) { log(`401 ${path} from ${req.socket && req.socket.remoteAddress}`); return send(401, { error: "unauthorized" }); }
      const uid = claims.uid;
      const body = await readJson(req);
      if (!body || !CLASSES[body.class]) return send(400, { error: "bad request" });

      const planned = planKey(body, uid);
      if (!planned || !planned.key) return send(400, { error: "bad key" });
      const { key } = planned;

      // Facts, read under the caller's token.
      let pair = null;
      if (body.class === "day-story" || (body.class === "certificates" && body.pairId)) {
        // A pair the caller cannot read (the rules deny
        // non-members even the existence check) is "no
        // pair facts": authorise refuses on it, which is
        // the honest answer, never a 500.
        pair = body.pairId ? await deps.readPair(body.pairId, token).catch(() => null) : null;
      }
      let side = "";
      let referenced = false;
      const isConfirm = path === "/v1/confirm";
      const op = isConfirm ? "confirm" : body.op;
      if (body.class !== "day-story") {
        const mine = await deps.readProfile(uid, token).catch(() => null);
        side = (mine && mine.side) || "";
        if (!isConfirm && op === "get") {
          const ownerDoc = planned.keyUid === uid ? mine : await deps.readProfile(planned.keyUid, token).catch(() => null);
          referenced = ownerDoc ? deps.slotNamesKey(ownerDoc, key) : false;
        }
      } else {
        const mine = await deps.readProfile(uid, token).catch(() => null);
        side = (mine && mine.side) || "";
      }

      const verdict = authorise({ uid, op, cls: body.class, key, keyUid: planned.keyUid, pair, side, referenced });
      if (!verdict.ok) return send(403, { error: verdict.reason });

      if (isConfirm) {
        const issued = deps.ledger.issuedAt(key);
        if (!issued || Date.now() - issued > TTL.put * 1000) return send(409, { error: "no-live-issuance" });
        const head = await deps.s3Head(key);
        if (!head) return send(404, { error: "missing" });
        const bytes = await deps.s3HeadBytes(key, 16);
        const check = confirmCheck({ cls: body.class, size: head.size, head: bytes });
        if (!check.ok) {
          await deps.s3Delete(key).catch(() => {});
          log(`confirm refused ${key}: ${check.reason} (object deleted)`);
          return send(422, { error: check.reason });
        }
        deps.ledger.markConfirmed(key, uid);
        return send(200, { ok: true });
      }

      if (!["put", "get", "del"].includes(op)) return send(400, { error: "bad op" });
      if (!deps.budgetTake(uid)) return send(429, { error: "budget" });
      const { accountId, bucket, accessKeyId, secretAccessKey } = deps.creds;
      if (op === "put") {
        const cls = CLASSES[body.class];
        if (typeof body.bytes !== "number" || body.bytes < 0 || body.bytes > cls.maxBytes) return send(400, { error: "bad size" });
        const door = presignPutRequest({ accountId, bucket, key, contentLength: body.bytes, contentType: CLASS_TYPE[body.class], accessKeyId, secretAccessKey, nowMs: Date.now() });
        if (!door) return send(500, { error: "signing" });
        deps.ledger.noteIssued(key, uid);
        return send(200, { url: door.url, headers: door.headers, expiresIn: TTL.put });
      }
      if (op === "get") {
        const url = presign({ method: "GET", accountId, bucket, key, expiresSec: TTL.get, accessKeyId, secretAccessKey, nowMs: Date.now(), responseOverrides: { cacheControl: "no-store", contentType: CLASS_TYPE[body.class] } });
        if (!url) return send(500, { error: "signing" });
        return send(200, { url, expiresIn: TTL.get });
      }
      const url = presign({ method: "DELETE", accountId, bucket, key, expiresSec: TTL.del, accessKeyId, secretAccessKey, nowMs: Date.now() });
      if (!url) return send(500, { error: "signing" });
      return send(200, { url, expiresIn: TTL.del });
    } catch (e) {
      log(`500 ${String((e && e.message) || e)}`);
      return send(500, { error: "internal" });
    }
  };
}

export function serve(deps, port, host = "127.0.0.1") {
  const server = http.createServer(makeHandler(deps));
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}
