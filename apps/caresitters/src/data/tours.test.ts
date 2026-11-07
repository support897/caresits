import { describe, expect, it } from "vitest";
import { ROLE_TOURS, clampStep, loadProgress, resetProgress, saveProgress, tourRoleFor, tourRolesFor } from "./tours";

function mem(init: Record<string, string> = {}) { const m = { ...init }; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } }; }
describe("role tours", () => {
  it("has six distinct tours with real steps", () => {
    const roles = Object.keys(ROLE_TOURS);
    expect(roles.sort()).toEqual(["carer:au_pair", "carer:babysitter", "carer:nanny", "family:au_pair", "family:babysitter", "family:nanny"]);
    expect(new Set(Object.values(ROLE_TOURS).map((t) => t.steps[0]!.body)).size).toBe(6);
    for (const t of Object.values(ROLE_TOURS)) for (const s of t.steps) expect(s.tab).toBeGreaterThanOrEqual(0);
  });
  it("never mentions controls that do not exist", () => {
    const text = JSON.stringify(ROLE_TOURS).toLowerCase();
    for (const bad of ["credential", "qr code", "wallet", "video call"]) expect(text).not.toContain(bad);
  });
  it("au pair carer tour keeps visa apart from skills", () => { expect(ROLE_TOURS["carer:au_pair"].steps.at(-1)!.body).toMatch(/visa.*apart/i); });
  it("picks role from services, honouring preference", () => {
    const p = { side: "carer" as const, card: { careTypes: ["nanny", "au_pair"] } };
    expect(tourRolesFor(p)).toEqual(["carer:nanny", "carer:au_pair"]);
    expect(tourRoleFor(p, "au_pair")).toBe("carer:au_pair");
    expect(tourRoleFor(p, "babysitter")).toBe("carer:nanny");
    expect(tourRoleFor({ side: "family", card: {} })).toBeNull();
  });
  it("persists, resumes, replays; legacy flag skips for experienced users", () => {
    const s = mem();
    expect(loadProgress("u", "family:nanny", s)).toEqual({ step: 0, done: false, paused: false });
    saveProgress("u", "family:nanny", { step: 3, done: false, paused: true }, s);
    expect(loadProgress("u", "family:nanny", s)).toEqual({ step: 3, done: false, paused: true });
    expect(loadProgress("u2", "family:nanny", s).step).toBe(0);
    saveProgress("u", "family:nanny", { step: 6, done: true, paused: false }, s);
    expect(loadProgress("u", "family:nanny", s).done).toBe(true);
    resetProgress("u", "family:nanny", s);
    expect(loadProgress("u", "family:nanny", s).done).toBe(false);
    expect(loadProgress("x", "carer:nanny", mem({ "caresits-tour-done": "1" })).done).toBe(true);
  });
  it("clamps steps", () => { expect(clampStep(-2, 7)).toBe(0); expect(clampStep(99, 7)).toBe(6); });
});
