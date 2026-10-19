import { RC_PUBLIC_KEY } from "./rc-config.js";
// Caresitters app2 — the purchase seam (payments chapter,
// the enabling build). Buttons live in plans.js; this
// module is the only road to the store: RevenueCat's
// Capacitor plugin, reached through the guarded bridge
// exactly like the Firebase auth doors (no bundler in
// this app). The plugin's app user id is the Firebase
// uid, so the webhook's record and the app's own record
// are the same person by construction. Entitlements are
// read from the app's own _entitlements record (live.js);
// RevenueCat's customer info is used here only for the
// instant answer at the button (bought / restored), never
// as the app's source of truth.
//
// Package identifiers are Finance's read-back verbatim
// (RC project 2969203c, offering "Current").
export const PACKAGES = {
  finding: "finding_monthly",
  "family-plus": "familyplus_monthly",
  "search-pass": "search_pass",
};
export const ENTITLEMENTS = {
  finding: "finding",
  "family-plus": "family_plus",
  "search-pass": "search_pass",
};

export function purchasesPlugin() {
  if (typeof window === "undefined") return null;
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== "function" || !cap.isNativePlatform()) return null;
  const plugin = cap.Plugins && cap.Plugins.Purchases;
  if (!plugin || typeof plugin.configure !== "function" || typeof plugin.getOfferings !== "function"
    || typeof plugin.purchasePackage !== "function" || typeof plugin.restorePurchases !== "function") return null;
  return plugin;
}

export function purchaseAvailable() {
  return !!RC_PUBLIC_KEY && !!purchasesPlugin();
}

let configuredFor = "";
export async function configurePurchases(uid) {
  const plugin = purchasesPlugin();
  if (!plugin || !RC_PUBLIC_KEY || !uid) return false;
  if (configuredFor === uid) return true;
  try {
    await plugin.configure({ apiKey: RC_PUBLIC_KEY, appUserID: uid });
    configuredFor = uid;
    return true;
  } catch { return false; }
}

// Pick this plan's package out of an offerings object.
// Pure: the battery drives it with a fake offerings.
export function pickPackage(offerings, plan) {
  const want = PACKAGES[plan];
  const list = offerings && offerings.current && Array.isArray(offerings.current.availablePackages)
    ? offerings.current.availablePackages : [];
  return list.find((p) => p && p.identifier === want) || null;
}

// Does RevenueCat's own info say this entitlement is
// active right now? The instant answer at the button.
export function entitlementActive(customerInfo, plan) {
  const want = ENTITLEMENTS[plan];
  const active = customerInfo && customerInfo.entitlements && customerInfo.entitlements.active;
  return !!(active && want && active[want]);
}

const myUid = () => (typeof window !== "undefined" && window.CARESITS_ME && window.CARESITS_ME.uid) || "";

// buyPlan(plan) -> { ok, reason?, customerInfo? }
// reason "cancelled" is the user's own change of mind:
// the sheet simply re-enables, no error words.
export async function buyPlan(plan) {
  const plugin = purchasesPlugin();
  if (!plugin || !PACKAGES[plan]) return { ok: false, reason: "unavailable" };
  if (!(await configurePurchases(myUid()))) return { ok: false, reason: "unavailable" };
  let offerings;
  try { offerings = await plugin.getOfferings(); } catch { return { ok: false, reason: "offerings" }; }
  const pkg = pickPackage(offerings, plan);
  if (!pkg) return { ok: false, reason: "package" };
  try {
    const res = await plugin.purchasePackage({ aPackage: pkg });
    const info = res && res.customerInfo;
    if (typeof window !== "undefined" && typeof window.CARESITS_REFRESH_PLAN === "function") window.CARESITS_REFRESH_PLAN();
    return { ok: true, customerInfo: info, active: entitlementActive(info, plan) };
  } catch (e) {
    if (e && (e.code === "1" || /cancel/i.test(String(e.message || e)))) return { ok: false, reason: "cancelled" };
    return { ok: false, reason: "failed" };
  }
}

export async function restorePurchases() {
  const plugin = purchasesPlugin();
  if (!plugin) return { ok: false, reason: "unavailable" };
  if (!(await configurePurchases(myUid()))) return { ok: false, reason: "unavailable" };
  try {
    const res = await plugin.restorePurchases();
    const info = res && res.customerInfo;
    if (typeof window !== "undefined" && typeof window.CARESITS_REFRESH_PLAN === "function") window.CARESITS_REFRESH_PLAN();
    const active = info && info.entitlements && info.entitlements.active ? Object.keys(info.entitlements.active) : [];
    return { ok: true, customerInfo: info, active };
  } catch { return { ok: false, reason: "failed" }; }
}
