import { test, expect, CARESITTERS_URL, createUser, seedCarer, seedProfile, signIn, newTestEmail } from "../lib.mjs";
test("world map: pins worldwide, blurred, like from the map, bunny speaks", async ({ browser }) => {
  test.setTimeout(150_000);
  const fam = await createUser(newTestEmail("mapf"));
  await seedProfile(fam.uid, { side: "family" });
  const spots = [["Syd", -33.8688, 151.2093], ["Lon", 51.5072, -0.1276], ["Nyc", 40.7128, -74.006]];
  for (const [name, lat, lng] of spots) { const u = await createUser(newTestEmail("mapc")); await seedCarer(u.uid, { displayName: `Map ${name}`, card: { lat, lng, suburb: name, headline: "Hi" } }); }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem("caresits-tour-done", "1"));
  await page.goto(`${CARESITTERS_URL}/?emu=1`);
  await signIn(page, fam, undefined, { side: "family" });
  await page.getByRole("button", { name: "Map", exact: true }).click();
  const map = page.getByTestId("world-map"); await expect(map).toBeVisible();
  await page.waitForTimeout(800);
  const pins = map.locator('g.wm-pin[role=button]'); const n = await pins.count();
  console.log("MAP_PINS", n); expect(n).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: "/home/user/shots/map-world.png" });
  await map.getByRole("button", { name: "Zoom in", exact: true }).click(); await map.getByRole("button", { name: "Zoom out", exact: true }).click();
  await pins.first().click({ force: true });
  const like = page.getByRole("button", { name: "Save", exact: true }); await expect(like).toBeVisible();
  await page.screenshot({ path: "/home/user/shots/map-selected.png" });
  await like.click(); await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("bunny-agent").locator(".agent-bubble")).toBeVisible({ timeout: 8000 });
  // privacy: no raw coordinates anywhere in the page text or attributes
  const html = await page.content(); expect(html).not.toMatch(/-33\.8688|51\.5072|40\.7128/);
  await page.screenshot({ path: "/home/user/shots/map-liked.png" });
});
