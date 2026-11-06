import { describe, expect, it } from "vitest";
import { kidDocId, mergeKids } from "./childPhotos";
describe("child photos", () => {
  it("ids are stable by position", () => expect(kidDocId(0)).toBe("kid1"));
  it("uses first name only and joins photo keys", () => {
    const rows = mergeKids([{ name: "Mia Smith", ageYears: 3 }, { name: "Leo", ageYears: 1.5 }], { kid2: "users/u/children/child-x.jpg" });
    expect(rows).toEqual([{ id: "kid1", name: "Mia", ageYears: 3, photoKey: "" }, { id: "kid2", name: "Leo", ageYears: 1.5, photoKey: "users/u/children/child-x.jpg" }]);
  });
  it("skips blank names and bad input", () => {
    expect(mergeKids(undefined, {})).toEqual([]);
    expect(mergeKids([{ name: "  " }, { name: "Zoe", ageYears: "x" }], {})).toEqual([{ id: "kid2", name: "Zoe", ageYears: null, photoKey: "" }]);
  });
  it("never reads photos from the public profile shape", () => expect(mergeKids([{ name: "Ava", ageYears: 2, photoKey: "leak" }], {})[0]!.photoKey).toBe(""));
});
