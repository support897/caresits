import { describe, expect, it } from "vitest";
import { buildPins, clusterPins, fuzz, FUZZ_DEGREES } from "./WorldMap";
import { project, WORLD_H, WORLD_W } from "./worldGeo";
const row = (uid: string, lat: number, lng: number) => ({ person: { uid, firstName: uid, card: { lat, lng } } as never, km: null, result: { score: 80 } as never });
describe("world map", () => {
  it("projects the corners inside the box", () => {
    const a = project(83, -180), b = project(-58, 180);
    expect(a.x).toBeCloseTo(0); expect(a.y).toBeCloseTo(0); expect(b.x).toBeCloseTo(WORLD_W); expect(b.y).toBeCloseTo(WORLD_H, 0);
  });
  it("blurs location to a coarse grid", () => {
    const f = fuzz(-27.4698); expect(Math.abs(f - -27.4698)).toBeLessThanOrEqual(FUZZ_DEGREES / 2 + 1e-9);
    const [p] = buildPins([row("a", -27.4698, 153.0251)]); const [q] = buildPins([row("b", -27.4701, 153.0249)]);
    expect(p!.x).toBeCloseTo(q!.x, 6); expect(p!.y).toBeCloseTo(q!.y, 6);
  });
  it("groups neighbours and keeps far people apart", () => {
    const pins = buildPins([row("a", -27.47, 153.02), row("b", -27.5, 153.04), row("c", 51.5, -0.12)]);
    const c = clusterPins(pins, 34); expect(c.length).toBe(2); expect(c.map((x) => x.pins.length).sort()).toEqual([1, 2]);
  });
  it("skips people with no location", () => { expect(buildPins([{ person: { uid: "z", firstName: "z", card: {} } as never, km: null, result: {} as never }])).toEqual([]); });
});
