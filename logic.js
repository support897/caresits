/* Nanny App logic. Pure functions, tested by tests/run.mjs. No DOM here. */
"use strict";

var D = (typeof require !== "undefined") ? require("./data.js") : { COUNTRIES: COUNTRIES, ROLES: ROLES, STYLE_DIMS: STYLE_DIMS, SEED_CAREGIVERS: SEED_CAREGIVERS };

function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
function asStr(x, dflt) { return (typeof x === "string") ? x : (dflt || ""); }
function asNum(x, dflt) { var n = Number(x); return isFinite(n) ? n : (dflt || 0); }
function asBool(x) { return x === true; }
function asArr(x) { return Array.isArray(x) ? x.slice() : []; }
function asStrArr(x) { return asArr(x).filter(function (v) { return typeof v === "string"; }); }
function clampStyle(x) { var n = Math.round(asNum(x, 2)); return Math.max(0, Math.min(4, n)); }

function defaultStyle() { var s = {}; D.STYLE_DIMS.forEach(function (d) { s[d.id] = 2; }); return s; }
function normaliseStyle(x) { var s = defaultStyle(); if (isObj(x)) { D.STYLE_DIMS.forEach(function (d) { if (x[d.id] !== undefined) s[d.id] = clampStyle(x[d.id]); }); } return s; }

function defaultState() {
  return {
    version: 1,
    started: false,
    side: "family",            // family or caregiver: whose eyes the app is set up for
    country: "AU",
    role: "nanny",
    theme: "brand",
    bgPhoto: "",
    guideHidden: false,
    cute: true,
    sidebarHidden: true,
    notifAsked: false,
    notifOn: false,
    family: { name: "", suburb: "", about: "", languages: [], include: "" },
    children: [],              // {id,name,dob,theme,color,notes,allergies}
    me: { name: "", suburb: "", blurb: "", languages: [], tier: "Entry" },
    answers: {                 // family wants (also used as carer mirror in demo matching)
      days: [true, true, true, true, true, false, false],
      liveIn: "out", ages: [], mustHaves: [], activities: [], style: defaultStyle(),
      payMin: 0, payMax: 0, radiusKm: 15, startMonth: "", months: 6
    },
    shortlist: [],             // caregiver ids
    hires: [],                 // {cgId, status, startDate}
    threads: {},               // cgId -> [{from, text, at}]
    log: [],                   // {id, childId, tile, note, at (ISO), ack}
    roster: [],                // {id, cgId, day (0 to 6), start, end, note}
    timesheets: [],            // {id, cgId, date, hours, rate, status}
    docs: [],                  // {id, name, kind, state, expiry}
    emergency: { contact1: "", contact2: "", doctor: "", address: "", pickups: "", houseNotes: "" },
    reviews: [],               // {id, cgId, when, stars, text, reply}
    reminders: []              // {id, text, date}
  };
}

/* Repair pass. Any wrong shape becomes safe. This is the Meal Prep and Pace QA lesson:
   poisoned saved state must never brick the app. */
function normaliseState(raw) {
  var s = defaultState();
  if (!isObj(raw)) return s;
  s.started = asBool(raw.started);
  if (raw.side === "family" || raw.side === "caregiver") s.side = raw.side;
  if (typeof raw.country === "string" && D.COUNTRIES.some(function (c) { return c.code === raw.country; })) s.country = raw.country;
  if (typeof raw.role === "string" && D.ROLES.some(function (r) { return r.id === raw.role; })) s.role = raw.role;
  /* Law E themes (14 Oct 2026): brand / white / black / photo. Older saved theme
     names map onto the new set; nothing a user picked is dropped silently. */
  var themeMap = { blush: "brand", sky: "brand", mint: "brand", lavender: "brand", dark: "black", brand: "brand", white: "white", black: "black", photo: "photo" };
  if (typeof raw.theme === "string" && themeMap[raw.theme]) s.theme = themeMap[raw.theme];
  s.bgPhoto = asStr(raw.bgPhoto);
  if (s.theme === "photo" && !s.bgPhoto) s.theme = "brand";
  s.guideHidden = asBool(raw.guideHidden);
  s.cute = raw.cute !== false;
  /* Sidebar Adaptive Law (Ilse, 14 Oct 2026): the menu starts hidden on EVERY load,
     whatever was saved. The top bar toggle shows or hides it for this session only. */
  s.sidebarHidden = true;
  s.notifAsked = asBool(raw.notifAsked);
  s.notifOn = asBool(raw.notifOn);
  if (isObj(raw.family)) {
    s.family.name = asStr(raw.family.name); s.family.suburb = asStr(raw.family.suburb);
    s.family.about = asStr(raw.family.about); s.family.include = asStr(raw.family.include);
    s.family.languages = asStrArr(raw.family.languages);
  }
  s.children = asArr(raw.children).filter(isObj).map(function (c) {
    return { id: asStr(c.id, "kid" + Math.random()), name: asStr(c.name, "Child"), dob: asStr(c.dob), theme: asStr(c.theme, "flowers"), color: asStr(c.color, "#C9718A"), notes: asStr(c.notes), allergies: asStr(c.allergies) };
  });
  if (isObj(raw.me)) {
    s.me.name = asStr(raw.me.name); s.me.suburb = asStr(raw.me.suburb); s.me.blurb = asStr(raw.me.blurb);
    s.me.languages = asStrArr(raw.me.languages); s.me.tier = asStr(raw.me.tier, "Entry");
  }
  if (isObj(raw.answers)) {
    var a = raw.answers;
    if (Array.isArray(a.days) && a.days.length === 7) s.answers.days = a.days.map(asBool);
    if (a.liveIn === "in" || a.liveIn === "out" || a.liveIn === "either") s.answers.liveIn = a.liveIn;
    s.answers.ages = asStrArr(a.ages); s.answers.mustHaves = asStrArr(a.mustHaves);
    /* Activity names lost their emoji prefixes in the restyle; strip them from saved picks too. */
    s.answers.activities = asStrArr(a.activities).map(function (x) { return x.replace(/^[^\p{L}]+/u, "").trim(); });
    s.answers.style = normaliseStyle(a.style);
    s.answers.payMin = Math.max(0, asNum(a.payMin, 0)); s.answers.payMax = Math.max(0, asNum(a.payMax, 0));
    s.answers.radiusKm = Math.max(1, asNum(a.radiusKm, 15)); s.answers.startMonth = asStr(a.startMonth);
    s.answers.months = Math.max(1, asNum(a.months, 6));
  }
  s.shortlist = asStrArr(raw.shortlist);
  s.hires = asArr(raw.hires).filter(isObj).map(function (h) { return { cgId: asStr(h.cgId), status: asStr(h.status, "trial"), startDate: asStr(h.startDate) }; });
  if (isObj(raw.threads)) { Object.keys(raw.threads).forEach(function (k) { if (Array.isArray(raw.threads[k])) s.threads[k] = raw.threads[k].filter(isObj).map(function (m) { return { from: asStr(m.from, "family"), text: asStr(m.text), at: asStr(m.at) }; }); }); }
  s.log = asArr(raw.log).filter(isObj).map(function (e) { return { id: asStr(e.id, "log" + Math.random()), childId: asStr(e.childId), tile: asStr(e.tile), note: asStr(e.note), at: asStr(e.at), ack: asBool(e.ack) }; });
  s.roster = asArr(raw.roster).filter(isObj).map(function (r) { return { id: asStr(r.id, "ros" + Math.random()), cgId: asStr(r.cgId), day: Math.max(0, Math.min(6, Math.round(asNum(r.day, 0)))), start: asStr(r.start, "08:00"), end: asStr(r.end, "16:00"), note: asStr(r.note) }; });
  s.timesheets = asArr(raw.timesheets).filter(isObj).map(function (t) { return { id: asStr(t.id, "ts" + Math.random()), cgId: asStr(t.cgId), date: asStr(t.date), hours: Math.max(0, asNum(t.hours, 0)), rate: Math.max(0, asNum(t.rate, 0)), status: asStr(t.status, "waiting") }; });
  s.docs = asArr(raw.docs).filter(isObj).map(function (d) { return { id: asStr(d.id, "doc" + Math.random()), name: asStr(d.name), kind: asStr(d.kind), state: asStr(d.state, "self"), expiry: asStr(d.expiry) }; });
  if (isObj(raw.emergency)) { Object.keys(s.emergency).forEach(function (k) { s.emergency[k] = asStr(raw.emergency[k]); }); }
  s.reviews = asArr(raw.reviews).filter(isObj).map(function (r) { return { id: asStr(r.id, "rev" + Math.random()), cgId: asStr(r.cgId), when: asStr(r.when), stars: Math.max(1, Math.min(5, Math.round(asNum(r.stars, 5)))), text: asStr(r.text), reply: asStr(r.reply) }; });
  s.reminders = asArr(raw.reminders).filter(isObj).map(function (r) { return { id: asStr(r.id, "rem" + Math.random()), text: asStr(r.text), date: asStr(r.date) }; });
  return s;
}

function countryPack(code) {
  for (var i = 0; i < D.COUNTRIES.length; i++) if (D.COUNTRIES[i].code === code) return D.COUNTRIES[i];
  return D.COUNTRIES[0];
}
function roleInfo(id) {
  for (var i = 0; i < D.ROLES.length; i++) if (D.ROLES[i].id === id) return D.ROLES[i];
  return D.ROLES[1];
}

/* Hard filters first (pass or fail), then a soft style score with reasons.
   Weights per research section 3.2: style fit is the biggest block. */
function dayOverlap(a, b) { var n = 0; for (var i = 0; i < 7; i++) if (a[i] && b[i]) n++; return n; }
function neededDays(a) { var n = 0; for (var i = 0; i < 7; i++) if (a[i]) n++; return n; }

function scoreMatch(wants, cg) {
  var misses = [];
  if (cg.country !== wants.country) misses.push("Different country");
  if (cg.role !== wants.role && !(wants.role === "aupair" && cg.role === "demipair")) misses.push("Different role");
  var overlap = dayOverlap(wants.days, cg.days), need = Math.max(1, neededDays(wants.days));
  if (overlap < need) misses.push("Free on " + overlap + " of your " + need + " days");
  if (wants.liveIn === "in" && cg.liveIn === "out") misses.push("You need live in. They live out");
  if (wants.liveIn === "out" && cg.liveIn === "in") misses.push("You need live out. They live in");
  wants.ages.forEach(function (age) { if (cg.ages.indexOf(age) === -1) misses.push("Has not listed age " + age); });
  wants.mustHaves.forEach(function (m) {
    if (m === "wwcc" && cg.checks.wwcc !== "verified") misses.push("Working With Children Check not verified yet");
    if (m === "firstAid" && (!cg.checks.firstAid || cg.checks.firstAid === "None yet")) misses.push("No first aid yet");
    if (m === "police" && cg.checks.police === "none") misses.push("No police check yet");
  });
  if (wants.payMax > 0 && cg.payKind === "hourly" && cg.pay > wants.payMax) misses.push("Rate is above your top pay");

  var hardPass = misses.length === 0;
  var diffSum = 0;
  D.STYLE_DIMS.forEach(function (d) { diffSum += Math.abs((wants.style[d.id] || 2) - (cg.style[d.id] || 2)); });
  var styleScore = Math.max(0, 100 - diffSum * 6);            // 8 dims, max diff 32, scaled
  var expScore = Math.min(100, Math.round(cg.experienceHrs / 20));
  var actShared = (wants.activities || []).filter(function (a) { return cg.activities.indexOf(a) !== -1; });
  var actScore = (wants.activities && wants.activities.length) ? Math.round(100 * actShared.length / wants.activities.length) : 60;
  var score = Math.round(styleScore * 0.55 + expScore * 0.2 + actScore * 0.25);

  var reasons = [];
  var sorted = D.STYLE_DIMS.map(function (d) { return { d: d, gap: Math.abs((wants.style[d.id] || 2) - (cg.style[d.id] || 2)) }; }).sort(function (x, y) { return x.gap - y.gap; });
  sorted.slice(0, 3).forEach(function (x) { if (x.gap <= 1) reasons.push("You both see " + x.d.name.toLowerCase() + " the same way: " + (x.gap === 0 ? x.d.low === "" ? "" : labelFor(x.d, cg.style[x.d.id]) : "close")); });
  if (actShared.length) reasons.push("Shared loved activities: " + actShared.slice(0, 3).join(", "));
  if (cg.checks.wwcc === "verified") reasons.push("Working With Children Check verified free on the official register");
  if (overlap === need && need > 0) reasons.push("Free on all your days");
  return { hardPass: hardPass, score: hardPass ? score : 0, reasons: reasons.slice(0, 4), misses: misses, styleScore: styleScore };
}
function labelFor(dim, v) { if (v <= 1) return dim.low.toLowerCase(); if (v >= 3) return dim.high.toLowerCase(); return "in the middle"; }

function daySummary(entries, dateStr) {
  var mine = entries.filter(function (e) { return e.at && e.at.slice(0, 10) === dateStr; });
  var sum = { count: mine.length, meals: 0, naps: 0, mood: "", highlight: "", safety: 0, photos: 0 };
  mine.forEach(function (e) {
    if (e.tile === "meal") sum.meals++;
    if (e.tile === "nap") sum.naps++;
    if (e.tile === "mood") sum.mood = e.note;
    if (e.tile === "milestone" || e.tile === "photo") { sum.photos++; if (!sum.highlight) sum.highlight = e.note; }
    if (e.tile === "medicine" || e.tile === "incident" || e.tile === "health") sum.safety++;
  });
  return sum;
}

function expiryStatus(expiry, todayStr) {
  if (!expiry) return "none";
  if (expiry < todayStr) return "expired";
  var days = Math.round((new Date(expiry) - new Date(todayStr)) / 86400000);
  return days <= 60 ? "soon" : "ok";
}

function completeness(state) {
  var total = 6, done = 0;
  if (state.family.name || state.me.name) done++;
  if (state.family.suburb || state.me.suburb) done++;
  if (state.children.length > 0 || state.side === "caregiver") done++;
  if (state.answers.ages.length > 0) done++;
  if (state.docs.length > 0) done++;
  if (state.emergency.contact1) done++;
  return Math.round(100 * done / total);
}

var API = { defaultState: defaultState, normaliseState: normaliseState, countryPack: countryPack, roleInfo: roleInfo, scoreMatch: scoreMatch, daySummary: daySummary, expiryStatus: expiryStatus, completeness: completeness, defaultStyle: defaultStyle };
if (typeof module !== "undefined" && module.exports) module.exports = API;
if (typeof window !== "undefined") window.NannyLogic = API;
