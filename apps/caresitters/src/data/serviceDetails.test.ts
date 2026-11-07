import { describe, expect, it } from "vitest";
import { SERVICE_DETAIL_FIELDS, firstIncompleteService, missingServiceDetails } from "./serviceDetails";

describe("service detail questions", () => {
  it("six distinct question sets", () => {
    const keys = Object.values(SERVICE_DETAIL_FIELDS).map((f) => f.map((x) => x.key).join(","));
    expect(new Set(keys).size).toBe(6);
  });
  it("babysitter and nanny carers differ", () => {
    expect(missingServiceDetails("carer", "babysitter", {})).toContain("minBookingHours");
    expect(missingServiceDetails("carer", "nanny", {})).not.toContain("minBookingHours");
  });
  it("au pair family needs accommodation and pocket money", () => expect(missingServiceDetails("family", "au_pair", {})).toEqual(expect.arrayContaining(["accommodation", "pocketMoneyPerWeek"])));
  it("complete set passes, out-of-range number fails", () => {
    const ok = { careInstructions: "x", dates: "2026-12-01", durationHours: 4, transportNeeded: false };
    expect(missingServiceDetails("family", "babysitter", ok)).toEqual([]);
    expect(missingServiceDetails("family", "babysitter", { ...ok, durationHours: 30 })).toEqual(["durationHours"]);
  });
  it("finds first incomplete service", () => expect(firstIncompleteService("carer", ["nanny", "babysitter"], {})?.service).toBe("nanny"));
});
