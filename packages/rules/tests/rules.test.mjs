import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const pairIdFor = (a, b) => [a, b].sort().join("_");

const profile = (side, card = {}) => ({
  side,
  displayName: side === "carer" ? "Carer" : "Family",
  postcode: "4000",
  photoUrl: "",
  updatedAt: serverTimestamp(),
  card,
  looking: { musts: {}, prefs: {} },
});

const booking = (familyUid, carerUid, overrides = {}) => ({
  familyUid,
  carerUid,
  date: "2026-11-12",
  from: "09:00",
  to: "12:00",
  rate: 32,
  estimate: 96,
  recurring: "none",
  weekdays: [],
  note: "",
  state: "requested",
  createdBy: familyUid,
  createdAt: serverTimestamp(),
  ...overrides,
});

const perms = (overrides = {}) => ({
  allergies: false,
  medication: false,
  photos: false,
  calendar: false,
  privateMessages: false,
  ...overrides,
});

const joinedMember = (uid, role, inviteId) => ({
  role,
  status: "active",
  perms: perms(),
  inviteId,
  invitedBy: "mom",
  joinedAt: serverTimestamp(),
});

const invite = (spaceId, role, expiresAt, createdBy = "mom") => ({
  spaceId,
  role,
  createdBy,
  createdAt: serverTimestamp(),
  expiresAt,
  usedBy: null,
});

const seed = async (env, path, data) => env.withSecurityRulesDisabled(async (context) => {
  await setDoc(doc(context.firestore(), path), data);
});

const makeRelationship = async (env, familyUid, carerUid) => {
  await seed(env, `relationships/${pairIdFor(familyUid, carerUid)}`, {
    members: [familyUid, carerUid], familyUid, carerUid, state: "contact",
    createdBy: familyUid, createdAt: new Date(), createdDay: "2026-11-01",
  });
};

test("live rules baseline and v2 security extensions", { concurrency: 1 }, async (t) => {
  const env = await initializeTestEnvironment({
    projectId: "demo-cc",
    firestore: { rules, host: "127.0.0.1", port: 8085 },
  });
  const as = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "password" } }).firestore();
  const mom = as("mom");
  const nanny = as("nanny");
  const spy = as("spy");
  const mom2 = as("mom2");

  try {
    await t.test("owner creates space + admin member in one batch", async () => {
      const batch = writeBatch(mom);
      batch.set(doc(mom, "careSpaces/mom"), { ownerUid: "mom", name: "x", createdAt: "t" });
      batch.set(doc(mom, "careSpaces/mom/members/mom"), { role: "admin", status: "active" });
      await assertSucceeds(batch.commit());
    });
    await t.test("owner writes a child", () => assertSucceeds(setDoc(doc(mom, "careSpaces/mom/children/c1"), { name: "Mia" })));
    await t.test("outsider cannot read space", () => assertFails(getDoc(doc(spy, "careSpaces/mom"))));
    await t.test("outsider cannot read children (cross-family)", () => assertFails(getDoc(doc(spy, "careSpaces/mom/children/c1"))));
    await t.test("outsider cannot make himself admin of another space", () => assertFails(setDoc(doc(spy, "careSpaces/mom/members/spy"), { role: "admin", status: "active" })));
    await t.test("outsider cannot create a space owned by someone else", () => assertFails(setDoc(doc(spy, "careSpaces/x1"), { ownerUid: "mom", name: "x", createdAt: "t" })));
    await t.test("admin adds nanny as regular carer", () => assertSucceeds(setDoc(doc(mom, "careSpaces/mom/members/nanny"), { role: "regular", status: "active", perms: perms({ privateMessages: true }) })));
    await t.test("nanny can read space and children", async () => {
      await assertSucceeds(getDoc(doc(nanny, "careSpaces/mom")));
      await assertSucceeds(getDoc(doc(nanny, "careSpaces/mom/children/c1")));
    });
    await t.test("nanny CANNOT edit allergies (children write)", () => assertFails(setDoc(doc(nanny, "careSpaces/mom/children/c1"), { name: "Mia", allergies: [] })));
    await t.test("nanny can write day story", () => assertSucceeds(setDoc(doc(nanny, "careSpaces/mom/dayStory/d1"), { childId: "c1", day: "2026-11-04", kind: "note", at: serverTimestamp(), text: "nap", by: "nanny" })));
    await t.test("nanny cannot promote herself", () => assertFails(setDoc(doc(nanny, "careSpaces/mom/members/nanny"), { role: "admin", status: "active" })));
    await t.test("nanny cannot add another member", () => assertFails(setDoc(doc(nanny, "careSpaces/mom/members/spy"), { role: "regular", status: "active" })));
    await t.test("viewer cannot send message", async () => {
      await setDoc(doc(mom, "careSpaces/mom/members/gran"), { role: "viewer", status: "active" });
      await assertFails(setDoc(doc(as("gran"), "careSpaces/mom/messages/m1"), { from: "gran", text: "hi", kind: "text", at: serverTimestamp() }));
    });
    await t.test("nanny message must be from herself", async () => {
      await assertFails(setDoc(doc(nanny, "careSpaces/mom/messages/m2"), { from: "mom", text: "hi", kind: "text", at: serverTimestamp() }));
      await assertSucceeds(setDoc(doc(nanny, "careSpaces/mom/messages/m3"), { from: "nanny", text: "hi", kind: "text", at: serverTimestamp() }));
    });
    await t.test("messages cannot be edited or deleted", async () => {
      await assertFails(setDoc(doc(nanny, "careSpaces/mom/messages/m3"), { from: "nanny", text: "edit", kind: "text", at: serverTimestamp() }));
      await assertFails(deleteDoc(doc(mom, "careSpaces/mom/messages/m3")));
    });
    await t.test("removed member is locked out", async () => {
      await assertSucceeds(deleteDoc(doc(mom, "careSpaces/mom/members/nanny")));
      await assertFails(getDoc(doc(nanny, "careSpaces/mom")));
      await assertFails(getDoc(doc(nanny, "careSpaces/mom/children/c1")));
    });
    await t.test("inactive member is locked out", async () => {
      await setDoc(doc(mom, "careSpaces/mom/members/ex"), { role: "regular", status: "removed" });
      await assertFails(getDoc(doc(as("ex"), "careSpaces/mom")));
    });
    await t.test("entitlements cannot be client-written", async () => {
      await assertFails(setDoc(doc(mom, "entitlements/mom"), { plan: "pro" }));
      await assertFails(setDoc(doc(mom, "_entitlements/mom"), { plan: "pro" }));
      await seed(env, "_entitlements/mom", { plan: "finding" });
      await assertFails(updateDoc(doc(mom, "_entitlements/mom"), { plan: "search_pass" }));
      await assertFails(deleteDoc(doc(mom, "_entitlements/mom")));
    });
    await t.test("daily recap run markers are server-only", async () => {
      const marker = "_dailyRecapRuns/mom_2026-11-04";
      await assertFails(setDoc(doc(mom, marker), { uid: "mom", date: "2026-11-04" }));
      await seed(env, marker, { uid: "mom", date: "2026-11-04" });
      await assertFails(getDoc(doc(mom, marker)));
      await assertFails(updateDoc(doc(mom, marker), { sentAt: serverTimestamp() }));
      await assertFails(deleteDoc(doc(mom, marker)));
    });

    await t.test("second family isolated from first", async () => {
      const batch = writeBatch(mom2);
      batch.set(doc(mom2, "careSpaces/mom2"), { ownerUid: "mom2", name: "y", createdAt: "t" });
      batch.set(doc(mom2, "careSpaces/mom2/members/mom2"), { role: "admin", status: "active" });
      await batch.commit();
      await assertFails(getDoc(doc(mom2, "careSpaces/mom")));
      await assertFails(getDoc(doc(mom, "careSpaces/mom2")));
    });

    await t.test("admin cannot put allergies in child profile", () => assertFails(setDoc(doc(mom, "careSpaces/mom/children/c2"), { name: "Mia", allergies: ["peanut"] })));

    await t.test("family card accepts parent, household, essentials, and gallery extras", async () => {
      const owner = as("profile-family-extras");
      const card = {
        gallery: ["users/profile-family-extras/gallery/a.jpg"], mainPhotoIndex: 0,
        parentNames: ["Ari", "Sam"],
        householdPrefs: { pets: true, smoking: false, languagesAtHome: ["English"], houseRules: "Shoes off" },
        essentials: { schedule: "essential", budget: "flexible", minAgeGroupsOk: true },
      };
      await assertSucceeds(setDoc(doc(owner, "profiles/profile-family-extras"), profile("family", card)));
    });
    await t.test("family card accepts full au-pair host extras", async () => {
      const owner = as("profile-family-host");
      const card = {
        auPairHost: { country: "Australia", room: "Private", accommodation: "Bedroom", meals: "Meals included", daysOff: ["Sat", "Sun"], location: { city: "Brisbane" }, expectations: "Shared meals", durationMonths: 12, pocketMoneyPerWeek: 320, hoursPerWeek: 25, childcareDuties: ["School pickup"], otherHousework: ["Own laundry"], languages: ["English"], visaSupport: true, visaHelp: true, infantCareNeeded: false },
      };
      await assertSucceeds(setDoc(doc(owner, "profiles/profile-family-host"), profile("family", card)));
    });
    await t.test("carer card accepts gallery, age groups, ideal family, and au-pair extras", async () => {
      const owner = as("profile-carer");
      const ref = doc(owner, "profiles/profile-carer");
      const card = {
        headline: "Gentle and reliable carer", rate: 34, careTypes: ["nanny", "au_pair"],
        videoKey: "users/profile-carer/intro.webm", style: ["outdoors"], suburb: "West End",
        gallery: ["users/profile-carer/gallery/a.jpg", "users/profile-carer/gallery/b.jpg"], mainPhotoIndex: 1,
        ageGroups: ["infant", "toddler"], idealFamily: "Kind, clear communication",
        auPair: { arrival: "2027-01", durationMonths: 12, ageGroups: ["infant"], expectations: "Respectful communication", accommodation: "Private room", pocketMoneyExpectation: "A$300 weekly", culturalInterests: ["Cooking"] },
      };
      await assertSucceeds(setDoc(ref, profile("carer", card)));
      await assertFails(updateDoc(ref, { "card.reviewsSummary": { count: 1, avg: 5 } }));
    });
    await t.test("reviews summary stays server-only on sparse profile updates", async () => {
      const owner = as("review-guard");
      const ref = doc(owner, "profiles/review-guard");
      await assertSucceeds(setDoc(ref, profile("carer")));
      await assertFails(updateDoc(ref, { "card.reviewsSummary": { count: 1, avg: 5 } }));
    });
    await t.test("profile card denies invalid gallery, au-pair fields, and client reviews", async () => {
      await assertFails(setDoc(doc(as("bad-gallery"), "profiles/bad-gallery"), profile("carer", { gallery: ["users/someone-else/photo.jpg"] })));
      await assertFails(setDoc(doc(as("bad-aupair"), "profiles/bad-aupair"), profile("carer", { auPair: { durationMonths: 37 } })));
      await assertFails(setDoc(doc(as("bad-review"), "profiles/bad-review"), profile("carer", { reviewsSummary: { count: 1, avg: 5 } })));
    });
    await t.test("profile card cannot store qualification claims", () => assertFails(setDoc(doc(as("bad-card"), "profiles/bad-card"), profile("carer", { qualifications: ["verified"] }))));

    await t.test("qualification document may be created as submitted only", async () => {
      const pending = doc(mom, "users/mom/documents/qualification-1");
      await assertSucceeds(setDoc(pending, { kind: "bluecard", status: "submitted", fileKey: "users/mom/bluecard.pdf", submittedAt: serverTimestamp() }));
      await assertFails(setDoc(doc(mom, "users/mom/documents/qualification-verified"), { kind: "first-aid", status: "verified" }));
      await assertFails(setDoc(doc(mom, "users/mom/documents/qualification-checked"), { kind: "bluecard", status: "submitted", checkedOn: serverTimestamp() }));
      await assertFails(setDoc(doc(mom, "users/mom/documents/qualification-verifier"), { kind: "bluecard", status: "submitted", verifiedBy: "mom" }));
      await assertFails(updateDoc(pending, { status: "verified" }));
    });

    await t.test("verified records are server-only", async () => {
      await seed(env, "verified/mom", { status: "verified", checkedOn: new Date() });
      await assertFails(setDoc(doc(mom, "verified/mom"), { status: "verified", checkedOn: new Date(), verifiedBy: "mom" }));
      await assertFails(updateDoc(doc(mom, "verified/mom"), { status: "verified" }));
      await assertFails(deleteDoc(doc(mom, "verified/mom")));
    });

    await t.test("saved, blocks, and emergency contacts are owner-only", async () => {
      await assertSucceeds(setDoc(doc(mom, "users/mom/saved/carer"), { at: serverTimestamp() }));
      await assertSucceeds(setDoc(doc(mom, "users/mom/blocks/carer"), { at: serverTimestamp() }));
      await assertSucceeds(setDoc(doc(mom, "users/mom/emergencyContacts/main"), { contacts: [{ name: "Alex", phone: "+61 400 000 000", relation: "parent" }] }));
      await assertFails(setDoc(doc(mom, "users/mom/emergencyContacts/main"), { contacts: Array.from({ length: 4 }, (_, index) => ({ name: `Contact ${index}`, phone: "000" })) }));
      await assertFails(getDoc(doc(spy, "users/mom/saved/carer")));
      await assertFails(getDoc(doc(spy, "users/mom/blocks/carer")));
      await assertFails(getDoc(doc(spy, "users/mom/emergencyContacts/main")));
      await assertFails(setDoc(doc(spy, "users/mom/blocks/spy"), { at: serverTimestamp() }));
    });

    await t.test("booking state is family-requested, carer-decided, either-cancelled", async () => {
      const familyUid = "booking-family";
      const carerUid = "booking-carer";
      const outsider = as("booking-outsider");
      const family = as(familyUid);
      const carer = as(carerUid);
      const pairId = pairIdFor(familyUid, carerUid);
      await makeRelationship(env, familyUid, carerUid);

      const acceptedRef = doc(family, `relationships/${pairId}/bookings/b1`);
      await assertSucceeds(setDoc(acceptedRef, booking(familyUid, carerUid)));
      await assertFails(setDoc(doc(carer, `relationships/${pairId}/bookings/carer-created`), booking(familyUid, carerUid, { createdBy: carerUid })));
      await assertFails(updateDoc(acceptedRef, { state: "accepted", decidedAt: serverTimestamp() }));
      await assertFails(updateDoc(doc(outsider, `relationships/${pairId}/bookings/b1`), { state: "accepted", decidedAt: serverTimestamp() }));
      await assertSucceeds(updateDoc(doc(carer, `relationships/${pairId}/bookings/b1`), { state: "accepted", decidedAt: serverTimestamp() }));
      await assertSucceeds(updateDoc(acceptedRef, { state: "cancelled" }));

      const carerCancelRef = doc(family, `relationships/${pairId}/bookings/b2`);
      await assertSucceeds(setDoc(carerCancelRef, booking(familyUid, carerUid)));
      await assertSucceeds(updateDoc(doc(carer, `relationships/${pairId}/bookings/b2`), { state: "cancelled" }));

      const outsiderCancelRef = doc(family, `relationships/${pairId}/bookings/b3`);
      await assertSucceeds(setDoc(outsiderCancelRef, booking(familyUid, carerUid)));
      await assertFails(updateDoc(doc(outsider, `relationships/${pairId}/bookings/b3`), { state: "cancelled" }));

      const declinedRef = doc(family, `relationships/${pairId}/bookings/b4`);
      await assertSucceeds(setDoc(declinedRef, booking(familyUid, carerUid)));
      await assertSucceeds(updateDoc(doc(carer, `relationships/${pairId}/bookings/b4`), { state: "declined", decidedAt: serverTimestamp() }));
    });

    await t.test("care-space invite join is valid, unexpired, one-time, and role-bound", async () => {
      const inviteRef = doc(mom, "careSpaceInvites/invite-valid-001");
      await assertSucceeds(setDoc(inviteRef, invite("mom", "limited", new Date(Date.now() + 60_000))));
      const joiner = as("invitee");
      const batch = writeBatch(joiner);
      batch.update(doc(joiner, "careSpaceInvites/invite-valid-001"), { usedBy: "invitee" });
      batch.set(doc(joiner, "careSpaces/mom/members/invitee"), joinedMember("invitee", "limited", "invite-valid-001"));
      await assertSucceeds(batch.commit());
      await assertFails(updateDoc(doc(joiner, "careSpaces/mom/members/invitee"), { role: "admin" }));

      await seed(env, "careSpaceInvites/invite-expired-001", invite("mom", "regular", new Date(Date.now() - 60_000)));
      const expired = as("expired-user");
      const expiredBatch = writeBatch(expired);
      expiredBatch.update(doc(expired, "careSpaceInvites/invite-expired-001"), { usedBy: "expired-user" });
      expiredBatch.set(doc(expired, "careSpaces/mom/members/expired-user"), joinedMember("expired-user", "regular", "invite-expired-001"));
      await assertFails(expiredBatch.commit());

      await seed(env, "careSpaceInvites/invite-role-001", invite("mom", "viewer", new Date(Date.now() + 60_000)));
      const wrongRole = as("wrong-role-user");
      const wrongRoleBatch = writeBatch(wrongRole);
      wrongRoleBatch.update(doc(wrongRole, "careSpaceInvites/invite-role-001"), { usedBy: "wrong-role-user" });
      wrongRoleBatch.set(doc(wrongRole, "careSpaces/mom/members/wrong-role-user"), joinedMember("wrong-role-user", "regular", "invite-role-001"));
      await assertFails(wrongRoleBatch.commit());

      await assertFails(setDoc(doc(mom, "careSpaceInvites/invite-admin-role"), invite("mom", "admin", new Date(Date.now() + 60_000))));
    });

    await t.test("medical reads follow allergies and medication permissions", async () => {
      await seed(env, "careSpaces/mom/medical/c1", { childId: "c1", updatedAt: new Date() });
      await seed(env, "careSpaces/mom/medical/c1/allergies/main", { items: [{ name: "peanut" }], updatedBy: "mom", updatedAt: new Date(), alertId: "seed-allergy" });
      await seed(env, "careSpaces/mom/medical/c1/medication/main", { items: [{ name: "inhaler" }], updatedBy: "mom", updatedAt: new Date(), alertId: "seed-medication" });
      await assertSucceeds(setDoc(doc(mom, "careSpaces/mom/members/allergy-reader"), { role: "regular", status: "active", perms: perms({ allergies: true }) }));
      await assertSucceeds(setDoc(doc(mom, "careSpaces/mom/members/medication-reader"), { role: "regular", status: "active", perms: perms({ medication: true }) }));
      await assertSucceeds(setDoc(doc(mom, "careSpaces/mom/members/health-reader"), { role: "viewer", status: "active", perms: perms({ allergies: true, medication: true }) }));

      const allergyReader = as("allergy-reader");
      const medicationReader = as("medication-reader");
      const healthReader = as("health-reader");
      await assertSucceeds(getDoc(doc(allergyReader, "careSpaces/mom/medical/c1/allergies/main")));
      await assertFails(getDoc(doc(allergyReader, "careSpaces/mom/medical/c1/medication/main")));
      await assertFails(getDoc(doc(allergyReader, "careSpaces/mom/medical/c1")));
      await assertSucceeds(getDoc(doc(medicationReader, "careSpaces/mom/medical/c1/medication/main")));
      await assertFails(getDoc(doc(medicationReader, "careSpaces/mom/medical/c1/allergies/main")));
      await assertSucceeds(getDoc(doc(healthReader, "careSpaces/mom/medical/c1")));
      await assertSucceeds(getDoc(doc(healthReader, "careSpaces/mom/medical/c1/allergies/main")));
      await assertSucceeds(getDoc(doc(healthReader, "careSpaces/mom/medical/c1/medication/main")));
    });

    await t.test("medical writes need admin and a matching alert in the same batch", async () => {
      const medicalRef = "careSpaces/mom/medical/c2/allergies/main";
      const alertRef = "careSpaces/mom/alerts/medical-c2-allergies";
      const batch = writeBatch(mom);
      batch.set(doc(mom, medicalRef), { items: [{ name: "egg" }], updatedBy: "mom", updatedAt: serverTimestamp(), alertId: "medical-c2-allergies" });
      batch.set(doc(mom, alertRef), { kind: "medical-change", by: "mom", at: serverTimestamp(), summary: "Allergy list changed", childId: "c2", section: "allergies", recordId: "main" });
      await assertSucceeds(batch.commit());

      const missingAlert = writeBatch(mom);
      missingAlert.set(doc(mom, "careSpaces/mom/medical/c3/medication/main"), { items: [{ name: "medicine" }], updatedBy: "mom", updatedAt: serverTimestamp(), alertId: "no-alert" });
      await assertFails(missingAlert.commit());

      const carer = as("nanny");
      const carerBatch = writeBatch(carer);
      carerBatch.set(doc(carer, "careSpaces/mom/medical/c4/medication/main"), { items: [], updatedBy: "nanny", updatedAt: serverTimestamp(), alertId: "carer-alert" });
      carerBatch.set(doc(carer, "careSpaces/mom/alerts/carer-alert"), { kind: "medical-change", by: "nanny", at: serverTimestamp(), summary: "No", childId: "c4", section: "medication", recordId: "main" });
      await assertFails(carerBatch.commit());

      await assertFails(setDoc(doc(mom, "careSpaces/mom/alerts/orphan-alert"), { kind: "medical-change", by: "mom", at: serverTimestamp(), summary: "Orphan", childId: "c9", section: "allergies", recordId: "main" }));
    });

    await t.test("check-ins require a live accepted booking and are append-only", async () => {
      const familyUid = "checkin-family";
      const carerUid = "checkin-carer";
      const pairId = pairIdFor(familyUid, carerUid);
      await makeRelationship(env, familyUid, carerUid);
      const family = as(familyUid);
      const carer = as(carerUid);
      const bookingRef = doc(family, `relationships/${pairId}/bookings/checkin-booking`);
      await assertSucceeds(setDoc(bookingRef, booking(familyUid, carerUid)));
      await assertSucceeds(updateDoc(doc(carer, `relationships/${pairId}/bookings/checkin-booking`), { state: "accepted", decidedAt: serverTimestamp() }));
      const checkinRef = doc(carer, `relationships/${pairId}/checkins/arrival`);
      await assertSucceeds(setDoc(checkinRef, { by: carerUid, kind: "arrived", bookingId: "checkin-booking", at: serverTimestamp() }));
      await assertFails(updateDoc(checkinRef, { kind: "leaving" }));
      await assertFails(deleteDoc(checkinRef));
    });

    await t.test("only admins decide time off and calendar records are not silently deleted", async () => {
      const carer = as("calendar-carer");
      await assertSucceeds(setDoc(doc(mom, "careSpaces/mom/members/calendar-carer"), {
        role: "limited", status: "active", perms: perms({ calendar: true }),
      }));
      const timeOff = doc(carer, "careSpaces/mom/calendar/time-off-1");
      await assertSucceeds(setDoc(timeOff, {
        kind: "timeoff", title: "Day off", start: "2026-11-12T09:00:00Z", end: "2026-11-12T17:00:00Z",
        ownerUid: "calendar-carer", state: "requested",
      }));
      await assertFails(updateDoc(timeOff, { state: "approved" }));
      await assertFails(updateDoc(timeOff, { state: "swap", swap: { start: "2026-11-13T09:00:00Z", end: "2026-11-13T17:00:00Z" } }));
      await assertSucceeds(updateDoc(doc(mom, "careSpaces/mom/calendar/time-off-1"), {
        state: "swap", swap: { start: "2026-11-13T09:00:00Z", end: "2026-11-13T17:00:00Z" },
      }));
      await assertFails(deleteDoc(doc(mom, "careSpaces/mom/calendar/time-off-1")));
      await assertFails(setDoc(doc(carer, "careSpaces/mom/calendar/fake-booking"), {
        kind: "booking", title: "Fake", start: "2026-11-12T09:00:00Z", end: "2026-11-12T12:00:00Z",
        ownerUid: "calendar-carer", state: "active",
      }));
    });
  } finally {
    await env.cleanup();
  }
});
