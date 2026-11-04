import { describe, expect, it, vi } from "vitest";
import { exportOwnData, requireOwnDataRequest, type ExportDataStore } from "./exportMyData.js";

describe("private data export", () => {
  it("requires a signed-in user and rejects another user ID", () => {
    expect(() => requireOwnDataRequest(undefined)).toThrow("UNAUTHENTICATED");
    expect(() => requireOwnDataRequest("family-1", "family-2")).toThrow("PERMISSION_DENIED");
  });

  it("loads only the caller's data", async () => {
    const load = vi.fn(async (uid: string) => ({ uid, profile: { displayName: "A" } }));
    const store: ExportDataStore = { load };
    await expect(exportOwnData(store, "family-1")).resolves.toEqual({ uid: "family-1", profile: { displayName: "A" } });
    expect(load).toHaveBeenCalledWith("family-1");
  });
});
