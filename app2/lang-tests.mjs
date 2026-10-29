import assert from "node:assert/strict";
// lang.js documents its own test mode: the shipped app stands
// ENGLISH_ONLY for now, and "tests set CARESITS_ALL_LANGS=1" to
// exercise the multilingual machinery this suite proves. The flag
// must stand before lang.js is imported (it is read at load).
process.env.CARESITS_ALL_LANGS = "1";
Object.defineProperty(globalThis, "navigator", { value: { language: "es-ES" }, configurable: true });
globalThis.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = v; } };
globalThis.sessionStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = v; }, removeItem(k) { delete this._m[k]; } };
globalThis.window = { CARESITS_UID: "lang-user" };
const { t, currentLang, setLang, applyI18n, STRINGS } = await import("./lang.js");
let n = 0; const ck = (name, fn) => { fn(); n++; console.log("ok -", name); };
ck("device language picks Spanish", () => assert.equal(currentLang(), "es"));
ck("a translated key reads Spanish", () => assert.equal(t("door.join"), "Unirme a Caresitters"));
ck("the signed-in user's language pick wins over the device", () => { setLang("en"); assert.equal(t("door.join"), "Join Caresitters"); assert.equal(localStorage.getItem("caresits-lang-lang-user"), "en"); setLang("es"); });
ck("the signed-out door follows the last chosen language", () => { setLang("ar"); window.CARESITS_UID = null; assert.equal(currentLang(), "ar"); assert.equal(t("door.rolePrompt"), "ما الذي أتى بك إلى هنا؟"); window.CARESITS_UID = "lang-user"; setLang("es"); });
ck("Arabic door direction is right to left", () => { globalThis.document = { documentElement: {} }; applyI18n({ querySelectorAll: () => [] }, "ar"); assert.equal(document.documentElement.lang, "ar"); assert.equal(document.documentElement.dir, "rtl"); });
ck("an untranslated key falls back to English, never blank", () => assert.equal(t("checks.level.register", "es"), STRINGS.en["checks.level.register"] ?? "checks.level.register"));
ck("guide copy in other languages falls back to English", () => assert.equal(t("guide.intro", "ar"), STRINGS.en["guide.intro"]));
ck("checks words carry NO Spanish value (human check rule)", () => assert.ok(Object.keys(STRINGS.es).every((k) => !k.startsWith("checks.") && !k.startsWith("legal."))));
ck("every English door key has a Spanish twin", () => { for (const k of Object.keys(STRINGS.en)) if (k.startsWith("door.")) assert.ok(STRINGS.es[k], k); });
ck("every shell + tour key has a Spanish twin", () => { for (const k of Object.keys(STRINGS.en)) if (k.startsWith("shell.") || k.startsWith("tour.")) assert.ok(STRINGS.es[k], k); });
ck("every guide key has a Spanish twin", () => { for (const k of Object.keys(STRINGS.en)) if (k.startsWith("guide.")) assert.ok(STRINGS.es[k], k); });
ck("every questionnaire question has English and Spanish bunny guidance", async () => {
  const { FAMILY_PAGES, CARER_PAGES } = await import("./questions.js");
  const { EXPANSION } = await import("./questions2.js");
  const ids = new Set(["country"]);
  for (const pages of [FAMILY_PAGES, CARER_PAGES, EXPANSION.family, EXPANSION.carer]) for (const p of pages) for (const f of p.fields) ids.add(f.id);
  for (const id of ids) for (const lang of ["en", "es"]) assert.ok(STRINGS[lang][`guide.why.${id}`], `${lang} ${id}`);
});
ck("Help prompts are clear in English and Spanish", () => { for (const k of ["help.title", "help.body", "help.answers", "help.privacy"]) { assert.ok(STRINGS.en[k], k); assert.ok(STRINGS.es[k], k); } });
ck("every find key has a Spanish twin", () => { for (const k of Object.keys(STRINGS.en)) if (k.startsWith("find.")) assert.ok(STRINGS.es[k], k); });
ck("the au pair Australia line stands in every language table, its English word for word", () => {
  assert.equal(STRINGS.en["find.auPairNote"], "In Australia an au pair lives with the family and helps with the children. Pocket money is often about $250 a week for about 25 hours of help, with 1.5 to 2 days off each week. Fair Work rules can treat an au pair as an employee, so agree the hours, the pocket money and the days off in writing before anyone travels.");
  for (const lang of ["es", "zh", "ar", "hi", "vi", "yue"]) assert.ok(STRINGS[lang]["find.auPairNote"], lang);
});
ck("the view switch words stand in every language table, their English word for word", () => {
  assert.equal(STRINGS.en["shell.connected"], "Connected");
  assert.equal(STRINGS.en["shell.today"], "Today");
  assert.equal(STRINGS.en["mode.title"], "Your view");
  assert.equal(STRINGS.en["mode.sell"], "Connected: your shared calendar, today's activities made for your kids, photo updates of their day, and messages, all in one place.");
  for (const k of ["shell.connected", "shell.today", "mode.title", "mode.sell"]) for (const lang of ["es", "zh", "ar", "hi", "vi", "yue"]) assert.ok(STRINGS[lang][k], `${lang} ${k}`);
});
ck("every home + matches + board key has a Spanish twin", () => { for (const k of Object.keys(STRINGS.en)) if (k.startsWith("home.") || k.startsWith("matches.") || k.startsWith("board.")) assert.ok(STRINGS.es[k], k); });
ck("every family key has a Spanish twin", () => { for (const k of Object.keys(STRINGS.en)) if (k.startsWith("family.")) assert.ok(STRINGS.es[k], k); });
ck("every week key has a Spanish twin", () => { for (const k of Object.keys(STRINGS.en)) if (k.startsWith("week.")) assert.ok(STRINGS.es[k], k); });
ck("every popup + thread key has a Spanish twin", () => { for (const k of Object.keys(STRINGS.en)) if (k.startsWith("popup.") || k.startsWith("thread.")) assert.ok(STRINGS.es[k], k); });
ck("every level key has a Spanish twin", () => { for (const k of Object.keys(STRINGS.en)) if (k.startsWith("level.")) assert.ok(STRINGS.es[k], k); });
ck("every safety key has a Spanish twin", () => { for (const k of Object.keys(STRINGS.en)) if (k.startsWith("safety.")) assert.ok(STRINGS.es[k], k); });
ck("every calendar key has a Spanish twin", () => { for (const k of Object.keys(STRINGS.en)) if (k.startsWith("cal.")) assert.ok(STRINGS.es[k], k); });
ck("every account page key has a Spanish twin, and the legal fence covers the account promises", () => {
  for (const k of Object.keys(STRINGS.en)) if (k.startsWith("acct.")) assert.ok(STRINGS.es[k], k);
  for (const k of ["legal.intro", "legal.taste", "legal.delete1", "legal.delete2"]) { assert.ok(STRINGS.en[k], k); assert.ok(!STRINGS.es[k], k); }
});
ck("every gate + reason key has a Spanish twin", () => { for (const k of Object.keys(STRINGS.en)) if (k.startsWith("gate.") || k.startsWith("reason.")) assert.ok(STRINGS.es[k], k); });
ck("the door names a dead connection honestly, and the inline Add forms name what is missing", async () => {
  const { readFileSync } = await import("node:fs");
  const door = readFileSync(new URL("./door.js", import.meta.url), "utf8");
  assert.ok(door.includes("auth/network-request-failed") && door.includes("door.noNet"), "door.js branches on the network code to door.noNet");
  assert.ok(door.includes("auth/wrong-password") && door.includes("door.mismatch") && door.includes("door.fail"), "the door distinguishes bad passwords from other sign-in failures");
  assert.equal(STRINGS.en["door.mismatch"], "That password does not match this email. Try again or tap Forgot your password.");
  const fam = readFileSync(new URL("./family.js", import.meta.url), "utf8");
  assert.ok(fam.includes("form.needChild"), "the children form names the missing name");
  const week = readFileSync(new URL("./week.js", import.meta.url), "utf8");
  for (const k of ["form.needContact", "form.needShift", "form.needReminder"]) assert.ok(week.includes(k), k);
});
ck("no two options of one question share a slug (codes never merge two answers)", async () => {
  const { FAMILY_PAGES, CARER_PAGES } = await import("./questions.js");
  const { EXPANSION } = await import("./questions2.js");
  const { slugify } = await import("../next-phase/engine/engine.mjs");
  for (const pages of [FAMILY_PAGES, CARER_PAGES, EXPANSION.family, EXPANSION.carer])
    for (const p of pages) for (const f of p.fields) {
      const slugs = (f.options || []).map(slugify);
      assert.equal(new Set(slugs).size, slugs.length, f.id);
    }
});
ck("the layer's English gate words equal the engine's own strings", async () => {
  const { GATE_CODES, REASON_CODES } = await import("../next-phase/engine/engine.mjs");
  for (const [text, code] of Object.entries(GATE_CODES)) assert.equal(STRINGS.en["gate." + code], text);
  for (const [text, code] of Object.entries(REASON_CODES)) assert.equal(STRINGS.en["reason." + code], text);
});
{
  const { planReport } = await import("./safety-actions.js");
  const plan = planReport({ reporterUid: "a", reportedUid: "b", surface: "card", category: "other", words: "", snapshot: {}, nowIso: "2026-10-16T00:00:00.000Z" });
  assert.equal(STRINGS.en["safety.ack"], plan.acknowledgement);
  n++; console.log("ok - the report acknowledgement in the layer equals the planner's own words");
}
ck("the English popup words stay the gate passed copy, word for word", () => {
  assert.equal(STRINGS.en["popup.title"], "You found someone worth writing to");
  assert.equal(STRINGS.en["popup.finding"], "Finding is A$14.95 a month, and you can stop any time.");
});
ck("every trust key has a Spanish twin, and the checks fence still holds in the app strings", () => {
  for (const k of Object.keys(STRINGS.en)) if (k.startsWith("trust.")) assert.ok(STRINGS.es[k], k);
  assert.ok(Object.keys(STRINGS.es).every((k) => !k.startsWith("checks.") && !k.startsWith("legal.")));
});
ck("every gallery key has a Spanish twin (the F14 carer photo gallery words)", () => {
  for (const k of Object.keys(STRINGS.en)) if (k.startsWith("gallery.")) assert.ok(STRINGS.es[k], k);
});
ck("the step line fills its numbers in Spanish", () => assert.equal(t("tour.step", "es", { a: 2, b: 5 }), "Paso 2 de 5"));
{
  const { Q_EN } = await import("./lang-q.js");
  const { Q_ES } = await import("./lang-q-es.js");
  const CHECKS = new Set(["Register verified", "Document sighted", "Getting them now"]);
  ck("no checks phrase is translated anywhere in the Spanish registry", () =>
    assert.ok(Object.entries(Q_ES).every(([k, v]) => !CHECKS.has(Q_EN[k]))));
  ck("the whole questionnaire is covered in Spanish except the fenced checks phrases", () => {
    const missing = Object.keys(Q_EN).filter((k) => !(k in Q_ES));
    assert.equal(missing.length, 3);
    assert.ok(missing.every((k) => CHECKS.has(Q_EN[k])));
  });
  const total = Object.keys(Q_EN).length, covered = Object.keys(Q_ES).length;
  console.log(`registry coverage: ${covered}/${total} keys in Spanish (the rest are the fenced checks phrases)`);
}
console.log(`\nALL ${n} language checks passed`);
