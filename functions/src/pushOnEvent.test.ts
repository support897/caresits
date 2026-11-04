import { describe, expect, it } from "vitest";
import { notificationPrefsSchema } from "../../packages/core/src/schemas/index.js";
import {
  pushCopy,
  pushOnEvent,
  shouldDeliverNotification,
  type PushCopy,
  type PushDevice,
  type PushStore,
  type PushCategory,
} from "./pushOnEvent.js";

function fakeStore(prefs: unknown, devices: PushDevice[] = [{ token: "device-1", active: true }]) {
  const sends: Array<{ tokens: string[]; copy: PushCopy; category: PushCategory }> = [];
  const store: PushStore = {
    getPrefs: async () => prefs,
    getDevices: async () => devices,
    send: async (tokens, copy, category) => { sends.push({ tokens, copy, category }); },
  };
  return { store, sends };
}

describe("event push delivery", () => {
  it("honors message choices and working-time muting", () => {
    const prefs = notificationPrefsSchema.parse({ messages: false });
    expect(shouldDeliverNotification("message", prefs)).toBe(false);
    const muted = notificationPrefsSchema.parse({ muteNonUrgentWhileWorking: true });
    expect(shouldDeliverNotification("message", muted, true)).toBe(false);
    expect(shouldDeliverNotification("message", muted, false)).toBe(true);
  });

  it("always sends safety and allergy notices despite daily mode and opt-out", () => {
    const prefs = notificationPrefsSchema.parse({ mode: "daily", allergyChanges: false, muteNonUrgentWhileWorking: true });
    expect(shouldDeliverNotification("safety", prefs, true)).toBe(true);
    expect(shouldDeliverNotification("allergy", prefs, true)).toBe(true);
  });

  it("keeps push copy calm and free of urgency wording", () => {
    for (const category of ["message", "booking", "calendar", "careUpdate", "request", "shopping", "safety", "allergy"] as const) {
      const copy = pushCopy(category);
      expect(`${copy.title} ${copy.body}`).not.toMatch(/urgent|immediately|last chance|act now/i);
    }
  });

  it("sends only active device tokens when preferences allow", async () => {
    const { store, sends } = fakeStore({}, [
      { token: "on", active: true },
      { token: "off", active: false },
    ]);
    await expect(pushOnEvent({ recipientUid: "user-1", category: "message" }, store)).resolves.toBe(1);
    expect(sends[0]?.tokens).toEqual(["on"]);
  });

  it("bypasses device category and user preference switches for allergy alerts", async () => {
    const { store, sends } = fakeStore({ mode: "daily", allergyChanges: false }, [
      { token: "safety-device", active: true, kinds: { reminder: false } },
    ]);
    await expect(pushOnEvent({ recipientUid: "user-1", category: "allergy", actorUid: "user-1" }, store)).resolves.toBe(1);
    expect(sends[0]?.category).toBe("allergy");
  });

  it("does not send an event back to its author", async () => {
    const { store, sends } = fakeStore({});
    await expect(pushOnEvent({ recipientUid: "user-1", actorUid: "user-1", category: "message" }, store)).resolves.toBe(0);
    expect(sends).toHaveLength(0);
  });
});
