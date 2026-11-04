import { describe, expect, it } from "vitest";
import { AUSTRALIAN_CHILD_CHECKS, qualificationDateDay, qualificationStatus } from "./quals";

describe("qualification display logic", () => {
  it("covers all Australian states and territories with official names", () => {
    expect(AUSTRALIAN_CHILD_CHECKS.map((check) => check.code)).toEqual(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);
    expect(AUSTRALIAN_CHILD_CHECKS.find((check) => check.code === "QLD")?.name).toContain("Blue Card");
    expect(AUSTRALIAN_CHILD_CHECKS.every((check) => check.lastChecked === "2026-11-04" && check.officialUrl.startsWith("https://"))).toBe(true);
  });

  it("never trusts client-supplied verification claims", () => {
    const today = new Date("2026-11-04T00:00:00Z");
    expect(qualificationStatus({ status: "submitted" }, today)).toBe("submitted");
    expect(qualificationStatus({ status: "verified" }, today)).toBe("submitted");
    expect(qualificationStatus({ status: "verified", checkedOn: "2026-10-01", verifiedBy: "client" }, today)).toBe("submitted");
    expect(qualificationStatus({ status: "verified", checkedOn: "2026-10-01", verifiedBy: "reviewer" }, today, true)).toBe("verified");
  });

  it("uses expiry dates for expired and renewal states", () => {
    const today = new Date("2026-11-04T12:00:00Z");
    expect(qualificationStatus({ status: "verified", checkedOn: "2026-01-01", verifiedBy: "reviewer", expiresOn: "2026-11-03" }, today, true)).toBe("expired");
    expect(qualificationStatus({ status: "verified", checkedOn: "2026-01-01", verifiedBy: "reviewer", expiresOn: "2026-11-20" }, today, true)).toBe("needs renewal");
    expect(qualificationStatus({ status: "expired", expiresOn: "2026-11-03" }, today)).toBe("submitted");
  });

  it("parses common date formats", () => {
    expect(qualificationDateDay("4/11/2026")).toBe("2026-11-04");
    expect(qualificationDateDay("2026-11-04T08:00:00Z")).toBe("2026-11-04");
  });
});
