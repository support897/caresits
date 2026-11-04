import { readFileSync } from "node:fs";
import { test } from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const pairIdFor = (a, b) => [a, b].sort().join("_");
const booking = (familyUid, carerUid, overrides = {}) => ({
  familyUid,
  carerUid,
  date: "2099-11-12",
  from: "09:00",
  to: "12:00",
  endAt: new Date("2099-11-12T04:00:00.000Z"),
  rate: 32,
  estimate: 96,
  recurring: "none",
  weekdays: [],
  childIds: [],
  shareAddress: false,
  state: "requested",
  createdBy: familyUid,
  createdAt: serverTimestamp(),
  ...overrides,
});

const series = (familyUid, carerUid, overrides = {}) => ({
  familyUid,
  carerUid,
  weekdays: ["Mon"],
  from: "09:00",
  to: "12:00",
  startDate: "2099-11-12",
  endDate: "2099-12-31",
  rate: 32,
  state: "requested",
  createdAt: serverTimestamp(),
  ...overrides,
});

const seed = async (env, path, data) => env.withSecurityRulesDisabled(async (context) => {
  await setDoc(doc(context.firestore(), path), data);
});

test("booking child/address extras, repeat series, and completion are guarded", { concurrency: 1 }, async (t) => {
  const env = await initializeTestEnvironment({
    projectId: "demo-cc-booking-extras",
    firestore: { rules, host: "127.0.0.1", port: 8085 },
  });
  const familyUid = "extras-family";
  const carerUid = "extras-carer";
  const pairId = pairIdFor(familyUid, carerUid);
  const family = env.authenticatedContext(familyUid, { firebase: { sign_in_provider: "password" } }).firestore();
  const carer = env.authenticatedContext(carerUid, { firebase: { sign_in_provider: "password" } }).firestore();
  const outsider = env.authenticatedContext("extras-outsider", { firebase: { sign_in_provider: "password" } }).firestore();
  const bookingPath = `relationships/${pairId}/bookings`;
  const seriesPath = `relationships/${pairId}/series`;

  try {
    await env.clearFirestore();
    await seed(env, `relationships/${pairId}`, {
      members: [familyUid, carerUid], familyUid, carerUid, state: "contact",
      createdBy: familyUid, createdAt: new Date(), createdDay: "2099-11-01",
    });

    await t.test("family can save child IDs and address-sharing choice, but not exact address", async () => {
      await assertSucceeds(setDoc(doc(family, `${bookingPath}/extras-ok`), booking(familyUid, carerUid, {
        childIds: ["child-1", "child-2"], shareAddress: true,
      })));
      await assertFails(setDoc(doc(family, `${bookingPath}/address-leak`), booking(familyUid, carerUid, {
        exactAddress: "12 Example Street",
      })));
      await assertFails(setDoc(doc(family, `${bookingPath}/too-many-children`), booking(familyUid, carerUid, {
        childIds: Array.from({ length: 9 }, (_, index) => `child-${index}`),
      })));
      await assertFails(setDoc(doc(family, `${bookingPath}/fake-end-time`), booking(familyUid, carerUid, {
        endAt: new Date("2099-11-12T03:00:00.000Z"),
      })));
      await assertFails(setDoc(doc(carer, `${bookingPath}/carer-created`), booking(familyUid, carerUid, {
        createdBy: carerUid,
      })));
    });

    await t.test("family creates requested series with linked requested bookings; carer accepts it", async () => {
      const seriesRef = doc(family, `${seriesPath}/weekly-1`);
      const bookingRef = doc(family, `${bookingPath}/weekly-1-visit`);
      const batch = writeBatch(family);
      batch.set(seriesRef, series(familyUid, carerUid));
      batch.set(bookingRef, booking(familyUid, carerUid, {
        date: "2099-11-16",
        endAt: new Date("2099-11-16T04:00:00.000Z"),
        recurring: "weekly",
        weekdays: ["Mon"],
        seriesId: "weekly-1",
      }));
      await assertSucceeds(batch.commit());
      await assertFails(updateDoc(seriesRef, { state: "active", decidedAt: serverTimestamp() }));
      await assertFails(setDoc(doc(outsider, `${seriesPath}/outsider-series`), series(familyUid, carerUid)));
      await assertSucceeds(updateDoc(doc(carer, `${seriesPath}/weekly-1`), {
        state: "active", decidedAt: serverTimestamp(),
      }));
      await assertSucceeds(updateDoc(doc(carer, `${bookingPath}/weekly-1-visit`), {
        state: "accepted", decidedAt: serverTimestamp(),
      }));
    });

    await t.test("carer can decline a requested series; family cannot decide it", async () => {
      await assertSucceeds(setDoc(doc(family, `${seriesPath}/weekly-2`), series(familyUid, carerUid)));
      await assertFails(updateDoc(doc(family, `${seriesPath}/weekly-2`), {
        state: "ended", decidedAt: serverTimestamp(),
      }));
      await assertSucceeds(updateDoc(doc(carer, `${seriesPath}/weekly-2`), {
        state: "ended", decidedAt: serverTimestamp(),
      }));
    });

    await t.test("only carer completes accepted bookings after end time", async () => {
      await seed(env, `${bookingPath}/past-accepted`, booking(familyUid, carerUid, {
        date: "2020-11-12", state: "accepted", endAt: new Date("2020-11-12T04:00:00.000Z"),
      }));
      await seed(env, `${bookingPath}/future-accepted`, booking(familyUid, carerUid, {
        state: "accepted", endAt: new Date("2099-11-12T04:00:00.000Z"),
      }));
      await seed(env, `${bookingPath}/past-requested`, booking(familyUid, carerUid, {
        date: "2020-11-12", state: "requested", endAt: new Date("2020-11-12T04:00:00.000Z"),
      }));
      await assertSucceeds(updateDoc(doc(carer, `${bookingPath}/past-accepted`), { state: "completed" }));
      await assertFails(updateDoc(doc(family, `${bookingPath}/future-accepted`), { state: "completed" }));
      await assertFails(updateDoc(doc(carer, `${bookingPath}/future-accepted`), { state: "completed" }));
      await assertFails(updateDoc(doc(carer, `${bookingPath}/past-requested`), { state: "completed" }));
    });
  } finally {
    await env.cleanup();
  }
});
