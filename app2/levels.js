// Caresits — the depth levels (founder approved 15 Oct 2026,
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

export const LEVELS = ["explore", "quick", "better", "full"];
export const levelRank = (l) => LEVELS.indexOf(l || "explore");

const answered = (answers, f) => {
  const v = answers?.[f.id];
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v).some((x) => (Array.isArray(x) ? x.length : x !== "" && x != null && x !== false));
  return true;
};

export function levelOf(side, answers) {
  if (!side || !answers) return "explore";
  const base = side === "family" ? FAMILY_PAGES : CARER_PAGES;
  const required = base.flatMap((p) => p.fields).filter((f) => f.required);
  if (!required.every((f) => answered(answers, f))) return "explore";
  const deep = EXPANSION[side].flatMap((p) => p.fields);
  const tierDone = (tier) => deep.filter((f) => f.level === tier).every((f) => answered(answers, f));
  if (!tierDone("quick")) return "explore";
  if (!tierDone("better")) return "quick";
  if (!tierDone("full")) return "better";
  return "full";
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
