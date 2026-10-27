import assert from "node:assert/strict";
import {
  LEARNING_ACTIVITY_BANK, LEARNING_BAND_IDS, LEARNING_STYLES,
  learningBandForAge, learningMatchDetails, normaliseLearningPlan, hasLearningPlan, mergeLearningPlans,
  suggestLearningActivities, learningVocabulary,
} from "./activities.js";

const check = (condition, label) => { assert.ok(condition, label); console.log(`ok - ${label}`); };

check(LEARNING_ACTIVITY_BANK.length >= 120, "the curated bank has at least 120 activities");
for (const band of LEARNING_BAND_IDS) {
  const activities = LEARNING_ACTIVITY_BANK.filter((activity) => activity.bands.includes(band));
  check(activities.length >= 15, `${band} has age-matched choices`);
  check(activities.every((activity) => activity.id && activity.title && activity.titleEs && activity.howTo && activity.howToEs && activity.areas.length && activity.styles.length && activity.languagesFriendly && activity.materialsHome && activity.minutes > 0 && activity.safety.includes("Always supervise")), `${band} ideas include translated copy, materials, time, and supervision notes`);
  check(activities.every((activity) => activity.styles.every((style) => LEARNING_STYLES.includes(style))), `${band} uses known learning styles`);
  const selected = suggestLearningActivities({ children: [{ band }] }, 0, 4);
  check(selected.length === 4 && selected.every((activity) => activity.bands.includes(band)), `${band} filtering never returns an activity outside the selected age`);
}

const babyIdeas = suggestLearningActivities({ children: [{ band: "0-6m" }] }, 0, 5);
check(babyIdeas.every((activity) => activity.bands.includes("0-6m") && !/walk|walking/i.test(activity.title)), "0–6 months never gets walking games");
const olderIdeas = suggestLearningActivities({ children: [{ band: "8-12y" }] }, 0, 5);
check(olderIdeas.every((activity) => activity.bands.includes("8-12y") && !/baby|infant|tummy/i.test(activity.title)), "8–12 years never gets baby items");
check(suggestLearningActivities({ children: [] }).length === 0, "missing ages never produce unfiltered ideas");

const selected = suggestLearningActivities({ children: [{ band: "3-5y" }], areas: ["nature"], styles: ["forest-school"] }, 0, 4);
check(selected.length === 4 && selected.slice(0, 2).every((activity) => activity.areas.includes("nature") || activity.styles.includes("forest-school")), "chosen learning areas and styles move matching activities forward");

const family = { styles: ["montessori"], areas: ["music"], languages: ["Spanish"] };
const carer = { styles: ["montessori"], areas: ["music"], languages: ["Spanish"] };
const match = learningMatchDetails(family, carer);
check(match.boost === 4, "shared options give a modest score boost");
check(match.reasons.some((reason) => reason.type === "language" && reason.value === "Spanish"), "shared language creates a visible language match reason");
check(match.reasons.some((reason) => reason.type === "style" && reason.value === "montessori"), "shared style creates a visible style match reason");
check(learningMatchDetails({}, {}).boost === 0, "empty optional plans never block or boost a match");
check(hasLearningPlan({ setupComplete: true }) && !hasLearningPlan({}), "only a saved or filled plan is shared");
const shared = mergeLearningPlans({ children: [{ band: "2-3y" }], languages: ["Spanish"] }, { styles: ["montessori"] });
check(shared.children[0].band === "2-3y" && shared.languages.includes("Spanish") && shared.styles.includes("montessori"), "pair prefill keeps family ages and joins the carer's preferences");

check(learningBandForAge(0) === "0-6m" && learningBandForAge(1) === "1-2y" && learningBandForAge(4) === "3-5y", "saved family ages prefill a conservative age band");
const prefilled = normaliseLearningPlan({ children: [{ id: "private-id", name: "Private name", band: "2-3y" }] });
check(prefilled.children.length === 1 && prefilled.children[0].band === "2-3y" && !("name" in prefilled.children[0]), "prefill keeps the age band but not a child's name or ID");

const underThree = LEARNING_ACTIVITY_BANK.filter((activity) => activity.bands.some((band) => ["0-6m", "6-12m", "1-2y", "2-3y"].includes(band)));
check(underThree.every((activity) => activity.safety.includes("Always supervise") && /chok|mouth|small|food-sized/i.test(activity.safety)), "every under-three activity warns about supervision and choking hazards");
check(learningVocabulary("Spanish").length >= 3 && learningVocabulary("Unlisted").length === 0, "vocabulary appears only for reviewed language entries");

console.log(`\nALL ${LEARNING_ACTIVITY_BANK.length} learning activities and matching checks passed`);
