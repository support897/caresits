// Caresitters app2 — the bunny tour (door v4's second half).
// After sign up the whole app is there as normal, and ONE
// pop up stands in the middle: the tour. Step one asks the
// name. Next walks the menu and the app. The cross closes
// the tour at any time; the last stop is Done. If the name
// step closes unanswered, the bunny offers it once more on
// the NEXT visit as one small quiet bubble, then never
// again (the fleet rule). A missing name blocks nothing.
import { t as tr } from "./lang.js";
import { accountKey } from "./storage-keys.js";
const LS_NAME = "caresits-name";
const LS_TOUR = "caresits-tour-state";
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const state = () => { try { const key = accountKey(LS_TOUR); return key ? JSON.parse(localStorage.getItem(key)) || {} : {}; } catch { return {}; } };
const saveState = (s) => { const key = accountKey(LS_TOUR); if (key) localStorage.setItem(key, JSON.stringify(s)); };
const myName = () => {
  const key = accountKey(LS_NAME);
  const saved = key ? localStorage.getItem(key) || "" : "";
  if (saved) return saved;
  return String(window.CARESITS_ME?.name || window.CARESITS_TRUST?.me?.name || "");
};
function setName(v) {
  const key = accountKey(LS_NAME);
  if (key) localStorage.setItem(key, v);
  if (typeof window.CARESITS_WRITE === "function") window.CARESITS_WRITE("name", { displayName: v });
  // The name lands in this session too: the live layer refreshes
  // the profile seam, and Home re-renders with the name in it.
  if (typeof window.CARESITS_NAME_SAVED === "function") window.CARESITS_NAME_SAVED(v);
  if (typeof window.CARESITS_RENDER_HOME === "function") window.CARESITS_RENDER_HOME();
}

const steps = () => {
  const me = window.CARESITS_ME || {};
  const role = me.side || (me.entryRole === "career" ? "carer" : me.entryRole) || "family";
  const fourth = role === "carer" ? [tr("tour.carer.t4t"), tr("tour.carer.t4b")]
    : role === "communicate" ? [tr("tour.communicate.t4t"), tr("tour.communicate.t4b")]
      : [tr("tour.t4t"), tr("tour.t4b")];
  return [
    { title: tr("tour.t1t"), body: tr("tour.t1b"), name: true },
    { title: tr("tour.t2t"), body: tr("tour.t2b"), menu: true },
    { title: tr("tour.t3t"), body: tr("tour.t3b") },
    { title: fourth[0], body: fourth[1] },
    { title: tr("tour.t5t"), body: tr("tour.t5b"), done: true },
  ];
};

function closeTour(answered) {
  window.CARESITS_TOUR_REFRESH_LANGUAGE = null;
  document.getElementById("tourPop")?.remove();
  document.getElementById("layout")?.classList.remove("open");
  const s = state();
  if (!answered && !myName()) s.closedUnanswered = true;
  s.done = true;
  s.skipped = !answered;
  saveState(s);
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
    const priorName = document.getElementById("tourNameIn")?.value || "";
    body.replaceChildren();
    const step = steps()[i];
    x.setAttribute("aria-label", tr("tour.close"));
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-hello.png";
    img.alt = tr("tour.bunnyAlt");
    body.append(img, el("h3", "findName", step.title), el("p", null, step.body));
    document.getElementById("layout")?.classList.toggle("open", !!step.menu);
    if (step.name && !myName()) {
      const input = el("input", "txtIn tourName");
      input.placeholder = tr("tour.namePh");
      input.id = "tourNameIn";
      input.value = priorName;
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
    body.append(el("p", "tourCount", tr("tour.step", undefined, { a: i + 1, b: 5 })));
  };
  window.CARESITS_TOUR_REFRESH_LANGUAGE = () => {
    if (document.getElementById("tourPop")) render();
  };
  x.addEventListener("click", () => {
    const typedName = document.getElementById("tourNameIn")?.value.trim();
    if (typedName) setName(typedName);
    closeTour(!!typedName || !!myName());
  });
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
  const bubbleText = el("p", "bubbleText", tr("tour.bubble"));
  bub.append(img, bubbleText);
  const input = el("input", "txtIn tourName");
  input.placeholder = tr("tour.namePh");
  const save = el("button", "mainBtn actBtn", tr("tour.save"));
  save.type = "button";
  const x = el("button", "quietBtn", tr("tour.notNow"));
  x.type = "button";
  const refresh = () => {
    bubbleText.textContent = tr("tour.bubble");
    input.placeholder = tr("tour.namePh");
    save.textContent = tr("tour.save");
    x.textContent = tr("tour.notNow");
  };
  window.CARESITS_TOUR_REFRESH_LANGUAGE = () => {
    if (document.getElementById("nameBubble")) refresh();
  };
  save.addEventListener("click", () => { const v = input.value.trim(); if (v) setName(v); bub.remove(); window.CARESITS_TOUR_REFRESH_LANGUAGE = null; });
  x.addEventListener("click", () => { bub.remove(); window.CARESITS_TOUR_REFRESH_LANGUAGE = null; });
  bub.append(input, save, x);
  document.body.append(bub);
}

function bootTourForAccount() {
  try { sessionStorage.removeItem("caresits-tour"); } catch { /* session storage is optional */ }
  const s = state();
  if (!s.done) { runTour(); return; }
  if (!myName() && s.closedUnanswered && !s.reoffered) quietBubble();
}

function bootTour() {
  if (window.CARESITS_ACCOUNT_READY) { bootTourForAccount(); return; }
  document.addEventListener("caresits-account-ready", bootTourForAccount, { once: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootTour);
else bootTour();
