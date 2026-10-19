// Caresitters questionnaire journey — pager + card builder.
// Answers save as a draft on this device at every step. On finish
// the bundle (private answers + the matching card + the looking
// spec) goes to window.CARESITS_SAVE when the account layer wires
// it, and always lands in local storage so nothing is ever lost.
import { FAMILY_PAGES, CARER_PAGES, DAYS, PARTS, BANDS, AGES } from "./questions.js";
import { t as tr, applyI18n } from "./lang.js";
import { slugify } from "../next-phase/engine/engine.mjs";
import { COUNTRY_NAMES, packByName } from "./countries.js";
import { draftKey, doneKey } from "./storage-keys.js";
import { levelOf, levelRank } from "./levels.js";
import { withTimeout } from "../accounts/account.js";
// VALUE CODING at the bundle boundary: any string that IS one of
// the questionnaire's answer words is stored as its stable slug,
// so matching compares codes in every language. Prose (the write
// ins, names, notes) is never an answer word and never touched.
const OPTION_WORDS = new Set();
for (const pages of [FAMILY_PAGES, CARER_PAGES, EXPANSION.family, EXPANSION.carer])
  for (const p of pages) for (const f of p.fields) for (const o of f.options || []) OPTION_WORDS.add(o);
for (const w of ["Must have", "I prefer", "Either way", "Register verified", "Document sighted", "Getting them now"]) OPTION_WORDS.add(w);
const codeValue = (v) => (typeof v === "string" && OPTION_WORDS.has(v) ? slugify(v) : v);
const codeWalk = (node) => {
  if (typeof node === "string") return codeValue(node);
  if (Array.isArray(node)) return node.map(codeWalk);
  if (node && typeof node === "object") { const out = {}; for (const [k, x] of Object.entries(node)) out[k] = codeWalk(x); return out; }
  return node;
};
const codeOf = (f) => f.pair || f.id;
const keyFor = (f) => { const c = codeOf(f); const qk = "q." + state.side + "." + c; return tr(qk) === qk ? "q." + c : qk; };
const L = (f) => { const k = keyFor(f); const v = tr(k); return v === k ? f.label : v; };
const O = (f, o, i) => { const k = keyFor(f) + ".o" + i; const v = tr(k); return v === k ? o : v; };
const YEAR_PICKS = ["", "0", "1", "2", "3", "4", "5", "7", "10", "15", "20"];
import { EXPANSION } from "./questions2.js";

const $ = (s) => document.querySelector(s);
const state = { side: null, page: 0, answers: {}, strengths: {}, resumeFeed: [], countryStep: null, target: "quick", beyond: false };
// F16: the draft lives under the key the shared helper resolves
// for whoever is signed in on this device (see storage-keys.js).
// The journey session works in ONE slot: the slot is resolved at
// boot, corrected by the watcher below if the uid lands a beat
// later, and frozen the moment the user interacts, so a draft
// is never split across two accounts' slots.
let activeDraftKey = draftKey();
let interacted = false;

// The §12 order: Country, then Role, then the form. The country
// step stands before the side pages whenever no country is stored
// yet. It is decided once per journey (state.countryStep), so the
// page list never shifts under the user mid journey.
const COUNTRY_PAGE = {
  title: "Your country", bunny: "point-guide", _tk: "country.title", _country: true,
  fields: [{ id: "country", label: "Which country will the care happen in?", type: "select", options: COUNTRY_NAMES, required: true }],
};
const storedCountry = () => state.answers.country || (window.CARESITS_ME && window.CARESITS_ME.country) || null;

const pages = () => {
  if (state.countryStep === null) state.countryStep = !storedCountry();
  const base = state.side === "family" ? FAMILY_PAGES : CARER_PAGES;
  const xp = state.side === "family" ? EXPANSION.family : EXPANSION.carer;
  const tag = (p, k) => { p._tk = k; return p; };
  const list = base.map((p, i) => tag(p, `page.${state.side}.${i}`)).concat(xp.map((p, i) => tag(p, `page.${state.side}x.${i}`)));
  if (state.countryStep) list.unshift(COUNTRY_PAGE);
  return list;
};

function writeDraft() {
  try { localStorage.setItem(activeDraftKey, JSON.stringify({ side: state.side, page: state.page, answers: state.answers, strengths: state.strengths, resumeFeed: state.resumeFeed, countryStep: state.countryStep, target: state.target, beyond: state.beyond })); } catch { /* storage off */ }
}
function persistDraft() {
  interacted = true;
  writeDraft();
}
function resetJourneyState() {
  state.side = null; state.page = 0; state.answers = {}; state.strengths = {}; state.resumeFeed = []; state.countryStep = null; state.target = "quick"; state.beyond = false;
}
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(activeDraftKey) || "null");
    if (d?.target) state.target = d.target;
    if (d?.beyond) state.beyond = true;
    if (d?.side) { state.side = d.side; state.page = d.page || 0; state.answers = d.answers || {}; state.strengths = d.strengths || {}; state.resumeFeed = d.resumeFeed || []; state.countryStep = d.countryStep === undefined ? null : d.countryStep; return true; }
  } catch { /* fresh start */ }
  return false;
}

// Pay words come from the picked country's pack (§12 role terms):
// an au pair is paid pocket money plus room and meals, a nanny is
// paid a wage. The US caution shows as a plain note, never a number.
function payHelp(f) {
  if (f.id !== "payFloor" && f.id !== "payOffered") return "";
  const pack = packByName(state.answers.country || "") || packByName((window.CARESITS_ME || {}).country || "");
  const roleText = state.side === "family" ? (state.answers.role || "") : ((window.CARESITS_ME || {}).roles || []).join(" ");
  const isAuPair = /au pair/i.test(roleText);
  let txt;
  if (isAuPair) {
    txt = tr("country.payPocket");
    if (pack && pack.aupairNote) txt += " " + pack.aupairNote;
  } else {
    txt = tr("country.payWage");
    if (pack && pack.aupairScheme) txt += " " + tr("country.payPocketHint");
    else if (pack && pack.aupairNote) txt += " " + pack.aupairNote;
  }
  if (pack && pack.caution && (isAuPair || state.side === "carer")) txt += " " + tr("country.usCaution");
  return `<p class="fine payHelp">${txt}</p>`;
}

function fieldHtml(f) {
  if (f.whenRole) {
    const roles = (window.CARESITS_ME?.roles || []).map((r) => String(r).toLowerCase().replace(/[^a-z]/g, ""));
    if (roles.length && !f.whenRole.some((w) => roles.some((r) => r.includes(w)))) return "";
  }
  const v = state.answers[f.id];
  const opt = f.optional ? `<span class="optTag">${tr("journey.optional")}</span>` : "";
  let body = "";
  if (f.type === "text") body = `<input type="text" data-field="${f.id}" value="${v ?? ""}" autocomplete="off">`;
  if (f.type === "number") body = `<input type="number" data-field="${f.id}" value="${v ?? ""}" min="0" inputmode="numeric">`;
  if (f.type === "select") body = `<div class="chips">${f.options.map((o, oi) => `<button type="button" class="chip ${v === o ? "on" : ""}" data-chip="${f.id}" data-value="${o}">${O(f, o, oi)}</button>`).join("")}</div>`;
  if (f.type === "chips") body = `<div class="chips">${f.options.map((o, oi) => `<button type="button" class="chip ${(v || []).includes(o) ? "on" : ""}" data-chip="${f.id}" data-value="${o}">${O(f, o, oi)}</button>`).join("")}</div>`;
  if (f.type === "yesno") body = `<div class="chips"><button type="button" class="chip ${v === true ? "on" : ""}" data-yesno="${f.id}" data-value="yes">${tr("journey.yes")}</button><button type="button" class="chip ${v === false ? "on" : ""}" data-yesno="${f.id}" data-value="no">${tr("journey.no")}</button></div>`;
  if (f.type === "grid") {
    body = `<div class="gridWrap"><table class="grid"><thead><tr><th></th>${PARTS.map((p) => `<th>${tr("journey.part." + p)}</th>`).join("")}</tr></thead><tbody>${DAYS.map((d) => `<tr><th>${tr("journey.day." + d)}</th>${PARTS.map((p) => `<td><button type="button" class="cell ${((v || {})[d] || []).includes(p) ? "on" : ""}" data-grid="${f.id}" data-day="${d}" data-part="${p}" aria-label="${d} ${p}"></button></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  if (f.type === "band") body = `<div class="bandRow"><label>${tr("journey.from")} <select data-band="${f.id}" data-end="min">${AGES.map((a) => `<option value="${a}" ${String(v?.[0] ?? "") === a ? "selected" : ""}>${a}</option>`).join("")}</select></label><label>${tr("journey.to")} <select data-band="${f.id}" data-end="max">${AGES.map((a) => `<option value="${a}" ${String(v?.[1] ?? "") === a ? "selected" : ""}>${a}</option>`).join("")}</select></label></div>`;
  if (f.type === "experience") body = `<div class="expRows">${BANDS.map((b) => `<label>${tr("journey.ages", undefined, { b })} <select data-exp="${f.id}" data-bandname="${b}">${YEAR_PICKS.map((y) => `<option value="${y}" ${String((v || {})[b] ?? "") === y ? "selected" : ""}>${y === "" ? tr("journey.pick") : y + (y === "20" ? "+" : "")}</option>`).join("")}</select></label>`).join("")}</div>`;
  if (f.type === "expchecks") body = `<div class="expRows">${BANDS.slice(0, 4).map((b) => `<label>${tr("journey.yearsAges", undefined, { b })} <select data-exp="${f.id}" data-bandname="${b}">${YEAR_PICKS.map((y) => `<option value="${y}" ${String((v?.years || {})[b] ?? "") === y ? "selected" : ""}>${y === "" ? tr("journey.pick") : y + (y === "20" ? "+" : "")}</option>`).join("")}</select></label>`).join("")}</div><div class="chips">${["Register verified", "Document sighted", "Getting them now"].map((o, oi) => `<button type="button" class="chip ${v?.checks === o ? "on" : ""}" data-expchecks="${f.id}" data-value="${o}">${tr(["checks.level.register", "checks.level.sighted", "checks.level.getting"][oi])}</button>`).join("")}</div>`;
  if (f.type === "homefacts") body = `<div class="chips"><button type="button" class="chip ${v?.petsOk ? "on" : ""}" data-home="${f.id}" data-key="petsOk">${tr("journey.petsOk")}</button><button type="button" class="chip ${v?.smokerOk ? "on" : ""}" data-home="${f.id}" data-key="smokerOk">${tr("journey.smokerOk")}</button><button type="button" class="chip ${v?.nonSmokerHousehold ? "on" : ""}" data-home="${f.id}" data-key="nonSmokerHousehold">${tr("journey.nonSmokerHome")}</button></div>`;
  if (f.companionText) body += `<input type="text" data-field="${f.id}Note" value="${state.answers[f.id + "Note"] ?? ""}" placeholder="${tr("journey.addNote")}" autocomplete="off">`;
  const strength = f.strength
    ? `<div class="strength" role="group" aria-label="${tr("journey.strengthAria")}"><span>${tr("journey.strengthPre")}</span>${["Must have", "I prefer", "Either way"].map((s) => `<button type="button" class="chip sm ${(state.strengths[f.id] || "Either way") === s ? "on" : ""}" data-strength="${f.id}" data-value="${s}">${tr({ "Must have": "journey.must", "I prefer": "journey.prefer", "Either way": "journey.either" }[s])}</button>`).join("")}</div>`
    : "";
  return `<div class="field"><p class="qLabel">${L(f)}</p>${opt}${body}${payHelp(f)}${strength}</div>`;
}

function answered(f) {
  const v = state.answers[f.id];
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (f.type === "grid") return Object.values(v).some((a) => a.length);
  if (f.type === "band") return Array.isArray(v) && v[0] != null && v[1] != null;
  if (f.type === "experience") return Object.values(v).some((x) => x !== "" && x != null);
  if (f.type === "expchecks") return Boolean(v?.checks) || Object.values(v?.years || {}).some((x) => x !== "" && x != null);
  if (f.type === "homefacts") return true;
  return true;
}

function render() {
  const list = pages();
  const p = list[state.page];
  const total = list.reduce((s, x) => s + x.fields.length, 0);
  $("#bunnyImg").src = `bunny/bunny-${p.bunny}.png`;
  const tk = p._tk; const tv = tk ? tr(tk) : p.title; $("#pageTitle").textContent = tv === tk ? p.title : tv;
  $("#pageCount").textContent = tr("journey.page", undefined, { a: state.page + 1, b: list.length });
  $("#barFill").style.width = `${Math.round((state.page / list.length) * 100)}%`;
  $("#fields").innerHTML = p.fields.map(fieldHtml).join("");
  $("#backBtn").textContent = tr("journey.back"); $("#backBtn").style.visibility = state.page === 0 ? "hidden" : "visible";
  $("#nextBtn").textContent = state.page === list.length - 1 ? tr("journey.finish") : tr("journey.next");
  document.title = `Caresitters · ${$("#pageTitle").textContent}`;
}

function wire() {
  $("#fields").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-chip]");
    if (chip) {
      const f = pages()[state.page].fields.find((x) => x.id === chip.dataset.chip);
      if (f.type === "select") state.answers[f.id] = chip.dataset.value;
      else {
        const arr = new Set(state.answers[f.id] || []);
        if (f.maxPick && !arr.has(chip.dataset.value) && arr.size >= f.maxPick) { persistDraft(); render(); return; }
        arr.has(chip.dataset.value) ? arr.delete(chip.dataset.value) : arr.add(chip.dataset.value);
        state.answers[f.id] = [...arr];
      }
    }
    const yn = e.target.closest("[data-yesno]");
    if (yn) state.answers[yn.dataset.yesno] = yn.dataset.value === "yes";
    const cell = e.target.closest("[data-grid]");
    if (cell) {
      const g = { ...(state.answers[cell.dataset.grid] || {}) };
      const parts = new Set(g[cell.dataset.day] || []);
      parts.has(cell.dataset.part) ? parts.delete(cell.dataset.part) : parts.add(cell.dataset.part);
      g[cell.dataset.day] = [...parts];
      state.answers[cell.dataset.grid] = g;
    }
    const ec = e.target.closest("[data-expchecks]");
    if (ec) state.answers[ec.dataset.expchecks] = { ...(state.answers[ec.dataset.expchecks] || {}), checks: ec.dataset.value };
    const home = e.target.closest("[data-home]");
    if (home) state.answers[home.dataset.home] = { ...(state.answers[home.dataset.home] || {}), [home.dataset.key]: !(state.answers[home.dataset.home] || {})[home.dataset.key] };
    const st = e.target.closest("[data-strength]");
    if (st) state.strengths[st.dataset.strength] = st.dataset.value;
    persistDraft(); render();
  });
  $("#fields").addEventListener("change", (e) => { const ev = new Event("input", { bubbles: true }); Object.defineProperty(ev, "target", { value: e.target }); onFieldInput(ev); });
  $("#fields").addEventListener("input", onFieldInput);
  function onFieldInput(e) {
    const inp = e.target;
    if (inp.dataset.field) state.answers[inp.dataset.field] = inp.type === "number" ? (inp.value === "" ? "" : Number(inp.value)) : inp.value;
    if (inp.dataset.band) {
      const cur = [...(state.answers[inp.dataset.band] || [null, null])];
      cur[inp.dataset.end === "min" ? 0 : 1] = inp.value === "" ? null : Number(inp.value);
      state.answers[inp.dataset.band] = cur;
    }
    if (inp.dataset.exp) {
      const fid = inp.dataset.exp;
      if (fid === "experienceChecks" || pages()[state.page].fields.find((x) => x.id === fid)?.type === "expchecks") {
        const cur = { ...(state.answers[fid] || {}), years: { ...((state.answers[fid] || {}).years || {}) } };
        cur.years[inp.dataset.bandname] = inp.value === "" ? "" : Number(inp.value);
        state.answers[fid] = cur;
      } else {
        state.answers[fid] = { ...(state.answers[fid] || {}), [inp.dataset.bandname]: inp.value === "" ? "" : Number(inp.value) };
      }
    }
    persistDraft();
  }
  $("#nextBtn").addEventListener("click", () => {
    const p = pages()[state.page];
    const missing = p.fields.filter((f) => f.required && !answered(f));
    if (missing.length) {
      $("#notice").textContent = tr("journey.notice", undefined, { q: L(missing[0]).replace(/\?$/, "") });
      $("#bunnyImg").src = "bunny/bunny-oops.png";
      return;
    }
    $("#notice").textContent = "";
    const advance = () => {
      if (state.page < pages().length - 1) { state.page += 1; persistDraft(); render(); window.scrollTo(0, 0); }
      else finish();
    };
    // The level boundary: the welcome picker set how far the
    // member wants to go today. The level is COMPUTED from the
    // answers (levels.js), never counted in pages: the first
    // Next that reaches the picked level offers the stop, once.
    if (!state.beyond && state.target !== "full" && state.target !== "explore") {
      const lvl = levelOf(state.side, state.answers);
      if (levelRank(lvl) >= levelRank(state.target)) { showStop(lvl, advance); return; }
    }
    advance();
  });
  $("#backBtn").addEventListener("click", () => { if (state.page > 0) { state.page -= 1; persistDraft(); render(); } });
  document.querySelectorAll("[data-side]").forEach((b) => b.addEventListener("click", () => {
    state.side = b.dataset.side; state.page = 0; persistDraft();
    $("#welcome").hidden = true; $("#journey").hidden = false; render();
  }));
  // The welcome level picker: Explore leaves to browse the app;
  // the other three set how far today's walk aims to go. The
  // pick is a target only — the level itself is always computed
  // from the answers, never claimed by the pick.
  document.querySelectorAll("[data-level]").forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.level;
    if (v === "explore") {
      // Explore is a deliberate signed out entry: it carries the
      // session marker the shell's signed out gate exempts.
      try { sessionStorage.setItem("caresits-demo", "1"); } catch { /* storage off */ }
      location.href = "index.html";
      return;
    }
    state.target = v;
    document.querySelectorAll("[data-level]").forEach((x) => x.classList.toggle("on", x === b));
    persistDraft();
  }));
  $("#stopBtn")?.addEventListener("click", () => { $("#stopPanel").hidden = true; finish(); });
  $("#keepBtn")?.addEventListener("click", () => {
    state.beyond = true; persistDraft();
    $("#stopPanel").hidden = true; $("#journey").hidden = false;
    if (pendingAdvance) { const go = pendingAdvance; pendingAdvance = null; go(); }
  });
}

let pendingAdvance = null;
function showStop(lvl, advance) {
  pendingAdvance = advance;
  $("#stopTitle").textContent = tr("level.at", undefined, { a: tr("level.n" + lvl[0].toUpperCase() + lvl.slice(1)) });
  $("#journey").hidden = true;
  $("#stopPanel").hidden = false;
  window.scrollTo(0, 0);
}
function syncLevelPick() {
  document.querySelectorAll("[data-level]").forEach((x) => x.classList.toggle("on", x.dataset.level === state.target));
}

function deepSets() {
  const deep = {}, deepMusts = {};
  for (const page of EXPANSION[state.side]) {
    for (const q of page.fields) {
      const v = state.answers[q.id];
      if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
      const s = q.profileOnly ? null : q.strengthPick ? (v === "Must have" ? "must" : v === "I prefer" ? "pref" : "either") : (state.strengths[q.id] === "Must have" ? "must" : state.strengths[q.id] === "I prefer" ? "pref" : state.strengths[q.id] ? "either" : null);
      // The feed field names the matching bucket the answer
      // feeds — always the question's own. A resume-fed answer
      // keeps its bucket: stamping the provenance ("resume")
      // here produced a value the answers fence does not admit,
      // and the refused document killed the whole save batch
      // (proven on the twin, QA b107 FAIL 1's family).
      deep[q.pair] = { v, s, feed: q.feed || null };
      // The musts bucket carries the SAME shaped entry as prefs
      // (QA b107 FAIL 1): a raw value here made the save planner
      // read ".v" off a string or a list, produce an undefined
      // field, and the whole batch died in the client.
      if (s === "must") deepMusts[q.pair] = deep[q.pair];
    }
  }
  return { deep, deepMusts };
}

export function buildBundle() {
  const a = state.answers, s = state.strengths;
  const must = (id) => s[id] === "Must have";
  const pref = (id) => s[id] === "I prefer";
  if (state.side === "family") {
    const expYears = a.experienceChecks?.years || {};
    const card = {
      side: "family", postcode: a.postcode, childrenBands: a.childrenBands || [],
      languages: a.languages || [], pets: Boolean(a.pets), smokerHousehold: Boolean(a.smokerHousehold),
      scheduleNeed: a.scheduleNeed || {}, payOffered: Number(a.payOffered) || 0,
    };
    const looking = {
      musts: {
        languages: must("mustLanguages") ? a.mustLanguages || [] : [],
        checksLevel: must("experienceChecks") ? (a.experienceChecks?.checks === "Register verified" ? "register" : a.experienceChecks?.checks === "Document sighted" ? "sighted" : null) : null,
        experience: must("experienceChecks") ? Object.fromEntries(Object.entries(expYears).filter(([, v]) => v !== "" && v != null)) : {},
        ageBand: must("ageBand") ? a.ageBand : null,
        nationality: must("nationality") && a.nationality ? a.nationality : null,
        nonSmoker: must("nonSmoker") ? Boolean(a.nonSmoker) : false,
        drives: must("drivesCar") && (a.drivesCar || "").startsWith("Drives"),
        ownCar: must("drivesCar") && a.drivesCar === "Drives, own car",
        cooking: must("cookingTasks") && (a.cookingTasks || []).includes("Cooking"),
        tasks: must("cookingTasks") ? a.cookingTasks || [] : [],
        specialNeeds: must("specialNeeds") ? Boolean(a.specialNeeds) : false,
        petsOk: a.pets ? must("petsOk") : false,
        maxDistanceKm: Number(a.maxDistanceKm) || 25,
      },
      prefs: {
        personality: (a.personality || []).map((x) => x.toLowerCase()),
        activities: (a.activities || []).map((x) => x.toLowerCase()),
        routineStyle: (a.routineStyle || "").toLowerCase(),
        nationality: pref("nationality") && a.nationality ? a.nationality : null,
        tasks: a.cookingTasks || [],
        cooking: (a.cookingTasks || []).includes("Cooking"),
      },
    };
    const { deep, deepMusts } = deepSets();
    if (Object.keys(deep).length) looking.prefs.deep = deep;
    if (Object.keys(deepMusts).length) looking.musts.deep = deepMusts;
    return { side: "family", answers: a, strengths: s, country: a.country || "", card: codeWalk({ ...card, ...looking }) };
  }
  const card = {
    side: "carer", displayName: a.displayName, postcode: a.postcode, age: Number(a.age) || null,
    nationality: a.nationality, cultureOffer: Array.isArray(a.cultureOffer) ? a.cultureOffer.join(", ") : a.cultureOffer || "", languages: a.languages || [], smoker: Boolean(a.smoker),
    experience: Object.fromEntries(Object.entries(a.experience || {}).filter(([, v]) => v !== "" && v != null)),
    checksLevel: a.checksLevel === "Register verified" ? "register" : a.checksLevel === "Document sighted" ? "sighted" : "none",
    availability: a.availability || {},
    drives: (a.drivesCar || "").startsWith("I drive"), ownCar: a.drivesCar === "I drive, my own car",
    cooking: (a.tasks || []).includes("Cooking"), tasks: a.tasks || [], tasksRefused: a.tasksRefused || [],
    activities: (a.activities || []).map((x) => x.toLowerCase()),
    personality: (a.personality || []).map((x) => x.toLowerCase()),
    routineStyle: (a.routineStyle || "").toLowerCase(),
    agesAccepted: a.agesAccepted || [], agesPreferred: a.agesPreferred || [],
    petsOk: Boolean(a.homeFacts?.petsOk), smokerHouseholdOk: Boolean(a.homeFacts?.smokerOk),
    nonSmokerHousehold: Boolean(a.homeFacts?.nonSmokerHousehold),
    payFloor: a.payFloor || 0, maxDistanceKm: Number(a.maxDistanceKm) || 25,
  };
  const { deep, deepMusts } = deepSets();
  const looking = { musts: {}, prefs: {} };
  if (Object.keys(deep).length) looking.prefs.deep = deep;
  if (Object.keys(deepMusts).length) looking.musts.deep = deepMusts;
  return { side: "carer", answers: a, strengths: s, country: a.country || "", card: codeWalk({ ...card, looking }) };
}

let finishing = false;
async function finish() {
  // One finish at a time: a second tap while the save is
  // settling must not stack a second save or hide the page
  // out from under the first.
  if (finishing) return;
  finishing = true;
  const bundle = buildBundle();
  // The finished bundle lands under the finisher's own resolved
  // key, and only this journey's own draft slot is retired
  // (completion, never sign out, clears it: the bundle is the
  // draft, kept whole, under the account's key).
  try { localStorage.setItem(doneKey(), JSON.stringify(bundle)); localStorage.removeItem(activeDraftKey); } catch { /* storage off */ }
  $("#journey").hidden = true;
  $("#done").hidden = false;
  const dl = $("#doneLevel");
  if (dl) dl.textContent = tr("level." + levelOf(state.side, state.answers));
  $("#doneBunny").src = "bunny/bunny-celebrate.png";
  window.scrollTo(0, 0);
  // The Done screen's saved line is earned, not assumed
  // (QA b104 ROOT A): the save settles behind the celebration
  // (bounded), and when it landed on this device only, the
  // lead line corrects itself to say exactly that.
  if (typeof window.CARESITS_SAVE === "function") {
    let landed = "account";
    try {
      const r = await withTimeout(window.CARESITS_SAVE(bundle), 15000, "questionnaire save");
      if (!r || r.saved !== "account") landed = "local";
    } catch { landed = "local"; }
    if (landed !== "account") {
      const lead = document.querySelector('[data-i18n="journey.dLead"]');
      if (lead) lead.textContent = tr("journey.dLeadLocal");
    }
  }
  finishing = false;
}

const RESUME_KEY = "caresits-app2-resume-draft";
function consumeResumeHandoff() {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return;
    const h = JSON.parse(raw);
    localStorage.removeItem(RESUME_KEY);
    if (!h || h.side !== "carer" || state.side === "family") return;
    state.side = "carer";
    for (const [k, v] of Object.entries(h.answers || {})) if (state.answers[k] === undefined) state.answers[k] = v;
    state.resumeFeed = [...new Set([...(state.resumeFeed || []), ...(h.marks || [])])];
    writeDraft();
  } catch { /* no handoff */ }
}

export function bootJourney() {
  applyI18n();
  wire();
  activeDraftKey = draftKey();
  loadDraft();
  consumeResumeHandoff();
  syncLevelPick();
  if (state.side) { $("#welcome").hidden = true; $("#journey").hidden = false; render(); }
  // The uid seam can land a beat after this frame boots (the
  // shell's live bridge publishes it when its session resolves).
  // Until the user interacts, a changed key reloads the journey
  // from the newly resolved slot and only that slot: the
  // previous account's draft is never carried across, and a
  // plain draft is never adopted into an account's slot.
  let ticks = 0;
  const timer = setInterval(() => {
    ticks += 1;
    if (interacted || ticks > 40) { clearInterval(timer); return; }
    const k = draftKey();
    if (k === activeDraftKey) return;
    activeDraftKey = k;
    resetJourneyState();
    loadDraft();
    consumeResumeHandoff();
    syncLevelPick();
    if (state.side) { $("#welcome").hidden = true; $("#journey").hidden = false; render(); }
    else { $("#welcome").hidden = false; $("#journey").hidden = true; }
  }, 250);
}
