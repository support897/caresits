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

await t("census: a getOfferings that never answers is refused at the bound", async () => {
  const good = plugin.getOfferings;
  plugin.getOfferings = () => new Promise(() => {});
  P.PURCHASE_TIMEOUTS.offerings = 60;
  const res = await P.buyPlan("finding");
  assert.equal(res.ok, false); assert.equal(res.reason, "offerings");
  plugin.getOfferings = good; P.PURCHASE_TIMEOUTS.offerings = 20000;
});
await t("census: a configure that never answers reads as unavailable, never a pin on buying", async () => {
  const good = plugin.configure;
  plugin.configure = () => new Promise(() => {});
  P.PURCHASE_TIMEOUTS.configure = 60;
  globalThis.window.CARESITS_ME = { uid: "uid-hang", side: "family" };
  const res = await P.buyPlan("finding");
  assert.equal(res.ok, false); assert.equal(res.reason, "unavailable");
  plugin.configure = good; P.PURCHASE_TIMEOUTS.configure = 15000;
  globalThis.window.CARESITS_ME = { uid: "uid-42", side: "family" };
});
await t("the seam is available in the packaged shape (key filled, plugin present)", () => {
  assert.equal(P.purchaseAvailable(), true);
});
await t("packages pick by Finance's identifiers, verbatim", () => {
  assert.equal(P.pickPackage(offerings, "finding").identifier, "finding_monthly");
  assert.equal(P.pickPackage(offerings, "family-plus").identifier, "familyplus_monthly");
  assert.equal(P.pickPackage(offerings, "search-pass").identifier, "search_pass");
  assert.equal(P.pickPackage({ current: null }, "finding"), null);
  assert.equal(P.pickPackage(null, "finding"), null);
});
await t("a buy configures with the Firebase uid as the app user id, buys, and refreshes the record", async () => {
  const res = await P.buyPlan("finding");
  assert.equal(res.ok, true);
  assert.equal(res.active, true);
  assert.deepEqual(calls.filter((c) => c[0] === "configure"), [["configure", "uid-42"]]);
  assert.deepEqual(calls.filter((c) => c[0] === "buy"), [["buy", "finding_monthly"]]);
  assert.equal(refreshCalls, 1);
});
await t("a user cancellation reads as cancelled, not failed (the sheet just re-enables)", async () => {
  purchaseError = Object.assign(new Error("User cancelled"), { code: "1" });
  const res = await P.buyPlan("family-plus");
  assert.equal(res.ok, false);
  assert.equal(res.reason, "cancelled");
  purchaseError = new Error("store exploded");
  const res2 = await P.buyPlan("family-plus");
  assert.equal(res2.ok, false);
  assert.equal(res2.reason, "failed");
  purchaseError = null;
});
await t("a restore reports the active entitlements and refreshes the record", async () => {
  const before = refreshCalls;
  const res = await P.restorePurchases();
  assert.equal(res.ok, true);
  assert.deepEqual(res.active, ["finding"]);
  assert.equal(refreshCalls, before + 1);
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
