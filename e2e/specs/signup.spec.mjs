import { test, expect, CARESITTERS_URL, signIn, newTestEmail, readDocument } from "../lib.mjs";
import { writeFileSync, appendFileSync } from "node:fs";

// A generic "customer" that walks the real onboarding wizard for every role and reports where it gets stuck.
const LOG = "/home/user/scratch/signup-walk.log";
const ROLES = [["family", "nanny"], ["family", "babysitter"], ["family", "au_pair"], ["carer", "nanny"], ["carer", "babysitter"], ["carer", "au_pair"]];
const LABEL = { nanny: /Nanny/, babysitter: /Babysitter/, au_pair: /Au pair/ };

async function fillVisible(page, role) {
  const inputs = page.locator("main input:visible, main textarea:visible, main select:visible");
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    const type = (await el.getAttribute("type")) ?? "text";
    if (["checkbox", "radio", "file", "hidden", "range"].includes(type)) continue;
    if ((await el.evaluate((e) => e.tagName)) === "SELECT") continue;
    if ((await el.inputValue().catch(() => "x")) !== "") continue;
    const hint = `${(await el.getAttribute("aria-label")) ?? ""} ${(await el.getAttribute("placeholder")) ?? ""} ${await el.evaluate((e) => e.closest("label")?.innerText ?? "")}`.toLowerCase();
    let v = "Test answer";
    if (type === "number") { const mx = Number(await el.getAttribute("max")) || 30; v = /age|year/.test(hint) ? "3" : String(Math.min(mx, 12)); }
    else if (type === "date") v = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    else if (type === "time") v = (await page.locator('input[type="time"]:visible').evaluateAll((els, e) => els.indexOf(e), await el.elementHandle())) % 2 ? "15:00" : "08:00";
    else if (/postcode|4005/.test(hint)) v = "4005";
    else if (/suburb|farm/.test(hint)) v = "New Farm";
    else if (/name/.test(hint)) v = `Walker ${role}`;
    else if (/yyyy-mm-dd|date/.test(hint)) v = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    else if (/hour|rate|budget|price|\$/.test(hint)) v = "30";
    else if (/intro|about|bio|headline|instruction/.test(hint)) v = "Warm, reliable and experienced with young children.";
    await el.fill(v).catch(() => undefined);
  }
}

for (const [side, svc] of ROLES) {
  test(`signup walk ${side}:${svc}`, async ({ page }) => {
    test.setTimeout(600_000);
    const log = (m) => appendFileSync(LOG, `[${side}:${svc}] ${m}\n`);
    await page.addInitScript(() => localStorage.setItem("caresits-tour-done", "1"));
    await page.goto(`${CARESITTERS_URL}/?emu=1`);
    await signIn(page, newTestEmail("walk"), "E2e-Walk-Password-2026!", { side });
    let guard = 0, lastHeading = "", same = 0;
    while (guard++ < 30) {
      const h = (await page.locator("main h1, .onb-heading h1").first().innerText({ timeout: 8000 }).catch(() => "")).trim();
      if (!h) break;
      if (h !== lastHeading) log(`step: ${h}`);
      same = h === lastHeading ? same + 1 : 0; lastHeading = h;
      if (same >= 3) { log(`LOOP on "${h}": ${(await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 700)}`); break; }
      if (/care type|care types|care you offer/i.test(h)) await page.getByRole("button", { name: LABEL[svc] }).first().click().catch(() => undefined);
      if (/free|availab/i.test(h)) await page.getByRole("button", { name: "Mon", exact: true }).click().catch(() => undefined);
      await fillVisible(page, svc);
      // service-details: choose first option in each unanswered question group
      const groups = page.locator('span[id^="sd-"]');
      for (let g = 0; g < await groups.count(); g++) {
        const grp = groups.nth(g).locator("xpath=following-sibling::*[1]");
        if (await grp.locator('button[aria-pressed="true"]').count()) continue;
        await grp.locator("button").first().click(); await page.waitForTimeout(150);
      }
      // pick first option in any group that has nothing selected
      for (const b of await page.locator('main button[aria-pressed="false"]:visible').all()) {
        if (/care type|care types|care you offer/i.test(h)) break;
        const name = (await b.innerText().catch(() => "")).trim();
        if (/^(Mon|Tue)$/.test(name) || /Montessori|reading|English|Yes|20 km|35/.test(name)) await b.click().catch(() => undefined);
      }
      const next = page.getByRole("button", { name: /^(Save and continue|Finish profile|Continue|Next)$/ }).first();
      if (!(await next.count())) { log(`no continue button on "${h}"`); break; }
      const label = (await next.innerText()).trim();
      await next.click();
      await page.waitForTimeout(700);
      const err = await page.locator('[role="alert"], .onb-error, .error').first().innerText().catch(() => "");
      if (err.trim()) {
        log(`ERROR on "${h}": ${err.trim().slice(0, 160)}`);
        // try a few unpressed chips then retry once
        const chips = await page.locator('main button[aria-pressed="false"]:visible').all();
        for (const c of chips.slice(0, 2)) await c.click().catch(() => undefined);
        await fillVisible(page, svc);
        await next.click().catch(() => undefined); await page.waitForTimeout(600);
        const err2 = await page.locator('[role="alert"], .onb-error, .error').first().innerText().catch(() => "");
        if (err2.trim()) { log(`STUCK on "${h}": ${err2.trim().slice(0, 160)}`); break; }
      }
      if (label === "Finish profile") break;
    }
    // finished? tabs visible
    const done = await page.locator("nav.tabs").first().waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
    log(done ? "RESULT: reached the app" : `RESULT: NOT finished (last step: ${lastHeading})`);
    if (!done) { log(`PAGE: ${(await page.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 600)}`); await page.screenshot({ path: `/home/user/scratch/walk-${side}-${svc}.png` }); }
    expect(done, `${side}:${svc} should finish onboarding. See ${LOG}`).toBe(true);
  });
}
