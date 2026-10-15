// Caresits questionnaire journey — pager + card builder.
// Answers save as a draft on this device at every step. On finish
// the bundle (private answers + the matching card + the looking
// spec) goes to window.CARESITS_SAVE when the account layer wires
// it, and always lands in local storage so nothing is ever lost.
import { FAMILY_PAGES, CARER_PAGES, DAYS, PARTS, BANDS, AGES } from "./questions.js";
const YEAR_PICKS = ["", "0", "1", "2", "3", "4", "5", "7", "10", "15", "20"];
import { EXPANSION } from "./questions2.js";

const $ = (s) => document.querySelector(s);
const state = { side: null, page: 0, answers: {}, strengths: {} };
const DRAFT_KEY = "caresits-app2-draft";
const DONE_KEY = "caresits-app2-questionnaire";

const pages = () => (state.side === "family" ? FAMILY_PAGES.concat(EXPANSION.family) : CARER_PAGES.concat(EXPANSION.carer));

function persistDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ side: state.side, page: state.page, answers: state.answers, strengths: state.strengths })); } catch { /* storage off */ }
}
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (d?.side) { state.side = d.side; state.page = d.page || 0; state.answers = d.answers || {}; state.strengths = d.strengths || {}; return true; }
  } catch { /* fresh start */ }
  return false;
}

function fieldHtml(f) {
  if (f.whenRole) {
    const roles = (window.CARESITS_ME?.roles || []).map((r) => String(r).toLowerCase().replace(/[^a-z]/g, ""));
    if (roles.length && !f.whenRole.some((w) => roles.some((r) => r.includes(w)))) return "";
  }
  const v = state.answers[f.id];
  const opt = f.optional ? `<span class="optTag">Optional · the more you answer, the better we match you</span>` : "";
  let body = "";
  if (f.type === "text") body = `<input type="text" data-field="${f.id}" value="${v ?? ""}" autocomplete="off">`;
  if (f.type === "number") body = `<input type="number" data-field="${f.id}" value="${v ?? ""}" min="0" inputmode="numeric">`;
  if (f.type === "select") body = `<div class="chips">${f.options.map((o) => `<button type="button" class="chip ${v === o ? "on" : ""}" data-chip="${f.id}" data-value="${o}">${o}</button>`).join("")}</div>`;
  if (f.type === "chips") body = `<div class="chips">${f.options.map((o) => `<button type="button" class="chip ${(v || []).includes(o) ? "on" : ""}" data-chip="${f.id}" data-value="${o}">${o}</button>`).join("")}</div>`;
  if (f.type === "yesno") body = `<div class="chips"><button type="button" class="chip ${v === true ? "on" : ""}" data-yesno="${f.id}" data-value="yes">Yes</button><button type="button" class="chip ${v === false ? "on" : ""}" data-yesno="${f.id}" data-value="no">No</button></div>`;
  if (f.type === "grid") {
    body = `<div class="gridWrap"><table class="grid"><thead><tr><th></th>${PARTS.map((p) => `<th>${p}</th>`).join("")}</tr></thead><tbody>${DAYS.map((d) => `<tr><th>${d}</th>${PARTS.map((p) => `<td><button type="button" class="cell ${((v || {})[d] || []).includes(p) ? "on" : ""}" data-grid="${f.id}" data-day="${d}" data-part="${p}" aria-label="${d} ${p}"></button></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  if (f.type === "band") body = `<div class="bandRow"><label>From <select data-band="${f.id}" data-end="min">${AGES.map((a) => `<option value="${a}" ${String(v?.[0] ?? "") === a ? "selected" : ""}>${a}</option>`).join("")}</select></label><label>To <select data-band="${f.id}" data-end="max">${AGES.map((a) => `<option value="${a}" ${String(v?.[1] ?? "") === a ? "selected" : ""}>${a}</option>`).join("")}</select></label></div>`;
  if (f.type === "experience") body = `<div class="expRows">${BANDS.map((b) => `<label>Ages ${b} <select data-exp="${f.id}" data-bandname="${b}">${YEAR_PICKS.map((y) => `<option value="${y}" ${String((v || {})[b] ?? "") === y ? "selected" : ""}>${y === "" ? "Pick" : y + (y === "20" ? "+" : "")}</option>`).join("")}</select></label>`).join("")}</div>`;
  if (f.type === "expchecks") body = `<div class="expRows">${BANDS.slice(0, 4).map((b) => `<label>Years with ages ${b} <select data-exp="${f.id}" data-bandname="${b}">${YEAR_PICKS.map((y) => `<option value="${y}" ${String((v?.years || {})[b] ?? "") === y ? "selected" : ""}>${y === "" ? "Pick" : y + (y === "20" ? "+" : "")}</option>`).join("")}</select></label>`).join("")}</div><div class="chips">${["Register verified", "Document sighted", "Getting them now"].map((o) => `<button type="button" class="chip ${v?.checks === o ? "on" : ""}" data-expchecks="${f.id}" data-value="${o}">${o}</button>`).join("")}</div>`;
  if (f.type === "homefacts") body = `<div class="chips"><button type="button" class="chip ${v?.petsOk ? "on" : ""}" data-home="${f.id}" data-key="petsOk">Happy with pets</button><button type="button" class="chip ${v?.smokerOk ? "on" : ""}" data-home="${f.id}" data-key="smokerOk">Fine with a smoking home</button><button type="button" class="chip ${v?.nonSmokerHousehold ? "on" : ""}" data-home="${f.id}" data-key="nonSmokerHousehold">I need a non smoking home</button></div>`;
  if (f.companionText) body += `<input type="text" data-field="${f.id}Note" value="${state.answers[f.id + "Note"] ?? ""}" placeholder="Anything to add? (you can leave this empty)" autocomplete="off">`;
  const strength = f.strength
    ? `<div class="strength" role="group" aria-label="How strong is this for you"><span>For us this is:</span>${["Must have", "I prefer", "Either way"].map((s) => `<button type="button" class="chip sm ${(state.strengths[f.id] || "Either way") === s ? "on" : ""}" data-strength="${f.id}" data-value="${s}">${s}</button>`).join("")}</div>`
    : "";
  return `<div class="field"><p class="qLabel">${f.label}</p>${opt}${body}${strength}</div>`;
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
  $("#pageTitle").textContent = p.title;
  $("#pageCount").textContent = `Page ${state.page + 1} of ${list.length}`;
  $("#barFill").style.width = `${Math.round((state.page / list.length) * 100)}%`;
  $("#fields").innerHTML = p.fields.map(fieldHtml).join("");
  $("#backBtn").style.visibility = state.page === 0 ? "hidden" : "visible";
  $("#nextBtn").textContent = state.page === list.length - 1 ? "Finish" : "Keep going";
  document.title = `Caresits · ${p.title}`;
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
      $("#notice").textContent = "One more thing on this page: " + missing[0].label.replace(/\?$/, "") + ".";
      $("#bunnyImg").src = "bunny/bunny-oops.png";
      return;
    }
    $("#notice").textContent = "";
    if (state.page < pages().length - 1) { state.page += 1; persistDraft(); render(); window.scrollTo(0, 0); }
    else finish();
  });
  $("#backBtn").addEventListener("click", () => { if (state.page > 0) { state.page -= 1; persistDraft(); render(); } });
  document.querySelectorAll("[data-side]").forEach((b) => b.addEventListener("click", () => {
    state.side = b.dataset.side; state.page = 0; persistDraft();
    $("#welcome").hidden = true; $("#journey").hidden = false; render();
  }));
}

function deepSets() {
  const deep = {}, deepMusts = {};
  for (const page of EXPANSION[state.side]) {
    for (const q of page.fields) {
      const v = state.answers[q.id];
      if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
      const s = q.profileOnly ? null : q.strengthPick ? (v === "Must have" ? "must" : v === "I prefer" ? "pref" : "either") : (state.strengths[q.id] === "Must have" ? "must" : state.strengths[q.id] === "I prefer" ? "pref" : state.strengths[q.id] ? "either" : null);
      deep[q.pair] = { v, s, feed: q.feed || null };
      if (s === "must") deepMusts[q.pair] = v;
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
    return { side: "family", answers: a, strengths: s, card: { ...card, ...looking } };
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
  return { side: "carer", answers: a, strengths: s, card: { ...card, looking } };
}

function finish() {
  const bundle = buildBundle();
  try { localStorage.setItem(DONE_KEY, JSON.stringify(bundle)); localStorage.removeItem(DRAFT_KEY); } catch { /* storage off */ }
  if (typeof window.CARESITS_SAVE === "function") window.CARESITS_SAVE(bundle);
  $("#journey").hidden = true;
  $("#done").hidden = false;
  $("#doneBunny").src = "bunny/bunny-celebrate.png";
  window.scrollTo(0, 0);
}

export function bootJourney() {
  wire();
  if (loadDraft() && state.side) { $("#welcome").hidden = true; $("#journey").hidden = false; render(); }
}
