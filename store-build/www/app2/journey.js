// Caresitters questionnaire journey — pager + card builder.
// Answers save as a draft on this device at every step. On finish
// the bundle (private answers + the matching card + the looking
// spec) goes to window.CARESITS_SAVE when the account layer wires
// it, and always lands in local storage so nothing is ever lost.
import { FAMILY_PAGES, CARER_PAGES, DAYS, PARTS, BANDS, AGES, EXPERIENCE_YEAR_CHOICES, experienceComplete } from "./questions.js";
import { t as tr, applyI18n } from "./lang.js";
import { slugify } from "../next-phase/engine/engine.mjs";
import { COUNTRY_NAMES, packByName } from "./countries.js";
import { accountKey, draftKey, doneKey } from "./storage-keys.js";
import { levelOf } from "./levels.js";
import { withTimeout } from "../accounts/account.js";
import { warmSave, drainOutbox } from "./account-save.js";
import { EXPANSION } from "./questions2.js";
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

const $ = (s) => document.querySelector(s);
const state = { side: null, page: 0, answers: {}, strengths: {}, resumeFeed: [], countryStep: null, target: "quick", beyond: false, stage: "essentials", choicePages: {}, gridDays: {} };
const WHY_KEY = "caresits-question-why";
let activeWhyIdentity = "";
let activeWhyVisible = false;
function questionWhyData(uid = shellMember()?.uid) {
  try {
    const key = accountKey(`${WHY_KEY}-${state.side}`, uid);
    return key ? JSON.parse(localStorage.getItem(key) || "{}") || {} : {};
  } catch { return {}; }
}
function saveQuestionWhyData(data, uid = shellMember()?.uid) {
  try {
    const key = accountKey(`${WHY_KEY}-${state.side}`, uid);
    if (key) localStorage.setItem(key, JSON.stringify(data));
  } catch { /* storage may be unavailable */ }
}
function questionWhyMarkup(field) {
  const uid = shellMember()?.uid;
  if (!uid || !field) return "";
  const identity = `${uid}:${state.side}:${field.id}`;
  if (identity !== activeWhyIdentity) {
    activeWhyIdentity = identity;
    activeWhyVisible = false;
    const data = questionWhyData(uid);
    if (!data.seen?.[field.id] && !data.hidden?.[field.id]) {
      data.seen = { ...(data.seen || {}), [field.id]: true };
      saveQuestionWhyData(data, uid);
      activeWhyVisible = true;
    }
  }
  if (!activeWhyVisible) return "";
  const key = `guide.why.${field.id}`;
  const copy = tr(key) === key ? tr("guide.why.default") : tr(key);
  return `<aside class="questionWhy" aria-label="${escapeHtml(tr("guide.whyHeading"))}"><img src="bunny/bunny-point-guide.png" alt="" aria-hidden="true"><p>${escapeHtml(copy)}</p><button type="button" class="questionWhyHide" data-hide-question-why aria-label="${escapeHtml(tr("guide.hideWhy"))}">${escapeHtml(tr("guide.hideWhy"))}</button></aside>`;
}
function hideQuestionWhy() {
  const field = pages()[state.page]?.fields?.[0];
  const uid = shellMember()?.uid;
  if (!uid || !field) return;
  const data = questionWhyData(uid);
  data.hidden = { ...(data.hidden || {}), [field.id]: true };
  saveQuestionWhyData(data, uid);
  activeWhyVisible = false;
  render();
}
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
function shellMember() {
  try { if (window.parent && window.parent !== window) return window.parent.CARESITS_ME || null; } catch { /* standalone journey */ }
  return window.CARESITS_ME || null;
}
const storedCountry = () => state.answers.country || shellMember()?.country || null;
function startForEntryRole() {
  if (state.side || interacted) return false;
  const member = shellMember() || {};
  const role = member.entryRole;
  const side = role === "career" || member.side === "carer" ? "carer" : role === "family" || member.side === "family" ? "family" : "";
  if (!side) return false;
  state.side = side;
  state.page = 0;
  state.stage = "essentials";
  if (side === "carer" && !state.answers.displayName) state.answers.displayName = shellMember()?.name || "";
  state.countryStep = !storedCountry();
  $("#welcome").hidden = true;
  $("#journey").hidden = false;
  render();
  return true;
}

function allFields() {
  const base = state.side === "family" ? FAMILY_PAGES : CARER_PAGES;
  const xp = state.side === "family" ? EXPANSION.family : EXPANSION.carer;
  return base.flatMap((p) => p.fields).concat(xp.flatMap((p) => p.fields));
}
function availableField(f) {
  if (!f.whenRole) return true;
  const roles = (shellMember()?.roles || []).map((r) => String(r).toLowerCase().replace(/[^a-z]/g, ""));
  return !roles.length || f.whenRole.some((w) => roles.some((r) => r.includes(w)));
}
function questionPage(fields, titleKey = null, bunny = "point-guide", country = false) {
  return { title: "", _tk: titleKey, bunny, fields, _country: country };
}
function essentials() {
  if (state.countryStep === null) state.countryStep = !storedCountry();
  const byId = new Map(allFields().map((f) => [f.id, f]));
  // Keep the essential path short and make every stop one clear
  // question. A family can refine travel distance later; a carer's
  // travel range is needed to make their profile useful.
  const ids = state.side === "family"
    ? ["postcode", "role", "childrenBands", "startWhen", "scheduleNeed", "languages", "mustLanguages", "nonSmoker"]
    : ["postcode", "maxDistanceKm", "experience", "agesAccepted", "availability", "languages", "checksLevel", "payFloor"];
  const out = ids.map((id) => {
    const f = byId.get(id);
    if (!f) return null;
    return questionPage([{ ...f, required: true, ...(id === "mustLanguages" ? { noPreference: true } : {}) }], null, "point-guide");
  }).filter(Boolean);
  if (state.countryStep) out.unshift(questionPage(COUNTRY_PAGE.fields, COUNTRY_PAGE._tk, COUNTRY_PAGE.bunny, true));
  return out;
}
function optionalPages() {
  const needed = new Set(essentials().flatMap((p) => p.fields.map((f) => f.id)));
  return allFields().filter((f) => !needed.has(f.id) && availableField(f) && !(f.id === "displayName" && state.answers.displayName))
    .map((f) => questionPage([f], null, "encourage"));
}
function pages(stage = state.stage) {
  return stage === "optional" ? optionalPages() : essentials();
}

function writeDraft() {
  if (!activeDraftKey) return;
  try { localStorage.setItem(activeDraftKey, JSON.stringify({ side: state.side, page: state.page, answers: state.answers, strengths: state.strengths, resumeFeed: state.resumeFeed, countryStep: state.countryStep, target: state.target, beyond: state.beyond, stage: state.stage, choicePages: state.choicePages, gridDays: state.gridDays })); } catch { /* storage off */ }
}
function persistDraft() {
  interacted = true;
  writeDraft();
}
function resetJourneyState() {
  state.side = null; state.page = 0; state.answers = {}; state.strengths = {}; state.resumeFeed = []; state.countryStep = null; state.target = "quick"; state.beyond = false; state.stage = "essentials"; state.choicePages = {}; state.gridDays = {};
}
function loadDraft() {
  if (!activeDraftKey) return false;
  try {
    const d = JSON.parse(localStorage.getItem(activeDraftKey) || "null");
    if (d?.target) state.target = d.target;
    if (d?.beyond) state.beyond = true;
    if (d?.side) { state.side = d.side; state.page = d.stage ? (d.page || 0) : 0; state.stage = d.stage || "essentials"; state.answers = d.answers || {}; state.strengths = d.strengths || {}; state.resumeFeed = d.resumeFeed || []; state.countryStep = d.countryStep === undefined ? null : d.countryStep; state.choicePages = d.choicePages || {}; state.gridDays = d.gridDays || {}; return true; }
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

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
function choiceCards(f, options, selected, multi = false) {
  const pageSize = f.noPreference && multi ? 4 : 5;
  const pageCount = Math.max(1, Math.ceil(options.length / pageSize));
  const page = Math.min(state.choicePages[f.id] || 0, pageCount - 1);
  const from = page * pageSize;
  const shown = options.slice(from, from + pageSize);
  const cards = shown.map((option, offset) => {
    const index = from + offset;
    const active = multi ? (selected || []).includes(option) : selected === option;
    return `<button type="button" class="answerCard ${active ? "on" : ""}" data-chip="${escapeHtml(f.id)}" data-value="${escapeHtml(option)}" aria-pressed="${active}">${escapeHtml(O(f, option, index))}</button>`;
  }).join("");
  const noPreference = f.noPreference && multi
    ? `<button type="button" class="answerCard ${Array.isArray(selected) && selected.length === 0 && Object.prototype.hasOwnProperty.call(state.answers, f.id) ? "on" : ""}" data-no-preference="${escapeHtml(f.id)}" aria-pressed="${Array.isArray(selected) && selected.length === 0 && Object.prototype.hasOwnProperty.call(state.answers, f.id)}">${escapeHtml(tr("journey.noPreference"))}</button>`
    : "";
  const pager = pageCount > 1 ? `<div class="optionPager"><span>${escapeHtml(tr("journey.optionCount", undefined, { a: from + 1, b: Math.min(from + pageSize, options.length), c: options.length }))}</span><div>${page > 0 ? `<button type="button" class="quietBtn" data-choice-page="${escapeHtml(f.id)}" data-page="${page - 1}">${escapeHtml(tr("journey.optionPrevious"))}</button>` : ""}${page < pageCount - 1 ? `<button type="button" class="quietBtn" data-choice-page="${escapeHtml(f.id)}" data-page="${page + 1}">${escapeHtml(tr("journey.optionMore"))}</button>` : ""}</div></div>` : "";
  return `<div class="answerChoices" role="group" aria-label="${escapeHtml(L(f))}">${cards}${noPreference}</div>${pager}`;
}
function fieldHtml(f, showLabel = false) {
  const v = state.answers[f.id];
  const optional = state.stage === "optional" || !f.required;
  const optionalLabel = tr("journey.optional").split("·")[0].trim();
  const tag = optional ? `<span class="optTag">${escapeHtml(optionalLabel)}</span>` : `<span class="reqTag">${escapeHtml(tr("journey.required"))}</span>`;
  const label = showLabel ? `<p class="qLabel">${L(f)}</p>` : "";
  const aria = escapeHtml(L(f));
  let body = "";
  if (f.type === "text") body = `<input type="text" data-field="${escapeHtml(f.id)}" aria-label="${aria}" value="${escapeHtml(v ?? "")}" autocomplete="off">`;
  if (f.type === "number") body = `<input type="number" data-field="${escapeHtml(f.id)}" aria-label="${aria}" value="${escapeHtml(v ?? "")}" min="0" inputmode="numeric">`;
  if (f.type === "select") body = choiceCards(f, f.options, v, false);
  if (f.type === "chips") body = choiceCards(f, f.options, v, true);
  if (f.type === "yesno") body = `<div class="answerChoices" role="group" aria-label="${aria}"><button type="button" class="answerCard ${v === true ? "on" : ""}" data-yesno="${escapeHtml(f.id)}" data-value="yes" aria-pressed="${v === true}">${escapeHtml(tr("journey.yes"))}</button><button type="button" class="answerCard ${v === false ? "on" : ""}" data-yesno="${escapeHtml(f.id)}" data-value="no" aria-pressed="${v === false}">${escapeHtml(tr("journey.no"))}</button></div>`;
  if (f.type === "grid") {
    const day = state.gridDays[f.id] || DAYS[0];
    body = `<div class="gridDay"><label>${tr("journey.dayLabel")} <select data-grid-day="${f.id}" aria-label="${tr("journey.dayLabel")}">${DAYS.map((d) => `<option value="${d}" ${day === d ? "selected" : ""}>${tr("journey.day." + d)}</option>`).join("")}</select></label></div><div class="gridChoices" role="group" aria-label="${aria}">${PARTS.map((part) => `<button type="button" class="chip ${(v?.[day] || []).includes(part) ? "on" : ""}" data-grid="${f.id}" data-day="${day}" data-part="${part}" aria-pressed="${(v?.[day] || []).includes(part)}">${tr("journey.part." + part)}</button>`).join("")}</div>`;
  }
  if (f.type === "band") body = `<div class="bandRow"><label>${tr("journey.from")} <select data-band="${f.id}" data-end="min">${AGES.map((a) => `<option value="${a}" ${String(v?.[0] ?? "") === a ? "selected" : ""}>${a}</option>`).join("")}</select></label><label>${tr("journey.to")} <select data-band="${f.id}" data-end="max">${AGES.map((a) => `<option value="${a}" ${String(v?.[1] ?? "") === a ? "selected" : ""}>${a}</option>`).join("")}</select></label></div>`;
  if (f.type === "experience") body = `<div class="expRows">${BANDS.map((b) => `<label>${tr("journey.ages", undefined, { b })} <select data-exp="${f.id}" data-bandname="${b}">${EXPERIENCE_YEAR_CHOICES.map((y) => `<option value="${y}" ${String((v || {})[b] ?? "") === y ? "selected" : ""}>${y === "" ? tr("journey.pick") : y + (y === "20" ? "+" : "")}</option>`).join("")}</select></label>`).join("")}</div>`;
  if (f.type === "expchecks") body = `<div class="expRows">${BANDS.slice(0, 4).map((b) => `<label>${tr("journey.yearsAges", undefined, { b })} <select data-exp="${f.id}" data-bandname="${b}">${EXPERIENCE_YEAR_CHOICES.map((y) => `<option value="${y}" ${String((v?.years || {})[b] ?? "") === y ? "selected" : ""}>${y === "" ? tr("journey.pick") : y + (y === "20" ? "+" : "")}</option>`).join("")}</select></label>`).join("")}</div><div class="chips">${["Register verified", "Document sighted", "Getting them now"].map((o, oi) => `<button type="button" class="chip ${v?.checks === o ? "on" : ""}" data-expchecks="${f.id}" data-value="${o}">${tr(["checks.level.register", "checks.level.sighted", "checks.level.getting"][oi])}</button>`).join("")}</div>`;
  if (f.type === "homefacts") body = `<div class="chips"><button type="button" class="chip ${v?.petsOk ? "on" : ""}" data-home="${f.id}" data-key="petsOk">${tr("journey.petsOk")}</button><button type="button" class="chip ${v?.smokerOk ? "on" : ""}" data-home="${f.id}" data-key="smokerOk">${tr("journey.smokerOk")}</button><button type="button" class="chip ${v?.nonSmokerHousehold ? "on" : ""}" data-home="${f.id}" data-key="nonSmokerHousehold">${tr("journey.nonSmokerHome")}</button></div>`;
  if (f.companionText) body += `<input type="text" data-field="${f.id}Note" value="${state.answers[f.id + "Note"] ?? ""}" placeholder="${tr("journey.addNote")}" autocomplete="off">`;
  const strength = f.strength
    ? `<div class="strength" role="group" aria-label="${tr("journey.strengthAria")}"><span>${tr("journey.strengthPre")}</span>${["Must have", "I prefer", "Either way"].map((x) => `<button type="button" class="chip sm ${(state.strengths[f.id] || "Either way") === x ? "on" : ""}" data-strength="${f.id}" data-value="${x}">${tr({ "Must have": "journey.must", "I prefer": "journey.prefer", "Either way": "journey.either" }[x])}</button>`).join("")}</div>`
    : "";
  return `<div class="field">${label}${tag}${body}${payHelp(f)}${strength}</div>`;
}

function answered(f) {
  const v = state.answers[f.id];
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0 || (f.noPreference && Object.prototype.hasOwnProperty.call(state.answers, f.id));
  if (f.type === "grid") return Object.values(v).some((a) => a.length);
  if (f.type === "band") return Array.isArray(v) && v[0] != null && v[1] != null;
  if (f.type === "experience") return experienceComplete(v);
  if (f.type === "expchecks") return Boolean(v?.checks) || Object.values(v?.years || {}).some((x) => x !== "" && x != null);
  if (f.type === "homefacts") return true;
  return true;
}

function render() {
  const ready = state.stage === "ready";
  $("#welcome").hidden = true;
  $("#essentialsDone").hidden = !ready;
  $("#journey").hidden = ready;
  if (ready) {
    $("#readyBarFill").style.width = "100%";
    document.title = `Caresitters · ${tr("journey.essentialsTitle")}`;
    return;
  }
  const list = pages();
  if (state.page >= list.length) state.page = Math.max(0, list.length - 1);
  const p = list[state.page];
  if (!p) return;
  const total = list.length;
  const questionNumber = state.page + 1;
  const first = p.fields[0];
  const titleKey = p._tk;
  const title = p._country && titleKey ? tr(titleKey) : p.fields.length === 1 ? L(first) : (titleKey && tr(titleKey) !== titleKey ? tr(titleKey) : p.title);
  $("#bunnyImg").src = `bunny/bunny-${p.bunny}.png`;
  $("#pageTitle").textContent = title;
  $("#pageCount").textContent = tr("journey.page", undefined, { a: questionNumber, b: total });
  $("#barFill").style.width = `${Math.round((questionNumber / Math.max(total, 1)) * 100)}%`;
  $("#optionalLead").hidden = state.stage !== "optional";
  $("#fields").innerHTML = questionWhyMarkup(first) + p.fields.map((f) => fieldHtml(f, true)).join("");
  $("#backBtn").textContent = tr("journey.back");
  $("#backBtn").style.visibility = state.page === 0 && state.stage === "essentials" ? "hidden" : "visible";
  $("#skipBtn").textContent = tr("tour.nameSkip");
  $("#skipBtn").hidden = state.stage !== "optional";
  $("#nextBtn").textContent = state.stage === "optional" && state.page === list.length - 1 ? tr("journey.finish") : tr("journey.next");
  document.title = `Caresitters · ${title}`;
}

function wire() {
  $("#fields").addEventListener("click", (e) => {
    const hideWhy = e.target.closest("[data-hide-question-why]");
    if (hideWhy) { hideQuestionWhy(); return; }
    const choicePage = e.target.closest("[data-choice-page]");
    if (choicePage) { state.choicePages[choicePage.dataset.choicePage] = Number(choicePage.dataset.page) || 0; render(); return; }
    const noPreference = e.target.closest("[data-no-preference]");
    if (noPreference) { state.answers[noPreference.dataset.noPreference] = []; persistDraft(); render(); return; }
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
  $("#fields").addEventListener("change", (e) => { onFieldInput(e); render(); });
  $("#fields").addEventListener("input", onFieldInput);
  function onFieldInput(e) {
    const inp = e.target;
    if (inp.dataset.gridDay) { state.gridDays[inp.dataset.gridDay] = inp.value; persistDraft(); render(); return; }
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
  const advancePage = () => {
    const list = pages();
    if (state.page < list.length - 1) { state.page += 1; persistDraft(); render(); window.scrollTo(0, 0); return; }
    if (state.stage === "essentials") {
      state.stage = "ready"; state.page = 0; persistDraft(); render(); void savePreview(); window.scrollTo(0, 0); return;
    }
    finish();
  };
  $("#nextBtn").addEventListener("click", () => {
    const p = pages()[state.page];
    const missing = state.stage === "essentials" ? p.fields.filter((f) => f.required && !answered(f)) : [];
    if (missing.length) {
      $("#notice").textContent = tr("journey.notice", undefined, { q: L(missing[0]).replace(/\?$/, "") });
      $("#bunnyImg").src = "bunny/bunny-oops.png";
      return;
    }
    $("#notice").textContent = "";
    advancePage();
  });
  $("#skipBtn").addEventListener("click", advancePage);
  $("#backBtn").addEventListener("click", () => {
    if (state.stage === "optional" && state.page === 0) { state.stage = "ready"; state.page = 0; persistDraft(); render(); return; }
    if (state.page > 0) { state.page -= 1; persistDraft(); render(); }
  });
  document.querySelectorAll("[data-side]").forEach((b) => b.addEventListener("click", () => {
    state.side = b.dataset.side; state.page = 0; state.stage = "essentials";
    if (state.side === "carer" && !state.answers.displayName) state.answers.displayName = shellMember()?.name || "";
    persistDraft();
    $("#welcome").hidden = true; $("#journey").hidden = false; render();
  }));
  $("#seeMatchesBtn").addEventListener("click", async () => {
    await savePreview();
    try {
      const host = window.parent;
      if (typeof host.CARESITS_NAV === "function") { host.CARESITS_NAV("find"); return; }
    } catch { /* standalone questionnaire */ }
    location.href = "index.html";
  });
  $("#betterMatchesBtn").addEventListener("click", () => {
    state.stage = "optional"; state.page = 0; persistDraft(); render(); window.scrollTo(0, 0);
  });
  $("#reviewAnswersBtn").addEventListener("click", () => {
    state.stage = "essentials"; state.page = 0; persistDraft(); render(); window.scrollTo(0, 0);
  });
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

let previewSaving = null;
async function savePreview() {
  persistDraft();
  if (previewSaving) return previewSaving;
  const bundle = buildBundle();
  previewSaving = (async () => {
    if (typeof window.CARESITS_SAVE !== "function") return { saved: "local" };
    try { return await withTimeout(window.CARESITS_SAVE(bundle), 15000, "questionnaire preview save"); }
    catch { return { saved: "local" }; }
  })();
  try { return await previewSaving; } finally { previewSaving = null; }
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
  try { const key = doneKey(); if (key) localStorage.setItem(key, JSON.stringify(bundle)); if (activeDraftKey) localStorage.removeItem(activeDraftKey); } catch { /* storage off */ }
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
    const key = accountKey(RESUME_KEY);
    const raw = key ? localStorage.getItem(key) : null;
    if (!raw) return;
    const h = JSON.parse(raw);
    localStorage.removeItem(key);
    if (!h || h.side !== "carer" || state.side === "family") return;
    state.side = "carer";
    for (const [k, v] of Object.entries(h.answers || {})) if (state.answers[k] === undefined) state.answers[k] = v;
    state.resumeFeed = [...new Set([...(state.resumeFeed || []), ...(h.marks || [])])];
    writeDraft();
  } catch { /* no handoff */ }
}

export function bootJourney() {
  applyI18n();
  window.CARESITS_REFRESH_LANGUAGE = () => {
    applyI18n();
    if (state.side && !$("#journey").hidden) render();
  };
  wire();
  // Warm this realm's session restore now, at page entry,
  // not lazily at Finish (QA b108); and land any finished
  // journey still standing in this account's done envelope.
  // The drain fires now and again seconds later (QA b110
  // member 3): the entry instant's keying and session are
  // the youngest of the visit, and a drained key makes the
  // second attempt a no-op.
  warmSave();
  drainOutbox();
  setTimeout(() => drainOutbox(), 3000);
  activeDraftKey = draftKey();
  loadDraft();
  consumeResumeHandoff();
  if (state.side === "carer" && !state.answers.displayName) state.answers.displayName = shellMember()?.name || "";
  if (state.side) { $("#welcome").hidden = true; render(); }
  else if (window.parent?.CARESITS_ACCOUNT_READY) startForEntryRole();
  try { window.parent.document.addEventListener("caresits-account-ready", startForEntryRole); } catch { /* standalone journey */ }
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
    if (state.side === "carer" && !state.answers.displayName) state.answers.displayName = shellMember()?.name || "";
    if (state.side) { $("#welcome").hidden = true; render(); }
    else if (!startForEntryRole()) { $("#welcome").hidden = false; $("#journey").hidden = true; $("#essentialsDone").hidden = true; }
  }, 250);
}
