// Caresitters file service: one Cloudflare Worker + one private R2 bucket (binding BUCKET).
// Secret: SIGNING_SECRET. Optional vars: PROJECT_ID (default caresits-812a0).
// Same protocol the apps already speak: POST /v1/link, PUT /put, POST /v1/confirm, GET /get.
// Privacy: nothing is public. Every read goes through a 10-minute signed link issued only after the checks below.
const PROJECT = (env) => env.PROJECT_ID || "caresits-812a0";
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const FOLDER = { avatar: "photos", photo: "gallery", child: "children", intro: "videos", qual: "documents", attachment: "attachments" };
const LIMITS = { photos: 6e6, gallery: 6e6, children: 6e6, videos: 52428800, documents: 10485760, attachments: 6e6 };
const PUBLIC_TO_SIGNED_IN = new Set(["photos", "gallery", "videos"]);
const NAME = /^(avatar|photo|child|intro|qual|attachment)-[A-Za-z0-9_-]{1,80}\.(jpg|pdf|mp4|mov|webm)$/;
const SEG = /^[A-Za-z0-9_-]{1,128}$/;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,PUT,POST,OPTIONS", "access-control-max-age": "86400" };
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { ...cors, "content-type": "application/json", "cache-control": "no-store" } });
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

let jwks = null, jwksAt = 0;
async function keys(fetcher) {
  if (jwks && Date.now() - jwksAt < 3600e3) return jwks;
  const r = await fetcher(JWKS_URL); if (!r.ok) throw new Error("jwks");
  jwks = (await r.json()).keys; jwksAt = Date.now(); return jwks;
}
export async function verifyToken(token, env, fetcher = fetch, now = Date.now()) {
  const parts = String(token).split("."); if (parts.length !== 3) return null;
  let header, claims; try { header = JSON.parse(new TextDecoder().decode(unb64u(parts[0]))); claims = JSON.parse(new TextDecoder().decode(unb64u(parts[1]))); } catch { return null; }
  if (header.alg !== "RS256" || !header.kid) return null;
  const jwk = (await keys(fetcher)).find((k) => k.kid === header.kid); if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, unb64u(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) return null;
  const p = PROJECT(env), s = Math.floor(now / 1000);
  if (claims.aud !== p || claims.iss !== `https://securetoken.google.com/${p}` || !claims.sub || claims.exp < s || claims.iat > s + 300) return null;
  return { uid: claims.sub };
}
async function hmac(env, text) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SIGNING_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text)));
}
const safeEq = (a, b) => a.length === b.length && [...a].reduce((n, c, i) => n | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
async function isSpaceMember(env, token, spaceId, uid, fetcher) {
  if (!SEG.test(spaceId)) return false;
  const r = await fetcher(`https://firestore.googleapis.com/v1/projects/${PROJECT(env)}/databases/(default)/documents/careSpaces/${spaceId}/members/${uid}`, { headers: { authorization: `Bearer ${token}` } });
  return r.status === 200;
}
function hasExif(b) { for (let i = 2; i + 4 < b.length;) { if (b[i] !== 0xff) break; const m = b[i + 1]; if (m === 0xda) break; const len = (b[i + 2] << 8) | b[i + 3]; if (m === 0xe1 && String.fromCharCode(...b.slice(i + 4, i + 8)) === "Exif") return true; i += 2 + len; } return false; }
function planKey(b) {
  const m = NAME.exec(b.name || ""); if (!m) return null;
  const folder = FOLDER[m[1]]; if (!folder) return null;
  if (b.class === "space-media") { if (!SEG.test(b.spaceId || "")) return null; return { key: `spaces/${b.spaceId}/${folder}/${b.name}`, folder, space: b.spaceId }; }
  if (!SEG.test(b.ownerUid || "")) return null;
  return { key: `users/${b.ownerUid}/${folder}/${b.name}`, folder, owner: b.ownerUid };
}

export default {
  async fetch(req, env, _ctx, fetcher = fetch) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/health") return json(200, { ok: true });
    try {
      if (req.method === "POST" && (url.pathname === "/v1/link" || url.pathname === "/v1/confirm")) {
        const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
        const who = token && await verifyToken(token, env, fetcher); if (!who) return json(401, { error: "no token" });
        const b = await req.json().catch(() => null); if (!b) return json(400, { error: "bad body" });
        if (url.pathname === "/v1/link" && b.op === "get") {
          const key = String(b.key || ""); const seg = key.split("/");
          if (key.includes("..") || seg.length !== 4 || !["users", "spaces"].includes(seg[0]) || !SEG.test(seg[1]) || !NAME.test(seg[3])) return json(400, { error: "bad key" });
          let allowed = false;
          if (seg[0] === "users") allowed = seg[1] === who.uid || PUBLIC_TO_SIGNED_IN.has(seg[2]);
          else allowed = await isSpaceMember(env, token, seg[1], who.uid, fetcher);
          if (!allowed) return json(403, { error: "no access" });
          if (!(await env.BUCKET.head(key))) return json(404, { error: "none" });
          const exp = Math.floor(Date.now() / 1000) + 600;
          return json(200, { url: `${url.origin}/get?key=${encodeURIComponent(key)}&exp=${exp}&sig=${await hmac(env, `GET|${key}|${exp}`)}`, expiresIn: 600 });
        }
        const plan = planKey(b); if (!plan) return json(400, { error: "bad name" });
        if (plan.owner && plan.owner !== who.uid) return json(403, { error: "not yours" });
        if (plan.space && !(await isSpaceMember(env, token, plan.space, who.uid, fetcher))) return json(403, { error: "not a member" });
        if (url.pathname === "/v1/link") {
          const bytes = Number(b.bytes); if (!Number.isInteger(bytes) || bytes <= 0 || bytes > LIMITS[plan.folder]) return json(413, { error: "bad size" });
          const exp = Math.floor(Date.now() / 1000) + 300;
          const sig = await hmac(env, `PUT|${plan.key}|${bytes}|${exp}`);
          return json(200, { url: `${url.origin}/put?key=${encodeURIComponent(plan.key)}&bytes=${bytes}&exp=${exp}&sig=${sig}`, headers: { "content-type": String(b.contentType || "application/octet-stream") }, expiresIn: 300, key: plan.key });
        }
        const head = await env.BUCKET.head(plan.key); return json(head ? 200 : 404, { ok: !!head });
      }
      if (req.method === "PUT" && url.pathname === "/put") {
        const key = url.searchParams.get("key") || "", bytes = Number(url.searchParams.get("bytes")), exp = Number(url.searchParams.get("exp")), sig = url.searchParams.get("sig") || "";
        if (exp < Date.now() / 1000) return json(409, { error: "expired" });
        if (!safeEq(sig, await hmac(env, `PUT|${key}|${bytes}|${exp}`))) return json(403, { error: "bad link" });
        const body = new Uint8Array(await req.arrayBuffer()); if (body.length !== bytes) return json(413, { error: "bad size" });
        const ext = key.split(".").pop();
        if (ext === "jpg") { if (body[0] !== 0xff || body[1] !== 0xd8) return json(422, { error: "not a jpeg" }); if (hasExif(body)) return json(422, { error: "exif" }); }
        if (ext === "pdf" && String.fromCharCode(...body.slice(0, 5)) !== "%PDF-") return json(422, { error: "not a pdf" });
        await env.BUCKET.put(key, body, { httpMetadata: { contentType: ext === "jpg" ? "image/jpeg" : ext === "pdf" ? "application/pdf" : ext === "webm" ? "video/webm" : ext === "mov" ? "video/quicktime" : "video/mp4" } });
        return json(200, { ok: true });
      }
      if (req.method === "GET" && url.pathname === "/get") {
        const key = url.searchParams.get("key") || "", exp = Number(url.searchParams.get("exp")), sig = url.searchParams.get("sig") || "";
        if (exp < Date.now() / 1000) return json(409, { error: "expired" });
        if (!safeEq(sig, await hmac(env, `GET|${key}|${exp}`))) return json(403, { error: "bad link" });
        const obj = await env.BUCKET.get(key); if (!obj) return json(404, { error: "none" });
        return new Response(obj.body, { headers: { ...cors, "content-type": obj.httpMetadata?.contentType || "application/octet-stream", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-disposition": "inline" } });
      }
      return json(404, { error: "nf" });
    } catch { return json(500, { error: "server" }); }
  },
};
