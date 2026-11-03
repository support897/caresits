import { _DICT, LANGS } from "./i18n.js"; import assert from "node:assert";
const need = ["es","ar","hi","vi","yue","zh"]; let n = 0;
for (const [k, v] of Object.entries(_DICT)) { for (const l of need) { assert.ok(v[l] && v[l].length, `${k} missing ${l}`); } n++; }
assert.equal(LANGS.length, 7); console.log("i18n ok", n, "keys x 6 languages");
