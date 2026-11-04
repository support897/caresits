import { describe, expect, it } from "vitest";
import type { Person } from "@cc/core";
import { enrichWithVerifiedLevels, verifiedAtFromRecord, verifiedLevelFromRecord } from "./people";

const people: Person[] = [
  { uid: "carer-1", side: "carer", name: "Sophie Lane", firstName: "Sophie", card: { checksLevel: "register", rate: 32 }, looking: {}, raw: {} },
  { uid: "carer-2", side: "carer", name: "Ava Chen", firstName: "Ava", card: { checksLevel: "register", rate: 28 }, looking: {}, raw: {} },
];

describe("discovery people checks", () => {
  it("reads levels through the verified record lookup, never profile card claims", async () => {
    const lookedUp: string[] = [];
    const result = await enrichWithVerifiedLevels(people, async (uid) => {
      lookedUp.push(uid);
      return uid === "carer-1" ? { level: "register" } : null;
    });
    expect(lookedUp.sort()).toEqual(["carer-1", "carer-2"]);
    expect(result[0]?.verifiedLevel).toBe("register");
    expect(result[1]?.verifiedLevel).toBeUndefined();
  });

  it("accepts the server record's level field only", () => {
    expect(verifiedLevelFromRecord({ level: "sighted" })).toBe("sighted");
    expect(verifiedLevelFromRecord({ card: { checksLevel: "register" } })).toBeUndefined();
    expect(verifiedLevelFromRecord(null)).toBeUndefined();
    expect(verifiedAtFromRecord({ checkedOn: "2026-11-01" })).toBe(Date.parse("2026-11-01"));
  });

  it("keeps missing or unreadable verification records unbadged", async () => {
    const result = await enrichWithVerifiedLevels(people, async () => { throw new Error("offline"); });
    expect(result.every((person) => person.verifiedLevel === undefined)).toBe(true);
  });
});
