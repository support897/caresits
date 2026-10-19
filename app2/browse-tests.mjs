import assert from "node:assert/strict";
import { assembleBrowse, kmBetween, stitchAnswers } from "./browse.js";
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log("ok -", name); };
const famDoc = { side: "family", displayName: "Sam", postcode: "2021", card: {
  childrenBands: ["1-3", "3-5"], languages: ["English", "Spanish"], pets: true, smokerHousehold: false, payOffered: 38,
  scheduleNeed: { Thu: ["morning", "afternoon"], Tue: ["afternoon"] }, latE2: -3388, lngE2: 15123 },
  looking: { musts: { languages: ["English"], checksLevel: "register", maxDistanceKm: 10, tasks: ["school runs"] },
             prefs: { personality: ["warm", "patient", "playful"], activities: ["park", "reading"], tasks: ["school runs", "cooking"], cooking: true, routineStyle: "steady rhythm" } } };
const anaCard = { age: 29, nationality: "Colombian", languages: ["English", "Spanish"], smoker: false,
  experience: { "1-3": 6, "3-5": 5 }, checksLevel: "register", drives: true, ownCar: true, petsOk: true, cooking: true,
  tasks: ["school runs", "cooking"], specialNeeds: true, availability: { Thu: ["morning", "afternoon"], Tue: ["afternoon"] },
  activities: ["park", "reading", "music"], personality: ["warm", "patient", "playful"], routineStyle: "steady rhythm",
  maxDistanceKm: 12, payFloor: 32, agesAccepted: ["1-3", "3-5"], agesPreferred: ["1-3", "3-5"], latE2: -3389, lngE2: 15124 };
const anaDoc = { side: "carer", displayName: "Ana", postcode: "2021", card: anaCard, looking: { musts: {}, prefs: {} } };
const meiDoc = { side: "carer", displayName: "Mei", postcode: "2021", card: { ...anaCard, availability: { Tue: ["afternoon"] } }, looking: { musts: {}, prefs: {} } };
t("distance from hundredthed coordinates", () => { assert.ok(kmBetween(famDoc.card, anaCard) > 0 && kmBetween(famDoc.card, anaCard) < 2); assert.equal(kmBetween({}, anaCard), null); });
t("family browse: Ana shows as a Perfect Pair in the Top 5", () => { const b = assembleBrowse(famDoc, [anaDoc, meiDoc]); assert.equal(b.top.length, 1); assert.equal(b.top[0].result.label, "Perfect Pair"); assert.equal(b.poolCount, 2); });
t("family nearly list names Mei's failed gate in plain words", () => { const b = assembleBrowse(famDoc, [anaDoc, meiDoc]); assert.equal(b.nearly.length, 1); assert.equal(b.nearly[0].failedGate, "not free on a day you need"); });
t("carer browse: families hunt back, and NO nearly list exists", () => { const b = assembleBrowse(anaDoc, [famDoc]); assert.equal(b.top.length, 1); assert.equal(b.nearly.length, 0); });
t("unknown distance never blocks and is never claimed", () => { const noCoords = { ...anaDoc, card: { ...anaCard, latE2: undefined, lngE2: undefined } }; const b = assembleBrowse(famDoc, [noCoords]); assert.equal(b.top.length, 1); assert.equal(b.top[0].distanceKm, null); });
t("stitch: answers docs rebuild the deep shape the engine reads", () => { const s = stitchAnswers({ side: "carer", looking: { musts: {}, prefs: {} } }, [{ code: "C22", data: { bucket: "prefs", v: "Yes, current", s: "pref", feed: "experience" } }, { code: "F8", data: { bucket: "musts", v: ["Peanuts"], feed: "tasks" } }]); assert.equal(s.looking.prefs.deep.C22.v, "Yes, current"); assert.equal(s.looking.musts.deep.F8.v[0], "Peanuts"); });
t("swept carer drops out of family search entirely (no entry, no nearly)", () => { const swept = { ...anaDoc, photoClearedAt: 1799999999000 }; const b = assembleBrowse(famDoc, [swept, meiDoc]); assert.equal(b.poolCount, 1); assert.equal(b.top.length, 0); assert.equal(b.nearly.length, 1); assert.equal(b.nearly[0].doc.displayName, "Mei"); });
t("the drop is the carer's stamp alone: a family doc is never filtered by it", () => { const f2 = { ...famDoc, displayName: "Fay", photoClearedAt: 1799999999000 }; const b = assembleBrowse(anaDoc, [f2]); assert.equal(b.top.length, 1); });
t("a cleared stamp (fresh photo landed) puts the carer back in search", () => { const back = { ...anaDoc, photoClearedAt: null }; const b = assembleBrowse(famDoc, [back]); assert.equal(b.poolCount, 1); assert.equal(b.top.length, 1); });

console.log(`\nALL ${n} browse checks passed`);
