import type { Mood } from "./Bunny";
/**
 * The bunny is the user's matching agent. Screens report what happened ("save", "match", "empty"...);
 * the agent picks a mood and one short caring line. Rules: one line at a time, never the same line twice
 * in a row, quiet gap between lines, never says anything about safety or who is qualified.
 */
export type AgentEvent =
  | "open" | "save" | "pass" | "pass-streak" | "undo" | "open-profile" | "deck-empty" | "filters-strict"
  | "match" | "rematch" | "message-sent" | "booking-sent" | "booking-accepted" | "profile-incomplete"
  | "upload-start" | "upload-done" | "upload-failed" | "offline" | "online" | "map-open" | "liked-from-map" | "timeline-step" | "timeline-done" | "chat-open" | "book-open" | "book-failed";
export type AgentLine = { mood: Mood; text: string; key: string };
const LINES: Record<AgentEvent, { mood: Mood; key: string; text: string }[]> = {
  open: [{ mood: "hello", key: "agent.open.1", text: "Hi! I'll help you find the right fit." }, { mood: "hello", key: "agent.open.2", text: "Welcome back. Ready to meet someone lovely?" }],
  save: [{ mood: "celebrate", key: "agent.save.1", text: "Nice pick! I saved them." }, { mood: "celebrate", key: "agent.save.2", text: "Good eye. I'll remember this one." }],
  pass: [{ mood: "encourage", key: "agent.pass.1", text: "No worries. The right one is coming." }],
  "pass-streak": [{ mood: "think", key: "agent.streak.1", text: "Tell me what matters most and I'll refine." }],
  undo: [{ mood: "hello", key: "agent.undo.1", text: "Back we go. Take your time." }],
  "open-profile": [{ mood: "point", key: "agent.profile.1", text: "Scroll down to see the whole story." }],
  "deck-empty": [{ mood: "rest", key: "agent.empty.1", text: "That's everyone nearby. I'll tell you when someone new joins." }],
  "filters-strict": [{ mood: "think", key: "agent.strict.1", text: "Your filters are tight. Want me to widen them a little?" }],
  match: [{ mood: "celebrate", key: "agent.match.1", text: "It's a match! Say hello." }],
  rematch: [{ mood: "hello", key: "agent.rematch.1", text: "You two already matched. Say hi again?" }],
  "message-sent": [{ mood: "encourage", key: "agent.msg.1", text: "Sent. Replies usually take a little while." }],
  "booking-sent": [{ mood: "encourage", key: "agent.book.1", text: "Request sent. I'll let you know when they reply." }],
  "booking-accepted": [{ mood: "celebrate", key: "agent.accepted.1", text: "Booked! That's a great step." }],
  "profile-incomplete": [{ mood: "point", key: "agent.incomplete.1", text: "A photo and a short hello help people trust you." }],
  "upload-start": [{ mood: "think", key: "agent.up.1", text: "Getting your photo ready…" }],
  "upload-done": [{ mood: "celebrate", key: "agent.upok.1", text: "Looks lovely. Saved!" }],
  "upload-failed": [{ mood: "oops", key: "agent.upfail.1", text: "That didn't upload. Try again, I'll wait." }],
  offline: [{ mood: "oops", key: "agent.off.1", text: "You're offline. I'll keep your place." }],
  online: [{ mood: "hello", key: "agent.on.1", text: "Back online." }],
  "map-open": [{ mood: "point", key: "agent.map.1", text: "Tap a pin to meet someone nearby." }],
  "timeline-step": [{ mood: "encourage", key: "agent.tl.1", text: "One step closer. Well done!" }],
  "timeline-done": [{ mood: "celebrate", key: "agent.tl.2", text: "Every step done. Have a wonderful time together!" }],
  "chat-open": [{ mood: "hello", key: "agent.chat.1", text: "Say hello. A short, friendly note is a great start." }],
  "book-open": [{ mood: "point", key: "agent.bookopen.1", text: "Pick a time. You can see the cost before you send." }],
  "book-failed": [{ mood: "oops", key: "agent.bookfail.1", text: "That didn't send. Check your connection and try again." }],
  "liked-from-map": [{ mood: "celebrate", key: "agent.maplike.1", text: "Saved from the map. Nice!" }],
};
/** Never speak twice inside this gap, except for events that need an answer right away. */
export const AGENT_GAP_MS = 6000;
const URGENT = new Set<AgentEvent>(["match", "rematch", "upload-failed", "offline", "booking-accepted", "book-failed"]);
type Listener = (line: AgentLine | null) => void;
const listeners = new Set<Listener>();
let lastAt = -1e15, lastKey = "", passRun = 0;
export function resetAgent(): void { lastAt = -1e15; lastKey = ""; passRun = 0; }
export function onAgentLine(fn: Listener): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function agentSay(event: AgentEvent, now: number = Date.now()): AgentLine | null {
  if (event === "pass") { passRun += 1; if (passRun >= 8) { passRun = 0; event = "pass-streak"; } } else if (event === "save") passRun = 0;
  if (event === "pass") return null; // a single pass is silent: no nagging
  if (!URGENT.has(event) && now - lastAt < AGENT_GAP_MS) return null;
  const pool = LINES[event]; const pick = pool.find((l) => l.key !== lastKey) ?? pool[0]!;
  lastAt = now; lastKey = pick.key;
  const line: AgentLine = { mood: pick.mood, text: pick.text, key: pick.key };
  listeners.forEach((fn) => fn(line));
  return line;
}
export const AGENT_EVENT_COUNT = Object.keys(LINES).length;
