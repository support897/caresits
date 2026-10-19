import { applyI18n } from "./lang.js";
applyI18n();
// Caresitters app2 shell — her nav shape of 15 Oct 2026.
// Menu hidden on load. Opening it gives the menu most of the
// screen and shrinks the content to a thin sliver at the edge.
// Tapping the sliver, or Close, returns full content. Groups:
// one open at a time. The open state is never remembered across
// loads: every visit starts with the full screen app.
const $ = (s) => document.querySelector(s);
const layout = $("#layout");
const SOON = new Set([]);
const TITLES = {};

function openMenu() { layout.classList.add("open"); }
function closeMenu() { layout.classList.remove("open"); }

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
  document.querySelectorAll(".surface").forEach((s) => (s.hidden = true));
  document.querySelectorAll(".navBtn").forEach((b) => b.classList.toggle("on", b.dataset.nav === nav));
  if (nav === "home") $("#surface-home").hidden = false;
  else if (nav === "find") $("#surface-find").hidden = false;
  else if (nav === "matches") $("#surface-matches").hidden = false;
  else if (nav === "board") $("#surface-board").hidden = false;
  else if (nav === "calendar") $("#surface-calendar").hidden = false;
  else if (nav === "children") $("#surface-children").hidden = false;
  else if (nav === "daystory") $("#surface-daystory").hidden = false;
  else if (nav === "bin") { $("#surface-bin").hidden = false; if (typeof window.CARESITS_BIN_OPEN === "function") window.CARESITS_BIN_OPEN(); }
  else if (nav === "roster") $("#surface-roster").hidden = false;
  else if (nav === "timesheet") $("#surface-timesheet").hidden = false;
  else if (nav === "reminders") $("#surface-reminders").hidden = false;
  else if (nav === "checks") $("#surface-checks").hidden = false;
  else if (nav === "reviews") $("#surface-reviews").hidden = false;
  else if (nav === "profile") $("#surface-profile").hidden = false;
  else if (nav === "privacy") $("#surface-privacy").hidden = false;
  else if (nav === "settings") $("#surface-settings").hidden = false;
  else if (nav === "thread") $("#surface-thread").hidden = false;
  else if (nav === "emergency") $("#surface-emergency").hidden = false;
  else if (nav === "questionnaire") $("#surface-questionnaire").hidden = false;
  else if (SOON.has(nav)) { $("#soonTitle").textContent = TITLES[nav] + " · coming with the build"; $("#surface-soon").hidden = false; }
  closeMenu();
}

// The shell's show mechanism, published as a seam: surfaces
// open by the hidden property through here, never by a class
// (HQ ruling on Leg 14). Homes' thread jump rides it.
window.CARESITS_NAV = show;

$("#menuBtn").addEventListener("click", openMenu);
$("#closeBtn").addEventListener("click", closeMenu);
$("#sliver").addEventListener("click", closeMenu);
document.querySelectorAll(".navGroupHead").forEach((h) =>
  h.addEventListener("click", () => {
    const g = h.parentElement;
    const was = g.classList.contains("open");
    document.querySelectorAll(".navGroup").forEach((x) => x.classList.remove("open"));
    if (!was) g.classList.add("open");
  })
);
document.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => show(b.dataset.nav)));
document.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => show(b.dataset.goto)));
