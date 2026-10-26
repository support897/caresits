// Arabic coverage + fence checks. Mirrors the Chinese legs in
// lang-zh-tests.mjs, pointed at lang-q-ar.js + lang-ar-ui.js.
// The wiring that merges these as STRINGS.ar lands separately;
// until then this file proves the tables themselves.
import assert from "node:assert/strict";
Object.defineProperty(globalThis, "navigator", { value: { language: "ar-EG" }, configurable: true });
globalThis.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = v; } };
const { STRINGS } = await import("./lang.js");
const { Q_EN } = await import("./lang-q.js");
const { Q_ES } = await import("./lang-q-es.js");
const { Q_AR } = await import("./lang-q-ar.js");
const { UI_AR } = await import("./lang-ar-ui.js");
const { UI_ZH } = await import("./lang-zh-ui.js");
let n = 0; const ck = (name, fn) => { fn(); n++; console.log("ok -", name); };
const CHECKS = new Set(["Register verified", "Document sighted", "Getting them now"]);
const FENCED_Q = ["q.checksLevel.o0", "q.checksLevel.o1", "q.checksLevel.o2"];
const ph = (s) => [...s.matchAll(/\{[a-z]+\}/g)].map((m) => m[0]).sort().join(",");

ck("the three fenced checks options are absent from the Arabic registry", () =>
  FENCED_Q.forEach((k) => assert.ok(!(k in Q_AR), k)));
ck("the whole questionnaire is covered in Arabic except the fenced checks phrases", () => {
  const missing = Object.keys(Q_EN).filter((k) => !(k in Q_AR));
  assert.deepEqual(missing.sort(), [...FENCED_Q].sort());
  assert.ok(missing.every((k) => CHECKS.has(Q_EN[k])));
});
ck("coverage count is exactly 647 of 650", () => {
  assert.equal(Object.keys(Q_EN).length, 650);
  assert.equal(Object.keys(Q_AR).length, 647);
});
ck("no checks phrase is translated anywhere in the Arabic registry", () =>
  assert.ok(Object.entries(Q_AR).every(([k]) => !CHECKS.has(Q_EN[k]))));
ck("no Arabic key sits under checks. or legal. in either table", () => {
  assert.ok(Object.keys(UI_AR).every((k) => !k.startsWith("checks.") && !k.startsWith("legal.")));
  assert.ok(Object.keys(Q_AR).every((k) => !k.startsWith("checks.") && !k.startsWith("legal.")));
});
ck("the English checks phrases appear as values zero times in both Arabic tables", () => {
  assert.ok(Object.values(Q_AR).every((v) => !CHECKS.has(v)));
  assert.ok(Object.values(UI_AR).every((v) => !CHECKS.has(v)));
});
ck("every UI key in the Spanish table has an Arabic twin, and no extras", () => {
  const uiKeys = Object.keys(STRINGS.es).filter((k) => !(k in Q_ES));
  for (const k of uiKeys) assert.ok(UI_AR[k], k);
  assert.deepEqual(Object.keys(UI_AR).sort(), uiKeys.sort());
});
// The Arabic table covers the whole live set. The 9 country keys
// were once Arabic only; the country build backfilled them into
// the Chinese table too, so the two tables now stand equal. The
// push build added 5 push keys to every table (400 in total).
ck("the Arabic and Chinese UI tables carry the same keys, in full", () => {
  for (const k of Object.keys(UI_ZH)) assert.ok(UI_AR[k], k);
  assert.deepEqual(Object.keys(UI_AR).filter((k) => !(k in UI_ZH)).sort(), []);
});
ck("UI coverage count is exactly 611 (401 + the 134 two homes keys: the two home postures, the child age and loves words, the love list and the activity bank) + homes.copyFail, the line the copy button speaks when the copy is refused + the four form.need lines the inline Add forms speak when a piece is missing (child, contact, shift, reminder) + door.noNet and acct.noNet, the honest connection lines the door and the account page speak when the network fails + board.emptyTitle, the Urgent board empty card's title + the four gallery keys (title, body, add, remove) the F14 carer photo gallery speaks + the fourteen level keys (the welcome picker names and lines, the stop panel body and buttons, the at line and the profile label) + door.madeAccount, the line the door speaks out loud when a sign in creates the account + the six plans keys (title, locked, pass, joinPass, notYet, close) the plans sheet and the locked tap speak + the four deletion keys (photo.remove, photo.removed, resume.remove, resume.temp) the remove paths speak) + the six enabling keys (plans.buying, plans.done, plans.failed, plans.restore, plans.restored, plans.appOnly) the purchase buttons and the web line speak) + the five G7 keys (plans.renewFinding, plans.renewPlus, plans.renew2, plans.privacy, plans.terms) the paywall disclosure and its legal links speak) + journey.dLeadLocal, the honest lead the Done screen speaks when the answers landed on this device only) + the five Polar C1/C2 keys (the four clock greeting keys the home salutation speaks by the device hour + find.mapEmpty, the map panel honest empty line) + door.working, the line the door speaks while a social sign in is working + plans.demoLine, the line the plans sheet speaks when the demo reaches for a money road + homes.qReading, the home card's honest line before the boot's seam lands", () => assert.equal(Object.keys(UI_AR).length, 611));
ck("no value in either Arabic table is empty", () => {
  for (const [k, v] of [...Object.entries(Q_AR), ...Object.entries(UI_AR)]) assert.ok(typeof v === "string" && v.length > 0, k);
});
ck("placeholders survive translation, key for key", () => {
  for (const [k, v] of Object.entries(Q_AR)) assert.equal(ph(v), ph(Q_EN[k]), k);
  const uiKeys = Object.keys(STRINGS.es).filter((k) => !(k in Q_ES));
  for (const k of uiKeys) assert.equal(ph(UI_AR[k]), ph(STRINGS.en[k]), k);
});
ck("the popup keeps its exact plan names and prices", () => {
  assert.ok(UI_AR["popup.finding"].includes("Finding") && UI_AR["popup.finding"].includes("A$14.95"));
  assert.ok(UI_AR["popup.plus"].includes("Family Plus") && UI_AR["popup.plus"].includes("A$24.95"));
});
ck("the brand name stays in Latin script on the door", () =>
  assert.ok(UI_AR["door.join"].includes("Caresitters")));
ck("no Arabic value introduces a hyphen the English does not have", () => {
  for (const [k, v] of Object.entries(Q_AR)) assert.ok(!v.includes("-") || Q_EN[k].includes("-"), k);
  const uiKeys = Object.keys(STRINGS.es).filter((k) => !(k in Q_ES));
  for (const k of uiKeys) assert.ok(!UI_AR[k].includes("-") || STRINGS.en[k].includes("-"), k);
});
const total = Object.keys(Q_EN).length, covered = Object.keys(Q_AR).length;
const uiTotal = Object.keys(STRINGS.es).filter((k) => !(k in Q_ES)).length;
console.log(`registry coverage: ${covered}/${total} keys in Arabic (the rest are the fenced checks phrases)`);
console.log(`UI coverage: ${Object.keys(UI_AR).length}/${uiTotal} keys in Arabic`);
console.log(`\nALL ${n} ar language checks passed`);
