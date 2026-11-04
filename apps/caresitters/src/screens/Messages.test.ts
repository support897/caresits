import { describe, expect, it } from "vitest";
import type { Person } from "@cc/core";
import { filterMessagePickerPeople } from "./Messages";

const person = (uid: string, side: "family" | "carer", name: string): Person => ({
  uid,
  side,
  name,
  firstName: name.split(" ")[0] ?? name,
  card: {},
  looking: {},
  raw: {},
});

const people = [
  person("f1", "family", "Avery Family"),
  person("c1", "carer", "Casey Carer"),
  person("c2", "carer", "Jordan Carer"),
  person("f2", "family", "Morgan Family"),
];

describe("filterMessagePickerPeople", () => {
  it("shows family saved or booked carers by default", () => {
    const result = filterMessagePickerPeople({
      people,
      me: { uid: "f1", side: "family" },
      savedIds: ["c1"],
      bookedIds: ["c2"],
    });
    expect(result.map(({ uid }) => uid)).toEqual(["c1", "c2"]);
  });

  it("lets families search all carers by name", () => {
    const result = filterMessagePickerPeople({
      people,
      me: { uid: "f1", side: "family" },
      savedIds: [],
      bookedIds: [],
      search: "jOrDaN",
    });
    expect(result.map(({ uid }) => uid)).toEqual(["c2"]);
  });

  it("hides self, wrong-side people, and blocked people", () => {
    const result = filterMessagePickerPeople({
      people,
      me: { uid: "f1", side: "family" },
      savedIds: ["f1", "f2", "c1"],
      blockedIds: ["c1"],
    });
    expect(result).toEqual([]);
  });

  it("limits carers to families they have a relationship with and filters by name", () => {
    const result = filterMessagePickerPeople({
      people,
      me: { uid: "c1", side: "carer" },
      relationshipIds: ["f1", "f2"],
      search: "morgan",
    });
    expect(result.map(({ uid }) => uid)).toEqual(["f2"]);
  });
});
