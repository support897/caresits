// Caresitters app2 resume reader
// Only words that sit in the text can fill a field
// A field with no grounded words stays absent

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findPhrase(text, entry) {
  if (!entry) return null;
  const re = new RegExp(`\\b${escapeRegExp(entry)}\\b`, "i");
  const match = re.exec(text);
  return match ? match[0] : null;
}

export function draftFromText(text, { languages = [], nationalities = [] } = {}) {
  const answers = {};
  const deep = {};
  const spans = {};
  let experienceYears = null;
  const source = typeof text === "string" ? text : "";
  if (!source) {
    return { ok: false, answers, deep, marks: [], spans, experienceYears: null };
  }
  const lines = source.split(/\r?\n/);

  const firstLine = lines.map((line) => line.trim()).find((line) => line.length > 0) || "";
  if (firstLine && firstLine.length <= 40 && /^[A-Z][a-zA-Z'.]+( [A-Z][a-zA-Z'.]+){1,3}$/.test(firstLine)) {
    answers.displayName = firstLine;
    spans.displayName = firstLine;
  }

  // Span claiming (HQ ruling, 19 Oct 2026): a digit run
  // already claimed by a longer phone span can never double
  // as a postcode. Phone shaped runs claim their ranges
  // first (eight or more digits, spaces allowed inside);
  // the postcode pass then takes the first four digit run
  // no claim covers, so a genuine postcode standing
  // elsewhere still extracts, and a phone number's head
  // never pre fills a wrong postcode for the carer to fix.
  const claimed = [];
  for (const m of source.matchAll(/\+?\d[\d ]{7,}\d/g)) {
    if (m[0].replace(/\D/g, "").length >= 8) claimed.push([m.index, m.index + m[0].length]);
  }
  const claimedAt = (i) => claimed.some(([a, b]) => i >= a && i < b);
  let postcodeMatch = null;
  for (const m of source.matchAll(/\b\d{4}\b/g)) {
    if (!claimedAt(m.index)) { postcodeMatch = m; break; }
  }
  if (postcodeMatch) {
    answers.postcode = postcodeMatch[0];
    spans.postcode = postcodeMatch[0];
  }

  const foundLanguages = [];
  const languageSpans = [];
  for (const entry of languages || []) {
    const matched = findPhrase(source, entry);
    if (matched) {
      foundLanguages.push(entry);
      languageSpans.push(matched);
    }
  }
  if (foundLanguages.length > 0) {
    answers.languages = foundLanguages;
    spans.languages = languageSpans.join(", ");
  }

  for (const entry of nationalities || []) {
    const matched = findPhrase(source, entry);
    if (matched) {
      answers.nationality = entry;
      spans.nationality = matched;
      break;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/first aid/i.test(line)) {
      const inDate = /in date|current|up to date/i.test(line);
      const value = inDate ? "Yes, and it is in date" : "Yes, a general first aid certificate";
      deep.xC22 = value;
      spans.xC22 = line;
      break;
    }
  }

  const contextRe = /experience|nanny|childcare|child care|babysit|au pair|carer|care work/i;
  for (const rawLine of lines) {
    if (!contextRe.test(rawLine)) continue;
    const yearsRe = /(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/gi;
    for (const match of rawLine.matchAll(yearsRe)) {
      const years = Number.parseInt(match[1], 10);
      if (Number.isFinite(years) && (experienceYears === null || years > experienceYears)) {
        experienceYears = years;
      }
    }
  }

  const marks = [];
  if ("displayName" in answers) marks.push("displayName");
  if ("postcode" in answers) marks.push("postcode");
  if ("languages" in answers) marks.push("languages");
  if ("nationality" in answers) marks.push("nationality");
  if ("xC22" in deep) marks.push("xC22");

  return { ok: marks.length > 0, answers, deep, marks, spans, experienceYears };
}

export function buildHandoff(draft) {
  const base = (draft && draft.answers) || {};
  const extra = draft && draft.deep && draft.deep.xC22 ? { xC22: draft.deep.xC22 } : {};
  return {
    side: "carer",
    answers: { ...base, ...extra },
    marks: draft ? draft.marks : [],
    feed: "resume",
  };
}
