import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";

function loadPlaywright() {
  const roots = [
    process.env.PLAYWRIGHT_PACKAGE,
    "/home/user/pw/package.json",
    new URL("../package.json", import.meta.url).pathname,
  ].filter((value) => typeof value === "string" && value.length > 0);
  for (const root of roots) {
    try { return createRequire(root)("playwright/test"); } catch { /* try the next installed package */ }
  }
  throw new Error("Playwright was not found. Set PLAYWRIGHT_PACKAGE to its package.json path.");
}

const { chromium, devices, expect, test } = loadPlaywright();
export { chromium, devices, expect, test };

export const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "caresits-812a0";
export const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
export const FIRESTORE_EMULATOR_URL = "http://127.0.0.1:8080";
export const CARESITTERS_URL = "http://127.0.0.1:4173";
export const SECOND_APP_URL = "http://127.0.0.1:4174";

export function newTestEmail(label = "e2e") {
  return `${label}-${randomUUID()}@example.test`;
}

function makePassword() {
  return `E2e-${randomBytes(18).toString("base64url")}!`;
}

async function responseJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${url} failed (${response.status}): ${text}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

/** Create a disposable Auth Emulator account through its REST API. */
export async function createUser(email, password = makePassword()) {
  const result = await responseJson(`${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return { uid: result.localId, email: result.email ?? email, password, idToken: result.idToken, refreshToken: result.refreshToken };
}

function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
  throw new TypeError(`Unsupported Firestore test value: ${typeof value}`);
}

function encodeFields(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, encodeValue(item)]));
}

function decodeValue(value) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields ?? {});
  return undefined;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function firestoreDocumentUrl(documentPath) {
  const path = documentPath.split("/").map(encodeURIComponent).join("/");
  return `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}

/** Write an emulator-only document using the Firestore Emulator's owner bypass. */
export async function writeDocument(documentPath, data) {
  return responseJson(firestoreDocumentUrl(documentPath), {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: "Bearer owner" },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
}

export async function readDocument(documentPath) {
  const url = firestoreDocumentUrl(documentPath);
  const response = await fetch(url, { headers: { authorization: "Bearer owner" } });
  if (response.status === 404) return null;
  const text = await response.text();
  if (!response.ok) throw new Error(`GET ${url} failed (${response.status}): ${text}`);
  const document = JSON.parse(text);
  return decodeFields(document.fields ?? {});
}

/** Seed a safe, public profile fixture for an emulator-only account. */
export async function seedProfile(uid, overrides = {}) {
  const side = overrides.side === "carer" ? "carer" : "family";
  const defaultCard = side === "carer" ? {
    suburb: "New Farm",
    headline: "Calm, experienced care",
    rate: 32,
    careTypes: ["babysitter", "nanny"],
    languages: ["English"],
    availability: {},
  } : {
    suburb: "New Farm",
    kids: [{ name: "Avery", ageYears: 4 }],
    careTypes: ["babysitter"],
    scheduleNeed: {},
    budgetMax: 35,
    maxDistanceKm: 10,
    style: [],
    activities: [],
  };
  const card = { ...defaultCard, ...(overrides.card ?? {}) };
  const profile = {
    side,
    displayName: `E2E ${side === "family" ? "Family" : "Carer"} ${uid.slice(0, 6)}`,
    postcode: "4005",
    about: `Emulator-only ${side} fixture.`,
    looking: { musts: {}, prefs: {} },
    updatedAt: new Date(),
    ...overrides,
    card,
  };
  await writeDocument(`profiles/${uid}`, profile);
  return profile;
}

/** Seed a carer and a server-owned check record, only in the local emulator. */
export async function seedCarer(uid, overrides = {}) {
  const profile = await seedProfile(uid, { ...overrides, side: "carer" });
  const checkedOn = new Date().toISOString().slice(0, 10);
  const verified = {
    level: "working-with-children",
    checkedOn,
    verifiedBy: "e2e-emulator-admin-fixture",
    status: "verified",
    label: "Working With Children Check",
    kind: "working-with-children",
    checks: [{ id: "e2e-check", label: "Working With Children Check", kind: "working-with-children", status: "verified", checkedOn, verifiedBy: "e2e-emulator-admin-fixture" }],
  };
  await writeDocument(`verified/${uid}`, verified);
  return { profile, verified };
}

/** Sign in through the real email form. The app creates the account if it is new. */
export async function signIn(page, userOrEmail, password, options = {}) {
  const email = typeof userOrEmail === "string" ? userOrEmail : userOrEmail.email;
  const secret = typeof userOrEmail === "string" ? password : userOrEmail.password;
  const side = options.side ?? "family";
  if (page.url() === "about:blank") await page.goto(`${CARESITTERS_URL}/?emu=1`);
  const hostname = new URL(page.url()).hostname;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") throw new Error("E2E sign-in is only allowed on a local browser page.");

  const roleButton = page.getByRole("button", { name: side === "family" ? "I need care" : "I give care", exact: true });
  const emailButton = page.getByRole("button", { name: "Continue with email", exact: true });
  await expect.poll(async () => Number(await roleButton.isVisible().catch(() => false)) + Number(await emailButton.isVisible().catch(() => false)), { timeout: 20_000 }).toBeGreaterThan(0);
  if (await roleButton.isVisible().catch(() => false)) {
    await roleButton.click();
    await expect(emailButton).toBeVisible();
  }
  if (await emailButton.isVisible().catch(() => false)) await emailButton.click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0, { timeout: 25_000 });
  await expect.poll(async () => (await page.locator(".onb-screen").count()) + (await page.locator("nav.tabs").count()), { timeout: 25_000 }).toBeGreaterThan(0);
  return page;
}

/** Create an API-seeded second user in a truly separate browser context, then sign in through the UI. */
export async function createSecondUserContext(browser, options = {}) {
  const email = options.email ?? newTestEmail("second");
  const side = options.side ?? "carer";
  const user = await createUser(email);
  if (side === "carer") await seedCarer(user.uid, options.profile);
  else await seedProfile(user.uid, options.profile);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${CARESITTERS_URL}/?emu=1`);
  await signIn(page, user, undefined, { side });
  return { context, page, user, side };
}

/** Clear only the local emulator data; do not point this at production. */
export async function resetEmulators() {
  await Promise.all([
    responseJson(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" }),
    responseJson(`${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" }),
  ]);
}
