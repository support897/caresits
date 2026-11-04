import { describe, expect, it } from "vitest";
import {
  handleRevenueCatEvent,
  PLAN_PRICES_AUD,
  resolveEntitlement,
  validWebhookSecret,
  type EntitlementRecord,
  type EntitlementStore,
} from "./entitlementsWebhook.js";

const now = 1_800_000_000_000;
const event = {
  app_user_id: "family-1",
  type: "INITIAL_PURCHASE",
  entitlement_ids: ["family_plus"],
  product_id: "family-plus-monthly",
  expiration_at_ms: now + 30_000,
};

function fakeStore(side: "family" | "carer" | undefined = "family") {
  const writes: Array<{ uid: string; record: EntitlementRecord }> = [];
  const store: EntitlementStore = {
    getSide: async () => side,
    write: async (uid, record) => { writes.push({ uid, record }); },
  };
  return { store, writes };
}

describe("RevenueCat entitlement handling", () => {
  it("keeps the fixed Australian family prices", () => {
    expect(PLAN_PRICES_AUD).toEqual({ finding: 14.95, family_plus: 24.95, search_pass: 49, carer: 0 });
  });

  it("maps a family entitlement to its fixed price", () => {
    expect(resolveEntitlement("family", event, now)).toMatchObject({ plan: "family_plus", priceAUD: 24.95, status: "active", currency: "AUD" });
  });

  it("marks expired plans inactive and cancellation as not renewing", () => {
    expect(resolveEntitlement("family", { ...event, type: "EXPIRATION", expiration_at_ms: now - 1 }, now)?.status).toBe("expired");
    expect(resolveEntitlement("family", { ...event, type: "CANCELLATION" }, now)?.willRenew).toBe(false);
  });

  it("keeps carers free even when RevenueCat sends a paid entitlement", () => {
    expect(resolveEntitlement("carer", event, now)).toMatchObject({ plan: "free", priceAUD: 0, status: "active" });
  });

  it("checks the shared secret without accepting a wrong value", () => {
    expect(validWebhookSecret("same-secret", "same-secret")).toBe(true);
    expect(validWebhookSecret("wrong-secret", "same-secret")).toBe(false);
    expect(validWebhookSecret(undefined, "same-secret")).toBe(false);
  });

  it("writes only known family entitlements and ignores anonymous IDs", async () => {
    const { store, writes } = fakeStore();
    await expect(handleRevenueCatEvent(store, event, now)).resolves.toMatchObject({ plan: "family_plus" });
    await expect(handleRevenueCatEvent(store, { ...event, app_user_id: "$RCAnonymousID:123" }, now)).resolves.toBeUndefined();
    await expect(handleRevenueCatEvent(store, { ...event, entitlement_ids: ["unknown"] }, now)).resolves.toBeUndefined();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.uid).toBe("family-1");
  });
});
