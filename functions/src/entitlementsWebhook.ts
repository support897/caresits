import { timingSafeEqual } from "node:crypto";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { z } from "zod";
import { adminDb } from "./admin.js";

export const PLAN_PRICES_AUD = {
  finding: 14.95,
  family_plus: 24.95,
  search_pass: 49,
  carer: 0,
} as const;

export type FamilyPlan = "finding" | "family_plus" | "search_pass";
export type EntitlementRecord = {
  plan: FamilyPlan | "free";
  status: "active" | "expired";
  priceAUD: number;
  currency: "AUD";
  source: "revenuecat";
  productId?: string;
  expirationAtMs?: number;
  willRenew: boolean;
  updatedAtMs: number;
};

export interface RevenueCatEvent {
  app_user_id: string;
  type: string;
  entitlement_ids?: string[] | undefined;
  product_id?: string | null | undefined;
  expiration_at_ms?: number | null | undefined;
}

const webhookSchema = z.object({
  event: z.object({
    app_user_id: z.string().min(1).max(128).regex(/^[^/]+$/),
    type: z.string().min(1).max(80),
    entitlement_ids: z.array(z.string().max(100)).optional(),
    product_id: z.string().max(200).nullable().optional(),
    expiration_at_ms: z.number().nullable().optional(),
  }).passthrough(),
}).passthrough();

const entitlementToPlan: Record<string, FamilyPlan> = {
  finding: "finding",
  family_plus: "family_plus",
  search_pass: "search_pass",
};

export function validWebhookSecret(provided: string | undefined, expected: string): boolean {
  if (!provided || !expected) return false;
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export function resolveEntitlement(
  side: "family" | "carer",
  event: RevenueCatEvent,
  nowMs: number,
): EntitlementRecord | undefined {
  if (side === "carer") {
    return {
      plan: "free",
      status: "active",
      priceAUD: PLAN_PRICES_AUD.carer,
      currency: "AUD",
      source: "revenuecat",
      willRenew: false,
      updatedAtMs: nowMs,
    };
  }
  const plan = (event.entitlement_ids ?? [])
    .map((entitlement) => entitlementToPlan[entitlement])
    .find((candidate): candidate is FamilyPlan => candidate !== undefined);
  if (!plan) return undefined;
  const expiry = event.expiration_at_ms ?? undefined;
  const expired = event.type === "EXPIRATION" || (expiry !== undefined && expiry <= nowMs);
  return {
    plan,
    status: expired ? "expired" : "active",
    priceAUD: PLAN_PRICES_AUD[plan],
    currency: "AUD",
    source: "revenuecat",
    ...(event.product_id ? { productId: event.product_id } : {}),
    ...(expiry === undefined ? {} : { expirationAtMs: expiry }),
    willRenew: event.type !== "CANCELLATION" && !expired,
    updatedAtMs: nowMs,
  };
}

export interface EntitlementStore {
  getSide(uid: string): Promise<"family" | "carer" | undefined>;
  write(uid: string, record: EntitlementRecord): Promise<void>;
}

export async function handleRevenueCatEvent(
  store: EntitlementStore,
  event: RevenueCatEvent,
  nowMs: number,
): Promise<EntitlementRecord | undefined> {
  if (event.app_user_id.startsWith("$RCAnonymousID")) return undefined;
  const side = await store.getSide(event.app_user_id);
  if (!side) return undefined;
  const record = resolveEntitlement(side, event, nowMs);
  if (record) await store.write(event.app_user_id, record);
  return record;
}

const revenueCatSecret = defineSecret("REVENUECAT_WEBHOOK_SECRET");

export const entitlementsWebhook = onRequest({ secrets: [revenueCatSecret], cors: false }, async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!validWebhookSecret(request.get("x-revenuecat-secret"), revenueCatSecret.value())) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = webhookSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Webhook body is not valid" });
    return;
  }
  const db = adminDb();
  const store: EntitlementStore = {
    getSide: async (uid) => {
      const profile = await db.doc(`profiles/${uid}`).get();
      const side = profile.get("side");
      return side === "family" || side === "carer" ? side : undefined;
    },
    write: async (uid, record) => {
      await db.doc(`_entitlements/${uid}`).set(record, { merge: true });
    },
  };
  try {
    const result = await handleRevenueCatEvent(store, parsed.data.event, Date.now());
    response.status(200).json({ ok: true, ignored: result === undefined });
  } catch {
    response.status(500).json({ error: "Webhook could not be processed" });
  }
});
