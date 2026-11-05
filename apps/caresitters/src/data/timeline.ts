/** Au pair journey: steps, progress, and a small store. Informational only, never a visa or safety decision. */
export type Step = { id: string; title: string; hint: string; who: "both" | "aupair" | "family" };
export const STEPS: Step[] = [
  { id: "match", title: "Get matched", hint: "Say hello and chat.", who: "both" },
  { id: "call", title: "Video call", hint: "Meet face to face before you decide.", who: "both" },
  { id: "terms", title: "Agree the details", hint: "Hours, pocket money, room, days off.", who: "both" },
  { id: "agency", title: "Check your programme", hint: "Some countries need an official programme or agency.", who: "both" },
  { id: "visa", title: "Apply for the visa", hint: "Use the official government page. Only they decide.", who: "aupair" },
  { id: "invite", title: "Send the invitation letter", hint: "Hosts help with papers the visa asks for.", who: "family" },
  { id: "insurance", title: "Get health insurance", hint: "Check what the country needs.", who: "aupair" },
  { id: "ticket", title: "Buy the ticket", hint: "Book after the visa is approved.", who: "aupair" },
  { id: "room", title: "Get the room ready", hint: "Bed, space, a welcome note.", who: "family" },
  { id: "arrive", title: "Arrive and settle in", hint: "Pick up at the airport, first week plan.", who: "both" },
];
export type Done = Record<string, { by: string; at: number }>;
export const progress = (done: Done): { n: number; total: number; pct: number; next?: Step } => {
  const n = STEPS.filter((s) => done[s.id]).length;
  return { n, total: STEPS.length, pct: Math.round((n / STEPS.length) * 100), next: STEPS.find((s) => !done[s.id]) };
};
export const toggle = (done: Done, id: string, uid: string, now = Date.now()): Done => {
  const next = { ...done };
  if (next[id]) delete next[id]; else next[id] = { by: uid, at: now };
  return next;
};
const key = (uid: string, relId?: string) => `caresits-timeline:${uid}:${relId ?? "solo"}`;
export function loadLocal(uid: string, relId?: string): Done {
  try { return JSON.parse(localStorage.getItem(key(uid, relId)) ?? "{}") as Done; } catch { return {}; }
}
export function saveLocal(uid: string, relId: string | undefined, done: Done): void {
  try { localStorage.setItem(key(uid, relId), JSON.stringify(done)); } catch { /* storage full or blocked */ }
}
/** Merge two devices/people: a step is done if either side ticked it (earliest tick wins). */
export function merge(a: Done, b: Done): Done {
  const out: Done = { ...a };
  for (const [id, v] of Object.entries(b)) if (!out[id] || v.at < out[id].at) out[id] = v;
  return out;
}
