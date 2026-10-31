// Caresitters app2 — the questions of each track, as data (31 Oct 2026).
// journey.js reads these: which questions, in which order, for which
// track. Photo is always step 3 (right after the name and place), so
// it is in the very first build and never buried at the end.
import { ROLES, LANGS, BANDS, AGES, ACTIVITIES } from "./questions.js";
import { packByName, packById, checkFor, auJurisdiction, COUNTRY_NAMES } from "./countries.js";
import { WORLD_NAMES, monthChoices, STAY_MONTHS, HOURS_WEEK, DUTIES, HOST_EXTRAS, ENGLISH_LEVELS, AUPAIR_RULES, CHECK_DUTY, countryPoint } from "./tracks.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---- the new fields (each one is one question on one screen) ----
export function trackFields() {
  const months = monthChoices();
  return [
    { id: "photo", label: "Add a photo", type: "photo", required: true },
    { id: "homeCountry", label: "Which country are you from?", type: "dropdown", options: WORLD_NAMES, required: true },
    { id: "destinations", label: "Which countries would you like to live in?", type: "countries", required: true },
    { id: "auRules", label: "What to know before you go", type: "info", info: "auRules" },
    { id: "arrivalFrom", label: "When could you arrive?", type: "dropdown", options: months, required: true },
    { id: "stayMonths", label: "How many months could you stay?", type: "dropdown", options: STAY_MONTHS, required: true },
    { id: "english", label: "How good is your English?", type: "select", options: ENGLISH_LEVELS, required: true },
    { id: "infantOk", label: "Have you looked after a baby under 1?", type: "yesno", required: true },
    { id: "swim", label: "Can you swim?", type: "yesno", required: true },
    { id: "apLetter", label: "Write a short hello to your host family", type: "text", optional: true },
    // host family (looking for an au pair)
    { id: "hostRoom", label: "Will the au pair have their own private room?", type: "yesno", required: true },
    { id: "hostRules", label: "What to know before you host", type: "info", info: "hostRules" },
    { id: "duties", label: "What will the au pair help with?", type: "chips", options: DUTIES, required: true },
    { id: "hoursWeek", label: "How many hours a week?", type: "dropdown", options: HOURS_WEEK, required: true },
    { id: "extras", label: "What do you offer the au pair?", type: "chips", options: HOST_EXTRAS, optional: true },
    { id: "wantArrive", label: "When do you want your au pair to arrive?", type: "dropdown", options: months, required: true },
    { id: "wantStay", label: "How many months do you want them to stay?", type: "dropdown", options: STAY_MONTHS, required: true },
    { id: "hostLetter", label: "Write a short hello to the au pair", type: "text", optional: true },
    // nanny and nanny-family: the checks, in the country's own words
    { id: "checkDuty", label: "Checks in your area", type: "info", info: "checkDuty" },
  ];
}

// ---- the order, per track ----
// COUNTRY comes first only when the journey has no country yet.
export const ESSENTIAL_IDS = {
  "family-nanny": ["displayName", "photo", "postcode", "checkDuty", "role", "childrenBands", "startWhen", "scheduleNeed", "languages", "mustLanguages", "nonSmoker"],
  nanny: ["displayName", "photo", "postcode", "maxDistanceKm", "checkDuty", "checksLevel", "experience", "agesAccepted", "availability", "languages", "payFloor"],
  "family-aupair": ["displayName", "photo", "postcode", "hostRules", "childrenBands", "hostRoom", "duties", "hoursWeek", "extras", "wantArrive", "wantStay", "mustLanguages", "hostLetter"],
  aupair: ["displayName", "photo", "homeCountry", "age", "destinations", "auRules", "arrivalFrom", "stayMonths", "languages", "english", "infantOk", "experience", "swim", "drivesCar", "apLetter"],
};

// ---- country-aware wording ----
export function packFor(answers, member) {
  return packByName(answers.country || "") || packByName((member || {}).country || "") || null;
}

export function checksLabel(answers, member) {
  const pack = packFor(answers, member);
  if (!pack) return "Your checks";
  const facts = checkFor(pack, answers.postcode || (member || {}).postcode);
  return facts && facts.name ? `Your ${facts.name}${facts.place ? " (" + facts.place + ")" : ""}` : "Your checks";
}

// The plain words on an "info" screen. Everything shown is data from
// countries.js or tracks.js, each with an official source. We never
// state a duty we could not confirm.
export function infoHtml(kind, answers, member) {
  const pack = packFor(answers, member);
  const link = (url, label) => (url ? `<p class="fine"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a></p>` : "");
  if (kind === "checkDuty") {
    if (!pack) return `<p>Tell us your country first and we will show what is needed where you live.</p>`;
    const facts = checkFor(pack, answers.postcode || (member || {}).postcode) || {};
    const duty = CHECK_DUTY[pack.id];
    let h = `<div class="infoBox"><h4>${esc(facts.name || pack.checkName)}${facts.place ? " · " + esc(facts.place) : ""}</h4>`;
    h += `<p>${esc(duty ? duty.text : "We could not confirm a legal check for private child care here. Families may still ask for one.")}</p>`;
    if (facts.costText) h += `<p class="fine"><b>Cost of the government check:</b> ${esc(facts.costText)}</p>`;
    h += `<p><b>Getting verified with Caresitters is free.</b> You add your card or certificate in My Profile. We look it up${facts.register ? " on the free official register" : " and sight the document"}, then show a badge on your profile.</p>`;
    h += `</div>` + link(facts.checkUrl, "Where to apply or check (official site)");
    return h;
  }
  if (kind === "auRules" || kind === "hostRules") {
    const names = kind === "auRules" ? ((answers.destinations || {}).list || []) : [answers.country].filter(Boolean);
    const worldwide = kind === "auRules" && (answers.destinations || {}).worldwide;
    let h = "";
    if (worldwide && !names.length) h += `<p>You picked Worldwide, so we will show families from every country. Rules differ by country. Ask each family which rules apply.</p>`;
    for (const name of names.slice(0, 6)) {
      const p = packByName(name);
      const rule = p ? AUPAIR_RULES[p.id] : null;
      const note = rule ? rule.note : (p && p.aupairNote) || (p && p.aupairScheme ? "This country has an au pair scheme. Check the official rules before you travel." : "We have no au pair rules on file for this country yet. Check the official rules before you travel.");
      h += `<div class="infoBox"><h4>${esc(name)}</h4><p>${esc(note)}</p>${rule && rule.ages ? `<p class="fine">Au pair age: ${rule.ages[0]} to ${rule.ages[1]}.</p>` : ""}${rule ? link(rule.source, "Official page") : ""}</div>`;
    }
    if (!h) h = `<p>Pick your country first and we will show the rules that apply.</p>`;
    h += `<p class="fine">Getting verified with Caresitters is free. The government check or visa is paid to the government, and we can not change that.</p>`;
    return h;
  }
  return "";
}

// ---- country picker (one, several, or Worldwide) ----
export function countriesHtml(f, answers) {
  const v = answers[f.id] || { worldwide: false, list: [] };
  const sel = new Set(v.list || []);
  const chips = WORLD_NAMES.map((n) => `<button type="button" class="chip ${sel.has(n) ? "on" : ""}" data-dest="${esc(n)}" aria-pressed="${sel.has(n)}">${esc(n)}</button>`).join("");
  return `<div class="destPick">
    <button type="button" class="answerCard ${v.worldwide ? "on" : ""}" data-dest-world="1" aria-pressed="${Boolean(v.worldwide)}">Worldwide: anywhere</button>
    <p class="fine">Or pick one or more countries. You picked ${sel.size}.</p>
    <input type="search" data-dest-search="1" placeholder="Search for a country" aria-label="Search for a country" autocomplete="off">
    <div id="destMap" class="destMap" role="img" aria-label="Map of the countries you picked"></div>
    <div class="destList chips">${chips}</div></div>`;
}

export function destAnswered(v) {
  return Boolean(v && (v.worldwide || (v.list || []).length));
}

// Draw the picked countries on a real map (Leaflet is already bundled).
export function drawDestMap(answers) {
  const host = document.getElementById("destMap");
  const L = window.L;
  if (!host || !L) { if (host) host.hidden = true; return; }
  const v = answers.destinations || { worldwide: false, list: [] };
  host.style.height = "220px";
  const map = L.map(host, { zoomControl: true, attributionControl: true, worldCopyJump: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 6, minZoom: 1, attribution: "© OpenStreetMap" }).addTo(map);
  const pts = (v.list || []).map(countryPoint).filter(Boolean);
  for (const p of pts) L.circleMarker([p.lat, p.lng], { radius: 9, color: "#c2185b", fillColor: "#e91e63", fillOpacity: 0.85 }).addTo(map).bindTooltip(p.name);
  if (pts.length > 1) map.fitBounds(pts.map((p) => [p.lat, p.lng]), { padding: [30, 30], maxZoom: 5 });
  else if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], 4);
  else map.setView([20, 10], 1);
  setTimeout(() => map.invalidateSize(), 250);
}

// ---- postal code to a map position, for countries beyond Australia ----
// zippopotam.us is a free public lookup (no key). A failure simply means
// no pin: a position is never invented.
const ZIP_CODES = { US: "us", CA: "ca", UK: "gb", DE: "de", FR: "fr", NL: "nl", DK: "dk", NO: "no", SE: "se", ES: "es", IT: "it", AT: "at", BE: "be", CH: "ch", NZ: "nz", JP: "jp", ZA: "za", IE: "ie" };
export async function geoForPostcode(countryId, postcode) {
  const cc = ZIP_CODES[countryId];
  const raw = String(postcode || "").trim();
  if (!cc || !raw) return null;
  let q = raw;
  if (cc === "ca") q = raw.replace(/\s/g, "").slice(0, 3);
  if (cc === "gb") q = raw.split(" ")[0];
  if (cc === "ie") q = raw.replace(/\s/g, "").slice(0, 3);
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`https://api.zippopotam.us/${cc}/${encodeURIComponent(q)}`, { signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const j = await r.json();
    const p = (j.places || [])[0];
    if (!p) return null;
    const lat = Number(p.latitude), lng = Number(p.longitude);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { latE2: Math.round(lat * 100), lngE2: Math.round(lng * 100) };
  } catch { return null; }
}
