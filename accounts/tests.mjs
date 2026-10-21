// Accounts wave tests: plan logic, rules structure, CEO smoke.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import http from "node:http";
import { resolvePlan, canSendMessage, isPassOpen, tasteDayKey, PLANS, entitlementFromRecord, plusExtrasOpen, PLUS_MONTH_MS, withTimeout, DOOR_TIMEOUTS, signInGoogle, signInApple, authInitShape } from "./account.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("ok -", name); };
const NOW = Date.parse("2026-10-15T00:00:00Z");

t("carer is free forever, door open", () => {
  const p = resolvePlan({ side: "carer", comp: null, payment: null, now: NOW });
  assert.equal(p.tier, PLANS.CARER); assert.equal(p.doorOpen, true);
});
t("comp Finding free forever wins (her user 2 account)", () => {
  const p = resolvePlan({ side: "family", comp: { plan: "finding", forever: true }, payment: null, now: NOW });
  assert.equal(p.tier, PLANS.FINDING); assert.equal(p.source, "comp");
});
t("family with nothing is the free taste, door closed", () => {
  const p = resolvePlan({ side: "family", comp: null, payment: null, now: NOW });
  assert.equal(p.tier, PLANS.FREE); assert.equal(p.doorOpen, false);
});
t("active Finding subscription opens the door", () => {
  const p = resolvePlan({ side: "family", comp: null, payment: { plan: "finding", status: "active" }, now: NOW });
  assert.equal(p.doorOpen, true); assert.equal(p.source, "subscription");
});
t("cancelled subscription does not open the door", () => {
  const p = resolvePlan({ side: "family", comp: null, payment: { plan: "finding", status: "canceled" }, now: NOW });
  assert.equal(p.doorOpen, false);
});
t("Search Pass opens the Finding door inside its window only", () => {
  const inWin = resolvePlan({ side: "family", comp: null, payment: { pass: { endsAt: NOW + 1000 } }, now: NOW });
  assert.equal(inWin.doorOpen, true); assert.equal(inWin.source, "search pass");
  const outWin = resolvePlan({ side: "family", comp: null, payment: { pass: { endsAt: NOW - 1000 } }, now: NOW });
  assert.equal(outWin.doorOpen, false);
});
t("Finding has no trial: a trialing Finding record opens nothing", () => {
  // This leg replaces the old blanket source ban on the word trial.
  // The payments chapter record (§3) legitimately carries a trialing
  // status, so the invariant is now behavioural and precise: no
  // trialing state ever opens Finding, whose free month does not
  // exist (her word, 15 Oct 2026).
  const pay = entitlementFromRecord({ entitlement: "finding", status: "trialing", trial_ends_at: NOW + 1000 }, NOW);
  assert.equal(pay, null);
  const p = resolvePlan({ side: "family", comp: null, payment: pay, now: NOW });
  assert.equal(p.doorOpen, false);
});
t("entitlement record: active Finding inside its period opens the door", () => {
  const pay = entitlementFromRecord({ entitlement: "finding", status: "active", period_ends_at: NOW + 1000 }, NOW);
  const p = resolvePlan({ side: "family", comp: null, payment: pay, now: NOW });
  assert.equal(p.tier, PLANS.FINDING); assert.equal(p.doorOpen, true);
});
t("entitlement record: an active plan past its period end is shut", () => {
  assert.equal(entitlementFromRecord({ entitlement: "finding", status: "active", period_ends_at: NOW - 1 }, NOW), null);
  assert.equal(entitlementFromRecord({ entitlement: "family_plus", status: "active", period_ends_at: NOW - 1 }, NOW), null);
});
t("entitlement record: cancelled stays open until the period ends, then shuts", () => {
  const open = entitlementFromRecord({ entitlement: "family_plus", status: "cancelled", period_ends_at: NOW + 1000 }, NOW);
  assert.ok(open && open.plan === PLANS.FAMILY_PLUS);
  assert.equal(entitlementFromRecord({ entitlement: "family_plus", status: "cancelled", period_ends_at: NOW - 1 }, NOW), null);
});
t("entitlement record: past_due, expired, unknown and missing records open nothing", () => {
  assert.equal(entitlementFromRecord({ entitlement: "finding", status: "past_due", period_ends_at: NOW + 1000 }, NOW), null);
  assert.equal(entitlementFromRecord({ entitlement: "finding", status: "expired", period_ends_at: NOW + 1000 }, NOW), null);
  assert.equal(entitlementFromRecord({ entitlement: "everything", status: "active" }, NOW), null);
  assert.equal(entitlementFromRecord(null, NOW), null);
  assert.equal(entitlementFromRecord(undefined, NOW), null);
});
t("entitlement record: a trialing Family Plus record opens (§3 unlock rule)", () => {
  const pay = entitlementFromRecord({ entitlement: "family_plus", status: "trialing", trial_ends_at: NOW + 1000 }, NOW);
  const p = resolvePlan({ side: "family", comp: null, payment: pay, now: NOW });
  assert.equal(p.tier, PLANS.FAMILY_PLUS); assert.equal(p.doorOpen, true);
});
t("entitlement record: the Search Pass window lives in expires_at (§4)", () => {
  const inWin = entitlementFromRecord({ entitlement: "search_pass", status: "active", expires_at: NOW + 1000 }, NOW);
  const p = resolvePlan({ side: "family", comp: null, payment: inWin, now: NOW });
  assert.equal(p.doorOpen, true); assert.equal(p.source, "search pass");
  assert.equal(entitlementFromRecord({ entitlement: "search_pass", status: "active", expires_at: NOW - 1 }, NOW), null);
  assert.equal(entitlementFromRecord({ entitlement: "search_pass", status: "cancelled", expires_at: NOW + 1000 }, NOW), null);
});
t("entitlement record: ISO strings and Firestore timestamps read the same", () => {
  const iso = entitlementFromRecord({ entitlement: "finding", status: "active", period_ends_at: new Date(NOW + 1000).toISOString() }, NOW);
  assert.ok(iso && iso.currentPeriodEnd === NOW + 1000);
  const ts = entitlementFromRecord({ entitlement: "finding", status: "active", period_ends_at: { seconds: Math.floor((NOW + 1000) / 1000), nanoseconds: 0 } }, NOW);
  assert.ok(ts && ts.currentPeriodEnd === NOW + 1000);
});
t("in-app month: opens the Plus extras for a young family account only", () => {
  const free = resolvePlan({ side: "family", comp: null, payment: null, now: NOW });
  assert.equal(plusExtrasOpen({ plan: free, side: "family", createdAtMs: NOW - 10 * 24 * 3600 * 1000, now: NOW }), true);
  assert.equal(plusExtrasOpen({ plan: free, side: "family", createdAtMs: NOW - PLUS_MONTH_MS - 1, now: NOW }), false);
  assert.equal(plusExtrasOpen({ plan: free, side: "family", createdAtMs: null, now: NOW }), false);
});
t("in-app month: a paid Family Plus record opens the extras at any age", () => {
  const plus = resolvePlan({ side: "family", comp: null, payment: { plan: PLANS.FAMILY_PLUS, status: "active" }, now: NOW });
  assert.equal(plusExtrasOpen({ plan: plus, side: "family", createdAtMs: NOW - 400 * 24 * 3600 * 1000, now: NOW }), true);
  const finding = resolvePlan({ side: "family", comp: null, payment: { plan: PLANS.FINDING, status: "active" }, now: NOW });
  assert.equal(plusExtrasOpen({ plan: finding, side: "family", createdAtMs: NOW - 400 * 24 * 3600 * 1000, now: NOW }), false);
});
t("in-app month never opens the Finding door: the taste still caps messaging", () => {
  const free = resolvePlan({ side: "family", comp: null, payment: null, now: NOW });
  assert.equal(plusExtrasOpen({ plan: free, side: "family", createdAtMs: NOW - 1000, now: NOW }), true);
  assert.equal(canSendMessage({ plan: free, tasteUsedToday: 1 }), false);
});
t("free taste: one message per day for families", () => {
  const free = resolvePlan({ side: "family", comp: null, payment: null, now: NOW });
  assert.equal(canSendMessage({ plan: free, tasteUsedToday: 0 }), true);
  assert.equal(canSendMessage({ plan: free, tasteUsedToday: 1 }), false);
  const paid = resolvePlan({ side: "family", comp: { plan: "finding", forever: true }, payment: null, now: NOW });
  assert.equal(canSendMessage({ plan: paid, tasteUsedToday: 9 }), true);
  const carer = resolvePlan({ side: "carer", comp: null, payment: null, now: NOW });
  assert.equal(canSendMessage({ plan: carer, tasteUsedToday: 9 }), true);
});
t("taste day key is a plain date", () => {
  assert.equal(tasteDayKey(new Date("2026-10-15T23:59:00Z")), "2026-10-15");
});

t("deletion walk enumerates the caller's own invites by familyUid (zero orphans)", () => {
  const src = readFileSync(new URL("./account.js", import.meta.url), "utf8");
  const walk = src.slice(src.indexOf("export async function deleteMyAccount"));
  assert.ok(walk.includes('collection(_db, "invites")'), "the walk reaches the invites collection");
  assert.ok(walk.includes('where("familyUid", "==", _user.uid)'), "the walk enumerates by the caller's familyUid");
  assert.ok(walk.includes("invSnap.forEach((d) => batch.delete(d.ref))"), "the caller's invites die in the same batch");
});

t("signup writer never reads the aggregates doc (programme shape)", () => {
  const src = readFileSync(new URL("./account.js", import.meta.url), "utf8");
  const writer = src.slice(src.indexOf("async function ensureProfile"));
  assert.ok(!/getDoc\(agg/.test(writer) && !/aggregates[^\n]*\n[^\n]*getDoc/.test(writer), "no aggregate read in the writer");
  assert.ok(writer.includes("increment(1)"), "counter rides as an increment");
  assert.ok(writer.includes('doc(_db, "_owner", "aggregates", "peopleTotal", "main")'), "signup split: the total rides its own document");
  assert.ok(writer.includes("{ total: increment(1) }"), "signup split: the total write carries the total increment alone");
  assert.ok(writer.includes('doc(_db, "_owner", "aggregates", "peopleWeekly", isoWeekKey(new Date()))'), "signup split: the week rides its own document, named by the week key");
  assert.ok(writer.includes("{ count: increment(1) }"), "signup split: the weekly write carries the count increment alone");
  assert.ok(!writer.includes('"people", "main"'), "signup split: the combined people counter write is gone");
  assert.ok(writer.includes("await setDoc(ref, profile, { merge: true })"), "profile retries alone on failure, merging so a late write keeps the save's stamps");
});

t("native branch: the Google door runs the plugin on native and hands over its idToken", () => {
  const src = readFileSync(new URL("./account.js", import.meta.url), "utf8");
  const doors = src.slice(src.indexOf("export async function signInGoogle"), src.indexOf("let _pendingName"));
  assert.ok(doors.includes("nativeAuthPlugin()"), "the Google door consults the native bridge first");
  assert.ok(doors.includes("plugin.signInWithGoogle()"), "the native Google sheet is the plugin's");
  assert.ok(
    doors.includes("m.signInWithCredential(_auth, m.GoogleAuthProvider.credential(credential.idToken))"),
    "the plugin idToken becomes this session's credential"
  );
});
t("native branch: the Apple door hands over idToken + rawNonce, the nonce verbatim", () => {
  const src = readFileSync(new URL("./account.js", import.meta.url), "utf8");
  const doors = src.slice(src.indexOf("export async function signInGoogle"), src.indexOf("let _pendingName"));
  assert.ok(doors.includes("plugin.signInWithApple()"), "the native Apple sheet is the plugin's");
  assert.ok(
    doors.includes("provider.credential({ idToken: credential.idToken, rawNonce: credential.nonce })"),
    "the Apple credential carries the idToken and the plugin nonce as rawNonce"
  );
  assert.ok(
    !/sha256|createHash|\.digest\(|CryptoJS|hashNonce/.test(doors),
    "no hashing call anywhere near the nonce hand over (the plugin presented the hashed nonce)"
  );
});
t("native branch: bridge access is guarded, popup doors still stand for web and fallback", () => {
  const src = readFileSync(new URL("./account.js", import.meta.url), "utf8");
  assert.ok(src.includes("typeof cap.isNativePlatform !== \"function\" || !cap.isNativePlatform()"), "native means isNativePlatform() true, checked before any use");
  assert.ok(src.includes("cap.Plugins && cap.Plugins.FirebaseAuthentication"), "the plugin is reached through the guarded bridge only");
  assert.ok(src.includes("m.signInWithPopup(_auth, new m.GoogleAuthProvider())"), "the web Google popup stands");
  assert.ok(src.includes("m.signInWithPopup(_auth, provider)"), "the web Apple popup stands (and is the native fallback)");
});
t("store config: the JS SDK owns the session (skipNativeAuth true)", () => {
  const cfg = JSON.parse(readFileSync(new URL("../store/capacitor.config.json", import.meta.url), "utf8"));
  assert.equal(cfg.plugins.FirebaseAuthentication.skipNativeAuth, true);
});
t("store config: the native door providers are enabled (google.com + apple.com)", () => {
  // The plugin builds its Google/Apple handlers ONLY for providers named in
  // this list (its iOS source: handlers are created per config.providers);
  // without it both doors reject instantly with "provider is not enabled" —
  // the build 6 failure Ilse caught on her phone.
  const cfg = JSON.parse(readFileSync(new URL("../store/capacitor.config.json", import.meta.url), "utf8"));
  assert.deepEqual(cfg.plugins.FirebaseAuthentication.providers, ["google.com", "apple.com"]);
});

// ---- Rules structure ----
const rules = readFileSync(new URL("./firestore.rules", import.meta.url), "utf8");
t("rules: default wall, users touch only their own folder", () => {
  assert.ok(rules.includes("match /users/{uid}/{document=**}"));
  assert.ok(rules.includes("request.auth.uid == uid"));
});
t("rules: clients can never write plan shaped keys", () => {
  assert.ok(rules.includes("hasAny(['plan', 'planSource', 'comp', 'role', 'owner'])"));
});
t("rules: _comp and _demo are fully closed to clients", () => {
  assert.ok(rules.includes("match /_comp/{document=**} { allow read, write: if false; }"));
  assert.ok(rules.includes("match /_demo/{document=**} { allow read, write: if false; }"));
});
t("rules: aggregates read is owner only, blanket write denied", () => {
  assert.ok(rules.includes("match /_owner/aggregates/{document=**}"));
  assert.ok(rules.includes("allow read: if isOwner();"));
});
t("rules: people counter rises only in paired writes", () => {
  assert.ok(rules.includes("match /_owner/aggregates/people/main"));
  assert.ok(rules.includes("aggPairedSignup()"));
  assert.ok(rules.includes("aggPlusOne('total')"));
});
t("rules: delete takes the path owner condition alone (verb split)", () => {
  const del = rules.match(/allow delete: if[^;]+;/s);
  assert.ok(del && !/request\.resource/.test(del[0]));
});

// ---- CEO smoke (served locally) ----
const ceoFiles = { "/": "../ceo/index.html", "/index.html": "../ceo/index.html", "/styles.css": "../ceo/styles.css", "/ceo.js": "../ceo/ceo.js", "/firebase-config.js": "../ceo/firebase-config.js", "/icon.svg": "../ceo/icon.svg", "/bunny.png": "../ceo/bunny.png", "/lio.png": "../ceo/lio.png" };
const server = http.createServer((req, res) => {
  const f = ceoFiles[req.url.split("?")[0]];
  if (!f) { res.writeHead(404); return res.end(); }
  try {
    const body = readFileSync(new URL(f, import.meta.url));
    const type = f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : f.endsWith(".svg") ? "image/svg+xml" : f.endsWith(".png") ? "image/png" : "text/html";
    res.writeHead(200, { "Content-Type": type }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8931, r));
try {
  const { chromium } = await import("playwright-core");
  const b = await chromium.launch({ executablePath: "/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto("http://localhost:8931/", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  const gateVisible = await p.evaluate(() => !document.getElementById("lock").hidden);
  t("CEO: the owner gate stands before any data", () => assert.ok(gateVisible));
  // Force the app open to check the sections render with honest zeros.
  await p.evaluate(() => { document.getElementById("lock").hidden = true; document.getElementById("app").hidden = false; });
  const joined = await p.textContent("#ovJoined");
  t("CEO: overview renders honest zeros", () => assert.equal(joined.trim(), "0"));
  await p.click('[data-sec="money"]');
  const vis = await p.evaluate(() => [...document.querySelectorAll(".sec")].filter((s) => !s.hidden).map((s) => s.id));
  t("CEO: one section open at a time", () => assert.deepEqual(vis, ["sec-money"]));
  const avatars = await p.evaluate(() => { document.querySelector('[data-sec="avatars"]').click(); return document.querySelectorAll(".avatarCard").length; });
  t("CEO: both Caresits avatars listed", () => assert.equal(avatars, 2));
  t("CEO: no page errors", () => assert.deepEqual(errs, []));
  await b.close();
} finally {
  server.close();
}
t("Leg 19: a creation at sign in carries the mark, so no door can stay silent about it", () => {
  const src = readFileSync(new URL("./account.js", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export async function signInEmail"), src.indexOf("export async function signOutUser"));
  assert.ok(fn.includes("cred.createdAccount = true"), "the create path marks the credential");
  assert.ok(fn.indexOf("createUserWithEmailAndPassword") < fn.indexOf("cred.createdAccount = true"), "the mark follows the create");
});
t("Leg 19: the app door announces a creation out loud before the walk in", () => {
  const src = readFileSync(new URL("../app2/door.js", import.meta.url), "utf8");
  assert.ok(src.includes('tr("door.madeAccount")'), "the door speaks the creation line");
  assert.ok(src.includes("joinHold"), "the walk in holds until the line is spoken");
});
t("Leg 19: the account page announces a creation too", () => {
  const src = readFileSync(new URL("./account.html", import.meta.url), "utf8");
  assert.ok(src.includes('tr("door.madeAccount")'), "the account page speaks the creation line");
});

// ---- Fleet census cure: bounded waits (19 Oct 2026) ----
// No promise on the door or boot path may hang forever.
const fastVal = await withTimeout(Promise.resolve(7), 1000, "fast op");
t("census: withTimeout passes a fast answer through untouched", () => assert.equal(fastVal, 7));
let hangErr = null;
try { await withTimeout(new Promise(() => {}), 60, "hung op"); } catch (e) { hangErr = e; }
t("census: a promise that never settles is refused at the bound, coded as a timeout", () => {
  assert.ok(hangErr && /timed out/.test(hangErr.message));
  assert.equal(hangErr.code, "auth/timeout");
});
DOOR_TIMEOUTS.native = 60;
globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { FirebaseAuthentication: {
  signInWithGoogle: () => new Promise(() => {}),
  signInWithApple: () => new Promise(() => {}),
} } } };
let gErr = null; try { await signInGoogle(); } catch (e) { gErr = e; }
let aErr = null; try { await signInApple(); } catch (e) { aErr = e; }
delete globalThis.window;
DOOR_TIMEOUTS.native = 20000;
t("census: a native Google bridge that never answers is refused at the bound, not a silent hang", () => assert.ok(gErr && /native sign in timed out/.test(gErr.message)));
t("census: a native Apple bridge that never answers is refused at the bound, not a silent hang", () => assert.ok(aErr && /native sign in timed out/.test(aErr.message)));
t("census: the walk-in ensure is bounded, and a timed-out ensure re-fires behind the door", () => {
  const src = readFileSync(new URL("./account.js", import.meta.url), "utf8");
  assert.ok(src.includes("withTimeout(ensureProfile(fsMod, u), DOOR_TIMEOUTS.ensure"), "the ensure races its bound");
  assert.ok(src.includes("catch { ensureProfile(fsMod, u).catch(() => {}); }"), "the re-fire stands behind the bound");
});
t("census: boot's first-data reads are bounded at all six sites (four census + the b104 meta read + the N1 answers read)", () => {
  const src = readFileSync(new URL("../app2/live.js", import.meta.url), "utf8");
  assert.equal((src.match(/withTimeout\(fs\.getDoc/g) || []).length, 6);
});
t("census: the door's layer load races a bound at all three buttons", () => {
  const src = readFileSync(new URL("../app2/door.js", import.meta.url), "utf8");
  assert.equal((src.match(/await layerFast\(\)/g) || []).length, 3);
});

// ---- The door cure (bisect of record, 21 Oct 2026) ----
// Her Google sign in completed at Firebase (lastLogin at the
// film's minute) while the app never walked her in and never
// spoke: plain getAuth's persistence resolution hangs sign in
// results and the auth listener in the packaged webview. The
// cure's pins: the native branch shape, the IndexedDB init,
// both credential exchanges inside the bounded wait law, and
// the door driving its own walk in from the resolved
// credential with the listener as backstop.
t("door cure: the native auth init shape names browserLocal persistence, the web shape is default", () => {
  assert.equal(authInitShape(true), "browserLocal");
  assert.equal(authInitShape(false), "default");
});
t("door cure: the auth init branches to initializeAuth with browserLocal persistence on native", () => {
  const src = readFileSync(new URL("./account.js", import.meta.url), "utf8");
  assert.ok(src.includes("initializeAuth(app, { persistence: authMod.browserLocalPersistence })"));
  assert.ok(src.includes("initAuthForPlatform(authMod, app, isNativePlatform())"));
});
t("door cure: both credential exchanges stand inside the bounded wait law", () => {
  const src = readFileSync(new URL("./account.js", import.meta.url), "utf8");
  assert.equal((src.match(/"credential exchange"/g) || []).length, 2);
});
t("door cure: the door drives its walk in from the resolved credential, listener as backstop", () => {
  const src = readFileSync(new URL("../app2/door.js", import.meta.url), "utf8");
  assert.ok(src.includes("function walkIn()"));
  assert.equal((src.match(/if \(cred && cred\.user\) walkIn\(\)/g) || []).length, 2);
  assert.equal((src.match(/door\.working/g) || []).length, 2);
});

console.log(`\nALL ${pass} accounts checks passed`);
