import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpaceSummary } from "./spaces";

const mocks = vi.hoisted(() => ({
  doc: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join("/") })),
  collection: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join("/") })),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({ ...mocks }));
vi.mock("@cc/core", () => ({ db: "fake-db" }));

import { createSpaceRequest, decideSpaceRequest, flushPendingSpaceRequests, readRequestsForSpaces } from "./requests";

describe("request Firestore adapter with fakes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("navigator", { onLine: true });
    mocks.setDoc.mockResolvedValue(undefined);
    mocks.updateDoc.mockResolvedValue(undefined);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("creates a request with a server timestamp and only contract fields", async () => {
    const created = await createSpaceRequest("space-1", {
      kind: "photo", by: "parent-1", to: "carer-1", text: "Please send a photo after painting.",
    });
    expect(mocks.setDoc).toHaveBeenCalledWith(
      { path: `careSpaces/space-1/requests/${created.id}` },
      { kind: "photo", by: "parent-1", to: "carer-1", text: "Please send a photo after painting.", state: "open", at: "SERVER_TIMESTAMP" },
    );
    expect(mocks.serverTimestamp).toHaveBeenCalledOnce();
  });

  it("updates only state when an admin resolves a request", async () => {
    const created = await createSpaceRequest("space-1", {
      kind: "meal", by: "carer-1", to: "parent-1", text: "Please pack a snack.",
    });
    await decideSpaceRequest(created, "done", "parent-1", "admin");
    expect(mocks.updateDoc).toHaveBeenCalledWith(
      { path: `careSpaces/space-1/requests/${created.id}` },
      { state: "done" },
    );
  });

  it("reads each space separately and keeps its family label", async () => {
    mocks.getDocs.mockResolvedValue({ docs: [{
      id: "request-1",
      data: () => ({ kind: "shopping", by: "carer-1", text: "Need apples.", state: "open", at: new Date("2026-11-04T08:00:00.000Z") }),
    }] });
    const space = { id: "space-1", name: "Family A" } as SpaceSummary;
    const requests = await readRequestsForSpaces([space]);
    expect(requests).toEqual([expect.objectContaining({ id: "request-1", spaceId: "space-1", spaceName: "Family A" })]);
    expect(mocks.collection).toHaveBeenCalledWith("fake-db", "careSpaces", "space-1", "requests");
  });

  it("queues an offline request and syncs it with a server timestamp", async () => {
    const rows = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => rows.get(key) ?? null,
      setItem: (key: string, value: string) => { rows.set(key, value); },
    });
    vi.stubGlobal("navigator", { onLine: false });
    const created = await createSpaceRequest("space-1", { kind: "time-off", by: "carer-1", text: "Friday afternoon." });
    expect(created.queued).toBe(true);
    expect(mocks.setDoc).not.toHaveBeenCalled();

    vi.stubGlobal("navigator", { onLine: true });
    expect(await flushPendingSpaceRequests()).toBe(1);
    expect(mocks.setDoc).toHaveBeenCalledWith(
      { path: `careSpaces/space-1/requests/${created.id}` },
      expect.objectContaining({ kind: "time-off", state: "open", at: "SERVER_TIMESTAMP" }),
    );
    expect(JSON.parse(rows.get("caresits-cs-request-writes-v1") ?? "[]")).toEqual([]);
  });
});
