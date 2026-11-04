import { describe, expect, it } from "vitest";
import { reviewDocumentId } from "./reviews";

describe("review document IDs", () => {
  it("uses one deterministic ID for each relationship and booking", () => {
    expect(reviewDocumentId("family_carer", "booking-1")).toBe("family_carer_booking-1");
    expect(reviewDocumentId("family_carer", "booking-1")).toBe(reviewDocumentId("family_carer", "booking-1"));
  });

  it("rejects empty or path-breaking IDs", () => {
    expect(() => reviewDocumentId("", "booking-1")).toThrow("invalid-review-path");
    expect(() => reviewDocumentId("family/carer", "booking-1")).toThrow("invalid-review-path");
    expect(() => reviewDocumentId("family_carer", "booking/1")).toThrow("invalid-review-path");
  });
});
