// Caresits matching engine — the LOCKED design of 15 Oct 2026.
// AMENDMENT (founder approved 15 Oct 2026, 22:54, with the longer
// questionnaire): the deep question pairs ride this engine. Pair
// points blend inside the SAME buckets (a bucket with answered
// pairs is 60 percent its classic score + 40 percent the pair
// agreement; a bucket with no answered pairs is untouched, so
// every locked worked example still reads the same). Three gate
// changes ride with it: group size as a hard line, stay length
// inside the schedule gate, and a centre or school must inside
// the checks gate. The living in house rules and the allergy
// line ride the gates they were approved under.
// Pure logic: no storage, no network. Inputs are the two matching
// cards (see DATA-MODEL-MATCHING.md) plus the distance between the
// homes in km, computed by the caller.
//
// GATE 1 (hard lines, both directions): fail one, never shown.
// The carer is never told they failed, or why.
// GATE 2 (100 points, family direction):
//   Trust and warmth 20 · Experience in the family's exact age
//   bands 20 · Schedule fit 20 · Approach and routine style 15 ·
//   Language and culture sharing 10 · Distance 10 · Tasks and
//   skills 5.
// The carer direction mirrors with its own buckets (ages fit 20,
// schedule 20, pay 20, home facts 20, distance 10, warmth 10).
// Pair = the average of the two direction scores.
// PERFECT PAIR: pair at least 90 AND each side at least 85 AND
// every must met (gate 1 passed both ways). Money never breaks a
// tie. No pay to rank, ever.

export const CHECK_RANK = { none: 0, sighted: 1, register: 2 };

function partsCovered(need, have) {
  let total = 0, covered = 0;
  for (const [day, parts] of Object.entries(need || {})) {
    for (const p of parts) {
      total += 1;
      if ((have?.[day] || []).includes(p)) covered += 1;
    }
  }
  return total === 0 ? 1 : covered / total;
}

function daysTouched(need, have) {
  for (const [day, parts] of Object.entries(need || {})) {
    if (parts.length && !(have?.[day] || []).length) return false;
  }
  return true;
}

const share = (wanted, held) => {
  if (!wanted?.length) return 1;
  const hit = wanted.filter((w) => (held || []).includes(w)).length;
  return hit / wanted.length;
};

// Gate 1, family direction. Returns the failed gate name or null.
export function gateFamily(family, carer, distanceKm) {
  const m = family.musts || {};
  if (!daysTouched(family.scheduleNeed, carer.availability)) return "not free on a day you need";
  const maxD = Math.min(m.maxDistanceKm ?? Infinity, carer.maxDistanceKm ?? Infinity);
  if (distanceKm > maxD) return "too far away";
  if ((m.languages || []).some((l) => !(carer.languages || []).includes(l))) return "a language you must have";
  if (m.checksLevel && CHECK_RANK[carer.checksLevel || "none"] < CHECK_RANK[m.checksLevel]) return "a check at the level you asked for";
  if (m.ageBand && (carer.age < m.ageBand[0] || carer.age > m.ageBand[1])) return "the age band you set";
  if (m.nationality && carer.nationality !== m.nationality) return "the nationality you set";
  if (m.nonSmoker && carer.smoker) return "non smoker, as you set";
  for (const [band, years] of Object.entries(m.experience || {})) {
    if ((carer.experience?.[band] || 0) < years) return "experience with your children's ages";
  }
  if (m.drives && !carer.drives) return "drives, as you set";
  if (m.ownCar && !carer.ownCar) return "their own car, as you set";
  if (family.pets && m.petsOk !== false && carer.petsOk === false) return "at home with your pets";
  if (m.cooking && !carer.cooking) return "cooking, as you set";
  if ((m.tasks || []).some((t) => !(carer.tasks || []).includes(t))) return "a task you must have covered";
  if (m.specialNeeds && !carer.specialNeeds) return "special needs experience, as you set";
  return deepGateFamily(family, carer);
}

// Gate 1, carer direction. Returns the failed gate name or null.
export function gateCarer(family, carer) {
  if ((family.childrenBands || []).some((b) => !(carer.agesAccepted || []).includes(b))) return "children's ages they take";
  if (carer.payFloor && (family.payOffered || 0) < carer.payFloor) return "their pay floor";
  if (carer.nonSmokerHousehold && family.smokerHousehold) return "a non smoking home, as they set";
  if ((carer.tasksRefused || []).some((t) => (family.musts?.tasks || []).includes(t))) return "a task they do not do";
  return deepGateCarer(family, carer);
}

export function scoreFamily(family, carer, distanceKm) {
  const parts = {};
  parts.trustWarmth =
    (carer.checksLevel === "register" ? 10 : carer.checksLevel === "sighted" ? 6 : 2) +
    Math.round(10 * share(family.prefs?.personality, carer.personality));
  const bands = family.childrenBands || [];
  parts.experience = bands.length
    ? Math.round(20 * (bands.reduce((s, b) => s + Math.min((carer.experience?.[b] || 0) / 5, 1), 0) / bands.length))
    : 20;
  parts.schedule = Math.round(20 * partsCovered(family.scheduleNeed, carer.availability));
  parts.approach =
    (family.prefs?.routineStyle && carer.routineStyle === family.prefs.routineStyle ? 9 : family.prefs?.routineStyle ? 3 : 9) +
    Math.round(6 * share(family.prefs?.activities, carer.activities));
  const langShare = share(family.languages, carer.languages);
  const nat =
    !family.prefs?.nationality ? 5 : carer.nationality === family.prefs.nationality ? 5 : 2;
  parts.languageCulture = Math.round(5 * langShare) + nat;
  const maxD = Math.min(family.musts?.maxDistanceKm ?? 30, carer.maxDistanceKm ?? 30);
  parts.distance = distanceKm <= 2 ? 10 : Math.max(0, Math.round(10 * (1 - (distanceKm - 2) / Math.max(maxD - 2, 1))));
  parts.tasks =
    Math.round(3 * share(family.prefs?.tasks, carer.tasks)) +
    (family.prefs?.cooking ? (carer.cooking ? 2 : 0) : 2);
  deepBlend(parts, family, carer, "family");
  const total = Object.values(parts).reduce((s, v) => s + v, 0);
  return { total, parts };
}

export function scoreCarer(family, carer, distanceKm) {
  const parts = {};
  const accepted = (family.childrenBands || []).filter((b) => (carer.agesAccepted || []).includes(b)).length;
  const preferred = (family.childrenBands || []).filter((b) => (carer.agesPreferred || []).includes(b)).length;
  parts.ages = (family.childrenBands || []).length
    ? Math.round(12 * (accepted / family.childrenBands.length) + 8 * (preferred / family.childrenBands.length))
    : 20;
  parts.schedule = Math.round(20 * partsCovered(family.scheduleNeed, carer.availability));
  parts.pay = !carer.payFloor ? 20 : family.payOffered >= carer.payFloor * 1.2 ? 20 : family.payOffered >= carer.payFloor ? 14 : 0;
  parts.home =
    (family.pets ? (carer.petsOk ? 8 : 0) : 8) +
    (family.smokerHousehold ? (carer.smokerHouseholdOk ? 6 : 0) : 6) +
    Math.round(6 * (1 - share(carer.tasksRefused, family.musts?.tasks)));
  const maxD = Math.min(family.musts?.maxDistanceKm ?? 30, carer.maxDistanceKm ?? 30);
  parts.distance = distanceKm <= 2 ? 10 : Math.max(0, Math.round(10 * (1 - (distanceKm - 2) / Math.max(maxD - 2, 1))));
  parts.warmth = Math.round(10 * share(carer.personality, family.prefs?.personality)) || Math.round(10 * share(family.prefs?.activities, carer.activities));
  deepBlend(parts, family, carer, "carer");
  const total = Object.values(parts).reduce((s, v) => s + v, 0);
  return { total, parts };
}

// ---------- The deep pairs (the longer questionnaire) ----------
// Paired questions share a number unless this map says otherwise.
export const PAIR_OF = { F16: "C15", F21: "C22", F25: "C28", F26: "C29", F27: "C30", F32: "C33", F38: "C42", F46: "C51" };
const carerPairOf = (fCode) => PAIR_OF[fCode] || "C" + fCode.slice(1);
const GROUP_NUM = { One: 1, Two: 2, Three: 3, "Four or more": 4, "No set limit": Infinity };
const STAY_RANK = { "A few weeks": 1, "One school term": 2, "About six months": 3, "A year or more": 4, "As long as it works": 5, "I hope to stay as long as it works": 5 };

function deepGateFamily(family, carer) {
  const md = family.musts?.deep || {};
  const cp = carer.prefs?.deep || {};
  const cv = (fCode) => cp[carerPairOf(fCode)]?.v;
  if (Array.isArray(md.F8) && md.F8.some((f) => f !== "None")) {
    const exp = cv("F8");
    if (!exp || exp === "Not yet") return "a food allergy they cannot manage yet";
  }
  if (md.F21 && !String(cv("F21") || "").startsWith("Yes")) return "a first aid certificate, as you set";
  if (md.F38) {
    const settings = cv("F38") || [];
    if (!settings.includes("A childcare centre") && !settings.includes("A school")) return "centre or school experience, as you set";
  }
  if (md.F32) {
    const need = GROUP_NUM[md.F32] ?? 1;
    const limit = GROUP_NUM[cv("F32")] ?? Infinity;
    if (need > limit) return "more children at once than they take";
    const fp = family.prefs?.deep || {};
    if (fp.F46?.v === "Shared with another family" && cv("F46") === "No") return "more children at once than they take";
  }
  if (md.F16 && (STAY_RANK[cv("F16")] ?? 5) < (STAY_RANK[md.F16] ?? 1)) return "a shorter stay than you need";
  if (md.F25) {
    if (md.F25 === "No guests" && cv("F25") !== "I do not have guests") return "no guests at home, as you set";
    if (md.F25 === "Yes, if they ask first" && cv("F25") === "I would rather have free visiting") return "guests only when they ask first, as you set";
  }
  if (md.F26 === "No" && cv("F26") === "Yes") return "no overnight guests, as you set";
  if (md.F27 && md.F27 !== "No set time" && cv("F27") === "I would rather not") return "the home by time you set";
  return null;
}

function deepGateCarer(family, carer) {
  const cmd = carer.musts?.deep || {};
  const fp = family.prefs?.deep || {};
  if (cmd.C39 === "No" && (fp.F36?.v || []).includes("Pool")) return "a home with a pool, as they set";
  if (cmd.C57 === "No" && fp.F50?.v === "Yes") return "cameras in shared areas, as they set";
  return null;
}

function pairAgreement(a, b, options) {
  if (a === undefined || b === undefined) return null;
  if (Array.isArray(a) || Array.isArray(b)) {
    const A = Array.isArray(a) ? a : [a]; const B = Array.isArray(b) ? b : [b];
    if (!A.length || !B.length) return null;
    return A.filter((x) => B.includes(x)).length / Math.max(A.length, B.length);
  }
  if (a === b) return 1;
  if (Array.isArray(options) && options.includes(a) && options.includes(b)) {
    return 1 - Math.abs(options.indexOf(a) - options.indexOf(b)) / (options.length - 1);
  }
  return 0.25;
}

const FEED_BUCKET = { approach: "approach", trust: "trustWarmth", experience: "experience", schedule: "schedule", language: "languageCulture", tasks: "tasks" };
const FEED_BUCKET_CARER = { approach: "warmth", trust: "warmth", experience: "ages", schedule: "schedule", language: "warmth", tasks: "home" };

export function deepBlend(parts, family, carer, direction) {
  const fp = family.prefs?.deep || {};
  const cp = carer.prefs?.deep || {};
  const map = direction === "family" ? FEED_BUCKET : FEED_BUCKET_CARER;
  const byBucket = {};
  for (const [fCode, entry] of Object.entries(fp)) {
    const c = cp[carerPairOf(fCode)];
    if (!c) continue;
    const bucket = map[entry.feed];
    if (!bucket || !(bucket in parts)) continue;
    const agree = pairAgreement(entry.v, c.v, null);
    if (agree === null) continue;
    (byBucket[bucket] = byBucket[bucket] || []).push(agree);
  }
  const MAX = { trustWarmth: 20, experience: 20, schedule: 20, approach: 15, languageCulture: 10, tasks: 5, ages: 20, pay: 20, home: 20, warmth: 10, distance: 10 };
  for (const [bucket, agrees] of Object.entries(byBucket)) {
    const avg = agrees.reduce((s, v) => s + v, 0) / agrees.length;
    parts[bucket] = Math.round(parts[bucket] * 0.6 + MAX[bucket] * avg * 0.4);
  }
  return parts;
}

export function labelFor(pair, familyScore, carerScore) {
  if (pair >= 90 && familyScore >= 85 && carerScore >= 85) return "Perfect Pair";
  if (pair >= 75) return "Strong Fit";
  return "Good Fit";
}

export function matchPair(family, carer, distanceKm, levels) {
  const failedFamily = gateFamily(family, carer, distanceKm);
  if (failedFamily) return { shown: false, failedGate: failedFamily, toldTo: "family" };
  const failedCarer = gateCarer(family, carer);
  if (failedCarer) return { shown: false, failedGate: failedCarer, toldTo: "family" };
  const f = scoreFamily(family, carer, distanceKm);
  const c = scoreCarer(family, carer, distanceKm);
  const pair = Math.round((f.total + c.total) / 2);
  const capFull = !levels || ((!levels.family || levels.family === "full") && (!levels.carer || levels.carer === "full"));
  const reasons = ["Meets every must you set ✓"];
  if (partsCovered(family.scheduleNeed, carer.availability) === 1) reasons.push("Free all your days ✓");
  if (share(family.languages, carer.languages) === 1 && (family.languages || []).length) reasons.push("Speaks your languages ✓");
  if (distanceKm <= 3) reasons.push("Lives close by ✓");
  reasons.push("You fit their musts too ✓");
  if (!capFull && (levels.family === "quick" || levels.carer === "quick")) reasons.push("Quick profile, rough match");
  return {
    shown: true,
    familyScore: f.total,
    carerScore: c.total,
    familyParts: f.parts,
    carerParts: c.parts,
    pair,
    label: capFull ? labelFor(pair, f.total, c.total) : (labelFor(pair, f.total, c.total) === "Perfect Pair" ? "Strong Fit" : labelFor(pair, f.total, c.total)),
    reasons,
  };
}

// Rank shown candidates. Tie breaks, in order: used before, wider
// hour cover, faster usual reply, closer. Money never breaks a tie.
export function rank(matches) {
  return [...matches].sort(
    (a, b) =>
      b.result.pair - a.result.pair ||
      Number(b.usedBefore || false) - Number(a.usedBefore || false) ||
      partsCovered(b.family?.scheduleNeed, b.carer?.availability) - partsCovered(a.family?.scheduleNeed, a.carer?.availability) ||
      (a.carer?.replyHours ?? 999) - (b.carer?.replyHours ?? 999) ||
      a.distanceKm - b.distanceKm
  );
}

export const topFive = (ranked) => ranked.slice(0, 5);
export const viewMore = (ranked) => ranked.slice(5);
