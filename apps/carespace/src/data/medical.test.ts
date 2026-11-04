import { describe, expect, it } from "vitest";
import { buildMedicalChangeAlert, canReadMedicalRecord, canWriteMedicalRecord } from "./medical";

describe("medical access and change alerts", () => {
  it("creates a team alert for each medical change", () => {
    expect(buildMedicalChangeAlert("parent-1", "server-time", "Updated medical and emergency details.")).toEqual({
      kind: "medical-change", by: "parent-1", at: "server-time", summary: "Updated medical and emergency details.",
    });
  });

  it("requires both medical read permissions and admin edits", () => {
    const base = { photos: false, calendar: false, privateMessages: false };
    expect(canReadMedicalRecord({ role: "regular", perms: { ...base, allergies: true, medication: false } })).toBe(false);
    expect(canReadMedicalRecord({ role: "regular", perms: { ...base, allergies: true, medication: true } })).toBe(true);
    expect(canWriteMedicalRecord("regular")).toBe(false);
    expect(canWriteMedicalRecord("admin")).toBe(true);
  });
});
