import { describe, expect, it, beforeEach } from "vitest";
import { agentSay, resetAgent, AGENT_GAP_MS, AGENT_EVENT_COUNT } from "./bunnyAgent";
describe("bunny agent", () => {
  beforeEach(() => resetAgent());
  it("covers 20+ events", () => expect(AGENT_EVENT_COUNT).toBeGreaterThanOrEqual(20));
  it("speaks once, then stays quiet inside the gap", () => {
    expect(agentSay("open", 1000)?.mood).toBe("hello");
    expect(agentSay("save", 1000 + AGENT_GAP_MS - 1)).toBeNull();
    expect(agentSay("save", 1000 + AGENT_GAP_MS + 1)?.mood).toBe("celebrate");
  });
  it("answers urgent events right away", () => {
    agentSay("open", 1000);
    expect(agentSay("match", 1001)?.text).toMatch(/match/i);
    expect(agentSay("upload-failed", 1002)?.mood).toBe("oops");
  });
  it("a single pass is silent and 8 passes in a row offer help", () => {
    expect(agentSay("pass", 1)).toBeNull();
    let said = null as ReturnType<typeof agentSay>;
    for (let i = 0; i < 7; i++) said = agentSay("pass", 100000 + i);
    expect(said?.key).toBe("agent.streak.1");
  });
  it("never talks about safety or who is qualified", () => {
    for (const ev of ["open","save","match","rematch","profile-incomplete","deck-empty"] as const) { resetAgent(); const l = agentSay(ev, 5)!; expect(l.text).not.toMatch(/safe|qualified|approved|verified/i); }
  });
});
