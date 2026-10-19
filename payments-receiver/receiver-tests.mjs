// Caresitters payments receiver core — fake-event legs.
// Run: node receiver-tests.mjs  (no network, no stores)
import assert from "node:assert/strict";
import { recordFromEvent, authoriseWebhook, addMonthsMs } from "./receiver.mjs";

let n = 0, bad = 0;
function t(name, fn) { n++; try { fn(); } catch (e) { bad++; console.log("FAIL:", name, "-", String(e.message).split("\n")[0]); } }
const NOW = Date.UTC(2026, 9, 19, 12, 0, 0);
const base = {
  id: "evt-1", type: "INITIAL_PURCHASE", app_user_id: "firebase-uid-1",
  product_id: "caresitters_finding_monthly", entitlement_ids: ["finding"],
  period_type: "NORMAL", purchased_at_ms: NOW, expiration_at_ms: NOW + 30 * 86400000,
  event_timestamp_ms: NOW, store: "APP_STORE", environment: "PRODUCTION",
};
const wrap = (event) => ({ api_version: "1.0", event });

t("a Finding purchase writes the section 3 record, active, apple lane", () => {
  const out = recordFromEvent(wrap(base), NOW);
  assert.deepEqual(out, {
    uid: "firebase-uid-1",
    record: {
      app_user_id: "firebase-uid-1", entitlement: "finding", status: "active",
      product: "caresitters_finding_monthly", lane: "apple",
      trial_ends_at: null, period_ends_at: NOW + 30 * 86400000,
      expires_at: null, updated_at: NOW, source_event_id: "evt-1",
    },
  });
});
t("Family Plus maps from its product when entitlement ids are absent", () => {
  const out = recordFromEvent(wrap({ ...base, product_id: "caresitters_familyplus_monthly", entitlement_ids: undefined }), NOW);
  assert.equal(out.record.entitlement, "family_plus");
});
t("a TRIAL period type reads trialing with trial_ends_at (no store trial exists; the mapping stays honest)", () => {
  const out = recordFromEvent(wrap({ ...base, period_type: "TRIAL" }), NOW);
  assert.equal(out.record.status, "trialing");
  assert.equal(out.record.trial_ends_at, NOW + 30 * 86400000);
});
t("cancellation keeps the period end (the adapter opens until it, then shuts)", () => {
  const out = recordFromEvent(wrap({ ...base, type: "CANCELLATION" }), NOW);
  assert.equal(out.record.status, "cancelled");
  assert.equal(out.record.period_ends_at, NOW + 30 * 86400000);
});
t("expiration and billing issue map to expired and past_due", () => {
  assert.equal(recordFromEvent(wrap({ ...base, type: "EXPIRATION" }), NOW).record.status, "expired");
  assert.equal(recordFromEvent(wrap({ ...base, type: "BILLING_ISSUE" }), NOW).record.status, "past_due");
});
t("the Search Pass window lives in expires_at: the store expiration wins when present", () => {
  const out = recordFromEvent(wrap({ ...base, product_id: "caresitters_searchpass", entitlement_ids: ["search_pass"] }), NOW);
  assert.equal(out.record.expires_at, NOW + 30 * 86400000);
  assert.equal(out.record.period_ends_at, null);
});
t("the Search Pass window computes purchase + 3 calendar months without a store expiration", () => {
  const jan31 = Date.UTC(2027, 0, 31, 10, 0, 0);
  const out = recordFromEvent(wrap({ ...base, product_id: "caresitters_searchpass", entitlement_ids: ["search_pass"], purchased_at_ms: jan31, expiration_at_ms: undefined }), NOW);
  assert.equal(out.record.expires_at, Date.UTC(2027, 3, 30, 10, 0, 0));
});
t("fences: anonymous app users, unknown types, foreign entitlements and pings write nothing", () => {
  assert.equal(recordFromEvent(wrap({ ...base, app_user_id: "$RCAnonymousID:1234" }), NOW), null);
  assert.equal(recordFromEvent(wrap({ ...base, type: "TEST" }), NOW), null);
  assert.equal(recordFromEvent(wrap({ ...base, entitlement_ids: ["plus"], product_id: "other_app_plus" }), NOW), null);
  assert.equal(recordFromEvent({}, NOW), null);
  assert.equal(recordFromEvent(null, NOW), null);
});
t("the webhook authorization is a constant-time exact compare", () => {
  assert.equal(authoriseWebhook("Bearer s3cret-value", "Bearer s3cret-value"), true);
  assert.equal(authoriseWebhook("Bearer s3cret-value", "Bearer s3cret-valuf"), false);
  assert.equal(authoriseWebhook("short", "a much longer expected value"), false);
  assert.equal(authoriseWebhook(undefined, "x"), false);
  assert.equal(authoriseWebhook("x", ""), false);
});
t("addMonthsMs walks the calendar (leap February included)", () => {
  assert.equal(addMonthsMs(Date.UTC(2028, 0, 31), 3), Date.UTC(2028, 3, 30));
  assert.equal(addMonthsMs(Date.UTC(2026, 10, 15), 3), Date.UTC(2027, 1, 15));
});

console.log(`\n${n - bad}/${n} receiver legs pass`);
if (bad) process.exit(1);
console.log("ALL RECEIVER CHECKS PASS");
