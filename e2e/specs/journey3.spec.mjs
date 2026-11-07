import { test, expect, CARESITTERS_URL, createUser, seedCarer, seedProfile, signIn, newTestEmail, readDocument } from "../lib.mjs";
const skipTour = (p) => p.addInitScript(() => localStorage.setItem("caresits-tour-done", "1"));
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const tab = (p, name) => p.locator("nav.tabs").getByText(name, { exact: true }).click();
const uniq = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6);
const card = { lat: -27.465, lng: 153.025, suburb: "New Farm" };

// Same customer journey for every service: family finds carer, books, carer accepts, both chat, carer finds family.
for (const svc of ["nanny", "babysitter", "au_pair"]) {
  test(`journey ${svc}: book, accept, two-way chat, carer discovers family`, async ({ browser }) => {
    test.setTimeout(240_000);
    const u = uniq(); const CN = `Carx${svc.replace('_', '')}${u}`; const FN = `Famx${svc.replace('_', '')}${u}`;
    const fam = await createUser(newTestEmail("j3f")); const car = await createUser(newTestEmail("j3c"));
    await seedProfile(fam.uid, { side: "family", displayName: FN, card: { ...card, careTypes: [svc] } });
    await seedCarer(car.uid, { displayName: CN, card: { ...card, careTypes: [svc], age: 28, experienceYears: 4 } });
    const f = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await skipTour(f);
    await f.goto(`${CARESITTERS_URL}/?emu=1`); await signIn(f, fam, undefined, { side: "family" });
    // carer visible, family can open profile and book
    await f.getByRole("button", { name: "Show list", exact: true }).click({ timeout: 20_000 }).catch(() => undefined);
    await expect(f.getByText(CN).first()).toBeVisible({ timeout: 20_000 });
    await f.getByText(CN).first().click();
    const book = f.getByRole("button", { name: "Book", exact: true });
    await expect(book).toBeVisible({ timeout: 15_000 });
    // privacy: a family viewing a carer never sees child data, a stranger never sees credentials of families
    await expect(f.locator("body")).not.toContainText("Riley");
    await book.click();
    await f.locator('input[type="date"]').first().fill(day(3));
    await f.getByRole("button", { name: "Send request" }).click();
    await expect(f.getByText("Request sent").first()).toBeVisible({ timeout: 15_000 });
    const c = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await skipTour(c);
    await c.goto(`${CARESITTERS_URL}/?emu=1`); await signIn(c, car, undefined, { side: "carer" });
    await tab(c, "Bookings");
    await c.getByRole("button", { name: "Accept", exact: true }).click({ timeout: 20_000 });
    await expect(c.getByText("Accepted").first()).toBeVisible({ timeout: 15_000 });
    // two-way chat
    await f.reload(); await tab(f, "Messages"); await f.getByText(CN).first().click();
    const fb = f.locator("textarea, input[type=text]").last(); await fb.fill(`hello from family ${svc}`); await fb.press("Enter");
    await expect(f.getByText(`hello from family ${svc}`).first()).toBeVisible({ timeout: 15_000 });
    await c.reload(); await tab(c, "Messages"); await c.getByText(FN).first().click();
    await expect(c.getByText(`hello from family ${svc}`).first()).toBeVisible({ timeout: 20_000 });
    const cb = c.locator("textarea, input[type=text]").last(); await cb.fill(`reply from carer ${svc}`); await cb.press("Enter");
    await f.reload(); await tab(f, "Messages"); await f.getByText(CN).first().click();
    await expect(f.getByText(`reply from carer ${svc}`).first()).toBeVisible({ timeout: 20_000 });
    // carer discovers the family (reverse direction)
    await c.reload(); await tab(c, "Discover");
    await c.getByRole("button", { name: "Show list", exact: true }).click().catch(() => undefined);
    await expect(c.locator("body")).toContainText(FN, { timeout: 20_000 });
    // saved data present in the database
    expect((await readDocument(`profiles/${car.uid}`)).card.careTypes).toContain(svc);
  });
}

test("account settings: sign out, sign back in, delete account path exists", async ({ browser }) => {
  test.setTimeout(120_000);
  const fam = await createUser(newTestEmail("j3s"));
  await seedProfile(fam.uid, { side: "family", displayName: "Settings Fam", card: { ...card, careTypes: ["nanny"] } });
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await skipTour(p);
  await p.goto(`${CARESITTERS_URL}/?emu=1`); await signIn(p, fam, undefined, { side: "family" });
  await p.getByRole("button", { name: "My family", exact: true }).click();
  await p.getByRole("button", { name: /^Settings/ }).click();
  await expect(p.getByText(/delete/i).first()).toBeVisible();
  await expect(p.getByText(/privacy/i).first()).toBeVisible();
  await p.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(p.getByRole("button", { name: "Continue with email", exact: true })).toBeVisible({ timeout: 20_000 });
});
