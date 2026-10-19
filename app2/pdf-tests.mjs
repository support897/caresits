// Caresitters PDF extraction tests — plain Node asserts.
// The instrument drives the SHIPPED wrapper (pdf-text.js)
// and the SHIPPED vendored library beside it, against a
// real PDF fixture (test-fixtures/maria-santos.pdf, built
// by test-fixtures/make-fixture.py): the words that come
// out must be the fixture's own, and the draft built from
// them must ground in those words with nothing invented.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractPdfText } from "./pdf-text.js";
import { draftFromText } from "./resume.js";

let n = 0;
const ta = async (name, fn) => { await fn(); n += 1; console.log("ok -", name); };

const bytes = new Uint8Array(readFileSync(new URL("./test-fixtures/maria-santos.pdf", import.meta.url)));
const text = await extractPdfText(bytes);

await ta("the fixture's own words come out, line for line", async () => {
  for (const line of ["Maria Santos", "Nanny and babysitter", "0412 555 018", "maria.santos@example.com",
    "Languages Spanish and English", "Experience 6 years with babies and toddlers",
    "First Aid certificate current", "Working With Children Check"]) {
    assert.ok(text.includes(line), `missing: ${line}`);
  }
});
await ta("the extractor invents nothing: every output line is a fixture line", async () => {
  const fixture = ["Maria Santos", "Nanny and babysitter", "Mobile 0412 555 018", "Email maria.santos@example.com",
    "Languages Spanish and English", "Experience 6 years with babies and toddlers",
    "First Aid certificate current", "Working With Children Check"];
  for (const line of text.split("\n")) assert.ok(fixture.includes(line.trim()), `unexpected line: ${line}`);
});
await ta("the draft from the PDF words grounds only in them", async () => {
  const d = draftFromText(text, { languages: ["English", "Spanish"], nationalities: [] });
  assert.equal(d.ok, true);
  assert.equal(d.answers.displayName, "Maria Santos");
  assert.deepEqual([...d.answers.languages].sort(), ["English", "Spanish"]);
  assert.equal(d.experienceYears, 6);
  // The grounding invariant, in the model's own terms: no
  // word enters the draft that the source does not carry.
  // (A span like the languages list is the matched words
  // joined, so the check is word by word, not substring.)
  const srcWords = new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  for (const span of Object.values(d.spans)) {
    for (const w of String(span).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
      assert.ok(srcWords.has(w), `ungrounded word "${w}" in span: ${span}`);
    }
  }
});
await ta("nothing about driving appears: the fixture never claims it", async () => {
  const d = draftFromText(text, { languages: ["English", "Spanish"], nationalities: [] });
  const all = JSON.stringify(d).toLowerCase();
  assert.ok(!all.includes("driv"), "an invented driving claim entered the draft");
  assert.ok(!all.includes("italian"), "an invented language entered the draft");
});
await ta("bytes that are not a PDF refuse, so the caller speaks the honest line", async () => {
  await assert.rejects(() => extractPdfText(new TextEncoder().encode("just some words, not a pdf")));
});
await ta("empty bytes give empty text, never a crash", async () => {
  assert.equal(await extractPdfText(new Uint8Array(0)), "");
  assert.equal(await extractPdfText(null), "");
});

console.log(`\nALL ${n} pdf checks passed`);
