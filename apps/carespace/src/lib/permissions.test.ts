import { describe, expect, it } from "vitest";
import { canEditShopping, canPost, canSeePhotos } from "./permissions";

describe("Care Space permissions", () => {
  it("keeps viewers from posting and limited carers from editing shopping", () => {
    expect(canPost("viewer")).toBe(false);
    expect(canPost("limited")).toBe(true);
    expect(canEditShopping("limited")).toBe(false);
    expect(canEditShopping("regular")).toBe(true);
  });

  it("checks photo access from the member role and permissions", () => {
    expect(canSeePhotos("admin", {})).toBe(true);
    expect(canSeePhotos("regular", { photos: true })).toBe(true);
    expect(canSeePhotos("regular", { photos: false })).toBe(false);
  });
});
