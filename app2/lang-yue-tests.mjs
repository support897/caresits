// Traditional Chinese (Hong Kong reading) coverage + fence checks.
// Mirrors the Arabic legs in lang-ar-tests.mjs, pointed at
// lang-q-yue.js + lang-yue-ui.js. The wiring that merges these as
// STRINGS.yue lands separately; until then this file proves the
// tables themselves.
import assert from "node:assert/strict";
Object.defineProperty(globalThis, "navigator", { value: { language: "zh-HK" }, configurable: true });
globalThis.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = v; } };
const { STRINGS } = await import("./lang.js");
const { Q_EN } = await import("./lang-q.js");
const { Q_ES } = await import("./lang-q-es.js");
const { Q_YUE } = await import("./lang-q-yue.js");
const { UI_YUE } = await import("./lang-yue-ui.js");
const { UI_AR } = await import("./lang-ar-ui.js");
let n = 0; const ck = (name, fn) => { fn(); n++; console.log("ok -", name); };
const CHECKS = new Set(["Register verified", "Document sighted", "Getting them now"]);
const FENCED_Q = ["q.checksLevel.o0", "q.checksLevel.o1", "q.checksLevel.o2"];
const ph = (s) => [...s.matchAll(/\{[a-z]+\}/g)].map((m) => m[0]).sort().join(",");

ck("the three fenced checks options are absent from the Traditional Chinese registry", () =>
  FENCED_Q.forEach((k) => assert.ok(!(k in Q_YUE), k)));
ck("the whole questionnaire is covered in Traditional Chinese except the fenced checks phrases", () => {
  const missing = Object.keys(Q_EN).filter((k) => !(k in Q_YUE));
  assert.deepEqual(missing.sort(), [...FENCED_Q].sort());
  assert.ok(missing.every((k) => CHECKS.has(Q_EN[k])));
});
ck("coverage count is exactly 647 of 650", () => {
  assert.equal(Object.keys(Q_EN).length, 650);
  assert.equal(Object.keys(Q_YUE).length, 647);
});
ck("no checks phrase is translated anywhere in the Traditional Chinese registry", () =>
  assert.ok(Object.entries(Q_YUE).every(([k]) => !CHECKS.has(Q_EN[k]))));
ck("no Traditional Chinese key sits under checks. or legal. in either table", () => {
  assert.ok(Object.keys(UI_YUE).every((k) => !k.startsWith("checks.") && !k.startsWith("legal.")));
  assert.ok(Object.keys(Q_YUE).every((k) => !k.startsWith("checks.") && !k.startsWith("legal.")));
});
ck("the English checks phrases appear as values zero times in both Traditional Chinese tables", () => {
  assert.ok(Object.values(Q_YUE).every((v) => !CHECKS.has(v)));
  assert.ok(Object.values(UI_YUE).every((v) => !CHECKS.has(v)));
});
ck("every UI key in the Spanish table has a Traditional Chinese twin, and no extras", () => {
  const uiKeys = Object.keys(STRINGS.es).filter((k) => !(k in Q_ES));
  for (const k of uiKeys) assert.ok(UI_YUE[k], k);
  assert.deepEqual(Object.keys(UI_YUE).sort(), uiKeys.sort());
});
ck("the Traditional Chinese UI key set equals the Arabic key set, the freshest table", () => {
  assert.deepEqual(Object.keys(UI_YUE).sort(), Object.keys(UI_AR).sort());
});
ck("UI coverage count is exactly 589 (401 + the 134 two homes keys: the two home postures, the child age and loves words, the love list and the activity bank) + homes.copyFail, the line the copy button speaks when the copy is refused + the four form.need lines the inline Add forms speak when a piece is missing (child, contact, shift, reminder) + door.noNet and acct.noNet, the honest connection lines the door and the account page speak when the network fails + board.emptyTitle, the Urgent board empty card's title + the four gallery keys (title, body, add, remove) the F14 carer photo gallery speaks + the fourteen level keys (the welcome picker names and lines, the stop panel body and buttons, the at line and the profile label) + door.madeAccount, the line the door speaks out loud when a sign in creates the account + the six plans keys (title, locked, pass, joinPass, notYet, close) the plans sheet and the locked tap speak + the four deletion keys (photo.remove, photo.removed, resume.remove, resume.temp) the remove paths speak) + the six enabling keys (plans.buying, plans.done, plans.failed, plans.restore, plans.restored, plans.appOnly) the purchase buttons and the web line speak) + the five G7 keys (plans.renewFinding, plans.renewPlus, plans.renew2, plans.privacy, plans.terms) the paywall disclosure and its legal links speak) + journey.dLeadLocal, the honest lead the Done screen speaks when the answers landed on this device only) + the five Polar C1/C2 keys (the four clock greeting keys the home salutation speaks by the device hour + find.mapEmpty, the map panel honest empty line)", () => assert.equal(Object.keys(UI_YUE).length, 589));
ck("no value in either Traditional Chinese table is empty", () => {
  for (const [k, v] of [...Object.entries(Q_YUE), ...Object.entries(UI_YUE)]) assert.ok(typeof v === "string" && v.length > 0, k);
});
ck("placeholders survive translation, key for key", () => {
  for (const [k, v] of Object.entries(Q_YUE)) assert.equal(ph(v), ph(Q_EN[k]), k);
  const uiKeys = Object.keys(STRINGS.es).filter((k) => !(k in Q_ES));
  for (const k of uiKeys) assert.equal(ph(UI_YUE[k]), ph(STRINGS.en[k]), k);
});
ck("the popup keeps its exact plan names and prices", () => {
  assert.ok(UI_YUE["popup.finding"].includes("Finding") && UI_YUE["popup.finding"].includes("A$14.95"));
  assert.ok(UI_YUE["popup.plus"].includes("Family Plus") && UI_YUE["popup.plus"].includes("A$24.95"));
});
ck("the brand name stays in Latin script on the door", () =>
  assert.ok(UI_YUE["door.join"].includes("Caresitters")));
ck("no Traditional Chinese value introduces a hyphen the English does not have", () => {
  for (const [k, v] of Object.entries(Q_YUE)) assert.ok(!v.includes("-") || Q_EN[k].includes("-"), k);
  const uiKeys = Object.keys(STRINGS.es).filter((k) => !(k in Q_ES));
  for (const k of uiKeys) assert.ok(!UI_YUE[k].includes("-") || STRINGS.en[k].includes("-"), k);
});
const total = Object.keys(Q_EN).length, covered = Object.keys(Q_YUE).length;
const uiTotal = Object.keys(STRINGS.es).filter((k) => !(k in Q_ES)).length;
console.log(`registry coverage: ${covered}/${total} keys in Traditional Chinese (the rest are the fenced checks phrases)`);
console.log(`UI coverage: ${Object.keys(UI_YUE).length}/${uiTotal} keys in Traditional Chinese`);
console.log(`\nALL ${n} yue language checks passed`);
