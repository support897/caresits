import { afterEach, describe, expect, it } from "vitest";
import type { Person } from "@cc/core";
import { distanceKmBetween, approximateMapPins, availabilityDays, deleteDiscoverSearch, experienceYearsOf, isAvailableOnDate, isAvailableThisWeek, loadSavedSearches, saveDiscoverSearch } from "./helpers";

function person(uid: string, availability: unknown, cardExtra: Record<string, unknown> = {}): Person {
  return { uid, side: "carer", name: uid, firstName: uid, card: { availability, ...cardExtra }, looking: {}, raw: {} };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("Discover availability and private saved searches", () => {
  it("counts date-specific slots only in the coming week", () => {
    const now = new Date(2026, 10, 4, 12);
    const upcoming = person("upcoming", { "2026-11-06": [{ from: "16:00", to: "18:00" }] });
    const old = person("old", { "2026-11-03": [{ from: "16:00", to: "18:00" }] });
    expect(availabilityDays(upcoming.card.availability, now)).toEqual(["Fri"]);
    expect(isAvailableThisWeek(upcoming, now)).toBe(true);
    expect(isAvailableOnDate(upcoming, "2026-11-06", now)).toBe(true);
    expect(isAvailableOnDate(upcoming, "2026-11-07", now)).toBe(false);
    expect(isAvailableThisWeek(old, now)).toBe(false);
  });

  it("matches recurring days against a selected date", () => {
    const now = new Date(2026, 10, 4, 12);
    const carer = person("weekly", { Monday: true });
    expect(isAvailableOnDate(carer, "2026-11-09", now)).toBe(true);
    expect(isAvailableOnDate(carer, "not-a-date", now)).toBe(false);
  });

  it("shows only a stated non-negative childcare experience value", () => {
    expect(experienceYearsOf(person("known", {}, { experienceYears: "4" }))).toBe(4);
    expect(experienceYearsOf(person("zero", {}, { experienceYears: 0 }))).toBe(0);
    expect(experienceYearsOf(person("unknown", {}, { experienceYears: -1 }))).toBeUndefined();
    expect(experienceYearsOf(person("missing", {}))).toBeUndefined();
  });

  it("returns map positions without exposing coordinates", () => {
    const people = [
      person("a", {}, { lat: -27.4698, lng: 153.0251 }),
      person("b", {}, { lat: -27.4812, lng: 153.0349 }),
    ];
    const pins = approximateMapPins(people);
    expect(pins).toHaveLength(2);
    expect(pins.every((pin) => pin.inlineStart >= 12 && pin.inlineStart <= 88 && pin.blockStart >= 12 && pin.blockStart <= 88)).toBe(true);
    expect(pins[0]).not.toHaveProperty("lat");
    expect(pins[0]).not.toHaveProperty("lng");
  });

  it("saves, reloads, and deletes this user's local search only", () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
      },
    });
    const input = { label: "2026-11-06 search", radiusKm: 25, suburb: "West End", requirements: { availability: [{ day: "Fri" }] }, date: "2026-11-06", from: "16:00", to: "18:00" };
    saveDiscoverSearch("family-a", input, "search-a");
    expect(loadSavedSearches("family-a")[0]).toMatchObject({ ...input, id: "search-a" });
    expect(loadSavedSearches("family-a")[0]).not.toHaveProperty("searchText");
    expect(loadSavedSearches("family-b")).toEqual([]);
    expect(deleteDiscoverSearch("family-a", "search-a")).toEqual([]);
  });
});

describe("Distance from postcode", () => {
  it("measures between two postcodes when no coordinates were saved", () => {
    const a = { ...person("a", {}), postcode: "4005" } as Person;
    const b = { ...person("b", {}), postcode: "4000" } as Person;
    const km = distanceKmBetween(a, b);
    expect(km).not.toBeNull();
    expect(km as number).toBeGreaterThan(0.5);
    expect(km as number).toBeLessThan(10);
  });
  it("stays unknown for a missing or unknown postcode", () => {
    expect(distanceKmBetween({ ...person("a", {}), postcode: "4005" } as Person, { ...person("b", {}), postcode: "0001" } as Person)).toBeNull();
  });
});
