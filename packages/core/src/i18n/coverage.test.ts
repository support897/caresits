import { describe, it, expect } from "vitest";
import { allDicts, ALL_LANGS, LANGS, isRTL } from "./index";
describe("seven languages (dictionaries kept, only English enabled)", () => {
  it("only English is enabled", () => { expect(LANGS.map((l) => l[0])).toEqual(["en"]); });
  const langs = ALL_LANGS.map((l) => l[0]).filter((l) => l !== "en");
  for (const l of langs) it(`${l} has a large dictionary`, () => { expect(Object.keys(allDicts()[l] ?? {}).length).toBeGreaterThan(900); });
  it("only Arabic is RTL", () => { expect(ALL_LANGS.filter((l) => isRTL(l[0])).map((l) => l[0])).toEqual(["ar"]); });
});
