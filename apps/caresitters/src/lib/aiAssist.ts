export type ProfileFacts = {
  languages?: string[];
  experienceYears?: number | string;
  careTypes?: string[];
  style?: string[];
};
export type ExtractedPrefs = { prefs: Record<string, string[]>; matchedPhrases: string[] };

const UNSUPPORTED_TRUST_CLAIM = /\b(?:verified|qualified|experienced)\b/i;
const cleanList = (items: unknown): string[] => Array.isArray(items)
  ? [...new Set(items.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter((item) => Boolean(item) && !UNSUPPORTED_TRUST_CLAIM.test(item)))]
  : [];

/** Uses only entered profile facts. It does not add praise, check claims, or qualifications. */
export function suggestIntro(profileFacts: ProfileFacts): string {
  const lines: string[] = [];
  const languages = cleanList(profileFacts.languages);
  const careTypes = cleanList(profileFacts.careTypes);
  const style = cleanList(profileFacts.style);
  const rawYears = profileFacts.experienceYears;
  const years = typeof rawYears === "string" ? (rawYears.trim() ? Number(rawYears) : Number.NaN) : rawYears;
  if (careTypes.length) lines.push(`Care types: ${careTypes.join(", ")}.`);
  if (languages.length) lines.push(`Languages: ${languages.join(", ")}.`);
  if (typeof years === "number" && Number.isFinite(years) && years >= 0) lines.push(`Childcare experience: ${years} ${years === 1 ? "year" : "years"}.`);
  if (style.length) lines.push(`Care style: ${style.join(", ")}.`);
  return lines.join(" ");
}

const RULES: Array<{ group: string; value: string; phrase: string }> = [
  { group: "style", value: "Montessori", phrase: "montessori" },
  { group: "style", value: "gentle parenting", phrase: "gentle parenting" },
  { group: "style", value: "calm routines", phrase: "calm routines" },
  { group: "style", value: "child-led play", phrase: "child-led play" },
  { group: "style", value: "structured routines", phrase: "structured routines" },
  { group: "activities", value: "outdoor play", phrase: "outdoor play" },
  { group: "activities", value: "reading", phrase: "reading" },
  { group: "activities", value: "arts and crafts", phrase: "arts and crafts" },
  { group: "activities", value: "cooking", phrase: "cooking" },
  { group: "activities", value: "music", phrase: "music" },
  { group: "activities", value: "nature walks", phrase: "nature walks" },
  { group: "activities", value: "park visits", phrase: "park visits" },
  { group: "languages", value: "English", phrase: "english" },
  { group: "languages", value: "Spanish", phrase: "spanish" },
  { group: "languages", value: "Arabic", phrase: "arabic" },
  { group: "languages", value: "Hindi", phrase: "hindi" },
  { group: "languages", value: "Vietnamese", phrase: "vietnamese" },
  { group: "languages", value: "Cantonese", phrase: "cantonese" },
  { group: "languages", value: "Mandarin", phrase: "mandarin" },
];

/** Extracts only fixed preferences whose exact words appear in the supplied text. */
export function extractPrefs(freeText: string): ExtractedPrefs {
  const text = freeText.toLocaleLowerCase();
  const found: Array<{ at: number; group: string; value: string; phrase: string }> = [];
  for (const rule of RULES) {
    const at = text.indexOf(rule.phrase);
    if (at >= 0) found.push({ at, group: rule.group, value: rule.value, phrase: rule.value });
  }
  found.sort((a, b) => a.at - b.at);
  const prefs: Record<string, string[]> = {};
  for (const item of found) {
    const values = prefs[item.group] ?? (prefs[item.group] = []);
    if (!values.includes(item.value)) values.push(item.value);
  }
  return { prefs, matchedPhrases: [...new Set(found.map((item) => item.phrase))] };
}
