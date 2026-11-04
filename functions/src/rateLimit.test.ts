import { describe, expect, it } from "vitest";
import {
  consumeRateLimit,
  nextCounterValue,
  RateLimitExceeded,
  type CounterStore,
  type CounterValue,
} from "./rateLimit.js";

class FakeCounterStore implements CounterStore {
  readonly rows = new Map<string, CounterValue>();

  async runTransaction<T>(work: Parameters<CounterStore["runTransaction"]>[0]): Promise<T> {
    const pending = new Map<string, CounterValue>();
    const result = await work({
      get: async (path) => pending.get(path) ?? this.rows.get(path),
      set: (path, value) => { pending.set(path, value); },
    });
    for (const [path, value] of pending) this.rows.set(path, value);
    return result as T;
  }
}

describe("simple Firestore rate counter", () => {
  it("starts a new counter window", () => {
    expect(nextCounterValue(undefined, 100, 2, 1_000)).toEqual({
      value: { windowStartedAtMs: 100, count: 1 }, allowed: true,
    });
  });

  it("increments until the per-window limit", async () => {
    const store = new FakeCounterStore();
    await consumeRateLimit(store, "user-1", "test", 100, 2, 1_000);
    await consumeRateLimit(store, "user-1", "test", 200, 2, 1_000);
    await expect(consumeRateLimit(store, "user-1", "test", 300, 2, 1_000))
      .rejects.toBeInstanceOf(RateLimitExceeded);
  });

  it("restarts the counter after the window ends", async () => {
    const store = new FakeCounterStore();
    await consumeRateLimit(store, "user-1", "test", 100, 1, 100);
    await consumeRateLimit(store, "user-1", "test", 200, 1, 100);
    expect([...store.rows.values()][0]).toEqual({ windowStartedAtMs: 200, count: 1 });
  });
});
