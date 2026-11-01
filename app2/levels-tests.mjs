import assert from "node:assert/strict";
import { levelOf, pairCap, mergeDeepAnswers } from "./levels.js";
import { FAMILY_PAGES, CARER_PAGES, BANDS, EXPERIENCE_YEAR_CHOICES, experienceComplete } from "./questions.js";
import { EXPANSION } from "./questions2.js";
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log("ok -", name); };
const fill = (pages, pred) => { const a = {}; for (const p of pages) for (const f of p.fields) if (pred(f)) a[f.id] = f.type === "chips" || f.type === "select" ? (f.options ? f.options[0] : "x") : f.type === "grid" ? { Thu: ["morning"] } : f.type === "band" ? [20, 40] : "x"; return a; };
const baseReq = fill(FAMILY_PAGES, (f) => f.required);
const quickSet = fill(EXPANSION.family, (f) => f.level === "quick");
const betterSet = fill(EXPANSION.family, (f) => f.level === "better");
const fullSet = fill(EXPANSION.family, (f) => f.level === "full");
t("carer experience: six years is an available pick and ONE answered age band completes it", () => {
  // OWNER RULING (Ilse, 31 Oct 2026): "Ticking one age group is
  // enough." A carer or au pair who has answered experience for
  // one age band has completed the experience question; Polar's
  // commit 430a655 stands and this suite was corrected to the
  // ruling (it previously demanded an answer for EVERY band).
  // The ruled behaviour is still proven both ways here: one band
  // completes the question; zero bands does not.
  assert.ok(EXPERIENCE_YEAR_CHOICES.includes("6"));
  assert.equal(experienceComplete(Object.fromEntries(BANDS.map((band) => [band, 6]))), true);
  assert.equal(experienceComplete({ "0-1": 6 }), true);
  assert.equal(experienceComplete(Object.fromEntries(BANDS.map((band, i) => [band, i === 2 ? "" : 6]))), true);
  assert.equal(experienceComplete(Object.fromEntries(BANDS.map((band, i) => [band, i === 0 ? 0 : 6]))), true);
  assert.equal(experienceComplete({}), false);
  assert.equal(experienceComplete(Object.fromEntries(BANDS.map((band) => [band, ""]))), false);
  assert.equal(experienceComplete(undefined), false);
});
t("levels: nothing answered is explore", () => { assert.equal(levelOf("family", {}), "explore"); });
t("levels: the core set alone does not connect until the quick set is done", () => { assert.equal(levelOf("family", { ...baseReq }), "explore"); });
t("levels: basics + the quick set is quick connect", () => { assert.equal(levelOf("family", { ...baseReq, ...quickSet }), "quick"); });
t("levels: the family full tier is empty after the cap, so quick plus better completes the set", () => { assert.equal(levelOf("family", { ...baseReq, ...quickSet, ...betterSet }), "full"); });
t("levels: the carer still owes the full tier after better", () => {
  const cReq = fill(CARER_PAGES, (f) => f.required);
  const cQuick = fill(EXPANSION.carer, (f) => f.level === "quick");
  const cBetter = fill(EXPANSION.carer, (f) => f.level === "better");
  const cFull = fill(EXPANSION.carer, (f) => f.level === "full");
  assert.equal(levelOf("carer", { ...cReq, ...cQuick, ...cBetter }), "better");
  assert.equal(levelOf("carer", { ...cReq, ...cQuick, ...cBetter, ...cFull }), "full");
});
t("levels: the pair is capped by the less complete side", () => { assert.equal(pairCap("full", "quick"), "quick"); });
// N1 (night round, build 113): the tier answers live as
// per-code documents keyed by pair; the boot and the save's
// publication merge them back through mergeDeepAnswers, or a
// completed member's level reads "explore" forever.
t("levels: the deep merge bridges pair documents into the field map", () => {
  const f = EXPANSION.carer.flatMap((p) => p.fields).find((x) => x.level === "quick");
  const merged = mergeDeepAnswers({}, { [f.pair]: { v: "yes", s: "must", feed: "trust" } }, "carer");
  assert.equal(merged[f.id], "yes");
});
t("levels: a completed carer judged from base plus documents reads past explore", () => {
  const cReq = fill(CARER_PAGES, (f) => f.required);
  const docs = {};
  for (const f of EXPANSION.carer.flatMap((p) => p.fields)) docs[f.pair] = { v: "x" };
  assert.equal(levelOf("carer", { ...cReq }), "explore");
  assert.equal(levelOf("carer", mergeDeepAnswers({ ...cReq }, docs, "carer")), "full");
});
t("levels: the merge never overwrites a base answer", () => {
  const f = EXPANSION.family.flatMap((p) => p.fields)[0];
  const merged = mergeDeepAnswers({ [f.id]: "mine" }, { [f.pair]: { v: "theirs" } }, "family");
  assert.equal(merged[f.id], "mine");
});
// The copied builds judged per track (account walk, 1 Nov
// 2026): the photo is required to finish on the nanny and
// family nanny tracks (a skip completes nothing there), the
// two part steps (education, frequency and urgency) count
// only when both parts are answered, and the one skippable
// step (applies to you) never blocks the gate.
t("levels: the nanny track gate wants the whole walk build, photo included", () => {
  const deep = fill(EXPANSION.carer, () => true);
  const walk = { displayName: "x", postcode: "2021", dateOfBirth: "1996-04-12", languages: ["English"], education: { level: "University", text: "Degree" }, childcareCert: true, medicalCert: false, personality: ["Warm"], experience: { "1-3": 6 }, agesAccepted: ["1-3"], specialNeedsExp: false, activities: ["Music"], comfortableWith: ["Cooking"], availability: { Thu: ["morning"] }, payFloor: 30, careLocationCarer: "At the family", aboutMe: "x", checksLevel: "Register verified", maxDistanceKm: 10, photoDone: true };
  assert.equal(levelOf("carer", { ...walk, ...deep }, "nanny"), "full");
  assert.equal(levelOf("carer", { ...walk, ...deep, photoDone: false, photoSkipped: true }, "nanny"), "explore");
  assert.equal(levelOf("carer", { ...walk, ...deep, education: { level: "University" } }, "nanny"), "explore");
  assert.equal(levelOf("carer", { ...walk, ...deep, education: "Certificate III" }, "nanny"), "full");
});
t("levels: the family nanny track gate wants frequency and urgency in both parts", () => {
  const deep = fill(EXPANSION.family, () => true);
  const walk = { displayName: "x", postcode: "2021", childrenCount: "1 child", childrenBands: ["1-3"], childrenTraits: ["Calm"], languages: ["English"], specialNeeds: false, role: ["Babysitter"], comfortableWith: ["Pets"], scheduleNeed: { Thu: ["morning"] }, frequency: { often: "One off", soon: "Just planning" }, payOffered: 35, careLocationFamily: "At our home", needWords: "x", mustLanguages: ["English"], nonSmoker: true, photoDone: true };
  assert.equal(levelOf("family", { ...walk, ...deep }, "family-nanny"), "full");
  assert.equal(levelOf("family", { ...walk, ...deep, frequency: { often: "One off" } }, "family-nanny"), "explore");
  assert.equal(levelOf("family", { ...walk, ...deep, photoDone: false, photoSkipped: true }, "family-nanny"), "explore");
});
console.log(`\nALL ${n} level checks passed`);
