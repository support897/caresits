import { createRemoteJWKSet, jwtVerify, SignJWT, importPKCS8 } from "jose";
const PROJECT = "caresits-812a0";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const SITE = "https://caresitters-web.placenciailse.workers.dev";
const FEE = 0.10;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...cors } });

async function who(req) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!t) return null;
  try { const { payload } = await jwtVerify(t, JWKS, { issuer: "https://securetoken.google.com/" + PROJECT, audience: PROJECT }); return { uid: payload.sub, token: t }; } catch { return null; }
}
// Firestore REST as the caller, so the live rules decide what they can read.
async function fsGet(path, token) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${path}`, { headers: { authorization: "Bearer " + token } });
  if (!r.ok) return null;
  return r.json();
}
const val = (f) => !f ? undefined : f.stringValue ?? (f.integerValue !== undefined ? Number(f.integerValue) : undefined) ?? f.doubleValue ?? f.timestampValue ?? f.booleanValue;
const fld = (d, k) => val(d?.fields?.[k]);

// ---------- APNs ----------
let apnsJwt = null, apnsAt = 0;
async function apnsAuth(env) {
  if (apnsJwt && Date.now() - apnsAt < 40 * 60 * 1000) return apnsJwt;
  const key = await importPKCS8(env.APNS_KEY_P8, "ES256");
  apnsJwt = await new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: env.APNS_KEY_ID }).setIssuer(env.APNS_TEAM_ID).setIssuedAt().sign(key);
  apnsAt = Date.now(); return apnsJwt;
}
async function push(env, token, title, body, data) {
  const jwt = await apnsAuth(env);
  const payload = JSON.stringify({ aps: { alert: { title, body }, sound: "default" }, ...data });
  for (const host of ["api.push.apple.com", "api.sandbox.push.apple.com"]) {
    const r = await fetch(`https://${host}/3/device/${token}`, { method: "POST", headers: { authorization: "bearer " + jwt, "apns-topic": "com.ilse.caresits", "apns-push-type": "alert", "apns-priority": "10" }, body: payload });
    if (r.ok) return true;
    const t = await r.text();
    if (!/BadDeviceToken|DeviceTokenNotForTopic/.test(t)) { if (/Unregistered/.test(t)) return "gone"; return false; }
  }
  return false;
}

// ---------- Stripe ----------
async function stripe(env, path, params, method = "POST") {
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const r = await fetch("https://api.stripe.com/v1/" + path, { method, headers: { authorization: "Bearer " + env.STRIPE_SECRET_KEY, "content-type": "application/x-www-form-urlencoded" }, body });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "stripe error");
  return j;
}
async function verifySig(raw, sig, secret) {
  const parts = Object.fromEntries(sig.split(",").map(p => p.split("=")));
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(parts.t + "." + raw));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === parts.v1;
}
async function release(env, bookingId) {
  const p = JSON.parse((await env.KV.get("p:" + bookingId)) || "null");
  if (!p || p.status !== "held") return { ok: false, why: "not held" };
  const acct = await env.KV.get("c:" + p.carerUid);
  if (!acct) return { ok: false, why: "carer has no payout account" };
  await stripe(env, "transfers", { amount: String(p.carerCents), currency: p.currency, destination: acct, transfer_group: bookingId, "metadata[bookingId]": bookingId });
  p.status = "released"; p.releasedAt = Date.now();
  await env.KV.put("p:" + bookingId, JSON.stringify(p));
  return { ok: true };
}

async function bumpStat(env, uid, k) {
  const s = JSON.parse((await env.KV.get("s:" + uid)) || '{"done":0,"cancelled":0}'); s[k] = (s[k] || 0) + 1; await env.KV.put("s:" + uid, JSON.stringify(s));
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const u = new URL(req.url); const path = u.pathname;
    try {
      if (path === "/health") return J({ ok: true, push: !!env.APNS_KEY_P8, pay: !!env.STRIPE_SECRET_KEY });
      if (path === "/stripe/webhook" && req.method === "POST") {
        const raw = await req.text();
        if (!env.STRIPE_WEBHOOK_SECRET || !(await verifySig(raw, req.headers.get("stripe-signature") || "", env.STRIPE_WEBHOOK_SECRET))) return J({ error: "sig" }, 400);
        const ev = JSON.parse(raw);
        if (ev.type === "checkout.session.completed") {
          const s = ev.data.object; const m = s.metadata || {};
          if (m.bookingId) await env.KV.put("p:" + m.bookingId, JSON.stringify({ status: "held", carerUid: m.carerUid, familyUid: m.familyUid, carerCents: Number(m.carerCents), feeCents: Number(m.feeCents), currency: s.currency, endAt: Number(m.endAt), paidAt: Date.now() }));
        }
        return J({ ok: true });
      }
      if (path === "/stats" && req.method === "GET") {
        const s = JSON.parse((await env.KV.get("s:" + u.searchParams.get("uid"))) || '{"done":0,"cancelled":0}');
        return J(s);
      }
      if (path === "/pay/status" && req.method === "GET") {
        const p = JSON.parse((await env.KV.get("p:" + u.searchParams.get("bookingId"))) || "null");
        return J({ status: p ? p.status : "unpaid" });
      }
      const me = await who(req);
      if (!me) return J({ error: "sign in" }, 401);
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

      if (path === "/register") {
        if (!/^[0-9a-fA-F]{32,200}$/.test(body.token || "")) return J({ error: "bad token" }, 400);
        const list = JSON.parse((await env.KV.get("d:" + me.uid)) || "[]").filter(t => t !== body.token); list.unshift(body.token);
        await env.KV.put("d:" + me.uid, JSON.stringify(list.slice(0, 5)));
        return J({ ok: true });
      }
      if (path === "/unregister") { await env.KV.delete("d:" + me.uid); return J({ ok: true }); }
      if (path === "/notify") {
        const to = String(body.toUid || ""); if (!to || to === me.uid) return J({ ok: false });
        const kind = body.kind || "message";
        if (body.relId) {
          const rel = await fsGet("relationships/" + encodeURIComponent(body.relId), me.token);
          const fam = fld(rel, "familyUid"), car = fld(rel, "carerUid");
          if (!rel || ![fam, car].includes(me.uid) || ![fam, car].includes(to)) return J({ error: "not allowed" }, 403);
        }
        const rl = `n:${me.uid}:${to}:${kind}`;
        if (await env.KV.get(rl)) return J({ ok: true, skipped: "rate" });
        await env.KV.put(rl, "1", { expirationTtl: 60 });
        const titles = { message: "New message", heart: "Someone hearted you", job: "New reply on your urgent job", booking: "Booking update", call: "Call request" };
        const title = titles[kind] || "Caresitters";
        const text = String(body.text || "Open Caresitters").slice(0, 120);
        const list = JSON.parse((await env.KV.get("d:" + to)) || "[]"); const keep = [];
        for (const t of list) { const r = await push(env, t, title, text, { kind, relId: body.relId || "" }); if (r !== "gone") keep.push(t); }
        if (keep.length !== list.length) await env.KV.put("d:" + to, JSON.stringify(keep));
        return J({ ok: true, sent: list.length });
      }
      if (path === "/stats/event") {
        const { pairId, bookingId } = body;
        if (await env.KV.get("e:" + bookingId)) return J({ ok: true, dup: true });
        const b = await fsGet(`relationships/${encodeURIComponent(pairId)}/bookings/${encodeURIComponent(bookingId)}`, me.token);
        if (!b) return J({ error: "not found" }, 404);
        const st = fld(b, "state"), fam = fld(b, "familyUid"), car = fld(b, "carerUid");
        if (![fam, car].includes(me.uid)) return J({ error: "no" }, 403);
        if (st === "completed") { await bumpStat(env, car, "done"); await bumpStat(env, fam, "done"); }
        else if (st === "cancelled") { const by = fld(b, "cancelledBy") || me.uid; await bumpStat(env, by, "cancelled"); }
        else return J({ ok: false, state: st });
        await env.KV.put("e:" + bookingId, "1");
        return J({ ok: true });
      }
      if (!env.STRIPE_SECRET_KEY) return J({ error: "payments not switched on yet" }, 503);
      if (path === "/pay/onboard") {
        let acct = await env.KV.get("c:" + me.uid);
        if (!acct) { const a = await stripe(env, "accounts", { type: "express", "capabilities[transfers][requested]": "true", "metadata[uid]": me.uid }); acct = a.id; await env.KV.put("c:" + me.uid, acct); }
        const l = await stripe(env, "account_links", { account: acct, refresh_url: SITE + "/app?pay=refresh", return_url: SITE + "/app?pay=done", type: "account_onboarding" });
        return J({ url: l.url });
      }
      if (path === "/pay/ready") {
        const acct = await env.KV.get("c:" + (body.uid || me.uid)); if (!acct) return J({ ready: false });
        const a = await stripe(env, "accounts/" + acct, null, "GET");
        return J({ ready: !!a.payouts_enabled });
      }
      if (path === "/pay/checkout") {
        const { pairId, bookingId } = body;
        const b = await fsGet(`relationships/${encodeURIComponent(pairId)}/bookings/${encodeURIComponent(bookingId)}`, me.token);
        if (!b || fld(b, "familyUid") !== me.uid) return J({ error: "not yours" }, 403);
        if (fld(b, "state") !== "accepted") return J({ error: "Carer must accept first" }, 400);
        const carerUid = fld(b, "carerUid");
        if (!(await env.KV.get("c:" + carerUid))) return J({ error: "Carer has not set up payouts yet" }, 400);
        const est = Number(fld(b, "estimate") || 0); const carerCents = Math.round(est * 100); const feeCents = Math.round(carerCents * FEE);
        if (carerCents < 500) return J({ error: "amount too small" }, 400);
        const endAt = Date.parse(fld(b, "endAt") || "") || Date.now() + 86400000;
        const s = await stripe(env, "checkout/sessions", {
          mode: "payment", "payment_method_types[0]": "card",
          "line_items[0][price_data][currency]": "aud", "line_items[0][price_data][product_data][name]": "Care booking", "line_items[0][price_data][unit_amount]": String(carerCents), "line_items[0][quantity]": "1",
          "line_items[1][price_data][currency]": "aud", "line_items[1][price_data][product_data][name]": "Caresitters service fee", "line_items[1][price_data][unit_amount]": String(feeCents), "line_items[1][quantity]": "1",
          "payment_intent_data[transfer_group]": bookingId,
          "metadata[bookingId]": bookingId, "metadata[carerUid]": carerUid, "metadata[familyUid]": me.uid, "metadata[carerCents]": String(carerCents), "metadata[feeCents]": String(feeCents), "metadata[endAt]": String(endAt),
          success_url: SITE + "/app?pay=done", cancel_url: SITE + "/app?pay=cancel",
        });
        return J({ url: s.url });
      }
      if (path === "/pay/release") {
        const { pairId, bookingId } = body;
        const b = await fsGet(`relationships/${encodeURIComponent(pairId)}/bookings/${encodeURIComponent(bookingId)}`, me.token);
        if (!b || fld(b, "familyUid") !== me.uid) return J({ error: "not yours" }, 403);
        return J(await release(env, bookingId));
      }
      return J({ error: "not found" }, 404);
    } catch (e) { return J({ error: String(e.message || e) }, 500); }
  },
  // Auto release 24 hours after the booking ends.
  async scheduled(_e, env) {
    if (!env.STRIPE_SECRET_KEY) return;
    let cursor; do {
      const l = await env.KV.list({ prefix: "p:", cursor }); cursor = l.list_complete ? undefined : l.cursor;
      for (const k of l.keys) { const p = JSON.parse((await env.KV.get(k.name)) || "null"); if (p && p.status === "held" && Date.now() > p.endAt + 24 * 3600 * 1000) await release(env, k.name.slice(2)).catch(() => {}); }
    } while (cursor);
  },
};
