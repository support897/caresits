import { test, expect, CARESITTERS_URL, createSecondUserContext, newTestEmail, readDocument, signIn } from "../lib.mjs";

function currentUid(page) {
  return page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("firebase:authUser:")) continue;
      try { return JSON.parse(localStorage.getItem(key) ?? "{}").uid ?? null; } catch { return null; }
    }
    return null;
  });
}

test("email signup builds a saved family profile and signs out cleanly", async ({ page, browser }) => {
  const email = newTestEmail("family");
  const password = "E2e-Family-Password-2026!";
  await page.goto(`${CARESITTERS_URL}/?emu=1`);
  await signIn(page, email, password);
  await expect(page.getByRole("heading", { name: "Your family", exact: true })).toBeVisible();

  await page.getByLabel("Your name", { exact: true }).fill("Maya Family");
  await page.getByPlaceholder("For example, New Farm").fill("New Farm");
  await page.getByPlaceholder("4005").fill("4005");
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Children", exact: true })).toBeVisible();
  await page.getByLabel("Child first name or nickname", { exact: true }).fill("Riley Jones");
  await page.getByLabel("Child age in years", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Care type", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Babysitter/ }).click();
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Your schedule", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mon", exact: true }).click();
  await page.locator('input[type="time"]').nth(0).fill("08:00");
  await page.locator('input[type="time"]').nth(1).fill("15:00");
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Your budget", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /A\$35\/hour/ }).click();
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "How far to look", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /20 km/ }).click();
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "What matters to you?", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Montessori", exact: true }).click();
  await page.getByRole("button", { name: "reading", exact: true }).click();
  await page.getByRole("button", { name: "Spanish", exact: true }).click();
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();
  await page.getByRole("button", { name: "Finish profile", exact: true }).click();

  const skipTour = page.getByRole("button", { name: "Skip", exact: true });
  await expect(skipTour).toBeVisible({ timeout: 15_000 });
  await skipTour.click();
  await expect(page.getByRole("button", { name: "My family", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Continue with email", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "My family", exact: true }).click();
  await expect(page.getByText("Maya Family", { exact: true })).toBeVisible();

  const uid = await currentUid(page);
  expect(uid).toBeTruthy();
  const savedProfile = await readDocument(`profiles/${uid}`);
  expect(savedProfile).toMatchObject({
    side: "family",
    displayName: "Maya Family",
    postcode: "4005",
    card: {
      suburb: "New Farm",
      kids: [{ name: "Riley", ageYears: 3 }],
      careTypes: ["babysitter"],
      budgetMax: 35,
      maxDistanceKm: 20,
      style: ["Montessori"],
      activities: ["reading"],
      languages: ["Spanish"],
    },
  });

  await page.reload();
  await expect(page.getByRole("button", { name: "My family", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Continue with email", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "My family", exact: true }).click();
  await expect(page.getByText("Maya Family", { exact: true })).toBeVisible();

  const second = await createSecondUserContext(browser, { side: "carer" });
  try {
    await expect(second.page.getByRole("button", { name: "Discover", exact: true })).toBeVisible();
    await expect(second.page.getByRole("button", { name: "Continue with email", exact: true })).toHaveCount(0);
    const checkRecord = await readDocument(`verified/${second.user.uid}`);
    expect(checkRecord).toMatchObject({ level: "working-with-children", verifiedBy: "e2e-emulator-admin-fixture" });

    await page.getByRole("button", { name: "My family", exact: true }).click();
    await page.getByRole("button", { name: /^Settings/ }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("button", { name: "Continue with email", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(second.page.getByRole("button", { name: "Continue with email", exact: true })).toHaveCount(0);
  } finally {
    await second.context.close();
  }
});
