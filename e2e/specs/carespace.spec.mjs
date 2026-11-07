import { test, expect, SECOND_APP_URL, createUser, newTestEmail } from "../lib.mjs";

async function csSignIn(browser, user) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${SECOND_APP_URL}/?emu=1`);
  const em = page.getByRole("button", { name: "Continue with email", exact: true });
  await em.click({ timeout: 20_000 });
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0, { timeout: 25_000 });
  return { ctx, page };
}
const text = (p) => p.locator("body").innerText();

test("CareSpace parent: start a space, open it, add a child, invite a helper", async ({ browser }) => {
  test.setTimeout(240_000);
  const parent = await createUser(newTestEmail("csp"));
  const { page } = await csSignIn(browser, parent);
  await page.waitForTimeout(2500); await page.screenshot({ path: "/home/user/scratch/cs-01-welcome.png" });
  await page.getByRole("button", { name: "Set up my Care Space" }).click({ timeout: 20_000 });
  await page.waitForTimeout(3000); await page.screenshot({ path: "/home/user/scratch/cs-02-after-start.png" });
  console.log("AFTER_START:", (await text(page)).replace(/\n+/g, " | ").slice(0, 500));
  await page.getByRole("button", { name: "Create invite link and code" }).click({ timeout: 20_000 });
  await expect(page.getByText("Invite ready")).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "/home/user/scratch/cs-03-invite.png" });
  const code = await page.evaluate(() => { const m = document.body.innerText.match(/[A-Za-z0-9]{8,}\.[A-Za-z0-9]{4,}/); return m ? m[0] : ""; });
  console.log("INVITE_CODE_FOUND:", Boolean(code));
  expect(code).toBeTruthy();
  await page.getByRole("button", { name: /Back/ }).first().click().catch(() => undefined);
  await page.locator(".tabs .tab", { hasText: "Care" }).click();
  await page.waitForTimeout(2000); await page.screenshot({ path: "/home/user/scratch/cs-care.png" }); console.log("CARE:", (await text(page)).replace(/\n+/g, " | ").slice(0, 500));
  await page.getByRole("button", { name: /My family/ }).first().click();
  await page.getByRole("button", { name: "Add a child" }).click({ timeout: 15_000 });
  await page.getByLabel("Name or nickname").fill("Riley");
  await page.getByLabel("Age in years").fill("3");
  await page.getByRole("button", { name: "Save child" }).click();
  await expect(page.getByText("Riley").first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "/home/user/scratch/cs-02b-child.png" });
  // helper joins with the code
  const helper = await createUser(newTestEmail("csh"));
  const h = await csSignIn(browser, helper);
  await h.page.waitForTimeout(2000);
  const skip = h.page.getByRole("button", { name: /do this later/ }); if (await skip.count()) await skip.click();
  await h.page.getByRole("button", { name: "Join with code" }).click({ timeout: 20_000 });
  const dlg = h.page.locator("input[placeholder], input").last();
  await h.page.waitForTimeout(1200);
  await h.page.getByLabel("Invite code or link").fill(code);
  await h.page.getByRole("button", { name: "Join care space" }).click({ timeout: 15_000 });
  await h.page.waitForTimeout(3500);
  await h.page.screenshot({ path: "/home/user/scratch/cs-05-joined.png" });
  await expect(h.page.getByText("My family").first()).toBeVisible();
  await h.page.getByPlaceholder(/What happened/).fill("Ate all lunch");
  await h.page.getByRole("button", { name: "Meal", exact: true }).click();
  await h.page.waitForTimeout(500);
  await h.page.waitForTimeout(2500);
  await h.page.screenshot({ path: "/home/user/scratch/cs-06-posted.png" });
  console.log("HELPER_AFTER_POST:", (await text(h.page)).replace(/\n+/g, " | ").slice(0, 600));
  await h.page.getByRole("button", { name: "Chat", exact: true }).click();
  await h.page.waitForTimeout(1500);
  await h.page.screenshot({ path: "/home/user/scratch/cs-07-chat.png" });
  console.log("JOINED:", (await text(h.page)).replace(/\n+/g, " | ").slice(0, 400));
  await h.page.screenshot({ path: "/home/user/scratch/cs-04-join.png" });
  console.log("JOIN_SCREEN:", (await text(h.page)).replace(/\n+/g, " | ").slice(0, 500));
});
