import { test, expect, CARESITTERS_URL, createUser, seedCarer, seedProfile, signIn, newTestEmail } from "../lib.mjs";

// Six role tours: each shows its own copy, targets real controls, supports back/pause/resume/skip/replay, persists, and does not repeat.
const CASES = [
  ["family", "nanny", "nannies"], ["family", "babysitter", "babysitters"], ["family", "au_pair", "au pairs"],
  ["carer", "nanny", "families"], ["carer", "babysitter", "families"], ["carer", "au_pair", "host families"],
];
async function open(browser, user, side) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${CARESITTERS_URL}/?emu=1`);
  await signIn(page, user, undefined, { side });
  return { ctx, page };
}
for (const [side, svc, who] of CASES) {
  test(`tour ${side}:${svc}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const me = await createUser(newTestEmail("tr"));
    const card = { careTypes: [svc], lat: -27.465, lng: 153.025, suburb: "New Farm" };
    if (side === "carer") await seedCarer(me.uid, { displayName: `Tour ${svc}`, card }); else await seedProfile(me.uid, { side, displayName: `Tour ${svc}`, card });
    const { ctx, page } = await open(browser, me, side);
    const dlg = page.getByRole("dialog");
    await expect(dlg).toBeVisible({ timeout: 20_000 });
    await expect(dlg).toHaveAttribute("data-tour-role", `${side}:${svc}`);
    await expect(dlg.getByRole("heading")).toContainText(who);
    await dlg.getByRole("button", { name: "Next" }).click();
    await expect(dlg).toContainText("Narrow it down");
    await dlg.getByRole("button", { name: "Back" }).click();
    await expect(dlg.getByRole("heading")).toContainText(who);
    await dlg.getByRole("button", { name: "Next" }).click();
    await dlg.getByRole("button", { name: "Next" }).click();
    // pause, then resume at the same step
    const before = await dlg.getByRole("heading").innerText();
    await dlg.getByRole("button", { name: "Pause" }).click();
    await expect(dlg).toHaveCount(0);
    await page.getByRole("button", { name: "Resume guide" }).click();
    await expect(page.getByRole("dialog").getByRole("heading")).toHaveText(before);
    // reload: progress persists and tour resumes
    await page.reload();
    await expect(page.getByRole("dialog").getByRole("heading")).toHaveText(before, { timeout: 20_000 });
    // finish through the end
    for (let i = 0; i < 8; i++) {
      const done = page.getByRole("dialog").getByRole("button", { name: "Done" });
      if (await done.count()) { await done.click(); break; }
      await page.getByRole("dialog").getByRole("button", { name: "Next" }).click();
      await page.waitForTimeout(400);
    }
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // never repeats
    await page.reload();
    await page.waitForTimeout(2500);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await ctx.close();
  });
}

test("tour replay from Settings and skip stays skipped", async ({ browser }) => {
  test.setTimeout(120_000);
  const me = await createUser(newTestEmail("tp"));
  await seedProfile(me.uid, { side: "family", displayName: "Tour Replay", card: { careTypes: ["nanny"], suburb: "New Farm" } });
  const { ctx, page } = await open(browser, me, "family");
  await page.getByRole("dialog").getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload(); await page.waitForTimeout(2500);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /My family/ }).click();
  await page.getByText("Settings", { exact: true }).first().click();
  await page.getByRole("button", { name: "Replay guided tour" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  await ctx.close();
});

test("multi-service carer picks a tour first", async ({ browser }) => {
  test.setTimeout(90_000);
  const me = await createUser(newTestEmail("tm"));
  await seedCarer(me.uid, { displayName: "Tour Multi", card: { careTypes: ["nanny", "au_pair"], suburb: "New Farm" } });
  const { ctx, page } = await open(browser, me, "carer");
  await expect(page.getByRole("dialog")).toContainText("Which guide");
  await page.getByRole("dialog").getByRole("button", { name: /Au pair/ }).click();
  await expect(page.getByRole("dialog")).toHaveAttribute("data-tour-role", "carer:au_pair");
  await ctx.close();
});
