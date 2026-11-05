import { test, expect, CARESITTERS_URL, newTestEmail, signIn } from "../lib.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
const PHOTO = path.resolve(import.meta.dirname, "../fixtures/photo-with-gps.jpg");
const hasExif = (b) => b.includes(Buffer.from("Exif\0\0", "latin1"));
test("carer uploads a profile photo: location data removed, stored privately, shown back", async ({ page }) => {
  expect(hasExif(readFileSync(PHOTO))).toBe(true); // fixture really carries GPS/EXIF
  await page.goto(`${CARESITTERS_URL}/?emu=1`);
  await signIn(page, newTestEmail("carerphoto"), "E2e-Carer-Password-2026!", { side: "carer" });
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Casey Carer");
  await page.getByPlaceholder("For example, New Farm").fill("New Farm");
  await page.getByPlaceholder("4005").fill("4005");
  await page.getByLabel("Choose a profile photo file").setInputFiles(PHOTO);
  await expect(page.getByText("Saving your photo…")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
  const store = await (await fetch("http://127.0.0.1:9199/_store")).json();
  const key = store.keys.find((k) => /^users\/[^/]+\/photos\/avatar-[A-Za-z0-9_-]+\.jpg$/.test(k));
  expect(key, "photo stored under the user's private photos path").toBeTruthy();
  const bytes = Buffer.from(await (await fetch(`http://127.0.0.1:9199/get?key=${encodeURIComponent(key)}`)).arrayBuffer());
  expect(bytes[0]).toBe(0xff); expect(hasExif(bytes)).toBe(false);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/home/user/shots/upload-carer-photo.png" });
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();
  await page.locator(".onb-actions").getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator(".onb-photo-frame img")).toBeVisible({ timeout: 15_000 });
});
