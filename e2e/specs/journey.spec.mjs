import { test, expect, CARESITTERS_URL, createUser, seedCarer, seedProfile, signIn, newTestEmail, writeDocument } from "../lib.mjs";
const skipTour = (p) => p.addInitScript(() => localStorage.setItem("caresits-tour-done", "1"));
const day = (n) => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10); };
const pairIdFor = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
const tab = (p, name) => p.locator("nav.tabs").getByText(name, { exact: true }).click();

test("customer journey: swipe, save, book, accept, connect, chat, complete, review, usual carer, earnings", async ({ browser }) => {
  test.setTimeout(240_000);
  const fam = await createUser(newTestEmail("jfam"));
  const car = await createUser(newTestEmail("jcar"));
  await seedProfile(fam.uid, { side: "family", displayName: "Frankie Family" });
  await seedCarer(car.uid, { displayName: "Casey Carer", card: { age: 29, experienceYears: 5 } });
  const widths = [320, 360, 390];
  const fctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const f = await fctx.newPage(); await skipTour(f);
  await f.goto(`${CARESITTERS_URL}/?emu=1`);
  await signIn(f, fam, undefined, { side: "family" });
  // 1. swipe deck is home
  await expect(f.getByRole("button", { name: "Save", exact: true })).toBeVisible({ timeout: 20_000 });
  await f.waitForTimeout(1500); await f.screenshot({ path: "/home/user/shots/j0-deck-start.png" });
  for (let i = 0; i < 12 && !(await f.locator(".deck-card:has(.deck-stamp)").innerText().then((t) => t.includes("Casey")).catch(() => false)); i++) { await f.getByRole("button", { name: "Pass", exact: true }).click({ timeout: 3000 }).catch(async () => { await f.screenshot({ path: "/home/user/shots/j0-deck-stuck.png" }); throw new Error("deck stuck"); }); await f.waitForTimeout(500); }
  await expect(f.getByText("Casey").first()).toBeVisible({ timeout: 10_000 });
  for (const w of widths) { await f.setViewportSize({ width: w, height: 760 }); await f.waitForTimeout(400); await f.screenshot({ path: `/home/user/shots/j1-deck-${w}.png` }); expect(await f.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true); }
  await f.setViewportSize({ width: 390, height: 844 });
  await f.getByRole("button", { name: "Save", exact: true }).click();
  await f.waitForTimeout(900);
  // 2. saved -> profile
  await tab(f, "Saved"); await f.waitForTimeout(1500); await f.screenshot({ path: "/home/user/shots/j2-saved.png" });
  await f.getByText("Casey").first().click();
  await expect(f.getByRole("button", { name: "Book", exact: true })).toBeVisible({ timeout: 15_000 });
  await f.screenshot({ path: "/home/user/shots/j2-profile.png" });
  await f.getByRole("button", { name: "Book", exact: true }).click();
  await f.locator('input[type="date"]').first().fill(day(2));
  await f.getByRole("button", { name: "Send request" }).click();
  await expect(f.getByText("Request sent").first()).toBeVisible({ timeout: 15_000 });
  await f.screenshot({ path: "/home/user/shots/j3-sent.png" });
  // 3. carer accepts
  const cctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const c = await cctx.newPage(); await skipTour(c);
  await c.goto(`${CARESITTERS_URL}/?emu=1`);
  await signIn(c, car, undefined, { side: "carer" });
  await tab(c, "Bookings");
  await expect(c.getByRole("button", { name: "Accept", exact: true })).toBeVisible({ timeout: 20_000 });
  await c.screenshot({ path: "/home/user/shots/j4-carer-request.png" });
  await c.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(c.getByText("Accepted").first()).toBeVisible({ timeout: 15_000 });
  // 4. family sees connected
  await f.reload(); await tab(f, "Bookings");
  await f.getByRole("button", { name: "View accepted booking" }).click({ timeout: 20_000 });
  await expect(f.getByText("You're connected").first()).toBeVisible({ timeout: 15_000 });
  await f.screenshot({ path: "/home/user/shots/j5-connected.png" });
  // 5. chat
  await f.reload(); await tab(f, "Messages");
  await f.getByText("Casey").first().click();
  const box = f.locator("textarea, input[type=text]").last();
  await box.fill("Hi Casey, see you soon!"); await box.press("Enter");
  await expect(f.getByText("Hi Casey, see you soon!").first()).toBeVisible({ timeout: 15_000 });
  await f.screenshot({ path: "/home/user/shots/j6-chat.png" });
  // 6. seeded past completed booking: review, usual carer, earnings
  const pair = pairIdFor(fam.uid, car.uid);
  await writeDocument(`relationships/${pair}/bookings/past1`, { familyUid: fam.uid, carerUid: car.uid, date: day(-3), from: "09:00", to: "12:00", endAt: new Date(Date.now() - 3 * 864e5), rate: 32, estimate: 96, recurring: "none", weekdays: [], childIds: [], shareAddress: false, state: "completed", createdBy: fam.uid, createdAt: new Date(Date.now() - 5 * 864e5) });
  await f.reload(); await tab(f, "Bookings");
  await expect(f.getByText("Book my usual carer").first()).toBeVisible({ timeout: 20_000 });
  await f.screenshot({ path: "/home/user/shots/j7-usual.png" });
  await f.getByRole("tab", { name: "Past" }).click();
  await f.getByRole("button", { name: "Leave a review" }).first().click({ timeout: 15_000 });
  await f.getByRole("button", { name: "5 out of 5 stars" }).click();
  await f.getByRole("button", { name: /save review|send review|^save$|submit/i }).first().click();
  await expect(f.getByText("You left a review for this booking.").first()).toBeVisible({ timeout: 15_000 });
  await f.screenshot({ path: "/home/user/shots/j8-review.png" });
  await c.reload(); await tab(c, "Bookings");
  await expect(c.getByText("$96").first()).toBeVisible({ timeout: 20_000 });
  await c.screenshot({ path: "/home/user/shots/j9-earnings.png" });
});
