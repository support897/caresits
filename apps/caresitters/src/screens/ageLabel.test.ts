import { describe, expect, it } from "vitest";
import { ageLabel, pageSlice } from "./ageLabel";
const now = Date.UTC(2026, 10, 5);
describe("ageLabel", () => {
  it("says 7 days ago", () => expect(ageLabel(now - 7 * 864e5, now)).toBe("7 days ago"));
  it("handles minutes, hours, weeks, months", () => {
    expect(ageLabel(now - 30000, now)).toBe("Just now");
    expect(ageLabel(now - 5 * 60000, now)).toBe("5 min ago");
    expect(ageLabel(now - 3 * 3600e3, now)).toBe("3 hours ago");
    expect(ageLabel(now - 21 * 864e5, now)).toBe("3 weeks ago");
    expect(ageLabel(now - 95 * 864e5, now)).toBe("3 months ago");
  });
  it("never expires: very old still has a label", () => expect(ageLabel(now - 900 * 864e5, now)).toBe("2 years ago"));
  it("pages with load more", () => {
    const r = pageSlice(Array.from({ length: 45 }, (_, i) => i), 20);
    expect(r.items.length).toBe(20); expect(r.more).toBe(25);
  });
});
