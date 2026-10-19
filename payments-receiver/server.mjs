// Caresitters payments receiver — the HTTP shell over
// receiver.mjs. Node standard library only, like the
// files gatekeeper. The shell is deliberately thin:
// verify the Authorization value, parse the body, ask
// the core for the record, dedupe by source event id,
// write the record plus a ledger entry through the
// injected deps, answer. All store knowledge lives in
// the core; all Firestore knowledge lives in the
// deployed wrapper that supplies the deps.
//
// deps = {
//   expectedAuth(): string                    custody value
//   seenEvent(id): Promise<boolean>           ledger read (get by id, never a list)
//   writeRecord(uid, record): Promise<void>   _entitlements/{uid}
//   markEvent(id, uid): Promise<void>         _entitlementEvents/{id} (create-only; the ledger is append-only)
//   log(line): void                           optional; unauthenticated attempts + internal errors are logged (charter)
// }
// RevenueCat retries any non-200 delivery, so every
// authenticated, parseable delivery answers 200 —
// including the events the core deliberately writes
// nothing for (TEST pings, foreign entitlements).
import http from "node:http";
import { recordFromEvent, authoriseWebhook } from "./receiver.mjs";

const MAX_BODY = 256 * 1024;

export function makeHandler(deps) {
  return async (req, res) => {
    const send = (code, obj) => {
      const body = JSON.stringify(obj);
      res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
      res.end(body);
    };
    try {
      if (req.method !== "POST" || !String(req.url || "").startsWith("/rc")) return send(404, { error: "not found" });
      if (!authoriseWebhook(req.headers.authorization, deps.expectedAuth())) {
        if (typeof deps.log === "function") deps.log(`401 unauthenticated attempt ${req.method} ${req.url} from ${req.socket && req.socket.remoteAddress}`);
        return send(401, { error: "unauthorized" });
      }
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) return send(413, { error: "too large" });
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { return send(400, { error: "bad json" }); }
      const plan = recordFromEvent(body, Date.now());
      if (!plan) return send(200, { received: true, wrote: false });
      if (await deps.seenEvent(plan.record.source_event_id)) return send(200, { received: true, wrote: false, duplicate: true });
      await deps.writeRecord(plan.uid, plan.record);
      await deps.markEvent(plan.record.source_event_id, plan.uid);
      return send(200, { received: true, wrote: true });
    } catch (e) {
      if (typeof deps.log === "function") deps.log(`500 internal ${String((e && e.message) || e)}`);
      return send(500, { error: "internal" });
    }
  };
}

export function serve(deps, port, host = "127.0.0.1") {
  const server = http.createServer(makeHandler(deps));
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}
