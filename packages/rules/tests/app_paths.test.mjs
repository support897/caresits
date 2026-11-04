import { test } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const pairIdFor = (a, b) => [a, b].sort().join("_");
const allPerms = { allergies: true, medication: true, photos: true, calendar: true, privateMessages: true };
const noPerms = { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false };
const profile = (side, card = {}) => ({
  side, displayName: side === "family" ? "Family" : "Carer", postcode: "4000", photoUrl: "",
  updatedAt: serverTimestamp(), card, looking: { musts: {}, prefs: {} },
});
const booking = (familyUid, carerUid, state = "requested") => ({
  familyUid, carerUid, date: "2026-11-12", from: "09:00", to: "12:00", rate: 32, estimate: 96,
  recurring: "none", weekdays: [], state, createdBy: familyUid, createdAt: serverTimestamp(),
});
const seed = async (env, path, data) => env.withSecurityRulesDisabled(async (context) => {
  await setDoc(doc(context.firestore(), path), data);
});
const invite = (spaceId, role, perms, extra = {}) => ({
  spaceId, role, createdBy: spaceId, createdAt: serverTimestamp(),
  expiresAt: new Date(Date.now() + 60_000), usedBy: null, ...(perms ? { perms } : {}), ...extra,
});

async function makeSpace(db, spaceId, members = []) {
  const batch = writeBatch(db);
  batch.set(doc(db, `careSpaces/${spaceId}`), { ownerUid: spaceId, name: "Family care space", createdAt: serverTimestamp() });
  batch.set(doc(db, `careSpaces/${spaceId}/members/${spaceId}`), {
    role: "admin", status: "active", perms: allPerms, displayName: "Parent", joinedAt: serverTimestamp(), invitedBy: spaceId,
  });
  batch.set(doc(db, `users/${spaceId}/spaces/${spaceId}`), { spaceId, name: "Family care space", memberRole: "admin", joinedAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
  for (const member of members) {
    await assertSucceeds(setDoc(doc(db, `careSpaces/${spaceId}/members/${member.uid}`), {
      role: member.role ?? "regular", status: member.status ?? "active", perms: member.perms ?? allPerms,
      displayName: member.uid, joinedAt: serverTimestamp(), invitedBy: spaceId,
    }));
  }
}

test("app Firestore paths match rules and isolate users", { concurrency: 1 }, async (t) => {
  const env = await initializeTestEnvironment({
    projectId: "demo-cc-paths",
    firestore: { rules, host: "127.0.0.1", port: 8085 },
  });
  const as = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "password" } }).firestore();
  const owner = as("audit-family");
  const carer = as("audit-carer");
  const outsider = as("audit-outsider");
  const spaceId = "audit-family";

  try {
    await env.clearFirestore();
    await t.test("private space index create, list, and live membership reads", async () => {
      await makeSpace(owner, spaceId, [{ uid: "audit-carer", role: "regular" }]);
      await assertSucceeds(getDocs(collection(owner, `users/${spaceId}/spaces`)));
      await assertSucceeds(getDoc(doc(owner, `users/${spaceId}/spaces/${spaceId}`)));
      await assertSucceeds(getDoc(doc(carer, `careSpaces/${spaceId}`)));
      await assertSucceeds(getDocs(collection(carer, `careSpaces/${spaceId}/members`)));
      await assertSucceeds(getDocs(query(collectionGroup(carer, "members"), where(documentId(), "==", `careSpaces/${spaceId}/members/audit-carer`))));
      await assertFails(getDocs(collection(outsider, `users/${spaceId}/spaces`)));
      await assertFails(getDoc(doc(outsider, `careSpaces/${spaceId}/children/child-1`)));
    });

    await t.test("public profile card accepts app fields, not false checks", async () => {
      const card = {
        auPairHost: { country: "Australia", room: "Private", pocketMoneyPerWeek: 320, hoursPerWeek: 25,
          childcareDuties: ["school pickup"], otherHousework: ["laundry"], languages: ["English"], visaHelp: true, infantCareNeeded: false },
        alsoSide: { side: "carer", headline: "Warm carer", experienceYears: 4, careTypes: ["nanny"] },
        experienceYears: 4, photoUrl: "users/audit-family/profile.webp",
      };
      await assertSucceeds(setDoc(doc(owner, "profiles/audit-family"), profile("family", card)));
      await assertSucceeds(getDoc(doc(carer, "profiles/audit-family")));
      await assertFails(setDoc(doc(outsider, "profiles/audit-family"), profile("family", card)));
      await assertFails(setDoc(doc(as("audit-bad-card"), "profiles/audit-bad-card"), profile("carer", {
        auPairHost: { country: "Australia", admin: true },
      })));
    });

    await t.test("emergency contacts list and timestamp stay owner-only", async () => {
      const contacts = [{ name: "Parent", phone: "+61 400 000 000", relation: "parent" }];
      await assertSucceeds(setDoc(doc(owner, `users/${spaceId}/emergencyContacts/main`), { contacts, updatedAt: serverTimestamp() }));
      await assertSucceeds(getDoc(doc(owner, `users/${spaceId}/emergencyContacts/main`)));
      await assertSucceeds(getDocs(collection(owner, `users/${spaceId}/emergencyContacts`)));
      await assertFails(getDoc(doc(outsider, `users/${spaceId}/emergencyContacts/main`)));
      await assertFails(setDoc(doc(outsider, `users/${spaceId}/emergencyContacts/main`), { contacts }));
    });

    await t.test("preferences, saved people, and blocks stay private", async () => {
      await assertSucceeds(setDoc(doc(owner, `users/${spaceId}/prefs/main`), { passport: "AU", messages: false }, { merge: true }));
      await assertSucceeds(setDoc(doc(owner, `users/${spaceId}/saved/audit-carer`), { at: serverTimestamp() }));
      await assertSucceeds(setDoc(doc(owner, `users/${spaceId}/blocks/audit-carer`), { createdAt: serverTimestamp() }));
      await assertSucceeds(getDoc(doc(owner, `users/${spaceId}/saved/audit-carer`)));
      await assertFails(getDoc(doc(outsider, `users/${spaceId}/prefs/main`)));
      await assertFails(updateDoc(doc(outsider, `users/${spaceId}/blocks/audit-carer`), { blocked: false }));
      await assertSucceeds(deleteDoc(doc(owner, `users/${spaceId}/saved/audit-carer`)));
    });

    await t.test("child notes and memories are editable by care staff, not outsiders", async () => {
      const childRef = doc(owner, `careSpaces/${spaceId}/children/child-1`);
      await assertSucceeds(setDoc(childRef, { name: "Mia", ageYears: 4, interests: ["painting"], sections: { meals: { notes: "Fruit" }, memories: [] } }));
      await assertSucceeds(updateDoc(doc(carer, `careSpaces/${spaceId}/children/child-1`), { "sections.meals.notes": "Fruit cut small" }));
      await assertSucceeds(updateDoc(doc(carer, `careSpaces/${spaceId}/children/child-1`), { "sections.memories": arrayUnion("Painted together") }));
      await assertFails(updateDoc(doc(carer, `careSpaces/${spaceId}/children/child-1`), { allergies: ["peanut"] }));
      await assertFails(updateDoc(doc(outsider, `careSpaces/${spaceId}/children/child-1`), { name: "Changed" }));
      await assertSucceeds(getDocs(collection(carer, `careSpaces/${spaceId}/children`)));
    });

    await t.test("today writes and attached asks stay on their timeline item", async () => {
      const itemRef = doc(carer, `careSpaces/${spaceId}/dayStory/paint-1`);
      await assertSucceeds(setDoc(itemRef, {
        childId: "child-1", day: "2026-11-04", kind: "activity", at: serverTimestamp(),
        text: "Painting", by: "audit-carer", asks: [],
      }));
      await assertSucceeds(getDocs(query(collection(owner, `careSpaces/${spaceId}/dayStory`), where("day", "==", "2026-11-04"))));
      await assertSucceeds(updateDoc(doc(owner, `careSpaces/${spaceId}/dayStory/paint-1`), {
        asks: [{ by: "audit-family", text: "Please share a photo", at: new Date().toISOString() }],
      }));
      await assertFails(updateDoc(doc(outsider, `careSpaces/${spaceId}/dayStory/paint-1`), { text: "cross-family" }));
    });

    await t.test("calendar time off starts requested and only admin decides", async () => {
      const timeOff = doc(carer, `careSpaces/${spaceId}/calendar/time-off-1`);
      await assertSucceeds(setDoc(timeOff, {
        kind: "timeoff", title: "Day off", start: "2026-11-12T09:00:00Z", end: "2026-11-12T17:00:00Z",
        ownerUid: "audit-carer", state: "requested",
      }));
      await assertSucceeds(getDocs(collection(carer, `careSpaces/${spaceId}/calendar`)));
      await assertFails(updateDoc(timeOff, { state: "approved" }));
      await assertSucceeds(updateDoc(doc(owner, `careSpaces/${spaceId}/calendar/time-off-1`), { state: "approved" }));
      await assertFails(setDoc(doc(owner, `careSpaces/${spaceId}/calendar/fake-booking`), {
        kind: "booking", title: "Fake", start: "2026-11-12T09:00:00Z", end: "2026-11-12T12:00:00Z",
        ownerUid: spaceId, state: "active",
      }));
      await assertFails(updateDoc(doc(owner, `careSpaces/${spaceId}/calendar/time-off-1`), { kind: "booking" }));
      await assertFails(getDocs(collection(outsider, `careSpaces/${spaceId}/calendar`)));
    });

    await t.test("meal plans and shopping use separate protected paths", async () => {
      const batch = writeBatch(owner);
      batch.set(doc(owner, `careSpaces/${spaceId}/mealPlan/2026-11-04`), {
        meals: arrayUnion({ childId: "child-1", name: "Soup", ingredients: ["carrot"] }),
      }, { merge: true });
      batch.set(doc(owner, `careSpaces/${spaceId}/shopping/shop-1`), {
        item: "Carrot", childId: "child-1", source: "meal", sourceId: "2026-11-04", bought: false, reimbursed: false,
      });
      await assertSucceeds(batch.commit());
      await assertSucceeds(getDoc(doc(carer, `careSpaces/${spaceId}/mealPlan/2026-11-04`)));
      await assertSucceeds(getDocs(collection(carer, `careSpaces/${spaceId}/shopping`)));
      await assertSucceeds(updateDoc(doc(carer, `careSpaces/${spaceId}/shopping/shop-1`), { bought: true }));
      await assertFails(setDoc(doc(carer, `careSpaces/${spaceId}/mealPlan/2026-11-05`), { meals: [] }));
      await assertFails(updateDoc(doc(outsider, `careSpaces/${spaceId}/shopping/shop-1`), { bought: true }));
    });

    await t.test("safety reports and direct care-space check-ins bind to the signed-in carer", async () => {
      await assertSucceeds(setDoc(doc(owner, "safetyReports/report-1"), {
        reporterUid: "audit-family", reportedUid: "audit-carer", surface: "profile", category: "child_safety",
        reporterWords: "Please review this report.", snapshot: { items: [], text: "", title: "Carer" },
        state: "open", createdAt: serverTimestamp(),
      }));
      await assertFails(setDoc(doc(outsider, "safetyReports/report-2"), {
        reporterUid: "audit-family", reportedUid: "audit-carer", surface: "profile", category: "child_safety",
        reporterWords: "No", snapshot: { items: [], text: "", title: "" }, state: "open", createdAt: serverTimestamp(),
      }));
      const checkinUid = "audit-checkin-carer";
      const checkinCarer = as(checkinUid);
      const checkinPair = pairIdFor(spaceId, checkinUid);
      await assertSucceeds(setDoc(doc(owner, `careSpaces/${spaceId}/members/${checkinUid}`), {
        role: "regular", status: "active", perms: noPerms, displayName: "Check-in carer", joinedAt: serverTimestamp(), invitedBy: spaceId,
      }));
      await seed(env, `relationships/${checkinPair}`, {
        members: [spaceId, checkinUid], familyUid: spaceId, carerUid: checkinUid,
        state: "contact", createdBy: spaceId, createdAt: new Date(), createdDay: "2026-11-01",
      });
      await seed(env, `relationships/${checkinPair}/bookings/accepted-1`, booking(spaceId, checkinUid, "accepted"));
      await assertSucceeds(setDoc(doc(checkinCarer, `careSpaces/${spaceId}/checkins/checkin-1`), {
        by: checkinUid, kind: "arrived", bookingId: "accepted-1", at: serverTimestamp(),
      }));
      await assertFails(setDoc(doc(outsider, `careSpaces/${spaceId}/checkins/checkin-2`), {
        by: "audit-outsider", kind: "arrived", bookingId: "accepted-1", at: serverTimestamp(),
      }));
    });

    await t.test("booking request is created with its pending pair and decided by the carer", async () => {
      const bookingFamilyUid = "booking-family";
      const bookingCarerUid = "booking-carer";
      const bookingFamily = as(bookingFamilyUid);
      const bookingCarer = as(bookingCarerUid);
      const bookingOutsider = as("booking-outsider");
      const bookingPair = pairIdFor(bookingFamilyUid, bookingCarerUid);
      await seed(env, `profiles/${bookingFamilyUid}`, profile("family"));
      await seed(env, `profiles/${bookingCarerUid}`, profile("carer"));
      const batch = writeBatch(bookingFamily);
      batch.set(doc(bookingFamily, `relationships/${bookingPair}`), {
        members: [bookingCarerUid, bookingFamilyUid], familyUid: bookingFamilyUid, carerUid: bookingCarerUid,
        state: "pending", createdBy: bookingFamilyUid, createdAt: new Date().toISOString(), createdDay: "2026-11-04",
      });
      batch.set(doc(bookingFamily, `relationships/${bookingPair}/bookings/request-1`), booking(bookingFamilyUid, bookingCarerUid));
      await assertSucceeds(batch.commit());
      await assertSucceeds(getDocs(query(collection(bookingCarer, "relationships"), where("carerUid", "==", bookingCarerUid))));
      await assertSucceeds(getDocs(collection(bookingCarer, `relationships/${bookingPair}/bookings`)));
      await assertSucceeds(updateDoc(doc(bookingCarer, `relationships/${bookingPair}/bookings/request-1`), {
        state: "accepted", decidedAt: serverTimestamp(),
      }));
      await assertFails(getDoc(doc(bookingOutsider, `relationships/${bookingPair}/bookings/request-1`)));
      await assertSucceeds(setDoc(doc(bookingCarer, `relationships/${bookingPair}/checkins/check-1`), {
        by: bookingCarerUid, kind: "arrived", bookingId: "request-1", at: serverTimestamp(),
      }));
      await assertFails(deleteDoc(doc(bookingCarer, `relationships/${bookingPair}/checkins/check-1`)));
    });

    await t.test("handoff invite uses the global one-time path and binds accepted booking", async () => {
      const handoffFamily = as("handoff-family");
      const handoffCarer = as("handoff-carer");
      const wrongCarer = as("handoff-wrong");
      const handoffPair = pairIdFor("handoff-family", "handoff-carer");
      await seed(env, `relationships/${handoffPair}`, {
        members: ["handoff-family", "handoff-carer"], familyUid: "handoff-family", carerUid: "handoff-carer",
        state: "pending", createdBy: "handoff-family", createdAt: new Date(), createdDay: "2026-11-04",
      });
      await seed(env, `relationships/${handoffPair}/bookings/accepted-2`, booking("handoff-family", "handoff-carer", "accepted"));
      const code = "HANDOFF2";
      const rootBatch = writeBatch(handoffFamily);
      rootBatch.set(doc(handoffFamily, "careSpaces/handoff-family"), {
        ownerUid: "handoff-family", name: "Family care space", createdAt: serverTimestamp(),
      });
      rootBatch.set(doc(handoffFamily, "careSpaces/handoff-family/members/handoff-family"), {
        role: "admin", status: "active", perms: allPerms, displayName: "Family", joinedAt: serverTimestamp(), invitedBy: "handoff-family",
      });
      rootBatch.set(doc(handoffFamily, "users/handoff-family/spaces/handoff-family"), {
        spaceId: "handoff-family", name: "Family care space", memberRole: "admin", joinedAt: serverTimestamp(),
      });
      rootBatch.set(doc(handoffFamily, `careSpaceInvites/${code}`), invite("handoff-family", "regular", noPerms, {
        targetUid: "handoff-carer", bookingId: "accepted-2",
      }));
      await assertSucceeds(rootBatch.commit());
      await assertFails(getDocs(collection(handoffCarer, "careSpaceInvites")));

      const wrongBatch = writeBatch(wrongCarer);
      wrongBatch.update(doc(wrongCarer, `careSpaceInvites/${code}`), { usedBy: "handoff-wrong" });
      wrongBatch.set(doc(wrongCarer, "careSpaces/handoff-family/members/handoff-wrong"), {
        role: "regular", status: "active", perms: noPerms, displayName: "Wrong", joinedAt: serverTimestamp(),
        invitedBy: "handoff-family", inviteId: code,
      });
      await assertFails(wrongBatch.commit());

      const joinBatch = writeBatch(handoffCarer);
      joinBatch.update(doc(handoffCarer, `careSpaceInvites/${code}`), { usedBy: "handoff-carer" });
      joinBatch.set(doc(handoffCarer, "careSpaces/handoff-family/members/handoff-carer"), {
        role: "regular", status: "active", perms: noPerms, displayName: "Carer", joinedAt: serverTimestamp(),
        invitedBy: "handoff-family", inviteId: code,
      });
      joinBatch.set(doc(handoffCarer, "users/handoff-carer/spaces/handoff-family"), {
        spaceId: "handoff-family", name: "Family care space", memberRole: "regular", joinedAt: serverTimestamp(),
      });
      await assertSucceeds(joinBatch.commit());
      await assertSucceeds(getDoc(doc(handoffCarer, "careSpaces/handoff-family")));
      await assertFails(updateDoc(doc(handoffCarer, `careSpaceInvites/${code}`), { usedBy: "handoff-carer" }));
      await assertFails(setDoc(doc(handoffFamily, "careSpaces/handoff-family/invites/legacy-code"), {
        toUid: "handoff-carer", role: "regular", status: "invited", invitedBy: "handoff-family",
      }));
    });
  } finally {
    await env.cleanup();
  }
});
