import { describe, expect, it } from "vitest";
import { buildMedicalSectionChanges, canReadAllergies, canReadEmergencyRecord, canReadMedication, canReadMedicalRecord, canWriteMedicalRecord, normalizeAllergies, normalizeMedication } from "./medical";

describe("medical access and change alerts", () => {
  const empty = { allergies: [], medication: [], emergency: { contacts: [], doctor: "", notes: "" } };

  it("treats a missing allergy section as unknown, not as an empty allergy list", () => {
    expect(normalizeAllergies(undefined)).toBeNull();
    expect(normalizeAllergies([])).toEqual([]);
    expect(normalizeMedication(undefined)).toBeNull();
    expect(normalizeMedication([])).toEqual([]);
  });

  it("checks each medical section permission independently", () => {
    const base = { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false };
    const allergyOnly = { role: "regular" as const, perms: { ...base, allergies: true, medication: false } };
    expect(canReadAllergies(allergyOnly)).toBe(true);
    expect(canReadMedication(allergyOnly)).toBe(false);
    expect(canReadEmergencyRecord(allergyOnly)).toBe(false);
    expect(canReadMedicalRecord(allergyOnly)).toBe(true);
    expect(canReadMedicalRecord({ role: "viewer", perms: base })).toBe(false);
    expect(canReadEmergencyRecord({ role: "admin", perms: base })).toBe(true);
    expect(canWriteMedicalRecord("regular")).toBe(false);
    expect(canWriteMedicalRecord("admin")).toBe(true);
  });

  it("creates a distinct matching alert for every medical section", () => {
    const writes = buildMedicalSectionChanges(empty, "parent-1", "child-1", "Mila", "server-time", {
      allergies: "alert-a", medication: "alert-m", emergency: "alert-e",
    });
    expect(writes.map(({ section }) => section)).toEqual(["allergies", "medication", "emergency"]);
    for (const write of writes) {
      expect(write.record.alertId).toBe(write.alert.id);
      expect(write.alert).toMatchObject({
        kind: "medical-change", by: "parent-1", at: "server-time", childId: "child-1", section: write.section, recordId: "main",
      });
    }
    expect(writes[0]?.record.items).toEqual([]);
    expect(writes[2]?.record).toMatchObject({ contacts: [], doctor: "", notes: "" });
  });
});
