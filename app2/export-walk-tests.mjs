import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";

const MIME = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html", ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf" };
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const path = url === "/" ? "../app2/index.html" : url.startsWith("/fonts/") || url.startsWith("/next-phase/") || url.startsWith("/accounts/") ? ".." + url : "../app2" + url;
  try {
    const body = readFileSync(new URL(path, import.meta.url));
    const ext = path.slice(path.lastIndexOf("."));
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/html" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8936, r));

const { chromium } = await import("playwright-core");
const browser = await chromium.launch({
  executablePath: "/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.addInitScript(() => {
  // The shell's signed out gate (Leg 19 FAIL 1 ruling): this
  // walk enters as an explorer; its signed in seams ride below.
  try { sessionStorage.setItem("caresits-demo", "1"); } catch { /* storage off */ }
  window.CARESITS_ME = { uid: "f1", side: "family", name: "Sam", plusExtras: true };
  window.CARESITS_TRUST = { docs: [], reviews: [], me: { name: "Sam", side: "family", postcode: "2021" } };
  window.CARESITS_FAMILY = {
    children: [{ id: "k1", name: "Mila", theme: "fairies" }],
    entries: [{ day: "2026-10-16", tile: "Meal", note: "Ate all the pasta", at: "2026-10-16T03:00:00.000Z" }],
    side: "family",
  };
  localStorage.setItem("caresits-app2-questionnaire", JSON.stringify({ side: "family", answers: { postcode: "2021", role: "Nanny" }, strengths: {}, card: {} }));
});
await page.goto("http://localhost:8936/index.html", { waitUntil: "networkidle" });

let n = 0;
const t = (name, cond) => { assert.ok(cond, name); n += 1; console.log("ok -", name); };

await page.evaluate(() => document.querySelector('[data-nav="settings"]').click());
await page.waitForTimeout(250);
t("settings: the download card stands", await page.evaluate(() => document.getElementById("settingsRoot").textContent.includes("Download my data")));
const downloadPromise = page.waitForEvent("download");
await page.click("#exportBtn");
const download = await downloadPromise;
t("export: the file carries the product filename", download.suggestedFilename() === "CaresittersMyData.json");
const path = await download.path();
const data = JSON.parse(readFileSync(path, "utf8"));
t("export: profile rides in the copy", data.profile && (data.profile.name === "Sam" || data.profile.displayName === "Sam" || data.profile.me));
t("export: the questionnaire answers ride in the copy", data.answers && data.answers.postcode === "2021");
t("export: children ride in the copy", Array.isArray(data.children) && data.children.length === 1 && data.children[0].name === "Mila");
t("export: day story rides in the copy", Array.isArray(data.dayStory) && data.dayStory.length === 1 && data.dayStory[0].note === "Ate all the pasta");
t("export: the summary counts what is really there", data.summary.some((l) => l.includes("Children: 1")));
t("walk: no page errors", errs.length === 0);

// ---- F10: the copy reads the CURRENT family state (Test desk
// build 8 retest). CARESITS_FAMILY is assigned once at boot and
// goes stale inside a session; the exporter must read the live
// state family.js commits, and fall back to the in progress
// draft for answers. This block moves the file 8 -> 16 legs.
async function exportFrom(p) {
  await p.evaluate(() => document.querySelector('[data-nav="settings"]').click());
  await p.waitForTimeout(250);
  const dlPromise = p.waitForEvent("download");
  await p.evaluate(() => document.getElementById("exportBtn").click());
  const dl = await dlPromise;
  return JSON.parse(readFileSync(await dl.path(), "utf8"));
}
const newPage = async (seed) => {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  p.on("pageerror", (e) => errs.push(String(e)));
  // The shell's signed out gate (Leg 19 FAIL 1 ruling): every
  // walk page enters as an explorer.
  await p.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch { /* storage off */ } });
  await p.addInitScript(seed);
  await p.goto("http://localhost:8936/index.html", { waitUntil: "networkidle" });
  return p;
};

// (a) demo: no family hook at all; what is added on screen in
// this session must be in the copy.
{
  const dp = await newPage(() => {
    localStorage.setItem("caresits-tour-state", JSON.stringify({ closedUnanswered: true }));
  });
  await dp.evaluate(() => document.querySelector('[data-nav="children"]').click());
  await dp.waitForTimeout(250);
  await dp.fill("#kName", "Nia");
  await dp.evaluate(() => document.getElementById("kAdd").click());
  await dp.waitForTimeout(150);
  t("F10 demo: the added child is on screen", await dp.evaluate(() => document.getElementById("childrenRoot").textContent.includes("Nia")));
  await dp.evaluate(() => document.querySelector('[data-nav="daystory"]').click());
  await dp.waitForTimeout(250);
  await dp.fill("#tileNote", "Ate all the pasta");
  await dp.evaluate(() => document.getElementById("tileSave").click());
  await dp.waitForTimeout(150);
  const data = await exportFrom(dp);
  t("F10 demo: a child added this session rides in the copy", Array.isArray(data.children) && data.children.length === 1 && data.children[0].name === "Nia");
  t("F10 demo: a Day Story note added this session rides in the copy", Array.isArray(data.dayStory) && data.dayStory.length === 1 && data.dayStory[0].note === "Ate all the pasta");
  await dp.close();
}

// (b) boot shaped state plus a later add: both must be present.
{
  const bp = await newPage(() => {
    window.CARESITS_ME = { uid: "f1", side: "family", name: "Sam", plusExtras: true };
    window.CARESITS_TRUST = { docs: [], reviews: [], me: { name: "Sam", side: "family", postcode: "2021" } };
    window.CARESITS_FAMILY = {
      children: [{ id: "k1", name: "Mila", theme: "fairies" }],
      entries: [{ day: "2026-10-16", tile: "Meal", note: "Boot note", at: "2026-10-16T03:00:00.000Z" }],
      side: "family",
    };
  });
  await bp.evaluate(() => document.querySelector('[data-nav="children"]').click());
  await bp.waitForTimeout(250);
  await bp.fill("#kName", "Leo");
  await bp.evaluate(() => document.getElementById("kAdd").click());
  await bp.waitForTimeout(150);
  await bp.evaluate(() => document.querySelector('[data-nav="daystory"]').click());
  await bp.waitForTimeout(250);
  await bp.fill("#tileNote", "Session note");
  await bp.evaluate(() => document.getElementById("tileSave").click());
  await bp.waitForTimeout(150);
  const data = await exportFrom(bp);
  t("F10 boot: the boot child and the session child both ride in the copy", Array.isArray(data.children) && data.children.length === 2 && data.children.some((k) => k.name === "Mila") && data.children.some((k) => k.name === "Leo"));
  t("F10 boot: the boot note and the session note both ride in the copy", Array.isArray(data.dayStory) && data.dayStory.length === 2 && data.dayStory.some((e) => e.note === "Boot note") && data.dayStory.some((e) => e.note === "Session note"));
  await bp.close();
}

// (c) draft only answers: no finished bundle, the draft answers
// are the user's answers and belong in their file.
{
  const cp = await newPage(() => {
    window.CARESITS_ME = { uid: "f1", side: "family", name: "Sam", plusExtras: true };
    window.CARESITS_TRUST = { docs: [], reviews: [], me: { name: "Sam", side: "family", postcode: "2021" } };
    localStorage.setItem("caresits-app2-draft", JSON.stringify({ side: "family", page: 19, answers: { postcode: "2021", childrenBands: ["1-3"] }, strengths: {} }));
  });
  const data = await exportFrom(cp);
  t("F10 draft: with no finished questionnaire, the draft answers ride in the copy", data.answers && data.answers.postcode === "2021" && Array.isArray(data.answers.childrenBands) && data.answers.childrenBands[0] === "1-3");
  await cp.close();
}

// (d) precedence: a finished bundle beats the draft.
{
  const pp = await newPage(() => {
    window.CARESITS_ME = { uid: "f1", side: "family", name: "Sam", plusExtras: true };
    window.CARESITS_TRUST = { docs: [], reviews: [], me: { name: "Sam", side: "family", postcode: "2021" } };
    localStorage.setItem("caresits-app2-questionnaire", JSON.stringify({ side: "family", answers: { postcode: "2021" }, strengths: {}, card: {} }));
    localStorage.setItem("caresits-app2-draft", JSON.stringify({ side: "family", page: 19, answers: { postcode: "9999" }, strengths: {} }));
  });
  const data = await exportFrom(pp);
  t("F10 draft: a finished bundle wins over the draft", data.answers && data.answers.postcode === "2021");
  await pp.close();
}
// (e) the bin restore window: a restore writes through the
// live layer and never passes through family.js, so the
// export's mirror used to miss a restored record until the
// next boot. The flow below bins a child and a Day Story
// entry through the real surfaces, restores both from the
// Bin surface, and exports WITHOUT visiting Children or Day
// Story again. A CARESITS_WRITE stub plays the live layer's
// bin bookkeeping (bin-move lands the record in CARESITS_BIN,
// bin-restore takes it out). This block moves the file
// 16 -> 19 legs.
{
  const rp = await newPage(() => {
    window.CARESITS_ME = { uid: "f1", side: "family", name: "Sam", plusExtras: true };
    window.CARESITS_TRUST = { docs: [], reviews: [], me: { name: "Sam", side: "family", postcode: "2021" } };
    window.CARESITS_FAMILY = {
      children: [{ id: "k9", name: "Rosa", theme: "ocean" }],
      entries: [{ day: "2026-10-16", tile: "Meal", note: "Boot soup", at: "2026-10-16T03:00:00.000Z" }],
      side: "family",
    };
    window.CARESITS_BIN = [];
    window.CARESITS_WRITE = (kind, payload) => {
      if (kind === "bin-move" && payload && payload.path && payload.data) {
        const binId = payload.path.split("/").pop();
        window.CARESITS_BIN.push({ id: binId, ...payload.data });
      }
      if (kind === "bin-restore" && payload && payload.binId) {
        window.CARESITS_BIN = window.CARESITS_BIN.filter((i) => i.id !== payload.binId);
      }
    };
    localStorage.setItem("caresits-tour-state", JSON.stringify({ closedUnanswered: true }));
  });
  // Bin the child through the real Remove + confirm sheet.
  await rp.evaluate(() => document.querySelector('[data-nav="children"]').click());
  await rp.waitForTimeout(250);
  await rp.evaluate(() => document.querySelector("#childrenRoot .kidCard .quietBtn").click());
  await rp.waitForTimeout(150);
  await rp.evaluate(() => document.querySelector("#safetySheet .mainBtn").click());
  await rp.waitForTimeout(150);
  // Bin the Day Story entry through its real Remove button.
  await rp.evaluate(() => document.querySelector('[data-nav="daystory"]').click());
  await rp.waitForTimeout(250);
  await rp.evaluate(() => document.querySelector("#daystoryRoot .findCard .quietBtn").click());
  await rp.waitForTimeout(150);
  // Restore both from the Bin surface.
  await rp.evaluate(() => document.querySelector('[data-nav="bin"]').click());
  await rp.waitForTimeout(250);
  t("F10 restore: the binned child and entry stand on the Bin surface", await rp.evaluate(() => {
    const txt = document.getElementById("binRoot").textContent;
    return txt.includes("Rosa") && document.querySelectorAll("#binRoot .findCard").length === 2;
  }));
  await rp.evaluate(() => {
    for (const card of document.querySelectorAll("#binRoot .findCard")) card.querySelector(".quietBtn").click();
  });
  await rp.waitForTimeout(150);
  // Export WITHOUT visiting Children or Day Story again.
  const data = await exportFrom(rp);
  t("F10 restore: a child restored this session rides in the copy", Array.isArray(data.children) && data.children.length === 1 && data.children[0].name === "Rosa");
  t("F10 restore: a Day Story entry restored this session rides in the copy", Array.isArray(data.dayStory) && data.dayStory.length === 1 && data.dayStory[0].note === "Boot soup");
  await rp.close();
}
t("F10 walk: no page errors across the new pages", errs.length === 0);

console.log(`\nALL ${n} export walk checks passed`);
await browser.close();
server.close();
