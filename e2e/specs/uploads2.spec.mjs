import { test, expect, CARESITTERS_URL, SECOND_APP_URL, createUser, seedCarer, seedProfile, signIn, newTestEmail, writeDocument } from "../lib.mjs";
import path from "node:path";
const FX = (n) => path.resolve(import.meta.dirname, "../fixtures", n);
const keys = async () => (await (await fetch("http://127.0.0.1:9199/_store")).json()).keys;
const noTour = (p) => p.addInitScript(() => localStorage.setItem("caresits-tour-done", "1"));

test("carer uploads a qualification document (stored privately)", async ({ browser }) => {
  test.setTimeout(120_000);
  const u = await createUser(newTestEmail("qual")); await seedCarer(u.uid);
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await noTour(page);
  await page.goto(`${CARESITTERS_URL}/?emu=1`); await signIn(page, u, undefined, { side: "carer" });
  await page.locator("nav.tabs button").last().click();
  await page.getByText("Qualifications", { exact: false }).first().click();
  await page.locator('input[type="file"]').setInputFiles(FX("resume.pdf"));
  await page.getByRole("button", { name: "Upload document" }).click();
  await expect.poll(async () => (await keys()).some((k) => new RegExp(`^users/${u.uid}/documents/qual-[A-Za-z0-9_-]+\\.pdf$`).test(k)), { timeout: 20_000 }).toBe(true);
  await page.screenshot({ path: "/home/user/shots/u-qual.png" });
});

test("carer uploads an intro video (stored privately, preview shown)", async ({ browser }) => {
  test.setTimeout(150_000);
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await noTour(page);
  await page.goto(`${CARESITTERS_URL}/?emu=1`);
  await signIn(page, newTestEmail("vid"), "E2e-Carer-Password-2026!", { side: "carer" });
  await page.getByLabel("Your name", { exact: true }).fill("Vic Video");
  await page.getByPlaceholder("For example, New Farm").fill("New Farm");
  await page.getByPlaceholder("4005").fill("4005");
  const vid = page.locator('input[aria-label="Choose a video file"]');
  for (let i = 0; i < 14 && !(await vid.count()); i++) {
    for (const el of await page.locator("main input:not([type=file]):not([type=checkbox]):not([type=radio]):not([type=hidden]), main textarea").all()) {
      if (!(await el.isVisible()) || (await el.inputValue().catch(() => "x"))) continue;
      const t = (await el.getAttribute("type")) || "text";
      await el.fill(t === "number" ? "30" : "Calm after-school care").catch(() => {});
    }
    await page.getByRole("button", { name: /Save and continue|Continue|Next|Skip/ }).first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: "/home/user/shots/u-video-step.png" });
  await vid.setInputFiles(FX("intro.webm"));
  await expect.poll(async () => (await keys()).some((k) => /^users\/[^/]+\/videos\/intro-[A-Za-z0-9_-]+\.webm$/.test(k)), { timeout: 25_000 }).toBe(true);
  await expect(page.locator("video.onb-video-preview")).toBeVisible({ timeout: 15_000 });
});

test("carespace: today photo, gallery photo, chat photo", async ({ browser }) => {
  test.setTimeout(180_000);
  const u = await createUser(newTestEmail("csup")); await seedProfile(u.uid, { side: "family" });
  const now = new Date().toISOString();
  await writeDocument(`careSpaces/${u.uid}`, { ownerUid: u.uid, name: "Test family", createdAt: now });
  await writeDocument(`careSpaces/${u.uid}/members/${u.uid}`, { role: "admin", status: "active", perms: { allergies: true, medication: true, photos: true, calendar: true, privateMessages: true }, displayName: "Frankie", joinedAt: now, invitedBy: u.uid });
  await writeDocument(`users/${u.uid}/spaces/${u.uid}`, { spaceId: u.uid, name: "Test family", memberRole: "admin", joinedAt: now });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await noTour(page);
  await page.goto(`${SECOND_APP_URL}/?emu=1`);
  await page.getByRole("button", { name: "Continue with email", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Open family space" }).click();
  const count = async (re) => (await keys()).filter((k) => re.test(k)).length;
  // today / updates: add a photo
  await page.getByRole("button", { name: "Updates", exact: true }).click().catch(() => {});
  const before = await count(/^spaces\//);
  await page.locator('input[type="file"]').first().setInputFiles(FX("photo-with-gps.jpg"));
  await expect.poll(() => count(/^spaces\//), { timeout: 20_000 }).toBeGreaterThan(before);
  await page.screenshot({ path: "/home/user/shots/u-cs-today.png" });
  // chat: share a photo
  await page.getByRole("button", { name: "Chat", exact: true }).first().click();
  await page.waitForTimeout(1500); await page.screenshot({ path: "/home/user/shots/u-cs-chat.png" });
  const b3 = await count(/^spaces\/[^/]+\/gallery\//);
  await page.locator('input[type="file"]').last().setInputFiles(FX("photo-with-gps.jpg"));
  await expect.poll(() => count(/^spaces\/[^/]+\/gallery\//), { timeout: 20_000 }).toBeGreaterThan(b3);
  // gallery via Care tab
  await page.reload(); await page.waitForTimeout(2500);
  await page.locator("nav.tabs").getByText("Care", { exact: true }).click();
  await page.screenshot({ path: "/home/user/shots/u-cs-care.png" }); await page.locator("main, .scroll").getByText("Test family").first().click();
  await page.getByRole("button", { name: "Photos and videos" }).click();
  const b2 = await count(/^spaces\/[^/]+\/gallery\//);
  await page.locator('input[type="file"]').last().setInputFiles(FX("photo-with-gps.jpg"));
  await expect.poll(() => count(/^spaces\/[^/]+\/gallery\//), { timeout: 20_000 }).toBeGreaterThan(b2);
  await page.waitForTimeout(1200); await page.screenshot({ path: "/home/user/shots/u-cs-gallery.png" });
  const stored = await keys();
  const k = stored.find((x) => /^spaces\/[^/]+\/gallery\//.test(x));
  const bytes = Buffer.from(await (await fetch(`http://127.0.0.1:9199/get?key=${encodeURIComponent(k)}`)).arrayBuffer());
  expect(bytes.includes(Buffer.from("Exif\0\0", "latin1"))).toBe(false);
});
