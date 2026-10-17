// Caresitters app2 — the activity planner (the two homes
// build). A bank of activities by age band crossed with what
// the kids love. planDay makes three slots for a date;
// planWeek makes seven days. Both are deterministic: the same
// children on the same date always get the same plan, so the
// family and the carer see one plan, never two. No Math.random
// anywhere in the result path: a seeded pick, hashed from the
// date and the children, does the choosing.
//
// Titles and notes live in the language layer as act.<id>.t
// and act.<id>.n; this file holds structure only.

export const INTERESTS = [
  { id: "water", key: "homes.love.water" },
  { id: "drawing", key: "homes.love.drawing" },
  { id: "music", key: "homes.love.music" },
  { id: "park", key: "homes.love.park" },
  { id: "baking", key: "homes.love.baking" },
  { id: "story", key: "homes.love.story" },
  { id: "dancing", key: "homes.love.dancing" },
  { id: "blocks", key: "homes.love.blocks" },
  { id: "animals", key: "homes.love.animals" },
  { id: "sport", key: "homes.love.sport" },
];
export const INTEREST_IDS = INTERESTS.map((i) => i.id);

export const BANDS = ["0-1", "2-3", "4-5", "6-8", "9-12"];
export function bandForAge(ageYears) {
  if (ageYears == null || Number.isNaN(Number(ageYears))) return null;
  const a = Number(ageYears);
  if (a <= 1) return "0-1";
  if (a <= 3) return "2-3";
  if (a <= 5) return "4-5";
  if (a <= 8) return "6-8";
  return "9-12";
}

// The bank. bands: the age bands the activity fits. loves: the
// interests it answers. freeplay fits everyone and loves
// nothing in particular, so a plan always exists.
export const BANK = [
  { id: "swim", bands: ["2-3", "4-5", "6-8", "9-12"], loves: ["water"] },
  { id: "waterplay", bands: ["0-1", "2-3"], loves: ["water"] },
  { id: "draw", bands: ["2-3", "4-5", "6-8"], loves: ["drawing"] },
  { id: "paint", bands: ["4-5", "6-8", "9-12"], loves: ["drawing"] },
  { id: "musicshake", bands: ["0-1", "2-3"], loves: ["music"] },
  { id: "singalong", bands: ["2-3", "4-5"], loves: ["music", "story"] },
  { id: "bandjam", bands: ["6-8", "9-12"], loves: ["music"] },
  { id: "parkpicnic", bands: ["2-3", "4-5", "6-8"], loves: ["park"] },
  { id: "pramwalk", bands: ["0-1", "2-3"], loves: ["park"] },
  { id: "ballgames", bands: ["6-8", "9-12"], loves: ["park", "sport"] },
  { id: "bakemuffins", bands: ["4-5", "6-8", "9-12"], loves: ["baking"] },
  { id: "bakebiscuits", bands: ["2-3", "4-5"], loves: ["baking"] },
  { id: "storyblanket", bands: ["0-1", "2-3"], loves: ["story"] },
  { id: "storyvoices", bands: ["4-5", "6-8"], loves: ["story"] },
  { id: "danceparty", bands: ["2-3", "4-5", "6-8"], loves: ["dancing", "music"] },
  { id: "babybounce", bands: ["0-1"], loves: ["dancing", "music"] },
  { id: "blocktowers", bands: ["0-1", "2-3"], loves: ["blocks"] },
  { id: "blockcity", bands: ["4-5", "6-8"], loves: ["blocks"] },
  { id: "blockquest", bands: ["9-12"], loves: ["blocks"] },
  { id: "farmanimals", bands: ["2-3", "4-5"], loves: ["animals"] },
  { id: "petcare", bands: ["4-5", "6-8", "9-12"], loves: ["animals"] },
  { id: "birdwatch", bands: ["6-8", "9-12"], loves: ["animals", "park"] },
  { id: "obstacle", bands: ["4-5", "6-8"], loves: ["sport", "park"] },
  { id: "softplay", bands: ["0-1", "2-3"], loves: ["sport"] },
  { id: "gardendig", bands: ["2-3", "4-5"], loves: ["park"] },
  { id: "freeplay", bands: ["0-1", "2-3", "4-5", "6-8", "9-12"], loves: [] },
];
export const BANK_BY_ID = Object.fromEntries(BANK.map((e) => [e.id, e]));

// Repair, never drops: an old child record without the new
// fields keeps working. Unknown loves fall away; a bad age
// becomes no age, never a lost record.
export function normaliseChild(kid) {
  const k = kid && typeof kid === "object" ? kid : {};
  const age = Number(k.ageYears);
  const ageYears = k.ageYears != null && Number.isInteger(age) && age >= 0 && age <= 12 ? age : null;
  const loves = Array.isArray(k.loves) ? [...new Set(k.loves.filter((l) => INTEREST_IDS.includes(l)))] : [];
  return { ...k, ageYears, loves };
}
export const repairChild = normaliseChild;

function hashText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const childSig = (kids) => kids.map((k) => `${k.id || k.name || ""}:${k.ageYears ?? ""}:${[...(k.loves || [])].sort().join(",")}`).join("|");

function fitKids(entry, kids) {
  return kids.filter((k) => {
    const band = bandForAge(k.ageYears);
    return band === null || entry.bands.includes(band);
  });
}
function scoreOf(entry, fits) {
  let loved = 0;
  for (const k of fits) for (const l of entry.loves) if ((k.loves || []).includes(l)) loved += 1;
  return loved * 10 + fits.length;
}

export const SLOT_TIMES = ["09:00", "11:00", "15:30"];

function pickForSlot(kids, dateISO, slotIndex, avoidIds) {
  const cands = [];
  for (const entry of BANK) {
    const fits = fitKids(entry, kids);
    if (fits.length) cands.push({ entry, fits, score: scoreOf(entry, fits) });
  }
  if (!cands.length) return null;
  const fresh = cands.filter((c) => !avoidIds.has(c.entry.id));
  const pool = fresh.length ? fresh : cands;
  const max = Math.max(...pool.map((c) => c.score));
  const top = pool.filter((c) => c.score >= max - 10);
  const rand = mulberry32(hashText(`${dateISO}|${childSig(kids)}|slot${slotIndex}`));
  const ranked = top.map((c) => ({ c, r: rand() })).sort((a, b) => b.r - a.r);
  const pick = ranked[0].c;
  return { time: SLOT_TIMES[slotIndex], id: pick.entry.id, bands: pick.entry.bands, loves: pick.entry.loves, kids: pick.fits.map((k) => ({ id: k.id || "", name: k.name || "" })) };
}

// planDay(children, dateISO, avoidBySlot): three slots. The
// optional avoidBySlot (an array of Sets, one per slot) carries
// the previous day's picks from planWeek; a title is never
// repeated on consecutive days for the same slot where the
// bank allows a fresh one. Within a day, a title is not used
// twice where the bank allows.
export function planDay(children, dateISO, avoidBySlot) {
  const kids = (Array.isArray(children) ? children : []).map(normaliseChild);
  if (!kids.length || !dateISO) return [];
  const usedToday = new Set();
  const out = [];
  for (let s = 0; s < SLOT_TIMES.length; s += 1) {
    const avoid = new Set([...(avoidBySlot?.[s] || []), ...usedToday]);
    const slot = pickForSlot(kids, dateISO, s, avoid);
    if (slot) { usedToday.add(slot.id); out.push(slot); }
  }
  return out;
}

function addDaysISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
export function mondayOfISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // Monday is 0
  return addDaysISO(iso, -dow);
}

// planWeek(children, mondayISO): seven days, Monday first.
// Each day: {date, slots:[...]} in the planDay shape.
export function planWeek(children, mondayISO) {
  if (!mondayISO) return [];
  const out = [];
  let prev = null;
  for (let d = 0; d < 7; d += 1) {
    const date = addDaysISO(mondayISO, d);
    const avoid = prev ? prev.map((s) => new Set([s.id])) : undefined;
    const slots = planDay(children, date, avoid);
    out.push({ date, slots });
    prev = slots;
  }
  return out;
}
