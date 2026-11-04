import { test } from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const familyUid = "review-family";
const carerUid = "review-carer";
const pairId = [familyUid, carerUid].sort().join("_");
const reviewId = `${pairId}_booking-1`;
const bookingPath = (id) => `relationships/${pairId}/bookings/${id}`;
const payload = (overrides = {}) => ({
  relId: pairId,
  bookingId: "booking-1",
  familyUid,
  carerUid,
  rating: 5,
  text: "Calm and kind care.",
  at: serverTimestamp(),
  ...overrides,
});

const seed = async (env, path, data) => env.withSecurityRulesDisabled(async (context) => {
  await setDoc(doc(context.firestore(), path), data);
});

const seedBooking = async (env, bookingId = "booking-1", state = "completed") => {
  await seed(env, `relationships/${pairId}`, {
    members: [familyUid, carerUid], familyUid, carerUid, state: "contact", createdBy: familyUid,
  });
  await seed(env, bookingPath(bookingId), { familyUid, carerUid, state });
};

test("marketplace review rules", { concurrency: 1 }, async (t) => {
  const env = await initializeTestEnvironment({
    projectId: "demo-cc",
    firestore: { rules, host: "127.0.0.1", port: 8085 },
  });
  const as = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "password" } }).firestore();
  const family = as(familyUid);
  const carer = as(carerUid);
  const otherFamily = as("other-family");
  const signedUser = as("signed-reader");
  const anonymous = env.authenticatedContext("anonymous-reader", { firebase: { sign_in_provider: "anonymous" } }).firestore();

  try {
    await seedBooking(env);
    await t.test("family creates one review only after completed booking", async () => {
      await assertSucceeds(setDoc(doc(family, `reviews/${reviewId}`), payload()));
      await assertFails(setDoc(doc(family, `reviews/${reviewId}`), payload({ text: "Changed" })));
      await assertFails(updateDoc(doc(family, `reviews/${reviewId}`), { text: "Edited" }));
      await assertFails(deleteDoc(doc(family, `reviews/${reviewId}`)));
    });

    await t.test("signed-in users can read reviews and replies", async () => {
      await assertSucceeds(getDoc(doc(signedUser, `reviews/${reviewId}`)));
      await assertSucceeds(getDoc(doc(anonymous, `reviews/${reviewId}`)));
      await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `reviews/${reviewId}`)));
    });

    await t.test("outsiders, incomplete bookings, wrong IDs, and invalid fields cannot create", async () => {
      await assertFails(setDoc(doc(otherFamily, `reviews/${pairId}_booking-1`), payload()));
      await seedBooking(env, "booking-pending", "accepted");
      await assertFails(setDoc(doc(family, `reviews/${pairId}_booking-pending`), payload({ bookingId: "booking-pending" })));
      await assertFails(setDoc(doc(family, `reviews/not-deterministic`), payload()));
      await assertFails(setDoc(doc(family, `reviews/${pairId}_bad-rating`), payload({ bookingId: "bad-rating", rating: 6 })));
      await seedBooking(env, "bad-rating", "completed");
      await assertFails(setDoc(doc(family, `reviews/${pairId}_bad-rating`), payload({ bookingId: "bad-rating", rating: 6 })));
      await seedBooking(env, "long-text", "completed");
      await assertFails(setDoc(doc(family, `reviews/${pairId}_long-text`), payload({ bookingId: "long-text", text: "x".repeat(601) })));
      await seedBooking(env, "wrong-time", "completed");
      await assertFails(setDoc(doc(family, `reviews/${pairId}_wrong-time`), payload({ bookingId: "wrong-time", at: new Date() })));
      await seedBooking(env, "wrong-carer", "completed");
      await assertFails(setDoc(doc(family, `reviews/${pairId}_wrong-carer`), payload({ bookingId: "wrong-carer", carerUid: "someone-else" })));
    });

    await t.test("family UID must also be a relationship member", async () => {
      await seed(env, `relationships/${pairId}`, {
        members: [carerUid, "other-member"], familyUid, carerUid, state: "contact", createdBy: familyUid,
      });
      await seed(env, bookingPath("not-a-member"), { familyUid, carerUid, state: "completed" });
      await assertFails(setDoc(doc(family, `reviews/${pairId}_not-a-member`), payload({ bookingId: "not-a-member" })));
      await seedBooking(env);
    });

    await t.test("only carer can add one immutable reply", async () => {
      const reply = { by: carerUid, text: "Thank you for sharing.", at: serverTimestamp() };
      await assertSucceeds(setDoc(doc(carer, `reviews/${reviewId}/replies/${carerUid}`), reply));
      await assertSucceeds(getDoc(doc(signedUser, `reviews/${reviewId}/replies/${carerUid}`)));
      await assertFails(setDoc(doc(family, `reviews/${reviewId}/replies/${familyUid}`), { ...reply, by: familyUid }));
      await assertFails(setDoc(doc(otherFamily, `reviews/${reviewId}/replies/${carerUid}`), reply));
      await assertFails(setDoc(doc(carer, `reviews/${reviewId}/replies/another-id`), reply));
      await assertFails(setDoc(doc(carer, `reviews/${reviewId}/replies/${carerUid}`), { ...reply, text: "Changed" }));
      await assertFails(deleteDoc(doc(carer, `reviews/${reviewId}/replies/${carerUid}`)));
    });

    await t.test("summary is public-readable and client writes are denied", async () => {
      await seed(env, "reviewSummaries/review-carer", { count: 1, avg: 5 });
      await assertSucceeds(getDoc(doc(signedUser, "reviewSummaries/review-carer")));
      await assertSucceeds(getDoc(doc(anonymous, "reviewSummaries/review-carer")));
      await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), "reviewSummaries/review-carer")));
      await assertFails(setDoc(doc(family, "reviewSummaries/review-carer"), { count: 2, avg: 4.5 }));
      await assertFails(updateDoc(doc(family, "reviewSummaries/review-carer"), { count: 2 }));
      await assertFails(deleteDoc(doc(family, "reviewSummaries/review-carer")));
    });
  } finally {
    await env.cleanup();
  }
});
