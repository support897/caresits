/* Caresits. One file UI. Data in data.js, pure logic in logic.js.
   Everything lives on this device (localStorage nannyapp-v1). No server, no keys, $0. */
"use strict";

var KEY = "nannyapp-v1";
var L = window.NannyLogic;
var state = load();
var view = "home";
var threadCg = null;
var storyDate = todayStr();
var storyKidId = null;
var napTimer = null;

function todayStr() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function nowTime() { var d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function load() { try { return L.normaliseState(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (e) { return L.defaultState(); } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} paintChrome(); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function uid(p) { return p + Math.random().toString(36).slice(2, 9); }
function $(id) { return document.getElementById(id); }
function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.remove("hidden"); setTimeout(function () { t.classList.add("hidden"); }, 2600); }
function cgById(id) { for (var i = 0; i < SEED_CAREGIVERS.length; i++) if (SEED_CAREGIVERS[i].id === id) return SEED_CAREGIVERS[i]; return null; }
function roleName(id) { return L.roleInfo(id).name; }
function pack() { return L.countryPack(state.country); }

var ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/></svg>',
  find: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><line x1="16" y1="16" x2="20.5" y2="20.5"/></svg>',
  shortlist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20c-5.5-3.6-8.2-6.8-8.2-10.3 0-2.7 1.9-4.7 4.3-4.7 1.6 0 3.1.8 3.9 2 .8-1.2 2.3-2 3.9-2 2.4 0 4.3 2 4.3 4.7C20.2 13.2 17.5 16.4 12 20z"/></svg>',
  messages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4z"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="8.4" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4"/></svg>',
  children: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="3.2"/><circle cx="17" cy="10.5" r="2.5"/><path d="M3.8 19.4c.5-3 2.6-4.8 5.2-4.8 1.5 0 2.9.6 3.9 1.7M15.6 15c2.3.2 4 1.8 4.5 4.2"/></svg>',
  daystory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.6c2.5-1.1 5-.9 7 .7 2-1.6 4.5-1.8 7-.7v14.2c-2.5-1.1-5-.9-7 .7-2-1.6-4.5-1.8-7-.7z"/><line x1="12" y1="5.3" x2="12" y2="19.5"/></svg>',
  roster: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="16" rx="3.5"/><line x1="3.5" y1="10" x2="20.5" y2="10"/><line x1="8" y1="3" x2="8" y2="6.5"/><line x1="16" y1="3" x2="16" y2="6.5"/></svg>',
  timesheet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  trust: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 2.6v5.6c0 4.6-3 7.7-7 9.3-4-1.6-7-4.7-7-9.3V5.6z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>',
  emergency: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10M8 9h8"/><rect x="4" y="3" width="16" height="18" rx="3.5"/></svg>',
  reviews: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l2.3 4.9 5.3.6-3.9 3.6 1 5.3-4.7-2.6-4.7 2.6 1-5.3L4.4 9.5l5.3-.6z"/></svg>',
  reminders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18.2 16.9H5.8c.9-1.3 1.4-2.5 1.4-4.4v-1.9a4.8 4.8 0 0 1 9.6 0v1.9c0 1.9.5 3.1 1.4 4.4z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9L18 18M18 6l-2.1 2.1M8.1 15.9L6 18"/></svg>',
  privacy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15.2" r="1.3"/></svg>'
};
/* Grouped menu (House Law, Simple + Easy, 14 Oct 2026): four calm areas, one open
   at a time, so the menu never shows fourteen equal choices at once. */
var NAVGROUPS = [
  { id: "gfind", label: "Finding care", items: [["find", "Find", "ic2"], ["shortlist", "Shortlist", "ic3"], ["messages", "Messages", "ic4"]] },
  { id: "gfamily", label: "Our family", items: [["children", "Children", "ic6"], ["daystory", "Day Story", "ic1"], ["emergency", "Emergency", "ic5"]] },
  { id: "gweek", label: "The week", items: [["roster", "Roster", "ic2"], ["timesheet", "Timesheet", "ic3"], ["reminders", "Reminders", "ic1"]] },
  { id: "gtrust", label: "Trust and us", items: [["trust", "Checks", "ic4"], ["reviews", "Reviews", "ic6"], ["profile", "My Profile", "ic5"], ["privacy", "Privacy policy", "ic3"]] }
];
var navOpen = "gfind"; /* exactly one group open at a time; "none" means all closed */
function groupOfView(v) { for (var i = 0; i < NAVGROUPS.length; i++) for (var j = 0; j < NAVGROUPS[i].items.length; j++) if (NAVGROUPS[i].items[j][0] === v) return NAVGROUPS[i].id; return null; }
function svgWrap(paths) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + paths + "</svg>"; }
/* Drawn marks for the Day Story tiles and child themes: same hand as the menu icons
   (one stroke weight, rounded caps). The icon law audit retired emoji from the app. */
var TILE_SVG = {
  arrival: '<path d="M6 21V4.5A.5.5 0 0 1 6.5 4h8a.5.5 0 0 1 .5.5V21"/><path d="M3.5 21h17"/><circle cx="12.2" cy="12.5" r="1.1" fill="currentColor" stroke="none"/>',
  meal: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.4"/>',
  drink: '<path d="M6.2 4h11.6l-1.4 16.2a1 1 0 0 1-1 .8H8.6a1 1 0 0 1-1-.8z"/><path d="M7 9.5h10"/>',
  nap: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.8 6.8 0 0 0 10 10z"/>',
  nappy: '<path d="M5.5 9.5a7.5 7.5 0 0 1 11.5-3L19 8.5"/><path d="M19.5 3.5v5h-5"/><path d="M18.5 14.5a7.5 7.5 0 0 1-11.5 3l-2-2"/><path d="M4.5 20.5v-5h5"/>',
  mood: '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.1" fill="currentColor" stroke="none"/><path d="M8.2 14.2c1 1.3 2.3 2 3.8 2s2.8-.7 3.8-2"/>',
  activity: '<circle cx="12" cy="12" r="8.5"/><path d="M3.8 9.5c4.5 2.2 11.9 2.2 16.4 0"/><path d="M12 3.5c-3 3.4-3 13.6 0 17"/><path d="M12 3.5c3 3.4 3 13.6 0 17"/>',
  outing: '<path d="M12 3l4.6 6.2h-3L18 15H6l4.4-5.8h-3z"/><path d="M12 15v6"/>',
  medicine: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
  incident: '<rect x="3.2" y="9" width="17.6" height="6.4" rx="3.2" transform="rotate(-28 12 12)"/><circle cx="10.2" cy="11.6" r="1" fill="currentColor" stroke="none"/><circle cx="13.8" cy="12.8" r="1" fill="currentColor" stroke="none"/>',
  health: '<path d="M12 20.2S3.8 15.3 3.8 9.9A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.2 2.9c0 5.4-8.2 10.3-8.2 10.3z"/>',
  photo: '<rect x="3.5" y="7" width="17" height="13" rx="2.5"/><circle cx="12" cy="13.5" r="3.4"/><path d="M8.5 7l1.2-2.2a1 1 0 0 1 .9-.6h2.8a1 1 0 0 1 .9.6L15.5 7"/>',
  milestone: '<path d="M12 4l2.2 4.7 5.1.7-3.7 3.6 1 5-4.6-2.5-4.6 2.5 1-5L4.7 9.4l5.1-.7z"/>',
  note: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7.5l8 6 8-6"/>'
};
function tileSvg(id) { return svgWrap(TILE_SVG[id] || TILE_SVG.note); }
var THEME_SVG = {
  flowers: '<circle cx="12" cy="7.6" r="2.6"/><circle cx="16.2" cy="10.8" r="2.6"/><circle cx="14.6" cy="15.8" r="2.6"/><circle cx="9.4" cy="15.8" r="2.6"/><circle cx="7.8" cy="10.8" r="2.6"/><circle cx="12" cy="11.8" r="1.8" fill="currentColor" stroke="none"/>',
  fairies: '<path d="M12 3.5l1.7 5.3 5.3 1.7-5.3 1.7L12 17.5l-1.7-5.3L5 10.5l5.3-1.7z"/><circle cx="18" cy="17" r="1.3" fill="currentColor" stroke="none"/><circle cx="6.5" cy="18.5" r="1" fill="currentColor" stroke="none"/>',
  space: '<circle cx="12" cy="12" r="5.2"/><path d="M4.2 16.8c-1 .9-.4 2.3 1.3 2.6 4.9 1 11.9-.6 14.9-3.2 1.3-1.1.9-2.5-.8-2.9"/>',
  dino: '<ellipse cx="10.5" cy="15.5" rx="4.2" ry="5" fill="currentColor" stroke="none" opacity=".9"/><circle cx="5.8" cy="8.2" r="1.7" fill="currentColor" stroke="none"/><circle cx="10.5" cy="6.8" r="1.7" fill="currentColor" stroke="none"/><circle cx="15.2" cy="8.2" r="1.7" fill="currentColor" stroke="none"/>',
  ocean: '<path d="M3 9.5c2.8-2.6 5.7-2.6 8.5 0s5.7 2.6 8.5 0"/><path d="M3 15.5c2.8-2.6 5.7-2.6 8.5 0s5.7 2.6 8.5 0"/>',
  plain: '<circle cx="12" cy="12" r="6.5"/>'
};
function themeSvg(id) { return svgWrap(THEME_SVG[id] || THEME_SVG.plain); }
var BELL_SVG = '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 3h-15z"/><path d="M10 21a2.2 2.2 0 0 0 4 0"/>';
/* Lio the Lighthouse, the guide. One master drawing; the small night light form
   wears deeper band tones so he still reads at small sizes (Lab condition). */
function lioSVG(px, deep) {
  var band1 = deep ? "#4E7A6A" : "#9CC5B5", band2 = deep ? "#C97F3D" : "#F2B880";
  return '<svg class="lioSvg" width="' + px + '" height="' + px + '" viewBox="0 0 64 64" aria-hidden="true">' +
    '<ellipse cx="32" cy="56" rx="14" ry="3.4" fill="#402B3A" opacity=".14"/>' +
    '<path d="M24 54 L27.5 24 h9 L40 54 a3 3 0 0 1 -3 3.4 H27 a3 3 0 0 1 -3 -3.4z" fill="#FFF6E3" stroke="#1E4D44" stroke-width="2.4"/>' +
    '<path d="M25.9 42.6 L38.1 42.6 L39 49 L25 49z" fill="' + band2 + '"/>' +
    '<path d="M27.2 31 L36.8 31 L37.5 36.4 L26.5 36.4z" fill="' + band1 + '"/>' +
    '<rect x="25" y="15" width="14" height="10" rx="3" fill="#F6D67C" stroke="#1E4D44" stroke-width="2.4"/>' +
    '<circle cx="28.8" cy="20" r="1.5" fill="#402B3A"/><circle cx="35.2" cy="20" r="1.5" fill="#402B3A"/>' +
    '<path d="M25 15 L39 15 L36.8 9.4 a2.4 2.4 0 0 0 -2.2 -1.6 H29.4 a2.4 2.4 0 0 0 -2.2 1.6z" fill="#1E4D44"/>' +
    '<path d="M39 17.5 L52 13.8 L52 26.2 L39 22.5z" fill="#F6D67C" opacity=".4"/></svg>';
}
function guideCard(viewName) {
  var tips = { home: "Tap Find to meet carers near you.", find: "Every badge says what was really checked.", daystory: "Tiles make the day story in one tap.", roster: "The week, at a glance.", settings: "Your background lives under Appearance." };
  return '<div class="card guideCard">' + lioSVG(64, false) + '<div class="guideText"><div class="guideBubble">I am Lio, your guide.</div><p class="hint">' + (tips[viewName] || tips.home) + ' Tap Hide Lio and I become a small night light in the corner.</p></div><button class="pillBtn" id="lioHide">Hide Lio</button></div>';
}
function navBtn(n) { return '<button class="navBtn' + (view === n[0] ? " active" : "") + '" data-nav="' + n[0] + '"><span class="navIcon ' + n[2] + '">' + ICONS[n[0]] + '</span><span>' + n[1] + "</span></button>"; }
function buildNav() {
  var html = navBtn(["home", "Home", "ic1"]);
  html += NAVGROUPS.map(function (g) {
    var isOpen = navOpen === g.id;
    return '<div class="navGroup"><button class="navGroupHead' + (isOpen ? " open" : "") + '" data-group="' + g.id + '" aria-expanded="' + (isOpen ? "true" : "false") + '"><span>' + g.label + '</span><span class="navChevron" aria-hidden="true">›</span></button>' +
      '<div class="navGroupItems' + (isOpen ? " open" : "") + '">' + g.items.map(navBtn).join("") + "</div></div>";
  }).join("");
  html += navBtn(["settings", "Settings", "ic2"]);
  $("mainNav").innerHTML = html;
  Array.prototype.forEach.call(document.querySelectorAll(".navBtn"), function (b) { b.addEventListener("click", function () { go(b.dataset.nav); }); });
  Array.prototype.forEach.call(document.querySelectorAll(".navGroupHead"), function (b) { b.addEventListener("click", function () { navOpen = navOpen === b.dataset.group ? "none" : b.dataset.group; buildNav(); }); });
}
function paintChrome() {
  document.documentElement.dataset.theme = state.theme;
  if (state.theme === "photo" && state.bgPhoto) document.documentElement.style.setProperty("--bgimg", "url(\"" + state.bgPhoto + "\")"); else document.documentElement.style.removeProperty("--bgimg");
  var corner = $("lioCorner");
  if (corner) { corner.innerHTML = lioSVG(36, true); corner.classList.toggle("hidden", !state.guideHidden); }
  document.documentElement.dataset.cute = state.cute ? "on" : "off";
  document.documentElement.dataset.sb = state.sidebarHidden ? "hidden" : "shown";
  $("sidebarToggle").setAttribute("aria-pressed", state.sidebarHidden ? "true" : "false");
  $("stripSide").textContent = (state.side === "family" ? "Family view" : "Caregiver view") + " · " + pack().name + " · " + roleName(state.role);
  $("setupCard").innerHTML = "Profile is <b>" + L.completeness(state) + "%</b> ready.<br>" + state.shortlist.length + " in your shortlist · " + state.hires.length + " hired";
}
function go(v) { view = v; var g = groupOfView(v); if (g) navOpen = g; buildNav(); render(); window.scrollTo(0, 0); }
function head(title, sub) { return '<header><h1>' + title + '</h1><p class="sub">' + sub + "</p></header>"; }
function emptyState(art, line, btnText, btnView) {
  return '<div class="card center"><div class="emptyArt">' + art + "</div><p>" + line + '</p><button class="primaryBtn" data-go="' + btnView + '">' + btnText + "</button></div>";
}
function bindGo(scope) { Array.prototype.forEach.call(scope.querySelectorAll("[data-go]"), function (b) { b.addEventListener("click", function () { go(b.dataset.go); }); }); }

function render() {
  var el = $("view-" + view);
  document.querySelectorAll(".view").forEach(function (s) { s.classList.remove("active"); });
  el.classList.add("active");
  ({ home: renderHome, find: renderFind, shortlist: renderShortlist, messages: renderMessages, profile: renderProfile, children: renderChildren, daystory: renderDayStory, roster: renderRoster, timesheet: renderTimesheet, trust: renderTrust, emergency: renderEmergency, reviews: renderReviews, reminders: renderReminders, settings: renderSettings, privacy: renderPrivacy })[view](el);
  bindGo(el);
}

/* ---------- HOME + START (Country, then Role, then a short form) ---------- */
var startStep = 0;
function renderHome(el) {
  if (!state.started) { renderStart(el); return; }
  var p = pack();
  var todayLog = state.log.filter(function (e) { return e.at.slice(0, 10) === todayStr(); });
  var unacked = todayLog.filter(function (e) { return (e.tile === "medicine" || e.tile === "incident" || e.tile === "health") && !e.ack; });
  var html = head("Home", "Everything for finding care and sharing the day, in one place.");
  if (!state.notifAsked) html += '<div class="card"><h2>Turn on reminders?</h2><p class="hint">We can remind you about expiring checks, roster days and anything you add in Reminders. Nothing is sent anywhere. It all stays on this device.</p><div class="row"><button class="primaryBtn" id="homeNotifOn">Turn on reminders</button><button class="pillBtn" id="homeNotifSkip">Not now</button></div></div>';
  html += '<div class="card"><h2>Your country pack: ' + p.flag + " " + p.name + "</h2><p>" + esc(p.scheme) + '</p><p class="hint">' + esc(p.payNote) + '</p><button class="pillBtn" data-go="trust">See the checks for ' + p.name + "</button></div>";
  if (!state.guideHidden) html += guideCard("home");
  if (unacked.length) html += '<div class="card"><h2>Needs your OK</h2><p>' + unacked.length + ' safety note(s) in today\u2019s Day Story are waiting for a parent to tap OK.</p><button class="primaryBtn" data-go="daystory">Open Day Story</button></div>';
  html += '<div class="card"><h2>Today</h2><p>' + todayLog.length + ' things logged today. ' + state.hires.length + ' carer(s) hired. ' + state.shortlist.length + ' in your shortlist.</p><div class="row"><button class="primaryBtn" data-go="find">Find a carer</button><button class="pillBtn" data-go="daystory">Open the Day Story</button><button class="pillBtn" data-go="roster">See the roster</button></div></div>';
  html += '<div class="card"><h2>How matching works here</h2><p class="hint">First, the must haves: right country, right role, free on your days. Then a fit score from how you both like a day to run. Every match shows its reasons. No match is ever promised as safe or perfect. Checks are shown exactly as they are: verified, sighted, or self declared.</p></div>';
  el.innerHTML = html; bindGo(el);
  var lh = $("lioHide"); if (lh) lh.addEventListener("click", function () { state.guideHidden = true; save(); paintChrome(); render(); toast("Lio is a night light now. Tap him to bring him back."); });
  var on = $("homeNotifOn"), skip = $("homeNotifSkip");
  if (on) on.addEventListener("click", function () { askNotifs(); });
  if (skip) skip.addEventListener("click", function () { state.notifAsked = true; save(); render(); });
}
function askNotifs() {
  state.notifAsked = true;
  if (!("Notification" in window)) { state.notifOn = false; save(); render(); toast("This browser cannot show reminders."); return; }
  Notification.requestPermission().then(function (perm) { state.notifOn = perm === "granted"; save(); render(); toast(state.notifOn ? "Reminders are on." : "Reminders stay off. You can change this in Reminders."); });
}
function renderStart(el) {
  var steps = ["Who are you?", "Your country", "Your role", "About you"];
  var html = head("Welcome to Caresits", "Four short steps. You can change everything later in Settings.");
  html += '<div class="card"><p class="hint">This version keeps everything on this device. No account, nothing sent anywhere.' + (SEED_CAREGIVERS.length ? ' The carer profiles you will see are examples, each marked Demo, so you can see how matching works.' : '') + '</p></div>';
  html += '<div class="card"><p class="hint">Step ' + (startStep + 1) + " of 4: <b>" + steps[startStep] + "</b></p>";
  if (startStep === 0) {
    html += '<div class="row"><button class="chip' + (state.side === "family" ? " on" : "") + '" id="sideFamily">I am a family looking for care</button><button class="chip' + (state.side === "caregiver" ? " on" : "") + '" id="sideCg">I am a carer looking for work</button></div>';
  } else if (startStep === 1) {
    html += '<label>Country<select id="startCountry">' + COUNTRIES.map(function (c) { return '<option value="' + c.code + '"' + (state.country === c.code ? " selected" : "") + ">" + c.flag + " " + c.name + "</option>"; }).join("") + "</select></label>";
    html += '<p class="hint">' + esc(pack().scheme) + "</p>";
  } else if (startStep === 2) {
    html += '<div class="chipRow">' + ROLES.map(function (r) { return '<button class="chip' + (state.role === r.id ? " on" : "") + '" data-role="' + r.id + '">' + r.name + "</button>"; }).join("") + "</div>";
    var r = L.roleInfo(state.role);
    html += '<p class="hint">' + esc(r.line) + " The app shapes pay, hours and forms around this role.</p>";
  } else {
    html += '<label>Your name<input id="startName" type="text" placeholder="Your first name" value="' + esc(state.side === "family" ? state.family.name : state.me.name) + '"></label><label>Your suburb or town<input id="startSuburb" type="text" placeholder="Paddington, Brisbane" value="' + esc(state.side === "family" ? state.family.suburb : state.me.suburb) + '"></label>';
    html += '<p class="hint">' + (SEED_CAREGIVERS.length ? "Demo profiles are marked Demo. " : "") + 'Everything you add stays on this device.</p>';
  }
  html += '<div class="row" style="margin-top:14px">' + (startStep > 0 ? '<button class="pillBtn" id="startBack">Back</button>' : "") + '<button class="primaryBtn" id="startNext">' + (startStep === 3 ? "Start using the app" : "Next") + "</button></div></div>";
  el.innerHTML = html;
  var sf = $("sideFamily"), sc = $("sideCg");
  if (sf) sf.addEventListener("click", function () { state.side = "family"; save(); render(); });
  if (sc) sc.addEventListener("click", function () { state.side = "caregiver"; save(); render(); });
  Array.prototype.forEach.call(el.querySelectorAll("[data-role]"), function (b) { b.addEventListener("click", function () { state.role = b.dataset.role; if (state.role === "aupair" || state.role === "demipair") state.answers.liveIn = "in"; save(); render(); }); });
  var ctry = $("startCountry"); if (ctry) ctry.addEventListener("change", function () { state.country = ctry.value; save(); render(); });
  $("startNext").addEventListener("click", function () {
    if (startStep === 3) {
      var nm = $("startName").value.trim(), sb = $("startSuburb").value.trim();
      if (state.side === "family") { state.family.name = nm; state.family.suburb = sb; } else { state.me.name = nm; state.me.suburb = sb; }
      state.started = true; save(); toast("You are in. Welcome."); render(); return;
    }
    startStep++; render();
  });
  var back = $("startBack"); if (back) back.addEventListener("click", function () { startStep--; render(); });
}

/* ---------- FIND + QUESTIONNAIRE + MATCHING ---------- */
var DAYNAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function wantsObj() { var w = JSON.parse(JSON.stringify(state.answers)); w.country = state.country; w.role = state.role; return w; }
function badgeForChecks(cg) {
  var out = "";
  if (cg.checks.wwcc === "verified") out += '<span class="badge badgeOk">✔ Check verified on the register</span>';
  else if (cg.checks.wwcc === "sighted") out += '<span class="badge badgeSoft">Document sighted</span>';
  else out += '<span class="badge badgeWarn">Self declared only</span>';
  if (cg.checks.police === "sighted") out += '<span class="badge badgeSoft">Police check sighted</span>';
  if (cg.checks.firstAid && cg.checks.firstAid !== "None yet") out += '<span class="badge badgeSoft">✚ ' + esc(cg.checks.firstAid) + "</span>";
  out += '<span class="badge badgeSoft">' + cg.tier + "</span>";
  return out;
}
function cgCard(cg, m) {
  var pay = cg.payKind === "pocket" ? (cg.pay > 0 ? cg.pay + " pocket money per " + cg.payPeriod : "Room and board, no pocket money") : cg.pay + " per hour";
  var h = '<div class="cgCard"><div class="cgHead"><div class="avatar">' + esc(cg.name.charAt(0)) + '</div><div><div class="cgName">' + esc(cg.name) + (cg.demo ? ' <span class="badge badgeWarn">Demo</span>' : "") + '</div><div class="cgMeta">' + roleName(cg.role) + " · " + esc(cg.suburb) + "<br>" + pay + " · starts " + esc(cg.startMonth) + "</div></div>";
  if (m && m.hardPass) h += '<span class="scorePill' + (m.score < 60 ? " mid" : "") + '">' + m.score + "% fit</span>";
  h += "</div><p>" + esc(cg.blurb) + "</p><div>" + badgeForChecks(cg) + "</div>";
  if (m && m.reasons.length) h += '<ul class="reasonList">' + m.reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>";
  if (m && m.misses.length) h += '<ul class="missList">' + m.misses.map(function (r) { return "<li>Not yet: " + esc(r) + "</li>"; }).join("") + "</ul>";
  var inShort = state.shortlist.indexOf(cg.id) !== -1;
  h += '<div class="row"><button class="pillBtn" data-short="' + cg.id + '">' + (inShort ? "♥ In your shortlist" : "♡ Shortlist") + '</button><button class="pillBtn" data-msg="' + cg.id + '">Message</button><button class="pillBtn" data-view="' + cg.id + '">See profile</button>';
  if (m && m.hardPass) h += '<button class="primaryBtn" data-hire="' + cg.id + '">Start a trial</button>';
  h += "</div></div>";
  return h;
}
function bindCgButtons(el) {
  Array.prototype.forEach.call(el.querySelectorAll("[data-short]"), function (b) { b.addEventListener("click", function () { var id = b.dataset.short, i = state.shortlist.indexOf(id); if (i === -1) state.shortlist.push(id); else state.shortlist.splice(i, 1); save(); render(); }); });
  Array.prototype.forEach.call(el.querySelectorAll("[data-msg]"), function (b) { b.addEventListener("click", function () { threadCg = b.dataset.msg; go("messages"); }); });
  Array.prototype.forEach.call(el.querySelectorAll("[data-view]"), function (b) { b.addEventListener("click", function () { openCgProfile(b.dataset.view); }); });
  Array.prototype.forEach.call(el.querySelectorAll("[data-hire]"), function (b) { b.addEventListener("click", function () { var id = b.dataset.hire; if (!state.hires.some(function (x) { return x.cgId === id; })) { state.hires.push({ cgId: id, status: "trial", startDate: todayStr() }); save(); toast("Trial started. Say hello in Messages."); } go("messages"); threadCg = id; }); });
}
function openCgProfile(id) {
  var cg = cgById(id); if (!cg) return;
  var m = L.scoreMatch(wantsObj(), cg);
  $("modalCard").innerHTML = "<h2>" + esc(cg.name) + " · " + roleName(cg.role) + "</h2><p>" + esc(cg.blurb) + "</p><p><b>Lives:</b> " + (cg.liveIn === "in" ? "Live in" : cg.liveIn === "out" ? "Live out" : "Either") + "<br><b>Days free:</b> " + cg.days.map(function (d, i) { return d ? DAYNAMES[i] : null; }).filter(Boolean).join(", ") + "<br><b>Ages:</b> " + cg.ages.join(", ") + "<br><b>Languages:</b> " + cg.languages.join(", ") + "<br><b>Experience:</b> about " + cg.experienceHrs + " hours · " + cg.tier + "<br><b>Loves:</b> " + cg.activities.join(", ") + "</p><div>" + badgeForChecks(cg) + "</div>" +
    (m.reasons.length ? '<h3>Why this can fit</h3><ul class="reasonList">' + m.reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>" : "") +
    '<p class="hint">Checks are labels for what was seen. A badge never means a person is guaranteed safe. Always meet, talk, and follow your country pack.</p><button class="primaryBtn" id="modalClose">Close</button>';
  $("modal").classList.remove("hidden");
  $("modalClose").addEventListener("click", closeModal);
}
function closeModal() { $("modal").classList.add("hidden"); }

function renderFind(el) {
  var a = state.answers;
  var html = head("Find", "Answer as the family. Carers answer the same questions as themselves. The app compares the two.");
  html += '<div class="card"><h2>What you need</h2>';
  html += "<label>Days you need care</label><div class=\"chipRow\">" + DAYNAMES.map(function (d, i) { return '<button class="chip' + (a.days[i] ? " on" : "") + '" data-day="' + i + '">' + d + "</button>"; }).join("") + "</div>";
  html += "<label>Children's ages</label><div class=\"chipRow\">" + ["0 to 1", "1 to 3", "3 to 5", "5 to 12"].map(function (g) { return '<button class="chip' + (a.ages.indexOf(g) !== -1 ? " on" : "") + '" data-age="' + g + '">' + g + " years</button>"; }).join("") + "</div>";
  html += "<label>Live in or live out</label><div class=\"segmented\">" + [["in", "Live in"], ["out", "Live out"], ["either", "Either"]].map(function (o) { return '<button class="seg' + (a.liveIn === o[0] ? " active" : "") + '" data-livein="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</div>";
  html += "<label>Must haves</label><div class=\"chipRow\">" + [["wwcc", "✔ Verified children check"], ["firstAid", "✚ First aid"], ["police", "Police check"]].map(function (o) { return '<button class="chip' + (a.mustHaves.indexOf(o[0]) !== -1 ? " on" : "") + '" data-must="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</div>";
  html += "<label>Activities your children love</label><div class=\"chipRow\">" + ACTIVITY_ICONS.map(function (t) { return '<button class="chip' + (a.activities.indexOf(t) !== -1 ? " on" : "") + '" data-act="' + t + '">' + t + "</button>"; }).join("") + "</div>";
  html += '<label>Top pay per hour (0 means no limit)<input id="qPayMax" type="number" min="0" value="' + a.payMax + '"></label>';
  html += "<h3>How you like a day to run</h3>" + STYLE_DIMS.map(function (d) { return '<div class="rangeRow"><span>' + esc(d.low) + '</span><input type="range" min="0" max="4" step="1" value="' + a.style[d.id] + '" data-style="' + d.id + '"><span style="text-align:right">' + esc(d.high) + "</span></div>"; }).join("");
  html += '<p class="hint">Role and country come from your setup: ' + roleName(state.role) + " in " + pack().name + '. Change them in Settings, and matching runs again from scratch.</p></div>';
  var w = wantsObj();
  var scored = SEED_CAREGIVERS.map(function (cg) { return { cg: cg, m: L.scoreMatch(w, cg) }; });
  var pass = scored.filter(function (x) { return x.m.hardPass; }).sort(function (x, y) { return y.m.score - x.m.score; });
  var near = scored.filter(function (x) { return !x.m.hardPass && x.m.misses.length <= 2; });
  html += "<h2>Your matches (" + pass.length + ")</h2>";
  html += pass.length ? '<div class="cgGrid">' + pass.map(function (x) { return cgCard(x.cg, x.m); }).join("") + "</div>" : (SEED_CAREGIVERS.length === 0 ? emptyState(svgWrap(TILE_SVG.mood), "No carers have joined yet. Your matches will appear here when they do.", "Back to Home", "home") : emptyState(svgWrap(TILE_SVG.mood), "No full match yet. Try removing a must have, or look at close matches below.", "See close matches", "find"));
  if (near.length) { html += "<h2 style=\"margin-top:22px\">Close, but not yet</h2><p class=\"sub\">These nearly fit. The line under each name says what is missing, in plain words.</p><div class=\"cgGrid\">" + near.map(function (x) { return cgCard(x.cg, x.m); }).join("") + "</div>"; }
  el.innerHTML = html; bindGo(el); bindCgButtons(el);
  Array.prototype.forEach.call(el.querySelectorAll("[data-day]"), function (b) { b.addEventListener("click", function () { var i = Number(b.dataset.day); state.answers.days[i] = !state.answers.days[i]; save(); render(); }); });
  Array.prototype.forEach.call(el.querySelectorAll("[data-age]"), function (b) { b.addEventListener("click", function () { toggleIn(state.answers.ages, b.dataset.age); save(); render(); }); });
  Array.prototype.forEach.call(el.querySelectorAll("[data-livein]"), function (b) { b.addEventListener("click", function () { state.answers.liveIn = b.dataset.livein; save(); render(); }); });
  Array.prototype.forEach.call(el.querySelectorAll("[data-must]"), function (b) { b.addEventListener("click", function () { toggleIn(state.answers.mustHaves, b.dataset.must); save(); render(); }); });
  Array.prototype.forEach.call(el.querySelectorAll("[data-act]"), function (b) { b.addEventListener("click", function () { toggleIn(state.answers.activities, b.dataset.act); save(); render(); }); });
  Array.prototype.forEach.call(el.querySelectorAll("[data-style]"), function (r) { r.addEventListener("change", function () { state.answers.style[r.dataset.style] = Number(r.value); save(); render(); }); });
  $("qPayMax").addEventListener("change", function () { state.answers.payMax = Math.max(0, Number($("qPayMax").value) || 0); save(); render(); });
}
function toggleIn(arr, v) { var i = arr.indexOf(v); if (i === -1) arr.push(v); else arr.splice(i, 1); }

function renderShortlist(el) {
  var html = head("Shortlist", "The carers you saved while you decide.");
  if (!state.shortlist.length) { el.innerHTML = html + emptyState(svgWrap(TILE_SVG.health), "Nobody here yet. Tap the heart on a carer in Find to keep them here.", "Go to Find", "find"); bindGo(el); return; }
  html += '<div class="cgGrid">' + state.shortlist.map(function (id) { var cg = cgById(id); return cg ? cgCard(cg, L.scoreMatch(wantsObj(), cg)) : ""; }).join("") + "</div>";
  el.innerHTML = html; bindCgButtons(el);
}

/* ---------- MESSAGES ---------- */
function renderMessages(el) {
  var ids = [];
  state.hires.forEach(function (h) { if (ids.indexOf(h.cgId) === -1) ids.push(h.cgId); });
  state.shortlist.forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });
  Object.keys(state.threads).forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });
  var html = head("Messages", "Talk here first. Share phone numbers only when you are ready.");
  if (!ids.length) { el.innerHTML = html + emptyState(svgWrap(TILE_SVG.note), "No chats yet. Shortlist or start a trial with a carer and the chat opens here.", "Go to Find", "find"); bindGo(el); return; }
  if (!threadCg || ids.indexOf(threadCg) === -1) threadCg = ids[0];
  html += '<div class="chipRow">' + ids.map(function (id) { var cg = cgById(id); return '<button class="chip' + (threadCg === id ? " on" : "") + '" data-thread="' + id + '">' + (cg ? esc(cg.name) : id) + "</button>"; }).join("") + "</div>";
  var cg = cgById(threadCg);
  var msgs = state.threads[threadCg] || [];
  html += '<div class="card"><h2>' + (cg ? esc(cg.name) : "Chat") + '</h2><div class="msgThread">' +
    (msgs.length ? msgs.map(function (m) { return '<div class="msg ' + (m.from === "me" ? "me" : "them") + '">' + esc(m.text) + '<div class="storyTime">' + esc(m.at) + "</div></div>"; }).join("") : '<p class="hint">No messages yet. A warm first line works best: who you are, your days, and one question.</p>') +
    '</div><div class="row"><input id="msgInput" type="text" placeholder="Write a message" style="flex:1"><button class="primaryBtn" id="msgSend">Send</button></div></div>';
  el.innerHTML = html;
  Array.prototype.forEach.call(el.querySelectorAll("[data-thread]"), function (b) { b.addEventListener("click", function () { threadCg = b.dataset.thread; render(); }); });
  function send() {
    var v = $("msgInput").value.trim(); if (!v) return;
    if (!state.threads[threadCg]) state.threads[threadCg] = [];
    state.threads[threadCg].push({ from: "me", text: v, at: todayStr() + " " + nowTime() });
    save(); render();
    setTimeout(function () {
      if (!state.threads[threadCg]) state.threads[threadCg] = [];
      var replies = ["That sounds lovely. I would love to meet the children first.", "Thanks for writing. Those days work for me.", "Happy to do a paid trial shift so we can both be sure."];
      state.threads[threadCg].push({ from: "them", text: replies[state.threads[threadCg].length % replies.length], at: todayStr() + " " + nowTime() });
      save(); if (view === "messages") render();
    }, 900);
  }
  $("msgSend").addEventListener("click", send);
  $("msgInput").addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
}

/* ---------- PROFILE (branches by role) ---------- */
function renderProfile(el) {
  var isAuPair = state.role === "aupair" || state.role === "demipair";
  var isRegulated = state.role === "childminder";
  var html = head("My Profile", state.side === "family" ? "Your family profile. Carers see the warm parts. Children stay private until you hire." : "Your carer profile. Families see this when you match.");
  html += '<div class="card"><h2>The basics</h2><div class="grid2">' +
    '<label>Name<input id="pName" type="text" value="' + esc(state.side === "family" ? state.family.name : state.me.name) + '">' +
    '<label>Suburb or town<input id="pSuburb" type="text" value="' + esc(state.side === "family" ? state.family.suburb : state.me.suburb) + '">' +
    '<label>Languages at home, split with commas<input id="pLangs" type="text" value="' + esc((state.side === "family" ? state.family.languages : state.me.languages).join(", ")) + '">' +
    (state.side === "caregiver" ? '<label>Experience level<select id="pTier">' + ["Entry", "Experienced", "Qualified"].map(function (t) { return '<option' + (state.me.tier === t ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select>" : "") +
    '</div><label>About ' + (state.side === "family" ? "your family" : "you") + '<textarea id="pAbout" rows="3">' + esc(state.side === "family" ? state.family.about : state.me.blurb) + "</textarea></div>";
  if (isAuPair) {
    html += '<div class="card"><h2>Au pair setup</h2><p class="hint">An au pair is paid pocket money, never an hourly wage. The room is part of the deal and must be a real private bedroom, never shared with the children. A sofa or a pull out bed cannot be listed as live in.</p>' +
      '<div class="grid2"><label>Pocket money per week<input id="pPay" type="number" min="0" value="' + (state.family.include ? "" : "") + '" placeholder="For ' + pack().name + ', see the country pack">' +
      '<label>Room style<select id="pRoom"><option>Room in the home</option><option>Room with own bathroom</option><option>Room with separate entrance</option><option>Granny flat (check your scheme first)</option><option>Own apartment (check your scheme first)</option></select></label></div>' +
      '<label>What is included, like course money, a phone card, a bus pass, the car<textarea id="pInclude" rows="2">' + esc(state.family.include) + '</textarea>' +
      '<p class="hint">Hours stay inside your country scheme cap, and evening babysitting counts inside the cap. Extra hours are not a thing for an au pair. If the job grows into housework and full days, it is a nanny job, and the app will say so in the agreement.</p></div>';
  } else if (state.role === "nanny" || state.role === "mothershelp" || state.role === "governess" || state.role === "newborn" || state.role === "babysitter") {
    html += '<div class="card"><h2>Pay and the job</h2><p class="hint">A nanny is paid a gross wage, never pocket money. Where your country has a minimum wage, the app shows it in the country pack and the agreement uses it as the floor.</p>' +
      '<div class="grid2"><label>Pay per hour<input id="pPay" type="number" min="0" placeholder="e.g. 38"><label>Employment<select id="pEmp"><option>Permanent part time</option><option>Permanent full time</option><option>Casual</option><option>Fixed term</option></select></label></div>' +
      '<p class="hint">A paid trial shift comes before the real start. A probation check in belongs in the first weeks. Overtime and weekend rates go in the agreement, in writing.</p></div>';
  }
  if (isRegulated) {
    html += '<div class="card"><h2>Registration first</h2><p class="hint">Childminder and family day care is the one role the law regulates, because care happens in the carer\u2019s own home. Add your service approval or registration in Checks, and this profile can go live. Until then it stays in draft.</p><button class="pillBtn" data-go="trust">Open Checks</button></div>';
  }
  html += '<div class="card"><h2>Publish</h2><p class="hint">In this on device version, saving is publishing to your own app. Real accounts and two phone matching arrive with the backend step, which needs a legal review first.</p><button class="primaryBtn" id="pSave">Save my profile</button> <span class="hint" id="pMsg"></span></div>';
  el.innerHTML = html; bindGo(el);
  $("pSave").addEventListener("click", function () {
    if (state.side === "family") { state.family.name = $("pName").value.trim(); state.family.suburb = $("pSuburb").value.trim(); state.family.languages = splitList($("pLangs").value); state.family.about = $("pAbout").value.trim(); }
    else { state.me.name = $("pName").value.trim(); state.me.suburb = $("pSuburb").value.trim(); state.me.languages = splitList($("pLangs").value); state.me.blurb = $("pAbout").value.trim(); state.me.tier = $("pTier").value; }
    var inc = $("pInclude"); if (inc) state.family.include = inc.value.trim();
    save(); $("pMsg").textContent = "Saved."; toast("Profile saved.");
  });
}
function splitList(s) { return s.split(",").map(function (x) { return x.trim(); }).filter(Boolean); }

/* ---------- CHILDREN ---------- */
function renderChildren(el) {
  var html = head("Children", "Private by default. A child profile is never shown in search. Only your hired carer sees the day parts, after you share them.");
  html += '<div class="card"><h2>Add a child</h2><div class="grid2">' +
    '<label>First name or nickname<input id="kName" type="text" placeholder="Mila">' +
    '<label>Birthday<input id="kDob" type="date">' +
    '<label>Theme<select id="kTheme">' + CHILD_THEMES.map(function (t) { return '<option value="' + t.id + '">' + t.name + "</option>"; }).join("") + "</select>" +
    '<label>Colour<input id="kColor" type="color" value="#C9718A">' +
    '</div><label>Allergies and health notes<textarea id="kAllergy" rows="2" placeholder="Peanut allergy. EpiPen in the kitchen drawer."></textarea>' +
    '<label>Notes for the carer<textarea id="kNotes" rows="2" placeholder="Loves the blue cup. Naps after lunch."></textarea>' +
    '<button class="primaryBtn" id="kAdd">Add child</button></div>';
  if (state.children.length) {
    html += '<div class="cgGrid">' + state.children.map(function (c) {
      var t = CHILD_THEMES.find(function (x) { return x.id === c.theme; }) || CHILD_THEMES[0];
      return '<div class="kidCard"><div class="cgHead"><div class="avatar themeAvatar" style="background:' + esc(c.color) + '22;color:' + esc(c.color) + '">' + themeSvg(t.id) + '</div><div><div class="cgName">' + esc(c.name) + '</div><div class="cgMeta">' + (c.dob ? "Born " + esc(c.dob) : "") + " · " + t.name + ' theme</div></div></div>' +
        (c.allergies ? '<p><b>Health:</b> ' + esc(c.allergies) + "</p>" : "") + (c.notes ? "<p>" + esc(c.notes) + '</p>' : "") + '<button class="pillBtn danger" data-delkid="' + c.id + '">Remove</button></div>';
    }).join("") + "</div>";
  } else html += emptyState(svgWrap(THEME_SVG.flowers), "No children added yet. Add one and their Day Story gets its own cute theme.", "Add in the form above", "children");
  el.innerHTML = html; bindGo(el);
  $("kAdd").addEventListener("click", function () {
    var name = $("kName").value.trim(); if (!name) { toast("Give the child a name first."); return; }
    state.children.push({ id: uid("kid"), name: name, dob: $("kDob").value, theme: $("kTheme").value, color: $("kColor").value, allergies: $("kAllergy").value.trim(), notes: $("kNotes").value.trim() });
    save(); render(); toast(name + " added.");
  });
  Array.prototype.forEach.call(el.querySelectorAll("[data-delkid]"), function (b) { b.addEventListener("click", function () { state.children = state.children.filter(function (c) { return c.id !== b.dataset.delkid; }); save(); render(); }); });
}

/* ---------- DAY STORY ---------- */
function renderDayStory(el) {
  var html = head("Day Story", "One tap tiles build the day, like a story in a calendar. Safety tiles always tell the parents and wait for an OK.");
  if (!state.children.length) { el.innerHTML = html + emptyState(svgWrap(TILE_SVG.note), "Add a child first, and their story can start.", "Go to Children", "children"); bindGo(el); return; }
  var kid = state.children.find(function (c) { return c.id === storyKidId; }) || state.children[0];
  storyKidId = kid.id;
  var kidLog = state.log.filter(function (e) { return e.childId === kid.id; });
  var dayEntries = kidLog.filter(function (e) { return e.at.slice(0, 10) === storyDate; }).sort(function (a, b) { return a.at < b.at ? -1 : 1; });
  var sum = L.daySummary(kidLog, storyDate);
  html += '<div class="card"><h2>Whose story?</h2><div class="chipRow">' + state.children.map(function (c) { var t = CHILD_THEMES.find(function (x) { return x.id === c.theme; }) || CHILD_THEMES[0]; return '<button class="chip' + (c.id === kid.id ? " on" : "") + '" data-kid="' + c.id + '">' + esc(c.name) + "</button>"; }).join("") + '</div><p class="hint">Tiles, the day list, the summary and the month below all belong to ' + esc(kid.name) + ".</p></div>";
  html += '<div class="card"><div class="row"><label style="margin:0">Day<input id="storyDay" type="date" value="' + storyDate + '"></label>' +
    (napTimer ? '<span class="badge badgeWarn">Nap running since ' + napTimer + '</span>' : "") + "</div>" +
    '<div class="tileGrid" style="margin-top:12px">' + LOG_TILES.map(function (t) { return '<button class="tileBtn ' + t.kind + '" data-tile="' + t.id + '"><span class="tIcon">' + tileSvg(t.id) + "</span>" + t.name + "</button>"; }).join("") + "</div>" +
    '<p class="hint">Tap a tile and it is logged at the time now, with a short note if you want one. A nap tap starts the timer, the next nap tap stops it.</p></div>';
  html += '<div class="card"><h2>The story of ' + storyDate + '</h2>' +
    (dayEntries.length ? dayEntries.map(function (e) {
      var t = LOG_TILES.find(function (x) { return x.id === e.tile; }) || LOG_TILES[13];
      var safety = t.kind === "safety";
      return '<div class="storyItem"><div class="storyIcon">' + tileSvg(t.id) + '</div><div style="flex:1"><b>' + t.name + '</b> <span class="storyTime">' + e.at.slice(11, 16) + " · " + esc(kid.name) + "</span><br>" + esc(e.note) + (safety ? (e.ack ? ' <span class="badge badgeOk">Parent OK</span>' : ' <button class="pillBtn" data-ack="' + e.id + '">Parent: tap OK</button>') : "") + '</div><button class="pillBtn danger" data-dellog="' + e.id + '">Delete</button></div>';
    }).join("") : '<p class="hint">Nothing logged this day yet. Tap a tile above and the story begins.</p>') +
    '<h3>End of day summary</h3><p>' + sum.count + " moments · " + sum.meals + " meals · " + sum.naps + " naps" + (sum.mood ? " · Mood: " + esc(sum.mood) : "") + (sum.highlight ? "<br>★ Highlight: " + esc(sum.highlight) : "") + (sum.safety ? "<br>" + sum.safety + " safety note(s) today." : "") + "</p></div>";
  html += '<div class="card"><h2>This month</h2><div id="storyCal"></div></div>';
  el.innerHTML = html; bindGo(el);
  Array.prototype.forEach.call(el.querySelectorAll("[data-kid]"), function (b) { b.addEventListener("click", function () { storyKidId = b.dataset.kid; render(); }); });
  $("storyDay").addEventListener("change", function () { storyDate = $("storyDay").value || todayStr(); render(); });
  Array.prototype.forEach.call(el.querySelectorAll("[data-tile]"), function (b) { b.addEventListener("click", function () { logTile(b.dataset.tile, kid); }); });
  Array.prototype.forEach.call(el.querySelectorAll("[data-ack]"), function (b) { b.addEventListener("click", function () { var e = state.log.find(function (x) { return x.id === b.dataset.ack; }); if (e) e.ack = true; save(); render(); toast("Thanks. The carer can see your OK."); }); });
  Array.prototype.forEach.call(el.querySelectorAll("[data-dellog]"), function (b) { b.addEventListener("click", function () { state.log = state.log.filter(function (x) { return x.id !== b.dataset.dellog; }); save(); render(); }); });
  renderStoryCal($("storyCal"), kid.id);
}
function logTile(tileId, kid) {
  var t = LOG_TILES.find(function (x) { return x.id === tileId; });
  if (tileId === "nap" && napTimer) {
    var mins = Math.max(1, Math.round((Date.now() - napTimer) / 60000));
    state.log.push({ id: uid("log"), childId: kid.id, tile: "nap", note: "Slept " + mins + " minutes", at: new Date().toISOString().slice(0, 19), ack: false });
    napTimer = null; save(); storyDate = todayStr(); render(); toast("Nap saved: " + mins + " minutes."); return;
  }
  $("modalCard").innerHTML = "<h2>" + t.name + "</h2>" +
    (t.kind === "safety" ? '<p class="hint">Safety notes tell the parents right away and wait for their OK.</p>' : "") +
    (tileId === "mood" ? '<div class="chipRow">' + ["Happy", "Okay", "Upset", "Tired", "Unwell"].map(function (mmood) { return '<button class="chip" data-mood="' + mmood + '">' + mmood + "</button>"; }).join("") + "</div>" : "") +
    '<label>Short note<textarea id="tileNote" rows="2" placeholder="A few words"></textarea></label>' +
    (tileId === "photo" ? '<label>Photo<input id="tilePhoto" type="file" accept="image/*"></label><p class="hint">Photos stay on this device in this version.</p>' : "") +
    '<div class="row"><button class="primaryBtn" id="tileSave">Save to the story</button><button class="pillBtn" id="tileCancel">Cancel</button></div>';
  $("modal").classList.remove("hidden");
  var moodPick = "";
  Array.prototype.forEach.call($("modalCard").querySelectorAll("[data-mood]"), function (b) { b.addEventListener("click", function () { moodPick = b.dataset.mood; Array.prototype.forEach.call($("modalCard").querySelectorAll("[data-mood]"), function (x) { x.classList.remove("on"); }); b.classList.add("on"); }); });
  $("tileCancel").addEventListener("click", closeModal);
  $("tileSave").addEventListener("click", function () {
    var note = $("tileNote").value.trim();
    if (tileId === "mood" && moodPick) note = moodPick + (note ? ". " + note : "");
    if (tileId === "nap") { napTimer = Date.now(); closeModal(); render(); toast("Nap timer started."); return; }
    var fileEl = $("tilePhoto");
    function pushEntry(finalNote) {
      state.log.push({ id: uid("log"), childId: kid.id, tile: tileId, note: finalNote, at: new Date().toISOString().slice(0, 19), ack: false });
      save(); closeModal(); storyDate = todayStr(); render(); toast(t.name + " added to the story.");
    }
    if (tileId === "photo" && fileEl && fileEl.files && fileEl.files[0]) {
      var reader = new FileReader();
      reader.onload = function () { pushEntry(note + " [Photo saved on this device]"); };
      reader.readAsDataURL(fileEl.files[0]);
    } else pushEntry(note);
  });
}
function renderStoryCal(root, kidId) {
  if (!root) return;
  var base = new Date(storyDate + "T12:00:00");
  var year = base.getFullYear(), month = base.getMonth();
  var first = new Date(year, month, 1);
  var startDay = (first.getDay() + 6) % 7;
  var daysIn = new Date(year, month + 1, 0).getDate();
  var cells = "";
  for (var i = 0; i < startDay; i++) cells += '<div class="calCell dim"></div>';
  for (var d = 1; d <= daysIn; d++) {
    var ds = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    var items = state.log.filter(function (e) { return e.at.slice(0, 10) === ds && e.childId === kidId; });
    cells += '<div class="calCell' + (ds === todayStr() ? " today" : "") + '"><div class="calDay">' + d + "</div>" + items.slice(0, 3).map(function (e) { var t = LOG_TILES.find(function (x) { return x.id === e.tile; }) || LOG_TILES[13]; return '<div class="calItem">' + t.name + "</div>"; }).join("") + (items.length > 3 ? '<div class="calItem">+' + (items.length - 3) + " more</div>" : "") + "</div>";
  }
  root.innerHTML = '<div class="calGrid">' + cells + "</div>";
}

/* ---------- ROSTER ---------- */
function renderRoster(el) {
  var html = head("Roster", "The week, in one look. Shifts sit inside your country scheme cap for au pairs.");
  html += '<div class="card"><h2>Add a shift</h2><div class="grid2">' +
    '<label>Carer<select id="rCg">' + SEED_CAREGIVERS.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + " · " + roleName(c.role) + "</option>"; }).join("") + "</select>" +
    '<label>Day<select id="rDay">' + DAYNAMES.map(function (d, i) { return '<option value="' + i + '">' + d + "</option>"; }).join("") + "</select>" +
    '<label>Start<input id="rStart" type="time" value="08:00">' +
    '<label>End<input id="rEnd" type="time" value="16:00">' +
    '</div><label>Note<input id="rNote" type="text" placeholder="School pick up at 3">' +
    '<button class="primaryBtn" id="rAdd">Add shift</button> <span class="hint" id="rMsg"></span></div>';
  html += '<div class="card"><h2>This week</h2>';
  if (!state.roster.length) html += '<p class="hint">No shifts yet. Add one above and the week fills in here.</p>';
  else {
    html += "<table><tr><th>Day</th><th>Carer</th><th>Time</th><th>Note</th><th></th></tr>" + state.roster.slice().sort(function (a, b) { return a.day - b.day; }).map(function (r) {
      var cg = cgById(r.cgId);
      var hrs = (new Date("2026-01-01T" + r.end) - new Date("2026-01-01T" + r.start)) / 3600000;
      var capNote = "";
      if (cg && (cg.role === "aupair" || cg.role === "demipair")) {
        var weekHrs = state.roster.filter(function (x) { return x.cgId === r.cgId; }).reduce(function (s, x) { return s + (new Date("2026-01-01T" + x.end) - new Date("2026-01-01T" + x.start)) / 3600000; }, 0);
        if (weekHrs > 30) capNote = ' <span class="badge badgeBad">Over a 30 hour week. Check your country cap</span>';
      }
      return "<tr><td>" + DAYNAMES[r.day] + "</td><td>" + (cg ? esc(cg.name) : "?") + "</td><td>" + esc(r.start) + " to " + esc(r.end) + " (" + (isFinite(hrs) ? hrs.toFixed(1) : "?") + " h)" + capNote + "</td><td>" + esc(r.note) + '</td><td><button class="pillBtn danger" data-delros="' + r.id + '">Remove</button></td></tr>';
    }).join("") + "</table>";
  }
  html += "</div>";
  el.innerHTML = html;
  $("rAdd").addEventListener("click", function () {
    state.roster.push({ id: uid("ros"), cgId: $("rCg").value, day: Number($("rDay").value), start: $("rStart").value, end: $("rEnd").value, note: $("rNote").value.trim() });
    save(); render(); toast("Shift added.");
  });
  Array.prototype.forEach.call(el.querySelectorAll("[data-delros]"), function (b) { b.addEventListener("click", function () { state.roster = state.roster.filter(function (r) { return r.id !== b.dataset.delros; }); save(); render(); }); });
}

/* ---------- TIMESHEET ---------- */
function renderTimesheet(el) {
  var html = head("Timesheet", "Hours in, approved by the family, ready for pay day. Pay day maths uses the pay in the agreement.");
  html += '<div class="card"><h2>Add hours</h2><div class="grid2">' +
    '<label>Carer<select id="tCg">' + SEED_CAREGIVERS.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + "</option>"; }).join("") + "</select>" +
    '<label>Date<input id="tDate" type="date" value="' + todayStr() + '">' +
    '<label>Hours<input id="tHours" type="number" min="0" step="0.25" value="8">' +
    '<label>Rate per hour (or pocket money amount)<input id="tRate" type="number" min="0" value="35">' +
    '</div><button class="primaryBtn" id="tAdd">Add entry</button></div>';
  if (state.timesheets.length) {
    var totalWait = 0, totalOk = 0;
    html += '<div class="card"><h2>Entries</h2><table><tr><th>Date</th><th>Carer</th><th>Hours</th><th>Pay</th><th>Status</th><th></th></tr>' + state.timesheets.map(function (t) {
      var cg = cgById(t.cgId); var pay = t.hours * t.rate;
      if (t.status === "approved") totalOk += pay; else totalWait += pay;
      return "<tr><td>" + esc(t.date) + "</td><td>" + (cg ? esc(cg.name) : "?") + "</td><td>" + t.hours + "</td><td>" + pay.toFixed(2) + '</td><td>' + (t.status === "approved" ? '<span class="badge badgeOk">Approved</span>' : '<span class="badge badgeWarn">Waiting</span>') + '</td><td>' + (t.status !== "approved" ? '<button class="pillBtn" data-approve="' + t.id + '">Approve</button>' : "") + "</td></tr>";
    }).join("") + "</table><p><b>Approved total:</b> " + totalOk.toFixed(2) + " · <b>Waiting:</b> " + totalWait.toFixed(2) + "</p></div>";
  } else html += emptyState(svgWrap(TILE_SVG.arrival), "No hours yet. When care happens, the hours land here for a quick approve.", "Add hours above", "timesheet");
  el.innerHTML = html; bindGo(el);
  $("tAdd").addEventListener("click", function () {
    state.timesheets.push({ id: uid("ts"), cgId: $("tCg").value, date: $("tDate").value, hours: Math.max(0, Number($("tHours").value) || 0), rate: Math.max(0, Number($("tRate").value) || 0), status: "waiting" });
    save(); render(); toast("Hours added. The family can approve them here.");
  });
  Array.prototype.forEach.call(el.querySelectorAll("[data-approve]"), function (b) { b.addEventListener("click", function () { var t = state.timesheets.find(function (x) { return x.id === b.dataset.approve; }); if (t) t.status = "approved"; save(); render(); }); });
}

/* ---------- TRUST CENTRE + COUNTRY PACKS ---------- */
var WWCC_LINKS = [["NSW", "https://www.service.nsw.gov.au"], ["QLD Blue Card", "https://www.bluecard.qld.gov.au"], ["VIC", "https://www.service.vic.gov.au"], ["WA", "https://www.wa.gov.au"], ["SA", "https://www.sa.gov.au"], ["TAS", "https://www.service.tas.gov.au"], ["ACT", "https://www.accesscanberra.act.gov.au"], ["NT", "https://nt.gov.au"]];
function renderTrust(el) {
  var p = pack();
  var html = head("Checks and Documents", "Badges say exactly what was checked. Verified means seen on the free official register. Sighted means a person saw the paper. Self declared means the carer says so, and nothing was checked yet.");
  html += '<div class="card"><h2>' + p.flag + " " + p.name + '</h2><p>' + esc(p.scheme) + "</p><h3>Must have for a hire here</h3><ul class=\"reasonList\">" + p.mandatory.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul><h3>Nice to have (badges only, never a block)</h3><ul class=\"reasonList\">" + p.optional.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + '</ul><p class="hint">' + esc(p.payNote) + '</p><p class="hint">This pack is a guide from official sources, checked October 2026. It is not legal advice. Rules change, so the yearly review in Settings matters.</p></div>';
  if (state.country === "AU") html += '<div class="card"><h2>Check a WWCC number free</h2><p class="hint">Checking is free in every state. The app never sells a check and never asks a carer to buy one to join. A family can choose to pay or pay back the application fee, but that is the family\u2019s choice, never a rule here.</p><div class="chipRow">' + WWCC_LINKS.map(function (x) { return '<a class="chip" href="' + x[1] + '" target="_blank" rel="noopener">' + x[0] + " ↗</a>"; }).join("") + "</div></div>";
  html += '<div class="card"><h2>My documents</h2><div class="grid2">' +
    '<label>Document name<input id="dName" type="text" placeholder="Working With Children Check">' +
    '<label>Kind<select id="dKind"><option>Children check</option><option>Police check</option><option>First aid</option><option>ID</option><option>Registration</option><option>Other</option></select>' +
    '<label>How it was checked<select id="dState"><option value="verified">Verified on the official register (free)</option><option value="sighted">Document sighted</option><option value="self">Self declared</option></select>' +
    '<label>Expiry date<input id="dExpiry" type="date">' +
    '</div><button class="primaryBtn" id="dAdd">Add document</button></div>';
  if (state.docs.length) {
    html += '<div class="card"><h2>On file</h2>' + state.docs.map(function (d) {
      var st = L.expiryStatus(d.expiry, todayStr());
      var badge = d.state === "verified" ? '<span class="badge badgeOk">Register verified</span>' : d.state === "sighted" ? '<span class="badge badgeSoft">Document sighted</span>' : '<span class="badge badgeWarn">Self declared</span>';
      var exp = st === "expired" ? ' <span class="badge badgeBad">Expired ' + esc(d.expiry) + "</span>" : st === "soon" ? ' <span class="badge badgeWarn">Expires soon: ' + esc(d.expiry) + "</span>" : d.expiry ? ' <span class="badge badgeSoft">Until ' + esc(d.expiry) + "</span>" : "";
      return '<div class="storyItem"><div class="storyIcon">' + svgWrap('<path d="M12 3l7 2.5v5c0 5-3 8.5-7 10.5C8 19 5 15.5 5 10.5v-5z"/>') + '</div><div style="flex:1"><b>' + esc(d.name) + "</b> · " + esc(d.kind) + "<br>" + badge + exp + '</div><button class="pillBtn danger" data-deldoc="' + d.id + '">Remove</button></div>';
    }).join("") + "</div>";
  }
  html += '<div class="card"><h2>Agreement builder</h2><p class="hint">Answer three things and the app drafts the heads of your agreement in plain words: names, days, pay, the room (for live in), notice both ways, and a mediation step before anyone walks out. It is a starting draft, not legal advice.</p><button class="primaryBtn" id="agreeBtn">Draft my agreement</button><div id="agreeOut"></div></div>';
  html += '<div class="card"><h2>Safety, in plain words</h2><p class="hint">No check can prove a person is safe. Checks are one layer. Meeting in person, phoning references, a paid trial, and listening to your child are the other layers. Children\u2019s photos and health notes are the most private things in this app: they stay on this device in this version, and child profiles are never shown in search.</p></div>';
  el.innerHTML = html;
  $("dAdd").addEventListener("click", function () {
    var name = $("dName").value.trim(); if (!name) { toast("Name the document first."); return; }
    state.docs.push({ id: uid("doc"), name: name, kind: $("dKind").value, state: $("dState").value, expiry: $("dExpiry").value });
    save(); render(); toast("Document added.");
  });
  Array.prototype.forEach.call(el.querySelectorAll("[data-deldoc]"), function (b) { b.addEventListener("click", function () { state.docs = state.docs.filter(function (d) { return d.id !== b.dataset.deldoc; }); save(); render(); }); });
  $("agreeBtn").addEventListener("click", function () {
    var isAuPair = state.role === "aupair" || state.role === "demipair";
    var daysTxt = state.answers.days.map(function (d, i) { return d ? DAYNAMES[i] : null; }).filter(Boolean).join(", ") || "days to agree";
    $("agreeOut").innerHTML = '<div class="card" style="margin-top:12px"><h3>Agreement draft · ' + roleName(state.role) + " · " + p.name + "</h3><p>" +
      "Between the family (" + esc(state.family.name || "family name") + ", " + esc(state.family.suburb || "suburb") + ") and the carer.<br>" +
      "Care days: " + daysTxt + ". Children\u2019s ages: " + (state.answers.ages.join(", ") || "to agree") + ".<br>" +
      (isAuPair ? "Pocket money as in the country pack for " + p.name + ", paid by bank transfer. Room and board are on top, never taken out of pocket money. Hours stay inside the scheme cap." : "Pay is a gross wage at or above the floor in the country pack for " + p.name + ", with a pay record each pay day.") + "<br>" +
      "Notice: two weeks in writing, both ways. If it is not working: talk first, then a mediated talk, then a rematch or a fair end. A live in carer always gets a fair time to find a new home after notice.<br>" +
      "House rules, emergency numbers and pick up people live in the Emergency page of the app and form part of this agreement.</p>" +
      '<p class="hint">Draft only. For a real hire, have it checked against the official rules for ' + p.name + ".</p></div>";
  });
}

/* ---------- EMERGENCY + HOUSE INFO ---------- */
function renderEmergency(el) {
  var e = state.emergency;
  var html = head("Emergency and House Info", "One page the carer can open in seconds. Keep it true and short.");
  function field(key, label, ph) { return '<label>' + label + '<input id="em_' + key + '" type="text" placeholder="' + ph + '" value="' + esc(e[key]) + '">'; }
  html += '<div class="card"><div class="grid2">' +
    field("contact1", "Parent one phone", "Name and number") + field("contact2", "Parent two or backup phone", "Name and number") +
    field("doctor", "Doctor and clinic", "Clinic name and phone") + field("address", "Home address", "Street and suburb") +
    '</div><label>Who may pick up the children<textarea id="em_pickups" rows="2">' + esc(e.pickups) + '</textarea>' +
    '<label>House notes: alarms, gates, pets, wifi<textarea id="em_houseNotes" rows="3">' + esc(e.houseNotes) + '</textarea>' +
    (state.children.length ? '<h3>Children health notes</h3>' + state.children.map(function (c) { return "<p><b>" + esc(c.name) + ":</b> " + esc(c.allergies || "No health notes added.") + "</p>"; }).join("") : "") +
    '<div class="row"><button class="primaryBtn" id="emSave">Save</button><button class="pillBtn" id="emPrint">Print this page</button></div>' +
    '<p class="hint">In a real emergency, always call your local emergency number first.</p></div>';
  el.innerHTML = html;
  $("emSave").addEventListener("click", function () {
    ["contact1", "contact2", "doctor", "address"].forEach(function (k) { state.emergency[k] = $("em_" + k).value.trim(); });
    state.emergency.pickups = $("em_pickups").value.trim(); state.emergency.houseNotes = $("em_houseNotes").value.trim();
    save(); toast("Emergency page saved.");
  });
  $("emPrint").addEventListener("click", function () { window.print(); });
}

/* ---------- REVIEWS ---------- */
function renderReviews(el) {
  var html = head("Reviews", "Two way and fair. A family reviews a carer, the carer can reply, and response habits are shown as facts, never as attacks.");
  html += '<div class="card"><h2>Write a review</h2><div class="grid2">' +
    '<label>Carer<select id="vCg">' + SEED_CAREGIVERS.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + "</option>"; }).join("") + "</select>" +
    '<label>Stars<select id="vStars">' + [5, 4, 3, 2, 1].map(function (s) { return "<option value=\"" + s + "\">" + "★".repeat(s) + "</option>"; }).join("") + "</select>" +
    '</div><label>Your words<textarea id="vText" rows="3" placeholder="What was the care really like?"></textarea>' +
    '<button class="primaryBtn" id="vAdd">Add review</button></div>';
  if (state.reviews.length) {
    html += state.reviews.map(function (r) {
      var cg = cgById(r.cgId);
      return '<div class="card"><b>' + "★".repeat(r.stars) + "</b> for " + (cg ? esc(cg.name) : "?") + ' <span class="storyTime">' + esc(r.when) + "</span><p>" + esc(r.text) + "</p>" +
        (r.reply ? '<p class="hint">Carer reply: ' + esc(r.reply) + "</p>" : '<div class="row"><input id="reply_' + r.id + '" type="text" placeholder="Carer reply" style="flex:1"><button class="pillBtn" data-reply="' + r.id + '">Reply</button></div>') + "</div>";
    }).join("");
  } else html += emptyState(svgWrap(TILE_SVG.milestone), "No reviews yet. They appear here after care happens.", "Back to Home", "home");
  el.innerHTML = html; bindGo(el);
  $("vAdd").addEventListener("click", function () {
    var t = $("vText").value.trim(); if (!t) { toast("Write a few words first."); return; }
    state.reviews.push({ id: uid("rev"), cgId: $("vCg").value, when: todayStr(), stars: Number($("vStars").value), text: t, reply: "" });
    save(); render(); toast("Review added.");
  });
  Array.prototype.forEach.call(el.querySelectorAll("[data-reply]"), function (b) { b.addEventListener("click", function () { var r = state.reviews.find(function (x) { return x.id === b.dataset.reply; }); var inp = $("reply_" + b.dataset.reply); if (r && inp && inp.value.trim()) { r.reply = inp.value.trim(); save(); render(); } }); });
}

/* ---------- REMINDERS ---------- */
function upcomingReminders() {
  var out = [];
  var today = todayStr();
  state.docs.forEach(function (d) { var st = L.expiryStatus(d.expiry, today); if (st === "soon") out.push({ text: d.name + " expires on " + d.expiry, date: d.expiry }); if (st === "expired") out.push({ text: d.name + " has expired. Renew it soon.", date: today }); });
  state.reminders.forEach(function (r) { out.push(r); });
  state.hires.forEach(function (h) { var cg = cgById(h.cgId); out.push({ text: "Trial with " + (cg ? cg.name : "carer") + " started " + h.startDate + ". Book the check in chat this week.", date: today }); });
  return out;
}
function renderReminders(el) {
  var html = head("Reminders", "Gentle, and only about care. The day before rule: anything dated gets one quiet reminder the day before, if notifications are on.");
  html += '<div class="card"><h2>Notifications</h2><p class="hint">Status: ' + (state.notifOn ? "on for this device" : "off") + '. Reminders can only appear while the app can run on this device. True background push needs a server, which is a later step.</p><div class="row"><button class="primaryBtn" id="remNotif">Turn on notifications</button><button class="pillBtn" id="remTest">Send a test</button></div></div>';
  html += '<div class="card"><h2>Add a reminder</h2><div class="grid2"><label>What<input id="remText" type="text" placeholder="Book the trial shift"><label>When<input id="remDate" type="date" value="' + todayStr() + '"></div><button class="primaryBtn" id="remAdd">Add reminder</button></div>';
  var ups = upcomingReminders();
  html += '<div class="card"><h2>Coming up</h2>' + (ups.length ? ups.map(function (u) { return '<div class="storyItem"><div class="storyIcon">' + svgWrap(BELL_SVG) + '</div><div><b>' + esc(u.text) + '</b><br><span class="storyTime">' + esc(u.date) + "</span></div></div>"; }).join("") : '<p class="hint">Nothing coming up. Quiet is good.</p>') + "</div>";
  el.innerHTML = html;
  $("remNotif").addEventListener("click", askNotifs);
  $("remTest").addEventListener("click", function () { if (state.notifOn && "Notification" in window) new Notification("Caresits", { body: "This is your test reminder." }); else toast("Turn notifications on first."); });
  $("remAdd").addEventListener("click", function () { var t = $("remText").value.trim(); if (!t) return; state.reminders.push({ id: uid("rem"), text: t, date: $("remDate").value }); save(); render(); });
}

/* ---------- SETTINGS ---------- */
function renderSettings(el) {
  var html = head("Settings", "Make the app yours. Everything here is saved on this device.");
  html += '<div class="card"><h2>Appearance</h2><p class="hint">Pick the background the app wears. Words stay easy to read on every choice.</p><div class="chipRow">' +
    [["brand", "Brand colours"], ["white", "White"], ["black", "Black"], ["photo", "Your photo"]].map(function (t) { return '<button class="chip' + (state.theme === t[0] ? " on" : "") + '" data-bg="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>" +
    '<input type="file" id="bgFile" accept="image/*" class="hidden">' +
    '<div class="row"><button class="pillBtn" id="bgChange">' + (state.bgPhoto ? "Change photo" : "Choose a photo") + "</button>" + (state.bgPhoto ? '<button class="pillBtn danger" id="bgRemove">Remove photo</button>' : "") + "</div>" +
    '<p class="hint">Your photo stays on this device. A soft veil sits behind the words so they always read clearly.</p>' +
    '<label>Cute mode<select id="sCute"><option value="on"' + (state.cute ? " selected" : "") + '>On: round and soft</option><option value="off"' + (!state.cute ? " selected" : "") + ">Off: calm and plain</option></select></div>";
  html += '<div class="card"><h2>Country and role</h2><p class="hint">Changing these runs matching again from scratch, because the rules and the right questions change with them.</p><div class="grid2">' +
    '<label>Country<select id="sCountry">' + COUNTRIES.map(function (c) { return '<option value="' + c.code + '"' + (state.country === c.code ? " selected" : "") + ">" + c.flag + " " + c.name + "</option>"; }).join("") + "</select>" +
    '<label>Role<select id="sRole">' + ROLES.map(function (r) { return '<option value="' + r.id + '"' + (state.role === r.id ? " selected" : "") + ">" + r.name + "</option>"; }).join("") + "</select>" +
    '<label>I am a<select id="sSide"><option value="family"' + (state.side === "family" ? " selected" : "") + '>Family</option><option value="caregiver"' + (state.side === "caregiver" ? " selected" : "") + ">Carer</option></select></div></div>";
  html += '<div class="card"><h2>Your data</h2><p class="hint">Everything is on this device only. No account, no server, no tracking in this version.</p><div class="row"><button class="pillBtn" id="sPrivacy">Privacy policy</button><button class="pillBtn" id="sExport">Download my data</button><button class="pillBtn danger" id="sReset">Start again (clears this device)</button></div></div>';
  html += '<div class="card"><h2>Yearly review</h2><p class="hint">Country packs carry prices and rules that change. A review task belongs on the calendar once a year: check each pack against its official source, update the figures, and note the date it was checked.</p></div>';
  html += '<div class="card"><h2>About</h2><p class="hint">Caresits. Built from real research into what families and carers hate about the big platforms: paywalls before a first hello, checks nobody checked, and silence after the hire. Here, the first hello is free, badges say what was really seen, and the app stays for the whole placement.</p></div>';
  el.innerHTML = html;
  Array.prototype.forEach.call(el.querySelectorAll("[data-bg]"), function (b) { b.addEventListener("click", function () { if (b.dataset.bg === "photo" && !state.bgPhoto) { $("bgFile").click(); return; } state.theme = b.dataset.bg; save(); render(); }); });
  $("bgChange").addEventListener("click", function () { $("bgFile").click(); });
  var bgRemove = $("bgRemove"); if (bgRemove) bgRemove.addEventListener("click", function () { state.bgPhoto = ""; if (state.theme === "photo") state.theme = "brand"; save(); render(); toast("Photo removed. It is gone from this device."); });
  $("bgFile").addEventListener("change", function () { var f = $("bgFile").files[0]; if (!f) return; var url = URL.createObjectURL(f); var img = new Image(); img.onload = function () { var scale = Math.min(1, 1280 / Math.max(img.width, img.height)); var cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(img.width * scale)); cv.height = Math.max(1, Math.round(img.height * scale)); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); state.bgPhoto = cv.toDataURL("image/jpeg", 0.82); state.theme = "photo"; save(); render(); toast("Your photo is the background now."); }; img.src = url; });
  $("sCute").addEventListener("change", function () { state.cute = $("sCute").value === "on"; save(); });
  $("sCountry").addEventListener("change", function () { state.country = $("sCountry").value; save(); toast("Country set to " + pack().name + ". Matching ran again."); render(); });
  $("sRole").addEventListener("change", function () { state.role = $("sRole").value; if (state.role === "aupair" || state.role === "demipair") state.answers.liveIn = "in"; save(); toast("Role set to " + roleName(state.role) + "."); render(); });
  $("sSide").addEventListener("change", function () { state.side = $("sSide").value; save(); render(); });
  $("sPrivacy").addEventListener("click", function () { go("privacy"); });
  $("sExport").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "caresits-data.json"; a.click(); URL.revokeObjectURL(a.href);
  });
  $("sReset").addEventListener("click", function () {
    var counts = state.children.length + " child profile(s), " + state.log.length + " day story entries, " + state.docs.length + " documents, " + state.timesheets.length + " timesheet entries, your roster, messages, reviews and settings";
    $("modalCard").innerHTML = "<h2>Start again?</h2><p>This clears everything on this device: " + counts + ". There is no undo. If you want a copy first, use Download my data above.</p>" +
      '<div class="row"><button class="primaryBtn" id="resetKeep">Keep my data</button><button class="pillBtn danger" id="resetYes">Yes, clear everything</button></div>';
    $("modal").classList.remove("hidden");
    $("resetKeep").addEventListener("click", closeModal);
    $("resetYes").addEventListener("click", function () { closeModal(); localStorage.removeItem(KEY); state = L.defaultState(); startStep = 0; storyKidId = null; save(); go("home"); toast(SEED_CAREGIVERS.length ? "Fresh start. Demo data is still in Find." : "Fresh start."); });
  });
}

function renderPrivacy(el) {
  var html = head("Privacy policy", "This page is the whole policy, in plain words.");
  html += '<div class="card"><h2>The short version</h2><p>Everything you put into this app stays on your phone. We do not collect it, we do not see it, and we cannot sell it or share it, because it never reaches us.</p></div>';
  html += '<div class="card"><h2>What the app keeps, and where</h2><p>The app stores the things you type and tap: your profile, your children profiles, your answers, your day story entries, your documents list, your roster, your timesheets, your messages, your reviews, and a background photo if you choose one. All of it is stored in the app storage on your own device, and nowhere else. This version has no account, no sign in, no server and no cloud copy. If you delete the app, or clear the app data, the record is gone. Settings offers a Download my data button, so you can keep a copy first, and a Start again button that clears everything on the device after you confirm.</p></div>';
  html += '<div class="card"><h2>What we collect</h2><p>Nothing. The app contains no analytics, no advertising, no tracking tools and no crash reporting. It makes no network calls at all. We do not know who uses the app, where they use it, or what they write in it.</p></div>';
  html += '<div class="card"><h2>Children</h2><p>Children do not use this app. Adults write about children in it: names, ages, routines, food, sleep, health notes and photos the adult chooses to note. All of that stays on the adult\u2019s device, under the adult\u2019s control. Child profiles are never shown in search or matching inside this version.</p></div>';
  html += '<div class="card"><h2>Links out of the app</h2><p>The Trust Centre links to official check registers and official rule pages for your country. Those links open in your browser, only when you tap them. The sites you visit there have their own privacy policies, and anything you type on those sites goes to them, not to us.</p></div>';
  html += SEED_CAREGIVERS.length
    ? '<div class="card"><h2>Demo content</h2><p>Profiles marked Demo inside the app are sample profiles we wrote to show how matching works. They are not real people, and no real person\u2019s data is in them.</p></div>'
    : '<div class="card"><h2>Demo content</h2><p>This edition of the app ships with no demo content at all. It starts empty, and everything in it is something you added.</p></div>';
  html += '<div class="card"><h2>Changes to this policy</h2><p>If a later version adds accounts, a server, or any data leaving the device, this policy will be rewritten before that version ships, and the store listing will say what changed.</p></div>';
  html += '<div class="card"><h2>Contact</h2><p>Questions about this policy go to the developer contact shown on the app store listing page for this app.</p><div class="row"><button class="pillBtn" data-go="settings">Open Settings</button></div></div>';
  el.innerHTML = html; bindGo(el);
}

/* ---------- BOOT ---------- */
$("sidebarToggle").addEventListener("click", function () { state.sidebarHidden = !state.sidebarHidden; save(); });
$("lioCorner").addEventListener("click", function () { state.guideHidden = false; save(); go("home"); toast("Lio is back. His card is on Home."); });
$("modal").addEventListener("click", function (e) { if (e.target === $("modal")) closeModal(); });
if ("serviceWorker" in navigator) { navigator.serviceWorker.register("service-worker.js").catch(function () {}); }
setInterval(function () {
  if (!state.notifOn || !("Notification" in window) || Notification.permission !== "granted") return;
  var today = todayStr();
  state.reminders.forEach(function (r) { if (r.date === today && !r.fired) { r.fired = true; new Notification("Caresits", { body: r.text }); } });
  save();
}, 30000);
buildNav(); paintChrome(); render();
