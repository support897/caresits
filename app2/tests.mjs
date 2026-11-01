import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";

const MIME = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html", ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf" };
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  // Repo faithful layout: /app2/ is a repo root prefix too
  // (accounts/account.js imports ../app2/storage-keys.js; the
  // old mapping looked for app2/app2/ and killed that module).
  const path = url === "/" ? "../app2/journey.html" : url.startsWith("/fonts/") || url.startsWith("/next-phase/") || url.startsWith("/accounts/") || url.startsWith("/app2/") ? ".." + url : "../app2" + url;
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
  executablePath: process.env.CHROME_PATH || "/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
// The journey page stands alone in this harness; in the app it
// runs inside the shell frame, whose live bridge publishes the
// auth state and uid the frame's key resolver reads. Fleet
// rule (29 Oct 2026): there is no explorer demo any more, so
// the harness publishes the signed in shape the frame carries
// in production, under a walk uid.
await page.addInitScript(() => { window.CARESITS_UID = "walk1"; window.CARESITS_AUTH_STATE = "signed-in"; });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto("http://localhost:8933/", { waitUntil: "networkidle" });

let n = 0;
const t = (name, cond) => { assert.ok(cond, name); n += 1; console.log("ok -", name); };

// The standalone journey entry is CLOSED (Difference Map
// item 2): opened on its own, the journey shows the welcome
// with the road back into the app, and NO side buttons,
// because a side pick here could only default the track.
// In the app the shell publishes the member (with the track
// the member picked after sign up) and the build opens at
// once; the walks below publish exactly that seam.
t("standalone journey: the welcome stands with no side buttons to pick", await page.evaluate(() => !document.querySelector("[data-side]") && !document.getElementById("welcome").hidden));
t("standalone journey: the road back into the app stands instead", await page.evaluate(() => { const b = document.getElementById("standaloneBtns"); return !!b && !b.hidden && !!b.querySelector('a[href="index.html"]'); }));
t("welcome shows the time promise", (await page.textContent("body")).includes("About 10 minutes for everything"));
t("welcome bunny is her hello seat", (await page.getAttribute(".bunnyBig", "src")).includes("bunny-hello"));

// The family walk bundle stays at module scope:
// the save plan slice further down builds on it.
let bundle = null;

const walkPage = async (member) => {
  const p = await browser.newPage();
  await p.addInitScript((m) => { window.CARESITS_UID = m.uid; window.CARESITS_AUTH_STATE = "signed-in"; window.CARESITS_ACCOUNT_READY = true; window.CARESITS_ME = m; window.__uploads = []; window.CARESITS_UPLOAD = async (path) => { window.__uploads.push(path); return "stub:" + path; }; }, member);
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto("http://localhost:8933/", { waitUntil: "networkidle" });
  await p.waitForSelector("#journey:not([hidden])", { timeout: 10000 });
  return p;
};
// A real photo pick for the last step of the two copied
// builds: a one pixel PNG, uploaded through the same seam
// the profile suites use.
const PHOTO_FILE = { name: "me.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") };
const pickPhoto = async (p, uid) => {
  await p.setInputFiles("[data-photo-file]", PHOTO_FILE);
  await p.waitForFunction((u) => { try { const d = JSON.parse(localStorage.getItem("caresits-app2-draft-" + u) || "null"); return d && d.answers && d.answers.photoDone === true; } catch { return false; } }, uid, { timeout: 15000 });
};

// ---- the family build, nanny track, in the observed
// wizard order (Babysits account walk, 1 Nov 2026): country,
// name, postcode, children count, children ages, children in
// 3 words, languages, special needs, type of care (Babysitter
// pre ticked, multi pick), the checks word, comfortable with,
// the week grid, frequency and urgency, pay, care place,
// about the family, the family's must words, and the photo
// LAST, required, with no skip.
{
  const fp2 = await walkPage({ uid: "walk1", entryRole: "family", side: "family", track: "family-nanny", name: "Walk" });
  t("family question 1 of 19 (the country step stands first)", (await fp2.textContent("#pageCount")).includes("Question 1 of 19"));
  await fp2.click("#nextBtn");
  t("required questions hold the page", (await fp2.textContent("#notice")).length > 3);
  await fp2.click('[data-chip="country"][data-value="Australia"]');
  await fp2.click("#nextBtn");
  await fp2.fill('[data-field="displayName"]', "The Walk Family");
  await fp2.click("#nextBtn");
  await fp2.fill('[data-field="postcode"]', "2021");
  await fp2.click("#nextBtn");
  await fp2.click('[data-chip="childrenCount"][data-value="2 children"]');
  await fp2.click("#nextBtn");
  await fp2.click('[data-chip="childrenBands"][data-value="1-3"]');
  await fp2.click("#nextBtn");
  await fp2.click('[data-chip="childrenTraits"][data-value="Curious"]');
  await fp2.click('[data-choice-page="childrenTraits"][data-page="1"]');
  await fp2.click('[data-chip="childrenTraits"][data-value="Calm"]');
  await fp2.click("#nextBtn");
  await fp2.click('[data-chip="languages"][data-value="English"]');
  await fp2.click("#nextBtn");
  await fp2.click('[data-yesno="specialNeeds"][data-value="no"]');
  await fp2.click("#nextBtn");
  t("the type of care step stands pre ticked on Babysitter, like the wizard", await fp2.evaluate(() => document.querySelector('[data-chip="role"][data-value="Babysitter"]')?.classList.contains("on") === true));
  await fp2.click('[data-chip="role"][data-value="Nanny"]');
  await fp2.click("#nextBtn");
  t("the checks screen names the real check, never 'tell us your country first'", (await fp2.textContent("body")).includes("Working With Children Check") && !(await fp2.textContent("body")).includes("Tell us your country first"));
  await fp2.click("#nextBtn");
  await fp2.click('[data-chip="comfortableWith"][data-value="Cooking"]');
  await fp2.click("#nextBtn");
  t("the week question asks when care is needed", (await fp2.textContent("#pageTitle")).includes("When do you need care"));
  await fp2.selectOption('[data-grid-day="scheduleNeed"]', "Thu");
  await fp2.click('[data-grid="scheduleNeed"][data-day="Thu"][data-part="morning"]');
  await fp2.click("#nextBtn");
  await fp2.click('[data-freq="often"][data-value="One or two days a week"]');
  await fp2.click('[data-freq="soon"][data-value="As soon as possible"]');
  await fp2.click("#nextBtn");
  await fp2.click('[data-choice-page="payOffered"][data-page="1"]');
  await fp2.click('[data-chip="payOffered"][data-value="35"]');
  await fp2.click("#nextBtn");
  await fp2.click('[data-chip="careLocationFamily"][data-value="At our home"]');
  await fp2.click("#nextBtn");
  await fp2.fill('[data-field="needWords"]', "Two afternoons a week, please.");
  await fp2.click("#nextBtn");
  await fp2.click('[data-chip="mustLanguages"][data-value="English"]');
  await fp2.click("#nextBtn");
  t("strength choices ride the looking for fields", (await fp2.textContent("body")).includes("Must have"));
  await fp2.click('[data-strength="nonSmoker"][data-value="Must have"]');
  await fp2.click('[data-yesno="nonSmoker"][data-value="yes"]');
  await fp2.click("#nextBtn");
  t("the photo step stands last (question 19 of 19)", (await fp2.textContent("#pageCount")).includes("Question 19 of 19"));
  t("the photo step offers no skip on this build", await fp2.evaluate(() => !document.querySelector("[data-photo-skip]")));
  await fp2.click("#nextBtn");
  t("an unanswered photo holds the page: the build cannot finish without it", (await fp2.textContent("#notice")).length > 3 && (await fp2.locator("#essentialsDone").isHidden()));
  await pickPhoto(fp2, "walk1");
  await fp2.click("#nextBtn");
  t("essentials end on the ready step", !(await fp2.locator("#essentialsDone").isHidden()));
  await fp2.click("#betterMatchesBtn");
  t("optional pages say they are optional and skippable", (await fp2.textContent("#optionalLead")).includes("These questions are optional"));
  for (let i = 0; i < 160 && (await fp2.locator("#done").isHidden()); i++) {
    const body = await fp2.textContent("body");
    if (body.includes("Which countries would you like to live in?") || body.includes("Will the au pair have their own private room?")) throw new Error("optional stage offered another track's question");
    await fp2.click("#skipBtn");
  }
  t("done page celebrates", !(await fp2.locator("#done").isHidden()));
  bundle = await fp2.evaluate(() => JSON.parse(localStorage.getItem("caresits-app2-questionnaire-walk1") || localStorage.getItem("caresits-app2-questionnaire")));
  t("bundle carries the family card and the must", bundle.side === "family" && bundle.card.musts.nonSmoker === true && bundle.card.scheduleNeed.Thu.includes("morning"));
  t("bundle carries the pay offered from the first build", Number(bundle.card.payOffered) === 35);
  t("bundle carries the family's own words need", bundle.answers.needWords === "Two afternoons a week, please.");
  t("bundle carries the walk answers: type of care multi pick, children count, frequency and urgency, care place, photo done", Array.isArray(bundle.answers.role) && bundle.answers.role.includes("Babysitter") && bundle.answers.role.includes("Nanny") && bundle.answers.childrenCount === "2 children" && bundle.answers.frequency?.often === "One or two days a week" && bundle.answers.frequency?.soon === "As soon as possible" && bundle.answers.careLocationFamily === "At our home" && bundle.answers.photoDone === true);
  t("the date of birth is a carer only answer: the family bundle carries none", bundle.answers.dateOfBirth === undefined);
  await fp2.close();
}

// ---- the carer build, nanny track, in the observed wizard
// order (Babysits account walk, 1 Nov 2026): country, name,
// postcode, date of birth, languages, education (level and
// words, both), certifications, 3 words, experience (one age
// band ticked is enough, the owner's ruling, 31 Oct 2026),
// age groups, special needs, skills, applies to you (the one
// skippable step), comfortable with, the week grid, rate,
// care place, about, the checks word, checks level, travel
// distance, and the photo LAST, required, with no skip. The
// date of birth stays in the carer's own answers only: it
// never reaches the published card.
{
  const cp2 = await walkPage({ uid: "walk2", entryRole: "career", side: "carer", track: "nanny", name: "Walk Carer" });
  t("carer question 1 of 23 (the country step stands first)", (await cp2.textContent("#pageCount")).includes("Question 1 of 23"));
  await cp2.click('[data-chip="country"][data-value="Australia"]');
  await cp2.click("#nextBtn");
  await cp2.fill('[data-field="displayName"]', "Walk Carer");
  await cp2.click("#nextBtn");
  await cp2.fill('[data-field="postcode"]', "2021");
  await cp2.click("#nextBtn");
  await cp2.fill('[data-field="dateOfBirth"]', "1996-04-12");
  await cp2.click("#nextBtn");
  await cp2.click('[data-chip="languages"][data-value="English"]');
  await cp2.click("#nextBtn");
  await cp2.selectOption('[data-edu-level="education"]', "TAFE or vocational");
  await cp2.fill('[data-edu-text="education"]', "Certificate III in Early Childhood");
  await cp2.click("#nextBtn");
  await cp2.click('[data-yesno="childcareCert"][data-value="yes"]');
  await cp2.click("#nextBtn");
  await cp2.click('[data-yesno="medicalCert"][data-value="no"]');
  await cp2.click("#nextBtn");
  await cp2.click('[data-chip="personality"][data-value="Warm"]');
  await cp2.click('[data-chip="personality"][data-value="Patient"]');
  await cp2.click('[data-chip="personality"][data-value="Playful"]');
  await cp2.click("#nextBtn");
  t("carer essentials ask the exact age bands experience", (await cp2.textContent("body")).includes("Years of experience"));
  await cp2.selectOption('[data-exp="experience"][data-bandname="1-3"]', "6");
  await cp2.click("#nextBtn");
  t("ONE age band ticked completes the experience question (owner's ruling): the walk advances to question 11", (await cp2.textContent("#pageCount")).includes("Question 11 of 23"), await cp2.textContent("#pageCount"));
  await cp2.click('[data-chip="agesAccepted"][data-value="1-3"]');
  await cp2.click("#nextBtn");
  await cp2.click('[data-yesno="specialNeedsExp"][data-value="yes"]');
  await cp2.click("#nextBtn");
  await cp2.click('[data-chip="activities"][data-value="Reading and storytime"]');
  await cp2.click("#nextBtn");
  await cp2.click("#nextBtn");
  t("applies to you is the one skippable step: an empty pick still advances (to question 15)", (await cp2.textContent("#pageCount")).includes("Question 15 of 23"), await cp2.textContent("#pageCount"));
  await cp2.click('[data-chip="comfortableWith"][data-value="Cooking"]');
  await cp2.click("#nextBtn");
  await cp2.selectOption('[data-grid-day="availability"]', "Thu");
  await cp2.click('[data-grid="availability"][data-day="Thu"][data-part="morning"]');
  await cp2.click("#nextBtn");
  await cp2.click('[data-choice-page="payFloor"][data-page="1"]');
  await cp2.click('[data-chip="payFloor"][data-value="30"]');
  await cp2.click("#nextBtn");
  await cp2.click('[data-chip="careLocationCarer"][data-value="At the family"]');
  await cp2.click("#nextBtn");
  await cp2.fill('[data-field="aboutMe"]', "I love reading with kids, singing songs, and long afternoons at the park.");
  await cp2.click("#nextBtn");
  await cp2.click("#nextBtn");
  await cp2.click('[data-chip="checksLevel"][data-value="Register verified"]');
  await cp2.click("#nextBtn");
  await cp2.click('[data-chip="maxDistanceKm"][data-value="10"]');
  await cp2.click("#nextBtn");
  t("the photo step stands last (question 23 of 23)", (await cp2.textContent("#pageCount")).includes("Question 23 of 23"));
  t("the photo step offers no skip on this build", await cp2.evaluate(() => !document.querySelector("[data-photo-skip]")));
  await pickPhoto(cp2, "walk2");
  await cp2.click("#nextBtn");
  t("carer essentials end on the ready step", !(await cp2.locator("#essentialsDone").isHidden()));
  await cp2.click("#betterMatchesBtn");
  for (let i = 0; i < 160 && (await cp2.locator("#done").isHidden()); i++) await cp2.click("#skipBtn");
  t("carer done page celebrates", !(await cp2.locator("#done").isHidden()));
  const bundle = await cp2.evaluate(() => JSON.parse(localStorage.getItem("caresits-app2-questionnaire-walk2") || localStorage.getItem("caresits-app2-questionnaire")));
  t("carer bundle carries the one band experience and the pay floor", Number(bundle.card.experience["1-3"]) === 6 && Number(bundle.card.payFloor) === 30);
  t("carer bundle carries the about and the two part education answers", bundle.answers.aboutMe.startsWith("I love reading with kids") && bundle.answers.education?.level === "TAFE or vocational" && bundle.answers.education?.text === "Certificate III in Early Childhood");
  t("the date of birth rides the carer's own answers and NEVER the published card", bundle.answers.dateOfBirth === "1996-04-12" && !("dateOfBirth" in bundle.card) && !JSON.stringify(bundle.card).includes("1996-04-12"));
  t("the certifications and walk answers ride the answers, never the card", bundle.answers.childcareCert === true && bundle.answers.medicalCert === false && bundle.answers.careLocationCarer === "At the family" && !("childcareCert" in bundle.card) && !("careLocationCarer" in bundle.card));
  await cp2.close();
}
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
await page.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
t("shell: five visible family tabs replace the hidden-only menu", await page.evaluate(() => !document.getElementById("layout").classList.contains("open") && document.getElementById("menu").offsetWidth <= 2 && document.querySelectorAll("#bottomNav .bottomTab:not([hidden])").length === 5 && document.getElementById("content").offsetWidth >= window.innerWidth - 2));
await page.screenshot({ path: "shell-closed.png" });
await page.click('[data-bottom-tab="family-more"]');
await page.waitForTimeout(450);
const widths = await page.evaluate(() => ({ menu: document.getElementById("menu").offsetWidth, sliver: document.getElementById("sliver").offsetWidth, total: window.innerWidth }));
t("shell: More opens the full grouped menu on a phone", widths.menu >= widths.total * 0.9 && widths.sliver === 0);
await page.screenshot({ path: "shell-open.png" });
await page.click('[data-group="finding"]');
t("shell: More expands the grouped screens accessibly", await page.evaluate(() => document.querySelector('[data-group="finding"]').getAttribute("aria-expanded") === "true" && document.querySelector('[data-nav="find"]').offsetParent !== null));
await page.click("#closeBtn");
await page.waitForTimeout(150);
t("shell: Close returns to the tab view", await page.evaluate(() => !document.getElementById("layout").classList.contains("open")));
await page.evaluate(() => window.CARESITS_ROLE_NAV("career"));
t("shell: carer tabs show Jobs, Calendar, Urgent, Messages and More", await page.evaluate(() => [...document.querySelectorAll('#bottomNav .bottomTab:not([hidden]) span')].map((n) => n.textContent).join("|") === "Jobs|Calendar|Urgent|Messages|More"));
await page.evaluate(() => window.CARESITS_ROLE_NAV("communicate"));
t("shell: Stay Connected tabs show Today, Calendar, Photos, Messages and More", await page.evaluate(() => [...document.querySelectorAll('#bottomNav .bottomTab:not([hidden]) span')].map((n) => n.textContent).join("|") === "Today|Calendar|Photos|Messages|More"));
await page.evaluate(() => window.CARESITS_ROLE_NAV("family"));
t("shell: no page errors", errs.length === 0);
{
  // env() cannot be injected into a desktop browser, so the
  // geometry is proven under the equivalent applied inset
  // (47px, the tall iPhone status bar): the same padding
  // the env() rule computes on device.
  const sp2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await sp2.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
  await sp2.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await sp2.addStyleTag({ content: "#bottomNav{padding-bottom:53px}" });
  const btnBox = await sp2.evaluate(() => { const b = document.querySelector('[data-bottom-tab="family-find"]').getBoundingClientRect(); return { bottom: b.bottom, height: b.height }; });
  t("safe-area: the bottom tab stays above a 47px home indicator with a 44px target", btnBox.bottom <= 797 && btnBox.height >= 44);
  await sp2.click('[data-bottom-tab="family-more"]');
  await sp2.waitForTimeout(150);
  t("safe-area: More remains tappable above the home indicator", await sp2.evaluate(() => document.getElementById("layout").classList.contains("open")));
  await sp2.close();
}


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
  await fp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
  const ferrs = [];
  fp.on("pageerror", (e) => ferrs.push(String(e)));
  await fp.addInitScript((data) => { window.CARESITS_FIND_DATA = data; }, { viewer: famDoc, candidates });
  await fp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await fp.click('[data-bottom-tab="family-find"]');
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
  // One pool, two views (Difference Map item 5, the suite
  // corrected to the ruling): the pins are the SHOWN pool,
  // so Mei, who failed the schedule gate and stands in the
  // nearly list, carries no pin. 8 fetched, 7 shown, 7 pins.
  t("map: pins equal the shown pool at area level (the nearly carer has no pin)", await fp.locator("#surface-find .mapPin").count() === 7);
  await fp.evaluate(() => [...document.querySelectorAll("#surface-find .mapPin")].find((p) => p.getAttribute("aria-label")?.startsWith("Ana"))?.click());
  t("map: a pin opens the card with the pair score as a percent", await fp.evaluate(() => {
    const listFit = [...document.querySelectorAll("#surface-find .findCard")].find((c) => c.querySelector(".findName")?.textContent === "Ana")?.querySelector(".fitScore")?.textContent.match(/\d+/)?.[0];
    const mapPct = document.querySelector("#surface-find .mapSlot .mapPct")?.textContent.match(/\d+/)?.[0];
    return !!listFit && listFit === mapPct;
  }));
  // THE PROFILE VIEW (Difference Map item 8): the same page
  // opens from the pin's mini card and from the list card.
  await fp.evaluate(() => document.querySelector("#surface-find .mapSlot .findDetailsBtn")?.click());
  await fp.waitForTimeout(250);
  t("profile: the pin's Details opens the profile page (name, experience, availability stand)", await fp.evaluate(() => { const o = document.getElementById("profileOverlay"); return !!o && o.textContent.includes("Ana") && o.textContent.includes("Experience") && o.textContent.includes("Availability"); }));
  await fp.evaluate(() => document.querySelector("#profileOverlay .profileClose")?.click());
  await fp.waitForTimeout(150);
  await fp.evaluate(() => { document.querySelector(".viewToggle .chip:nth-child(1)")?.click(); });
  await fp.waitForTimeout(200);
  await fp.evaluate(() => { const card = [...document.querySelectorAll("#surface-find .findCard")].find((c) => c.querySelector(".findName")?.textContent === "Ana"); card?.querySelector(".findDetailsBtn")?.click(); });
  await fp.waitForTimeout(250);
  t("profile: the list card's Details opens the same profile page", await fp.evaluate(() => { const o = document.getElementById("profileOverlay"); return !!o && o.textContent.includes("Ana"); }));
  await fp.evaluate(() => document.querySelector("#profileOverlay .profileClose")?.click());
  await fp.close();
  const ep = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await ep.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
  await ep.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await ep.evaluate(() => document.querySelector('[data-nav="find"]')?.click());
  await ep.waitForTimeout(300);
  t("find: with no finished questionnaire the invite state stands", await ep.evaluate(() => document.getElementById("findRoot").textContent.includes("Your matches wait for your answers")));
  t("map: an exploring viewer sees pins but no personal percent", await ep.evaluate(() => document.querySelectorAll("#findRoot .mapPin").length >= 0 && document.querySelectorAll("#findRoot .mapPct").length === 0));
  await ep.close();
  const qp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await qp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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
  await cp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
  const cerrs = [];
  cp.on("pageerror", (e) => cerrs.push(String(e)));
  await cp.addInitScript(() => {
    window.__writes = [];
    window.CARESITS_WRITE = (kind, payload) => window.__writes.push({ kind, payload });
    window.CARESITS_ME = { uid: "f1", side: "family", name: "Sam" };
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
  // The post form on this base is a four step wizard (when,
  // how long, which child, then postcode and notes) ending in
  // the "Post urgent job" button; the walk rides it as a user does.
  t("board: a family sees the post form", await cp.evaluate(() => document.getElementById("boardRoot").textContent.includes("Need help fast?")));
  for (let i = 0; i < 3; i++) {
    await cp.evaluate(() => [...document.querySelectorAll("#boardRoot button")].find((b) => b.textContent === "Save and continue").click());
    await cp.waitForTimeout(120);
  }
  await cp.fill("#jobPostcode", "2021");
  await cp.evaluate(() => [...document.querySelectorAll("#boardRoot button")].find((b) => b.textContent === "Post urgent job").click());
  await cp.waitForTimeout(200);
  t("board: an unfinished profile is walked to the questions, never scolded", await cp.evaluate(() => !document.getElementById("surface-questionnaire").hidden && document.getElementById("boardRoot").textContent.includes("Finish your care details first")));
  await cp.evaluate(() => { window.CARESITS_PROFILE_COMPLETE = true; });
  await cp.evaluate(() => document.querySelector('[data-nav="board"]').click());
  await cp.evaluate(() => [...document.querySelectorAll("#boardRoot button")].find((b) => b.textContent === "Post urgent job").click());
  t("board: a finished profile posts through the planner", await cp.evaluate(() => window.__writes.some((w) => w.kind === "job" && w.payload.data.state === "open")));
  t("phase C: no page errors", cerrs.length === 0);
  await cp.close();
}


// ---- F19: the live Phase C seam lands after first render ----
{
  const lp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await lp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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
  await sp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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
  await bp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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
  await kp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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
  await dp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
  const derrs = [];
  dp.on("pageerror", (e) => derrs.push(String(e)));
  await dp.goto("http://localhost:8933/door.html", { waitUntil: "networkidle" });
  await dp.waitForTimeout(250);
  t("door: the sign up stands alone, big and centred", await dp.evaluate(() => !!document.querySelector(".doorMark") && !!document.getElementById("googleBtn") && !!document.getElementById("appleBtn") && !!document.getElementById("emailIn") && !!document.getElementById("nextBtn")));
  t("door: no password on the first page", await dp.evaluate(() => document.getElementById("step2").hidden === true));
  // Door purity (Difference Map item 2): there is no role
  // pick on the door any more; the auth door stands open
  // from the first paint, one sign up for everyone.
  t("door: no role pick stands on the door; the auth door is open at once", await dp.evaluate(() => !document.querySelector("[data-role]") && !document.getElementById("authDoor").hidden));
  await dp.fill("#emailIn", "sam@example.com");
  await dp.click("#nextBtn");
  t("door: step two shows the email, Change, and the password", await dp.evaluate(() => !document.getElementById("step2").hidden && document.getElementById("emailEcho").textContent === "sam@example.com" && !!document.getElementById("pwIn")));
  t("door: no page errors", derrs.length === 0);
  await dp.close();

  const tp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await tp.addInitScript(() => {
    window.CARESITS_LIVE_OFF = true;
    window.CARESITS_UID = "tour-user";
    window.CARESITS_ME = { uid: "tour-user", side: "family", entryRole: "family", activeSide: "family", sideTours: {} };
    window.CARESITS_ACCOUNT_READY = true;
  });
  const terrs = [];
  tp.on("pageerror", (e) => terrs.push(String(e)));
  await tp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await tp.waitForTimeout(300);
  t("tour: first run opens with one short bunny sentence, progress, Next, and Skip guide", await tp.evaluate(() => !!document.getElementById("tourPop") && document.querySelector("#tourPop .guideWords").textContent.includes("Hi, I’m the Caresitters bunny") && document.querySelector("#tourPop .guideCount").textContent.startsWith("Step 1 of ") && document.querySelector("#tourPop .guideSkip").textContent === "Skip guide"));
  await tp.click("#tourPop .guideNext");
  t("tour: the family side is explained before navigation", await tp.evaluate(() => document.querySelector("#tourPop .guideWords").textContent.includes("families find and organise care")));
  await tp.click("#tourPop .guideNext");
  t("tour: the guide explains the questionnaire notes", await tp.evaluate(() => document.querySelector("#tourPop .guideWords").textContent.includes("Each question has a short note")));
  await tp.click("#tourPop .guideNext");
  t("tour: the existing name onboarding keeps one Next and Skip guide", await tp.evaluate(() => !!document.querySelector("#tourPop .guideName") && document.querySelector("#tourPop .guideNext").textContent === "Next"));
  await tp.fill("#tourPop .guideName", "Sam");
  await tp.click("#tourPop .guideNext");
  // The guide's tab steps ride the tabs this shell actually
  // carries (tour.js sideTabs reads them off the bottom nav):
  // Find, Calendar, Urgent, Messages, More, then the Me step.
  t("tour: the guide highlights Find first", await tp.evaluate(() => localStorage.getItem("caresits-name-tour-user") === "Sam" && document.querySelector('[data-bottom-tab="family-find"]').classList.contains("tourSpotlight")));
  await tp.click("#tourPop .guideNext");
  t("tour: the guide highlights Calendar", await tp.evaluate(() => document.querySelector('[data-bottom-tab="family-week"]').classList.contains("tourSpotlight")));
  await tp.click("#tourPop .guideNext");
  t("tour: the guide highlights Urgent", await tp.evaluate(() => document.querySelector('[data-bottom-tab="family-urgent"]').classList.contains("tourSpotlight")));
  await tp.click("#tourPop .guideNext");
  t("tour: the guide highlights Messages", await tp.evaluate(() => document.querySelector('[data-bottom-tab="family-messages"]').classList.contains("tourSpotlight")));
  await tp.click("#tourPop .guideNext");
  t("tour: the guide highlights More", await tp.evaluate(() => document.querySelector('[data-bottom-tab="family-more"]').classList.contains("tourSpotlight")));
  await tp.click("#tourPop .guideNext");
  t("tour: More opens and the Me step explains profile, settings and switching sides", await tp.evaluate(() => document.getElementById("layout").classList.contains("open") && document.querySelector("#tourPop .guideWords").textContent.includes("Switch between finding")));
  const guideCopy = [];
  for (let step = 0; step < 60 && await tp.locator("#tourPop").count(); step++) {
    guideCopy.push(await tp.locator("#tourPop .guideWords").textContent());
    await tp.click("#tourPop .guideNext");
  }
  t("tour: the final step explains the Me button in plain words", guideCopy.some((line) => line.includes("your profile, settings and app mode")));
  t("tour: completion is remembered per side and uid", await tp.evaluate(() => !document.getElementById("tourPop") && JSON.parse(localStorage.getItem("caresits-side-tours-tour-user")).family === true && JSON.parse(localStorage.getItem("caresits-guide-progress-family-tour-user")).done === true));
  await tp.evaluate(() => window.CARESITS_NAV("settings"));
  await tp.waitForTimeout(100);
  await tp.evaluate(() => [...document.querySelectorAll("#settingsRoot button")].find((b) => b.textContent === "Replay the guide")?.click());
  t("tour: Settings replays the completed guide", await tp.evaluate(() => document.getElementById("tourPop")?.querySelector(".guideWords")?.textContent.includes("Hi, I’m the Caresitters bunny")));
  await tp.click("#tourPop .guideSkip");
  await tp.evaluate(() => {
    window.CARESITS_UID = "other-tour-user";
    window.CARESITS_ME = { uid: "other-tour-user", side: "family", entryRole: "family", activeSide: "family", sideTours: {} };
    window.CARESITS_ROLE_NAV("family");
    window.CARESITS_TOUR_START_SIDE("family");
  });
  t("tour: a different uid gets its own first guide", await tp.evaluate(() => document.getElementById("tourPop")?.querySelector(".guideWords")?.textContent.includes("Hi, I’m the Caresitters bunny")));
  await tp.click("#tourPop .guideSkip");
  await tp.evaluate(() => {
    window.CARESITS_UID = "tour-user";
    window.CARESITS_ME = { uid: "tour-user", side: "family", entryRole: "family", activeSide: "family", sideTours: { family: true } };
    window.CARESITS_ROLE_NAV("family");
  });
  t("tour: returning uid sees no guide after a second login", await tp.evaluate(() => !document.getElementById("tourPop")));
  await tp.evaluate(() => {
    window.CARESITS_ME = { ...window.CARESITS_ME, activeSide: "career" };
    window.CARESITS_UID = "tour-user";
    window.CARESITS_ROLE_NAV("career");
    window.CARESITS_TOUR_START_SIDE("career");
  });
  await tp.click("#tourPop .guideNext");
  t("tour: carer side gets a separate guide", await tp.evaluate(() => document.getElementById("tourPop")?.querySelector(".guideWords")?.textContent.includes("carers find work")));
  await tp.click("#tourPop .guideNext");
  await tp.click("#tourPop .guideNext");
  t("tour: the carer guide highlights the Jobs tab", await tp.evaluate(() => document.querySelector('[data-bottom-tab="career-find"]').classList.contains("tourSpotlight")));
  await tp.click("#tourPop .guideSkip");
  t("tour: no page errors", terrs.length === 0);
  await tp.close();
}


// ---- Phase D: Children + Day Story ----
{
  const fp2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fp2.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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
  t("children: the card shows with its theme colour", await fp2.evaluate(() => document.getElementById("childrenRoot").textContent.includes("Mila") && document.querySelector("#childrenRoot .kidCard").style.borderTopColor === "rgb(139, 118, 184)"));
  await fp2.evaluate(() => document.getElementById("kAddOpen").click()); // the add form stands in its sheet
  await fp2.waitForTimeout(150);
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
  await wp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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
  await up.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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
  // THE FREE FOR ALL SHAPE (Polar's line on this tree, and
  // the build brief of 31 Oct 2026: the paid and free shape
  // stands as it stands and is NOT reworked by the
  // Difference Map build). With FREE_FOR_ALL on in
  // accounts/account.js, canSendMessage always allows, so
  // the second message SENDS and no upgrade moment fires.
  // This leg once asserted the taste wall; it is corrected
  // to the standing shape, the same way the levels suite
  // was corrected to the owner's ruling. If the free for
  // all line is ever switched off, this leg must go back
  // to asserting the wall.
  t("free for all: the second message sends, no upgrade moment fires", await up.evaluate(() => !document.getElementById("upgradePop") && window.__writes.some((w) => w.kind === "message" && w.payload.text === "One more thing")));
  const writesBefore = await up.evaluate(() => window.__writes.filter((w) => w.kind === "message").length);
  await up.evaluate(() => { const ta = document.querySelector("#threadRoot textarea"); ta.value = "Once more"; });
  await up.evaluate(() => [...document.querySelectorAll("#threadRoot button")].find((b) => b.textContent === "Send").click());
  await up.waitForTimeout(120);
  t("free for all: a third message sends too, still no popup", await up.evaluate((n) => !document.getElementById("upgradePop") && window.__writes.filter((w) => w.kind === "message").length === n + 1, writesBefore));
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
  await mp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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
  await gp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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
  await dp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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
  await fp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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
  const seedA = { side: "family", page: 1, stage: "essentials", answers: { country: "Australia" }, strengths: {}, resumeFeed: [], countryStep: false };
  const mkJourney = async (uid, seed) => {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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
  t("isolation (F16): A's draft returns when A is signed in", await a1.p.evaluate(() => !document.getElementById("journey").hidden && document.getElementById("pageCount").textContent.includes("Question 2 of")));
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
  t("isolation (F16): A signs back in and the draft is still there", await a2.p.evaluate(() => !document.getElementById("journey").hidden && document.getElementById("pageCount").textContent.includes("Question 2 of")));
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
  // Fleet rule (Ilse, 29 Oct 2026): the demo is GONE. No
  // shipped file reads or sets the old marker, the gate
  // carries no exemption, and no demo slot stands in the
  // key resolver. (storage-keys.js still DELETES the stale
  // marker at sign out: hygiene for old installs, not a
  // gate, so the census hunts reads and writes only.)
  const shipped = ["./live.js", "./door.js", "./journey.js", "./purchase.js", "./plans.js", "./storage-keys.js", "./shell.js", "./index.html", "./door.html", "./journey.html"];
  t("Ruling (fleet, 29 Oct 2026): no demo way in stands anywhere in the shipped set", shipped.every((f) => { const x = src(f); return !x.includes('getItem("caresits-demo")') && !x.includes('setItem("caresits-demo"') && !x.includes("isDemoSession") && !x.includes("plans.demoLine") && !x.includes("door.demo"); }));
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
  t("b104 ROOT B: the boot publishes the week seam and the saved background, then re-renders", src("./live.js").includes("window.CARESITS_WEEK = weekSeamFrom") && src("./live.js").includes('accountKey("caresits-app2-bg", uid)') && src("./live.js").includes("CARESITS_WEEK_RENDER"));
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
  t("b107 language ride: the pick writes the account doc, the boot seeds it back", src("./live.js").includes('case "language":') && src("./live.js").includes('accountKey("caresits-lang", uid)') && src("./trust.js").includes('write("language", { code })'));
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
  await p.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
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

// ---- Polar C1 + C2 (build 114 device round) ----
// C1: the Find map stood empty for every real member — no
// production save ever wrote card coordinates, so the pin
// layout filtered the whole pool out while the suite
// fixtures, which carried coordinates, passed. The cure:
// an area centroid table, the save writes it, the Find
// read derives it for cards saved before. C2: the home
// greeting was a fixed "Good morning" at every hour; it
// now follows the device clock, with keys in all seven
// languages.
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  t("C1: the area table stands in browse and both derivations ride it", src("./browse.js").includes("export function areaCoordsFor") && src("./account-save.js").includes("withAreaCoords(cardWithGallery") && src("./find.js").includes("areaCoordsFor(card.postcode || doc.postcode"));
  t("C1: an unplaceable pool reads the honest empty line, never a bare panel", src("./find.js").includes("find.mapEmpty") && src("./lang.js").includes("\"find.mapEmpty\""));
  t("C2: the greeting picks its salutation from the device hour", src("./homes.js").includes("new Date().getHours()") && src("./homes.js").includes("\"homes.hello\" + part"));
}

// ---- Safe-area (Ilse's fleet ruling, 21 Oct 2026) ----
// The menu button sat at the very top edge under the iOS
// status bar, untappable (her own phone screenshot on a
// sibling app; the chrome pattern is the house's). The app
// now extends under the bar by design (viewport-fit=cover
// on its three pages) and every top chrome surface insets
// itself by env(safe-area-inset-top): the shell top bar,
// the open menu, the sheet wrap, the door wrap, the
// journey head. The geometry leg below proves clearance +
// tappability at the device shape under the equivalent
// applied inset; the env() plumbing is proven on device.
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  const sat = (p) => (src(p).match(/env\(safe-area-inset-top/g) || []).length;
  t("safe-area: every top chrome surface insets by the safe area", sat("./shell.css") >= 3 && sat("./door.css") === 1 && sat("./styles.css") === 1);
  t("safe-area: the app's three pages extend under the bar by design", ["./door.html", "./index.html", "./journey.html"].every((p) => src(p).includes("viewport-fit=cover")));
  t("no-zoom: a double tap never zooms, on any of the app's pages (her ruling, 21 Oct)", ["./door.html", "./index.html", "./journey.html"].every((p) => src(p).includes("maximum-scale=1.0") && src(p).includes("user-scalable=no")) && ["./shell.css", "./door.css", "./styles.css"].every((p) => src(p).includes("touch-action: manipulation")));
}

// ---- Night N1: progress derives from the full saved state ----
// A completed member on a fresh boot read 0% at Home and
// "Exploring" on the Profile: the boot judged the level from
// the questionnaire's base answers alone (the tiers live in
// the per-code documents), and Home read only the device
// keys, which the drain consumes by design. The boot merges
// the documents in; publishTrust stands a progress seam;
// Home derives from it; the save's publication rebuilds it.
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  t("N1: the boot merges the per-code answer documents into the judged map", src("./live.js").includes("mergeDeepAnswers(qData.answers || {}, byPair") && src("./live.js").includes("profiles/${uid}/answers"));
  t("N1: publishTrust stands the progress seam and the save's publication rebuilds it", src("./live.js").includes("window.CARESITS_QUESTIONS") && src("./account-save.js").includes("h.CARESITS_QUESTIONS") && src("./account-save.js").includes("mergeDeepAnswers(bundle.answers || {}, byPair, bundle.side || \"\")"));
  t("N1: Home's progress card derives from the server seam before the device keys", src("./homes.js").includes("window.CARESITS_QUESTIONS") && src("./homes.js").includes("serverDone"));
}

// ---- b112 FIND same-session: the save republishes the pool ----
// The boot publishes Find's pool before a first session's
// journey exists (truthfully empty); the landed save must
// republish it in that same session, or Find waits until the
// next boot (Test b112 Leg C). The shell installs the refresh
// seam beside its boot publication; the save's publication
// fires it on every host it touches.
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  t("b112 FIND: the shell installs a Find refresh seam beside its boot publication", src("./live.js").includes("window.CARESITS_FIND_REFRESH") && src("./live.js").includes("const publishFind"));
  t("b112 FIND: the save's publication fires the Find refresh", src("./account-save.js").includes("h.CARESITS_FIND_REFRESH") && src("./account-save.js").includes("h.CARESITS_FIND_REFRESH()"));
}

// ---- Leg 11: the level boundary (the staged journey's shape) ----
// The welcome level picker and stop panel of the old design
// are gone on this base: the staged journey's ready step IS
// the stop point (See my matches / Make my matches better),
// and the done screen names the level levels.js computes.
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  const html = src("./journey.html");
  t("Leg 11: the ready step offers the stop or deepen choice", html.includes('id="seeMatchesBtn"') && html.includes('id="betterMatchesBtn"'));
  // The call now passes the member's track as well (the
  // Difference Map item 4: levels are judged per track).
  t("Leg 11: the journey computes the boundary from levels.js, per track", src("./journey.js").includes("levelOf(state.side, state.answers, state.track"));
  const mkSeeded = async (seed) => {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.addInitScript(({ seed }) => { window.CARESITS_UID = "uidA"; if (seed) localStorage.setItem("caresits-app2-draft-uidA", JSON.stringify(seed)); }, { seed });
    await p.goto("http://localhost:8933/", { waitUntil: "networkidle" });
    await p.waitForTimeout(250);
    return { p, errs };
  };
  // The seed stands on the LAST essentials page. The
  // family build follows the observed wizard order (account
  // walk, 1 Nov 2026), so the last page is the photo page
  // (index 17 of 18), and the seed answers cover every
  // essential of the new build, the photo included.
  const essentialsSeed = {
    side: "family", page: 17, stage: "essentials", countryStep: false,
    answers: { country: "Australia", displayName: "Seed", postcode: "2021", role: ["Babysitter", "Nanny"], childrenCount: "2 children", childrenBands: ["1-3"], childrenTraits: ["Curious"], languages: ["English"], specialNeeds: false, comfortableWith: ["Cooking"], scheduleNeed: { Thu: ["morning"] }, frequency: { often: "One or two days a week", soon: "As soon as possible" }, payOffered: "35", careLocationFamily: "At our home", mustLanguages: ["English"], nonSmoker: true, needWords: "Help on Thursdays", photoDone: true },
    strengths: { nonSmoker: "Must have" }, resumeFeed: [],
  };
  const s1 = await mkSeeded(essentialsSeed);
  await s1.p.click("#nextBtn");
  await s1.p.waitForTimeout(200);
  t("Leg 11: finishing the essentials lands on the ready step", await s1.p.evaluate(() => !document.getElementById("essentialsDone").hidden && !!document.getElementById("seeMatchesBtn") && !!document.getElementById("betterMatchesBtn")));
  await s1.p.click("#betterMatchesBtn");
  await s1.p.waitForTimeout(200);
  t("Leg 11: Make my matches better returns to the walk, past the boundary", await s1.p.evaluate(() => document.getElementById("essentialsDone").hidden && !document.getElementById("journey").hidden && !document.getElementById("optionalLead").hidden));
  t("Leg 11: the boundary walk carries no errors", s1.errs.length === 0);
  await s1.p.close();

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
  const seed = { side: "family", page: 0, stage: "optional", answers, strengths: {}, resumeFeed: [], countryStep: false };
  const s2 = await mkSeeded(seed);
  for (let i = 0; i < 160 && (await s2.p.locator("#done").isHidden()); i++) await s2.p.click("#skipBtn");
  await s2.p.waitForTimeout(300);
  t("Leg 11: finishing names the computed level on the done screen", await s2.p.evaluate(() => !document.getElementById("done").hidden && document.getElementById("doneLevel").textContent.includes("Quick Connect")));
  await s2.p.close();
}

// ---- Payments piece 2: the Plus gate + the plans sheet ----
// The gate sits at the shell's nav choke point. Its legs pin the
// exact fences: a locked family meets the sheet and the surface
// does not switch; the in-app month and any paid record walk in;
// carers are never gated; no member seam means no gate.
{
  const pp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pp.addInitScript(() => { window.CARESITS_LIVE_OFF = true; window.CARESITS_UID = "f1"; window.CARESITS_AUTH_STATE = "signed-in"; });
  const perrs = [];
  pp.on("pageerror", (e) => perrs.push(String(e)));
  await pp.goto("http://localhost:8933/index.html", { waitUntil: "networkidle" });
  await pp.waitForTimeout(300);
  const setMe = (me) => pp.evaluate((m) => { if (m) window.CARESITS_ME = m; else delete window.CARESITS_ME; }, me);
  await setMe({ uid: "f9", side: "family", plusExtras: false });
  await pp.evaluate(() => window.CARESITS_NAV("daystory"));
  await pp.waitForTimeout(200);
  // THE FREE FOR ALL SHAPE (Polar's line on this tree, 31
  // Oct 2026, standing per the build brief: the paid and
  // free shape is NOT reworked by the Difference Map
  // build). shell.js plusLocked returns false for everyone,
  // so a family walks straight into the Day Story and no
  // plans sheet fires. This leg once asserted the locked
  // gate; it is corrected to the standing shape, as the
  // levels suite was corrected to the owner's ruling. The
  // sheet itself still stands and is proven below, opened
  // the plain way.
  t("free for all: a family walks into the Day Story, no plans sheet, surface switched", await pp.evaluate(() => !document.getElementById("plansPop") && !document.getElementById("surface-daystory").hidden));
  await pp.evaluate(() => window.CARESITS_OPEN_PLANS && window.CARESITS_OPEN_PLANS("plus"));
  await pp.waitForTimeout(150);
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
  t("plans gate: a carer is never gated", await pp.evaluate(() => !document.getElementById("weekPanelRoster").hidden && !document.getElementById("plansPop")));
  await setMe(null);
  await pp.evaluate(() => window.CARESITS_NAV("timesheet"));
  await pp.waitForTimeout(150);
  t("plans gate: no member seam, no gate (demo and previews stand)", await pp.evaluate(() => !document.getElementById("weekPanelTimesheet").hidden && !document.getElementById("plansPop")));
  await setMe({ uid: "f9", side: "family", plusExtras: false });
  await pp.evaluate(() => window.CARESITS_TRUST_RENDER());
  await pp.waitForTimeout(150);
  // THE FREE FOR ALL SHAPE again (trust.js, Ilse 31 Oct
  // 2026, in the code's own words: "no plans, no prices"):
  // the Settings Plans entry was replaced by the Free for
  // everyone card. There is no plans button in Settings on
  // this tree, for either side. These legs once asserted
  // the button; corrected to the standing shape.
  t("free for all: Settings shows the Free for everyone card to a family, and no plans button stands", await pp.evaluate(() => !document.getElementById("plansBtn") && document.body.textContent.includes("Free for everyone") && document.body.textContent.includes("Caresitters costs nothing right now")));
  await setMe({ uid: "c9", side: "carer" });
  await pp.evaluate(() => window.CARESITS_TRUST_RENDER());
  await pp.waitForTimeout(150);
  t("free for all: Settings shows the same free card to a carer, still no plans button", await pp.evaluate(() => !document.getElementById("plansBtn") && document.body.textContent.includes("Free for everyone")));
  t("plans legs: no page errors", perrs.length === 0);
  await pp.close();
}

console.log(`\nALL ${n} journey checks passed`);
await browser.close();
server.close();

