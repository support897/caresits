import { test, expect, CARESITTERS_URL, createUser, seedCarer, seedProfile, signIn, newTestEmail } from "../lib.mjs";

// Reciprocal matching end to end: six roles, real accounts, real rules, UI + map.
const FAM = { nanny: "FamNanny", babysitter: "FamBaby", au_pair: "FamAupair" };
const CARER = { nanny: "CarNanny", babysitter: "CarBaby", au_pair: "CarAupair" };

async function openPage(browser, user, side) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem("caresits-tour-done", "1"));
  await page.goto(`${CARESITTERS_URL}/?emu=1`);
  await signIn(page, user, undefined, { side });
  return { ctx, page };
}
async function visibleNames(page) {
  const list = page.getByRole("button", { name: "Show list", exact: true });
  if (await list.count()) await list.click();
  await page.waitForTimeout(1500);
  return page.evaluate(() => document.body.innerText);
}

test("every role sees only its reciprocal counterpart (list and map), server enforced", async ({ browser }) => {
  test.setTimeout(240_000);
  for (const s of ["nanny", "babysitter", "au_pair"]) {
    const f = await createUser(newTestEmail("rf"));
    await seedProfile(f.uid, { side: "family", displayName: `${FAM[s]} Home`, card: { careTypes: [s], lat: -27.47, lng: 153.03, suburb: "New Farm" } });
    const c = await createUser(newTestEmail("rc"));
    await seedCarer(c.uid, { displayName: `${CARER[s]} Sitter`, card: { careTypes: [s], lat: -27.46, lng: 153.02, suburb: "New Farm" } });
  }
  const names = [...Object.values(FAM), ...Object.values(CARER)];
  const cases = [
    { side: "carer", svc: "babysitter", sees: ["FamBaby"] },
    { side: "family", svc: "babysitter", sees: ["CarBaby"] },
    { side: "carer", svc: "nanny", sees: ["FamNanny"] },
    { side: "family", svc: "nanny", sees: ["CarNanny"] },
    { side: "carer", svc: "au_pair", sees: ["FamAupair"] },
    { side: "family", svc: "au_pair", sees: ["CarAupair"] },
  ];
  for (const k of cases) {
    const me = await createUser(newTestEmail("rv"));
    if (k.side === "carer") await seedCarer(me.uid, { displayName: `Viewer ${k.svc}`, card: { careTypes: [k.svc], lat: -27.465, lng: 153.025, suburb: "New Farm" } });
    else await seedProfile(me.uid, { side: "family", displayName: `Viewer ${k.svc}`, card: { careTypes: [k.svc], lat: -27.465, lng: 153.025, suburb: "New Farm" } });
    const { ctx, page } = await openPage(browser, me, k.side);
    const text = await visibleNames(page);
    for (const n of names) {
      if (k.sees.includes(n)) expect(text, `${k.side}:${k.svc} should see ${n}`).toContain(n);
      else expect(text, `${k.side}:${k.svc} must NOT see ${n}`).not.toContain(n);
    }
    // map surface uses the same rows
    await page.getByRole("button", { name: "Map", exact: true }).click();
    await page.waitForTimeout(1000);
    const mapText = await page.evaluate(() => document.body.innerText);
    for (const n of names) if (!k.sees.includes(n)) expect(mapText, `map ${k.side}:${k.svc} must NOT list ${n}`).not.toContain(n);
    await ctx.close();
  }
});

test("changing service intent updates results with nothing stale", async ({ browser }) => {
  test.setTimeout(120_000);
  for (const s of ["nanny", "babysitter"]) { const c = await createUser(newTestEmail("ic")); await seedCarer(c.uid, { displayName: `${CARER[s]} Sitter`, card: { careTypes: [s], suburb: "New Farm" } }); }
  const me = await createUser(newTestEmail("iv"));
  await seedProfile(me.uid, { side: "family", displayName: "Viewer both", card: { careTypes: ["nanny", "babysitter"], suburb: "New Farm" } });
  const { ctx, page } = await openPage(browser, me, "family");
  let text = await visibleNames(page);
  expect(text).toContain("CarNanny"); expect(text).toContain("CarBaby");
  await page.getByRole("button", { name: "Nanny", exact: true }).click(); await page.waitForTimeout(1500);
  text = await page.evaluate(() => document.body.innerText);
  expect(text).toContain("CarNanny"); expect(text).not.toContain("CarBaby");
  await page.getByRole("button", { name: "Babysitter", exact: true }).click(); await page.waitForTimeout(1500);
  text = await page.evaluate(() => document.body.innerText);
  expect(text).toContain("CarBaby"); expect(text).not.toContain("CarNanny");
  await ctx.close();
});

const DOCS = "http://127.0.0.1:8080/v1/projects/caresits-812a0/databases/(default)/documents";
const rest = (token, path) => fetch(`${DOCS}/${path}`, { headers: { authorization: `Bearer ${token}` } });
const runQuery = (token, side, svc) => fetch(`${DOCS}:runQuery`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "profiles" }], where: { compositeFilter: { op: "AND", filters: [
  { fieldFilter: { field: { fieldPath: "side" }, op: "EQUAL", value: { stringValue: side } } },
  { fieldFilter: { field: { fieldPath: "card.careTypes" }, op: "ARRAY_CONTAINS", value: { stringValue: svc } } }] } }, limit: 50 } }) });

test("server API: other services and other families' private data are denied", async () => {
  const nanny = await createUser(newTestEmail("an")); await seedCarer(nanny.uid, { displayName: "ApiNanny Sitter", card: { careTypes: ["nanny"] } });
  const baby = await createUser(newTestEmail("ab")); await seedCarer(baby.uid, { displayName: "ApiBaby Sitter", card: { careTypes: ["babysitter"] } });
  const famA = await createUser(newTestEmail("fa")); await seedProfile(famA.uid, { side: "family", displayName: "ApiFamA", card: { careTypes: ["babysitter"] } });
  const famB = await createUser(newTestEmail("fb")); await seedProfile(famB.uid, { side: "family", displayName: "ApiFamB", card: { careTypes: ["babysitter"] } });
  const { writeDocument } = await import("../lib.mjs");
  await writeDocument(`users/${famA.uid}/children/c1`, { name: "Secret Child", ageYears: 3 });
  // direct reads
  expect((await rest(famA.idToken, `profiles/${nanny.uid}`)).status).toBe(403);
  expect((await rest(famA.idToken, `profiles/${baby.uid}`)).status).toBe(200);
  // queries
  expect((await runQuery(famA.idToken, "carer", "nanny")).status).toBe(403);
  const ok = await runQuery(famA.idToken, "carer", "babysitter");
  expect(ok.status).toBe(200);
  const body = JSON.stringify(await ok.json());
  expect(body).toContain("ApiBaby"); expect(body).not.toContain("ApiNanny");
  // same-side and unrelated private data
  expect((await runQuery(famA.idToken, "family", "babysitter")).status).toBe(403);
  expect((await rest(famB.idToken, `users/${famA.uid}/children/c1`)).status).toBe(403);
  expect((await rest(famA.idToken, `users/${famA.uid}/children/c1`)).status).toBe(200);
  expect((await rest(baby.idToken, `users/${famA.uid}/children/c1`)).status).toBe(403);
});
