import { describe, it, expect } from "vitest";
import { allDicts, LANGS, isRTL } from "./index";
describe("seven languages", () => {
  const langs = LANGS.map((l) => l[0]).filter((l) => l !== "en");
  for (const l of langs) it(`${l} has a large dictionary`, () => { expect(Object.keys(allDicts()[l] ?? {}).length).toBeGreaterThan(900); });
  it("only Arabic is RTL", () => { expect(LANGS.filter((l) => isRTL(l[0])).map((l) => l[0])).toEqual(["ar"]); });
});
