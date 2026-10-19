// Caresitters — the RevenueCat webhook receiver CORE
// (payments chapter §3/D3). Pure logic only: the HTTP
// shell that carries it (server.mjs, deployed on the box
// beside the files gatekeeper) feeds it webhook bodies
// and performs the writes it plans. The receiver is the
// ONLY writer of _entitlements/{uid} besides the owner's
// own pin; the client can read its own record and never
// write it (rules amended-v4/v5, live).
//
// The record shape is the chapter's §3 verbatim:
// app_user_id · entitlement · status · product · lane ·
// trial_ends_at · period_ends_at · expires_at ·
// updated_at · source_event_id. The unlock rule lives in
// accounts/account.js (entitlementFromRecord); this core
// only translates store events into that record.

export const ENTITLEMENT_IDS = ["finding", "family_plus", "search_pass"];
export const PRODUCT_TO_ENTITLEMENT = {
  caresitters_finding_monthly: "finding",
  caresitters_familyplus_monthly: "family_plus",
  caresitters_searchpass: "search_pass",
};

const STATUS_BY_TYPE = {
  INITIAL_PURCHASE: "active",
  RENEWAL: "active",
  UNCANCELLATION: "active",
  PRODUCT_CHANGE: "active",
  CANCELLATION: "cancelled",
  EXPIRATION: "expired",
  BILLING_ISSUE: "past_due",
};

const LANE_BY_STORE = {
  APP_STORE: "apple",
  MAC_APP_STORE: "apple",
  PLAY_STORE: "google",
  STRIPE: "web",
  RC_BILLING: "web",
  PROMOTIONAL: "web",
};

// The Search Pass window is purchase + 3 calendar months
// (chapter §4). Computed on the UTC calendar so a pass
// bought on 31 January ends 30 April, not 1 May.
export function addMonthsMs(ms, months) {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const daysInTarget = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, daysInTarget));
  return d.getTime();
}

function pickEntitlement(evt) {
  const ids = Array.isArray(evt.entitlement_ids) ? evt.entitlement_ids : [];
  for (const id of ids) if (ENTITLEMENT_IDS.includes(id)) return id;
  return PRODUCT_TO_ENTITLEMENT[evt.product_id] || null;
}

// recordFromEvent(body, nowMs) -> { uid, record } | null.
// null means: not an event this receiver writes (a TEST
// ping, an unknown type, an anonymous app user, or an
// entitlement outside this app's three).
export function recordFromEvent(body, nowMs) {
  const evt = body && typeof body === "object" ? body.event : null;
  if (!evt || typeof evt !== "object") return null;
  if (!evt.id || !evt.type) return null;
  let status = STATUS_BY_TYPE[evt.type];
  if (!status) return null;
  const uid = typeof evt.app_user_id === "string" ? evt.app_user_id : "";
  if (!uid || uid.startsWith("$RCAnonymousID")) return null;
  const entitlement = pickEntitlement(evt);
  if (!entitlement) return null;
  if (status === "active" && evt.period_type === "TRIAL") status = "trialing";
  const purchased = typeof evt.purchased_at_ms === "number" ? evt.purchased_at_ms : null;
  const expiration = typeof evt.expiration_at_ms === "number" ? evt.expiration_at_ms : null;
  const record = {
    app_user_id: uid,
    entitlement,
    status,
    product: typeof evt.product_id === "string" ? evt.product_id : null,
    lane: LANE_BY_STORE[evt.store] || null,
    trial_ends_at: evt.period_type === "TRIAL" ? expiration : null,
    period_ends_at: entitlement === "search_pass" ? null : expiration,
    expires_at: entitlement === "search_pass"
      ? (expiration ?? (purchased != null ? addMonthsMs(purchased, 3) : null))
      : null,
    updated_at: typeof evt.event_timestamp_ms === "number" ? evt.event_timestamp_ms : (typeof nowMs === "number" ? nowMs : null),
    source_event_id: evt.id,
  };
  return { uid, record };
}

// The Authorization header value RevenueCat sends is a
// shared secret set in their dashboard and held in box
// custody; the comparison is constant-time and total
// (never throws on odd input).
export function authoriseWebhook(headerValue, expected) {
  if (typeof headerValue !== "string" || typeof expected !== "string" || !expected) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
