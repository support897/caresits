import { AUSTRALIAN_CHILD_CHECKS, type AustralianStateCode } from "./quals";
import type { ServiceType } from "@cc/core";

/**
 * Jurisdiction-aware requirements. Resolved from the WORK location and service type, never from nationality.
 * Guidance only: not legal advice, and an upload never means "cleared". Each rule carries its official source + review date.
 */
export type RequirementLevel = "legally_required" | "recommended" | "optional" | "not_applicable" | "confirm_with_official_source";
export type RequirementKind = "child_check" | "identity" | "references" | "first_aid" | "qualification" | "work_authorization" | "driving";
export type RecordStatus = "uploaded_unverified" | "verification_pending" | "verified_current" | "expired_renewal_due" | "rejected";
export type Requirement = { id: string; kind: RequirementKind; level: RequirementLevel; label: string; guidance: string; sourceUrl?: string; lastReviewed?: string; jurisdiction: string };

const AU_CODES = new Set<string>(AUSTRALIAN_CHILD_CHECKS.map((c) => c.code));
export function isAustralianState(value: string | undefined): value is AustralianStateCode { return !!value && AU_CODES.has(value.toUpperCase()); }

export function requirementsFor(input: { country: string; region?: string; service: ServiceType }): Requirement[] {
  const country = input.country.trim().toUpperCase();
  const out: Requirement[] = [];
  const common = (jurisdiction: string): Requirement[] => [
    { id: "identity", kind: "identity", level: "recommended", label: "Identity check", guidance: "Identity is checked separately from child-safety checks.", jurisdiction },
    { id: "references", kind: "references", level: "recommended", label: "Two references", guidance: "References are shown only after they are confirmed.", jurisdiction },
    ...(input.service === "au_pair" ? [] : [{ id: "first_aid", kind: "first_aid" as const, level: "recommended" as const, label: "First aid / CPR", guidance: "A current certificate is useful for families; it is not a child-safety clearance.", jurisdiction }]),
  ];
  if (country === "AU") {
    const region = input.region?.toUpperCase();
    if (!isAustralianState(region)) {
      return [{ id: "child_check_region_needed", kind: "child_check", level: "confirm_with_official_source", label: "Child-safety check depends on your state or territory", guidance: "Choose the state or territory where the work happens. Rules differ and one state's check is not valid everywhere.", jurisdiction: "AU" }, ...common("AU")];
    }
    const c = AUSTRALIAN_CHILD_CHECKS.find((x) => x.code === region)!;
    out.push({ id: `child_check_${region}`, kind: "child_check", level: "confirm_with_official_source", label: c.name, guidance: `${c.guidance} Whether it is legally required depends on the arrangement; confirm on the official page. Usual validity: ${c.validity}.`, sourceUrl: c.officialUrl, lastReviewed: c.lastChecked, jurisdiction: `AU-${region}` });
    out.push(...common(`AU-${region}`));
  } else if (country === "GB" || country === "UK") {
    out.push({ id: "child_check_GB", kind: "child_check", level: "confirm_with_official_source", label: "DBS check (England and Wales)", guidance: "Eligibility and level depend on the role. Confirm on the official page.", sourceUrl: "https://www.gov.uk/dbs-check-applicant-criminal-record", lastReviewed: "2026-11-07", jurisdiction: "GB" }, ...common("GB"));
  } else {
    out.push({ id: "child_check_other", kind: "child_check", level: "confirm_with_official_source", label: "Local child-safety check", guidance: "We do not hold verified rules for this place yet. Ask the local government or regulator what applies.", jurisdiction: country || "unknown" }, ...common(country || "unknown"));
  }
  if (input.service === "au_pair") out.push({ id: "work_authorization", kind: "work_authorization", level: "confirm_with_official_source", label: "Visa / work authorization", guidance: "Immigration status is separate from childcare qualifications. We never guarantee visa eligibility.", jurisdiction: country || "unknown" });
  return out;
}

/** "verified_current" only when a SERVER wrote verifier + check date and it has not expired. Never from client fields alone. */
export function recordStatus(rec: { status?: string; checkedOn?: string; verifiedBy?: string; expiresOn?: string; serverWritten?: boolean }, now = new Date()): RecordStatus {
  const status = (rec.status ?? "").toLowerCase();
  if (status === "rejected") return "rejected";
  if (!rec.serverWritten || !rec.verifiedBy || !rec.checkedOn) return status === "under review" || status === "pending" ? "verification_pending" : "uploaded_unverified";
  if (rec.expiresOn) {
    const left = (Date.parse(rec.expiresOn) - now.getTime()) / 86_400_000;
    if (Number.isFinite(left) && left <= 30) return "expired_renewal_due";
  }
  return "verified_current";
}
