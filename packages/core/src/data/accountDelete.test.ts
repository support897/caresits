import { describe, expect, it } from "vitest";
import { ownDocPaths } from "./accountDelete";
describe("account deletion paths", () => {
  it("only touches the caller's own areas", () => {
    const paths = ownDocPaths("u_1");
    expect(paths.length).toBeGreaterThan(8);
    expect(paths.every((p) => p.includes("u_1"))).toBe(true);
    expect(paths).toContain("profiles/u_1");
    expect(paths.some((p) => p.startsWith("relationships") || p.startsWith("careSpaces"))).toBe(false);
  });
});
