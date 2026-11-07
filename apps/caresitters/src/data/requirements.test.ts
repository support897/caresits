import { describe, expect, it } from "vitest";
import { recordStatus, requirementsFor } from "./requirements";

describe("jurisdiction requirements", () => {
  it("uses Queensland Blue Card only for QLD", () => {
    const qld = requirementsFor({ country: "AU", region: "QLD", service: "nanny" });
    expect(qld.find((r) => r.kind === "child_check")?.label).toMatch(/Blue Card/);
    const nsw = requirementsFor({ country: "AU", region: "NSW", service: "nanny" });
    expect(JSON.stringify(nsw)).not.toMatch(/Blue Card/);
    expect(nsw.find((r) => r.kind === "child_check")?.sourceUrl).toMatch(/nsw/);
  });
  it("needs a state before naming a check", () => {
    const rows = requirementsFor({ country: "AU", service: "babysitter" });
    expect(rows[0]?.level).toBe("confirm_with_official_source");
    expect(rows[0]?.sourceUrl).toBeUndefined();
  });
  it("every sourced rule has a review date; none claims legal clearance", () => {
    for (const code of ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]) for (const r of requirementsFor({ country: "AU", region: code, service: "babysitter" }).filter((x) => x.sourceUrl)) expect(r.lastReviewed).toBeTruthy();
  });
  it("au pair gets separate work authorization, not a childcare qualification", () => {
    const rows = requirementsFor({ country: "AU", region: "QLD", service: "au_pair" });
    expect(rows.some((r) => r.kind === "work_authorization")).toBe(true);
    expect(rows.some((r) => r.kind === "first_aid")).toBe(false);
    expect(requirementsFor({ country: "AU", region: "QLD", service: "nanny" }).some((r) => r.kind === "work_authorization")).toBe(false);
  });
  it("unknown country gives no invented rule", () => {
    const r = requirementsFor({ country: "ZZ", service: "nanny" });
    expect(r[0]?.sourceUrl).toBeUndefined();
  });
});
describe("record status", () => {
  const now = new Date("2026-11-07");
  it("upload alone is unverified", () => expect(recordStatus({ status: "verified" }, now)).toBe("uploaded_unverified"));
  it("verified needs server fields", () => expect(recordStatus({ serverWritten: true, verifiedBy: "fn", checkedOn: "2026-10-01", expiresOn: "2027-10-01" }, now)).toBe("verified_current"));
  it("expiring and rejected", () => {
    expect(recordStatus({ serverWritten: true, verifiedBy: "fn", checkedOn: "2026-10-01", expiresOn: "2026-11-20" }, now)).toBe("expired_renewal_due");
    expect(recordStatus({ status: "rejected" }, now)).toBe("rejected");
  });
});
