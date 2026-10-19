// Caresitters files gatekeeper — the deployed wrapper.
// Wires server.mjs to the real world:
//   verifyToken   Google's securetoken JWKS, fetched and
//                 cached per its Cache-Control, judged
//                 by the core's verifyIdToken. No
//                 Firebase key is held (design posture).
//   readProfile / readPair
//                 Firestore REST reads under the
//                 CALLER's token, so the rules judge
//                 every read (Q6 iii + the pair model).
//   slotNamesKey  any string in the profile document
//                 (nested included) equal to the key.
//   s3*           the gatekeeper's own reads of the
//                 bucket, through its own short-lived
//                 presigned doors: size from a ranged
//                 read's Content-Range, magic from the
//                 first bytes, delete by presigned URL.
//   ledger        an append-only JSONL beside the
//                 service; issuance entries ground the
//                 confirm window and the daily census.
//   budget        the core's per-uid issuance budget.
//
// Run: node wrapper.mjs <credsJsonPath> <ledgerPath> <projectId> <port>
// The creds file (mode 600, PB's custody route) carries
// { accountId, bucket, accessKeyId, secretAccessKey }
// for the GATEKEEPER's R2 token (this bucket only,
// object read + write + delete, NO list — Q7).
import fs from "node:fs";
import { serve } from "./server.mjs";
import { verifyIdToken, presign, makeBudget } from "./gatekeeper.mjs";

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let jwksCache = { doc: null, until: 0 };
export async function fetchJwks(nowMs = Date.now()) {
  if (jwksCache.doc && jwksCache.until > nowMs) return jwksCache.doc;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const body = await res.json();
  const cc = String(res.headers.get("cache-control") || "");
  const m = cc.match(/max-age=(\d+)/);
  jwksCache = { doc: body, until: nowMs + (m ? Number(m[1]) : 3600) * 1000 };
  return jwksCache.doc;
}

function plain(fields) {
  if (!fields) return null;
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = plainValue(v);
  return out;
}
function plainValue(v) {
  if (!v || typeof v !== "object") return v;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) return plain(v.mapValue.fields);
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(plainValue);
  return null;
}

export function slotNamesKey(doc, key) {
  let hit = false;
  const walk = (x) => {
    if (hit || x == null) return;
    if (typeof x === "string") { if (x === key || x.endsWith("/" + key)) hit = true; return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (typeof x === "object") Object.values(x).forEach(walk);
  };
  walk(doc);
  return hit;
}

export function makeLedger(path) {
  const issued = new Map();
  const confirmed = new Set();
  try {
    for (const line of fs.readFileSync(path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const e = JSON.parse(line);
      if (e.kind === "issued") issued.set(e.key, e.at);
      if (e.kind === "confirmed") confirmed.add(e.key);
    }
  } catch { /* a fresh ledger starts empty */ }
  const append = (e) => fs.appendFileSync(path, JSON.stringify(e) + "\n");
  return {
    noteIssued: (key, uid) => { issued.set(key, Date.now()); append({ kind: "issued", key, uid, at: Date.now() }); },
    issuedAt: (key) => issued.get(key) || null,
    markConfirmed: (key, uid) => { confirmed.add(key); append({ kind: "confirmed", key, uid, at: Date.now() }); },
    hasConfirmed: (key) => confirmed.has(key),
  };
}

export function makeDeps({ projectId, creds, ledger }) {
  const budget = makeBudget({});
  const docRoot = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const readDoc = async (path, token) => {
    const res = await fetch(`${docRoot}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`firestore read ${res.status}`);
    const j = await res.json();
    return plain(j.fields);
  };
  const own = (method, key, expiresSec = 120) =>
    presign({ method, ...creds, key, expiresSec, nowMs: Date.now() });
  return {
    verifyToken: async (token) => {
      const c = verifyIdToken(token, { jwks: await fetchJwks(), nowMs: Date.now(), projectId });
      return c ? { ...c, uid: c.sub } : null;
    },
    readProfile: (uid, token) => readDoc(`profiles/${encodeURIComponent(uid)}`, token),
    readPair: (pairId, token) => readDoc(`relationships/${encodeURIComponent(pairId)}`, token),
    slotNamesKey,
    s3Head: async (key) => {
      const res = await fetch(own("GET", key), { headers: { Range: "bytes=0-0" } });
      if (res.status === 404) return null;
      if (!res.ok && res.status !== 206) throw new Error(`s3 head ${res.status}`);
      const cr = String(res.headers.get("content-range") || "");
      const total = cr.includes("/") ? Number(cr.split("/")[1]) : Number(res.headers.get("content-length"));
      return Number.isFinite(total) ? { size: total } : null;
    },
    s3HeadBytes: async (key, cnt) => {
      const res = await fetch(own("GET", key), { headers: { Range: `bytes=0-${cnt - 1}` } });
      if (!res.ok && res.status !== 206) throw new Error(`s3 read ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
    s3Delete: async (key) => {
      const res = await fetch(own("DELETE", key), { method: "DELETE" });
      if (!res.ok && res.status !== 204 && res.status !== 404) throw new Error(`s3 delete ${res.status}`);
    },
    creds,
    ledger,
    budgetTake: (uid) => budget.take(uid, Date.now()),
    log: (line) => console.log(new Date().toISOString(), line),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [credsPath, ledgerPath, projectId, portRaw] = process.argv.slice(2);
  const creds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
  const deps = makeDeps({ projectId, creds, ledger: makeLedger(ledgerPath) });
  const port = Number(portRaw) || 8123;
  await serve(deps, port, "0.0.0.0");
  console.log(`files gatekeeper on container :${port} for ${projectId}`);
}
