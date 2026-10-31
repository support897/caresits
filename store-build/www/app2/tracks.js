// Caresitters app2 — the four tracks (Ilse, 31 Oct 2026).
// After the one sign-up, the app asks who you are, then what you
// are looking for. That makes four separate tracks, each with its
// own questions, its own order and its own profile shape:
//   family-nanny  : a family looking for a nanny or babysitter
//   family-aupair : a host family looking for an au pair
//   nanny         : a nanny or babysitter
//   aupair        : an au pair
// Everything here is plain data and pure helpers so it can be unit
// tested without a browser (tracks-tests.mjs).
//
// RULES FENCE (important): the live Firestore rules fence the public
// card tightly (profiles/{uid}.card may only hold the keys listed in
// accounts/firestore.rules.live-2026-10-28d.txt, and card.auPair may
// only hold on, arrival, homeCountry, english, infant, drives, swim).
// The rules cannot be redeployed from here (OWNER MUST DEPLOY). So the
// extra public au pair facts (track, places, stay, hours) ride inside
// the one free-text field card.auPair.arrival, packed as
//   "2026-12;t=aupair;d=DE,ES;s=12"
// by packAuPair() and read back by unpackAuPair(). The full private
// answers are saved untouched in the member's own questionnaire.
// A later rules amendment can give each fact its own key; only these
// two functions would change.

import { WORLD } from "./world.js";

export const TRACK_IDS = ["family-nanny", "family-aupair", "nanny", "aupair"];

export const TRACKS = {
  "family-nanny": { side: "family", entryRole: "family", auPair: false },
  "family-aupair": { side: "family", entryRole: "family", auPair: true },
  nanny: { side: "carer", entryRole: "career", auPair: false },
  aupair: { side: "carer", entryRole: "career", auPair: true },
};

export const isTrack = (t) => TRACK_IDS.includes(t);
export const sideOfTrack = (t) => (TRACKS[t] ? TRACKS[t].side : "");
export const isAuPairTrack = (t) => Boolean(TRACKS[t] && TRACKS[t].auPair);

// What the first two screens say (the bunny speaks plain words).
export const WHO_CARDS = [
  { id: "family", title: "I'm a family", body: "I need someone to look after my children" },
  { id: "carer", title: "I'm a carer", body: "I look after children, or I want to" },
];
export const LOOKING_CARDS = {
  family: [
    { track: "family-nanny", title: "A nanny or babysitter", body: "Someone local, who comes to us" },
    { track: "family-aupair", title: "An au pair", body: "Someone from another country who lives with us" },
  ],
  carer: [
    { track: "nanny", title: "I'm a nanny or babysitter", body: "I work near where I live" },
    { track: "aupair", title: "I'm an au pair", body: "I want to live and help with a family, maybe abroad" },
  ],
};

// ---------- Countries (for the au pair map and pickers) ----------
export const WORLD_NAMES = WORLD.map((c) => c[1]).sort((a, b) => a.localeCompare(b));
const byName = new Map(WORLD.map((c) => [c[1], c]));
const byCode = new Map(WORLD.map((c) => [c[0], c]));
export const countryPoint = (name) => { const c = byName.get(name); return c ? { code: c[0], name: c[1], lat: c[2], lng: c[3], region: c[4] } : null; };
export const countryByCode = (code) => { const c = byCode.get(code); return c ? { code: c[0], name: c[1], lat: c[2], lng: c[3], region: c[4] } : null; };

// ---------- Months ----------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthChoices(now = new Date(), count = 14) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`);
  }
  return out;
}
export function monthToYm(label) {
  const m = /^([A-Za-z]{3}) (\d{4})$/.exec(String(label || ""));
  if (!m) return "";
  const i = MONTHS.indexOf(m[1]);
  return i < 0 ? "" : `${m[2]}-${String(i + 1).padStart(2, "0")}`;
}
export function ymToMonth(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ""));
  return m ? `${MONTHS[Number(m[2]) - 1] || "?"} ${m[1]}` : "";
}

// ---------- Option lists ----------
export const STAY_MONTHS = ["3", "6", "9", "12", "18", "24"];
export const HOURS_WEEK = ["10", "15", "20", "25", "30", "35", "40", "45"];
export const DUTIES = ["School run", "Meals for the children", "Playtime", "Bath and bedtime", "Homework help", "Tidy the children's rooms", "Light laundry for the children"];
export const HOST_EXTRAS = ["Own private room", "Wifi", "Mobile phone plan", "Health insurance", "Language course", "Travel pass", "Use of a car", "Meals with the family"];
export const ENGLISH_LEVELS = ["Basic", "Good", "Fluent"];

// ---------- Packing the public au pair facts ----------
const clean = (s) => String(s ?? "").replace(/[;=,]/g, " ").trim();

// a: the journey answers. Returns the card.auPair map the live rules admit.
export function packAuPair(track, a = {}) {
  if (!isAuPairTrack(track)) return null;
  const parts = [];
  const ymKey = track === "aupair" ? "arrivalFrom" : "wantArrive";
  const ym = monthToYm(a[ymKey]);
  parts.push(ym || "");
  parts.push("t=" + (track === "aupair" ? "aupair" : "host"));
  if (track === "aupair") {
    const dest = a.destinations || {};
    if (dest.worldwide) parts.push("w=1");
    const codes = (dest.list || []).map((n) => (countryPoint(n) || {}).code).filter(Boolean);
    if (codes.length) parts.push("d=" + codes.join(","));
    if (a.stayMonths) parts.push("s=" + clean(a.stayMonths));
  } else {
    if (a.wantStay) parts.push("s=" + clean(a.wantStay));
    if (a.hoursWeek) parts.push("h=" + clean(a.hoursWeek));
    if (a.hostRoom === true) parts.push("r=1");
  }
  const out = {
    on: true,
    arrival: parts.join(";"),
    homeCountry: clean(track === "aupair" ? a.homeCountry : a.country) || "",
  };
  if (a.english) out.english = a.english;
  if (track === "aupair") {
    out.infant = a.infantOk === true;
    out.drives = String(a.drivesCar || "").startsWith("I drive");
    out.swim = a.swim === true;
  } else {
    out.infant = (a.childrenBands || []).includes("0-1");
  }
  return out;
}

export function unpackAuPair(ap) {
  const out = { track: "", ym: "", stay: null, hours: null, room: false, worldwide: false, dest: [], country: "", english: "", infant: false, drives: false, swim: false };
  if (!ap || typeof ap !== "object") return out;
  const segs = String(ap.arrival || "").split(";");
  out.ym = /^\d{4}-\d{2}$/.test(segs[0]) ? segs[0] : "";
  for (const seg of segs.slice(1)) {
    const [k, v = ""] = seg.split("=");
    if (k === "t") out.track = v === "host" ? "host" : v === "aupair" ? "aupair" : "";
    if (k === "w") out.worldwide = v === "1";
    if (k === "d") out.dest = v.split(",").filter(Boolean);
    if (k === "s") out.stay = Number(v) || null;
    if (k === "h") out.hours = Number(v) || null;
    if (k === "r") out.room = v === "1";
  }
  // Older cards that never used the packed form: a plain au pair.
  if (!out.track && ap.on === true) out.track = "aupair";
  out.country = ap.homeCountry || "";
  out.english = ap.english || "";
  out.infant = ap.infant === true;
  out.drives = ap.drives === true;
  out.swim = ap.swim === true;
  return out;
}

// ---------- The au pair fit: au pair <-> host family ----------
// me / other: the unpacked facts plus the host or au pair's own place.
// Returns { ok, fits[], misses[], score 0..100 }. "ok" is false when a
// hard rule fails (the country does not match).
export function auPairFit(aupair, host) {
  const fits = [], misses = [];
  const hostCode = (countryPoint(host.country) || {}).code || "";
  let ok = true;
  if (aupair.worldwide || (hostCode && aupair.dest.includes(hostCode))) fits.push(aupair.worldwide ? "Open to any country" : `Wants to go to ${host.country}`);
  else { ok = false; misses.push(`Not looking at ${host.country || "this country"}`); }
  if (aupair.ym && host.ym) {
    if (aupair.ym <= host.ym) fits.push(`Can arrive by ${ymToMonth(host.ym)}`);
    else misses.push(`Arrives ${ymToMonth(aupair.ym)}, host wants ${ymToMonth(host.ym)}`);
  }
  if (aupair.stay && host.stay) {
    if (aupair.stay >= host.stay) fits.push(`Can stay ${aupair.stay} months`);
    else misses.push(`Stays ${aupair.stay} months, host wants ${host.stay}`);
  }
  if (host.infant && !aupair.infant) misses.push("Host has a baby, au pair has not cared for babies");
  else if (host.infant) fits.push("Has cared for babies");
  const total = fits.length + misses.length;
  const score = total ? Math.round((fits.length / total) * 100) : 0;
  return { ok, fits, misses, score };
}

// ---------- Country rules: what is required where ----------
// Each fact below comes from an official page read on 31 Oct 2026
// (source in the comment). Where a page did not state it, nothing is
// stated. No pay figure is ever shown for the USA (see countries.js).
export const AUPAIR_RULES = {
  US: { ages: [18, 26], note: "Au pairs go through a State Department approved agency on a J-1 visa. Work is limited to 10 hours a day and 45 hours a week. The stay is 12 months, and the host family must be US citizens or permanent residents.", source: "https://j1visa.state.gov/programs/au-pair" },
  DE: { ages: [18, 26], note: "Au pairs are 18 to 26 at the time they apply, stay 6 to 12 months, need at least A1 German, and may only do one au pair stay in Germany. Many nationalities need a visa before travel.", source: "https://uk.diplo.de/uk-en/02/visa/2449444-2449444" },
  AU: { ages: [18, 30], note: "Australia has no au pair visa. Au pairs usually come on a Working Holiday visa (18 to 30, or 35 for some countries). In Queensland, au pairs and live-in nannies need a Blue Card.", source: "https://immi.homeaffairs.gov.au/Visa-subsite/Pages/work/417-working-holiday-first.aspx" },
  NZ: { ages: [18, 30], note: "New Zealand has no au pair visa. Au pairs usually come on a Working Holiday visa, so you need a passport from a country that has an agreement with New Zealand.", source: "https://www.kiwifamilies.co.nz/articles/au-pairs/" },
};

// ---------- What each country needs of a carer (checks) ----------
// law: true only where an official page says the check is a legal
// requirement for paid or in-home child care. Elsewhere we say what the
// official body does, and never claim a duty we could not confirm.
export const CHECK_DUTY = {
  AU: { law: true, text: "In Australia every state and territory requires a check by law for paid child care, including nannies and babysitters. In Queensland the Blue Card also covers au pairs and demi pairs. It is the law: no card, no start.", source: "https://www.qld.gov.au/jobs/blue-card/required/individuals-businesses/childcare-services" },
  UK: { law: false, text: "In England a nanny who registers with Ofsted needs an enhanced DBS check with the children's barred list. A live-in nanny needs the home-based DBS. Many families ask for one even when they hire privately.", source: "https://www.gov.uk/guidance/childcare-providers-who-needs-a-dbs-check" },
  IE: { law: false, text: "Garda Vetting is done through a registered organisation. A person cannot apply for their own.", source: "https://www.garda.ie/en/about-us/online-services/garda-vetting/" },
  CA: { law: false, text: "A vulnerable sector check is requested by the hiring organisation and done by your local police. There is no federal law that requires one.", source: "https://rcmp.ca/en/criminal-records/criminal-record-checks/vulnerable-sector-checks" },
  NZ: { law: false, text: "Police vetting is requested by an approved agency with your consent. A person cannot request their own.", source: "https://www.police.govt.nz/advice-services/businesses-and-organisations/nz-police-vetting-service" },
  US: { law: false, text: "Au pairs must pass a criminal background check through their agency. For other carers, families usually ask for a background check. Rules differ by state.", source: "https://j1visa.state.gov/programs/au-pair" },
};
