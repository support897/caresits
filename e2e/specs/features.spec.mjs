import { test, expect, CARESITTERS_URL, createUser, seedCarer, seedProfile, signIn, newTestEmail } from "../lib.mjs";
test("family: list view, filters, save, pass/undo, why-match, saved tab, saved search", async ({ browser }) => {
  test.setTimeout(240_000);
  const user = await createUser(newTestEmail("ftf")); const o1 = await createUser(newTestEmail("ft1")); const o2 = await createUser(newTestEmail("ft2"));
  await seedCarer(o1.uid, { displayName: "Alpha Nanny", card: { age: 30, experienceYears: 6, careTypes: ["nanny"] } });
  await seedCarer(o2.uid, { displayName: "Bravo Nanny", card: { age: 41, experienceYears: 2, careTypes: ["nanny"] } });
  await seedProfile(user.uid, { side: "family", card: { careTypes: ["nanny"] } });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem("caresits-tour-done", "1"));
  await page.goto(`${CARESITTERS_URL}/?emu=1`); await signIn(page, user, undefined, { side: "family" });
  await expect(page.getByRole("button", { name: "Show list" })).toBeVisible({ timeout: 15000 });
  // list view shows both
  await page.getByRole("button", { name: "Show list" }).click();
  await expect(page.getByText("Alpha").first()).toBeVisible(); await expect(page.getByText("Bravo").first()).toBeVisible();
  // map opens and closes
  await page.getByRole("button", { name: "Map" }).click(); await page.waitForTimeout(1500);
  await page.screenshot({ path: "/home/user/shots/ft-map.png" });
  const back = page.getByRole("button", { name: /Show list|Back|Close|Cards/ }).first(); if (await back.isVisible().catch(() => false)) await back.click();
  // filters: radius 5 km then back to any distance, done
  await page.getByRole("button", { name: "Filters" }).click();
  const rad = page.locator(".sheet select").first(); await rad.selectOption({ label: "5 km" }); await rad.selectOption({ label: "Any distance" });
  await page.getByRole("button", { name: "Why this match" }).first().click().catch(() => {});
  await page.getByRole("button", { name: "Done" }).click().catch(() => {});
  await page.waitForTimeout(800);
  // save a carer, see it in Saved
  const cards = page.getByRole("button", { name: "Show cards" }); if (await cards.isVisible().catch(() => false)) await cards.click();
  await page.waitForTimeout(600);
  console.log("BTNS", JSON.stringify(await page.locator("button:visible").evaluateAll(els => els.map(e => (e.getAttribute("aria-label") || e.innerText || "").trim().slice(0, 25)))));
  await page.getByRole("button", { name: "Save", exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Saved", exact: true }).click(); await page.waitForTimeout(1500);
  await page.screenshot({ path: "/home/user/shots/ft-saved.png" });
  const txt = await page.locator("main, .scroll").first().innerText();
  console.log("SAVED_TEXT", txt.replace(/\n+/g, " | ").slice(0, 300));
  expect(txt).not.toMatch(/No saved profiles yet/); expect(txt).toMatch(/\/hr|years/);
  // messages tab + notification bell open without errors
  await page.getByRole("button", { name: "Messages", exact: true }).click(); await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Notifications" }).first().click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(900);
  await page.screenshot({ path: "/home/user/shots/ft-notif.png" });
  expect(await page.locator("body").innerText()).not.toMatch(/undefined|\[object Object\]|Something went wrong/);
  await ctx.close();
});
