// Brief weights (section 6): experience 25, personality 20, availability 20, budget 15, location 10, activities 10.
// Pure logic. A component with no data is "not stated" and is left out, never guessed. Visa eligibility is NOT in here.
import { scheduleScore, distanceScore } from "../../www/app2/fit.js";
const L = (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]).map((x) => String(x).trim().toLowerCase());
const overlap = (a, b) => { const A = L(a), B = L(b); if (!A.length || !B.length) return null; return A.filter((x) => B.includes(x)).length / Math.min(A.length, B.length); };
export const WEIGHTS = [["experience", "Experience", 25], ["personality", "Personality and care style", 20], ["availability", "Availability", 20], ["budget", "Budget", 15], ["location", "Location", 10], ["activities", "Activities", 10]];
export function briefBreakdown({ viewer, other, km, radius }) {
  const fam = viewer.side === "family", vc = viewer.card || {}, oc = other.card || {};
  const yrs = (() => { const e = (fam ? oc : vc).experience; if (!e || typeof e !== "object") return null; const v = Object.values(e).map(Number).filter((n) => !isNaN(n)); return v.length ? Math.max(...v) : null; })();
  const sch = scheduleScore(viewer, other);
  const floor = Number(fam ? oc.payFloor : vc.payFloor) || 0, offer = Number(fam ? vc.payOffered : oc.payOffered) || 0;
  const parts = {
    experience: fam && yrs != null ? (yrs >= 5 ? 1 : yrs >= 3 ? 0.8 : yrs >= 1 ? 0.5 : 0.2) : null,
    personality: overlap([...L(vc.personality), ...L(vc.careStyle)], [...L(oc.personality), ...L(oc.careStyle)]),
    availability: sch.s,
    budget: floor && offer ? (offer >= floor ? 1 : offer >= floor * 0.9 ? 0.6 : 0.2) : null,
    location: distanceScore(km, radius),
    activities: overlap(vc.activities || vc.tasks, oc.activities || oc.tasks),
  };
  const rows = WEIGHTS.map(([id, name, w]) => ({ id, name, w, s: parts[id] }));
  const known = rows.filter((r) => r.s != null), tw = known.reduce((a, r) => a + r.w, 0);
  const pct = tw >= 40 ? Math.round(known.reduce((a, r) => a + r.s * r.w, 0) / tw * 100) : null;
  return { rows, pct, coverage: tw };
}
