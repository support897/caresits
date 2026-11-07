import { test, expect, CARESITTERS_URL, createUser, seedCarer, seedProfile, signIn, newTestEmail } from "../lib.mjs";
test("phone in dark mode and old dark setting: app stays white", async ({ browser }) => {
  test.setTimeout(120_000);
  const user = await createUser(newTestEmail("dk")); const other = await createUser(newTestEmail("dko"));
  await seedCarer(other.uid, { displayName: "Olly Other" }); await seedProfile(user.uid, { side: "family" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.addInitScript(() => { localStorage.setItem("caresits-tour-done", "1"); localStorage.setItem("caresits-theme-mode", "dark"); });
  await page.goto(`${CARESITTERS_URL}/?emu=1`);
  await signIn(page, user, undefined, { side: "family" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/home/user/shots/dark-proof.png" });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const theme = await page.evaluate(() => document.body.dataset.theme);
  console.log("DARKPROOF", bg, theme);
  expect(bg).toBe("rgb(255, 251, 242)"); expect(theme).toBe("light");
});
