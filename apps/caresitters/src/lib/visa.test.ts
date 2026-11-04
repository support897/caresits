import { describe, expect, it } from "vitest";
import { assessVisa, hasHighHouseworkShare, houseworkShare } from "./visa";
import { VISA_SOURCES, type VisaSource } from "./visaSources";

const source = (overrides: Partial<VisaSource> = {}): VisaSource => ({
  destination: "France",
  officialUrl: "https://www.france-visas.gouv.fr/en/web/france-visas/jeune-au-pair",
  programName: "Young au pair",
  summary: "Official guidance page.",
  lastChecked: "2026-11-04",
  checked: true,
  ...overrides,
});

describe("official visa source table", () => {
  it("contains all requested destinations with absolute official links and the check date", () => {
    const required = ["Australia", "New Zealand", "United Kingdom", "Ireland", "Germany", "France", "Netherlands", "Spain", "Italy", "Canada", "United States", "Denmark", "Norway", "Sweden", "Switzerland"];
    expect(VISA_SOURCES.map((row) => row.destination)).toEqual(required);
    expect(VISA_SOURCES.every((row) => row.officialUrl.startsWith("https://") && row.lastChecked === "2026-11-04")).toBe(true);
  });

  it("uses the required note for any source not read", () => {
    expect(VISA_SOURCES.filter((row) => !row.checked).every((row) => row.summary === "Not checked yet - open the official site")).toBe(true);
  });
});

describe("passport-specific visa status", () => {
  it("stays unknown when guidance has no explicit passport list", () => {
    expect(assessVisa("France", "Mexico", [source()]).status).toBe("unknown");
  });

  it("stays unknown when an explicit list does not include the passport", () => {
    const row = source({ passportRules: { eligiblePassports: ["Canada"] } });
    expect(assessVisa("France", "Mexico", [row]).status).toBe("unknown");
  });

  it("returns eligible only when a checked row lists the passport", () => {
    const row = source({ passportRules: { eligiblePassports: ["Mexico"] } });
    expect(assessVisa("France", "mexico", [row]).status).toBe("eligible");
  });

  it("does not return eligible from an unchecked row", () => {
    const row = source({ checked: false, passportRules: { eligiblePassports: ["Mexico"] } });
    expect(assessVisa("France", "Mexico", [row]).status).toBe("unknown");
  });

  it("stays unknown when no passport was selected", () => {
    const row = source({ passportRules: { eligiblePassports: ["Mexico"] } });
    expect(assessVisa("France", "", [row]).status).toBe("unknown");
  });
});

describe("unrelated housework share", () => {
  it("returns zero when no unrelated housework is listed", () => {
    expect(houseworkShare(["Play with children"], [])).toBe(0);
    expect(hasHighHouseworkShare(["Play with children"], [])).toBe(false);
  });

  it("warns when unrelated housework is half or more of listed duties", () => {
    expect(houseworkShare(["Play with children"], ["Whole-home cleaning"])).toBe(0.5);
    expect(hasHighHouseworkShare(["Play with children"], ["Whole-home cleaning"])).toBe(true);
  });

  it("does not warn when childcare duties are the larger share", () => {
    expect(houseworkShare(["Play", "School run", "Children's laundry"], ["Whole-home cleaning"])).toBe(0.25);
    expect(hasHighHouseworkShare(["Play", "School run", "Children's laundry"], ["Whole-home cleaning"])).toBe(false);
  });
});
