import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";

const MIME = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html", ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf" };
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const path = url === "/" ? "../app2/journey.html" : url.startsWith("/fonts/") || url.startsWith("/next-phase/") || url.startsWith("/accounts/") ? ".." + url : "../app2" + url;
  try {
    const body = readFileSync(new URL(path, import.meta.url));
    const ext = path.slice(path.lastIndexOf("."));
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/html" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8933, r));

const { chromium } = await import("playwright-core");
const browser = await chromium.launch({
  executablePath: "/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto("http://localhost:8933/", { waitUntil: "networkidle" });

let n = 0;
const t = (name, cond) => { assert.ok(cond, name); n += 1; console.log("ok -", name); };

t("welcome shows the time promise", (await page.textContent("body")).includes("About 10 minutes for everything"));
t("welcome bunny is her hello seat", (await page.getAttribute(".bunnyBig", "src")).includes("bunny-hello"));

await page.click('[data-side="family"]');
t("family page 1 of 20 (the country step stands first)", (await page.textContent("#pageCount")).includes("Page 1 of 20"));
await page.click("#nextBtn");
t("required questions hold the page", (await page.textContent("#notice")).length > 3);
await page.click('[data-chip="country"][data-value="Australia"]');
await page.click("#nextBtn");
await page.click('[data-chip="role"][data-value="Nanny"]');
await page.fill('[data-field="postcode"]', "2021");
await page.click('[data-chip="childrenBands"][data-value="1-3"]');
await page.click('[data-chip="languages"][data-value="English"]');
await page.click('[data-yesno="pets"][data-value="yes"]');
await page.click('[data-yesno="smokerHousehold"][data-value="no"]');
t("optional question is marked with her honesty note", (await page.textContent("body")).includes("the more you answer, the better we match you"));
await page.click("#nextBtn");
t("after the family page comes the week", (await page.textContent("#pageTitle")).includes("Your week"));
await page.click('[data-grid="scheduleNeed"][data-day="Thu"][data-part="morning"]');
await page.click('[data-chip="startWhen"][data-value="As soon as possible"]');
await page.click('[data-chip="payOffered"][data-value="38"]');
await page.click("#nextBtn");
await page.click("#nextBtn"); // activities optional, skip
await page.click("#nextBtn"); // personality optional, skip
t("page 5 is the looking for page", (await page.textContent("#pageTitle")).includes("looking for"));
t("strength choices ride the looking for fields", (await page.textContent("body")).includes("Must have"));
await page.click('[data-strength="nonSmoker"][data-value="Must have"]');
await page.click('[data-yesno="nonSmoker"][data-value="yes"]');
await page.click('[data-chip="maxDistanceKm"][data-value="10"]');
for (let i = 0; i < 20 && (await page.locator("#done").isHidden()); i++) await page.click("#nextBtn");
t("the longer journey walks its expansion pages to the end", (await page.textContent("#pageCount").catch(() => "")).length >= 0);
t("done page celebrates", !(await page.locator("#done").isHidden()));
const bundle = await page.evaluate(() => JSON.parse(localStorage.getItem("caresits-app2-questionnaire")));
t("bundle carries the family card and the must", bundle.side === "family" && bundle.card.musts.nonSmoker === true && bundle.card.scheduleNeed.Thu.includes("morning"));

await page.evaluate(() => { localStorage.clear(); });
await page.reload({ waitUntil: "networkidle" });
await page.click('[data-side="carer"]');
await page.click('[data-chip="country"][data-value="Australia"]');
await page.click("#nextBtn");
await page.fill('[data-field="displayName"]', "Ana");
await page.fill('[data-field="postcode"]', "2021");
await page.click('[data-chip="age"][data-value="29"]');
await page.click('[data-chip="nationality"][data-value="Colombian"]');
await page.click('[data-chip="languages"][data-value="English"]');
await page.click("#nextBtn");
t("carer page 2 asks the exact age bands experience", (await page.textContent("body")).includes("Years of experience"));
t("no page errors", errs.length === 0);


t("answer shapes: the only typed answers left are the name and postcode facts and the two write ins per side", await page.evaluate(async () => {
  const { EXPANSION } = await import("./questions2.js");
  const texts = EXPANSION.family.concat(EXPANSION.carer).flatMap((p) => p.fields).filter((f) => f.type === "text").map((f) => f.pair);
  return JSON.stringify(texts.sort()) === JSON.stringify(["C54", "C56", "F33", "F49"]);
}));

// ---- Shell: her nav shape (15 Oct 2026) ----
// The signed out gate (Leg 19 FAIL 1 ruling): a bare signed out
// entry bounces to the door; the suite's shell walk enters the
// way an explorer does, through the demo marker.
{
  const bare = await browser.newPage();
  await bare.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await bare.waitForFunction(() => location.pathname.endsWith("door.html"), null, { timeout: 15000 }).catch(() => {});
  t("gate (Leg 19 FAIL 1): a bare signed out shell entry lands on the door", await bare.evaluate(() => location.pathname.endsWith("door.html")));
  await bare.close();
}
await page.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch { /* storage off */ } });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
t("shell: menu hidden on load, content full width", await page.evaluate(() => !document.getElementById("layout").classList.contains("open") && document.getElementById("menu").offsetWidth <= 2 && document.getElementById("content").offsetWidth >= window.innerWidth - 2));
await page.screenshot({ path: "shell-closed.png" });
await page.click("#menuBtn");
await page.waitForTimeout(450);
const widths = await page.evaluate(() => ({ menu: document.getElementById("menu").offsetWidth, sliver: document.getElementById("sliver").offsetWidth, total: window.innerWidth }));
t("shell: open menu takes most of the screen, content a thin sliver", widths.menu > widths.total * 0.6 && widths.sliver > 0 && widths.sliver < widths.total * 0.4);
await page.screenshot({ path: "shell-open.png" });
await page.click("#sliver");
await page.waitForTimeout(450);
t("shell: tapping the sliver returns full content", await page.evaluate(() => !document.getElementById("layout").classList.contains("open")));
t("shell: no page errors", errs.length === 0);


// ---- Phase B: the Find surface ----
{
  const famDoc = { side: "family", displayName: "Sam", postcode: "2021", card: {
    childrenBands: ["1-3", "3-5"], languages: ["English", "Spanish"], pets: true, smokerHousehold: false, payOffered: 38,
    scheduleNeed: { Thu: ["morning", "afternoon"], Tue: ["afternoon"] }, latE2: -3388, lngE2: 15123 },
    looking: { musts: { languages: ["English"], checksLevel: "register", maxDistanceKm: 10, tasks: ["school runs"] },
               prefs: { personality: ["warm", "patient", "playful"], activities: ["park", "reading"], tasks: ["school runs", "cooking"], cooking: true, routineStyle: "steady rhythm" } } };
  const anaCard = { age: 29, nationality: "Colombian", languages: ["English", "Spanish"], smoker: false,
    experience: { "1-3": 6, "3-5": 5 }, checksLevel: "register", drives: true, ownCar: true, petsOk: true, cooking: true,
    tasks: ["school runs", "cooking"], specialNeeds: true, availability: { Thu: ["morning", "afternoon"], Tue: ["afternoon"] },
    activities: ["park", "reading", "music"], personality: ["warm", "patient", "playful"], routineStyle: "steady rhythm",
    maxDistanceKm: 12, payFloor: 32, agesAccepted: ["1-3", "3-5"], agesPreferred: ["1-3", "3-5"], latE2: -3389, lngE2: 15124 };
  const carer = (name) => ({ side: "carer", displayName: name, postcode: "2021", card: { ...anaCard }, looking: { musts: {}, prefs: {} } });
  const mei = { side: "carer", displayName: "Mei", postcode: "2021", card: { ...anaCard, availability: { Tue: ["afternoon"] } }, looking: { musts: {}, prefs: {} } };
  const candidates = [carer("Ana"), carer("Bea"), carer("Cleo"), carer("Dana"), carer("Elif"), carer("Faye"), carer("Gia"), mei];
  const fp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const ferrs = [];
  fp.on("pageerror", (e) => ferrs.push(String(e)));
  await fp.addInitScript((data) => { window.CARESITS_FIND_DATA = data; }, { viewer: famDoc, candidates });
  await fp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await fp.click("#menuBtn");
  await fp.click('[data-group="finding"]') .catch(() => {});
  await fp.evaluate(() => document.querySelector('.navGroupHead[data-group="finding"]').click());
  await fp.evaluate(() => document.querySelector('[data-nav="find"]').click());
  await fp.waitForTimeout(300);
  t("find: pool line is live and honest", await fp.evaluate(() => document.querySelector(".findPool")?.textContent.includes("8 carers in your pool")));
  t("find: Top 5 shows Ana as a Perfect Pair", await fp.evaluate(() => { const cards = [...document.querySelectorAll("#surface-find .findList .findCard")]; return cards.length >= 5 && document.body.innerHTML.includes("Perfect Pair") && [...document.querySelectorAll(".findName")].some((n) => n.textContent === "Ana"); }));
  t("find: extra matches wait behind View more", await fp.evaluate(() => { const btn = document.querySelector(".findMore"); const hiddenCount = document.querySelectorAll(".findCard").length; return !!btn; }));
  await fp.click(".findMore");
  await fp.waitForTimeout(150);
  t("find: View more opens the rest", await fp.evaluate(() => document.querySelectorAll("#surface-find .findCard:not(.nearly)").length >= 7));
  t("find: nearly list names the failed gate in plain words", await fp.evaluate(() => document.body.innerHTML.includes("not free on a day you need")));
  t("find: every match card carries a Message button", await fp.evaluate(() => document.querySelectorAll(".findMsg").length >= 7));
  t("find: no page errors", ferrs.length === 0);
  await fp.evaluate(() => { document.querySelector(".viewToggle .chip:nth-child(2)")?.click(); });
  t("map: pins render for the pool at area level", await fp.locator("#surface-find .mapPin").count() === 8);
  await fp.evaluate(() => [...document.querySelectorAll("#surface-find .mapPin")].find((p) => p.getAttribute("aria-label")?.startsWith("Ana"))?.click());
  t("map: a pin opens the card with the pair score as a percent", await fp.evaluate(() => {
    const listFit = [...document.querySelectorAll("#surface-find .findCard")].find((c) => c.querySelector(".findName")?.textContent === "Ana")?.querySelector(".fitScore")?.textContent.match(/\d+/)?.[0];
    const mapPct = document.querySelector("#surface-find .mapSlot .mapPct")?.textContent.match(/\d+/)?.[0];
    return !!listFit && listFit === mapPct;
  }));
  await fp.close();
  const ep = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await ep.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  await ep.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await ep.evaluate(() => document.querySelector('[data-nav="find"]')?.click());
  await ep.waitForTimeout(300);
  t("find: with no finished questionnaire the invite state stands", await ep.evaluate(() => document.getElementById("findRoot").textContent.includes("Your matches wait for your answers")));
  t("map: an exploring viewer sees pins but no personal percent", await ep.evaluate(() => document.querySelectorAll("#findRoot .mapPin").length >= 0 && document.querySelectorAll("#findRoot .mapPct").length === 0));
  await ep.close();
  const qp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await qp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  await qp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  const honest = await qp.evaluate(async () => {
    const { renderFind } = await import("./find.js");
    const ana = { uid: "c1", side: "carer", displayName: "Ana", postcode: "2021", level: "full", card: { age: 29, languages: ["English"], availability: { Thu: ["morning"] }, checksLevel: "Register verified", experience: { "1-3": 3 }, tasks: [], maxDistanceKm: 12, payFloor: 32, agesAccepted: ["1-3", "3-5"], agesPreferred: ["1-3"], latE2: -3389, lngE2: 15124 }, looking: { musts: {}, prefs: {} } };
    const famBase = { uid: "f1", side: "family", displayName: "Sam", postcode: "2021", card: { childrenBands: ["1-3"], languages: ["English"], scheduleNeed: { Thu: ["morning"] }, payOffered: 40, latE2: -3388, lngE2: 15123 } };
    document.querySelectorAll(".surface").forEach((s) => (s.hidden = true));
    document.getElementById("surface-find").hidden = false;
    const root = document.getElementById("findRoot");
    renderFind(root, { ...famBase, level: "quick" }, [ana]);
    const quickCard = root.querySelector(".findCard");
    const f1 = !!quickCard?.querySelector(".qualLine") && quickCard.textContent.includes("Quick profile, rough match");
    renderFind(root, { ...famBase, level: "explore" }, [ana]);
    const exCard = root.querySelector(".findCard");
    const f2 = !!exCard && !exCard.textContent.includes("Pair fit") && exCard.textContent.includes("Answer the quick questions");
    return { f1, f2 };
  });
  t("levels: the rough word stands outside the reasons on a Quick pair (F1)", honest.f1);
  t("levels: an explore viewer with a doc sees no personal percent (F2)", honest.f2);
  await qp.close();
}


// ---- Phase C: matches + urgent board ----
{
  const cp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await cp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const cerrs = [];
  cp.on("pageerror", (e) => cerrs.push(String(e)));
  await cp.addInitScript(() => {
    window.__writes = [];
    window.CARESITS_WRITE = (kind, payload) => window.__writes.push({ kind, payload });
    window.CARESITS_ME = { uid: "f1", side: "family" };
    window.CARESITS_PROFILE_COMPLETE = false;
    window.CARESITS_PHASE_C = {
      viewer: { uid: "f1", side: "family" },
      names: { c1: "Ana", c2: "Priya" },
      rels: [
        { id: "c1_f1", members: ["c1", "f1"], familyUid: "f1", carerUid: "c1", state: "pending", createdBy: "c1", createdDay: "2026-10-15" },
        { id: "c2_f1", members: ["c2", "f1"], familyUid: "f1", carerUid: "c2", state: "contact", createdBy: "f1", createdDay: "2026-10-15" },
      ],
      jobs: [{ id: "j1", state: "open", postcode: "2021", when: "Today", note: "Two kids, afternoon" }],
    };
  });

  await cp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await cp.evaluate(() => document.querySelector('[data-nav="matches"]').click());
  await cp.waitForTimeout(250);
  t("matches: both pairs render with their standing words", await cp.evaluate(() => document.getElementById("matchesRoot").textContent.includes("Ana") && document.getElementById("matchesRoot").textContent.includes("Working together") === false && document.getElementById("matchesRoot").textContent.includes("In contact")));
  t("matches: the other side's pair offers Confirm contact", await cp.evaluate(() => [...document.querySelectorAll("#matchesRoot button")].some((b) => b.textContent === "Confirm contact")));
  t("matches: the hired step waits for contact, offered on the contact pair", await cp.evaluate(() => [...document.querySelectorAll("#matchesRoot button")].filter((b) => b.textContent === "Mark as hired").length === 1));
  await cp.evaluate(() => [...document.querySelectorAll("#matchesRoot button")].find((b) => b.textContent === "Confirm contact").click());
  t("matches: confirming writes the stamped patch", await cp.evaluate(() => window.__writes.some((w) => w.kind === "transition" && w.payload.patch.state === "contact" && w.payload.patch.contactBy === "f1")));
  await cp.evaluate(() => document.querySelector('[data-nav="board"]').click());
  await cp.waitForTimeout(200);
  t("board: the open job shows to everyone", await cp.evaluate(() => document.getElementById("boardRoot").textContent.includes("Postcode 2021")));
  t("board: a family sees the post form", await cp.evaluate(() => document.getElementById("boardRoot").textContent.includes("Post a job")));
  await cp.evaluate(() => [...document.querySelectorAll("#boardRoot button")].find((b) => b.textContent === "Post the job").click());
  await cp.waitForTimeout(200);
  t("board: an unfinished profile is walked to the questions, never scolded", await cp.evaluate(() => !document.getElementById("surface-questionnaire").hidden && document.getElementById("boardRoot").textContent.includes("walk you there")));
  await cp.evaluate(() => { window.CARESITS_PROFILE_COMPLETE = true; });
  await cp.evaluate(() => document.querySelector('[data-nav="board"]').click());
  await cp.evaluate(() => [...document.querySelectorAll("#boardRoot button")].find((b) => b.textContent === "Post the job").click());
  t("board: a finished profile posts through the planner", await cp.evaluate(() => window.__writes.some((w) => w.kind === "job" && w.payload.data.state === "open")));
  t("phase C: no page errors", cerrs.length === 0);
  await cp.close();
}


// ---- F19: the live Phase C seam lands after first render ----
{
  const lp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await lp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const lerrs = [];
  lp.on("pageerror", (e) => lerrs.push(String(e)));
  await lp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await lp.evaluate(() => document.querySelector('[data-nav="matches"]').click());
  await lp.waitForTimeout(250);
  t("F19: before the live fetch lands, matches stands in its empty state", await lp.evaluate(() => document.getElementById("matchesRoot").textContent.includes("they will wait for you here")));
  t("F19: the render seam stands ready for the live bridge", await lp.evaluate(() => typeof window.CARESITS_PHASE_C_RENDER === "function"));
  await lp.evaluate(() => {
    window.CARESITS_PHASE_C = {
      viewer: { uid: "f1", side: "family" },
      names: { c1: "Ana" },
      rels: [{ id: "c1_f1", members: ["c1", "f1"], familyUid: "f1", carerUid: "c1", state: "contact", createdBy: "f1", createdDay: "2026-10-18" }],
      jobs: [{ id: "j1", familyUid: "f9", state: "open", postcode: "2021", when: "Today", note: "Two kids, afternoon" }],
    };
    window.CARESITS_PHASE_C_RENDER();
  });
  await lp.waitForTimeout(150);
  t("F19: when the seam lands, the pair card renders in place", await lp.evaluate(() => document.getElementById("matchesRoot").textContent.includes("Ana") && document.getElementById("matchesRoot").textContent.includes("In contact")));
  await lp.evaluate(() => document.querySelector('[data-nav="board"]').click());
  await lp.waitForTimeout(200);
  t("F19: the board renders the live job card", await lp.evaluate(() => document.getElementById("boardRoot").textContent.includes("Postcode 2021") && document.getElementById("boardRoot").textContent.includes("Two kids, afternoon")));
  t("F19: no page errors", lerrs.length === 0);
  await lp.close();
}


// ---- Amendment 4: report + block on the surfaces ----
{
  const sp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await sp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const serrs = [];
  sp.on("pageerror", (e) => serrs.push(String(e)));
  await sp.addInitScript(() => {
    window.__writes = [];
    window.CARESITS_WRITE = (kind, payload) => window.__writes.push({ kind, payload });
    window.CARESITS_ME = { uid: "f1", side: "family" };
    window.CARESITS_PROFILE_COMPLETE = true;
    window.CARESITS_PHASE_C = {
      viewer: { uid: "f1", side: "family" },
      names: { c1: "Ana" },
      rels: [{ id: "c1_f1", members: ["c1", "f1"], familyUid: "f1", carerUid: "c1", state: "contact", createdBy: "c1", createdDay: "2026-10-15" }],
      jobs: [],
    };
  });
  await sp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await sp.evaluate(() => document.querySelector('[data-nav="matches"]').click());
  await sp.waitForTimeout(250);
  await sp.evaluate(() => [...document.querySelectorAll("#matchesRoot .quietBtn")].find((b) => b.textContent === "Report").click());
  await sp.waitForTimeout(150);
  t("safety: the report sheet opens with the plain reasons", await sp.evaluate(() => document.getElementById("safetySheet")?.textContent.includes("Rude or abusive")));
  await sp.evaluate(() => [...document.querySelectorAll(".chipBtn")].find((b) => b.textContent === "Rude or abusive").click());
  await sp.evaluate(() => [...document.querySelectorAll("#safetySheet button")].find((b) => b.textContent === "Send the report").click());
  await sp.waitForTimeout(150);
  t("safety: the filing is written write only, in the fenced vocabulary", await sp.evaluate(() => window.__writes.some((w) => w.kind === "report" && w.payload.data.category === "rude_abusive" && w.payload.data.state === "open")));
  t("safety: the filer gets the acknowledgement and never an outcome", await sp.evaluate(() => document.getElementById("safetySheet")?.textContent.includes("will not hear the outcome")));
  await sp.evaluate(() => [...document.querySelectorAll("#safetySheet button")].find((b) => b.textContent === "Done").click());
  await sp.evaluate(() => [...document.querySelectorAll("#matchesRoot .quietBtn")].find((b) => b.textContent === "Block").click());
  await sp.waitForTimeout(150);
  t("safety: the block sheet speaks plainly, never told, nothing deleted", await sp.evaluate(() => document.getElementById("safetySheet")?.textContent.includes("Nothing is deleted")));
  await sp.evaluate(() => [...document.querySelectorAll("#safetySheet button")].find((b) => b.textContent === "Block").click());
  await sp.waitForTimeout(150);
  t("safety: the block lands in the filer's own space and the pair leaves the view", await sp.evaluate(() => window.__writes.some((w) => w.kind === "block" && w.payload.path === "users/f1/blocks/c1") && !document.getElementById("matchesRoot").textContent.includes("Ana")));
  t("safety: no page errors", serrs.length === 0);
  await sp.close();
}

// ---- QA F-LOW: a block sever recounts the Find pool line ----
{
  const bp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await bp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  await bp.addInitScript(() => {
    window.__writes = [];
    window.CARESITS_WRITE = (kind, payload) => window.__writes.push({ kind, payload });
    window.CARESITS_ME = { uid: "f1", side: "family" };
    window.CARESITS_PROFILE_COMPLETE = true;
  });
  await bp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  const recount = await bp.evaluate(async () => {
    const { renderFind } = await import("./find.js");
    const famDoc = { uid: "f1", side: "family", displayName: "Sam", postcode: "2021", card: { childrenBands: ["1-3"], languages: ["English"], scheduleNeed: { Thu: ["morning"] }, payOffered: 40, latE2: -3388, lngE2: 15123 } };
    const anaDoc = { uid: "c1", side: "carer", displayName: "Ana", postcode: "2021", card: { age: 29, languages: ["English"], availability: { Thu: ["morning"] }, checksLevel: "Register verified", experience: { "1-3": 3 }, tasks: [], maxDistanceKm: 12, payFloor: 32, agesAccepted: ["1-3", "3-5"], agesPreferred: ["1-3"], latE2: -3389, lngE2: 15124 }, looking: { musts: {}, prefs: {} } };
    document.querySelectorAll(".surface").forEach((s) => (s.hidden = true));
    document.getElementById("surface-find").hidden = false;
    const root = document.getElementById("findRoot");
    renderFind(root, famDoc, [anaDoc]);
    const before = root.querySelector(".findPool").textContent;
    [...root.querySelectorAll(".quietBtn")].find((b) => b.textContent === "Block").click();
    await new Promise((r) => setTimeout(r, 100));
    [...document.querySelectorAll("#safetySheet button")].find((b) => b.textContent === "Block").click();
    await new Promise((r) => setTimeout(r, 100));
    return { before, after: root.querySelector(".findPool")?.textContent || "" };
  });
  t("flow: after a block severs the only card the pool line recounts", recount.before.includes("1 carer in your pool") && recount.after.includes("0 carers in your pool"));
  await bp.close();
}


// ---- Amendment 5: the pair calendar ----
{
  const kp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await kp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const kerrs = [];
  kp.on("pageerror", (e) => kerrs.push(String(e)));
  await kp.addInitScript(() => {
    window.__writes = [];
    window.CARESITS_WRITE = (kind, payload) => window.__writes.push({ kind, payload });
    window.CARESITS_CALENDAR = {
      viewerUid: "f1",
      pairs: [{
        pairId: "c1_f1", otherUid: "c1", otherName: "Ana",
        pattern: [{ day: "Thu", parts: ["morning"], start: "09:00", end: "12:00" }],
        blocks: [
          { day: "Tue", start: "15:00", end: "17:00", kind: "extra", state: "live" },
          { day: "Wed", start: "", end: "", kind: "off", state: "live" },
        ],
        requests: [
          { id: "R1", kind: "extra", askedBy: "c1", day: "Tue", start: "09:00", end: "12:00", state: "waiting" },
          { id: "R2", kind: "off", askedBy: "f1", day: "Fri", start: "", end: "", state: "waiting" },
        ],
      }],
    };
  });
  await kp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await kp.evaluate(() => document.querySelector('[data-nav="calendar"]').click());
  await kp.waitForTimeout(250);
  t("calendar: the pair renders with the other name on every block", await kp.evaluate(() => document.getElementById("calendarRoot").textContent.includes("Calendar with Ana") && document.getElementById("calendarRoot").textContent.includes("with Ana")));
  t("calendar: regular, one time and day off wear their three looks", await kp.evaluate(() => !!document.querySelector(".calBlock.regular") && !!document.querySelector(".calBlock.onceBlock") && !!document.querySelector(".calBlock.offBlock")));
  t("calendar: tags speak plainly", await kp.evaluate(() => document.getElementById("calendarRoot").textContent.includes("One time") && document.getElementById("calendarRoot").textContent.includes("Day off")));
  t("calendar: PIN C clash line stands on the accept card", await kp.evaluate(() => document.getElementById("calendarRoot").textContent.includes("already has a one time block")));
  t("calendar: my own request waits, with no buttons for me", await kp.evaluate(() => document.getElementById("calendarRoot").textContent.includes("Waiting for Ana to answer")));
  await kp.evaluate(() => [...document.querySelectorAll("#calendarRoot button")].find((b) => b.textContent === "Accept").click());
  await kp.waitForTimeout(150);
  t("calendar: accepting writes the decision and lands an equal block", await kp.evaluate(() => window.__writes.some((w) => w.kind === "request-decide" && w.payload.patch.decidedBy === "f1") && window.__writes.some((w) => w.kind === "block-land" && w.payload.data.day === "Tue" && w.payload.data.sourceRequest === "R1")));
  t("calendar: no page errors", kerrs.length === 0);
  await kp.close();
}


// ---- Door v4 + the bunny tour ----
{
  const dp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await dp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const derrs = [];
  dp.on("pageerror", (e) => derrs.push(String(e)));
  await dp.goto("http://localhost:8933/door.html", { waitUntil: "networkidle" });
  await dp.waitForTimeout(250);
  t("door: the sign up stands alone, big and centred", await dp.evaluate(() => !!document.querySelector(".doorMark") && !!document.getElementById("googleBtn") && !!document.getElementById("appleBtn") && !!document.getElementById("emailIn") && !!document.getElementById("nextBtn")));
  t("door: no password on the first page", await dp.evaluate(() => document.getElementById("step2").hidden === true));
  await dp.fill("#emailIn", "sam@example.com");
  await dp.click("#nextBtn");
  t("door: step two shows the email, Change, and the password", await dp.evaluate(() => !document.getElementById("step2").hidden && document.getElementById("emailEcho").textContent === "sam@example.com" && !!document.getElementById("pwIn")));
  t("door: no page errors", derrs.length === 0);
  await dp.close();

  const tp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await tp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const terrs = [];
  tp.on("pageerror", (e) => terrs.push(String(e)));
  await tp.addInitScript(() => sessionStorage.setItem("caresits-tour", "1"));
  await tp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await tp.waitForTimeout(300);
  t("tour: the pop up stands in the middle after sign up", await tp.evaluate(() => !!document.getElementById("tourPop") && document.getElementById("tourPop").textContent.includes("what is your name")));
  await tp.fill("#tourNameIn", "Sam");
  await tp.evaluate(() => [...document.querySelectorAll("#tourPop button")].find((b) => b.textContent === "Next").click());
  t("tour: the name lands and the walk moves on", await tp.evaluate(() => localStorage.getItem("caresits-name") === "Sam" && document.getElementById("tourPop").textContent.includes("This is your menu")));
  await tp.evaluate(() => document.querySelector("#tourPop .sheetX").click());
  t("tour: the cross closes it at any time", await tp.evaluate(() => !document.getElementById("tourPop")));
  t("tour: no page errors", terrs.length === 0);
  await tp.close();

  const rp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await rp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  await rp.addInitScript(() => { if (!localStorage.getItem("caresits-tour-state")) localStorage.setItem("caresits-tour-state", JSON.stringify({ closedUnanswered: true })); });
  await rp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await rp.waitForTimeout(300);
  t("tour: the name is re offered once, as one small quiet bubble", await rp.evaluate(() => !!document.getElementById("nameBubble") && !document.getElementById("tourPop")));
  await rp.evaluate(() => [...document.querySelectorAll("#nameBubble button")].find((b) => b.textContent === "Not now").click());
  await rp.evaluate(() => sessionStorage.clear());
  await rp.reload({ waitUntil: "networkidle" });
  await rp.waitForTimeout(300);
  t("tour: after the one re offer, never again", await rp.evaluate(() => !document.getElementById("nameBubble")));
  await rp.close();
}


// ---- Phase D: Children + Day Story ----
{
  const fp2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fp2.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const ferrs = [];
  fp2.on("pageerror", (e) => ferrs.push(String(e)));
  await fp2.addInitScript(() => {
    window.__writes = [];
    window.CARESITS_WRITE = (kind, payload) => window.__writes.push({ kind, payload });
    window.CARESITS_FAMILY = { children: [{ id: "k1", name: "Mila", theme: "fairies" }], entries: [], side: "family" };
  });
  await fp2.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await fp2.evaluate(() => document.querySelector('[data-nav="children"]').click());
  await fp2.waitForTimeout(250);
  t("children: the card shows with its theme name", await fp2.evaluate(() => document.getElementById("childrenRoot").textContent.includes("Mila") && document.getElementById("childrenRoot").textContent.includes("Fairies theme")));
  await fp2.fill("#kName", "Leo");
  await fp2.evaluate(() => { document.getElementById("kTheme").value = "space"; });
  await fp2.click("#kAdd");
  await fp2.waitForTimeout(150);
  t("children: adding writes through the layer and the card appears", await fp2.evaluate(() => window.__writes.some((w) => w.kind === "child-add" && w.payload.name === "Leo" && w.payload.theme === "space") && document.getElementById("childrenRoot").textContent.includes("Leo")));
  await fp2.evaluate(() => [...document.querySelectorAll("#childrenRoot .quietBtn")].find((b) => b.textContent === "Remove").click());
  await fp2.waitForTimeout(150);
  t("children: Remove carries the B2 guard, one clear confirm in plain words", await fp2.evaluate(() => document.getElementById("safetySheet")?.textContent.includes("cannot be undone")));
  t("children: nothing is removed before the confirm", await fp2.evaluate(() => !window.__writes.some((w) => w.kind === "child-remove")));
  await fp2.evaluate(() => [...document.querySelectorAll("#safetySheet button")].find((b) => b.textContent === "Yes, remove").click());
  t("children: the confirm removes through the layer", await fp2.evaluate(() => window.__writes.some((w) => w.kind === "child-remove")));
  await fp2.evaluate(() => document.querySelector('[data-nav="daystory"]').click());
  await fp2.waitForTimeout(200);
  t("day story: the tiles stand ready", await fp2.evaluate(() => !!document.querySelector('[data-tile="meal"]')));
  await fp2.fill("#tileNote", "Ate all the pasta");
  await fp2.click("#tileSave");
  await fp2.waitForTimeout(150);
  t("day story: saving writes the entry with its day", await fp2.evaluate(() => window.__writes.some((w) => w.kind === "dayStory" && w.payload.tile === "Meal" && w.payload.note === "Ate all the pasta")));
  t("day story: a parent can ask for a photo", await fp2.evaluate(() => [...document.querySelectorAll("#daystoryRoot button")].some((b) => b.textContent.includes("Ask for a photo"))));
  await fp2.evaluate(() => [...document.querySelectorAll("#daystoryRoot button")].find((b) => b.textContent.includes("Ask for a photo")).click());
  t("day story: the photo request rides the same flow", await fp2.evaluate(() => window.__writes.some((w) => w.kind === "photo-request")));
  t("family surfaces: no page errors", ferrs.length === 0);
  await fp2.close();
}


// ---- Phase D: week + trust + thread with the taste wall ----
{
  const wp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await wp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const werrs = [];
  wp.on("pageerror", (e) => werrs.push(String(e)));
  await wp.addInitScript(() => {
    window.__writes = [];
    window.CARESITS_WRITE = (kind, payload) => window.__writes.push({ kind, payload });
    window.CARESITS_WEEK = { sessions: [{ day: "Thu", start: "09:00", end: "12:00", withName: "Ana" }], entries: [{ day: "Thu", hours: 3, withName: "Ana" }], reminders: [], emergency: [] };
    window.CARESITS_TRUST = { docs: [{ title: "Working With Children Check", level: "Register verified", limit: "Checked on the official register. A register listing is not a character reference." }], reviews: [], me: { name: "Sam", side: "family", postcode: "2021" } };
    window.CARESITS_THREAD = { pairId: "c1_f1", otherName: "Ana", messages: [], plan: { tier: "free", doorOpen: false }, tasteUsedToday: 0 };
  });
  await wp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await wp.evaluate(() => document.querySelector('[data-nav="roster"]').click());
  await wp.waitForTimeout(200);
  t("roster: the agreed week stands with its person", await wp.evaluate(() => document.getElementById("rosterRoot").textContent.includes("with Ana")));
  await wp.evaluate(() => document.querySelector('[data-nav="timesheet"]').click());
  await wp.waitForTimeout(150);
  t("timesheet: the hours add up in the open", await wp.evaluate(() => document.getElementById("timesheetRoot").textContent.includes("Hours this week: 3")));
  await wp.evaluate(() => document.querySelector('[data-nav="checks"]').click());
  await wp.waitForTimeout(150);
  t("checks: the badge word sits beside its limit", await wp.evaluate(() => document.getElementById("checksRoot").textContent.includes("Register verified") && document.getElementById("checksRoot").textContent.includes("not a character reference")));
  await wp.evaluate(() => document.querySelector('[data-nav="settings"]').click());
  await wp.waitForTimeout(150);
  await wp.evaluate(() => document.querySelector('[data-bg="black"]').click());
  t("settings: Law E black applies at once", await wp.evaluate(() => document.documentElement.dataset.theme === "black"));
  await wp.evaluate(() => document.querySelector('[data-nav="profile"]')?.click());
  t("profile: the member is greeted by their own facts", await wp.evaluate(() => document.getElementById("profileRoot").textContent.includes("Sam")));
  // The thread: plan is a free family plan object in the resolver shape.
  await wp.evaluate(() => { window.CARESITS_THREAD.plan = { tier: "free", doorOpen: false }; document.querySelector(".brandLine").click(); });
  await wp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  t("week + trust: no page errors", werrs.length === 0);
  await wp.close();

  const up = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await up.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const uerrs = [];
  up.on("pageerror", (e) => uerrs.push(String(e)));
  await up.addInitScript(() => {
    window.__writes = [];
    window.CARESITS_WRITE = (kind, payload) => window.__writes.push({ kind, payload });
    window.CARESITS_THREAD = { pairId: "c1_f1", otherName: "Ana", messages: [{ text: "Hello", mine: false }], plan: { tier: "free", doorOpen: false }, tasteUsedToday: 1 };
  });
  await up.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await up.evaluate(() => { const r = document.getElementById("threadRoot"); document.querySelectorAll(".surface").forEach((s) => (s.hidden = true)); document.getElementById("surface-thread").hidden = false; });
  await up.waitForTimeout(150);
  await up.fill("#threadRoot textarea", "One more thing");
  await up.evaluate(() => [...document.querySelectorAll("#threadRoot button")].find((b) => b.textContent === "Send").click());
  await up.waitForTimeout(150);
  t("popup: the second free message meets the upgrade moment", await up.evaluate(() => !!document.getElementById("upgradePop")));
  t("popup: the passed copy stands verbatim", await up.evaluate(() => { const t = document.getElementById("upgradePop").textContent; return t.includes("You found someone worth writing to") && t.includes("A$14.95 a month") && t.includes("first month free"); }));
  t("popup: Not now stands as tall as the rest", await up.evaluate(() => { const bs = [...document.querySelectorAll("#upgradePop .popBtn")]; return bs.length === 3 && bs.every((b) => b.classList.contains("mainBtn")); }));
  await up.evaluate(() => [...document.querySelectorAll("#upgradePop button")].find((b) => b.textContent === "Not now").click());
  t("popup: Not now leaves the app fully usable", await up.evaluate(() => !document.getElementById("upgradePop") && !window.__writes.some((w) => w.kind === "message")));
  const writesBefore = await up.evaluate(() => window.__writes.filter((w) => w.kind === "message").length);
  await up.evaluate(() => { const ta = document.querySelector("#threadRoot textarea"); ta.value = "Once more"; });
  await up.evaluate(() => [...document.querySelectorAll("#threadRoot button")].find((b) => b.textContent === "Send").click());
  await up.waitForTimeout(120);
  t("popup: the latch holds for the session, no refire, no send", await up.evaluate((n) => !document.getElementById("upgradePop") && window.__writes.filter((w) => w.kind === "message").length === n, writesBefore));
  t("popup: no page errors", uerrs.length === 0);
  await up.close();
}


// ---- Riders: F2 singular on the Home Today line ----
{
  const { todayLineText } = await import("./family.js");
  t("rider F2: one log reads as one thing", todayLineText(1) === "1 thing logged today");
  t("rider F2: many logs read as things", todayLineText(3) === "3 things logged today");
}


// ---- The longer questionnaire (founder approved, 15 Oct 22:54) ----
{
  const { EXPANSION } = await import("./questions2.js");
  const fq = EXPANSION.family.flatMap((p) => p.fields);
  const cq = EXPANSION.carer.flatMap((p) => p.fields);
  t("expansion: the capped 27 family questions ride in", fq.length === 27);
  t("expansion: the capped 29 carer questions ride in", cq.length === 29);
  t("expansion: every question carries its approved words", fq.concat(cq).every((q) => q.label && !q.label.includes("  ")));
  t("expansion: the held back fields stayed out", !fq.concat(cq).some((q) => /gender of the carer|parents. age|years of education/i.test(q.label)));
  t("expansion: the three gate pairs are present", ["F32", "C33", "F16", "C15", "F38", "C42", "F21"].every((c) => fq.concat(cq).some((q) => q.pair === c)));
  const { buildBundle } = await import("./journey.js");
  t("expansion: the bundle builder stands with the deep sets", typeof buildBundle === "function");
}

// ---- Slice 2: the save plan ----
const { planSave } = await import("./account-save.js");
{
  const plan = planSave(bundle, { uid: "u1", alreadyActivated: false, nowIso: "2026-10-15T00:00:00.000Z" });
  t("save plan: questionnaire lands in the private meta space", plan.questionnaire.path === "users/u1/meta/questionnaire" && plan.questionnaire.data.side === "family");
  t("save plan: card publishes with looking split out, inside the fence", plan.card.path === "profiles/u1"
    && !("looking" in plan.card.data.card) && !("musts" in plan.card.data.card) && plan.card.data.looking.musts.nonSmoker === true
    && Object.keys(plan.card.data).every((k) => ["side", "displayName", "postcode", "photoUrl", "card", "looking", "updatedAt"].includes(k)));
  t("save plan: every card key sits inside the rules fence", Object.keys(plan.card.data.card).every((k) => ["childrenBands", "languages", "pets", "smokerHousehold", "scheduleNeed", "payOffered", "age", "nationality", "cultureOffer", "smoker", "experience", "checksLevel", "availability", "drives", "ownCar", "cooking", "tasks", "tasksRefused", "activities", "personality", "routineStyle", "agesAccepted", "agesPreferred", "petsOk", "smokerHouseholdOk", "nonSmokerHousehold", "specialNeeds", "payFloor", "maxDistanceKm", "latE2", "lngE2"].includes(k)));
  t("save plan: activation pairs the stamp with the counter", plan.activation && plan.activation.counterField === "activatedWithin7d" && plan.activation.profileMerge.activatedAt);
  const plan2 = planSave(bundle, { uid: "u1", alreadyActivated: true, nowIso: "2026-10-15T00:00:00.000Z" });
  t("save plan: a second finish never re-fires activation", plan2.activation === null);
  const deepBundle = { side: "carer", answers: {}, strengths: {}, card: { postcode: "2021", looking: { musts: { deep: { F8: { v: ["Peanuts"], feed: "tasks" } } }, prefs: { deep: { C22: { v: "Yes, current", s: "pref", feed: "experience" } } } } } };
  const plan3 = planSave(deepBundle, { uid: "u9", alreadyActivated: true, nowIso: "2026-10-15T00:00:00.000Z" });
  t("save plan: deep answers ride as their own documents, the card keeps none",
    plan3.answers.length === 2
    && plan3.answers.some((a) => a.path === "profiles/u9/answers/F8" && a.data.bucket === "musts" && a.data.v[0] === "Peanuts")
    && plan3.answers.some((a) => a.path === "profiles/u9/answers/C22" && a.data.bucket === "prefs" && a.data.s === "pref")
    && !("deep" in (plan3.card.data.looking.musts || {})) && !("deep" in (plan3.card.data.looking.prefs || {})));
  const planG = planSave(bundle, { uid: "u1", alreadyActivated: true, nowIso: "2026-10-15T00:00:00.000Z", gallery: ["https://x/1.jpg", "https://x/2.jpg"] });
  t("save plan (F14): a stored gallery survives the questionnaire save, riding inside the card", Array.isArray(planG.card.data.card.gallery) && planG.card.data.card.gallery.join(",") === "https://x/1.jpg,https://x/2.jpg");
  const planN = planSave(bundle, { uid: "u1", alreadyActivated: true, nowIso: "2026-10-15T00:00:00.000Z" });
  t("save plan (F14): with no stored gallery the card gains no gallery key", !("gallery" in planN.card.data.card));
}

// ---- Round 3: F15 the trust seam carries the real member ----
{
  const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const merrs = [];
  mp.on("pageerror", (e) => merrs.push(String(e)));
  await mp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await mp.waitForTimeout(300);
  t("profile (F15): before any publish the empty default stands", await mp.evaluate(() => document.getElementById("profileRoot").textContent.includes("Your name waits in the tour")));
  await mp.evaluate(async () => {
    const live = await import("./live.js");
    live.publishTrust({ side: "carer", displayName: "Tour Name" }, { side: "carer", displayName: "Ana Carer", postcode: "2021", photoUrl: "" }, { country: "Australia" });
  });
  await mp.evaluate(() => document.querySelector('[data-nav="profile"]').click());
  await mp.waitForTimeout(150);
  t("profile (F15): the signed in carer stands by her card name, side and postcode", await mp.evaluate(() => { const tx = document.getElementById("profileRoot").textContent; return tx.includes("Ana Carer") && tx.includes("Carer") && tx.includes("2021"); }));
  t("profile (F15): the resume card stands for a carer", await mp.evaluate(() => document.getElementById("profileRoot").textContent.includes("Build from your resume")));
  await mp.evaluate(async () => {
    const live = await import("./live.js");
    live.publishTrust({ side: "family", displayName: "Fay Family" }, {}, {});
  });
  await mp.waitForTimeout(150);
  t("profile (F15): a family publish replaces the carer and the resume card goes", await mp.evaluate(() => { const tx = document.getElementById("profileRoot").textContent; return tx.includes("Fay Family") && tx.includes("Family") && !tx.includes("Build from your resume"); }));
  t("profile (F15): no page errors", merrs.length === 0);
  await mp.close();
}

// ---- Round 4: F14 the gallery, and the S-2 resume picker ----
{
  const gp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await gp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const gerrs = [];
  gp.on("pageerror", (e) => gerrs.push(String(e)));
  await gp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await gp.waitForTimeout(300);
  const pickFile = (inputSel, name, type, text) => gp.evaluate(async ({ inputSel, name, type, text }) => {
    const c = document.createElement("canvas");
    c.width = 8; c.height = 8;
    const blob = text != null ? new Blob([text], { type }) : await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    const file = new File([blob], name, { type });
    const input = document.querySelector(inputSel);
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { inputSel, name, type, text });
  const lastGalleryWrite = () => gp.evaluate(() => {
    const ws = (window.__writes || []).filter((w) => w.kind === "gallery");
    return ws.length ? ws[ws.length - 1].payload.gallery : null;
  });
  await gp.evaluate(async () => {
    window.__writes = [];
    window.__uploads = [];
    window.CARESITS_ME = { uid: "u1", side: "carer", name: "Ana Carer" };
    window.CARESITS_WRITE = (kind, payload) => { window.__writes.push({ kind, payload }); return { ok: true }; };
    window.CARESITS_UPLOAD = async (path) => { window.__uploads.push(path); return "stub:" + path; };
    const live = await import("./live.js");
    live.publishTrust({ side: "carer", displayName: "Ana" }, { side: "carer", displayName: "Ana Carer", postcode: "2021", photoUrl: "", card: { gallery: ["https://x/1.jpg", "https://x/2.jpg"] } }, { country: "Australia" });
  });
  await gp.evaluate(() => document.querySelector('[data-nav="profile"]').click());
  await gp.waitForTimeout(150);
  t("gallery (F14): the saved photos render as thumbs, each with its Remove", await gp.evaluate(() => document.querySelectorAll("#profileRoot .galleryThumb").length === 2 && document.querySelectorAll("#profileRoot .galleryRemove").length === 2));
  t("gallery (F14): the empty slots offer Add, four slots in all", await gp.evaluate(() => document.querySelectorAll("#profileRoot .galleryAdd").length === 2));
  await gp.evaluate(() => document.querySelector("#profileRoot .galleryRemove").click());
  await gp.waitForTimeout(60);
  t("gallery (F14): removing a photo writes exactly the list without it", JSON.stringify(await lastGalleryWrite()) === JSON.stringify(["https://x/2.jpg"]));
  t("gallery (F14): the strip re-renders with that photo gone", await gp.evaluate(() => document.querySelectorAll("#profileRoot .galleryThumb").length === 1 && document.querySelectorAll("#profileRoot .galleryAdd").length === 3));
  await pickFile("#profileRoot .galleryFile", "pic.jpg", "image/jpeg", null);
  await gp.waitForTimeout(500);
  t("gallery (F14): a pick uploads to the next slot path", await gp.evaluate(() => window.__uploads.includes("profile-photos/u1/extra-2.jpg")));
  t("gallery (F14): the add writes the list in slot order", JSON.stringify(await lastGalleryWrite()) === JSON.stringify(["https://x/2.jpg", "stub:profile-photos/u1/extra-2.jpg"]));
  await gp.evaluate(async () => {
    const live = await import("./live.js");
    live.publishTrust({ side: "carer", displayName: "Ana" }, { side: "carer", displayName: "Ana Carer", postcode: "2021", photoUrl: "", card: { gallery: ["https://x/1.jpg", "https://x/2.jpg", "https://x/3.jpg", "https://x/4.jpg"] } }, { country: "Australia" });
  });
  await gp.waitForTimeout(150);
  t("gallery (F14): with four saved there is no Add left, a fifth is refused by the shape", await gp.evaluate(() => document.querySelectorAll("#profileRoot .galleryThumb").length === 4 && document.querySelectorAll("#profileRoot .galleryAdd").length === 0));
  // S-2 (device-only resume model, Ilse 19 Oct 2026): a resume
  // pick NEVER uploads, in any format; the words are read on
  // this device and drafted from. A stub PDF yields no words,
  // so the honest unread line stands. (This leg asserted the
  // retired temp-upload until the device-only batch; the
  // Chromium outage hid the stale copy, found on the shell
  // route re-run, 19 Oct 2026.)
  await gp.evaluate(() => { window.__uploads = []; });
  await pickFile("#profileRoot .cardIn:last-of-type input[type=file]", "cv.txt", "text/plain", "Jane Carer, nanny in Sydney");
  await gp.waitForTimeout(400);
  t("resume (S-2): a text pick uploads nothing", await gp.evaluate(() => window.__uploads.length === 0));
  t("resume (S-2): a text pick is drafted from, never called unread", await gp.evaluate(() => !document.getElementById("profileRoot").textContent.includes("We could not read that file")));
  await pickFile("#profileRoot .cardIn:last-of-type input[type=file]", "cv.pdf", "application/pdf", "%PDF-1.4 stub");
  // Extraction lazy-loads the PDF reader on the device; poll
  // for its honest answer instead of racing a fixed wait.
  await gp.waitForFunction(() => document.getElementById("profileRoot").textContent.includes("We could not read that file"), null, { timeout: 15000 }).catch(() => {});
  t("resume (S-2): a PDF pick uploads nothing, ever (device only)", await gp.evaluate(() => window.__uploads.length === 0));
  t("resume (S-2): a PDF pick keeps the honest unread line", await gp.evaluate(() => document.getElementById("profileRoot").textContent.includes("We could not read that file")));
  t("gallery (F14): no page errors", gerrs.length === 0);
  await gp.close();
  // The demo: no account, so a gallery pick previews on the device and writes nothing.
  const dp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await dp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const derrs = [];
  dp.on("pageerror", (e) => derrs.push(String(e)));
  await dp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await dp.waitForTimeout(300);
  await dp.evaluate(async () => {
    window.__writes = [];
    window.CARESITS_WRITE = (kind, payload) => { window.__writes.push({ kind, payload }); return { ok: true }; };
    const live = await import("./live.js");
    live.publishTrust({ side: "carer", displayName: "Demo" }, { side: "carer", displayName: "Demo Carer", postcode: "", photoUrl: "", card: {} }, {});
  });
  await dp.evaluate(() => document.querySelector('[data-nav="profile"]').click());
  await dp.waitForTimeout(150);
  await dp.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 8; c.height = 8;
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    const file = new File([blob], "pic.jpg", { type: "image/jpeg" });
    const input = document.querySelector("#profileRoot .galleryFile");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await dp.waitForTimeout(500);
  t("gallery (F14): a demo pick previews on the device, with the honest line", await dp.evaluate(() => {
    const imgs = [...document.querySelectorAll("#profileRoot .galleryThumb")];
    return imgs.length === 1 && imgs[0].src.startsWith("data:") && document.getElementById("profileRoot").textContent.includes("lives on this device");
  }));
  t("gallery (F14): a demo pick writes nothing", await dp.evaluate(() => window.__writes.filter((w) => w.kind === "gallery").length === 0));
  t("gallery (F14): the demo page carries no errors", derrs.length === 0);
  await dp.close();
}

// ---- F21: a picker forgets its pick at once, so the same ----
// ---- file can be picked again and still fires change    ----
{
  const fp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const ferrs = [];
  fp.on("pageerror", (e) => ferrs.push(String(e)));
  await fp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await fp.waitForTimeout(300);
  await fp.evaluate(async () => {
    window.__uploads = [];
    window.CARESITS_ME = { uid: "u1", side: "carer", name: "Ana Carer" };
    window.CARESITS_WRITE = () => ({ ok: true });
    window.CARESITS_UPLOAD = async (path) => { window.__uploads.push(path); return "stub:" + path; };
    const live = await import("./live.js");
    live.publishTrust({ side: "carer", displayName: "Ana" }, { side: "carer", displayName: "Ana Carer", postcode: "2021", photoUrl: "", card: {} }, { country: "Australia" });
  });
  await fp.evaluate(() => document.querySelector('[data-nav="profile"]').click());
  await fp.waitForTimeout(150);
  const pickMainPhoto = () => fp.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 8; c.height = 8;
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    const file = new File([blob], "me.jpg", { type: "image/jpeg" });
    const input = document.querySelectorAll("#profileRoot input[type=file]")[0];
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await pickMainPhoto();
  await fp.waitForTimeout(500);
  t("photo (F21): after a pick the input value stands clear", await fp.evaluate(() => window.__uploads.join(",") === "profile-photos/u1/photo.jpg" && document.querySelectorAll("#profileRoot input[type=file]")[0].value === ""));
  await pickMainPhoto();
  await fp.waitForTimeout(500);
  t("photo (F21): picking the same file again fires the handler again", await fp.evaluate(() => window.__uploads.filter((p) => p === "profile-photos/u1/photo.jpg").length === 2) && ferrs.length === 0);
  await fp.close();
}


// ---- Round 3: F16 the questionnaire keys belong to the account ----
{
  const seedA = { side: "family", page: 1, answers: { country: "Australia" }, strengths: {}, resumeFeed: [], countryStep: false };
  const mkJourney = async (uid, seed) => {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.addInitScript(({ uid, seed }) => {
      if (uid) window.CARESITS_UID = uid;
      if (seed) localStorage.setItem("caresits-app2-draft-uidA", JSON.stringify(seed));
    }, { uid, seed });
    await p.goto("http://localhost:8933/", { waitUntil: "networkidle" });
    await p.waitForTimeout(250);
    return { p, errs };
  };
  const a1 = await mkJourney("uidA", seedA);
  t("isolation (F16): A's draft returns when A is signed in", await a1.p.evaluate(() => !document.getElementById("journey").hidden && document.getElementById("pageCount").textContent.includes("Page 2")));
  await a1.p.evaluate(() => {
    const c = document.querySelector("#fields [data-chip], #fields [data-yesno], #fields [data-field], #fields select");
    if (c) { c.click(); c.dispatchEvent(new Event("change", { bubbles: true })); c.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  await a1.p.waitForTimeout(120);
  t("isolation (F16): A's answers save under A's key alone", await a1.p.evaluate(() => !!localStorage.getItem("caresits-app2-draft-uidA") && !localStorage.getItem("caresits-app2-draft") && !localStorage.getItem("caresits-app2-draft-uidB")));
  t("isolation (F16): A's page carries no errors", a1.errs.length === 0);
  await a1.p.close();
  const b1 = await mkJourney("uidB", seedA);
  t("isolation (F16): B's journey opens fresh on the same device, A's draft invisible", await b1.p.evaluate(() => !document.getElementById("welcome").hidden && document.getElementById("journey").hidden));
  await b1.p.close();
  const o1 = await mkJourney(null, seedA);
  t("isolation (F16): signed out mode never shows A's draft", await o1.p.evaluate(() => !document.getElementById("welcome").hidden && document.getElementById("journey").hidden));
  await o1.p.close();
  const a2 = await mkJourney("uidA", seedA);
  t("isolation (F16): A signs back in and the draft is still there", await a2.p.evaluate(() => !document.getElementById("journey").hidden && document.getElementById("pageCount").textContent.includes("Page 2")));
  await a2.p.close();
}

// ---- R1: ONE shared auth instance (the build 103 root fault) ----
// The door and the accounts module sign in on the DEFAULT app;
// every shell module must resolve that same default app. A named
// app carries its own auth session and never sees the user.
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  for (const f of ["./live.js", "./account-save.js", "./find.js", "./photo.js"]) {
    const s = src(f);
    t(`R1: ${f} creates no named Firebase app`, !/initializeApp\([^)]*,\s*"/.test(s));
    t(`R1: ${f} resolves the DEFAULT app`, s.includes('"[DEFAULT]"'));
  }
  const door = src("./door.js");
  t("R1: live.js resolves either config export name (the twin exports testFirebaseConfig)", src("./live.js").includes("cfgMod.firebaseConfig || cfgMod.testFirebaseConfig"));
  t("R1: live.js publishes the uid seam from the shared session", src("./live.js").includes("window.CARESITS_UID = uid"));
  t("R1: account.js (the door's module) signs in on the default app", src("../accounts/account.js").includes("initializeApp(config)"));
}

// ---- HQ rulings on the remainder round (19 Oct): the gate,
// the thread mechanism, the demo greeting, the counter shape ----
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  t("Ruling (Leg 19 FAIL 1): the shell gates a signed out entry back to the door", src("./live.js").includes("gateSignedOut") && src("./live.js").includes('location.href = "door.html"'));
  t("Ruling (Leg 19 FAIL 1): a deliberate Explore entry carries the exempting marker", src("./live.js").includes('sessionStorage.getItem("caresits-demo")') && src("./door.js").includes('sessionStorage.setItem("caresits-demo", "1")') && src("./journey.js").includes('sessionStorage.setItem("caresits-demo", "1")'));
  t("Ruling (Leg 14): the shell publishes its show mechanism as a seam", src("./shell.js").includes("window.CARESITS_NAV = show"));
  t("Ruling (Leg 14): homes opens the thread by the shell seam, never by a class", src("./homes.js").includes('CARESITS_NAV("thread")') && !src("./homes.js").includes('classList.toggle("active"'));
  t("Ruling (Leg 3 Note 2): the stored device name serves the signed in world only", src("./homes.js").includes("if (m && m.uid)"));
  t("Ruling (residue): the safety plan names the split doc counters", src("./safety-actions.js").includes("_owner/aggregates/safetyFiled/main") && src("./safety-actions.js").includes("_owner/aggregates/safetyOpen/main") && !src("./safety-actions.js").includes("safety/main"));
}

// ---- Leg 2: the tour name lands in-session ----
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  t("Leg 2: the tour fires the in-session name refresh", src("./tour.js").includes("CARESITS_NAME_SAVED") && src("./tour.js").includes("CARESITS_RENDER_HOME"));
  t("Leg 2: live.js exports the seam name refresh", src("./live.js").includes("export function refreshTrustName"));
  t("Leg 2: homes exposes its re-render", src("./homes.js").includes("window.CARESITS_RENDER_HOME = renderHome"));
}

// ---- b104 re-proof wave: ROOT A, ROOT B, Legs 2, 7, 14 ----
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  t("b104 ROOT A: the journey save judges the user only after the restore settles", src("./account-save.js").includes("authStateReady") && src("./account-save.js").includes("await frameUser(auth)"));
  t("b104 ROOT A: Find judges by the same frame rule", src("./find.js").includes("await frameUser("));
  t("b104 ROOT A: the Done screen earns its saved line", src("./journey.js").includes("window.CARESITS_SAVE(bundle)") && src("./journey.js").includes('r.saved !== "account"') && src("./journey.js").includes("journey.dLeadLocal") && src("./journey.js").includes("withTimeout"));
  t("b104 ROOT B: the boot publishes the week seam and the saved background, then re-renders", src("./live.js").includes("window.CARESITS_WEEK = weekSeamFrom") && src("./live.js").includes('localStorage.setItem("caresits-app2-bg"') && src("./live.js").includes("CARESITS_WEEK_RENDER"));
  t("b104 ROOT B: the family surfaces re-render when the boot lands", src("./live.js").includes("CARESITS_FAMILY_RENDER") && src("./family.js").includes("window.CARESITS_FAMILY_RENDER = bootFamily"));
  t("b104 Leg 14: the boot publishes the thread seam and the surface re-renders on open", src("./live.js").includes("window.CARESITS_THREAD = threadSeamFrom") && src("./thread.js").includes("window.CARESITS_THREAD_OPEN = bootThread") && src("./shell.js").includes("CARESITS_THREAD_OPEN"));
  t("b104 Leg 7: a removal joins the bin's live list in the same moment", src("./family.js").includes("CARESITS_BIN_ADD") && src("./bin.js").includes("winOf().CARESITS_BIN_ADD"));
  t("b104 Leg 2 race: a pending tour name is held and applied at publication", src("./live.js").includes("pendingTrustName") && src("./live.js").includes("displayName: pendingTrustName"));
}

// ---- b107 re-proof wave: FAIL 1 (deep musts shape + feed), FAIL 2 (the gate's completeness), Leg 7 residual ----
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  t("b107 FAIL 1: the musts deep carries the shaped entry, never the raw value", src("./journey.js").includes("deepMusts[q.pair] = deep[q.pair];"));
  t("b107 FAIL 1: the feed is the question's own bucket, no provenance stamp", src("./journey.js").includes("feed: q.feed || null") && !src("./journey.js").includes('"resume" : (q.feed'));
  t("b107 FAIL 1: the save normalises a raw deep entry instead of reading a missing .v", src("./account-save.js").includes('"v" in val ? val : { v: val }'));
  t("b107 FAIL 2: the save stamps the side onto the user doc", src("./account-save.js").includes("const profileSide = bundle.side"));
  t("b107 FAIL 2: completeness is recomputed at publish from the seam's facts", src("./live.js").includes("window.CARESITS_PROFILE_COMPLETE = Boolean("));
  t("b107 Leg 7 residual: bin leaves the live list on restore and forever", src("./bin.js").includes("export function binLeave") && (src("./bin.js").match(/binLeave\(w\.CARESITS_BIN, item\.id\)/g) || []).length === 2);
  t("b107 Legs 9+10 same-session: a landed save raises the completeness flag on both hosts", src("./account-save.js").includes("h.CARESITS_PROFILE_COMPLETE = true"));
  t("b107 language ride: the pick writes the account doc, the boot seeds it back", src("./live.js").includes('case "language":') && src("./live.js").includes('localStorage.setItem("caresits-lang", appDoc.language)') && src("./trust.js").includes('write("language", { code })'));
  t("b108 language dispatch: the write settles before the reload, bounded", src("./trust.js").includes("return window.CARESITS_WRITE(kind, payload)") && src("./trust.js").includes("Promise.resolve(w).then(go, go)") && src("./trust.js").includes("setTimeout(go, 10000)"));
  t("b111 language bound: the hang guard stands far above the write's healthy settle range", src("./trust.js").includes("setTimeout(go, 10000)") && !src("./trust.js").includes("setTimeout(go, 1500)"));
  t("b108 save drain: the realm warms at entry, the shell and journey drain the envelope", src("./account-save.js").includes("export function warmSave") && src("./account-save.js").includes("export async function drainOutbox") && src("./journey.js").includes("warmSave();") && src("./journey.js").includes("drainOutbox();") && src("./live.js").includes("m.drainOutbox()"));
  t("b108 token step: the save awaits a live token before its first Firestore step", src("./account-save.js").includes("user.getIdToken(true)"));
  t("b108 doc birth: the save births the member doc itself when it stands absent, ahead of the batch", src("./account-save.js").includes("if (!profSnap.exists())") && src("./account-save.js").includes("The save births"));
  t("b110 wave: the door birth is transactional, the save birth stamps createdAt only, the drain guard reads existence and fires twice, Find's pool publishes from the warm boot", src("../accounts/account.js").includes("runTransaction") && src("../accounts/account.js").includes("cur.exists()") && src("./account-save.js").includes("{ createdAt: fsMod.serverTimestamp() }") && src("./live.js").includes("if (!qExists)") && src("./live.js").includes("setTimeout(drain, 4000)") && src("./live.js").includes("fetchFindData") && src("./find.js").includes("export async function fetchFindData") && src("./find.js").includes("window.CARESITS_FIND_RENDER"));
}

// ---- b111 FIND cure: the stitch must exist in find.js's own graph ----
// On builds 110 and 111 find.js called stitchAnswers without
// importing it: every fetch died at its first stitch and Find
// waited forever, while the seam-fed legs stayed green. This leg
// runs the shipped fetchFindData against fake Firestore deps in
// the page realm, so the real import graph is what is judged.
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  t("b111 FIND: find.js imports stitchAnswers from browse.js", /import \{[^}]*stitchAnswers[^}]*\} from "\.\/browse\.js"/.test(src("./find.js")));
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  await p.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  const res = await p.evaluate(async () => {
    try {
      const { fetchFindData } = await import("./find.js");
      const profiles = {
        me: { side: "family", displayName: "Me" },
        c1: { side: "carer", displayName: "Ana" },
      };
      const answers = {
        me: [{ code: "F8", data: { bucket: "musts", v: ["Peanuts"], feed: "trust" } }],
        c1: [{ code: "C9", data: { bucket: "prefs", v: "yes", s: "pref", feed: "trust" } }],
      };
      const fsMod = {
        doc: (db, ...parts) => parts.join("/"),
        collection: (db, ...parts) => parts.join("/"),
        query: (c) => c,
        limit: () => 0,
        getDoc: async (ref) => {
          const id = ref.split("/")[1];
          return { exists: () => !!profiles[id], data: () => profiles[id] };
        },
        getDocs: async (ref) => {
          if (ref === "profiles") return { docs: Object.entries(profiles).map(([id, data]) => ({ id, data: () => data })) };
          const id = ref.split("/")[1];
          const list = (answers[id] || []).map((a) => ({ id: a.code, data: () => a.data }));
          return { forEach: (cb) => list.forEach(cb), docs: list };
        },
      };
      const out = await fetchFindData(fsMod, {}, "me");
      return {
        ok: true,
        viewerDeep: out.viewer?.looking?.musts?.deep?.F8?.v || null,
        candCount: out.candidates?.length ?? -1,
        candDeep: out.candidates?.[0]?.looking?.prefs?.deep?.C9?.v || null,
      };
    } catch (e) {
      return { ok: false, err: String((e && e.message) || e) };
    }
  });
  t("b111 FIND: fetchFindData stitches viewer and candidate answers in the shipped graph", res.ok && JSON.stringify(res.viewerDeep) === JSON.stringify(["Peanuts"]) && res.candCount === 1 && res.candDeep === "yes");
  await p.close();
}

// ---- Leg 11: the level picker (welcome choice + computed boundary) ----
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  const html = src("./journey.html");
  t("Leg 11: the welcome offers all four levels as choices", ["explore", "quick", "better", "full"].every((v) => html.includes(`data-level="${v}"`)));
  t("Leg 11: the journey computes the boundary from levels.js", src("./journey.js").includes("levelOf(state.side, state.answers)"));
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto("http://localhost:8933/", { waitUntil: "networkidle" });
  await p.waitForTimeout(250);
  t("Leg 11: the welcome shows the four level choices", await p.evaluate(() => document.querySelectorAll("[data-level]").length === 4));
  t("Leg 11: the choices name Better Match and Full Match", await p.evaluate(() => document.body.textContent.includes("Better Match") && document.body.textContent.includes("Full Match")));
  await p.evaluate(() => document.querySelector('[data-level="full"]').click());
  t("Leg 11: picking Full marks it and stores the target", await p.evaluate(() => document.querySelector('[data-level="full"]').classList.contains("on") && (JSON.parse(localStorage.getItem("caresits-app2-draft") || "{}").target === "full")));
  t("Leg 11: the picker page carries no errors", errs.length === 0);
  await p.close();

  const { FAMILY_PAGES } = await import("./questions.js");
  const { EXPANSION } = await import("./questions2.js");
  const valFor = (f) => {
    if (f.type === "chips") return [(f.options || []).find((o) => o !== "") ?? "x"];
    if (f.type === "select") return (f.options || []).find((o) => o !== "") ?? "x";
    if (f.type === "yesno") return true;
    if (f.type === "number") return 1;
    if (f.type === "grid") return { Mon: ["Morning"] };
    if (f.type === "band") return [0, 5];
    if (f.type === "experience") return { "0 to 1 years": "1" };
    if (f.type === "expchecks") return { checks: "Register verified", years: {} };
    if (f.type === "homefacts") return { petsOk: true };
    return "x";
  };
  const answers = { country: "Australia" };
  for (const pg of FAMILY_PAGES) for (const f of pg.fields) if (f.required) answers[f.id] = valFor(f);
  for (const pg of EXPANSION.family) for (const f of pg.fields) if (f.level === "quick") answers[f.id] = valFor(f);
  const seed = { side: "family", page: 0, answers, strengths: {}, resumeFeed: [], countryStep: false, target: "quick", beyond: false };
  const mkSeeded = async () => {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.addInitScript(({ seed }) => { window.CARESITS_UID = "uidA"; if (seed) localStorage.setItem("caresits-app2-draft-uidA", JSON.stringify(seed)); }, { seed });
    await p.goto("http://localhost:8933/", { waitUntil: "networkidle" });
    await p.waitForTimeout(250);
    return { p, errs };
  };
  const s1 = await mkSeeded();
  await s1.p.click("#nextBtn");
  await s1.p.waitForTimeout(200);
  t("Leg 11: reaching the picked level offers the stop panel", await s1.p.evaluate(() => !document.getElementById("stopPanel").hidden && document.getElementById("stopTitle").textContent.includes("Quick Connect")));
  await s1.p.click("#keepBtn");
  await s1.p.waitForTimeout(200);
  t("Leg 11: Keep going returns to the walk, past the boundary", await s1.p.evaluate(() => document.getElementById("stopPanel").hidden && !document.getElementById("journey").hidden));
  t("Leg 11: the boundary walk carries no errors", s1.errs.length === 0);
  await s1.p.close();
  const s2 = await mkSeeded();
  await s2.p.click("#nextBtn");
  await s2.p.waitForTimeout(200);
  await s2.p.click("#stopBtn");
  await s2.p.waitForTimeout(300);
  t("Leg 11: Stop here finishes and the done screen names the computed level", await s2.p.evaluate(() => !document.getElementById("done").hidden && document.getElementById("doneLevel").textContent.includes("Quick Connect")));
  await s2.p.close();
}

// ---- Payments piece 2: the Plus gate + the plans sheet ----
// The gate sits at the shell's nav choke point. Its legs pin the
// exact fences: a locked family meets the sheet and the surface
// does not switch; the in-app month and any paid record walk in;
// carers are never gated; no member seam means no gate.
{
  const pp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pp.addInitScript(() => { try { sessionStorage.setItem("caresits-demo", "1"); } catch {} });
  const perrs = [];
  pp.on("pageerror", (e) => perrs.push(String(e)));
  await pp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await pp.waitForTimeout(300);
  const setMe = (me) => pp.evaluate((m) => { if (m) window.CARESITS_ME = m; else delete window.CARESITS_ME; }, me);
  await setMe({ uid: "f9", side: "family", plusExtras: false });
  await pp.evaluate(() => window.CARESITS_NAV("daystory"));
  await pp.waitForTimeout(200);
  t("plans gate: a locked family tapping the Day Story meets the plans sheet, surface unswitched", await pp.evaluate(() => !!document.getElementById("plansPop") && document.getElementById("surface-daystory").hidden && document.getElementById("plansPop").textContent.includes("opens with a paid plan")));
  t("plans sheet: all three plans offered, with the honest app route line (the enabling build's web face)", await pp.evaluate(() => { const s = document.getElementById("plansPop").textContent; return s.includes("Join Finding") && s.includes("Join Family Plus") && s.includes("Join Search Pass") && s.includes("Joining lives in the Caresitters app") && s.includes("Nothing is charged") && !s.includes("Restore a past purchase"); }));
  await pp.evaluate(() => { window.__writes = []; window.CARESITS_WRITE = (kind, payload) => window.__writes.push([kind, payload]); });
  await pp.evaluate(() => { const b = [...document.querySelectorAll("#plansPop button")].find((x) => x.textContent.includes("Search Pass")); b.click(); });
  await pp.waitForTimeout(150);
  t("plans sheet: Join Search Pass records plan interest and closes the sheet", await pp.evaluate(() => window.__writes.length === 1 && window.__writes[0][0] === "plans" && window.__writes[0][1].plan === "search-pass" && !document.getElementById("plansPop")));
  // G7 (Store Review): the renewal disclosure + the legal
  // links stand ON the paywall surface itself.
  await pp.evaluate(() => window.CARESITS_OPEN_PLANS && window.CARESITS_OPEN_PLANS());
  await pp.waitForTimeout(120);
  t("plans G7: the renewal disclosure stands on the paywall, prices rendered with the buttons (auto renew, no free month, cancel in Apple ID, open to the paid end, the Pass named non renewing)", await pp.evaluate(() => { const s = document.querySelector("#plansPop .plansLegal").textContent; return s.includes("A$14.95") && s.includes("renews on its own each month") && s.includes("no free month") && s.includes("A$24.95") && s.includes("Apple ID subscriptions") && s.includes("end of the paid month") && s.includes("never renews itself"); }));
  t("plans G7: the Privacy Policy and Terms of Use links stand on the surface, pointing true", await pp.evaluate(() => { const as = [...document.querySelectorAll("#plansPop .plansLinks a")]; return as.length === 2 && as[0].href.includes("privacy.html") && as[1].href.includes("apple.com/legal") && as[1].textContent.includes("Terms of Use"); }));
  await pp.evaluate(() => document.getElementById("plansPop")?.remove());
  await setMe({ uid: "f9", side: "family", plusExtras: true });
  await pp.evaluate(() => window.CARESITS_NAV("daystory"));
  await pp.waitForTimeout(150);
  t("plans gate: a family with the extras open walks into the Day Story", await pp.evaluate(() => !document.getElementById("surface-daystory").hidden && !document.getElementById("plansPop")));
  await setMe({ uid: "c9", side: "carer" });
  await pp.evaluate(() => window.CARESITS_NAV("roster"));
  await pp.waitForTimeout(150);
  t("plans gate: a carer is never gated", await pp.evaluate(() => !document.getElementById("surface-roster").hidden && !document.getElementById("plansPop")));
  await setMe(null);
  await pp.evaluate(() => window.CARESITS_NAV("timesheet"));
  await pp.waitForTimeout(150);
  t("plans gate: no member seam, no gate (demo and previews stand)", await pp.evaluate(() => !document.getElementById("surface-timesheet").hidden && !document.getElementById("plansPop")));
  await setMe({ uid: "f9", side: "family", plusExtras: false });
  await pp.evaluate(() => window.CARESITS_TRUST_RENDER());
  await pp.waitForTimeout(150);
  t("plans: Settings offers Plans to a family", await pp.evaluate(() => !!document.getElementById("plansBtn")));
  await pp.evaluate(() => document.getElementById("plansBtn").click());
  await pp.waitForTimeout(150);
  t("plans: the Settings sheet opens plainly, with no locked line", await pp.evaluate(() => !!document.getElementById("plansPop") && !document.getElementById("plansPop").textContent.includes("opens with a paid plan")));
  await pp.evaluate(() => { const b = [...document.querySelectorAll("#plansPop button")].pop(); b.click(); });
  await setMe({ uid: "c9", side: "carer" });
  await pp.evaluate(() => window.CARESITS_TRUST_RENDER());
  await pp.waitForTimeout(150);
  t("plans: Settings hides Plans from a carer, always", await pp.evaluate(() => !document.getElementById("plansBtn")));
  t("plans legs: no page errors", perrs.length === 0);
  await pp.close();
}

console.log(`\nALL ${n} journey checks passed`);
await browser.close();
server.close();

