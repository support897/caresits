import { describe, expect, it } from "vitest";
import { canAcceptInvite, isInviteExpired } from "./invites";

describe("care-space invite expiry", () => {
  const now = Date.parse("2026-11-04T04:00:00.000Z");

  it("accepts a valid, unused invite before its expiry", () => {
    expect(canAcceptInvite({ role: "regular", expiresAt: new Date(now + 1_000), usedBy: undefined }, now)).toBe(true);
  });

  it("rejects expired, just-expired, and used invites", () => {
    expect(isInviteExpired(new Date(now - 1), now)).toBe(true);
    expect(isInviteExpired(new Date(now), now)).toBe(true);
    expect(canAcceptInvite({ role: "regular", expiresAt: new Date(now + 1_000), usedBy: "someone" }, now)).toBe(false);
  });
});
