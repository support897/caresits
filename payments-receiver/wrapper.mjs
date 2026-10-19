// Caresitters payments receiver — the deployed wrapper.
// Reads two SEPARATE mode-600 secrets files (charter A8):
// the service account JSON and the webhook value; mints
// short-lived Google access tokens from the service
// account (RS256 JWT exchange, standard library only);
// and supplies server.mjs its deps over Firestore's
// REST plane:
//
//   seenEvent(id)  GET _entitlementEvents/{id} — a get
//                  by id, never a list (charter)
//   writeRecord    PATCH _entitlements/{uid}, the
//                  section 3 record as typed fields
//   markEvent      POST _entitlementEvents?documentId=
//                  — a CREATE: it fails if the id exists,
//                  so the ledger is append-only at the
//                  API level too
//
// The credential behind this is the charter's custom
// role (Security, 19 Oct 2026): Firestore only, this
// project only, entities get · create · update — no
// delete, no list.
//
// Run: node wrapper.mjs <saJsonPath> <authFilePath> <projectId> <port>
import fs from "node:fs";
import crypto from "node:crypto";
import { serve } from "./server.mjs";

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function makeTokenMinter(sa) {
  let cached = null;
  return async () => {
    if (cached && cached.exp > Date.now() + 60000) return cached.token;
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(JSON.stringify({
      iss: sa.client_email, sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now, exp: now + 3600,
      scope: "https://www.googleapis.com/auth/datastore",
    }));
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    });
    if (!res.ok) throw new Error(`token exchange ${res.status}`);
    const j = await res.json();
    cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
    return cached.token;
  };
}

const field = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  return { stringValue: String(v) };
};
export const toFields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, field(v)]));

export function makeDeps({ projectId, token, expectedAuth, log }) {
  const root = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const call = async (method, url, body) => {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res;
  };
  return {
    expectedAuth,
    log: log || ((line) => console.log(new Date().toISOString(), line)),
    seenEvent: async (id) => {
      const res = await call("GET", `${root}/_entitlementEvents/${encodeURIComponent(id)}`);
      if (res.status === 404) return false;
      if (!res.ok) throw new Error(`ledger read ${res.status}`);
      return true;
    },
    writeRecord: async (uid, record) => {
      const res = await call("PATCH", `${root}/_entitlements/${encodeURIComponent(uid)}`, { fields: toFields(record) });
      if (!res.ok) throw new Error(`record write ${res.status}`);
    },
    markEvent: async (id, uid) => {
      const res = await call("POST", `${root}/_entitlementEvents?documentId=${encodeURIComponent(id)}`, {
        fields: toFields({ uid, source_event_id: id, at_ms: Date.now() }),
      });
      if (!res.ok) throw new Error(`ledger create ${res.status}`);
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [saPath, authPath, projectId, portRaw] = process.argv.slice(2);
  const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
  const expected = fs.readFileSync(authPath, "utf8").trim();
  const deps = makeDeps({ projectId, token: makeTokenMinter(sa), expectedAuth: () => expected });
  const port = Number(portRaw) || 8124;
  // In its container the listener takes the container's
  // interfaces: the fence is the front network it joins
  // (Caddy's) plus its own egress network; nothing is
  // published on the host.
  const server = await serve(deps, port, "0.0.0.0");
  console.log(`payments receiver on container :${port} for ${projectId}`);
}
