import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const maxStrings = (prefix, size) => Array.from({ length: size }, (_, index) => `${prefix}-${index}`);
const longText = (length) => "x".repeat(length);
const weekdayMap = Object.fromEntries(weekdays.map((day) => [day, true]));
const validAgeGroups = ["newborn", "infant", "toddler", "preschool", "school"];

function maximalCard(uid) {
  return {
    childrenBands: maxStrings("band", 20),
    languages: maxStrings("language", 20),
    pets: maxStrings("pet", 20),
    smokerHousehold: false,
    scheduleNeed: weekdayMap,
    payOffered: 50,
    age: 30,
    nationality: "Australian",
    cultureOffer: "Family culture",
    smoker: false,
    experience: { "0-1": true, "1-3": true, "3-5": true, "5-12": true, "12+": true },
    checksLevel: "verified",
    availability: weekdayMap,
    drives: true,
    ownCar: true,
    cooking: true,
    tasks: maxStrings("task", 30),
    tasksRefused: maxStrings("refused", 30),
    activities: maxStrings("activity", 30),
    personality: maxStrings("trait", 20),
    routineStyle: maxStrings("routine", 20),
    agesAccepted: validAgeGroups,
    agesPreferred: validAgeGroups,
    petsOk: true,
    smokerHouseholdOk: true,
    nonSmokerHousehold: true,
    specialNeeds: maxStrings("need", 20),
    payFloor: 0,
    maxDistanceKm: 100,
    latE2: -2730,
    lngE2: 15303,
    headline: longText(80),
    rate: 50,
    budgetMax: 100,
    careTypes: ["babysitter", "nanny", "au_pair"],
    kids: Array.from({ length: 8 }, (_, index) => ({ name: `Child ${index}`, ageYears: index })),
    videoKey: `users/${uid}/intro.webm`,
    style: maxStrings("style", 20),
    suburb: longText(80),
    instantBook: true,
    lastActive: 1_799_999_999_999,
    weights: { experience: 1, personality: 1, availability: 1, budget: 1, location: 1, activities: 1 },
    auPair: {
      on: true,
      arrival: longText(200),
      durationMonths: 36,
      homeCountry: longText(80),
      english: longText(60),
      infant: true,
      drives: true,
      swim: true,
      destinations: maxStrings("destination", 20),
      languages: maxStrings("pair-language", 20),
      preferredAges: validAgeGroups,
      ageGroups: validAgeGroups,
      accommodation: longText(300),
      pocketMoneyExpectation: longText(160),
      culturalInterests: maxStrings("interest", 30),
      expectations: longText(300),
      visaNotes: longText(300),
    },
    auPairHost: {
      country: longText(80),
      room: longText(300),
      accommodation: longText(300),
      meals: longText(300),
      daysOff: weekdays,
      location: { suburb: longText(80), city: longText(80) },
      expectations: longText(300),
      durationMonths: 36,
      visaSupport: true,
      pocketMoneyPerWeek: 500,
      hoursPerWeek: 40,
      childcareDuties: maxStrings("duty", 30),
      otherHousework: maxStrings("housework", 30),
      languages: maxStrings("host-language", 20),
      visaHelp: true,
      infantCareNeeded: true,
    },
    alsoSide: {
      side: "carer",
      about: longText(300),
      headline: longText(80),
      photoUrl: `users/${uid}/${longText(1960)}.webp`,
      videoKey: `users/${uid}/${longText(470)}.webm`,
      experienceYears: 30,
      rate: 50,
      availability: weekdayMap,
      careTypes: ["babysitter", "nanny", "au_pair"],
      kids: Array.from({ length: 8 }, (_, index) => ({ name: `Other child ${index}`, ageYears: index })),
      languages: maxStrings("other-language", 20),
      suburb: longText(80),
      scheduleNeed: weekdayMap,
      budgetMax: 100,
      maxDistanceKm: 100,
      style: maxStrings("other-style", 20),
      activities: maxStrings("other-activity", 30),
    },
    experienceYears: 30,
    photoUrl: `users/${uid}/profile.webp`,
    parentNames: maxStrings("parent", 4),
    householdPrefs: {
      pets: true,
      smoking: false,
      languagesAtHome: maxStrings("home-language", 20),
      houseRules: longText(300),
    },
    essentials: { schedule: "essential", budget: "flexible", minAgeGroupsOk: true },
    ageGroups: validAgeGroups,
    idealFamily: longText(300),
    gallery: Array.from({ length: 6 }, (_, index) => `users/${uid}/gallery/${index}.webp`),
    mainPhotoIndex: 5,
  };
}

function profile(card) {
  return {
    side: "family",
    displayName: "Family",
    postcode: "4000",
    photoUrl: "",
    updatedAt: serverTimestamp(),
    card,
    looking: { musts: {}, prefs: {} },
  };
}

test("maximal profile card creates and updates within Firestore rules limits", { concurrency: 1 }, async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-cc-maximal-card",
    firestore: { rules, host: "127.0.0.1", port: 8085 },
  });
  const uid = "maximal-card-owner";
  const owner = env.authenticatedContext(uid, { firebase: { sign_in_provider: "password" } }).firestore();
  const outsider = env.authenticatedContext("maximal-card-outsider", { firebase: { sign_in_provider: "password" } }).firestore();
  const ref = doc(owner, `profiles/${uid}`);
  const card = maximalCard(uid);

  try {
    await env.clearFirestore();
    await assertSucceeds(setDoc(ref, profile(card)));

    const updatedCard = { ...card, headline: "Updated maximal profile headline" };
    await assertSucceeds(updateDoc(ref, profile(updatedCard)));

    await assertFails(updateDoc(ref, { "card.reviewsSummary": { count: 1, avg: 5 } }));
    await assertFails(updateDoc(ref, { "card.verified": true }));
    await assertFails(updateDoc(ref, { "card.checkedOn": serverTimestamp() }));
    await assertFails(updateDoc(ref, { "card.verifiedBy": uid }));
    await assertFails(updateDoc(doc(outsider, `profiles/${uid}`), { displayName: "Not owner" }));
  } finally {
    await env.cleanup();
  }
});
