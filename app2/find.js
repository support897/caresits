// Caresitters app2 — the Find screen on browse.js.
// Browsing is never gated: anyone can look. The screen shows
// the live pool count, the Top 5 first, View more for the
// rest, and (families only) the nearly list. A Message button
// rides every card; what it may do is decided by the pair
// action layer, not here. Data arrives from the live account
// layer when it can; otherwise the designed empty states
// stand. Test and live hooks may set CARESITS_FIND_DATA.
import { assembleBrowse, pinLayout, kmBetween, stitchAnswers, areaCoordsFor } from "./browse.js";
import { t as tr } from "./lang.js";
import { frameUser } from "./account-save.js";
import { LANGS, BANDS, DAYS, PARTS } from "./questions.js";
import { paintFileImg } from "./files.js";
import { renderAuPairFind, viewerIsAuPairWorld } from "./aupair-find.js";
import { openProfile } from "./profile-view.js";
const labelText = (s) => tr({ "Perfect Pair": "find.label.perfect", "Strong Fit": "find.label.strong", "Good Fit": "find.label.good" }[s] || "find.label.good");
const qualText = (s) => (s === "Quick profile, rough match" ? tr("find.qualifier") : s);
const reasonText = (result, r, i) => { const code = result.reasonCodes?.[i]; return code ? tr("reason." + code) : r; };
const gateText = (item) => (item.failedGateCode ? tr("gate." + item.failedGateCode) : item.failedGate);
const learningReasonText = (reason) => {
  if (!reason) return "";
  const value = reason.type === "style" ? tr("learning.style." + reason.value)
    : reason.type === "area" ? tr("learning.area." + reason.value) : reason.value;
  return reason.type === "style" ? tr("learning.matchStyle", undefined, { style: value })
    : reason.type === "area" ? tr("learning.matchArea", undefined, { area: value })
      : tr("learning.matchLanguage", undefined, { language: value });
};

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const FILTER_DEFAULTS = { sortBy: "match", types: [], distanceKm: "", language: "", ageBands: [], slots: [], verifiedOnly: false, auPairOnly: false, auPairInfant: false, auPairEnglish: "", auPairArrive: "", expYears: 0, maxPay: "", transport: "", pets: "" };
let filterState = { ...FILTER_DEFAULTS };
let filterOwner = null;
let roleTab = "";
const norm = (value) => String(value ?? "").trim().toLowerCase();
const activeFilterCount = () => Object.entries(filterState).filter(([k, v]) => {
  if (Array.isArray(v)) return v.length > 0;
  if (k === "sortBy") return v !== "match";
  if (k === "expYears") return Number(v) > 0;
  return v !== "" && v !== false;
}).length + (roleTab ? 1 : 0);
const listValue = (value) => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];

function dayAvailable(card, day, viewerSide) {
  const value = viewerSide === "family" ? card.availability : card.scheduleNeed;
  if (Array.isArray(value)) return value.some((d) => norm(d) === norm(day));
  if (!value || typeof value !== "object") return false;
  const raw = value[day] ?? value[day.toLowerCase()] ?? value[day.toUpperCase()];
  if (Array.isArray(raw)) return raw.length > 0;
  if (raw && typeof raw === "object") return Object.values(raw).some((part) => Array.isArray(part) ? part.length > 0 : Boolean(part));
  return Boolean(raw);
}

function slotAvailable(card, day, part, viewerSide) {
  const value = viewerSide === "family" ? card.availability : card.scheduleNeed;
  if (!value || typeof value !== "object") return false;
  const raw = value[day] ?? value[day.toLowerCase()] ?? value[day.toUpperCase()];
  if (raw === true) return true;
  if (Array.isArray(raw)) return part ? raw.map(norm).includes(norm(part)) : raw.length > 0;
  if (raw && typeof raw === "object") return Object.values(raw).some((p) => Array.isArray(p) ? p.length > 0 : Boolean(p));
  return Boolean(raw);
}

// The viewer's own saved need (the composer on this screen
// writes it; the copy on this device is the composer's own
// read path). Difference Map item 6: the need is READ here,
// by the filtering and the order, not only written.
function viewerNeed(viewerDoc) {
  try {
    if (!viewerDoc || !viewerDoc.uid) return null;
    const raw = localStorage.getItem(`caresits-v2-need-${viewerDoc.uid}`);
    const need = raw ? JSON.parse(raw) : null;
    if (!need || typeof need !== "object") return null;
    return {
      days: Array.isArray(need.days) ? need.days : [],
      dates: Array.isArray(need.dates) ? need.dates : [],
      kinds: Array.isArray(need.kinds) ? need.kinds : [],
      needFreq: typeof need.needFreq === "string" ? need.needFreq : "",
      needUrgency: typeof need.needUrgency === "string" ? need.needUrgency : "",
      carePlace: typeof need.carePlace === "string" ? need.carePlace : "",
    };
  } catch { return null; }
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function needCover(card, viewerDoc, need) {
  // How many of the needed days (the named days, plus the
  // weekdays of the named dates) this card's week covers.
  if (!need) return 0;
  const wanted = new Set(need.days || []);
  for (const d of need.dates || []) {
    const dt = new Date(String(d) + "T12:00:00");
    if (!isNaN(dt.getTime())) wanted.add(DAY_NAMES[dt.getDay()]);
  }
  let n = 0;
  for (const day of wanted) if (dayAvailable(card, day, viewerDoc.side)) n += 1;
  // The type of care the family asked for, in the same words
  // the family wizard uses: a carer whose own type is one of
  // them covers more of this need.
  if (viewerDoc.side === "family" && (need.kinds || []).length) {
    const roles = listValue(card.roles || card.role).map(norm);
    if ((need.kinds || []).some((k) => roles.some((r) => r.includes(norm(k)) || norm(k).includes(r)))) n += 1;
  }
  return n;
}

function filterCandidates(viewerDoc, candidateDocs, state = filterState) {
  const familyViewer = viewerDoc.side === "family";
  const need = viewerDoc.side === "family" || viewerDoc.side === "carer" ? viewerNeed(viewerDoc) : null;
  const needDays = need ? new Set([...(need.days || []), ...(need.dates || []).map((d) => { const dt = new Date(String(d) + "T12:00:00"); return isNaN(dt.getTime()) ? "" : DAY_NAMES[dt.getDay()]; }).filter(Boolean)]) : new Set();
  return candidateDocs.filter((doc) => {
    if (doc.side === viewerDoc.side) return true;
    const card = doc.card || {};
    // The saved need's days: a card that covers none of them
    // is not what this member asked for (their own words, in
    // their own composer). Dates count through their weekday.
    if (needDays.size && ![...needDays].some((day) => dayAvailable(card, day, viewerDoc.side))) return false;
    const wantedTypes = [...(state.types || []), ...(roleTab ? [roleTab] : [])];
    if (wantedTypes.length) {
      const roles = listValue(card.roles || card.role).map(norm);
      const hit = wantedTypes.some((t) => norm(t) === "au pair" ? Boolean(card.auPair && card.auPair.on) : roles.some((r) => r.includes(norm(t))));
      if (!hit) return false;
    }
    if (state.distanceKm) {
      const km = kmBetween(viewerDoc.card || {}, card);
      if (km == null || km > Number(state.distanceKm)) return false;
    }
    if (state.language) {
      const languages = listValue(card.languages).map(norm);
      if (!languages.includes(norm(state.language))) return false;
    }
    if ((state.ageBands || []).length) {
      const ages = listValue(familyViewer ? (card.agesAccepted || card.agesPreferred) : card.childrenBands).map(norm);
      if (!state.ageBands.some((b) => ages.includes(norm(b)))) return false;
    }
    if ((state.slots || []).length) {
      const hit = state.slots.some((slot) => { const [day, part] = String(slot).split("|"); return slotAvailable(card, day, part, viewerDoc.side); });
      if (!hit) return false;
    }
    if (state.verifiedOnly) {
      const checks = norm(card.checksLevel || doc.checksLevel);
      if (!(["register", "sighted", "verified", "register verified", "document sighted"].includes(checks))) return false;
    }
    if (familyViewer && (state.auPairOnly || state.auPairInfant || state.auPairEnglish || state.auPairArrive)) {
      const ap = card.auPair || {};
      if (!ap.on) return false;
      if (state.auPairInfant && !ap.infant) return false;
      if (state.auPairEnglish && ["Basic", "Good", "Fluent"].indexOf(ap.english) < ["Basic", "Good", "Fluent"].indexOf(state.auPairEnglish)) return false;
      if (state.auPairArrive && (!ap.arrival || ap.arrival > state.auPairArrive)) return false;
    }
    if (Number(state.expYears) > 0) {
      const years = Object.values(card.experience || {}).map(Number).filter(Number.isFinite);
      if (!years.length || Math.max(...years) < Number(state.expYears)) return false;
    }
    if (state.maxPay) {
      const amount = Number(familyViewer ? card.payFloor : card.payOffered);
      if (!Number.isFinite(amount) || amount <= 0 || (familyViewer ? amount > Number(state.maxPay) : amount < Number(state.maxPay))) return false;
    }
    if (state.transport && familyViewer) {
      if (state.transport === "drive" && !card.drives && !card.ownCar) return false;
      if (state.transport === "ownCar" && !card.ownCar) return false;
    }
    if (state.pets && !familyViewer) {
      if (state.pets === "pets" && !card.pets) return false;
      if (state.pets === "noPets" && card.pets) return false;
    }
    return true;
  });
}

function filterSelect(container, controls, key, label, options, value) {
  const wrap = el("label", "findFilterField");
  wrap.append(el("span", "findFilterLabel", label));
  const select = el("select", "txtIn findFilterSelect");
  select.setAttribute("aria-label", label);
  for (const [optionValue, optionLabel] of options) {
    const option = el("option", null, optionLabel);
    option.value = optionValue;
    select.append(option);
  }
  select.value = value ?? "";
  wrap.append(select);
  container.append(wrap);
  controls[key] = select;
  return select;
}

function filterCheck(container, controls, key, label, checked) {
  const wrap = el("label", "findFilterCheck");
  const input = el("input");
  input.type = "checkbox";
  input.checked = Boolean(checked);
  input.setAttribute("aria-label", label);
  wrap.append(input, el("span", null, label));
  container.append(wrap);
  controls[key] = input;
  return input;
}

function openFilterSheet(root, viewerDoc, candidates, opener) {
  document.getElementById("findFilterSheet")?.remove();
  const familyViewer = viewerDoc.side === "family";
  const draft = { ...filterState, types: [...(filterState.types || [])], ageBands: [...(filterState.ageBands || [])], slots: [...(filterState.slots || [])] };
  const wrap = el("div", "sheetWrap filterSheetWrap");
  wrap.id = "findFilterSheet";
  const sheet = el("section", "sheetCard filterSheetCard");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "findFilterTitle");
  const head = el("div", "findFilterHead");
  head.append(el("h2", "findFilterTitle", tr("find.filters")));
  const close = el("button", "ghostBtn findFilterClose", tr("find.closeFilters"));
  close.type = "button";
  head.append(close);
  sheet.append(head, el("p", "findFilterHelp", tr("find.filterHelp")));
  const controls = {};
  const onChange = () => refreshCount();

  // Sort, as a real control (Difference Map item 9): the
  // choices are the engine's own rank keys, named plainly.
  const sortBox = el("div", "findFilterGroup");
  sortBox.append(el("p", "findFilterLabel", tr("find.sortBy")));
  for (const [value, key] of [["match", "find.sortMatch"], ["nearest", "find.sortNearest"], ["reply", "find.sortReply"], ["worked", "find.sortWorked"]]) {
    const row = el("label", "findFilterCheck");
    const input = el("input");
    input.type = "radio"; input.name = "findSortBy"; input.value = value;
    input.checked = draft.sortBy === value;
    input.addEventListener("change", () => { if (input.checked) { draft.sortBy = value; onChange(); } });
    row.append(input, el("span", null, tr(key)));
    sortBox.append(row);
  }
  sheet.append(sortBox);

  const basic = el("div", "findFilterGrid");
  const any = [["", tr("find.filterAny")]];
  filterSelect(basic, controls, "distanceKm", tr("find.filterDistance"), [...any, ...[5, 10, 25, 50, 100].map((n) => [String(n), tr("find.filterKm", undefined, { n })])], draft.distanceKm);
  filterSelect(basic, controls, "language", tr("find.filterLanguage"), [...any, ...LANGS.map((v) => [v, v])], draft.language);
  sheet.append(basic);

  // Type of carer, as checkboxes (the industry shape).
  if (familyViewer) {
    const typeBox = el("div", "findFilterGroup");
    typeBox.append(el("p", "findFilterLabel", tr("find.filterTypes")));
    for (const t of ["Babysitter", "Nanny", "Au pair"]) {
      const row = el("label", "findFilterCheck");
      const input = el("input");
      input.type = "checkbox";
      input.checked = draft.types.includes(t);
      input.addEventListener("change", () => { draft.types = input.checked ? [...draft.types, t] : draft.types.filter((x) => x !== t); onChange(); });
      row.append(input, el("span", null, t));
      typeBox.append(row);
    }
    sheet.append(typeBox);
  }

  // Age bands, as checkboxes.
  const agesBox = el("div", "findFilterGroup");
  agesBox.append(el("p", "findFilterLabel", tr(familyViewer ? "find.filterCarerAges" : "find.filterChildAges")));
  const agesRow = el("div", "findChipChecks");
  for (const b of BANDS) {
    const row = el("label", "findFilterCheck");
    const input = el("input");
    input.type = "checkbox";
    input.checked = draft.ageBands.includes(b);
    input.addEventListener("change", () => { draft.ageBands = input.checked ? [...draft.ageBands, b] : draft.ageBands.filter((x) => x !== b); onChange(); });
    row.append(input, el("span", null, b));
    agesRow.append(row);
  }
  agesBox.append(agesRow);
  sheet.append(agesBox);

  // Availability: dayparts by days, the industry grid.
  const availBox = el("div", "findFilterGroup");
  availBox.append(el("p", "findFilterLabel", tr("find.filterAvail")));
  const table = el("table", "findAvailGrid");
  const headRow = el("tr");
  headRow.append(el("th", null, ""));
  for (const d of DAYS) headRow.append(el("th", null, d.slice(0, 3)));
  table.append(headRow);
  for (const part of PARTS) {
    const row = el("tr");
    row.append(el("th", null, part.charAt(0).toUpperCase() + part.slice(1)));
    for (const d of DAYS) {
      const cell = el("td");
      const slot = d + "|" + part;
      const b = el("button", "findAvailCell" + (draft.slots.includes(slot) ? " on" : ""), draft.slots.includes(slot) ? "●" : "");
      b.type = "button";
      b.setAttribute("aria-pressed", String(draft.slots.includes(slot)));
      b.setAttribute("aria-label", d + " " + part);
      b.addEventListener("click", () => {
        const on = !draft.slots.includes(slot);
        draft.slots = on ? [...draft.slots, slot] : draft.slots.filter((x) => x !== slot);
        b.classList.toggle("on", on);
        b.textContent = on ? "●" : "";
        b.setAttribute("aria-pressed", String(on));
        onChange();
      });
      cell.append(b);
      row.append(cell);
    }
    table.append(row);
  }
  availBox.append(table);
  sheet.append(availBox);

  const extra = el("div", "findFilterGrid findExtraFilters");
  if (familyViewer) {
    // Experience, as a slider of minimum years.
    const expWrap = el("label", "findFilterField");
    expWrap.append(el("span", "findFilterLabel", tr("find.filterExperience")));
    const slider = el("input", "findExpSlider");
    slider.type = "range"; slider.min = "0"; slider.max = "11"; slider.step = "1";
    slider.value = String(draft.expYears || 0);
    slider.setAttribute("aria-label", tr("find.filterExperience"));
    const expOut = el("span", "findFilterValue", Number(draft.expYears) > 0 ? tr("find.filterYears", undefined, { n: draft.expYears }) : tr("find.filterAny"));
    slider.addEventListener("input", () => { draft.expYears = Number(slider.value); expOut.textContent = draft.expYears > 0 ? tr("find.filterYears", undefined, { n: draft.expYears }) : tr("find.filterAny"); onChange(); });
    expWrap.append(slider, expOut);
    extra.append(expWrap);
    filterCheck(extra, controls, "verifiedOnly", tr("find.filterChecks"), draft.verifiedOnly);
    filterSelect(extra, controls, "maxPay", tr("find.filterMaxPay"), [...any, ...[20, 25, 30, 40, 50].map((n) => [String(n), tr("find.filterCurrency", undefined, { n })])], draft.maxPay);
    // The honest average: computed from this pool's own
    // rates, shown only when the pool carries rates at all.
    const rates = candidates.filter((d) => d.side !== viewerDoc.side).map((d) => Number((d.card || {}).payFloor)).filter((n) => Number.isFinite(n) && n > 0);
    if (rates.length) extra.append(el("p", "findFilterHelp", tr("find.rateAverage", undefined, { n: Math.round(rates.reduce((s, n) => s + n, 0) / rates.length) })));
    filterSelect(extra, controls, "transport", tr("find.filterTransport"), [...any, ["drive", tr("find.filterDrive")], ["ownCar", tr("find.filterOwnCar")]], draft.transport);
    filterCheck(extra, controls, "auPairInfant", "Au pair: can care for babies", draft.auPairInfant);
    filterSelect(extra, controls, "auPairEnglish", "Au pair: English at least", [...any, ["Basic", "Basic"], ["Good", "Good"], ["Fluent", "Fluent"]], draft.auPairEnglish);
    filterSelect(extra, controls, "auPairArrive", "Au pair: can arrive by", [...any, ...Array.from({ length: 12 }, (_, i) => { const d = new Date(new Date().getFullYear(), new Date().getMonth() + i, 1); return [d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), d.toLocaleString("en", { month: "short", year: "numeric" })]; })], draft.auPairArrive);
    const apNote = el("p", "findFilterHelp", tr("find.auPairNote"));
    extra.append(apNote);
  } else {
    filterCheck(extra, controls, "verifiedOnly", tr("find.filterChecks"), draft.verifiedOnly);
    filterSelect(extra, controls, "pets", tr("find.filterPets"), [...any, ["pets", tr("find.filterPetsYes")], ["noPets", tr("find.filterPetsNo")]], draft.pets);
    filterSelect(extra, controls, "maxPay", tr("find.filterMinPay"), [...any, ...[18, 20, 25, 30, 40].map((n) => [String(n), tr("find.filterCurrency", undefined, { n })])], draft.maxPay);
    const rates = candidates.filter((d) => d.side !== viewerDoc.side).map((d) => Number((d.card || {}).payOffered)).filter((n) => Number.isFinite(n) && n > 0);
    if (rates.length) extra.append(el("p", "findFilterHelp", tr("find.rateAverage", undefined, { n: Math.round(rates.reduce((s, n) => s + n, 0) / rates.length) })));
  }
  sheet.append(extra);
  const readControls = () => {
    for (const [key, input] of Object.entries(controls)) draft[key] = input.type === "checkbox" ? input.checked : input.value;
    return draft;
  };
  const actions = el("div", "findFilterActions");
  const clear = el("button", "quietBtn", tr("find.clearFilters"));
  clear.type = "button";
  const apply = el("button", "mainBtn", tr("find.applyFilters"));
  apply.type = "button";
  actions.append(clear, apply);
  sheet.append(actions);
  function refreshCount() {
    const n = filterCandidates(viewerDoc, candidates, readControls()).filter((d) => d.side !== viewerDoc.side).length;
    apply.textContent = tr("find.viewResults", undefined, { n });
  }
  sheet.addEventListener("change", onChange);
  const closeSheet = () => {
    wrap.remove();
    document.removeEventListener("keydown", onKey);
    opener?.focus();
  };
  const onKey = (event) => { if (event.key === "Escape") closeSheet(); };
  close.addEventListener("click", closeSheet);
  wrap.addEventListener("click", (event) => { if (event.target === wrap) closeSheet(); });
  document.addEventListener("keydown", onKey);
  clear.addEventListener("click", () => {
    filterState = { ...FILTER_DEFAULTS, types: [], ageBands: [], slots: [] };
    roleTab = "";
    closeSheet();
    renderFind(root, viewerDoc, candidates);
  });
  apply.addEventListener("click", () => {
    filterState = { ...readControls() };
    closeSheet();
    renderFind(root, viewerDoc, candidates);
  });
  wrap.append(sheet);
  document.body.append(wrap);
  refreshCount();
  close.focus();
}

// A message tap must never die silently (Difference Map
// item 12): when the contact layer is not standing, the tap
// says so in plain words.
function contactFailed() {
  const t = document.createElement("div");
  t.className = "v2Toast"; t.setAttribute("role", "status"); t.textContent = tr("contact.failed");
  document.body.append(t);
  setTimeout(() => t.remove(), 4500);
}

function trustChips(doc) {
  const card = doc.card || {};
  const chips = [];
  const vf = window.CARESITS_VERIFIED && window.CARESITS_VERIFIED[doc.uid];
  if (vf && (!vf.expiry || vf.expiry >= new Date().toISOString().slice(0, 10))) chips.push("\u2713 Verified: Blue Card");
  const ap = card.auPair;
  if (ap && ap.on) {
    chips.push("Au pair");
    if (ap.homeCountry) chips.push("From " + ap.homeCountry);
    if (ap.arrival) { const [y, m] = ap.arrival.split("-"); chips.push("Arrives " + new Date(+y, +m - 1, 1).toLocaleString("en", { month: "short", year: "numeric" })); }
    if (ap.infant) chips.push("Baby qualified");
  }
  const checks = norm(card.checksLevel || doc.checksLevel);
  if (["register", "verified", "register verified"].includes(checks)) chips.push(tr("find.trustRegister"));
  else if (["sighted", "document sighted"].includes(checks)) chips.push(tr("find.trustSighted"));
  const languages = listValue(card.languages).slice(0, 2).map((v) => LANGS.find((l) => norm(l) === norm(v)) || v);
  if (languages.length) chips.push(tr("find.trustLanguages", undefined, { n: languages.join(", ") }));
  const reply = doc.responseTime || card.responseTime || doc.replyTime || card.replyTime;
  if (reply) chips.push(tr("find.trustResponse", undefined, { n: reply }));
  return chips.slice(0, 4);
}

// The profile's own updated stamp, month and year only:
// honest about freshness without pretending to be a
// last active clock (the pool carries no activity read).
function updatedStamp(doc) {
  const u = doc && doc.updatedAt;
  if (!u) return "";
  const d = u.toDate ? u.toDate() : new Date(typeof u === "number" ? u : (u.seconds ? u.seconds * 1000 : u));
  if (!d || isNaN(d.getTime())) return "";
  return tr("find.updated", undefined, { n: d.toLocaleString("en", { month: "short", year: "numeric" }) });
}

function cardFor(entry) {
  const { doc, result, distanceKm } = entry;
  const card = el("article", "findCard");
  const head = el("div", "findHead");
  if (doc.photoUrl) {
    const img = el("img", "findPhoto");
    paintFileImg(img, doc.photoUrl);
    img.alt = "";
    head.append(img);
  } else {
    head.append(el("div", "findInitial", (doc.displayName || "?").slice(0, 1)));
  }
  const who = el("div", "findWho");
  who.append(el("h3", "findName", doc.displayName || tr("find.member")));
  // The face, in the industry order (Difference Map item 7):
  // the role in its place first, then where, then the stamp.
  const card0 = doc.card || {};
  const roles0 = listValue(card0.roles || card0.role);
  const place0 = doc.postcode || card0.postcode || "";
  if (doc.side === "carer" && roles0.length && place0) who.append(el("p", "findRoleLine", tr("find.roleIn", undefined, { role: roles0[0], place: place0 })));
  else if (doc.side === "family" && place0) who.append(el("p", "findRoleLine", tr("find.lookingIn", undefined, { place: place0 })));
  const place = [doc.postcode ? tr("find.postcode", undefined, { n: doc.postcode }) : null, distanceKm != null ? tr("find.away", undefined, { n: distanceKm }) : null].filter(Boolean).join(" · ");
  who.append(el("p", "findPlace", place));
  const stamp = updatedStamp(doc);
  if (stamp) who.append(el("p", "findUpdated", stamp));
  head.append(who);
  if (window.CARESITS_V2 && window.CARESITS_V2.heartButton && doc.uid) head.append(window.CARESITS_V2.heartButton(doc.uid));
  card.append(head);
  if (doc.about) card.append(el("p", "v2About", doc.about));
  // The face facts (Difference Map item 7): a carer's
  // experience in years, a family's children by age band,
  // and the honest rate. Stars ride in only when reviews
  // the app itself loaded say so, never from the card.
  if (doc.side === "carer") {
    const years = Object.values(card0.experience || {}).map(Number).filter(Number.isFinite);
    if (years.length) card.append(el("p", "findExpLine", tr(Math.max(...years) === 1 ? "find.expOneLine" : "find.expLine", undefined, { n: Math.max(...years) })));
  } else {
    // The children count first when the published card
    // carries it (the sealed rules admit no count key yet,
    // so the line stands ready), then the age bands.
    if (card0.childrenCount) card.append(el("p", "findExpLine", tr("find.childrenLine", undefined, { n: card0.childrenCount })));
    const bands = listValue(card0.childrenBands);
    if (bands.length) card.append(el("p", "findExpLine", tr("find.detailChildren", undefined, { n: bands.join(", ") })));
  }
  const rate0 = Number(doc.side === "carer" ? card0.payFloor : card0.payOffered);
  if (Number.isFinite(rate0) && rate0 > 0) card.append(el("p", "findRate", tr("find.filterCurrency", undefined, { n: rate0 })));
  const starsSlot = el("p", "findStars");
  starsSlot.hidden = true;
  card.append(starsSlot);
  if (doc.uid && window.CARESITS_V2 && typeof window.CARESITS_V2.loadReviews === "function") {
    window.CARESITS_V2.loadReviews(doc.uid).then((list) => {
      if (!Array.isArray(list) || !list.length) return;
      const avg = list.reduce((s, r) => s + (r.stars || 0), 0) / list.length;
      if (!(avg > 0)) return;
      starsSlot.textContent = tr("find.starsLine", undefined, { s: "★".repeat(Math.max(1, Math.round(avg))), a: avg.toFixed(1), n: list.length });
      starsSlot.hidden = false;
    }).catch(() => { /* no stars is the honest empty state */ });
  }
  const trust = trustChips(doc);
  if (trust.length) {
    const row = el("div", "trustRow");
    for (const text of trust) row.append(el("span", "trustChip", text));
    card.append(row);
  }
  const gallery = doc.card && Array.isArray(doc.card.gallery) ? doc.card.gallery.filter((u) => typeof u === "string" && u).slice(0, 4) : [];
  if (gallery.length) {
    const row = el("div", "galleryThumbs");
    for (const u of gallery) {
      const im = el("img", "galleryThumbSm");
      paintFileImg(im, u);
      im.alt = "";
      row.append(im);
    }
    card.append(row);
  }
  if (result.personal === false) {
    card.append(el("p", "findInvite", tr("find.invite")));
  } else {
    const fit = el("p", "findFit");
    fit.append(el("span", "fitChip", labelText(result.label)));
    fit.append(el("span", "fitScore", tr("find.pairFit", undefined, { n: result.pair })));
    card.append(fit);
  }
  const reasons = [...(result.reasons || []).slice(0, 3).map((r, i) => reasonText(result, r, i)), ...(result.learningReasons || []).map(learningReasonText)].filter(Boolean);
  if (reasons.length) {
    card.append(el("h4", "findWhyHeading", tr("find.whyMatch")));
    const ul = el("ul", "findReasons");
    for (const reason of reasons) ul.append(el("li", null, reason));
    card.append(ul);
  }
  if (result.qualifier) card.append(el("p", "qualLine", qualText(result.qualifier)));
  // "See details" opens the real profile page now
  // (profile-view.js, Difference Map item 8): the expanded
  // footnote this button used to toggle is gone, replaced
  // by the page it always pointed at in spirit.
  const actions = el("div", "findActions");
  const detailsButton = el("button", "ghostBtn findDetailsBtn", tr("find.details"));
  detailsButton.type = "button";
  detailsButton.addEventListener("click", () => openProfile(doc));
  const messageButton = el("button", "mainBtn findMsg", tr("find.message"));
  messageButton.type = "button";
  messageButton.addEventListener("click", () => {
    if (typeof window.CARESITS_CONTACT === "function") window.CARESITS_CONTACT(doc.uid || "", doc);
    else contactFailed();
  });
  actions.append(detailsButton, messageButton);
  card.append(actions);
  const quiet = el("div", "quietRow");
  const rep = el("button", "quietBtn", tr("find.report"));
  rep.type = "button";
  rep.addEventListener("click", () => window.CARESITS_REPORT?.(doc.uid || "", { surface: "card", snapshot: { items: ["card"], text: reasons.join(" "), title: doc.displayName || "Profile card" } }));
  const blk = el("button", "quietBtn", tr("find.block"));
  blk.type = "button";
  blk.addEventListener("click", () => window.CARESITS_BLOCK?.(doc.uid || "", card));
  quiet.append(rep, blk);
  card.append(quiet);
  return card;
}

function mapCardFor(doc, entry, viewerLevel, distanceKm) {
  const card = el("article", "findCard mapCard");
  const who = el("div", "findWho");
  who.append(el("h3", "findName", doc.displayName || tr("find.member")));
  who.append(el("p", "findPlace", [doc.postcode ? tr("find.postcode", undefined, { n: doc.postcode }) : null, distanceKm != null ? tr("find.away", undefined, { n: distanceKm }) : null].filter(Boolean).join(" · ")));
  card.append(who);
  if (!entry || entry.result.personal === false) {
    card.append(el("p", null, tr("find.invite")));
  } else {
    const pct = el("p", "findFit");
    pct.append(el("span", "fitChip", labelText(entry.result.label)));
    pct.append(el("span", "fitScore mapPct", tr("find.matchPct", undefined, { n: entry.result.pair })));
    card.append(pct);
    const ul = el("ul", "findReasons");
    (entry.result.reasons || []).slice(0, 3).forEach((r, i) => ul.append(el("li", null, reasonText(entry.result, r, i))));
    (entry.result.learningReasons || []).forEach((reason) => ul.append(el("li", "learningMatchReason", learningReasonText(reason))));
    card.append(ul);
    if (entry.result.qualifier) card.append(el("p", "qualLine", qualText(entry.result.qualifier)));
  }
  // The pin's card is not a dead end any more (Difference
  // Map item 5): it carries the same two ways forward as a
  // list card, the profile page and the message.
  const actions = el("div", "findActions");
  const detailsButton = el("button", "ghostBtn findDetailsBtn", tr("find.details"));
  detailsButton.type = "button";
  detailsButton.addEventListener("click", () => openProfile(doc));
  const messageButton = el("button", "mainBtn findMsg", tr("find.message"));
  messageButton.type = "button";
  messageButton.addEventListener("click", () => {
    if (typeof window.CARESITS_CONTACT === "function") window.CARESITS_CONTACT(doc.uid || "", doc);
    else contactFailed();
  });
  actions.append(detailsButton, messageButton);
  card.append(actions);
  return card;
}

function mapSection(viewerDoc, candidateDocs, browse) {
  const wrap = el("div", "mapWrap");
  const panel = el("div", "mapPanel");
  panel.setAttribute("aria-label", tr("find.mapAria"));
  const byUid = new Map();
  if (browse) for (const e of [...browse.top, ...browse.more]) byUid.set(e.doc.uid || e.doc.displayName, e);
  // ONE POOL, TWO VIEWS (Difference Map item 5): when the
  // assembled browse exists, the pins are drawn from exactly
  // the entries the list shows, exclusions included (a swept
  // carer is on neither). Only the signed out sketch, which
  // has no assembled browse, falls back to the raw pool.
  const entries = browse
    ? [...browse.top, ...browse.more].map((e) => ({ doc: e.doc, result: e.result }))
    : candidateDocs.filter((d) => d.side !== (viewerDoc?.side || "family")).map((doc) => ({ doc, result: null }));
  const pins = pinLayout(viewerDoc?.card || null, entries);
  const slot = el("div", "mapSlot");
  const V2 = window.CARESITS_V2;
  const pts = entries.map((e) => e.doc).filter((d) => d.card && d.card.latE2 != null && d.card.lngE2 != null)
    .map((d) => ({ uid: d.uid || d.displayName, name: d.displayName || "Member", lat: d.card.latE2 / 100, lng: d.card.lngE2 / 100, doc: d }));
  if (V2 && V2.leafletMap && window.L && pts.length) {
    const vc = viewerDoc && viewerDoc.card && viewerDoc.card.latE2 != null ? { lat: viewerDoc.card.latE2 / 100, lng: viewerDoc.card.lngE2 / 100 } : null;
    const ok = V2.leafletMap(panel, pts, vc, (p) => {
      const entry = byUid.get(p.uid) || null;
      const km = viewerDoc ? kmBetween(viewerDoc.card || {}, p.doc.card || {}) : null;
      slot.replaceChildren(mapCardFor(p.doc, entry, viewerDoc?.level, km));
    });
    if (ok) { panel.classList.add("v2Real"); wrap.append(panel, slot); return wrap; }
  }
  for (const p of pins) {
    const doc = entries.find((e) => (e.doc.uid || e.doc.displayName) === p.uid).doc;
    const pin = el("button", "mapPin", (doc.displayName || "?").slice(0, 1));
    pin.type = "button";
    pin.style.left = p.x + "%";
    pin.style.top = p.y + "%";
    pin.setAttribute("aria-label", (doc.displayName || tr("find.member")) + (doc.postcode ? ", " + tr("find.postcode", undefined, { n: doc.postcode }) : ""));
    pin.addEventListener("click", () => {
      const entry = byUid.get(doc.uid || doc.displayName) || null;
      const km = viewerDoc ? kmBetween(viewerDoc.card || {}, doc.card || {}) : null;
      slot.replaceChildren(mapCardFor(doc, entry, viewerDoc?.level, km));
    });
    panel.append(pin);
  }
  if (!pins.length) panel.append(el("p", "mapEmpty", tr("find.mapEmpty")));
  panel.append(el("p", "mapNote", tr("find.mapNote")));
  wrap.append(panel, slot);
  return wrap;
}

const excludedUids = new Set();
let showSaved = false;
let lastRender = null;
export function renderFind(root, viewerDoc, candidateDocs) {
  lastRender = { root, viewerDoc, candidateDocs };
  const owner = viewerDoc?.uid || null;
  if (owner !== filterOwner) {
    filterOwner = owner;
    filterState = { ...FILTER_DEFAULTS, types: [], ageBands: [], slots: [] };
    roleTab = "";
  }
  const favNow = window.CARESITS_V2 && window.CARESITS_V2.favs ? window.CARESITS_V2.favs() : new Set();
  const visibleCandidates = candidateDocs.filter((d) => !excludedUids.has(d.uid || d.displayName) && (!showSaved || favNow.has(d.uid)));
  // The au pair world has its own Find (aupair-find.js); the nanny Find
  // never lists au pair or host cards, and the reverse.
  if (viewerDoc && viewerIsAuPairWorld(viewerDoc)) { renderAuPairFind(root, viewerDoc, visibleCandidates); return; }
  for (let i = visibleCandidates.length - 1; i >= 0; i -= 1) if (viewerIsAuPairWorld(visibleCandidates[i])) visibleCandidates.splice(i, 1);
  root.replaceChildren();
  const isCarerView = (viewerDoc && viewerDoc.side === "carer") || (!viewerDoc && window.CARESITS_V2 && window.CARESITS_V2.role() === "career");
  root.append(el("h2", "findTitle", isCarerView ? "Jobs" : tr("shell.find")));
  // The search pill and the role tabs (Difference Map item
  // 11), the finding side's shape: one pill that names the
  // member's own area and opens the filters, and the three
  // directories. Jobs is the board, where families post.
  if (viewerDoc && viewerDoc.side === "family") {
    const pill = el("button", "findSearchPill", viewerDoc.postcode ? tr("find.postcode", undefined, { n: viewerDoc.postcode }) : tr("find.setArea"));
    pill.type = "button";
    pill.setAttribute("aria-haspopup", "dialog");
    pill.addEventListener("click", () => openFilterSheet(root, viewerDoc, visibleCandidates, pill));
    root.append(pill);
    const tabs = el("div", "findRoleTabs");
    for (const [value, key] of [["Babysitter", "find.tabBabysitters"], ["Nanny", "find.tabNannies"]]) {
      const tab = el("button", "chip findRoleTab" + (roleTab === value ? " on" : ""), tr(key));
      tab.type = "button";
      tab.setAttribute("aria-pressed", String(roleTab === value));
      tab.addEventListener("click", () => { roleTab = roleTab === value ? "" : value; renderFind(root, viewerDoc, candidateDocs); });
      tabs.append(tab);
    }
    const jobs = el("button", "chip findRoleTab", tr("find.tabJobs"));
    jobs.type = "button";
    jobs.addEventListener("click", () => window.CARESITS_NAV?.("board"));
    tabs.append(jobs);
    root.append(tabs);
  }
  if (window.CARESITS_V2) window.CARESITS_V2.composer(root, viewerDoc || null);
  if (!viewerDoc) {
    const box = el("div", "cardIn");
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-rest-calm.png";
    img.alt = tr("find.bunnyRest");
    box.append(img, el("h3", null, isCarerView ? "Finish your profile to see families" : tr("find.waitTitle")), el("p", null, isCarerView ? "Answer a few questions and we line up families who need what you offer. Looking around costs nothing, always." : tr("find.waitBody")));
    const go = el("button", "mainBtn", tr("find.startQ"));
    go.type = "button";
    go.addEventListener("click", () => document.querySelector('[data-nav="questionnaire"]')?.click());
    box.append(go);
    root.append(box);
    root.append(el("h3", "findNearlyTitle", isCarerView ? "Families near you" : tr("find.nearYou")));
    root.append(mapSection(null, visibleCandidates, null));
    return;
  }
  const filteredCandidates = filterCandidates(viewerDoc, visibleCandidates);
  const b = assembleBrowse(viewerDoc, filteredCandidates);
  const poolWord = viewerDoc.side === "family"
    ? (b.poolCount === 1 ? tr("find.pool.carer1") : tr("find.pool.carerN", undefined, { n: b.poolCount }))
    : (b.poolCount === 1 ? tr("find.pool.family1") : tr("find.pool.familyN", undefined, { n: b.poolCount }));
  const matchWord = b.shownCount === 1 ? tr("find.pool.match1") : tr("find.pool.matchN", undefined, { n: b.shownCount });
  root.append(el("p", "findPool", poolWord + " · " + matchWord));
  // The order of the list (Difference Map items 6 and 9):
  // the engine's chain stands by default; the member's saved
  // need lifts the people who cover more of it; a sort the
  // member picked in the filter sheet wins over both.
  const need = viewerNeed(viewerDoc);
  let ordered = [...b.top, ...b.more];
  if (filterState.sortBy === "nearest") ordered = ordered.map((e, i) => [e, i]).sort((a, z) => ((a[0].distanceKm ?? 1e9) - (z[0].distanceKm ?? 1e9)) || (a[1] - z[1])).map(([e]) => e);
  else if (filterState.sortBy === "reply") ordered = ordered.map((e, i) => [e, i]).sort((a, z) => (((a[0].carer?.replyHours ?? a[0].result?.replyHours ?? 999)) - ((z[0].carer?.replyHours ?? z[0].result?.replyHours ?? 999))) || (a[1] - z[1])).map(([e]) => e);
  else if (filterState.sortBy === "worked") ordered = ordered.map((e, i) => [e, i]).sort((a, z) => (Number(z[0].usedBefore || z[0].result?.usedBefore || false) - Number(a[0].usedBefore || a[0].result?.usedBefore || false)) || (a[1] - z[1])).map(([e]) => e);
  else if (need && (need.days.length || need.dates.length || (need.kinds || []).length)) ordered = ordered.map((e, i) => [e, i]).sort((a, z) => (needCover(z[0].doc.card || {}, viewerDoc, need) - needCover(a[0].doc.card || {}, viewerDoc, need)) || (a[1] - z[1])).map(([e]) => e);
  const orderedTop = ordered.slice(0, 5);
  const orderedMore = ordered.slice(5);
  if (need && (need.days.length || need.dates.length || (need.kinds || []).length || need.needFreq || need.needUrgency || need.carePlace)) {
    const bits = [...(need.kinds || []), ...need.days];
    if (need.dates.length) bits.push(need.dates.length === 1 ? need.dates[0] : need.dates.length + " dates");
    if (need.needFreq) bits.push(need.needFreq);
    if (need.needUrgency) bits.push(need.needUrgency);
    if (need.carePlace) bits.push(need.carePlace);
    root.append(el("p", "findNeedLine", tr("find.fromNeed", undefined, { n: bits.join(" · ") })));
  }
  root.append(el("p", "findSort", filterState.sortBy !== "match"
    ? tr("find.sortChosen", undefined, { n: tr("find.sort" + filterState.sortBy.charAt(0).toUpperCase() + filterState.sortBy.slice(1)) })
    : tr("find.sortLine")));
  const toolbar = el("div", "findToolbar");
  const filterCount = activeFilterCount();
  const filterButton = el("button", "ghostBtn findFilterOpen", filterCount ? tr("find.filtersCount", undefined, { n: filterCount }) : tr("find.filters"));
  filterButton.type = "button";
  filterButton.setAttribute("aria-haspopup", "dialog");
  filterButton.addEventListener("click", () => openFilterSheet(root, viewerDoc, visibleCandidates, filterButton));
  const savedBtn = el("button", "ghostBtn v2SavedBtn" + (showSaved ? " on" : ""), showSaved ? "\u2665 Saved (on)" : "\u2661 Saved");
  savedBtn.type = "button";
  savedBtn.addEventListener("click", () => { showSaved = !showSaved; renderFind(root, viewerDoc, candidateDocs); });
  toolbar.append(savedBtn, filterButton);
  root.append(toolbar);
  if (filterCount) {
    const FILTER_CHIP_LABELS = { sortBy: () => tr("find.sortBy") + ": " + tr("find.sort" + filterState.sortBy.charAt(0).toUpperCase() + filterState.sortBy.slice(1)), types: () => tr("find.filterTypes") + ": " + filterState.types.join(", "), distanceKm: () => tr("find.filterDistance"), language: () => tr("find.filterLanguage"), ageBands: () => tr(viewerDoc.side === "family" ? "find.filterCarerAges" : "find.filterChildAges") + ": " + filterState.ageBands.join(", "), slots: () => tr("find.filterAvail"), verifiedOnly: () => tr("find.filterChecks"), pets: () => tr("find.filterPets"), auPairInfant: () => "Au pair: can care for babies", auPairEnglish: () => "Au pair: English at least", auPairArrive: () => "Au pair: can arrive by", expYears: () => tr("find.filterExperience") + ": " + filterState.expYears, maxPay: () => tr(viewerDoc.side === "family" ? "find.filterMaxPay" : "find.filterMinPay"), transport: () => tr("find.filterTransport") };
    const chipsRow = el("div", "findActiveChips");
    if (roleTab) {
      const chip = el("span", "findChip", roleTab + "  ");
      const x = el("button", "findChipX", "×");
      x.type = "button";
      x.setAttribute("aria-label", tr("find.removeFilter"));
      x.addEventListener("click", () => { roleTab = ""; renderFind(root, viewerDoc, candidateDocs); });
      chip.append(x);
      chipsRow.append(chip);
    }
    for (const key of Object.keys(FILTER_DEFAULTS)) {
      const v = filterState[key];
      const active = Array.isArray(v) ? v.length > 0 : key === "sortBy" ? v !== "match" : key === "expYears" ? Number(v) > 0 : Boolean(v);
      if (!active) continue;
      const chip = el("span", "findChip", (FILTER_CHIP_LABELS[key] ? FILTER_CHIP_LABELS[key]() : key) + (typeof v === "string" && v && !FILTER_CHIP_LABELS[key] ? ": " + v : "") + "  ");
      const x = el("button", "findChipX", "×");
      x.type = "button";
      x.setAttribute("aria-label", tr("find.removeFilter"));
      x.addEventListener("click", () => { filterState = { ...filterState, [key]: Array.isArray(FILTER_DEFAULTS[key]) ? [] : FILTER_DEFAULTS[key] }; renderFind(root, viewerDoc, candidateDocs); });
      chip.append(x);
      chipsRow.append(chip);
    }
    root.append(chipsRow);
  }
  const toggle = el("div", "viewToggle");
  const listBtn = el("button", "chip on", tr("find.list"));
  const mapBtn = el("button", "chip", tr("find.map"));
  listBtn.type = "button"; mapBtn.type = "button";
  const mapWrap = mapSection(viewerDoc, filteredCandidates, b);
  mapWrap.hidden = true;
  listBtn.addEventListener("click", () => { mapWrap.hidden = true; listBtn.classList.add("on"); mapBtn.classList.remove("on"); });
  mapBtn.addEventListener("click", () => { mapWrap.hidden = false; mapBtn.classList.add("on"); listBtn.classList.remove("on"); });
  toggle.append(listBtn, mapBtn);
  root.append(toggle, mapWrap);
  if (b.shownCount === 0) {
    const box = el("div", "cardIn");
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-rest-calm.png";
    img.alt = tr("find.bunnyRest");
    box.append(img, el("h3", null, tr("find.noneTitle")), el("p", null, tr("find.noneBody")));
    const actionText = filterCount ? tr("find.clearFilters") : viewerDoc.side === "family" ? tr("find.emptyUrgent") : tr("find.emptyWiden");
    const action = el("button", "mainBtn findEmptyAction", actionText);
    action.type = "button";
    action.addEventListener("click", () => {
      if (filterCount) {
        filterState = { ...FILTER_DEFAULTS };
        renderFind(root, viewerDoc, candidateDocs);
      } else if (viewerDoc.side === "family") {
        window.CARESITS_NAV?.("board");
      } else {
        openFilterSheet(root, viewerDoc, visibleCandidates, filterButton);
      }
    });
    box.append(action);
    root.append(box);
  }
  const list = el("div", "findList");
  for (const e of orderedTop) list.append(cardFor(e));
  root.append(list);
  if (orderedMore.length) {
    const moreBox = el("div", "findList");
    moreBox.hidden = true;
    for (const e of orderedMore) moreBox.append(cardFor(e));
    const btn = el("button", "mainBtn findMore", tr("find.more"));
    btn.type = "button";
    btn.addEventListener("click", () => { moreBox.hidden = false; btn.remove(); });
    root.append(btn, moreBox);
  }
  if (b.nearly.length) {
    root.append(el("h3", "findNearlyTitle", tr("find.nearlyTitle")));
    root.append(el("p", "findNearlyNote", tr("find.nearlyNote")));
    const nl = el("div", "findList");
    for (const nItem of b.nearly) {
      const c = el("article", "findCard nearly");
      const head = el("div", "findHead");
      if (nItem.doc.photoUrl) {
        const photo = el("img", "findPhoto");
        paintFileImg(photo, nItem.doc.photoUrl);
        photo.alt = "";
        head.append(photo);
      } else head.append(el("div", "findInitial", (nItem.doc.displayName || "?").slice(0, 1)));
      const who = el("div", "findWho");
      who.append(el("h3", "findName", nItem.doc.displayName || tr("find.member")));
      who.append(el("p", "findPlace", nItem.doc.postcode ? tr("find.postcode", undefined, { n: nItem.doc.postcode }) : ""));
      head.append(who);
      c.append(head);
      const trust = trustChips(nItem.doc);
      if (trust.length) {
        const chips = el("div", "trustRow");
        for (const text of trust) chips.append(el("span", "trustChip", text));
        c.append(chips);
      }
      c.append(el("p", "findGate", tr("find.gateLine", undefined, { g: gateText(nItem) })));
      nl.append(c);
    }
    root.append(nl);
  }
}

// The pool fetch, shared by Find's own cold path and the
// shell's warm Phase C publication (QA b110 FLAGREAD): the
// viewer's stitched card plus every candidate's, from the
// live documents. A viewer with no card yet reads as null —
// the waiting state is for them, and only them.
export async function fetchFindData(fsMod, db, uid) {
  const mine = await fsMod.getDoc(fsMod.doc(db, "profiles", uid));
  if (!mine.exists()) return { viewer: null, candidates: [] };
  const withAnswers = async (id, data) => {
    const aSnap = await fsMod.getDocs(fsMod.collection(db, "profiles", id, "answers"));
    const docs = [];
    aSnap.forEach((d) => docs.push({ code: d.id, data: d.data() }));
    const doc = stitchAnswers({ uid: id, ...data }, docs);
    // Area coordinates ride the card from the save; a card
    // saved before they did derives them here from its
    // postcode, so the map and the distance read every
    // member by the same area truth (Polar C1).
    const card = doc.card;
    if (card && card.latE2 == null) {
      const a = areaCoordsFor(card.postcode || doc.postcode || "");
      if (a) { card.latE2 = a.latE2; card.lngE2 = a.lngE2; }
    }
    return doc;
  };
  const viewer = await withAnswers(uid, mine.data());
  // Scale: ask only for people in the same region (first two digits of the
  // postcode), the other side, 40 at most. Few people yet? widen to anyone.
  const mineData = mine.data();
  const pc = String(mineData.postcode || (mineData.card && mineData.card.postcode) || "").replace(/\D/g, "");
  const wantSide = mineData.side === "family" ? "carer" : "family";
  const ok = (d) => d.id !== uid && (d.data().side || wantSide) !== mineData.side;
  let docs = [];
  if (pc.length >= 2) {
    const lo = pc.slice(0, 2);
    try {
      const q = await fsMod.getDocs(fsMod.query(fsMod.collection(db, "profiles"), fsMod.where("postcode", ">=", lo), fsMod.where("postcode", "<", lo + "\uffff"), fsMod.limit(120)));
      docs = q.docs.filter(ok);
    } catch { docs = []; }
  }
  if (docs.length < 5) {
    const all = await fsMod.getDocs(fsMod.query(fsMod.collection(db, "profiles"), fsMod.limit(100)));
    docs = all.docs.filter(ok);
  }
  docs = docs.slice(0, 40);
  const candidates = await Promise.all(docs.map((d) => withAnswers(d.id, d.data())));
  return { viewer, candidates };
}

async function bootFind() {
  const root = document.getElementById("findRoot");
  if (!root) return;
  if (window.CARESITS_FIND_DATA) {
    renderFind(root, window.CARESITS_FIND_DATA.viewer, window.CARESITS_FIND_DATA.candidates || []);
    return;
  }
  try {
    const cfgMod = await import("./firebase-config.js");
    const appMod = await import("../accounts/sdk/firebase-app.js");
    const authMod = await import("../accounts/sdk/firebase-auth.js");
    const fsMod = await import("../accounts/sdk/firebase-firestore.js");
    // The DEFAULT app only, shared with the door: a named app carries
    // its own auth session and would never see the signed-in user (R1).
    const app = appMod.getApps().find((a) => a.name === "[DEFAULT]") || appMod.initializeApp(cfgMod.firebaseConfig);
    // The same frame rule as the journey save (QA b104 ROOT A):
    // judge the user after the session restore settles, never
    // on a synchronous read in a still-restoring frame.
    const user = await frameUser((await import("./auth-shared.js")).sharedAuth(authMod, app));
    if (!user || user.isAnonymous) { renderFind(root, null, []); return; }
    const db = fsMod.getFirestore(app);
    const fd = await fetchFindData(fsMod, db, user.uid);
    renderFind(root, fd.viewer, fd.candidates);
  } catch {
    renderFind(root, null, []);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootFind);
  else bootFind();
}

window.CARESITS_EXCLUDE = (uid) => { excludedUids.add(uid); if (lastRender) renderFind(lastRender.root, lastRender.viewerDoc, lastRender.candidateDocs); };
// The shell's warm boot publishes CARESITS_FIND_DATA after
// this module's cold first pass; the re-render hook lets
// that publication replace the cold judgement in place.
window.CARESITS_FIND_RENDER = () => bootFind();
