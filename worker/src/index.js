import { createRemoteJWKSet, jwtVerify, SignJWT, importPKCS8 } from "jose";
const PROJECT = "caresits-812a0";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const SITE = "https://caresitters-web.placenciailse.workers.dev";
const FEE = 0.15, FEE_FIXED = 100, TERMS_V = "2026-11-25"; // fee = 15% of care + A$1: covers worst-case Stripe card + payout cost plus Caresitters 10%
const feeFor = (care) => Math.round(care * FEE) + FEE_FIXED;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...cors } });

async function who(req) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!t) return null;
  try { const { payload } = await jwtVerify(t, JWKS, { issuer: "https://securetoken.google.com/" + PROJECT, audience: PROJECT }); return { uid: payload.sub, token: t, email: payload.email }; } catch { return null; }
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
async function stripe2(env, path, body, method = "POST") {
  const r = await fetch("https://api.stripe.com/v2/" + path, { method, headers: { authorization: "Bearer " + env.STRIPE_SECRET_KEY, "content-type": "application/json", "stripe-version": "2026-12-16.preview" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "stripe v2 error");
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
  let charge = null;
  if (p.pi) { const pi = await stripe(env, "payment_intents/" + p.pi, null, "GET"); charge = pi.latest_charge; }
  else { const l = await stripe(env, "charges?transfer_group=" + encodeURIComponent(bookingId) + "&limit=1", null, "GET"); charge = l.data && l.data[0] && l.data[0].id; }
  const tp = { amount: String(p.carerCents), currency: p.currency, destination: acct, transfer_group: bookingId, "metadata[bookingId]": bookingId };
  if (charge) tp.source_transaction = charge;
  const tr = await stripe(env, "transfers", tp);
  if (tr.error) return { ok: false, why: tr.error.message || "transfer failed" };
  p.status = "released"; p.releasedAt = Date.now();
  await env.KV.put("p:" + bookingId, JSON.stringify(p));
  return { ok: true };
}


// Cancel rules: carer cancels = full refund. Family cancels 24h+ before start = full refund.
// Family cancels under 24h = carer keeps 50% of care cost, family gets the rest back, fee kept.
async function cancelRefund(env, bookingId, b, by) {
  const p = JSON.parse((await env.KV.get("p:" + bookingId)) || "null");
  if (!p) return { ok: true, status: "unpaid" };
  if (p.status !== "held") return { ok: false, why: "already " + p.status };
  const startMs = Date.parse(fld(b, "date") + "T" + fld(b, "from") + ":00Z") - 8 * 3600e3;
  const byFamily = by === p.familyUid, late = byFamily && startMs - Date.now() < 24 * 3600e3;
  const pi = await stripe(env, "payment_intents/" + p.pi, null, "GET");
  const acct = await env.KV.get("c:" + p.carerUid);
  const refund = (cents) => stripe(env, "refunds", { payment_intent: p.pi, amount: String(cents), "metadata[bookingId]": bookingId });
  if (!byFamily) { await refund(p.carerCents + p.feeCents); p.status = "refunded"; await bumpStat(env, p.carerUid, "strikes"); }   // carer cancels: all back, carer gets a strike
  else if (!late) { await refund(p.carerCents); p.status = "refunded"; }                                                           // family 24h+: care price back, fee kept
  else {                                                                                                                              // family under 24h: carer 50%, family 50%, fee kept
    const share = Math.round(p.carerCents * 0.5), back = p.carerCents - share;
    if (back > 0) await refund(back);
    if (acct && share > 0) await stripe(env, "transfers", { amount: String(share), currency: p.currency, destination: acct, transfer_group: bookingId, source_transaction: pi.latest_charge, "metadata[bookingId]": bookingId });
    p.status = "late_cancel";
  }
  p.cancelledAt = Date.now(); await env.KV.put("p:" + bookingId, JSON.stringify(p));
  return { ok: true, status: p.status };
}
async function pushTo(env, uid, title, text) {
  const list = JSON.parse((await env.KV.get("d:" + uid)) || "[]");
  for (const t of list) await push(env, t, title, text, { kind: "booking" }).catch(() => {});
}

async function bumpStat(env, uid, k) {
  const s = JSON.parse((await env.KV.get("s:" + uid)) || '{"done":0,"cancelled":0}'); s[k] = (s[k] || 0) + 1; await env.KV.put("s:" + uid, JSON.stringify(s));
  if (k === "strikes") {   // strike ladder: 1-2 warning, 3 = paused 14 days, 5 = account closed
    if (s.strikes >= 5) { await env.KV.put("ban:" + uid, "closed"); await pushTo(env, uid, "Account closed", "Your carer account was closed after 5 strikes. You can appeal by email."); }
    else if (s.strikes >= 3) { await env.KV.put("ban:" + uid, "paused", { expirationTtl: 14 * 86400 }); await pushTo(env, uid, "Account paused", "3 strikes. New bookings are paused for 14 days."); }
    else await pushTo(env, uid, "Strike " + s.strikes, "A cancel or no-show gives a strike. 3 strikes pause you, 5 close your account.");
  }
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
          if (m.bookingId) await env.KV.put("p:" + m.bookingId, JSON.stringify({ status: "held", carerUid: m.carerUid, familyUid: m.familyUid, carerCents: Number(m.carerCents), feeCents: Number(m.feeCents), currency: s.currency, pi: s.payment_intent, endAt: Number(m.endAt), paidAt: Date.now() }));
        }
        return J({ ok: true });
      }
      if (path === "/stats" && req.method === "GET") {
        const s = JSON.parse((await env.KV.get("s:" + u.searchParams.get("uid"))) || '{"done":0,"cancelled":0}');
        s.status = (await env.KV.get("ban:" + u.searchParams.get("uid"))) || "ok";
        return J(s);
      }
      if (path === "/pay/status" && req.method === "GET") {
        const p = JSON.parse((await env.KV.get("p:" + u.searchParams.get("bookingId"))) || "null");
        return J({ status: p ? p.status : "unpaid", requested: !!(p && p.requestedAt) });
      }
      if (path === "/admin/disputes" || path === "/admin/resolve") {
        if (!env.ADMIN_KEY || req.headers.get("x-admin-key") !== env.ADMIN_KEY) return J({ error: "no" }, 403);
        if (path === "/admin/disputes") { const out = []; const l = await env.KV.list({ prefix: "x:" }); for (const k of l.keys) { const id = k.name.slice(2); const p = JSON.parse((await env.KV.get("p:" + id)) || "null"); if (p && p.status === "disputed") out.push({ bookingId: id, ...p }); } return J(out); }
        const rb = await req.json().catch(() => ({})); const id = rb.bookingId; const p = JSON.parse((await env.KV.get("p:" + id)) || "null");
        if (!p || p.status !== "disputed") return J({ error: "not disputed" }, 400);
        const refund = (c) => stripe(env, "refunds", { payment_intent: p.pi, amount: String(c), "metadata[bookingId]": id });
        if (rb.action === "refund") { await refund(p.carerCents + p.feeCents); p.status = "refunded"; }
        else if (rb.action === "split") { const c = Math.max(0, Math.min(p.carerCents, Number(rb.carerCents || 0))); if (p.carerCents - c > 0) await refund(p.carerCents - c); const acct = await env.KV.get("c:" + p.carerUid); const pi = await stripe(env, "payment_intents/" + p.pi, null, "GET"); if (c > 0) await stripe(env, "transfers", { amount: String(c), currency: p.currency, destination: acct, transfer_group: id, source_transaction: pi.latest_charge }); p.status = "split"; }
        else if (rb.action === "release") { p.status = "held"; await env.KV.put("p:" + id, JSON.stringify(p)); const r = await release(env, id); return J(r); }
        else return J({ error: "action: refund | split | release" }, 400);
        await env.KV.put("p:" + id, JSON.stringify(p)); await env.KV.delete("x:" + id); return J({ ok: true, status: p.status });
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
      if (path === "/terms/status") return J({ ok: (await env.KV.get("t:" + me.uid)) === TERMS_V, version: TERMS_V });
      if (path === "/terms/accept") { await env.KV.put("t:" + me.uid, TERMS_V); await env.KV.put("ta:" + me.uid + ":" + TERMS_V, new Date().toISOString()); return J({ ok: true }); }
      if (path === "/pay/onboard") {
        if ((await env.KV.get("t:" + me.uid)) !== TERMS_V) return J({ error: "Please agree to the payment terms first", terms: true }, 403);
        let acct = await env.KV.get("c:" + me.uid);
        if (!acct) {
          const a = await stripe2(env, "core/accounts", { contact_email: me.email || "carer@caresits.xyz", display_name: "Caresitters carer", identity: { country: "AU" }, dashboard: "express", defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" }, currency: "aud" }, configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } }, metadata: { uid: me.uid } });
          acct = a.id; await env.KV.put("c:" + me.uid, acct);
          await stripe(env, "accounts/" + acct, { "settings[payouts][schedule][interval]": "daily", "settings[payouts][schedule][delay_days]": "7" }).catch(() => {});   // 7 day payout delay
        }
        const l = await stripe2(env, "core/account_links", { account: acct, use_case: { type: "account_onboarding", account_onboarding: { refresh_url: SITE + "/app?pay=refresh", return_url: SITE + "/app?pay=done" } } });
        return J({ url: l.url });
      }
      if (path === "/pay/ready") {
        const acct = await env.KV.get("c:" + (body.uid || me.uid)); if (!acct) return J({ ready: false });
        const a = await stripe(env, "accounts/" + acct, null, "GET");
        return J({ ready: !!a.payouts_enabled });
      }
      if (path === "/pay/checkout") {
        if ((await env.KV.get("t:" + me.uid)) !== TERMS_V) return J({ error: "Please agree to the payment terms first", terms: true }, 403);
        const { pairId, bookingId } = body;
        const b = await fsGet(`relationships/${encodeURIComponent(pairId)}/bookings/${encodeURIComponent(bookingId)}`, me.token);
        if (!b || fld(b, "familyUid") !== me.uid) return J({ error: "not yours" }, 403);
        if (fld(b, "state") !== "accepted") return J({ error: "Carer must accept first" }, 400);
        const carerUid = fld(b, "carerUid");
        if (!(await env.KV.get("c:" + carerUid))) return J({ error: "Carer has not set up payouts yet" }, 400);
        if (await env.KV.get("ban:" + carerUid)) return J({ error: "This carer is not taking bookings right now" }, 400);
        const est = Number(fld(b, "estimate") || 0); const carerCents = Math.round(est * 100); const feeCents = feeFor(carerCents);
        if (carerCents < 500) return J({ error: "amount too small" }, 400);
        if (carerCents > 50000) return J({ error: "Bookings are limited to A$500 for now" }, 400);
        const endAt = Date.parse(fld(b, "endAt") || "") || Date.now() + 86400000;
        const s = await stripe(env, "checkout/sessions", {
          mode: "payment",
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
      if (path === "/pay/request") {            // carer asks to be paid after the shift
        const { pairId, bookingId } = body;
        const b = await fsGet(`relationships/${encodeURIComponent(pairId)}/bookings/${encodeURIComponent(bookingId)}`, me.token);
        if (!b || fld(b, "carerUid") !== me.uid) return J({ error: "not yours" }, 403);
        const p = JSON.parse((await env.KV.get("p:" + bookingId)) || "null");
        if (!p || p.status !== "held") return J({ error: "nothing to request" }, 400);
        if (Date.now() < p.endAt - 30 * 60e3) return J({ error: "The shift has not ended yet" }, 400);
        p.requestedAt = p.requestedAt || Date.now(); await env.KV.put("p:" + bookingId, JSON.stringify(p));
        await pushTo(env, p.familyUid, "Payment requested", "Your carer finished. Release the payment or report a problem.");
        return J({ ok: true });
      }
      if (path === "/pay/dispute") {            // family freezes the money
        const { pairId, bookingId, note } = body;
        const b = await fsGet(`relationships/${encodeURIComponent(pairId)}/bookings/${encodeURIComponent(bookingId)}`, me.token);
        if (!b || fld(b, "familyUid") !== me.uid) return J({ error: "not yours" }, 403);
        const p = JSON.parse((await env.KV.get("p:" + bookingId)) || "null");
        if (!p || p.status !== "held") return J({ error: "Too late to report. The money is already released or refunded." }, 400);
        p.status = "disputed"; p.note = String(note || "").slice(0, 500); p.disputedAt = Date.now();
        await env.KV.put("p:" + bookingId, JSON.stringify(p)); await env.KV.put("x:" + bookingId, "1");
        return J({ ok: true, status: "disputed" });
      }
      if (path === "/pay/cancel") {
        const { pairId, bookingId } = body;
        const b = await fsGet(`relationships/${encodeURIComponent(pairId)}/bookings/${encodeURIComponent(bookingId)}`, me.token);
        if (!b || ![fld(b, "familyUid"), fld(b, "carerUid")].includes(me.uid)) return J({ error: "not yours" }, 403);
        if (fld(b, "state") !== "cancelled") return J({ error: "cancel the booking first" }, 400);
        return J(await cancelRefund(env, bookingId, b, me.uid));
      }
      return J({ error: "not found" }, 404);
    } catch (e) { return J({ error: String(e.message || e) }, 500); }
  },
  // Every 30 min: remind family at 12h, auto release 24h after the carer's request, refund family if carer never requests within 48h of the shift end.
  async scheduled(_e, env) {
    if (!env.STRIPE_SECRET_KEY) return;
    let cursor; do {
      const l = await env.KV.list({ prefix: "p:", cursor }); cursor = l.list_complete ? undefined : l.cursor;
      for (const k of l.keys) {
        const p = JSON.parse((await env.KV.get(k.name)) || "null"); if (!p || p.status !== "held") continue; const id = k.name.slice(2);
        try {
          if (p.requestedAt) {
            if (!p.reminded && Date.now() > p.requestedAt + 12 * 3600e3) { p.reminded = true; await env.KV.put(k.name, JSON.stringify(p)); await pushTo(env, p.familyUid, "Release payment?", "Your carer is waiting. It releases on its own in 12 hours."); }
            if (Date.now() > p.requestedAt + 24 * 3600e3) await release(env, id);
          } else if (Date.now() > p.endAt + 48 * 3600e3) {
            await stripe(env, "refunds", { payment_intent: p.pi, "metadata[bookingId]": id }); p.status = "refunded"; await env.KV.put(k.name, JSON.stringify(p)); await bumpStat(env, p.carerUid, "strikes"); await bumpStat(env, p.carerUid, "cancelled");
          }
        } catch (e) {}
      }
    } while (cursor);
  },
};
