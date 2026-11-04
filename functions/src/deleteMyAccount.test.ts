import { describe, expect, it, vi } from "vitest";
import {
  deleteMyAccountWithStore,
  requireConfirmedSelfDelete,
  type AccountDeletionStore,
} from "./deleteMyAccount.js";

describe("account deletion callable guard", () => {
  it("requires a signed-in user and explicit confirmation", () => {
    expect(() => requireConfirmedSelfDelete(undefined, true)).toThrow("UNAUTHENTICATED");
    expect(() => requireConfirmedSelfDelete("user-1", false)).toThrow("CONFIRMATION_REQUIRED");
  });

  it("removes that user's records before deleting their auth account", async () => {
    const calls: string[] = [];
    const store: AccountDeletionStore = {
      removeUserData: vi.fn(async (uid) => { calls.push(`data:${uid}`); }),
      deleteAuthUser: vi.fn(async (uid) => { calls.push(`auth:${uid}`); }),
    };
    await deleteMyAccountWithStore(store, "user-1", true);
    expect(calls).toEqual(["data:user-1", "auth:user-1"]);
  });
});
