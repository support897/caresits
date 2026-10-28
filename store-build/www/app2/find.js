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
import { LANGS, BANDS, DAYS } from "./questions.js";
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

const FILTER_DEFAULTS = { distanceKm: "", language: "", ageBand: "", day: "", verifiedOnly: false, auPairOnly: false, auPairInfant: false, auPairEnglish: "", auPairArrive: "", experienceYears: "", maxPay: "", transport: "", pets: "" };
let filterState = { ...FILTER_DEFAULTS };
let filterOwner = null;
let moreFiltersOpen = false;
const norm = (value) => String(value ?? "").trim().toLowerCase();
const activeFilterCount = () => Object.entries(filterState).filter(([k, v]) => v !== "" && v !== false).length;
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

function filterCandidates(viewerDoc, candidateDocs) {
  const familyViewer = viewerDoc.side === "family";
  return candidateDocs.filter((doc) => {
    if (doc.side === viewerDoc.side) return true;
    const card = doc.card || {};
    if (filterState.distanceKm) {
      const km = kmBetween(viewerDoc.card || {}, card);
      if (km == null || km > Number(filterState.distanceKm)) return false;
    }
    if (filterState.language) {
      const languages = listValue(card.languages).map(norm);
      if (!languages.includes(norm(filterState.language))) return false;
    }
    if (filterState.ageBand) {
      const ages = listValue(familyViewer ? (card.agesAccepted || card.agesPreferred) : card.childrenBands).map(norm);
      if (!ages.includes(norm(filterState.ageBand))) return false;
    }
    if (filterState.day && !dayAvailable(card, filterState.day, viewerDoc.side)) return false;
    if (filterState.verifiedOnly) {
      const checks = norm(card.checksLevel || doc.checksLevel);
      if (!(["register", "sighted", "verified", "register verified", "document sighted"].includes(checks))) return false;
    }
    if (familyViewer && (filterState.auPairOnly || filterState.auPairInfant || filterState.auPairEnglish || filterState.auPairArrive)) {
      const ap = card.auPair || {};
      if (!ap.on) return false;
      if (filterState.auPairInfant && !ap.infant) return false;
      if (filterState.auPairEnglish && ["Basic", "Good", "Fluent"].indexOf(ap.english) < ["Basic", "Good", "Fluent"].indexOf(filterState.auPairEnglish)) return false;
      if (filterState.auPairArrive && (!ap.arrival || ap.arrival > filterState.auPairArrive)) return false;
    }
    if (filterState.experienceYears) {
      const years = Object.values(card.experience || {}).map(Number).filter(Number.isFinite);
      if (!years.length || Math.max(...years) < Number(filterState.experienceYears)) return false;
    }
    if (filterState.maxPay) {
      const amount = Number(familyViewer ? card.payFloor : card.payOffered);
      if (!Number.isFinite(amount) || amount <= 0 || (familyViewer ? amount > Number(filterState.maxPay) : amount < Number(filterState.maxPay))) return false;
    }
    if (filterState.transport && familyViewer) {
      if (filterState.transport === "drive" && !card.drives && !card.ownCar) return false;
      if (filterState.transport === "ownCar" && !card.ownCar) return false;
    }
    if (filterState.pets && !familyViewer) {
      if (filterState.pets === "pets" && !card.pets) return false;
      if (filterState.pets === "noPets" && card.pets) return false;
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
  const basic = el("div", "findFilterGrid");
  const any = [["", tr("find.filterAny")]];
  filterSelect(basic, controls, "distanceKm", tr("find.filterDistance"), [...any, ...[5, 10, 25, 50, 100].map((n) => [String(n), tr("find.filterKm", undefined, { n })])], filterState.distanceKm);
  filterSelect(basic, controls, "language", tr("find.filterLanguage"), [...any, ...LANGS.map((v) => [v, v])], filterState.language);
  filterSelect(basic, controls, "ageBand", tr(viewerDoc.side === "family" ? "find.filterCarerAges" : "find.filterChildAges"), [...any, ...BANDS.map((v) => [v, v])], filterState.ageBand);
  filterSelect(basic, controls, "day", tr("find.filterDay"), [...any, ...DAYS.map((d) => [d, tr("journey.day." + d)])], filterState.day);
  if (viewerDoc.side === "family") filterCheck(basic, controls, "verifiedOnly", tr("find.filterChecks"), filterState.verifiedOnly);
  else filterSelect(basic, controls, "pets", tr("find.filterPets"), [...any, ["pets", tr("find.filterPetsYes")], ["noPets", tr("find.filterPetsNo")]], filterState.pets);
  sheet.append(basic);
  const moreButton = el("button", "quietBtn findMoreFilters", tr(moreFiltersOpen ? "find.lessFilters" : "find.moreFilters"));
  moreButton.type = "button";
  moreButton.setAttribute("aria-expanded", String(moreFiltersOpen));
  const extra = el("div", "findFilterGrid findExtraFilters");
  extra.hidden = !moreFiltersOpen;
  if (viewerDoc.side === "family") {
    filterCheck(extra, controls, "auPairOnly", "Au pairs only", filterState.auPairOnly);
    filterCheck(extra, controls, "auPairInfant", "Au pair: can care for babies", filterState.auPairInfant);
    filterSelect(extra, controls, "auPairEnglish", "Au pair: English at least", [...any, ["Basic", "Basic"], ["Good", "Good"], ["Fluent", "Fluent"]], filterState.auPairEnglish);
    filterSelect(extra, controls, "auPairArrive", "Au pair: can arrive by", [...any, ...Array.from({ length: 12 }, (_, i) => { const d = new Date(new Date().getFullYear(), new Date().getMonth() + i, 1); return [d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), d.toLocaleString("en", { month: "short", year: "numeric" })]; })], filterState.auPairArrive);
    filterSelect(extra, controls, "experienceYears", tr("find.filterExperience"), [...any, ...[1, 3, 5, 10].map((n) => [String(n), n === 1 ? tr("find.filterOneYear") : tr("find.filterYears", undefined, { n })])], filterState.experienceYears);
    filterSelect(extra, controls, "maxPay", tr("find.filterMaxPay"), [...any, ...[20, 25, 30, 40, 50].map((n) => [String(n), tr("find.filterCurrency", undefined, { n })])], filterState.maxPay);
    filterSelect(extra, controls, "transport", tr("find.filterTransport"), [...any, ["drive", tr("find.filterDrive")], ["ownCar", tr("find.filterOwnCar")]], filterState.transport);
  } else {
    filterSelect(extra, controls, "maxPay", tr("find.filterMinPay"), [...any, ...[18, 20, 25, 30, 40].map((n) => [String(n), tr("find.filterCurrency", undefined, { n })])], filterState.maxPay);
  }
  sheet.append(moreButton, extra);
  moreButton.addEventListener("click", () => {
    moreFiltersOpen = !moreFiltersOpen;
    extra.hidden = !moreFiltersOpen;
    moreButton.setAttribute("aria-expanded", String(moreFiltersOpen));
    moreButton.textContent = tr(moreFiltersOpen ? "find.lessFilters" : "find.moreFilters");
  });
  const actions = el("div", "findFilterActions");
  const clear = el("button", "quietBtn", tr("find.clearFilters"));
  clear.type = "button";
  const apply = el("button", "mainBtn", tr("find.applyFilters"));
  apply.type = "button";
  actions.append(clear, apply);
  sheet.append(actions);
  const closeSheet = () => {
    wrap.remove();
    document.removeEventListener("keydown", onKey);
    opener?.focus();
  };
  const onKey = (event) => { if (event.key === "Escape") closeSheet(); };
  close.addEventListener("click", closeSheet);
  wrap.addEventListener("click", (event) => { if (event.target === wrap) closeSheet(); });
  document.addEventListener("keydown", onKey);
  const readControls = () => {
    filterState = { ...FILTER_DEFAULTS };
    for (const [key, input] of Object.entries(controls)) filterState[key] = input.type === "checkbox" ? input.checked : input.value;
  };
  clear.addEventListener("click", () => {
    filterState = { ...FILTER_DEFAULTS };
    moreFiltersOpen = false;
    closeSheet();
    renderFind(root, viewerDoc, candidates);
  });
  apply.addEventListener("click", () => {
    readControls();
    closeSheet();
    renderFind(root, viewerDoc, candidates);
  });
  wrap.append(sheet);
  document.body.append(wrap);
  close.focus();
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

function detailLines(doc) {
  const card = doc.card || {};
  const lines = [];
  const roles = listValue(card.roles || card.role);
  if (roles.length) lines.push(tr("find.detailRoles", undefined, { n: roles.join(", ") }));
  const languages = listValue(card.languages).slice(0, 4).map((v) => LANGS.find((l) => norm(l) === norm(v)) || v);
  if (languages.length) lines.push(tr("find.detailLanguages", undefined, { n: languages.join(", ") }));
  const ages = listValue(card.agesAccepted || card.agesPreferred);
  if (ages.length) lines.push(tr("find.detailAges", undefined, { n: ages.join(", ") }));
  if (card.checksLevel) lines.push(tr("find.detailChecks", undefined, { n: card.checksLevel === "register" ? tr("find.trustRegister") : card.checksLevel === "sighted" ? tr("find.trustSighted") : card.checksLevel }));
  const availability = DAYS.filter((day) => dayAvailable(card, day, doc.side === "carer" ? "family" : "carer"));
  if (availability.length) lines.push(tr("find.detailAvailability", undefined, { n: availability.map((day) => tr("journey.day." + day) === "journey.day." + day ? day : tr("journey.day." + day)).join(", ") }));
  if (card.age) lines.push(tr("find.detailAge", undefined, { n: card.age }));
  return lines;
}

function cardFor(entry) {
  const { doc, result, distanceKm } = entry;
  const card = el("article", "findCard");
  const head = el("div", "findHead");
  if (doc.photoUrl) {
    const img = el("img", "findPhoto");
    img.src = doc.photoUrl;
    img.alt = "";
    head.append(img);
  } else {
    head.append(el("div", "findInitial", (doc.displayName || "?").slice(0, 1)));
  }
  const who = el("div", "findWho");
  who.append(el("h3", "findName", doc.displayName || tr("find.member")));
  const place = [doc.postcode ? tr("find.postcode", undefined, { n: doc.postcode }) : null, distanceKm != null ? tr("find.away", undefined, { n: distanceKm }) : null].filter(Boolean).join(" · ");
  who.append(el("p", "findPlace", place));
  head.append(who);
  if (window.CARESITS_V2 && window.CARESITS_V2.heartButton && doc.uid) head.append(window.CARESITS_V2.heartButton(doc.uid));
  card.append(head);
  if (doc.about) card.append(el("p", "v2About", doc.about));
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
      im.src = u;
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
  const details = el("div", "findDetails");
  details.hidden = true;
  const lines = detailLines(doc);
  if (lines.length) for (const line of lines) details.append(el("p", "findDetailLine", line));
  else details.append(el("p", "findDetailLine", tr("find.detailEmpty")));
  const revBox = el("div", "v2RevList");
  details.append(revBox);
  card.append(details);
  const actions = el("div", "findActions");
  const detailsButton = el("button", "ghostBtn findDetailsBtn", tr("find.details"));
  detailsButton.type = "button";
  detailsButton.setAttribute("aria-expanded", "false");
  detailsButton.addEventListener("click", () => {
    details.hidden = !details.hidden;
    if (!details.hidden && !revBox.dataset.l && window.CARESITS_V2 && window.CARESITS_V2.reviewsInto) { revBox.dataset.l = "1"; window.CARESITS_V2.reviewsInto(revBox, doc.uid); }
    detailsButton.setAttribute("aria-expanded", String(!details.hidden));
    detailsButton.textContent = tr(details.hidden ? "find.details" : "find.hideDetails");
  });
  const messageButton = el("button", "mainBtn findMsg", tr("find.message"));
  messageButton.type = "button";
  messageButton.addEventListener("click", () => {
    if (typeof window.CARESITS_CONTACT === "function") window.CARESITS_CONTACT(doc.uid || "", doc);
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
    return card;
  }
  const pct = el("p", "findFit");
  pct.append(el("span", "fitChip", labelText(entry.result.label)));
  pct.append(el("span", "fitScore mapPct", tr("find.matchPct", undefined, { n: entry.result.pair })));
  card.append(pct);
  const ul = el("ul", "findReasons");
  (entry.result.reasons || []).slice(0, 3).forEach((r, i) => ul.append(el("li", null, reasonText(entry.result, r, i))));
  (entry.result.learningReasons || []).forEach((reason) => ul.append(el("li", "learningMatchReason", learningReasonText(reason))));
  card.append(ul);
  if (entry.result.qualifier) card.append(el("p", "qualLine", qualText(entry.result.qualifier)));
  return card;
}

function mapSection(viewerDoc, candidateDocs, browse) {
  const wrap = el("div", "mapWrap");
  const panel = el("div", "mapPanel");
  panel.setAttribute("aria-label", tr("find.mapAria"));
  const byUid = new Map();
  if (browse) for (const e of [...browse.top, ...browse.more]) byUid.set(e.doc.uid || e.doc.displayName, e);
  const entries = candidateDocs.filter((d) => d.side !== (viewerDoc?.side || "family")).map((doc) => ({ doc, result: null }));
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
    filterState = { ...FILTER_DEFAULTS };
    moreFiltersOpen = false;
  }
  const favNow = window.CARESITS_V2 && window.CARESITS_V2.favs ? window.CARESITS_V2.favs() : new Set();
  const visibleCandidates = candidateDocs.filter((d) => !excludedUids.has(d.uid || d.displayName) && (!showSaved || favNow.has(d.uid)));
  root.replaceChildren();
  const isCarerView = (viewerDoc && viewerDoc.side === "carer") || (!viewerDoc && window.CARESITS_V2 && window.CARESITS_V2.role() === "career");
  root.append(el("h2", "findTitle", isCarerView ? "Jobs" : tr("shell.find")));
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
  for (const e of b.top) list.append(cardFor(e));
  root.append(list);
  if (b.more.length) {
    const moreBox = el("div", "findList");
    moreBox.hidden = true;
    for (const e of b.more) moreBox.append(cardFor(e));
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
        photo.src = nItem.doc.photoUrl;
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
  const snap = await fsMod.getDocs(fsMod.query(fsMod.collection(db, "profiles"), fsMod.limit(100)));
  const candidates = [];
  for (const d of snap.docs) { if (d.id !== uid) candidates.push(await withAnswers(d.id, d.data())); }
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
