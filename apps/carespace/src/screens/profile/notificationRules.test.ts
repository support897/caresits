import { describe, expect, it } from "vitest";
import { canDeliverNotification, DEFAULT_NOTIFICATION_PREFS } from "@cc/core/src/notifications/prefs";

describe("CareSpace notification safety", () => {
  it("never lets a mute or working-time pause suppress allergy alerts", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, muted: { allergyChanges: true, messages: true }, muteNonUrgentWhileWorking: true };
    expect(canDeliverNotification({ category: "allergyChanges" }, prefs, "carer", true)).toBe(true);
  });

  it("lets carers pause ordinary notices while working", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, muteNonUrgentWhileWorking: true };
    expect(canDeliverNotification({ category: "messages" }, prefs, "carer", true)).toBe(false);
    expect(canDeliverNotification({ category: "messages", safety: true }, prefs, "carer", true)).toBe(true);
  });
});
