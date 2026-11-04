import { describe, expect, it } from "vitest";
import { enqueueWrite, flushQueuedWrites, OFFLINE_QUEUE_KEY, readQueuedWrites, type StorageLike } from "./offlineQueue";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const write = (id: string) => ({
  id, path: `careSpaces/space-1/dayStory/${id}`, method: "set" as const,
  data: { id, text: "Saved for later" }, queuedAt: "2026-11-04T00:00:00.000Z",
});

describe("offline write queue", () => {
  it("stores only safe Care Space writes", () => {
    const storage = new MemoryStorage();
    enqueueWrite(write("item-1"), storage);
    expect(readQueuedWrites(storage)).toHaveLength(1);
    expect(storage.getItem(OFFLINE_QUEUE_KEY)).toContain("item-1");
    expect(() => enqueueWrite({ ...write("bad"), path: "relationships/pair/messages/1" }, storage)).toThrow();
  });

  it("waits offline, then flushes queued writes in order", async () => {
    const storage = new MemoryStorage();
    enqueueWrite(write("one"), storage);
    enqueueWrite(write("two"), storage);
    const sent: string[] = [];
    expect(await flushQueuedWrites(async (row) => { sent.push(row.id); }, { storage, online: false })).toBe(0);
    expect(readQueuedWrites(storage)).toHaveLength(2);
    expect(await flushQueuedWrites(async (row) => { sent.push(row.id); }, { storage, online: true })).toBe(2);
    expect(sent).toEqual(["one", "two"]);
    expect(readQueuedWrites(storage)).toEqual([]);
  });

  it("keeps a failed write and everything after it", async () => {
    const storage = new MemoryStorage();
    enqueueWrite(write("one"), storage);
    enqueueWrite(write("two"), storage);
    const sent: string[] = [];
    expect(await flushQueuedWrites(async (row) => {
      sent.push(row.id);
      if (row.id === "one") throw new Error("offline");
    }, { storage, online: true })).toBe(0);
    expect(sent).toEqual(["one"]);
    expect(readQueuedWrites(storage).map((row) => row.id)).toEqual(["one", "two"]);
  });
});
