// Caresitters app2 - the "what matters to you" fit score.
// Pure logic (no storage, no network), so node can test it.
//
// WHY THIS EXISTS: the long questionnaire is optional now. Instead of
// 60 questions, a member picks what matters to them and how much
// (Nice / Important / Must). The score blends five things, each read
// from facts the OTHER side already published on their profile card:
//   priorities  40%  weighted share of the picked priorities the other
//                    side meets (unknown facts count as "not stated",
//                    never as a yes)
//   schedule    25%  share of the family's needed days the carer can cover
//   distance    20%  1.0 at your door, 0.5 at your travel limit, 0 at 2x
//   ages        15%  the carer cares for the family's child age bands
//   questionnaire    if both finished the old questionnaire, its pair
//                    score is mixed in at 20% (the engine's own number)
// A "Must" that is known to be unmet caps the score at 59 and is named
// in `gaps`, so nobody is told "great match" with a deal-breaker open.
// Priority list grounded in what families and carers rank highest in
// Care.com, Sittercity, UrbanSitter, Winnie and Babysits surveys and
// reviews: trust and checks first, then experience with the child's
// age, reliability, schedule fit, pay, then style, languages, extras.

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const LEVELS = ["off", "nice", "important", "must"];
const LEVEL_W = { off: 0, nice: 1, important: 2, must: 3 };

// side = the viewer's side. family viewers pick what they want in a carer.
export const PRIORITIES = {
  family: [
    { id: "verified", label: "Background checked", group: "Trust" },
    { id: "references", label: "Good references and reviews", group: "Trust" },
    { id: "experience", label: "Years of experience", group: "Experience" },
    { id: "ageExp", label: "Experience with my child's age", group: "Experience" },
    { id: "firstAid", label: "First aid / CPR", group: "Experience" },
    { id: "specialNeeds", label: "Special needs experience", group: "Experience" },
    { id: "language", label: "Speaks a language I choose", group: "Family fit", config: "languages" },
    { id: "montessori", label: "Montessori / learning approach", group: "Family fit" },
    { id: "homework", label: "Homework and learning help", group: "Family fit" },
    { id: "cooking", label: "Cooks meals", group: "Practical" },
    { id: "drives", label: "Drives / has a car", group: "Practical" },
    { id: "nonSmoker", label: "Non-smoker", group: "Practical" },
    { id: "petFriendly", label: "Fine with pets", group: "Practical" },
    { id: "flexible", label: "Flexible with days and hours", group: "Schedule" },
    { id: "evenings", label: "Evenings or overnight", group: "Schedule" },
    { id: "affordable", label: "Fits my budget", group: "Schedule" },
    { id: "close", label: "Lives close to me", group: "Schedule" },
  ],
  carer: [
    { id: "pay", label: "Pay at or above my rate", group: "Pay" },
    { id: "regular", label: "Regular, steady hours", group: "Pay" },
    { id: "flexible", label: "Flexible schedule", group: "Schedule" },
    { id: "close", label: "Close to where I live", group: "Schedule" },
    { id: "ages", label: "Kids in the ages I like", group: "Kids" },
    { id: "fewKids", label: "One or two children", group: "Kids" },
    { id: "language", label: "Shares a language I choose", group: "Family fit", config: "languages" },
    { id: "noPets", label: "No pets at home", group: "Home" },
    { id: "nonSmoker", label: "Smoke-free home", group: "Home" },
    { id: "verifiedFamily", label: "Verified family", group: "Trust" },
    { id: "longTerm", label: "Long-term / ongoing work", group: "Schedule" },
    { id: "transport", label: "Transport or car provided", group: "Practical" },
    { id: "respect", label: "Clear house rules and respect", group: "Home" },
  ],
};

const norm = (s) => String(s ?? "").trim().toLowerCase();
const list = (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]);
const blob = (doc) => norm(JSON.stringify([doc?.about, doc?.card?.about, doc?.learningPlan, doc?.card?.learningPlan, doc?.card?.tasks, doc?.card?.activities, doc?.card?.cultureOffer, doc?.card?.personality, doc?.card?.certs, doc?.card?.skills, doc?.tags]));
const has = (doc, re) => re.test(blob(doc));
const dayHas = (map, d) => {
  if (Array.isArray(map)) return map.some((x) => norm(x) === norm(d));
  if (!map || typeof map !== "object") return false;
  const v = map[d] ?? map[d.toLowerCase()];
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return Object.values(v).some(Boolean);
  return Boolean(v);
};
export const daysOf = (map) => DAYS.filter((d) => dayHas(map, d));
const partsOf = (map) => { const out = new Set(); if (map && typeof map === "object" && !Array.isArray(map)) for (const v of Object.values(map)) if (Array.isArray(v)) v.forEach((p) => out.add(norm(p))); return out; };
const yearsOf = (card) => { const e = card?.experience; if (!e || typeof e !== "object") return null; const v = Object.values(e).map(Number).filter((n) => !isNaN(n)); return v.length ? Math.max(...v) : null; };
const frac = (n, d) => (d ? n / d : null);

// One evaluator per priority: returns { s: 0..1 | null, ok: text, no: text }.
// viewer = {side, card, ...}, other = candidate doc, cfg = {languages:[..]}
function evalPriority(id, v, o, ctx) {
  const vc = v.card || {}, oc = o.card || {};
  const fam = v.side === "family";
  switch (id) {
    case "verified": { const c = norm(oc.checksLevel || o.checksLevel); const s = c === "register" ? 1 : c === "sighted" ? 0.7 : c ? 0 : null; return { s, ok: "Background checked", no: "Not background checked" }; }
    case "references": { const n = Number(o.reviewCount ?? o.reviews?.length ?? 0); const r = Number(o.rating ?? o.avgStars ?? 0); return { s: n ? Math.min(1, (n >= 3 ? 1 : 0.6) * (r ? r / 5 : 1)) : (o.reviewCount === 0 ? 0 : null), ok: "Has good reviews", no: "No reviews yet" }; }
    case "experience": { const y = yearsOf(oc); return { s: y == null ? null : y >= 5 ? 1 : y >= 3 ? 0.8 : y >= 1 ? 0.5 : 0.2, ok: y >= 3 ? y + "+ years of experience" : "Some experience", no: "Little experience" }; }
    case "ageExp": { const bands = list(vc.childrenBands); const e = oc.experience; if (!bands.length || !e || typeof e !== "object") return { s: null }; const hit = bands.filter((b) => Number(e[b]) > 0).length; return { s: frac(hit, bands.length), ok: "Has cared for your child's age", no: "No experience with your child's age" }; }
    case "firstAid": return { s: has(o, /first.?aid|cpr|resuscitat/) ? 1 : (oc.checksLevel ? 0.2 : null), ok: "First aid / CPR", no: "No first aid listed" };
    case "specialNeeds": return { s: has(o, /special.?need|autis|adhd|disab/) ? 1 : null, ok: "Special needs experience", no: "No special needs experience listed" };
    case "language": { const want = list(ctx.cfg.languages).map(norm); if (!want.length) return { s: null }; const have = list(oc.languages).map(norm); if (!have.length) return { s: null }; const hit = want.filter((l) => have.includes(l)); return { s: frac(hit.length, want.length), ok: "Speaks " + hit.join(", "), no: "Doesn't list " + want.filter((l) => !have.includes(l)).join(", ") }; }
    case "montessori": return { s: has(o, /montessori|waldorf|reggio|early.?learning|educat|teacher/) ? 1 : null, ok: "Montessori / learning approach", no: "No learning approach listed" };
    case "homework": return { s: list(oc.tasks).map(norm).includes("homework help") || has(o, /homework/) ? 1 : (oc.tasks ? 0.2 : null), ok: "Helps with homework", no: "Doesn't list homework help" };
    case "cooking": return { s: oc.cooking === true ? 1 : oc.cooking === false && oc.tasks ? 0 : null, ok: "Cooks meals", no: "Doesn't cook" };
    case "drives": return { s: oc.drives === true ? 1 : oc.drives === false ? 0 : null, ok: "Drives", no: "Doesn't drive" };
    case "nonSmoker": return fam ? { s: oc.smoker === true ? 0 : oc.smoker === false ? 1 : null, ok: "Non-smoker", no: "Smoker" } : { s: oc.smokerHousehold === true ? 0 : oc.smokerHousehold === false ? 1 : null, ok: "Smoke-free home", no: "Smoking in the home" };
    case "petFriendly": return { s: vc.pets ? (oc.petsOk === true ? 1 : oc.petsOk === false ? 0 : null) : 1, ok: "Fine with pets", no: "Not keen on pets" };
    case "noPets": return { s: oc.pets === true ? 0 : oc.pets === false ? 1 : null, ok: "No pets at home", no: "Has pets" };
    case "flexible": { const d = daysOf(fam ? oc.availability : oc.scheduleNeed).length; const flag = oc.flexible === true || has(o, /flexible/); return { s: flag ? 1 : d >= 5 ? 1 : d >= 3 ? 0.6 : d ? 0.3 : null, ok: "Flexible with days", no: "Fixed days only" }; }
    case "evenings": { const p = partsOf(oc.availability); return { s: p.size ? (p.has("evening") || p.has("night") ? 1 : 0) : null, ok: "Available evenings / overnight", no: "Not available evenings" }; }
    case "affordable": { const floor = Number(oc.payFloor) || 0, offer = Number(vc.payOffered) || 0; return { s: !floor || !offer ? null : offer >= floor ? 1 : offer >= floor * 0.85 ? 0.5 : 0, ok: "Within your budget", no: "Rate is above your budget" }; }
    case "close": { const km = ctx.km; return { s: km == null ? null : km <= ctx.radius * 0.5 ? 1 : km <= ctx.radius ? 0.7 : 0.2, ok: "Lives close by", no: "Lives further away" }; }
    case "pay": { const floor = Number(vc.payFloor) || 0, offer = Number(oc.payOffered) || 0; return { s: !floor || !offer ? null : offer >= floor ? 1 : offer >= floor * 0.85 ? 0.5 : 0, ok: "Pays $" + offer + "/hr, at or above your rate", no: "Pays below your rate" }; }
    case "regular": { const d = daysOf(oc.scheduleNeed).length; return { s: d ? (d >= 3 ? 1 : 0.5) : null, ok: "Regular hours (" + d + " days)", no: "Only a day or two" }; }
    case "ages": { const mine = list(vc.agesAccepted).map(norm), kids = list(oc.childrenBands).map(norm); if (!mine.length || !kids.length) return { s: null }; const hit = kids.filter((k) => mine.includes(k)).length; return { s: frac(hit, kids.length), ok: "Kids in ages you like", no: "Kids outside your preferred ages" }; }
    case "fewKids": { const n = list(oc.childrenBands).length; return { s: n ? (n <= 2 ? 1 : 0.4) : null, ok: "One or two children", no: "Several children" }; }
    case "verifiedFamily": return { s: o.verified === true || norm(o.checksLevel) === "register" ? 1 : null, ok: "Verified family", no: "Not verified yet" };
    case "longTerm": return { s: has(o, /long.?term|ongoing|permanent|regular/) ? 1 : (daysOf(oc.scheduleNeed).length >= 3 ? 0.7 : null), ok: "Long-term work", no: "Short-term" };
    case "transport": return { s: has(o, /car provided|transport|vehicle/) ? 1 : null, ok: "Transport provided", no: "No transport listed" };
    case "respect": return { s: has(o, /rules|respect|routine|boundar/) ? 1 : null, ok: "Clear house rules", no: "House rules not stated" };
    default: return { s: null };
  }
}

export function distanceScore(km, radius) {
  if (km == null) return null;
  const r = Math.max(1, radius || 25);
  if (km <= r) return 1 - 0.5 * (km / r);
  return Math.max(0, 0.5 - 0.5 * ((km - r) / r));
}

export function scheduleScore(viewer, other) {
  const fam = viewer.side === "family";
  const need = daysOf(fam ? viewer.card?.scheduleNeed : other.card?.scheduleNeed);
  const can = daysOf(fam ? other.card?.availability : viewer.card?.availability);
  if (!need.length || !can.length) return { s: null, need, can, both: [] };
  const both = need.filter((d) => can.includes(d));
  return { s: both.length / need.length, need, can, both };
}

export function agesScore(viewer, other) {
  const fam = viewer.side === "family";
  const kids = list(fam ? viewer.card?.childrenBands : other.card?.childrenBands).map(norm);
  const ok = list(fam ? other.card?.agesAccepted : viewer.card?.agesAccepted).map(norm);
  if (!kids.length || !ok.length) return null;
  return kids.filter((k) => ok.includes(k)).length / kids.length;
}

// prefs = { levels: {id: "nice"|"important"|"must"}, languages: [..] }
export function scoreFit({ viewer, other, prefs = {}, radiusKm = 25, km = null, engine = null }) {
  const levels = prefs.levels || {};
  const cfg = { languages: prefs.languages || [] };
  const ctx = { cfg, km, radius: radiusKm };
  const reasons = [], gaps = [];
  let wSum = 0, wGot = 0, mustMissed = false;
  for (const p of PRIORITIES[viewer.side === "family" ? "family" : "carer"]) {
    const lv = levels[p.id];
    const w = LEVEL_W[lv] || 0;
    if (!w) continue;
    const r = evalPriority(p.id, viewer, other, ctx);
    if (r.s == null) { wSum += w; wGot += w * 0.35; if (lv === "must") gaps.push({ id: p.id, text: p.label + ": not stated", level: lv, unknown: true }); continue; }
    wSum += w; wGot += w * r.s;
    if (r.s >= 0.7) reasons.push({ id: p.id, text: r.ok, level: lv });
    else if (r.s < 0.5) { gaps.push({ id: p.id, text: r.no, level: lv }); if (lv === "must") mustMissed = true; }
  }
  const parts = {};
  parts.priorities = wSum ? wGot / wSum : null;
  const sch = scheduleScore(viewer, other);
  parts.schedule = sch.s;
  parts.distance = distanceScore(km, radiusKm);
  parts.ages = agesScore(viewer, other);
  const W = { priorities: 40, schedule: 25, distance: 20, ages: 15 };
  let total = 0, tw = 0;
  for (const k of Object.keys(W)) if (parts[k] != null) { total += parts[k] * W[k]; tw += W[k]; }
  let pct = tw ? (total / tw) * 100 : 50;
  if (engine && typeof engine.pair === "number") { pct = pct * 0.8 + engine.pair * 0.2; parts.questionnaire = engine.pair / 100; }
  if (mustMissed) pct = Math.min(pct, 59);
  pct = Math.max(1, Math.min(99, Math.round(pct)));
  if (sch.s != null && sch.both.length) reasons.push({ id: "days", text: "Days line up: " + sch.both.join(", "), level: "auto" });
  if (sch.s != null && sch.s < 0.5) gaps.push({ id: "days", text: "Only covers " + sch.both.length + " of " + sch.need.length + " days needed", level: "auto" });
  if (km != null) {
    if (km <= radiusKm) reasons.push({ id: "dist", text: km <= 3 ? "Very close (" + km + " km)" : km + " km away, inside your limit", level: "auto" });
    else gaps.push({ id: "dist", text: km + " km away, outside your " + radiusKm + " km limit", level: "auto" });
  }
  if (parts.ages === 1) reasons.push({ id: "agesAuto", text: viewer.side === "family" ? "Cares for your child's age" : "Kids in your ages", level: "auto" });
  return { pct, parts, reasons, gaps, mustMissed, schedule: sch };
}

export function label(pct) { return pct >= 85 ? "Great match" : pct >= 70 ? "Good match" : pct >= 55 ? "Possible match" : "Low match"; }

// ---- the lists the deck uses ----
export function inRadius(km, radiusKm) { return km == null || radiusKm == null || radiusKm <= 0 || km <= radiusKm; }
export const RADIUS_STEPS = [5, 10, 15, 25, 50, 100, 200, 0]; // 0 = any distance

export function emptyPrefs() { return { levels: {}, languages: [], done: false }; }
export function cyclePriority(levels, id) {
  const cur = levels[id] || "off";
  const next = LEVELS[(LEVELS.indexOf(cur) + 1) % LEVELS.length];
  const out = { ...levels };
  if (next === "off") delete out[id]; else out[id] = next;
  return out;
}
