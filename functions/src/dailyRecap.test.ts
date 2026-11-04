import { describe, expect, it } from "vitest";
import { notificationPrefsSchema } from "../../packages/core/src/schemas/index.js";
import { dailyRecapCopy, localClock, shouldSendDailyRecap } from "./dailyRecap.js";

describe("daily care recap timing", () => {
  it("uses Brisbane local date and time", () => {
    expect(localClock(new Date("2026-11-04T07:22:00.000Z"))).toEqual({ date: "2026-11-04", minuteOfDay: 17 * 60 + 22 });
  });

  it("sends within the five-minute window the user picked", () => {
    const prefs = notificationPrefsSchema.parse({ mode: "daily", dailyRecapTime: "17:20" });
    expect(shouldSendDailyRecap(prefs, new Date("2026-11-04T07:22:00.000Z")).send).toBe(true);
    expect(shouldSendDailyRecap(prefs, new Date("2026-11-04T07:26:00.000Z")).send).toBe(false);
  });

  it("does not repeat a recap on the same day", () => {
    const prefs = notificationPrefsSchema.parse({ mode: "daily", dailyRecapTime: "17:20" });
    expect(shouldSendDailyRecap(prefs, new Date("2026-11-04T07:22:00.000Z"), "2026-11-04").send).toBe(false);
  });

  it("respects the recap mode and care-update choice", () => {
    expect(shouldSendDailyRecap(notificationPrefsSchema.parse({}), new Date("2026-11-04T07:22:00.000Z")).send).toBe(false);
    expect(shouldSendDailyRecap(notificationPrefsSchema.parse({ mode: "daily", careUpdates: false }), new Date("2026-11-04T07:22:00.000Z")).send).toBe(false);
  });

  it("uses calm recap text with no urgency wording", () => {
    for (const copy of [dailyRecapCopy(0), dailyRecapCopy(1), dailyRecapCopy(8)]) {
      expect(`${copy.title} ${copy.body}`).not.toMatch(/urgent|immediately|last chance|act now/i);
    }
    expect(dailyRecapCopy(2).body).toBe("You have 2 care updates today.");
  });
});
