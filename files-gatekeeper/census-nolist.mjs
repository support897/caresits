// The battery's SOURCE CENSUS leg (Q7 as amended,
// Security's record 6606fc55): the gatekeeper's TOKEN
// carries list because the platform welds it to read,
// so the compartment stands in the CODE — no list call
// may exist anywhere in the shipped service. This sweep
// runs at every battery run and stops the battery if it
// finds one. Case-insensitive, always (the census
// discipline banked 19 Oct 2026).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = ["gatekeeper.mjs", "server.mjs", "wrapper.mjs"];
const FORBIDDEN = [/listobjects/i, /list-type/i, /[?&]list\b/i, /method:\s*["']LIST["']/i, /"LIST"/, /'LIST'/];

let bad = 0;
for (const f of FILES) {
  const text = fs.readFileSync(path.join(here, f), "utf8");
  for (const re of FORBIDDEN) {
    const m = text.match(re);
    if (m) { bad++; console.log(`FAIL ${f}: ${re} matched "${m[0]}"`); }
  }
  // The presign fence must admit exactly PUT, GET, DELETE.
  if (f === "gatekeeper.mjs" && !/\["PUT", "GET", "DELETE"\]\.includes\(method\)/.test(text)) {
    bad++; console.log("FAIL gatekeeper.mjs: the presign method fence is not the sealed PUT/GET/DELETE shape");
  }
}
if (bad) { console.log(`SOURCE CENSUS FAIL (${bad}) — the battery stops`); process.exit(1); }
console.log("SOURCE CENSUS PASS: zero list constructions in the shipped gatekeeper (core + shell + wrapper); the presign fence admits PUT, GET, DELETE only");
