// Conservative, rule-based allergy checks. NEVER decides safety: it only flags. A person must read the label.
export const ALLERGENS = {
  peanut: ["peanut", "groundnut", "arachis"],
  "tree nut": ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "nut", "praline", "marzipan", "nutella"],
  milk: ["milk", "cheese", "butter", "cream", "yoghurt", "yogurt", "whey", "casein", "ghee", "custard", "ice cream", "lactose"],
  egg: ["egg", "mayonnaise", "mayo", "meringue", "albumin", "aioli"],
  wheat: ["wheat", "flour", "bread", "pasta", "noodle", "couscous", "semolina", "cracker", "biscuit", "cake", "gluten", "barley", "rye"],
  soy: ["soy", "soya", "tofu", "edamame", "miso", "tempeh"],
  fish: ["fish", "salmon", "tuna", "cod", "anchovy", "sardine"],
  shellfish: ["prawn", "shrimp", "crab", "lobster", "oyster", "mussel", "scallop", "squid"],
  sesame: ["sesame", "tahini", "hummus"],
};
const SAFE = ["rice", "apple", "banana", "carrot", "pear", "potato", "chicken", "beef", "lamb", "pumpkin", "peas", "broccoli", "water", "oats", "orange", "cucumber", "tomato", "corn"];
export function checkMeal(allergies, text) {
  const items = String(text || "").toLowerCase().split(/[,;\n]+|\band\b|\bwith\b/).map((s) => s.trim()).filter(Boolean);
  const hits = [], unknown = [];
  for (const it of items) {
    let hit = false;
    for (const a of allergies || []) { const key = String(a).toLowerCase(); const words = ALLERGENS[key] || [key]; if (words.some((w) => it.includes(w))) { hits.push({ item: it, allergen: key }); hit = true; } }
    if (!hit && !SAFE.some((s) => it.includes(s))) unknown.push(it);
  }
  const warn = [];
  if (hits.length) warn.push("Contains an allergen for this child. Do not serve.");
  if (unknown.length) warn.push("Unknown ingredient: " + unknown.join(", ") + ". Read the label before serving.");
  if ((allergies || []).length) warn.push("Check for cross-contamination (shared pans, boards, 'may contain' labels).");
  return { level: hits.length ? "stop" : unknown.length ? "check" : (allergies || []).length ? "caution" : "none", hits, unknown, warn };
}
