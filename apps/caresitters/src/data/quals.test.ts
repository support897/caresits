import { describe, expect, it } from "vitest";
import { AUSTRALIAN_CHILD_CHECKS, qualificationDateDay, qualificationStatus } from "./quals";

describe("qualification display logic", () => {
  it("covers all Australian states and territories with official names", () => {
    expect(AUSTRALIAN_CHILD_CHECKS.map((check) => check.code)).toEqual(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);
    expect(AUSTRALIAN_CHILD_CHECKS.find((check) => check.code === "QLD")?.name).toContain("Blue Card");
    expect(AUSTRALIAN_CHILD_CHECKS.every((check) => check.lastChecked === "2026-11-04" && check.officialUrl.startsWith("https://"))).toBe(true);
  });

  it("keeps upload status submitted unless server check evidence exists", () => {
    expect(qualificationStatus({ status: "submitted" }, new Date("2026-11-04T00:00:00Z"))).toBe("submitted");
    expect(qualificationStatus({ status: "verified" }, new Date("2026-11-04T00:00:00Z"))).toBe("under review");
    expect(qualificationStatus({ status: "verified", checkedOn: "2026-10-01", verifiedBy: "reviewer" }, new Date("2026-11-04T00:00:00Z"))).toBe("verified");
  });

  it("uses expiry dates for expired and renewal states", () => {
    const today = new Date("2026-11-04T12:00:00Z");
    expect(qualificationStatus({ status: "verified", checkedOn: "2026-01-01", verifiedBy: "reviewer", expiresOn: "2026-11-03" }, today)).toBe("expired");
    expect(qualificationStatus({ status: "verified", checkedOn: "2026-01-01", verifiedBy: "reviewer", expiresOn: "2026-11-20" }, today)).toBe("needs renewal");
  });

  it("parses common date formats", () => {
    expect(qualificationDateDay("4/11/2026")).toBe("2026-11-04");
    expect(qualificationDateDay("2026-11-04T08:00:00Z")).toBe("2026-11-04");
  });
});
