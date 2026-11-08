import { test, expect, SECOND_APP_URL, createUser, newTestEmail } from "../lib.mjs";
test("CareSpace calendar: add an event and open shift and time-off forms", async ({ browser }) => {
  test.setTimeout(240_000);
  const parent = await createUser(newTestEmail("cs2"));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
  await page.goto(`${SECOND_APP_URL}/?emu=1`);
  await page.getByRole("button", { name: "Continue with email", exact: true }).click({ timeout: 20000 });
  await page.getByLabel("Email", { exact: true }).fill(parent.email); await page.getByLabel("Password", { exact: true }).fill(parent.password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Set up my Care Space" }).click({ timeout: 25000 }); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Create invite link and code" }).click({ timeout: 20000 }); await expect(page.getByText("Invite ready")).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: /Back/ }).first().click().catch(() => undefined);
  await page.locator(".tabs .tab", { hasText: "Care" }).click(); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /My family/ }).first().click();
  await page.getByRole("button", { name: "Add a child" }).click({ timeout: 15000 });
  await page.getByLabel("Name or nickname").fill("Riley"); await page.getByLabel("Age in years").fill("3"); await page.getByRole("button", { name: "Save child" }).click();
  await expect(page.getByText("Riley").first()).toBeVisible({ timeout: 15000 });
  await page.locator(".tabs .tab", { hasText: "Calendar" }).click(); await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await page.getByLabel("Event name").fill("Swim class");
  await page.getByRole("button", { name: "Save changes" }).click(); await page.waitForTimeout(1500);
  await expect(page.getByText("Swim class").first()).toBeVisible({ timeout: 8000 });
  for (const b of ["Add shift", "Request time off"]) {
    await page.getByRole("button", { name: b, exact: true }).click(); await page.waitForTimeout(900);
    await page.getByRole("button", { name: /Back/ }).first().click().catch(() => {}); await page.waitForTimeout(500);
  }
});
