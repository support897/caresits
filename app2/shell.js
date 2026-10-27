import { applyI18n, t as tr } from "./lang.js";
applyI18n();
// Caresitters app2 shell — role-based bottom tabs, with the
// existing grouped menu under More. Menu-open state is not saved.
const $ = (s) => document.querySelector(s);
const layout = $("#layout");
const SOON = new Set([]);
const TITLES = {};
let activeNav = "home";

function setBottomActive(nav = activeNav) {
  const weekNav = ["calendar", "roster", "timesheet", "reminders"].includes(nav) ? "calendar" : nav;
  for (const button of document.querySelectorAll(".bottomTab")) {
    const active = !button.hidden && (button.dataset.nav === weekNav || (nav === "more" && button.dataset.openMore === "true"));
    button.classList.toggle("on", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
}
function refreshHomeSwitch() {
  const button = document.getElementById("homeSideSwitchBtn");
  const dialog = document.getElementById("homeSideSwitchDialog");
  if (button) button.hidden = !window.CARESITS_ME?.uid || activeNav !== "home";
  if (dialog && !window.CARESITS_ME?.uid) dialog.hidden = true;
}
function openMenu() { layout.classList.add("open"); setBottomActive("more"); }
function closeMenu() { layout.classList.remove("open"); setBottomActive(activeNav); }

function setRoleNavigation(entryRole) {
  const communicate = entryRole === "communicate";
  const career = entryRole === "career";
  const finding = document.querySelector('[data-group="finding"]');
  const family = document.querySelector('[data-group="family"]');
  const week = document.querySelector('[data-group="week"]');
  const conversations = document.getElementById("commMessages");
  if (finding) finding.hidden = communicate;
  if (family) family.hidden = career || communicate;
  if (week) week.hidden = communicate;
  if (conversations) conversations.hidden = !communicate;
  for (const button of document.querySelectorAll("[data-bottom-role]")) button.hidden = button.dataset.bottomRole !== entryRole;
  setBottomActive(activeNav);
}
window.CARESITS_ROLE_NAV = setRoleNavigation;
const ACTIVE_SIDES = ["family", "career", "communicate"];
function resolvedActiveSide(me = window.CARESITS_ME || {}) {
  if (ACTIVE_SIDES.includes(me.activeSide)) return me.activeSide;
  if (ACTIVE_SIDES.includes(me.entryRole)) return me.entryRole;
  return me.side === "carer" ? "career" : me.side === "communicate" ? "communicate" : "family";
}
function refreshSideSwitch(side = resolvedActiveSide()) {
  const box = document.getElementById("sideSwitch");
  if (!box) return;
  const me = window.CARESITS_ME || {};
  box.hidden = !me.uid;
  const buttons = [...document.querySelectorAll("[data-side-choice]")];
  for (const button of buttons) {
    const selected = button.dataset.sideChoice === side;
    button.classList.toggle("on", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }
  const selectedButton = [...box.querySelectorAll("[data-side-choice]")].find((button) => button.dataset.sideChoice === side);
  const name = document.getElementById("activeSideName");
  if (name) name.textContent = selectedButton?.textContent || "";
  refreshHomeSwitch();
}
async function setActiveSide(side) {
  if (!ACTIVE_SIDES.includes(side)) return false;
  const previous = resolvedActiveSide();
  const me = window.CARESITS_ME || {};
  if (!me.uid) return false;
  for (const button of document.querySelectorAll("[data-side-choice]")) button.disabled = true;
  window.CARESITS_ME = { ...me, activeSide: side };
  document.documentElement.dataset.entryRole = side;
  setRoleNavigation(side);
  refreshSideSwitch(side);
  let result = null;
  try {
    if (typeof window.CARESITS_WRITE === "function") result = await window.CARESITS_WRITE("active-side", { side });
  } catch { result = null; }
  for (const button of document.querySelectorAll("[data-side-choice]")) button.disabled = false;
  const status = document.getElementById("sideSwitchStatus");
  if (!result?.ok) {
    window.CARESITS_ME = { ...window.CARESITS_ME, activeSide: previous };
    document.documentElement.dataset.entryRole = previous;
    setRoleNavigation(previous);
    refreshSideSwitch(previous);
    if (status) status.textContent = tr("shell.sideSaveFailed");
    return false;
  }
  if (status) status.textContent = "";
  document.getElementById("homeSideSwitchDialog").hidden = true;
  show("home");
  window.CARESITS_RENDER_HOME?.();
  if (typeof window.CARESITS_TOUR_START_SIDE === "function") window.CARESITS_TOUR_START_SIDE(side);
  return true;
}
window.CARESITS_SET_ACTIVE_SIDE = setActiveSide;
document.querySelectorAll("[data-side-choice]").forEach((button) => button.addEventListener("click", () => setActiveSide(button.dataset.sideChoice)));
document.addEventListener("caresits-account-ready", () => {
  const side = resolvedActiveSide();
  document.documentElement.dataset.entryRole = side;
  setRoleNavigation(side);
  refreshSideSwitch(side);
});
setRoleNavigation(resolvedActiveSide());
refreshSideSwitch();

// The Family Plus gate (payments chapter §2 + FEATURE-SPLIT): the
// Day Story, the roster and the timesheet are Family Plus features
// for families. The gate sits here, at the one nav choke point
// every entry rides, and it is narrow by construction: demo and
// signed out previews carry no member seam and never gate; carers
// never gate (no tiers for carers, ever); a family whose resolved
// plan or in-app month opens the extras never gates. A locked tap
// does not switch surfaces: it speaks through the plans sheet.
const PLUS_NAV = new Set(["daystory", "roster", "timesheet"]);
function plusLocked(nav) {
  if (!PLUS_NAV.has(nav)) return false;
  const me = window.CARESITS_ME;
  if (!me || !me.uid) return false;
  if (me.side === "carer") return false;
  return me.plusExtras !== true;
}

function show(nav) {
  if (plusLocked(nav)) {
    if (typeof window.CARESITS_OPEN_PLANS === "function") window.CARESITS_OPEN_PLANS("plus");
    closeMenu();
    return;
  }
  activeNav = nav;
  document.querySelectorAll(".surface").forEach((s) => (s.hidden = true));
  document.querySelectorAll(".navBtn").forEach((b) => b.classList.toggle("on", b.dataset.nav === nav));
  const surfaceNav = nav === "ideas" ? "home" : nav;
  if (surfaceNav === "home") $("#surface-home").hidden = false;
  else if (nav === "find") $("#surface-find").hidden = false;
  else if (nav === "matches") $("#surface-matches").hidden = false;
  else if (nav === "board") $("#surface-board").hidden = false;
  else if (["calendar", "roster", "timesheet", "reminders"].includes(nav)) {
    $("#surface-calendar").hidden = false;
    window.CARESITS_WEEK_SELECT?.(nav);
  }
  else if (nav === "children") $("#surface-children").hidden = false;
  else if (nav === "daystory") $("#surface-daystory").hidden = false;
  else if (nav === "bin") { $("#surface-bin").hidden = false; if (typeof window.CARESITS_BIN_OPEN === "function") window.CARESITS_BIN_OPEN(); }
  else if (nav === "checks") $("#surface-checks").hidden = false;
  else if (nav === "reviews") $("#surface-reviews").hidden = false;
  else if (nav === "profile") $("#surface-profile").hidden = false;
  else if (nav === "privacy") $("#surface-privacy").hidden = false;
  else if (nav === "settings") $("#surface-settings").hidden = false;
  else if (nav === "help") $("#surface-help").hidden = false;
  else if (nav === "thread") { $("#surface-thread").hidden = false; if (typeof window.CARESITS_THREAD_OPEN === "function") window.CARESITS_THREAD_OPEN(); }
  else if (nav === "emergency") $("#surface-emergency").hidden = false;
  else if (nav === "questionnaire") $("#surface-questionnaire").hidden = false;
  else if (SOON.has(nav)) { $("#soonTitle").textContent = TITLES[nav] + " · coming with the build"; $("#surface-soon").hidden = false; }
  closeMenu();
  setBottomActive(nav);
  refreshHomeSwitch();
  if (nav === "ideas") {
    window.CARESITS_RENDER_HOME?.();
    requestAnimationFrame(() => (document.getElementById("learningIdeasCard") || document.getElementById("learningSetupCard"))?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }
}

// The shell's show mechanism, published as a seam: surfaces
// open by the hidden property through here, never by a class
// (HQ ruling on Leg 14). Homes' thread jump rides it.
window.CARESITS_NAV = show;

$("#closeBtn").addEventListener("click", closeMenu);
for (const button of document.querySelectorAll("[data-open-more]")) button.addEventListener("click", openMenu);
const sidePicker = document.getElementById("homeSideSwitchDialog");
$("#homeSideSwitchBtn").addEventListener("click", () => { sidePicker.hidden = false; document.querySelector("#homeSideSwitchClose")?.focus(); });
$("#homeSideSwitchClose").addEventListener("click", () => { sidePicker.hidden = true; $("#homeSideSwitchBtn").focus(); });
sidePicker.addEventListener("click", (event) => { if (event.target === sidePicker) sidePicker.hidden = true; });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { sidePicker.hidden = true; closeMenu(); } });
$("#sliver").addEventListener("click", closeMenu);
document.querySelectorAll(".navGroupHead").forEach((h) =>
  h.addEventListener("click", () => {
    const group = h.parentElement;
    const open = !group.classList.contains("open");
    for (const item of document.querySelectorAll(".navGroup")) {
      const selected = item === group && open;
      item.classList.toggle("open", selected);
      item.querySelector(".navGroupHead")?.setAttribute("aria-expanded", String(selected));
    }
  })
);
document.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => show(b.dataset.nav)));
document.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => show(b.dataset.goto)));

setBottomActive("home");
refreshHomeSwitch();
