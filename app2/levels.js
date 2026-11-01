// Caresitters — the depth levels (founder approved 15 Oct 2026,
// 23:03, "build the 3 levels"; partition filed in
// next-phase/QUESTIONNAIRE-LEVELS.md, taken from the research
// file's own gate and bucket tags, never guessed).
// EXPLORE: no questionnaire; browse everything, no
// connecting. QUICK CONNECT: profile basics + the safety and
// core set (the base journeys' required fields + every
// expansion question tagged quick: gate feeding or must
// capable; safety and core musts are never optional) —
// messaging, interest notes and job posting open here, and
// matches are rough, never Perfect Pair. BETTER MATCH: Quick
// + the main preference themes answered; scores with
// reasons; still not Perfect Pair eligible. FULL MATCH:
// every match bearing question answered (profile colour
// items may stay optional); the only Perfect Pair eligible
// level. A pair is capped by the less complete side.
import { FAMILY_PAGES, CARER_PAGES } from "./questions.js";
import { EXPANSION } from "./questions2.js";
import { ESSENTIAL_IDS, trackFields } from "./track-fields.js";

export const LEVELS = ["explore", "quick", "better", "full"];
export const levelRank = (l) => LEVELS.indexOf(l || "explore");

const answered = (answers, f) => {
  const v = answers?.[f.id];
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v).some((x) => (Array.isArray(x) ? x.length : x !== "" && x != null && x !== false));
  return true;
};

// The four tracks ask four different first builds (tracks.js,
// track-fields.js), so the "did they finish the basics" gate
// is judged per track when a track is known (Difference Map
// 31 Oct, item 4): a host family is judged on the host build,
// never on the nanny family's base pages, whose fields it was
// never asked. The photo step counts through the journey's own
// markers, and the languages must question counts an explicit
// "no preference" (an empty list the member chose) as answered.
const FIELD_DEFS = new Map();
for (const p of [...FAMILY_PAGES, ...CARER_PAGES, ...EXPANSION.family, ...EXPANSION.carer]) for (const f of p.fields) if (!FIELD_DEFS.has(f.id)) FIELD_DEFS.set(f.id, f);
for (const f of trackFields()) if (!FIELD_DEFS.has(f.id)) FIELD_DEFS.set(f.id, f);
FIELD_DEFS.set("displayName", { id: "displayName", required: true });
const trackAnswered = (answers, f, track) => {
  // On the two builds copied from the observed wizard the
  // photo is required to finish (owner's word, 1 Nov 2026):
  // a skipped photo completes nothing there. The au pair
  // tracks keep their own shape.
  if (f.id === "photo") return answers.photoDone === true || Boolean(answers.photoUrl) || ((track !== "nanny" && track !== "family-nanny") && answers.photoSkipped === true);
  if (f.id === "mustLanguages") return answers.mustLanguages !== undefined && answers.mustLanguages !== null;
  if (f.id === "education") { const v = answers.education; return typeof v === "string" ? v.trim().length > 0 : Boolean(v && v.level && String(v.text || "").trim()); }
  if (f.id === "frequency") { const v = answers.frequency; return Boolean(v && typeof v === "object" && v.often && v.soon); }
  return answered(answers, f);
};

// NOTE for future readers: "better" can never come back for a
// FAMILY, and that is intended, not a bug. The approved 50
// question cap emptied the family's Full tier, so a family that
// finishes Quick + Better has answered every match bearing
// question there is and reads "full" (levels-tests.mjs pins this
// in those words). Carers still owe their Full tier (C33, C42),
// so "better" is reachable for them. The "optional" fields are
// profile colour only and sit outside this ladder on purpose:
// Full means every MATCH BEARING question answered.
export function levelOf(side, answers, track) {
  if (!side || !answers) return "explore";
  const trackIds = track && ESSENTIAL_IDS[track] ? ESSENTIAL_IDS[track] : null;
  if (trackIds) {
    // On the two builds copied from the observed wizard,
    // finishing the build means every build step answered
    // (bar the one skippable step and the info screens),
    // whatever the older field data says. The au pair tracks
    // keep the field data rule.
    const walkTrack = track === "nanny" || track === "family-nanny";
    const required = trackIds.map((id) => FIELD_DEFS.get(id)).filter((f) => f && f.type !== "info" && (walkTrack ? f.id !== "appliesToYou" : f.required === true));
    if (!required.every((f) => trackAnswered(answers, f, track))) return "explore";
  } else {
    const base = side === "family" ? FAMILY_PAGES : CARER_PAGES;
    const required = base.flatMap((p) => p.fields).filter((f) => f.required);
    if (!required.every((f) => answered(answers, f))) return "explore";
  }
  const deep = EXPANSION[side].flatMap((p) => p.fields);
  const tierDone = (tier) => deep.filter((f) => f.level === tier).every((f) => answered(answers, f));
  if (!tierDone("quick")) return "explore";
  if (!tierDone("better")) return "quick";
  if (!tierDone("full")) return "better";
  return "full";
}

// The tier answers live as their own documents, keyed by
// pair code, each carrying its value at .v; the level judges
// a map keyed by field id. This merge is the one bridge
// between the two shapes: the boot reads the documents back
// through it, and the save's publication rebuilds through it.
// Base answers always keep their own keys; a pair's value
// answers for the fields that feed that pair.
export function mergeDeepAnswers(baseAnswers, deepByPair, side) {
  const out = { ...(baseAnswers || {}) };
  const fields = (EXPANSION[side] || []).flatMap((p) => p.fields);
  for (const f of fields) {
    if (out[f.id] !== undefined) continue;
    const e = (deepByPair || {})[f.pair];
    const v = e && typeof e === "object" && "v" in e ? e.v : e;
    if (v !== undefined) out[f.id] = v;
  }
  return out;
}

export function pairCap(levelA, levelB) {
  return LEVELS[Math.min(levelRank(levelA), levelRank(levelB))];
}

export const LEVEL_WORDS = {
  explore: "Exploring: answer the first questions to connect",
  quick: "Quick Connect: you can message and post; matches are rough while answers are light",
  better: "Better Match: your matches carry reasons; finish the deep questions for the closest fits",
  full: "Full Match: every match question answered; your pairs can reach Perfect Pair",
};
