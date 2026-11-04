import { describe, expect, it } from "vitest";
import {
  VerificationError,
  verifyCarerWithStore,
  type VerificationStore,
} from "./verifyCarer.js";

function fakeStore(status: string) {
  const state = {
    status,
    checkedOn: undefined as Date | undefined,
    verifiedBy: undefined as string | undefined,
    root: undefined as Record<string, unknown> | undefined,
  };
  const store: VerificationStore = {
    verifySubmittedQualification: async (uid, qualificationId, verifiedBy, checkedOn) => {
      if (status !== "submitted") throw new VerificationError("failed-precondition");
      state.status = "verified";
      state.checkedOn = checkedOn;
      state.verifiedBy = verifiedBy;
      state.root = { uid, qualificationId, status: "verified", checkedOn, verifiedBy };
    },
  };
  return { store, state };
}

describe("carer verification", () => {
  it("requires an admin and prevents self-verification", async () => {
    const { store } = fakeStore("submitted");
    await expect(verifyCarerWithStore(store, "admin", false, "carer", "blue-card"))
      .rejects.toMatchObject({ code: "permission-denied" });
    await expect(verifyCarerWithStore(store, "same-user", true, "same-user", "blue-card"))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  it("writes server check time and verifier for a submitted record", async () => {
    const { store, state } = fakeStore("submitted");
    const checkedOn = new Date("2026-11-04T02:00:00.000Z");
    await verifyCarerWithStore(store, "admin", true, "carer", "blue-card", checkedOn);
    expect(state.status).toBe("verified");
    expect(state.checkedOn).toBe(checkedOn);
    expect(state.verifiedBy).toBe("admin");
    expect(state.root).toMatchObject({ uid: "carer", qualificationId: "blue-card", status: "verified" });
  });

  it("will not verify a missing or already-reviewed submission", async () => {
    const { store } = fakeStore("verified");
    await expect(verifyCarerWithStore(store, "admin", true, "carer", "blue-card"))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });
});
