// Accounts wave tests: plan logic, rules structure, CEO smoke.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import http from "node:http";
import { resolvePlan, canSendMessage, isPassOpen, tasteDayKey, PLANS } from "./account.js";

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
t("Finding has no trial state anywhere in the resolver", () => {
  const src = readFileSync(new URL("./account.js", import.meta.url), "utf8");
  const codeOnly = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/trial/i.test(codeOnly), "no trial logic in code");
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
  assert.ok(writer.includes("await setDoc(ref, profile)"), "profile retries alone on batch failure");
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

console.log(`\nALL ${pass} accounts checks passed`);
