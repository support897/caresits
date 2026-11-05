import { test, expect, CARESITTERS_URL, SECOND_APP_URL, createUser, seedCarer, seedProfile, signIn, newTestEmail } from "../lib.mjs";
import { writeFileSync } from "node:fs";
const small = [];
async function sweep(page, label) {
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const over = document.documentElement.scrollWidth > window.innerWidth + 1;
    const tiny = [...document.querySelectorAll("button, a[href], [role=tab], input:not([type=hidden]), select, textarea")].filter((e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && (b.height < 40 || b.width < 40) && !e.closest("[aria-hidden=true]") && e.type !== "checkbox" && e.type !== "radio" && e.type !== "file"; }).map((e) => `${e.tagName}:${(e.getAttribute("aria-label") || e.innerText || "").trim().slice(0, 30)}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
    return { over, tiny };
  });
  if (r.over) small.push(`${label}: horizontal scroll`);
  for (const t of r.tiny) small.push(`${label}: small target ${t}`);
}
test("bunny stops with reduced motion", async ({ browser }) => {
  const count = async (page) => page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && (a.effect?.target?.closest?.("[class*=bunny], [class*=Bunny], svg") ?? null)).length);
  const mk = async (rm) => { const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: rm }); const p = await c.newPage(); await p.goto(`${CARESITTERS_URL}/?emu=1`); await p.waitForTimeout(1500); return p; };
  const moving = await mk("no-preference"); const still = await mk("reduce");
  const a = await count(moving), b = await count(still);
  console.log("BUNNY_ANIMS moving", a, "reduced", b);
  expect(a).toBeGreaterThan(0); expect(b).toBe(0);
});
test("320px: no sideways scroll; touch targets", async ({ browser }) => {
  test.setTimeout(240_000);
  for (const side of ["family", "carer"]) {
    const user = await createUser(newTestEmail("pol" + side)); const other = await createUser(newTestEmail("po"));
    if (side === "family") { await seedCarer(other.uid, { displayName: "Olly Other" }); await seedProfile(user.uid, { side: "family" }); } else { await seedProfile(other.uid, { side: "family" }); await seedCarer(user.uid); }
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 } }); const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem("caresits-tour-done", "1"));
    await page.goto(`${CARESITTERS_URL}/?emu=1`); await sweep(page, `${side}-welcome`);
    await signIn(page, user, undefined, { side });
    await sweep(page, `${side}-discover`);
    for (const tab of ["Saved", "Bookings", "Messages"]) { await page.locator("nav.tabs").getByText(tab, { exact: true }).click(); await sweep(page, `${side}-${tab}`); }
    await page.locator("nav.tabs button").last().click(); await sweep(page, `${side}-me`);
    await ctx.close();
  }
  const cs = await createUser(newTestEmail("polcs")); await seedProfile(cs.uid, { side: "family" });
  const c2 = await browser.newContext({ viewport: { width: 320, height: 640 } }); const p2 = await c2.newPage();
  await p2.addInitScript(() => localStorage.setItem("caresits-tour-done", "1"));
  await p2.goto(`${SECOND_APP_URL}/?emu=1`);
  await p2.getByRole("button", { name: "Continue with email", exact: true }).click();
  await p2.getByLabel("Email", { exact: true }).fill(cs.email); await p2.getByLabel("Password", { exact: true }).fill(cs.password);
  await p2.getByRole("button", { name: "Continue", exact: true }).click(); await p2.waitForTimeout(3000);
  await sweep(p2, "cs-chats");
  for (const tab of ["Calendar", "Care", "Activities", "Profile"]) { await p2.locator("nav.tabs").getByText(tab, { exact: true }).click(); await sweep(p2, `cs-${tab}`); }
  writeFileSync("/home/user/scratch/polish.txt", small.join("\n"));
  console.log("POLISH_COUNT", small.length);
});
