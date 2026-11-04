import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const { normaliseWeights } = await vite.ssrLoadModule("/src/weights.jsx");
  const total = (weights) => Object.values(weights).reduce((sum, value) => sum + value, 0);
  const defaults = normaliseWeights();
  assert.deepEqual(defaults, { experience: 25, personality: 20, availability: 20, budget: 15, location: 10, activities: 10 });
  assert.equal(total(defaults), 100);
  const uneven = normaliseWeights({ experience: 50, personality: 25, availability: 25, budget: 0, location: 0, activities: 0 });
  assert.equal(total(uneven), 100);
  assert.equal(uneven.experience, 50);
  assert.equal(uneven.personality + uneven.availability, 50);
  const sparse = normaliseWeights({ experience: 80, personality: -4, availability: "bad" });
  assert.equal(total(sparse), 100);
  assert.ok(Object.values(sparse).every((value) => Number.isInteger(value) && value >= 0));
  assert.deepEqual(normaliseWeights({ experience: 0, personality: 0, availability: 0, budget: 0, location: 0, activities: 0 }), defaults);
  console.log("weights tests passed");
} finally {
  await vite.close();
}
