// Caresitters app2 — the bunny tour (door v4's second half).
// After sign up the whole app is there as normal, and ONE
// pop up stands in the middle: the tour. Step one asks the
// name. Next walks the menu and the app. The cross closes
// the tour at any time; the last stop is Done. If the name
// step closes unanswered, the bunny offers it once more on
// the NEXT visit as one small quiet bubble, then never
// again (the fleet rule). A missing name blocks nothing.
import { t as tr } from "./lang.js";
const LS_NAME = "caresits-name";
const LS_TOUR = "caresits-tour-state";
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const state = () => { try { return JSON.parse(localStorage.getItem(LS_TOUR)) || {}; } catch { return {}; } };
const saveState = (s) => localStorage.setItem(LS_TOUR, JSON.stringify(s));
const myName = () => localStorage.getItem(LS_NAME) || "";
function setName(v) {
  localStorage.setItem(LS_NAME, v);
  if (typeof window.CARESITS_WRITE === "function") window.CARESITS_WRITE("name", { displayName: v });
  // The name lands in this session too: the live layer refreshes
  // the profile seam, and Home re-renders with the name in it.
  if (typeof window.CARESITS_NAME_SAVED === "function") window.CARESITS_NAME_SAVED(v);
  if (typeof window.CARESITS_RENDER_HOME === "function") window.CARESITS_RENDER_HOME();
}

const STEPS = [
  { title: tr("tour.t1t"), body: tr("tour.t1b"), name: true },
  { title: tr("tour.t2t"), body: tr("tour.t2b"), menu: true },
  { title: tr("tour.t3t"), body: tr("tour.t3b") },
  { title: tr("tour.t4t"), body: tr("tour.t4b") },
  { title: tr("tour.t5t"), body: tr("tour.t5b"), done: true },
];

function closeTour(answered) {
  document.getElementById("tourPop")?.remove();
  document.getElementById("layout")?.classList.remove("open");
  const s = state();
  if (!answered && !myName()) { s.closedUnanswered = true; saveState(s); }
  if (answered || myName()) { s.done = true; saveState(s); }
}

function runTour() {
  const wrap = el("div", "sheetWrap");
  wrap.id = "tourPop";
  const card = el("div", "sheetCard tourCard");
  const x = el("button", "closeBtn sheetX", "✕");
  x.type = "button";
  x.setAttribute("aria-label", tr("tour.close"));
  let i = 0;
  const body = el("div", "tourBody");
  const render = () => {
    body.replaceChildren();
    const step = STEPS[i];
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-hello.png";
    img.alt = tr("tour.bunnyAlt");
    body.append(img, el("h3", "findName", step.title), el("p", null, step.body));
    document.getElementById("layout")?.classList.toggle("open", !!step.menu);
    if (step.name && !myName()) {
      const input = el("input", "txtIn tourName");
      input.placeholder = tr("tour.namePh");
      input.id = "tourNameIn";
      body.append(input);
    }
    if (step.done) {
      const done = el("button", "mainBtn", tr("tour.done"));
      done.type = "button";
      done.addEventListener("click", () => closeTour(true));
      body.append(done);
    } else {
      const next = el("button", "mainBtn", tr("tour.next"));
      next.type = "button";
      next.addEventListener("click", () => {
        if (step.name) {
          const v = document.getElementById("tourNameIn")?.value.trim();
          if (v) setName(v);
        }
        i += 1;
        render();
      });
      body.append(next);
    }
    body.append(el("p", "tourCount", tr("tour.step", undefined, { a: i + 1, b: STEPS.length })));
  };
  x.addEventListener("click", () => closeTour(!!myName()));
  card.append(x, body);
  wrap.append(card);
  document.body.append(wrap);
  render();
}

function quietBubble() {
  const s = state();
  s.reoffered = true;
  saveState(s);
  const bub = el("div", "quietBubble");
  bub.id = "nameBubble";
  const img = el("img", "bubbleBunny");
  img.src = "bunny/bunny-hello.png";
  img.alt = "";
  bub.append(img, el("p", "bubbleText", tr("tour.bubble")));
  const input = el("input", "txtIn tourName");
  input.placeholder = tr("tour.namePh");
  const save = el("button", "mainBtn actBtn", tr("tour.save"));
  save.type = "button";
  save.addEventListener("click", () => { const v = input.value.trim(); if (v) setName(v); bub.remove(); });
  const x = el("button", "quietBtn", tr("tour.notNow"));
  x.type = "button";
  x.addEventListener("click", () => bub.remove());
  bub.append(input, save, x);
  document.body.append(bub);
}

function bootTour() {
  const fresh = sessionStorage.getItem("caresits-tour") === "1";
  const newSession = !sessionStorage.getItem("caresits-session");
  sessionStorage.setItem("caresits-session", "1");
  if (fresh) { sessionStorage.removeItem("caresits-tour"); runTour(); return; }
  const s = state();
  if (newSession && !myName() && s.closedUnanswered && !s.reoffered && !s.done) quietBubble();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootTour);
else bootTour();
