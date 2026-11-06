import { test, expect, CARESITTERS_URL, createUser, seedCarer, signIn, readDocument } from "../lib.mjs";
import path from "node:path";
const PHOTO = path.resolve(import.meta.dirname, "../fixtures/photo-with-gps.jpg");
const RESUME = path.resolve(import.meta.dirname, "../fixtures/resume.pdf");

test("carer: app switcher, photos, resume without phone number, view my profile", async ({ page }) => {
  const user = await createUser(`carerprofile-${Date.now()}@example.test`);
  await seedCarer(user.uid);
  await page.goto(`${CARESITTERS_URL}/?emu=1`);
  await page.addInitScript(() => { localStorage.setItem("caresits-tour-done","1"); window.__opened = []; window.__ccOpenHook = (u) => window.__opened.push(u); });
  await page.reload();
  await signIn(page, user);
  // 1. Switcher on top opens the sister app
  const sw = page.locator(".topbar-switch");
  await expect(sw).toBeVisible();
  await sw.click();
  const opened = await page.evaluate(() => window.__opened);
  expect(opened.length).toBe(1); expect(opened[0]).toMatch(/^carespace:\/\//);
  await page.screenshot({ path: "/home/user/shots/pr-1-topbar.png" });
  // 2. Me tab
  await page.locator("nav.tabs").getByText("Me", { exact: true }).click();
  await expect(page.getByRole("button", { name: "View my profile" })).toBeVisible();
  // 3. Photos
  await page.getByText("My photos", { exact: true }).click();
  await page.getByLabel("Choose a photo").setInputFiles(PHOTO);
  await expect(page.locator('[data-testid="my-photos"] img')).toHaveCount(1, { timeout: 20_000 });
  await page.getByLabel("Choose a photo").setInputFiles(PHOTO);
  await expect(page.locator('[data-testid="my-photos"] img')).toHaveCount(2, { timeout: 20_000 });
  await page.getByRole("button", { name: "Make main" }).click();
  await expect(page.getByText("Main photo", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/home/user/shots/pr-2-photos.png" });
  const card = (await readDocument(`profiles/${user.uid}`)).card;
  expect(card.gallery.length).toBe(2); expect(card.mainPhotoIndex).toBe(1);
  await page.getByRole("button", { name: /back/i }).first().click();
  // 4. Resume from a real PDF
  await page.getByText("My resume", { exact: true }).click();
  await page.getByLabel("Resume file").setInputFiles(RESUME);
  await expect(page.getByLabel("About you")).toHaveValue(/calm nanny/i, { timeout: 20_000 });
  const all = await page.locator("textarea").evaluateAll((els) => els.map((e) => e.value).join("\n"));
  expect(all).not.toMatch(/0412|345 678|casey@example/);
  expect(all).toMatch(/Smith family/);
  await page.screenshot({ path: "/home/user/shots/pr-3-resume.png" });
  await page.getByRole("button", { name: "Save resume" }).click();
  await expect.poll(async () => (await readDocument(`profiles/${user.uid}/resume/main`))?.jobs?.length ?? 0, { timeout: 15_000 }).toBeGreaterThan(0);
  // 5. View my profile shows resume, photos, reviews
  await page.getByRole("button", { name: "View my profile" }).click();
  await expect(page.getByTestId("resume-view")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("resume-view")).toContainText("Not checked by us");
  await expect(page.getByTestId("resume-view")).not.toContainText("0412");
  await expect(page.getByText("Smith family").first()).toBeVisible();
  await expect(page.getByTestId("profile-chips")).toBeVisible();
  await expect(page.getByTestId("mini-map")).toBeVisible();
  expect(await page.content()).not.toMatch(/-27\.4698|153\.0251/);
  await page.screenshot({ path: "/home/user/shots/pr-4-viewprofile.png", fullPage: false });
});
