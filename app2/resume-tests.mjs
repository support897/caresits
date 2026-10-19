import assert from "node:assert/strict";
import { draftFromText, buildHandoff } from "./resume.js";
import { LANGS, NATIONALITIES } from "./questions.js";
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log("ok -", name); };
const sample = [
  "Maria Lopez",
  "Randwick NSW 2031",
  "I speak Spanish and English fluently.",
  "Nationality: Colombian",
  "Current First Aid and CPR certificate",
  "6 years experience as a nanny",
].join("\n");
const opts = { languages: LANGS, nationalities: NATIONALITIES };
t("rich sample drafts the name", () => { const d = draftFromText(sample, opts); assert.equal(d.answers.displayName, "Maria Lopez"); assert.equal(d.spans.displayName, "Maria Lopez"); });
t("rich sample drafts the postcode", () => { const d = draftFromText(sample, opts); assert.equal(d.answers.postcode, "2031"); assert.equal(d.spans.postcode, "2031"); });
t("rich sample drafts the languages in canonical spelling", () => { const d = draftFromText(sample, opts); assert.deepEqual([...d.answers.languages].sort(), ["English", "Spanish"]); assert.ok(d.spans.languages.includes("Spanish")); assert.ok(d.spans.languages.includes("English")); });
t("rich sample drafts the nationality first found only", () => { const d = draftFromText(sample, opts); assert.equal(d.answers.nationality, "Colombian"); assert.equal(d.spans.nationality, "Colombian"); });
t("rich sample drafts first aid in date from the current line", () => { const d = draftFromText(sample, opts); assert.deepEqual(d.deep, { xC22: "Yes, and it is in date" }); assert.equal(d.spans.xC22, "Current First Aid and CPR certificate"); });
t("rich sample reports experience years six", () => { const d = draftFromText(sample, opts); assert.equal(d.experienceYears, 6); });
t("rich sample marks every drafted field", () => { const d = draftFromText(sample, opts); assert.deepEqual(d.marks, ["displayName", "postcode", "languages", "nationality", "xC22"]); assert.equal(d.ok, true); });
t("rich sample never writes experience years into answers", () => { const d = draftFromText(sample, opts); assert.ok(!("experienceYears" in d.answers)); assert.ok(!("experience" in d.answers)); });
t("handoff shape carries side and feed and merges first aid", () => { const d = draftFromText(sample, opts); const h = buildHandoff(d); assert.equal(h.side, "carer"); assert.equal(h.feed, "resume"); assert.deepEqual(h.marks, d.marks); assert.equal(h.answers.displayName, "Maria Lopez"); assert.equal(h.answers.postcode, "2031"); assert.equal(h.answers.nationality, "Colombian"); assert.deepEqual(h.answers.languages, d.answers.languages); assert.equal(h.answers.xC22, "Yes, and it is in date"); });
t("general first aid line drafts the general value", () => { const d = draftFromText("Ana Silva\nFirst Aid certificate holder", opts); assert.deepEqual(d.deep, { xC22: "Yes, a general first aid certificate" }); assert.equal(d.spans.xC22, "First Aid certificate holder"); });
t("no postcode text has no postcode key", () => { const d = draftFromText("Maria Lopez\nI speak English.", opts); assert.ok(!("postcode" in d.answers)); assert.ok(!("postcode" in d.spans)); });
t("text without first aid has empty deep", () => { const d = draftFromText("Maria Lopez\nRandwick NSW 2031", opts); assert.deepEqual(d.deep, {}); assert.ok(!("xC22" in d.spans)); });
t("retail years alone give experience years null", () => { const d = draftFromText("10 years in retail management", opts); assert.equal(d.experienceYears, null); });
t("lowercase first line gives no display name", () => { const d = draftFromText("maria lopez\nRandwick NSW 2031", opts); assert.ok(!("displayName" in d.answers)); });
t("empty text gives ok false", () => { const d = draftFromText("", opts); assert.equal(d.ok, false); assert.deepEqual(d.answers, {}); assert.deepEqual(d.deep, {}); assert.deepEqual(d.marks, []); assert.deepEqual(d.spans, {}); assert.equal(d.experienceYears, null); });
t("handoff without first aid adds no first aid key", () => { const d = draftFromText("Maria Lopez\nRandwick NSW 2031", opts); const h = buildHandoff(d); assert.ok(!("xC22" in h.answers)); assert.equal(h.feed, "resume"); });
t("span claiming: a phone's head never drafts as the postcode", () => { const d = draftFromText("Ana Ruiz\nMobile 0412 555 018\nSpanish speaker", opts); assert.equal(d.answers.postcode, undefined); assert.ok(!d.marks.includes("postcode")); });
t("span claiming: a genuine postcode elsewhere still extracts, phone first in the document", () => { const d = draftFromText("Ana Ruiz\nMobile 0412 555 018\nBondi NSW 2026", opts); assert.equal(d.answers.postcode, "2026"); assert.equal(d.spans.postcode, "2026"); });
t("span claiming: a spaceless phone claims its run too", () => { const d = draftFromText("Ana Ruiz\nCall 0412555018\nPerth 6000", opts); assert.equal(d.answers.postcode, "6000"); });

console.log(`\nALL ${n} resume checks passed`);
