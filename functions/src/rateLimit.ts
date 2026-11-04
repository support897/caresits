import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "./admin.js";

export interface CounterValue {
  windowStartedAtMs: number;
  count: number;
}

export interface CounterTransaction {
  get(path: string): Promise<CounterValue | undefined>;
  set(path: string, value: CounterValue & { updatedAt?: unknown }): void;
}

export interface CounterStore {
  runTransaction<T>(work: (transaction: CounterTransaction) => Promise<T>): Promise<T>;
}

export class RateLimitExceeded extends Error {
  constructor() {
    super("Rate limit exceeded");
    this.name = "RateLimitExceeded";
  }
}

export function nextCounterValue(
  current: CounterValue | undefined,
  nowMs: number,
  limit: number,
  windowMs: number,
): { value: CounterValue; allowed: boolean } {
  if (!Number.isFinite(nowMs) || limit < 1 || windowMs < 1) {
    throw new Error("Invalid rate-limit settings");
  }
  const expired = current === undefined || nowMs - current.windowStartedAtMs >= windowMs;
  if (expired) return { value: { windowStartedAtMs: nowMs, count: 1 }, allowed: true };
  if (current.count >= limit) return { value: current, allowed: false };
  return { value: { windowStartedAtMs: current.windowStartedAtMs, count: current.count + 1 }, allowed: true };
}

export async function consumeRateLimit(
  store: CounterStore,
  uid: string,
  action: string,
  nowMs: number,
  limit = 20,
  windowMs = 60_000,
): Promise<void> {
  const path = `_rateLimits/${encodeURIComponent(uid)}_${action}`;
  await store.runTransaction(async (transaction) => {
    const current = await transaction.get(path);
    const next = nextCounterValue(current, nowMs, limit, windowMs);
    if (!next.allowed) throw new RateLimitExceeded();
    transaction.set(path, next.value);
  });
}

export async function enforceRateLimit(
  uid: string,
  action: string,
  limit = 20,
  windowMs = 60_000,
): Promise<void> {
  const db = adminDb();
  const store: CounterStore = {
    runTransaction: (work) => db.runTransaction((transaction) => work({
      get: async (path) => {
        const snapshot = await transaction.get(db.doc(path));
        if (!snapshot.exists) return undefined;
        const data = snapshot.data() ?? {};
        return {
          windowStartedAtMs: Number(data.windowStartedAtMs),
          count: Number(data.count),
        };
      },
      set: (path, value) => transaction.set(db.doc(path), {
        ...value,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    })),
  };
  try {
    await consumeRateLimit(store, uid, action, Date.now(), limit, windowMs);
  } catch (error) {
    if (error instanceof RateLimitExceeded) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }
    throw error;
  }
}
