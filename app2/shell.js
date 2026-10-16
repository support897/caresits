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

function show(nav) {
  document.querySelectorAll(".surface").forEach((s) => (s.hidden = true));
  document.querySelectorAll(".navBtn").forEach((b) => b.classList.toggle("on", b.dataset.nav === nav));
  if (nav === "home") $("#surface-home").hidden = false;
  else if (nav === "find") $("#surface-find").hidden = false;
  else if (nav === "matches") $("#surface-matches").hidden = false;
  else if (nav === "board") $("#surface-board").hidden = false;
  else if (nav === "calendar") $("#surface-calendar").hidden = false;
  else if (nav === "children") $("#surface-children").hidden = false;
  else if (nav === "daystory") $("#surface-daystory").hidden = false;
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
