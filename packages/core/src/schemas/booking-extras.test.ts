import { describe, expect, it } from "vitest";
import { bookingExtrasSchema } from "./booking-extras.js";

describe("booking extras", () => {
  it("defaults to no selected children and no address sharing", () => {
    expect(bookingExtrasSchema.parse({})).toEqual({ childIds: [], shareAddress: false });
  });

  it("accepts parent-selected child IDs and a sharing choice", () => {
    expect(bookingExtrasSchema.parse({ childIds: ["child-1"], shareAddress: true })).toEqual({
      childIds: ["child-1"],
      shareAddress: true,
    });
  });

  it("rejects too many child IDs and exact address fields", () => {
    expect(bookingExtrasSchema.safeParse({ childIds: Array.from({ length: 9 }, (_, index) => `child-${index}`) }).success).toBe(false);
    expect(bookingExtrasSchema.safeParse({ exactAddress: "12 Example Street" }).success).toBe(false);
  });
});
