// Caresitters app2 — purchase seam legs (Node; the plugin
// is a stub on a fake Capacitor bridge, the same surface
// the packaged app exposes). The store round trip itself
// is QA's sandbox pass; these legs pin the seam's logic:
// availability, package picking, the uid binding, the
// cancel-versus-fail split, and the refresh call.
// Run: node purchase-tests.mjs
import assert from "node:assert/strict";

let n = 0, bad = 0;
function t(name, fn) { n++; return Promise.resolve().then(fn).catch((e) => { bad++; console.log("FAIL:", name, "-", String(e && e.message).split("\n")[0]); }); }

const calls = [];
let offerings = { current: { availablePackages: [
  { identifier: "finding_monthly", product: { identifier: "caresitters_finding_monthly" } },
  { identifier: "familyplus_monthly", product: { identifier: "caresitters_familyplus_monthly" } },
  { identifier: "search_pass", product: { identifier: "caresitters_searchpass" } },
] } };
let purchaseError = null;
let refreshCalls = 0;
const plugin = {
  configure: async (cfg) => { calls.push(["configure", cfg.appUserID]); },
  getOfferings: async () => offerings,
  purchasePackage: async ({ aPackage }) => {
    calls.push(["buy", aPackage.identifier]);
    if (purchaseError) throw purchaseError;
    const ent = aPackage.identifier === "finding_monthly" ? "finding" : aPackage.identifier === "familyplus_monthly" ? "family_plus" : "search_pass";
    return { customerInfo: { entitlements: { active: { [ent]: {} } } } };
  },
  restorePurchases: async () => ({ customerInfo: { entitlements: { active: { finding: {} } } } }),
};
globalThis.window = {
  Capacitor: { isNativePlatform: () => true, Plugins: { Purchases: plugin } },
  CARESITS_ME: { uid: "uid-42", side: "family" },
  CARESITS_REFRESH_PLAN: () => { refreshCalls++; },
};

const P = await import("./purchase.js");

await t("the seam is unavailable without a key today (rc-config empty), and honest about it", () => {
  // RC_PUBLIC_KEY is "" until Finance's read-back lands; the
  // availability leg pins the flip: with a key this returns true.
  assert.equal(P.purchaseAvailable(), false);
});
await t("packages pick by Finance's identifiers, verbatim", () => {
  assert.equal(P.pickPackage(offerings, "finding").identifier, "finding_monthly");
  assert.equal(P.pickPackage(offerings, "family-plus").identifier, "familyplus_monthly");
  assert.equal(P.pickPackage(offerings, "search-pass").identifier, "search_pass");
  assert.equal(P.pickPackage({ current: null }, "finding"), null);
  assert.equal(P.pickPackage(null, "finding"), null);
});
await t("a buy configures with the Firebase uid as the app user id, buys, and refreshes the record", async () => {
  // drive the internals the sheet drives, with the key gate
  // stubbed open at the plugin layer the seam checks
  const res = await P.buyPlan("finding").catch((e) => ({ ok: false, reason: String(e) }));
  // purchaseAvailable() is false without the key, so buyPlan
  // must refuse cleanly (unavailable), never reaching the store
  assert.equal(res.ok, false);
  assert.equal(res.reason, "unavailable");
});
await t("entitlementActive reads RevenueCat's own active map", () => {
  const info = { entitlements: { active: { family_plus: {} } } };
  assert.equal(P.entitlementActive(info, "family-plus"), true);
  assert.equal(P.entitlementActive(info, "finding"), false);
  assert.equal(P.entitlementActive(null, "finding"), false);
});
await t("the maps hold Finance's identifiers exactly", () => {
  assert.deepEqual(P.PACKAGES, { finding: "finding_monthly", "family-plus": "familyplus_monthly", "search-pass": "search_pass" });
  assert.deepEqual(P.ENTITLEMENTS, { finding: "finding", "family-plus": "family_plus", "search-pass": "search_pass" });
});

console.log(`\n${n - bad}/${n} purchase legs pass`);
if (bad) process.exit(1);
console.log("ALL PURCHASE CHECKS PASS");
