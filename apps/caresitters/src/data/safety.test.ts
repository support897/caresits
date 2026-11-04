import { describe, expect, it } from "vitest";
import { cleanEmergencyContacts, planBlock, planReport, REPORT_CATEGORIES } from "./safety";

describe("safety data rules", () => {
  it("includes clear report categories and bounds report content", () => {
    expect(REPORT_CATEGORIES.map(([key]) => key)).toEqual(["spam_scam", "rude_abusive", "fake_profile", "child_safety", "inappropriate", "other"]);
    const plan = planReport({ reporterUid: "family", reportedUid: "carer", surface: "profile", category: "child_safety", words: "x".repeat(1200), snapshot: { items: Array.from({ length: 15 }, (_, i) => i), title: "t".repeat(140) } });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.data.reporterWords).toHaveLength(1000);
      expect(plan.data.snapshot.items).toHaveLength(10);
      expect(plan.data.snapshot.title).toHaveLength(120);
    }
  });

  it("blocks only another valid account", () => {
    expect(planBlock("u1", "u2")).toEqual({ ok: true, path: "users/u1/blocks/u2" });
    expect(planBlock("u1", "u1").ok).toBe(false);
    expect(planBlock("u1", "x/y").ok).toBe(false);
  });

  it("keeps at most three complete emergency contacts", () => {
    expect(cleanEmergencyContacts([
      { name: "A", phone: "1" }, { name: "B", phone: "2" }, { name: "C", phone: "3" }, { name: "D", phone: "4" }, { name: "", phone: "5" },
    ])).toEqual([{ name: "A", phone: "1" }, { name: "B", phone: "2" }, { name: "C", phone: "3" }]);
  });
});
