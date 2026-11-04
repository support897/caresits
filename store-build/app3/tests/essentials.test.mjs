import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const { evaluateFamilyEssentials } = await vite.ssrLoadModule("/src/carerside.jsx");
  const carer = { side: "carer", card: { payFloor: 28, agesAccepted: ["toddler", "preschool"], availability: { Mon: ["morning"], Tue: ["afternoon"] }, checks: [{ kind: "Blue Card", status: "verified", checkedOn: "2026-11-03" }] } };
  const family = { side: "family", card: { maxBudget: 32, childrenBands: ["toddler"], scheduleNeed: { Mon: ["morning"] }, requiredChecks: ["Blue Card"] } };
  const read = (result) => Object.fromEntries(result.map((item) => [item.id, item]));
  const good = read(evaluateFamilyEssentials(carer, family, Date.now()));
  assert.ok(Object.values(good).every((item) => item.status === "met"));

  const mismatch = read(evaluateFamilyEssentials({ ...carer, card: { ...carer.card, payFloor: 40, agesAccepted: ["school age"], availability: { Tue: ["morning"] }, checks: [{ kind: "Blue Card", status: "verified" }] } }, family, Date.now()));
  assert.equal(mismatch["date-time"].status, "unmet");
  assert.equal(mismatch.checks.status, "unmet");
  assert.equal(mismatch.ages.status, "unmet");
  assert.equal(mismatch.budget.status, "unmet");

  const missing = read(evaluateFamilyEssentials({ side: "carer", card: {} }, { side: "family", card: {} }, Date.now()));
  assert.ok(Object.values(missing).every((item) => item.status === "unknown"));
  assert.ok(Object.values(missing).every((item) => item.text.includes("Not stated")));

  const claimed = read(evaluateFamilyEssentials({ side: "carer", card: { checks: [{ kind: "Blue Card", status: "verified" }] }, verified: true }, family, Date.now()));
  assert.equal(claimed.checks.status, "unmet");
  const real = read(evaluateFamilyEssentials({ ...carer, card: { ...carer.card, checks: [{ kind: "Blue Card", status: "verified", checkedOn: "2026-11-03" }] } }, family, Date.now()));
  assert.equal(real.checks.status, "met");
  console.log("essentials tests passed");
} finally {
  await vite.close();
}
