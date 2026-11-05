import { test, expect, CARESITTERS_URL, SECOND_APP_URL, createUser, seedCarer, seedProfile, signIn, newTestEmail } from "../lib.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const AXE = readFileSync("/home/user/pw/node_modules/axe-core/axe.min.js", "utf8");
const found = [];
async function audit(page, label) {
  await page.waitForTimeout(900);
  const bg = await page.evaluate(() => [[195, 300], [195, 120], [20, 500], [370, 400]].map(([x, y]) => { let el = document.elementFromPoint(x, y); while (el) { const c = getComputedStyle(el).backgroundColor; if (c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c; el = el.parentElement; } return "rgb(255, 255, 255)"; }));
  for (const c of bg) if (!/^rgb\(255, 255, 255\)$|^rgb\(253, 227, 234\)$|^rgb\(255, 245, 248\)$|^rgb\(238, 247, 254\)$|^rgb\(255, 217, 102\)$/.test(c)) found.push({ label, html: "background " + c, msg: "not white/pastel" });
  await page.evaluate(AXE);
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["color-contrast"] })).violations.flatMap((v) => v.nodes.map((n) => ({ html: n.html.slice(0, 110), msg: (n.any[0]?.message || "").slice(0, 120) }))));
  for (const v of r) found.push({ label, ...v });
}
test("contrast on main screens, both roles, light and dark", async ({ browser }) => {
  test.setTimeout(240_000);
  for (const side of ["family", "carer"]) for (const scheme of ["light", "dark"]) {
    const user = await createUser(newTestEmail(side)); const other = await createUser(newTestEmail("o"));
    if (side === "family") await seedCarer(other.uid, { card: { age: 30, experienceYears: 4 } }); else await seedProfile(other.uid, { side: "family" });
    if (side === "carer") await seedCarer(user.uid); else await seedProfile(user.uid, { side: "family" });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem("caresits-tour-done", "1"));
    await page.goto(`${CARESITTERS_URL}/?emu=1`);
    await signIn(page, user, undefined, { side });
    await audit(page, `${side}-${scheme}-discover`);
    for (const tab of ["Saved", "Bookings", "Messages"]) { await page.locator("nav.tabs").getByText(tab, { exact: true }).click(); await audit(page, `${side}-${scheme}-${tab}`); }
    await page.locator("nav.tabs button").last().click(); await audit(page, `${side}-${scheme}-me`);
    await ctx.close();
  }
  writeFileSync("/home/user/scratch/contrast.json", JSON.stringify(found, null, 1));
  console.log("CONTRAST_COUNT", found.length);
});
