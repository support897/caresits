import { describe, expect, it } from "vitest";
import { normalizeNewSpaceRequest, transitionSpaceRequest } from "./requests";
import type { CareSpaceRequestRecord } from "@cc/core/src/schemas/space-extras";

const openRequest: CareSpaceRequestRecord = {
  kind: "photo",
  by: "parent-1",
  to: "carer-1",
  text: "Please share a photo after painting.",
  state: "open",
  at: new Date("2026-11-04T08:00:00.000Z"),
};

describe("CareSpace requests", () => {
  it("trims request text and starts new requests open", () => {
    expect(normalizeNewSpaceRequest({
      kind: "meal", by: " parent-1 ", to: " carer-1 ", text: "  Please pack lunch.  ",
    })).toEqual({
      kind: "meal", by: "parent-1", to: "carer-1", text: "Please pack lunch.", state: "open",
    });
  });

  it("rejects blank or overlong requests", () => {
    expect(() => normalizeNewSpaceRequest({ kind: "swap", by: "carer-1", text: "   " })).toThrow("request-text-required");
    expect(() => normalizeNewSpaceRequest({ kind: "swap", by: "carer-1", text: "x".repeat(301) })).toThrow("invalid-request");
  });

  it("lets the addressed member or an admin resolve an open request", () => {
    expect(transitionSpaceRequest(openRequest, "done", "carer-1", "regular").state).toBe("done");
    expect(transitionSpaceRequest(openRequest, "declined", "parent-admin", "admin").state).toBe("declined");
    expect(() => transitionSpaceRequest(openRequest, "done", "another-carer", "regular"))
      .toThrow("request-decision-not-allowed");
    expect(() => transitionSpaceRequest({ ...openRequest, state: "done" }, "declined", "carer-1", "regular"))
      .toThrow("request-no-longer-open");
  });
});
