// Caresitters app2 — name, first choice and three short tab coach-marks.
// Each account remembers family, career and Stay Connected separately.
import { t as tr } from "./lang.js";
import { accountKey } from "./storage-keys.js";
const LS_NAME = "caresits-name";
const LS_TOUR = "caresits-tour-state";
const LS_SIDE_TOURS = "caresits-side-tours";
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const state = () => { try { const key = accountKey(LS_TOUR); return key ? JSON.parse(localStorage.getItem(key)) || {} : {}; } catch { return {}; } };
const saveState = (s) => { try { const key = accountKey(LS_TOUR); if (key) localStorage.setItem(key, JSON.stringify(s)); } catch { /* storage may be unavailable */ } };
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
  if (typeof window.CARESITS_NAME_SAVED === "function") window.CARESITS_NAME_SAVED(v);
  if (typeof window.CARESITS_RENDER_HOME === "function") window.CARESITS_RENDER_HOME();
}
function currentSide() {
  const me = window.CARESITS_ME || {};
  if (["family", "career", "communicate"].includes(me.activeSide)) return me.activeSide;
  return me.side === "carer" ? "career" : me.side === "communicate" ? "communicate" : "family";
}
const SIDE_CHOICES = {
  family: [
    { label: "tour.choice.family.primary", nav: "questionnaire" },
    { label: "tour.choice.family.secondary", nav: "home" },
  ],
  career: [
    { label: "tour.choice.career.primary", nav: "questionnaire" },
    { label: "tour.choice.career.secondary", nav: "board" },
  ],
  communicate: [
    { label: "tour.choice.communicate.primary", nav: "ideas" },
    { label: "tour.choice.communicate.secondary", nav: "thread" },
  ],
};
const SIDE_COACHES = {
  family: [
    { target: '[data-bottom-tab="family-home"]', title: "tour.coach.home.title", body: "tour.coach.home.body" },
    { target: '[data-bottom-tab="family-find"]', title: "tour.coach.find.title", body: "tour.coach.find.body" },
    { target: '[data-bottom-tab="family-more"]', title: "tour.coach.more.title", body: "tour.coach.more.body" },
  ],
  career: [
    { target: '[data-bottom-tab="career-home"]', title: "tour.coach.home.title", body: "tour.coach.home.body" },
    { target: '[data-bottom-tab="career-profile"]', title: "tour.coach.profile.title", body: "tour.coach.profile.body" },
    { target: '[data-bottom-tab="career-more"]', title: "tour.coach.more.title", body: "tour.coach.more.body" },
  ],
  communicate: [
    { target: '[data-bottom-tab="connect-home"]', title: "tour.coach.home.title", body: "tour.coach.home.body" },
    { target: '[data-bottom-tab="connect-ideas"]', title: "tour.coach.ideas.title", body: "tour.coach.ideas.body" },
    { target: '[data-bottom-tab="connect-more"]', title: "tour.coach.more.title", body: "tour.coach.more.body" },
  ],
};
function storedSideTours(uid = window.CARESITS_ME?.uid) {
  try {
    const key = accountKey(LS_SIDE_TOURS, uid);
    const saved = key ? JSON.parse(localStorage.getItem(key) || "{}") : {};
    return saved && typeof saved === "object" ? saved : {};
  } catch { return {}; }
}
function sideTourDone(side) {
  const me = window.CARESITS_ME || {};
  return me.sideTours?.[side] === true || storedSideTours(me.uid)[side] === true;
}
async function markSideTourDone(side) {
  const me = window.CARESITS_ME || {};
  const sideTours = { ...(me.sideTours || {}), [side]: true };
  window.CARESITS_ME = { ...me, sideTours };
  try {
    const key = accountKey(LS_SIDE_TOURS, me.uid);
    const saved = storedSideTours(me.uid);
    if (key) localStorage.setItem(key, JSON.stringify({ ...saved, [side]: true }));
  } catch { /* the account write below is the durable copy */ }
  try { await window.CARESITS_WRITE?.("side-tour", { side }); } catch { /* local completion still prevents repeats here */ }
}
function spotlight(target) {
  document.querySelectorAll(".tourSpotlight").forEach((node) => node.classList.remove("tourSpotlight"));
  const node = target ? document.querySelector(target) : null;
  if (node && !node.hidden) node.classList.add("tourSpotlight");
}
function closeSideTour(wrap, side, skipped, nameWasAsked) {
  if (wrap.dataset.closed === "true") return;
  wrap.dataset.closed = "true";
  window.CARESITS_TOUR_REFRESH_LANGUAGE = null;
  document.querySelectorAll(".tourSpotlight").forEach((node) => node.classList.remove("tourSpotlight"));
  wrap.remove();
  document.getElementById("layout")?.classList.remove("open");
  const saved = state();
  saved.done = true;
  saved.skipped = !!skipped;
  if (nameWasAsked) saved.nameAsked = true;
  if (!myName()) saved.closedUnanswered = true;
  saveState(saved);
  void markSideTourDone(side);
}
function runSideTour(side, replay = false) {
  const me = window.CARESITS_ME || {};
  if (!me.uid || !SIDE_CHOICES[side] || document.getElementById("tourPop")) return false;
  if (!replay && sideTourDone(side)) return false;
  window.CARESITS_ROLE_NAV?.(side);
  const wrap = el("div", "sheetWrap");
  wrap.id = "tourPop";
  const card = el("div", "sheetCard tourCard");
  card.setAttribute("role", "dialog");
  const x = el("button", "closeBtn sheetX", "×");
  x.type = "button";
  const body = el("div", "tourBody");
  const legacy = state();
  const asksName = !myName() && !legacy.nameAsked;
  const steps = [];
  if (asksName) steps.push({ kind: "name", title: "tour.t1t", body: "tour.t1b" });
  steps.push({ kind: "choice", title: "tour.choiceTitle" });
  for (const coach of SIDE_COACHES[side]) steps.push({ kind: "coach", ...coach });
  let i = 0;
  const render = () => {
    body.replaceChildren();
    const step = steps[i];
    const isCoach = step.kind === "coach";
    wrap.className = isCoach ? "tourCoachWrap" : "sheetWrap";
    card.className = isCoach ? "sheetCard tourCard tourCoachCard" : "sheetCard tourCard";
    card.setAttribute("aria-modal", isCoach ? "false" : "true");
    x.setAttribute("aria-label", tr("tour.close"));
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-hello.png";
    img.alt = tr("tour.bunnyAlt");
    body.append(img, el("h3", "findName", tr(step.title)));
    if (step.body) body.append(el("p", null, tr(step.body)));

    if (step.kind === "name") {
      const input = el("input", "txtIn tourName");
      input.placeholder = tr("tour.namePh");
      input.id = "tourNameIn";
      input.setAttribute("autocomplete", "given-name");
      input.setAttribute("aria-label", tr("tour.namePh"));
      body.append(input);
      const row = el("div", "homeBtnRow tourActions");
      const skip = el("button", "ghostBtn", tr("tour.nameSkip"));
      skip.type = "button";
      skip.addEventListener("click", () => {
        const saved = state(); saved.nameAsked = true; saveState(saved);
        i += 1; render();
      });
      const next = el("button", "mainBtn", tr("tour.continue"));
      next.type = "button";
      next.addEventListener("click", () => {
        const value = input.value.trim();
        if (value) setName(value);
        const saved = state(); saved.nameAsked = true; saveState(saved);
        i += 1; render();
      });
      row.append(skip, next);
      body.append(row);
    } else if (step.kind === "choice") {
      const choices = el("div", "tourChoiceList");
      for (const choice of SIDE_CHOICES[side]) {
        const button = el("button", "tourChoiceBtn", tr(choice.label));
        button.type = "button";
        button.addEventListener("click", () => {
          window.CARESITS_NAV?.(choice.nav);
          i += 1;
          render();
        });
        choices.append(button);
      }
      body.append(choices);
    } else {
      spotlight(step.target);
      const row = el("div", "homeBtnRow tourActions");
      const skip = el("button", "ghostBtn", tr("tour.skip"));
      skip.type = "button";
      skip.addEventListener("click", () => closeSideTour(wrap, side, true, asksName));
      const next = el("button", "mainBtn", i === steps.length - 1 ? tr("tour.done") : tr("tour.next"));
      next.type = "button";
      next.addEventListener("click", () => {
        if (i === steps.length - 1) closeSideTour(wrap, side, false, asksName);
        else { i += 1; render(); }
      });
      row.append(skip, next);
      body.append(row, el("p", "tourCount", tr("tour.step", undefined, { a: steps.slice(0, i + 1).filter((s) => s.kind === "coach").length, b: 3 })));
    }
    card.replaceChildren(x, body);
  };
  window.CARESITS_TOUR_REFRESH_LANGUAGE = () => { if (document.getElementById("tourPop")) render(); };
  x.addEventListener("click", () => {
    const value = document.getElementById("tourNameIn")?.value.trim();
    if (value) setName(value);
    closeSideTour(wrap, side, true, asksName);
  });
  wrap.addEventListener("click", (event) => { if (event.target === wrap && !event.target.classList.contains("tourCoachWrap")) closeSideTour(wrap, side, true, asksName); });
  wrap.append(card);
  document.body.append(wrap);
  render();
  document.querySelector("#tourNameIn, #tourPop .tourChoiceBtn, #tourPop .mainBtn")?.focus();
  return true;
}
function quietBubble() {
  const saved = state();
  saved.reoffered = true;
  saveState(saved);
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
  window.CARESITS_TOUR_REFRESH_LANGUAGE = () => { if (document.getElementById("nameBubble")) refresh(); };
  save.addEventListener("click", () => { const value = input.value.trim(); if (value) setName(value); bub.remove(); window.CARESITS_TOUR_REFRESH_LANGUAGE = null; });
  x.addEventListener("click", () => { bub.remove(); window.CARESITS_TOUR_REFRESH_LANGUAGE = null; });
  bub.append(input, save, x);
  document.body.append(bub);
}
function startSideTour(side = currentSide(), replay = false) {
  if (!replay && sideTourDone(side)) return false;
  return runSideTour(side, replay);
}
function bootTourForAccount() {
  if (document.getElementById("tourPop")) return;
  const side = currentSide();
  window.CARESITS_ROLE_NAV?.(side);
  if (sideTourDone(side)) {
    const saved = state();
    if (!myName() && saved.closedUnanswered && !saved.reoffered) quietBubble();
    return;
  }
  startSideTour(side);
}
window.CARESITS_TOUR_START_SIDE = (side) => startSideTour(side, false);
window.CARESITS_REPLAY_SIDE_TOUR = () => startSideTour(currentSide(), true);
function bootTour() {
  if (window.CARESITS_ACCOUNT_READY) { bootTourForAccount(); return; }
  document.addEventListener("caresits-account-ready", bootTourForAccount, { once: true });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootTour);
else bootTour();
