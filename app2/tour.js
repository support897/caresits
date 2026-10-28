// Caresitters app2 — the first-run bunny guide.
// Guide completion and progress are private to one uid and one side.
import { t as tr } from "./lang.js";
import { accountKey } from "./storage-keys.js";

const LS_NAME = "caresits-name";
const LS_TOUR = "caresits-tour-state";
const LS_SIDE_TOURS = "caresits-side-tours";
const LS_GUIDE_PROGRESS = "caresits-guide-progress";
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};
const currentUid = () => window.CARESITS_ME?.uid || null;
function state(uid = currentUid()) {
  try {
    const key = accountKey(LS_TOUR, uid);
    return key ? JSON.parse(localStorage.getItem(key) || "{}") || {} : {};
  } catch { return {}; }
}
function saveState(value, uid = currentUid()) {
  try {
    const key = accountKey(LS_TOUR, uid);
    if (key) localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage may be unavailable */ }
}
function guideProgress(side, uid) {
  try {
    const key = accountKey(`${LS_GUIDE_PROGRESS}-${side}`, uid);
    return key ? JSON.parse(localStorage.getItem(key) || "{}") || {} : {};
  } catch { return {}; }
}
function saveGuideProgress(side, uid, value) {
  try {
    const key = accountKey(`${LS_GUIDE_PROGRESS}-${side}`, uid);
    if (key) localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage may be unavailable */ }
}
function myName(uid = currentUid()) {
  const key = accountKey(LS_NAME, uid);
  const saved = key ? localStorage.getItem(key) || "" : "";
  if (saved) return saved;
  return String(window.CARESITS_ME?.name || window.CARESITS_TRUST?.me?.name || "");
}
function setName(value) {
  const key = accountKey(LS_NAME);
  if (key) localStorage.setItem(key, value);
  if (typeof window.CARESITS_WRITE === "function") window.CARESITS_WRITE("name", { displayName: value });
  if (typeof window.CARESITS_NAME_SAVED === "function") window.CARESITS_NAME_SAVED(value);
  if (typeof window.CARESITS_RENDER_HOME === "function") window.CARESITS_RENDER_HOME();
}
function currentSide() {
  const me = window.CARESITS_ME || {};
  if (["family", "career", "communicate"].includes(me.activeSide)) return me.activeSide;
  return me.side === "carer" ? "career" : me.side === "communicate" ? "communicate" : "family";
}
function storedSideTours(uid = currentUid()) {
  try {
    const key = accountKey(LS_SIDE_TOURS, uid);
    const saved = key ? JSON.parse(localStorage.getItem(key) || "{}") : {};
    return saved && typeof saved === "object" ? saved : {};
  } catch { return {}; }
}
function sideTourDone(side, uid = currentUid()) {
  const me = window.CARESITS_ME || {};
  return me.uid === uid && me.sideTours?.[side] === true || storedSideTours(uid)[side] === true;
}
async function markSideTourDone(side, uid) {
  if (!uid || currentUid() !== uid) return;
  const me = window.CARESITS_ME || {};
  const sideTours = { ...(me.sideTours || {}), [side]: true };
  window.CARESITS_ME = { ...me, sideTours };
  try {
    const key = accountKey(LS_SIDE_TOURS, uid);
    const saved = storedSideTours(uid);
    if (key) localStorage.setItem(key, JSON.stringify({ ...saved, [side]: true }));
  } catch { /* the account write below is the durable copy */ }
  try { await window.CARESITS_WRITE?.("side-tour", { side }); } catch { /* local completion still prevents repeats here */ }
}
function visibleInMenu(node) {
  return !!node && !node.hidden && !node.closest("[hidden]");
}
const TAB_TEXT = {
  "family-find": "Find: say what you need, then see carers on a map.",
  "family-week": "Calendar: mark the days you need help.",
  "family-urgent": "Urgent: need help fast? Post it here in a few taps.",
  "family-messages": "Messages: chat with your carer.",
  "career-find": "Jobs: see families near you on a map.",
  "career-week": "Calendar: mark the days you are free.",
  "career-urgent": "Urgent: families who need help right now.",
  "career-messages": "Messages: chat with families.",
  "connect-home": "Today: fun activities picked for your kids.",
  "connect-week": "Calendar: one shared week for you both.",
  "connect-photos": "Photos: photo updates from your carer.",
  "connect-messages": "Messages: chat together.",
};
function sideTabs(side) {
  return [...document.querySelectorAll(`#bottomNav [data-bottom-role="${side}"]`)]
    .filter((button) => !button.hidden)
    .map((button) => {
      const tab = button.dataset.bottomTab || "";
      const name = tab.endsWith("-home") ? "home"
        : tab.endsWith("-find") ? "find"
          : tab.endsWith("-family") ? "family"
            : tab.endsWith("-week") ? "week"
              : tab.endsWith("-jobs") ? "jobs"
                : tab.endsWith("-profile") ? "profile"
                  : tab.endsWith("-messages") ? "messages"
                    : tab.endsWith("-ideas") ? "ideas"
                      : tab.endsWith("-story") ? "story"
                        : tab.endsWith("-more") ? "more" : "home";
      return { kind: "tab", target: `[data-bottom-tab="${tab}"]`, text: `guide.tab.${name}`, raw: TAB_TEXT[tab] || "", nav: button.dataset.nav || "more" };
    });
}
function sideMenuItems() {
  return [];
  const menu = document.getElementById("menu");
  if (!menu) return [];
  const steps = [];
  for (const child of menu.children) {
    if (child.id === "sideSwitch" && visibleInMenu(child)) {
      steps.push({ kind: "menu", target: "#sideSwitch", text: "guide.item.side" });
      continue;
    }
    if (child.matches?.(".navBtn[data-nav]") && visibleInMenu(child)) {
      steps.push({ kind: "menu", target: `[data-nav="${child.dataset.nav}"]`, text: `guide.item.${child.dataset.nav}` });
      continue;
    }
    if (child.matches?.(".navGroup") && visibleInMenu(child)) {
      const head = child.querySelector(".navGroupHead");
      if (!visibleInMenu(head)) continue;
      const group = head?.dataset.group;
      if (head && group) steps.push({ kind: "group", target: `.navGroupHead[data-group="${group}"]`, text: `guide.group.${group}` });
      for (const button of child.querySelectorAll(".navBtn[data-nav]")) {
        if (!visibleInMenu(button)) continue;
        steps.push({ kind: "menu", target: `[data-nav="${button.dataset.nav}"]`, text: `guide.item.${button.dataset.nav}`, group });
      }
    }
  }
  return steps;
}
function buildSteps(side, askName) {
  const steps = [
    { kind: "welcome", text: "guide.intro" },
    { kind: "purpose", text: `guide.side.${side}` },
    { kind: "questions", text: "guide.questions" },
  ];
  if (askName) steps.push({ kind: "name", text: "guide.name" });
  steps.push(...sideTabs(side), ...sideMenuItems());
  steps.push({ kind: "me", target: "#meBtn", raw: "Me: your profile, settings and app mode. Switch between finding a carer, finding families and staying connected here." });
  return steps;
}
function spotlight(target, wrap) {
  document.querySelectorAll(".tourSpotlight").forEach((node) => node.classList.remove("tourSpotlight"));
  if (wrap) wrap.classList.toggle("menuOpen", !!document.getElementById("layout")?.classList.contains("open"));
  const node = target ? document.querySelector(target) : null;
  if (!node || node.hidden || node.closest("[hidden]")) return null;
  if (node.closest("#menu")) {
    const group = node.closest(".navGroup");
    if (group) {
      document.querySelectorAll(".navGroup").forEach((item) => {
        const open = item === group;
        item.classList.toggle("open", open);
        item.querySelector(".navGroupHead")?.setAttribute("aria-expanded", String(open));
      });
    }
  }
  node.classList.add("tourSpotlight");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  node.scrollIntoView?.({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
  return node;
}
function openMore(side) {
  if (document.getElementById("layout")?.classList.contains("open")) return;
  document.querySelector(`#bottomNav [data-bottom-role="${side}"][data-open-more="true"]`)?.click();
}
function closeMenuIfOpen() {
  if (document.getElementById("layout")?.classList.contains("open")) document.getElementById("closeBtn")?.click();
}
function removeGuide(wrap) {
  window.CARESITS_TOUR_REFRESH_LANGUAGE = null;
  document.querySelectorAll(".tourSpotlight").forEach((node) => node.classList.remove("tourSpotlight"));
  wrap?.remove();
}
function finishGuide(wrap, side, uid, skipped, askName, steps, replay) {
  if (wrap.dataset.closed === "true") return;
  wrap.dataset.closed = "true";
  if (currentUid() !== uid) { removeGuide(wrap); return; }
  const saved = state(uid);
  if (askName) saved.nameAsked = true;
  saved.done = true;
  saved.skipped = !!skipped;
  saveState(saved, uid);
  saveGuideProgress(side, uid, { step: steps.length, done: true, skipped: !!skipped, replay: !!replay });
  removeGuide(wrap);
  closeMenuIfOpen();
  void markSideTourDone(side, uid);
}
function runSideTour(side, replay = false) {
  const uid = currentUid();
  if (!uid || !["family", "career", "communicate"].includes(side) || document.getElementById("tourPop")) return false;
  if (!replay && sideTourDone(side, uid)) return false;
  window.CARESITS_ROLE_NAV?.(side);
  const prior = state(uid);
  const askName = !myName(uid) && !prior.nameAsked;
  const steps = buildSteps(side, askName);
  const wrap = el("div", "guideWrap");
  wrap.id = "tourPop";
  wrap.dataset.uid = uid;
  wrap.dataset.side = side;
  const card = el("section", "guideBubble");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "false");
  const img = el("img", "guideBunny");
  img.src = "bunny/bunny-hello.png";
  img.alt = tr("guide.bunnyAlt");
  const words = el("p", "guideWords");
  words.setAttribute("aria-live", "polite");
  const nameInput = el("input", "guideName");
  nameInput.type = "text";
  nameInput.autocomplete = "given-name";
  nameInput.placeholder = tr("tour.namePh");
  nameInput.setAttribute("aria-label", tr("tour.namePh"));
  const actions = el("div", "guideActions");
  const skip = el("button", "ghostBtn guideSkip", tr("guide.skip"));
  skip.type = "button";
  const next = el("button", "mainBtn guideNext");
  next.type = "button";
  const progress = el("div", "guideProgress");
  progress.setAttribute("aria-hidden", "true");
  const dots = Array.from({ length: 8 }, () => el("span", "guideDot"));
  progress.append(...dots);
  const count = el("span", "guideCount");
  const progressRow = el("div", "guideProgressRow");
  progressRow.append(progress, count);
  card.append(img, words, nameInput, actions, progressRow);
  actions.append(skip, next);
  wrap.append(card);
  document.body.append(wrap);

  const savedProgress = guideProgress(side, uid);
  let index = replay ? 0 : Math.min(Number(savedProgress.step) || 0, steps.length - 1);
  const render = () => {
    if (currentUid() !== uid) { removeGuide(wrap); return; }
    const step = steps[index];
    words.textContent = step.raw || tr(step.text);
    nameInput.hidden = step.kind !== "name";
    actions.classList.toggle("nameActions", step.kind === "name");
    wrap.dataset.stepKind = step.kind;
    next.textContent = tr(index === steps.length - 1 ? "guide.gotIt" : "guide.next");
    count.textContent = tr("guide.step", undefined, { a: index + 1, b: steps.length });
    progress.setAttribute("aria-label", count.textContent);
    const fillCount = Math.ceil(((index + 1) / steps.length) * dots.length);
    dots.forEach((dot, dotIndex) => dot.classList.toggle("on", dotIndex < fillCount));
    if (step.kind === "menu" || step.kind === "group") openMore(side);
    spotlight(step.target, wrap);
    if (!replay) saveGuideProgress(side, uid, { step: index, done: false, skipped: false, replay: false });
  };
  const refresh = () => { if (document.getElementById("tourPop") === wrap) render(); };
  window.CARESITS_TOUR_REFRESH_LANGUAGE = refresh;
  skip.addEventListener("click", () => finishGuide(wrap, side, uid, true, askName, steps, replay));
  next.addEventListener("click", () => {
    if (currentUid() !== uid) { removeGuide(wrap); return; }
    const step = steps[index];
    if (step.kind === "name") {
      const value = nameInput.value.trim();
      if (value) setName(value);
      const saved = state(uid); saved.nameAsked = true; saveState(saved, uid);
    }
    if (step.kind === "tab") {
      if (step.nav === "more") document.querySelector(step.target)?.click();
      else document.querySelector(step.target)?.click();
    }
    if (index === steps.length - 1) {
      finishGuide(wrap, side, uid, false, askName, steps, replay);
      return;
    }
    index += 1;
    render();
  });
  render();
  if (index === 0) next.focus();
  return true;
}
function startSideTour(side = currentSide(), replay = false) {
  if (!replay && sideTourDone(side)) return false;
  return runSideTour(side, replay);
}
function bootTourForAccount() {
  const me = window.CARESITS_ME || {};
  if (!me.uid) return;
  const existing = document.getElementById("tourPop");
  if (existing) {
    if (existing.dataset.uid === me.uid) return;
    removeGuide(existing);
    closeMenuIfOpen();
    window.CARESITS_NAV?.("home");
  }
  const side = currentSide();
  window.CARESITS_ROLE_NAV?.(side);
  if (sideTourDone(side, me.uid)) return;
  startSideTour(side);
}
window.CARESITS_TOUR_START_SIDE = (side) => startSideTour(side, false);
window.CARESITS_REPLAY_SIDE_TOUR = () => startSideTour(currentSide(), true);
document.addEventListener("caresits-account-ready", bootTourForAccount);
if (window.CARESITS_ACCOUNT_READY) bootTourForAccount();
else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootTourForAccount, { once: true });
