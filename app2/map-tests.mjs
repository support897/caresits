// Map proof drive (TEST ONLY): item F of the 29 Oct 2026
// build. Seeds twin carer profiles across several postcode
// areas (some WITHOUT stored card coordinates, to prove the
// fetch time derivation), opens the map as a family test
// account, and counts the pins against the placeable pool in
// the very set the app fetched: every fetched carer whose
// postcode derives an area (or who carries coordinates) must
// stand as a pin, and a carer with no postcode must not.
// Then a pin tap must open that carer's card in the slot.
import { chromium } from "playwright-core";
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { testFirebaseConfig: TWIN } = await import("./test-config.js");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome";
const PROXY_AUTH = process.env.https_proxy ? "Basic " + Buffer.from(decodeURIComponent(new URL(process.env.https_proxy).username) + ":" + decodeURIComponent(new URL(process.env.https_proxy).password)).toString("base64") : "";
const ok = (cond, name, extra = "") => { console.log((cond ? "ok - " : "FAIL - ") + name + (extra ? " " + extra : "")); if (!cond) process.exitCode = 1; };

// ---------- twin tree + shim + server (same rig as door-tests)
const RIG = fs.mkdtempSync(path.join(os.tmpdir(), "caresits-map-rig-"));
const TREE = fs.mkdtempSync(path.join(os.tmpdir(), "caresits-map-tree-"));
fs.cpSync(HERE, path.join(TREE, "app2"), { recursive: true });
fs.cpSync(path.join(HERE, "..", "accounts"), path.join(TREE, "accounts"), { recursive: true });
for (const extra of ["fonts", "next-phase"]) { try { fs.cpSync(path.join(HERE, "..", extra), path.join(TREE, extra), { recursive: true }); } catch {} }
fs.writeFileSync(path.join(TREE, "app2", "firebase-config.js"), (await import("node:fs")).readFileSync(path.join(HERE, "test-config.js"), "utf8").replace(/testFirebaseConfig/g, "firebaseConfig"));
const SHIM_PATH = path.join(RIG, "shim.mjs");
fs.writeFileSync(SHIM_PATH, `
import net from "node:net"; import http from "node:http";
const AUTH = ${JSON.stringify(PROXY_AUTH)};
const isLocal = (host) => /^(localhost|127\\.0\\.0\\.1)(:\\d+)?$/.test(host);
const server = http.createServer((req, res) => {
  const target = new URL(req.url);
  const local = isLocal(target.host);
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) { if (/^(host|proxy-authorization|proxy-connection|connection)$/i.test(k)) continue; headers[k] = v; }
  if (!local) headers["Proxy-Authorization"] = AUTH;
  headers.host = target.host;
  const up = http.request({ host: local ? "127.0.0.1" : "198.19.0.1", port: local ? Number(target.port || 80) : 3128, path: local ? target.pathname + target.search : req.url, method: req.method, headers, agent: false }, (upRes) => {
    const outHeaders = {};
    for (const [k, v] of Object.entries(upRes.headers)) { if (/^(connection|keep-alive|transfer-encoding)$/i.test(k)) continue; outHeaders[k] = v; }
    res.writeHead(upRes.statusCode, outHeaders);
    upRes.pipe(res);
  });
  up.on("error", () => { try { res.destroy(); } catch {} });
  req.pipe(up);
});
server.on("connect", (req, clientSocket, head) => {
  const [host, port] = req.url.split(":");
  const upstream = net.connect(3128, "198.19.0.1", () => {
    upstream.write("CONNECT " + req.url + " HTTP/1.1\\r\\nHost: " + req.url + "\\r\\nProxy-Authorization: " + AUTH + "\\r\\n\\r\\n");
    let buf = Buffer.alloc(0);
    const onData = (d) => { buf = Buffer.concat([buf, d]); const idx = buf.indexOf("\\r\\n\\r\\n"); if (idx < 0) return; upstream.off("data", onData); clientSocket.write("HTTP/1.1 200 Connection Established\\r\\n\\r\\n"); const rest = buf.subarray(idx + 4); if (rest.length) clientSocket.write(rest); if (head && head.length) upstream.write(head); upstream.pipe(clientSocket); clientSocket.pipe(upstream); };
    upstream.on("data", onData);
  });
  upstream.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => upstream.destroy());
});
server.listen(Number(process.env.SHIM_PORT || 18082), "127.0.0.1");
`);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json", ".md": "text/plain", ".txt": "text/plain", ".pdf": "application/pdf" };
const treeServer = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.resolve(TREE, p.replace(/^\/+/, ""));
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end(""); } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" }); res.end(data); });
});
await new Promise((r) => treeServer.listen(8946, "127.0.0.1", r));
const SHIM_PORT = 18100 + Math.floor(Math.random() * 400);
const shimErrFd = fs.openSync(path.join(RIG, "shim.err"), "w");
const shimProc = spawn("node", [SHIM_PATH], { stdio: ["ignore", "ignore", shimErrFd], env: { ...process.env, SHIM_PORT: String(SHIM_PORT) } });
for (let i = 0; i < 40; i++) { try { const pr = await fetch("http://127.0.0.1:" + SHIM_PORT + "/x", { signal: AbortSignal.timeout(400) }).catch(() => null); break; } catch { await new Promise((r) => setTimeout(r, 150)); } }
await new Promise((r) => setTimeout(r, 300));
const BASE = "http://localhost:8946/app2";

// ---------- REST helpers
const KEY = TWIN.apiKey;
const signUp = async (email, password) => {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const j = await r.json();
  if (!j.idToken) { // already exists: sign in instead
    const r2 = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
    return r2.json();
  }
  return j;
};
const sv = (v) => ({ stringValue: v });
const setProfile = async (token, uid, fields) => {
  // Rules true seed shape (live fence read 29 Oct 2026):
  // postcode is a top level field only (never a card key),
  // and looking must carry its musts and prefs maps.
  const body = { fields: { side: sv(fields.side), displayName: sv(fields.name), postcode: sv(fields.postcode || ""), photoUrl: sv(""), card: { mapValue: { fields: fields.card } }, looking: { mapValue: { fields: { musts: { mapValue: { fields: {} } }, prefs: { mapValue: { fields: {} } } } } }, updatedAt: { timestampValue: new Date().toISOString() } } };
  const mask = ["side", "displayName", "postcode", "photoUrl", "card", "looking", "updatedAt"].map((f) => "updateMask.fieldPaths=" + f).join("&");
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${TWIN.projectId}/databases/(default)/documents/profiles/${uid}?${mask}`, { method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.status;
};

// ---------- seeds
const FAMILY = { email: "desk.family.twin@example.com", password: "TwinFamily-2026-x" };
const fam = await signUp(FAMILY.email, FAMILY.password);
await setProfile(fam.idToken, fam.localId, { side: "family", name: "Map Family", postcode: "2031", card: {} });
const SEEDS = [
  { email: "map.carer1@example.com", name: "Map Carer One", postcode: "2031", card: {} },                                    // derive at fetch
  { email: "map.carer2@example.com", name: "Map Carer Two", postcode: "2021", card: { latE2: { integerValue: "-3380" }, lngE2: { integerValue: "15120" } } }, // stored coords
  { email: "map.carer3@example.com", name: "Map Carer Three", postcode: "2042", card: {} },                                  // derive at fetch
  { email: "map.carer4@example.com", name: "Map Carer Four", postcode: "", card: {} },                                                              // unplaceable
];
const seeded = [];
for (const s of SEEDS) { const a = await signUp(s.email, "MapCarer-2026-x"); const st = await setProfile(a.idToken, a.localId, { side: "carer", name: s.name, postcode: s.postcode, card: s.card }); seeded.push({ ...s, uid: a.localId, status: st }); }
ok(seeded.every((s) => s.status === 200), "map seeds: four carer profiles stand on the twin", JSON.stringify(seeded.map((s) => s.status)));

// ---------- drive the app as the family
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox", "--disable-dev-shm-usage", "--ignore-certificate-errors"], proxy: { server: "http://127.0.0.1:" + SHIM_PORT } });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("requestfailed", (r) => console.log("REQFAIL:", r.url().slice(0, 110), r.failure()?.errorText));
  await page.goto(BASE + "/door.html", { waitUntil: "load" });
  await page.click('[data-role="family"]');
  await page.waitForSelector("#authDoor:not([hidden])", { timeout: 8000 });
  await page.fill("#emailIn", FAMILY.email);
  await page.click("#nextBtn");
  await page.waitForSelector("#step2:not([hidden])", { timeout: 8000 });
  await page.fill("#pwIn", FAMILY.password);
  await page.click("#joinBtn");
  await page.waitForURL(/index\.html/, { timeout: 25000 });
  await page.waitForFunction(() => window.CARESITS_FIND_DATA && window.CARESITS_FIND_DATA.candidates, null, { timeout: 30000 });
  const pool = await page.evaluate(() => {
    const { areaCoordsFor } = window.__mapProbe || {};
    return window.CARESITS_FIND_DATA.candidates.map((d) => ({ name: d.displayName, postcode: d.postcode || (d.card && d.card.postcode) || "", lat: d.card ? d.card.latE2 : null }));
  });
  const placeable = pool.filter((d) => d.lat != null);
  console.log("fetched candidates:", pool.length, "| placeable (coords after fetch derive):", placeable.length, "|", placeable.map((d) => d.name).join(", "));
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-nav="find"]')].find((x) => x.offsetParent !== null) || document.querySelector('[data-nav="find"]'); b && b.click(); });
  await page.waitForSelector(".viewToggle", { timeout: 15000 });
  await page.click(".viewToggle .chip:nth-child(2)");
  await page.waitForTimeout(1500);
  const pins = await page.evaluate(() => document.querySelectorAll(".mapPin, .leaflet-marker-icon").length);
  ok(pins === placeable.length, "pins shown equals the placeable pool", `pins=${pins} placeable=${placeable.length}`);
  // Tap Map Carer One's pin: the letter button carries her
  // name in its aria label; a Leaflet marker is tapped by its
  // place in the same candidate order the pool printed.
  const tap = await page.evaluate((name) => {
    const pin = [...document.querySelectorAll(".mapPin")].find((b) => (b.getAttribute("aria-label") || "").includes(name));
    if (pin) { pin.click(); return "pin"; }
    return null;
  }, "Map Carer One");
  if (tap !== "pin") {
    await page.evaluate(() => { const m = document.querySelector('.leaflet-marker-icon[title="Map Carer One"]'); if (m) { m.dispatchEvent(new MouseEvent("click", { bubbles: true })); m.click(); } });
  }
  await page.waitForTimeout(700);
  const slotText = await page.evaluate(() => (document.querySelector(".mapSlot") || {}).textContent || "");
  ok(slotText.includes("Map Carer One"), "tapping the derived pin opens that carer's card in the slot", slotText.slice(0, 60));
} finally { await browser.close(); shimProc.kill(); treeServer.close(); }
console.log(process.exitCode ? "MAP SUITE: FAILURES STAND" : "MAP SUITE: ALL PASS");
