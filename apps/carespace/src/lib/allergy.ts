export type AllergyStatus = "contains" | "may-contain" | "unknown-ingredient" | "no-match-found";
export type AllergyInput = string | { name: string };
export type AllergyCheck = {
  status: AllergyStatus;
  reasons: string[];
  crossContamination: string[];
};

export const ALLERGY_SAFETY_COPY = "No match found is not a safety guarantee. Check labels and ask the parent.";

const GROUPS: Record<string, readonly string[]> = {
  peanut: ["peanut", "peanuts", "groundnut", "groundnuts", "arachis", "peanut butter", "nut", "nuts", "mixed nuts"],
  "tree nut": ["tree nut", "tree nuts", "nut", "nuts", "mixed nuts", "almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pecan", "pecans", "pistachio", "pistachios", "hazelnut", "hazelnuts", "macadamia", "brazil nut", "pine nut", "praline", "marzipan", "nutella"],
  dairy: ["dairy", "milk", "cheese", "butter", "cream", "yoghurt", "yogurt", "whey", "casein", "ghee", "custard", "ice cream", "lactose", "milk powder", "sour cream"],
  egg: ["egg", "eggs", "mayonnaise", "mayo", "meringue", "albumin", "aioli"],
  gluten: ["gluten", "wheat", "flour", "bread", "pasta", "noodle", "couscous", "semolina", "cracker", "biscuit", "cake", "barley", "rye", "durum", "malt"],
  soy: ["soy", "soya", "tofu", "edamame", "miso", "tempeh", "soy sauce"],
  sesame: ["sesame", "tahini", "hummus", "sesame oil"],
  fish: ["fish", "salmon", "tuna", "cod", "anchovy", "sardine", "trout", "pollock", "fish sauce"],
  shellfish: ["shellfish", "prawn", "prawns", "shrimp", "crab", "lobster", "oyster", "mussel", "scallop", "squid", "clam", "crayfish"],
};

const ALIASES: Record<string, readonly string[]> = {
  nuts: ["peanut", "tree nut"],
  "nut allergy": ["peanut", "tree nut"],
  "peanut allergy": ["peanut"],
  "tree nuts": ["tree nut"],
  milk: ["dairy"],
  "milk allergy": ["dairy"],
  "dairy allergy": ["dairy"],
  wheat: ["gluten"],
  "wheat allergy": ["gluten"],
  "gluten/wheat": ["gluten"],
  "gluten allergy": ["gluten"],
  "egg allergy": ["egg"],
  "soy allergy": ["soy"],
  "sesame allergy": ["sesame"],
  "fish allergy": ["fish"],
  "shellfish allergy": ["shellfish"],
};

const RECOGNIZED_INGREDIENTS = [
  "rice", "apple", "banana", "carrot", "pear", "potato", "chicken", "beef", "lamb", "pumpkin", "pea", "broccoli", "water", "oat", "orange", "cucumber", "tomato", "corn", "lentil", "bean", "chickpea", "quinoa", "spinach", "onion", "garlic", "zucchini", "courgette", "sweet potato", "blueberry", "strawberry", "mango", "avocado", "lemon", "lime", "olive oil", "vegetable oil", "coconut", "coconut milk", "stock", "broth", "salt", "pepper", "herb", "spice", "cinnamon", "honey", "maple syrup", "watermelon", "melon", "grape", "peach", "plum", "apricot", "beet", "beetroot", "cauliflower", "cabbage", "celery", "mushroom", "pumpkin seed", "sunflower seed", "sesame", "tofu", "yogurt", "yoghurt", "cheese", "egg", "bread", "pasta", "flour", "oats", "noodle", "cocoa", "chocolate", "basil", "parsley", "dill", "ginger", "turmeric", "cumin", "paprika", "vanilla", "date", "raisin", "watercress", "lettuce", "pepperoni", "turkey", "pork", "fish", "salmon", "tuna", "shrimp", "prawn", "almond", "walnut", "peanut", "soy", "milk", "cream", "butter", "mayonnaise", "tahini", "miso", "edamame", "hummus", "sourdough", "cornmeal", "polenta", "rice paper", "rice vinegar", "baking powder", "baking soda", "yeast", "coconut oil", "flaxseed", "chia seed", "pumpkin puree", "tomato paste", "passata", "vegetable stock", "chicken stock", "apple sauce", "applesauce", "plain flour", "wholemeal flour", "brown rice", "white rice", "caster sugar", "sugar", "water", "vanilla extract",
];

const CROSS_CONTACT_PATTERNS = [
  /may contain/i,
  /might contain/i,
  /traces? of/i,
  /shared equipment/i,
  /shared (?:kitchen|utensils|pan|board)/i,
  /cross[- ]contamination/i,
  /processed in (?:a|the same) facility/i,
  /made in (?:a|the same) facility/i,
];

const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasTerm = (text: string, term: string) => {
  const normalizedTerm = normalize(term);
  const suffix = /[a-z0-9]$/i.test(normalizedTerm) && !normalizedTerm.endsWith("s") ? "s?" : "";
  return new RegExp(`\\b${escapeRegex(normalizedTerm)}${suffix}\\b`, "i").test(text);
};
const removeCrossContactPhrases = (text: string) => text
  .replace(/\b(?:may|might) contain\b[^,;\n]*/gi, " ")
  .replace(/\btraces? of\b[^,;\n]*/gi, " ")
  .replace(/\b(?:made|processed) on shared equipment\b(?:\s+with\b[^,;\n]*)?/gi, " ")
  .replace(/\bshared (?:equipment|kitchen|utensils|pan|board)\b(?:\s+with\b[^,;\n]*)?/gi, " ")
  .replace(/\b(?:processed|made) in (?:a|the same) facility\b[^,;\n]*/gi, " ")
  .replace(/\bcross[- ]contamination\b[^,;\n]*/gi, " ");

function allergyGroups(allergies: readonly AllergyInput[]): Set<string> {
  const groups = new Set<string>();
  for (const input of allergies) {
    const name = normalize(typeof input === "string" ? input : input.name);
    const canonical = ALIASES[name] ?? (name in GROUPS ? [name] : []);
    canonical.forEach((group) => groups.add(group));
    for (const [group, terms] of Object.entries(GROUPS)) {
      if (terms.some((term) => normalize(term) === name)) groups.add(group);
    }
    if (name === "nut" || name === "nuts") {
      groups.add("peanut");
      groups.add("tree nut");
    }
  }
  return groups;
}

function splitIngredients(text: string): string[] {
  return text.toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(/[,;\n]+|\band\b|\bwith\b|\bplus\b/)
    .map((part) => part.replace(/\b(?:organic|fresh|frozen|dried|cooked|uncooked|chopped|sliced|grated|optional|to taste|small|large|finely|roughly|pinch of|a little|some)\b/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function recognized(part: string): boolean {
  const normalized = normalize(part);
  if (!normalized) return true;
  return Object.values(GROUPS).flat().some((term) => hasTerm(normalized, normalize(term)))
    || RECOGNIZED_INGREDIENTS.some((term) => hasTerm(normalized, normalize(term)));
}

export function checkAllergy(ingredientText: string, allergies: readonly AllergyInput[] = []): AllergyCheck {
  const text = String(ingredientText ?? "").toLowerCase();
  const groups = allergyGroups(allergies);
  const hasCrossStatement = CROSS_CONTACT_PATTERNS.some((pattern) => pattern.test(text));
  const ingredientsText = removeCrossContactPhrases(text);
  const matchingText = normalize(ingredientsText.replace(/\bcoconut milk\b/gi, "coconut beverage"));
  const ingredients = text.trim() ? splitIngredients(ingredientsText) : ["No ingredients were entered"];
  const hits: string[] = [];
  for (const group of groups) {
    const terms = GROUPS[group] ?? [];
    const matched = terms.find((term) => hasTerm(matchingText, normalize(term)));
    if (matched) hits.push(`Ingredient match: ${matched} may relate to the listed ${group} allergy.`);
  }

  const crossContamination = groups.size
    ? ["Check for cross-contamination from shared pans, boards, utensils, and label statements."]
    : [];
  if (hasCrossStatement && groups.size) crossContamination.push("The ingredient text mentions possible cross-contact. Ask the parent before serving.");

  const unknown = ingredients.filter((part) => !recognized(part));
  const reasons = [...hits];
  if (hasCrossStatement && groups.size) reasons.push("Possible cross-contact wording was found. Ask the parent before serving.");
  if (unknown.length) reasons.push(`Unknown ingredient: ${unknown.join(", ")}. Check the full label with the parent.`);
  if (!hits.length && !hasCrossStatement && !unknown.length) reasons.push("No listed ingredient matched a known allergy term.");
  reasons.push(ALLERGY_SAFETY_COPY);

  const status: AllergyStatus = hits.length ? "contains" : hasCrossStatement && groups.size ? "may-contain" : unknown.length ? "unknown-ingredient" : "no-match-found";
  return { status, reasons, crossContamination };
}

export const ALLERGEN_SYNONYMS = GROUPS;
