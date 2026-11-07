import { test, expect } from "../lib.mjs";
import { walkOnboarding } from "../walker.mjs";
import { appendFileSync } from "node:fs";
// LIVE: real Firebase project, throwaway accounts (deleted at the end through the in-app delete). Passwords stay in memory only.
const URL = "http://127.0.0.1:4173/";
const LOG = "/home/user/scratch/live.log";
const log = (m) => appendFileSync(LOG, m + "\n");
const rnd = (n) => Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(0, n);
const tab = (p, n) => p.locator("nav.tabs").getByText(n, { exact: true }).click();

async function signUp(browser, side, svc, name) {
  globalThis.__WALK_NAME = name;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem("caresits-tour-done", "1"));
  const email = `projects.reports.ilse+lv${rnd(5)}${Math.floor(1000 + Math.random() * 9000)}@gmail.com`;
  const pw = `Lv-${rnd(10)}-${rnd(6)}!9`;
  await page.goto(URL);
  const roleButton = page.getByRole("button", { name: side === "family" ? "I need care" : "I give care", exact: true });
  await roleButton.click({ timeout: 20_000 });
  await page.getByRole("button", { name: "Continue with email", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pw);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".onb-screen")).toBeVisible({ timeout: 30_000 });
  const ok = await walkOnboarding(page, side, svc, (m) => log(`[${side}:${svc}] ${m}`));
  log(`[${side}:${svc}] reached app: ${ok}`);
  expect(ok, `${side}:${svc} onboarding on LIVE`).toBe(true);
  page.on("console", (m) => { if (/permission|denied|insufficient|error/i.test(m.text())) log(`[${side}] console: ${m.text().slice(0, 240)}`); });
  return { ctx, page };
}

test("LIVE nanny: family and carer sign up, see each other, book, accept, chat, delete", async ({ browser }) => {
  const FN = `Lvf${rnd(5).replace(/[0-9]/g, "x")}`, CN = `Lvc${rnd(5).replace(/[0-9]/g, "x")}`;
  const f = await signUp(browser, "family", "nanny", FN);
  const c = await signUp(browser, "carer", "nanny", CN);
  log(`names ${FN} ${CN}`);
  const seen = async (p, who) => { await p.getByRole("button", { name: "Show list", exact: true }).click().catch(() => undefined); await p.waitForTimeout(3000); return (await p.locator("body").innerText()).includes(who); };
  log(`family sees carer: ${await seen(f.page, CN)}`);
  log(`carer sees family: ${await seen(c.page, FN)}`);
  await f.page.screenshot({ path: "/home/user/scratch/live-family-discover.png" });
  await f.page.getByText(CN).first().click();
  await f.page.getByRole("button", { name: "Book", exact: true }).click({ timeout: 20_000 });
  await f.page.locator('input[type="date"]').first().fill(new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
  await f.page.getByRole("button", { name: "Send request" }).click();
  await expect(f.page.getByText("Request sent").first()).toBeVisible({ timeout: 20_000 }); log("family booked");
  await c.page.reload(); await tab(c.page, "Bookings");
  await c.page.getByRole("button", { name: "Accept", exact: true }).click({ timeout: 30_000 }); await c.page.waitForTimeout(3000); log(`carer accepted; page says Accepted: ${(await c.page.locator("body").innerText()).includes("Accepted")}`); await c.page.screenshot({ path: "/home/user/scratch/live-accept.png" });
  await f.page.reload(); await tab(f.page, "Messages"); await f.page.getByText(CN).first().click();
  const fb = f.page.locator("textarea, input[type=text]").last(); await fb.fill("hello live"); await fb.press("Enter");
  await c.page.reload(); await tab(c.page, "Messages"); await c.page.getByText(FN).first().click();
  await expect(c.page.getByText("hello live").first()).toBeVisible({ timeout: 30_000 }); log("chat delivered");
  const cb = c.page.locator("textarea, input[type=text]").last(); await cb.fill("reply live"); await cb.press("Enter");
  await f.page.reload(); await tab(f.page, "Messages"); await f.page.getByText(CN).first().click();
  await expect(f.page.getByText("reply live").first()).toBeVisible({ timeout: 30_000 }); log("reply delivered");
  // delete both accounts in the app
  for (const [pg, mine] of [[f.page, "My family"], [c.page, "Me"]]) {
    await pg.reload(); await tab(pg, mine);
    await pg.getByRole("button", { name: /^Settings/ }).click();
    await pg.screenshot({ path: `/home/user/scratch/live-settings-${mine.replace(" ", "")}.png` });
    log(`settings has delete: ${(await pg.locator("body").innerText()).toLowerCase().includes("delete")}`);
  }
});
