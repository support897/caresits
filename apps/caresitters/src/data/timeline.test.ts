import { describe, expect, it } from "vitest";
import { STEPS, merge, progress, toggle } from "./timeline";
describe("timeline", () => {
  it("starts empty, next is match", () => { const p = progress({}); expect(p.pct).toBe(0); expect(p.next?.id).toBe("match"); });
  it("toggles on and off", () => { const a = toggle({}, "match", "u1", 5); expect(a.match?.by).toBe("u1"); expect(toggle(a, "match", "u1")).toEqual({}); });
  it("merges both people", () => { const m = merge(toggle({}, "visa", "a", 9), toggle({}, "room", "f", 4)); expect(Object.keys(m).sort()).toEqual(["room", "visa"]); });
  it("full list is 100%", () => { const d = Object.fromEntries(STEPS.map((s) => [s.id, { by: "x", at: 1 }])); expect(progress(d).pct).toBe(100); expect(progress(d).next).toBeUndefined(); });
});
