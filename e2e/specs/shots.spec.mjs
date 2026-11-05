import { test, expect, CARESITTERS_URL, SECOND_APP_URL, createUser, seedCarer, seedProfile, signIn, newTestEmail } from "../lib.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
const PHOTO = "data:image/jpeg;base64," + readFileSync(path.resolve(import.meta.dirname, "../fixtures/photo-with-gps.jpg")).toString("base64");
const OUT = "/home/user/shots";
async function tabs(page, prefix) {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${prefix}-home.png` });
  const names = await page.locator("nav.tabs button, nav[class*=tab] button, nav button").evaluateAll(els => els.map(e => (e.getAttribute("aria-label") || e.innerText || "").trim().split("\n")[0]).filter(Boolean));
  console.log(prefix, "TABS", JSON.stringify(names));
  let i = 0;
  for (const n of names) {
    try { await page.getByRole("button", { name: n, exact: false }).first().click({ timeout: 4000 }); await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/${prefix}-tab${++i}-${n.replace(/\W+/g, "_").slice(0,20)}.png` }); } catch (e) { console.log("skip", n); }
  }
}
test("shots caresitters carer + family", async ({ browser }) => {
  for (const side of ["family", "carer"]) {
    const user = await createUser(newTestEmail(side));
    const other = await createUser(newTestEmail("o" + side));
    if (side === "family") await seedCarer(other.uid, { photoUrl: PHOTO, card: { age: 29, experienceYears: 5, careTypes: ["nanny"] } }); else await seedProfile(other.uid, { side: "family", photoUrl: PHOTO });
    if (side === "carer") await seedCarer(user.uid); else await seedProfile(user.uid, { side: "family" });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${CARESITTERS_URL}/?emu=1`);
    await signIn(page, user, undefined, { side });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/cr-${side}-after-signin.png` });
    const skip = page.getByRole("button", { name: "Skip", exact: true });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await tabs(page, `cr-${side}`);
    await page.getByRole("button", { name: "Discover", exact: false }).first().click({ force: true });
    for (const y of [700, 1400, 2100]) { await page.evaluate((yy) => { document.querySelectorAll(".scroll").forEach(e => { e.scrollTop = yy; }); }, y); await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/cr-${side}-disc-${y}.png` }); }
    await ctx.close();
  }
});
test("shots carespace", async ({ browser }) => {
  const user = await createUser(newTestEmail("cs"));
  await seedProfile(user.uid, { side: "family" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${SECOND_APP_URL}/?emu=1`);
  await page.getByRole("button", { name: "Continue with email", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/cs-after-signin.png` });
  const setup = page.getByRole("button", { name: "Set up my Care Space" });
  if (await setup.isVisible().catch(() => false)) { await setup.click(); await page.waitForTimeout(2500); await page.screenshot({ path: `${OUT}/cs-setup.png` }); const back = page.getByRole("button", { name: /Back/ }).first(); if (await back.isVisible().catch(() => false)) { await back.click(); await page.waitForTimeout(2500); } }
  await tabs(page, "cs2");
  await ctx.close();
});
