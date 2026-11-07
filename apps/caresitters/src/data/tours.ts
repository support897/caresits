// Role-specific guided tours. Pure data + progress helpers (no React) so they are unit-testable.
// Every step names a REAL control (tab index or selector). The UI skips a step if its control is missing.
import { schemas, servicesOf } from "@cc/core";
const { roleOf } = schemas; type RoleId = schemas.RoleId;

export type TourStep = { id: string; tab: number; selector?: string; title: string; body: string };
export type RoleTour = { role: RoleId; label: string; steps: TourStep[]; builderHints: Record<string, string> };
export type TourProgress = { step: number; done: boolean; paused: boolean };

const SEL = { filters: 'button.icon-btn[aria-label="Filters"]', map: "button.icon-btn[aria-pressed]" };

type Words = { label: string; who: string; discover: string; saved: string; bookings: string; messages: string; me: string; hint: Record<string, string> };
const WORDS: Record<RoleId, Words> = {
  "family:nanny": { label: "Family looking for a nanny", who: "nannies", discover: "Swipe through nannies who match your family. Right to save.", saved: "Compare nannies you liked side by side.", bookings: "Trial days and regular hours live here.", messages: "Say hello and ask about routines.", me: "Your family details. Child info stays private.", hint: { "care-type": "Pick nanny so we only show nannies.", "service-details": "Hours and routines help nannies say yes fast." } },
  "family:babysitter": { label: "Family looking for a babysitter", who: "babysitters", discover: "Swipe through babysitters near you. Right to save.", saved: "Keep your go-to babysitters here.", bookings: "One-off evenings and dates are listed here.", messages: "Ask about last-minute cover here.", me: "Your family details. Child info stays private.", hint: { "care-type": "Pick babysitter so we only show babysitters.", "service-details": "Dates and kids' ages help us find the right sitter." } },
  "family:au_pair": { label: "Host family looking for an au pair", who: "au pairs", discover: "Swipe through au pairs who want your country. Right to save.", saved: "Compare au pairs you liked.", bookings: "Arrival and stay plans live here.", messages: "Chat about house rules and language.", me: "Your host family details. Child info stays private.", hint: { "care-type": "Pick au pair so we only show au pairs.", "service-details": "Room, country and rules help au pairs decide." } },
  "carer:nanny": { label: "Nanny looking for families", who: "families", discover: "Swipe through families who want a nanny. Right to save.", saved: "Families you liked wait here.", bookings: "Your confirmed days and hours.", messages: "Families message you here.", me: "Your photos, rates and checks. Families see these.", hint: { "care-type": "Pick nanny so only nanny families find you.", "service-details": "Your rate and hours help families pick you." } },
  "carer:babysitter": { label: "Babysitter looking for families", who: "families", discover: "Swipe through families who need a babysitter. Right to save.", saved: "Families you liked wait here.", bookings: "Your upcoming sits.", messages: "Families message you here.", me: "Your photos, rates and checks. Families see these.", hint: { "care-type": "Pick babysitter so only sitter families find you.", "service-details": "Your rate and free evenings help families pick you." } },
  "carer:au_pair": { label: "Au pair looking for a host family", who: "host families", discover: "Swipe through host families in your chosen country. Right to save.", saved: "Host families you liked wait here.", bookings: "Your stay plans.", messages: "Chat with host families here.", me: "Your photos and details. Visa is shown apart from childcare skills.", hint: { "care-type": "Pick au pair so only host families find you.", "service-details": "Country and dates help host families say yes." } },
};

function build(role: RoleId): RoleTour {
  const w = WORDS[role];
  const mine = role.startsWith("family") ? "My family" : "Me";
  return {
    role, label: w.label, builderHints: w.hint,
    steps: [
      { id: "discover", tab: 0, title: `Find ${w.who}`, body: w.discover },
      { id: "filters", tab: 0, selector: SEL.filters, title: "Narrow it down", body: "Use Filters to set distance, dates and needs." },
      { id: "map", tab: 0, selector: SEL.map, title: "See the map", body: `The map shows only ${w.who} you can match with.` },
      { id: "saved", tab: 1, title: "Saved", body: w.saved },
      { id: "bookings", tab: 2, title: "Bookings", body: w.bookings },
      { id: "messages", tab: 3, title: "Messages", body: w.messages },
      { id: "me", tab: 4, title: mine, body: w.me },
    ],
  };
}
export const ROLE_TOURS: Record<RoleId, RoleTour> = Object.fromEntries((Object.keys(WORDS) as RoleId[]).map((r) => [r, build(r)])) as Record<RoleId, RoleTour>;

/** Roles this profile can tour (one per service it has). Falls back to nothing if no valid service. */
export function tourRolesFor(profile: { side: "family" | "carer"; card?: unknown }): RoleId[] {
  return servicesOf(profile as never).map((s) => roleOf(profile.side, s)).filter((r): r is RoleId => !!r);
}
export function tourRoleFor(profile: { side: "family" | "carer"; card?: unknown }, preferredService?: string | null): RoleId | null {
  const roles = tourRolesFor(profile);
  if (!roles.length) return null;
  const pick = preferredService ? roleOf(profile.side, preferredService) : null;
  return pick && roles.includes(pick) ? pick : roles[0]!;
}

const key = (uid: string, role: RoleId) => `caresits-tour:${uid}:${role}`;
const LEGACY = "caresits-tour-done";
export function loadProgress(uid: string, role: RoleId, store: Pick<Storage, "getItem"> = localStorage): TourProgress {
  try {
    const raw = store.getItem(key(uid, role));
    if (raw) { const p = JSON.parse(raw); return { step: Math.max(0, Math.floor(Number(p.step) || 0)), done: !!p.done, paused: !!p.paused }; }
    // experienced users (finished the old tour) are not shown a new one
    if (store.getItem(LEGACY) === "1") return { step: 0, done: true, paused: false };
  } catch { /* storage blocked */ }
  return { step: 0, done: false, paused: false };
}
export function saveProgress(uid: string, role: RoleId, p: TourProgress, store: Pick<Storage, "setItem"> = localStorage) {
  try { store.setItem(key(uid, role), JSON.stringify(p)); } catch { /* convenience only */ }
}
/** Replay: start again from step 0 and un-done. */
export function resetProgress(uid: string, role: RoleId, store: Pick<Storage, "setItem"> = localStorage) { saveProgress(uid, role, { step: 0, done: false, paused: false }, store); }
export function clampStep(step: number, total: number) { return Math.max(0, Math.min(Math.max(0, total - 1), step)); }
