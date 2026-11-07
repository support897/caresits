import { test, CARESITTERS_URL, SECOND_APP_URL, createUser, seedCarer, seedProfile, signIn, newTestEmail } from "../lib.mjs";
import { writeFileSync } from "node:fs";
const OUT = "/home/user/shots/audit";
const AUDIT = () => {
  const vw = document.documentElement.clientWidth; const res = [];
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const label = (e) => `${e.tagName.toLowerCase()}.${(e.className && e.className.baseVal === undefined ? String(e.className) : "").slice(0, 40)}|${(e.getAttribute("aria-label") || e.innerText || "").trim().slice(0, 30)}`;
  if (document.documentElement.scrollWidth > vw + 1) res.push(`PAGE_HSCROLL ${document.documentElement.scrollWidth}>${vw}`);
  for (const e of document.querySelectorAll("button,a,[role=button],input:not([type=hidden]),select,textarea")) {
    if (!vis(e)) continue; const r = e.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) res.push(`OFFSCREEN ${label(e)} l=${Math.round(r.left)} r=${Math.round(r.right)}`);
    if (e.tagName !== "INPUT" && (r.height < 32 || r.width < 32) && (e.innerText || e.getAttribute("aria-label"))) res.push(`SMALLTAP ${label(e)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  for (const e of document.querySelectorAll("h1,h2,h3,p,span,label,li,div")) {
    if (!vis(e) || e.children.length > 0) continue; const t = (e.innerText || "").trim(); if (!t) continue;
    const s = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 2 && (s.overflow === "hidden" || s.overflowX === "hidden") && s.textOverflow !== "ellipsis") res.push(`CLIPPED ${label(e)}`);
    const r = e.getBoundingClientRect(); if (r.right > vw + 2) res.push(`TEXT_OFF ${label(e)} r=${Math.round(r.right)}`);
  }
  for (const i of document.querySelectorAll("img")) if (vis(i) && i.complete && i.naturalWidth === 0) res.push(`BROKEN_IMG ${i.src.slice(0, 60)}`);
  if (/undefined|\[object|NaN|\{\{|lorem|TODO/i.test(document.body.innerText)) res.push("PLACEHOLDER_TEXT " + (document.body.innerText.match(/.{0,30}(undefined|\[object|NaN|\{\{|lorem|TODO).{0,30}/i) || [""])[0].replace(/\n/g, " "));
  return [...new Set(res)];
};
async function sweep(page, prefix, w, report) {
  await page.waitForTimeout(1200);
  const names = await page.locator("nav.tabs button, nav button").evaluateAll(els => els.map(e => (e.getAttribute("aria-label") || e.innerText || "").trim().split("\n")[0]).filter(Boolean));
  let i = 0;
  for (const n of [null, ...names]) {
    if (n) { try { await page.getByRole("button", { name: n }).first().click({ timeout: 4000, force: true }); } catch { continue; } await page.waitForTimeout(1200); }
    for (const y of [0, 700, 1400]) {
      await page.evaluate((yy) => document.querySelectorAll(".scroll,main").forEach(e => { e.scrollTop = yy; }), y); await page.waitForTimeout(300);
      const issues = await page.evaluate(AUDIT);
      const tag = `${prefix}-${w}-${n ?? "home"}-${y}`.replace(/\W+/g, "_");
      if (y === 0) await page.screenshot({ path: `${OUT}/${tag}.png` });
      if (issues.length) report.push({ at: tag, issues });
    }
  }
}
test("audit layout 390 and 320", async ({ browser }) => {
  test.setTimeout(600_000);
  const report = [];
  for (const w of [390, 320]) {
    for (const side of ["family", "carer"]) {
      const user = await createUser(newTestEmail("au" + side)); const other = await createUser(newTestEmail("auo" + side));
      if (side === "family") { await seedCarer(other.uid, { displayName: "Olly Other" }); await seedProfile(user.uid, { side: "family" }); } else { await seedProfile(other.uid, { side: "family", displayName: "Fay Other" }); await seedCarer(user.uid); }
      const ctx = await browser.newContext({ viewport: { width: w, height: 760 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.addInitScript(() => localStorage.setItem("caresits-tour-done", "1"));
      await page.goto(`${CARESITTERS_URL}/?emu=1`);
      await signIn(page, user, undefined, { side });
      await sweep(page, `cr-${side}`, w, report);
      await ctx.close();
    }
    const user = await createUser(newTestEmail("aucs"));
    await seedProfile(user.uid, { side: "family" });
    const ctx = await browser.newContext({ viewport: { width: w, height: 760 } });
    const page = await ctx.newPage();
    await page.goto(`${SECOND_APP_URL}/?emu=1`);
    await page.getByRole("button", { name: "Continue with email", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForTimeout(4000);
    const setup = page.getByRole("button", { name: "Set up my Care Space" });
    if (await setup.isVisible().catch(() => false)) { await page.screenshot({ path: `${OUT}/cs-${w}-welcome.png` }); report.push(...[{ at: `cs-${w}-welcome`, issues: await page.evaluate(AUDIT) }].filter(r => r.issues.length)); }
    await sweep(page, "cs", w, report);
    await ctx.close();
  }
  writeFileSync("/home/user/scratch/audit.json", JSON.stringify(report, null, 1));
  console.log("AUDIT_ISSUES", report.length);
});
