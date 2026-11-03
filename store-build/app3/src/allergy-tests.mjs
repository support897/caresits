import { checkMeal } from "./allergy.js"; import assert from "node:assert";
assert.equal(checkMeal(["peanut"], "toast with peanut butter").level, "stop");
assert.equal(checkMeal(["milk"], "rice, apple").level, "caution");
assert.equal(checkMeal(["egg"], "rice, mystery sauce").level, "check");
assert.equal(checkMeal([], "rice").level, "none");
assert.ok(checkMeal(["wheat"], "pasta").hits.length === 1);
assert.ok(checkMeal(["sesame"], "rice").warn.some((w) => /cross-contamination/.test(w)));
console.log("allergy tests ok");
