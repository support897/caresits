// Caresitters app2 — Phase D family surfaces: Children + Day
// Story on the account data model (users/{uid}/children and
// users/{uid}/dayStory). Data arrives through CARESITS_FAMILY
// when the live layer provides it; writes ride CARESITS_WRITE.
// The child Remove carries the house B2 guard: one clear
// confirm step, in plain words, before anything is removed.
// Day Story is the story of the day, day by day, like a
// calendar. A parent can ask for a photo of their children
// during the day; the request rides to the carer in the same
// flow (photo bytes land with the storage wave).
const THEMES = [
  ["flowers", "Flowers", "#C9718A"], ["fairies", "Fairies", "#8B76B8"], ["space", "Space", "#5B87B8"],
  ["dino", "Dinosaurs", "#5F8F6E"], ["ocean", "Ocean", "#3E7C8C"], ["plain", "Plain", "#8A8A8A"],
];
const TILES = ["Arrival", "Meal", "Drink", "Nap", "Nappy / Toilet", "Mood", "Activity", "Outing", "Medicine", "Incident", "Health", "Photo moment", "Milestone", "Note to parents"];
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const write = (kind, payload) => { if (typeof window.CARESITS_WRITE === "function") window.CARESITS_WRITE(kind, payload); };
const todayKey = () => new Date().toISOString().slice(0, 10);

export function renderChildren(root, children) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.children")));
  if (!children.length) {
    const box = el("div", "cardIn");
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-hello.png";
    img.alt = tr("tour.bunnyAlt");
    box.append(img, el("h3", null, tr("family.noKids")), el("p", null, tr("family.noKidsBody")));
    root.append(box);
  }
  const list = el("div", "findList");
  for (const kid of children) {
    const theme = THEMES.find(([id]) => id === kid.theme) || THEMES[0];
    const card = el("article", "findCard kidCard");
    card.style.borderTop = "6px solid " + theme[2];
    card.append(el("h3", "findName", kid.name));
    card.append(el("p", "findPlace", tr("family.themeWord", undefined, { t: themeName(theme[0], theme[1]) })));
    const rm = el("button", "quietBtn", tr("family.remove"));
    rm.type = "button";
    rm.addEventListener("click", () => confirmRemove(kid, card));
    card.append(rm);
    list.append(card);
  }
  root.append(list);
  const form = el("div", "findCard");
  form.append(el("h3", "findName", tr("family.addChild")));
  const name = el("input", "txtIn");
  name.placeholder = tr("family.namePh");
  name.id = "kName";
  const themeSel = el("select", "txtIn");
  themeSel.id = "kTheme";
  for (const [id, label] of THEMES) { const o = el("option", null, themeName(id, label)); o.value = id; themeSel.append(o); }
  const add = el("button", "mainBtn", tr("family.add"));
  add.type = "button";
  add.id = "kAdd";
  add.addEventListener("click", () => {
    const n = name.value.trim();
    if (!n) return;
    write("child-add", { name: n, theme: themeSel.value });
    const kid = { id: "local-" + Date.now(), name: n, theme: themeSel.value };
    renderChildren(root, [...children, kid]);
  });
  form.append(name, themeSel, add);
  root.append(form);
}

function confirmRemove(kid, card) {
  document.getElementById("safetySheet")?.remove();
  const wrap = el("div", "sheetWrap");
  wrap.id = "safetySheet";
  const sheet = el("div", "sheetCard");
  sheet.append(el("h3", "findName", tr("family.removeTitle", undefined, { name: kid.name })));
  sheet.append(el("p", null, tr("family.removeBody", undefined, { name: kid.name })));
  const yes = el("button", "mainBtn", tr("family.yesRemove"));
  yes.type = "button";
  yes.addEventListener("click", () => {
    const uid = window.CARESITS_ME && window.CARESITS_ME.uid;
    if (uid) { const plan = planBinMove({ uid, kind: "child", record: kid, nowIso: new Date().toISOString() }); if (plan.ok) write("bin-move", { path: plan.path, data: plan.data }); }
    write("child-remove", { id: kid.id }); card.remove(); wrap.remove();
  });
  const no = el("button", "closeBtn", tr("family.keep"));
  no.type = "button";
  no.addEventListener("click", () => wrap.remove());
  sheet.append(yes, no);
  wrap.append(sheet);
  document.body.append(wrap);
}

export function renderDayStory(root, entries, side) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.daystory")));
  root.append(el("p", "findPool", tr("family.storyLead")));
  const form = el("div", "findCard");
  form.append(el("h3", "findName", tr("family.today")));
  let picked = "Meal";
  const chips = el("div", "chipRow");
  for (const t of TILES) {
    const c = el("button", "chipBtn" + (t === picked ? " on" : ""), tileName(t));
    c.type = "button";
    c.dataset.tile = t.toLowerCase().split(" ")[0];
    c.addEventListener("click", () => { picked = t; chips.querySelectorAll(".chipBtn").forEach((b) => b.classList.toggle("on", b === c)); });
    chips.append(c);
  }
  form.append(chips);
  const note = el("textarea", "txtIn");
  note.id = "tileNote";
  note.placeholder = tr("family.notePh");
  const save = el("button", "mainBtn", tr("family.saveToday"));
  save.type = "button";
  save.id = "tileSave";
  save.addEventListener("click", () => {
    const entry = { day: todayKey(), tile: picked, note: note.value, at: new Date().toISOString() };
    write("dayStory", entry);
    renderDayStory(root, [entry, ...entries], side);
  });
  form.append(note, save);
  if (side === "family") {
    const ask = el("button", "closeBtn", tr("family.askPhoto"));
    ask.type = "button";
    ask.addEventListener("click", () => {
      write("photo-request", { day: todayKey(), at: new Date().toISOString() });
      form.append(el("p", "gateMsg", tr("family.asked")));
      ask.remove();
    });
    form.append(ask);
  }
  root.append(form);
  const days = [...new Set(entries.map((e) => e.day))].sort().reverse();
  for (const day of days) {
    const sec = el("section", "calPair");
    sec.append(el("h3", "findName", day));
    for (const e of entries.filter((x) => x.day === day)) {
      const row = el("div", "findCard");
      row.append(el("p", "findPlace", tileName(e.tile) + (e.note ? " · " + e.note : "")));
      const rm = el("button", "quietBtn", tr("family.remove"));
      rm.type = "button";
      rm.addEventListener("click", () => {
        const uid = window.CARESITS_ME && window.CARESITS_ME.uid;
        if (uid) { const plan = planBinMove({ uid, kind: "dayStory", record: e, nowIso: new Date().toISOString() }); if (plan.ok) write("bin-move", { path: plan.path, data: plan.data }); }
        if (e.id) write("dayStory-remove", { id: e.id });
        renderDayStory(root, entries.filter((x) => x !== e), side);
      });
      row.append(rm);
      sec.append(row);
    }
    root.append(sec);
  }
  if (!entries.length) {
    const box = el("div", "cardIn");
    box.append(el("h3", null, tr("family.nothing")), el("p", null, tr("family.nothingBody")));
    root.append(box);
  }
}

import { t as tr } from "./lang.js";
import { planBinMove } from "./bin.js";
const themeName = (id, fallback) => tr("family.theme." + id) === "family.theme." + id ? fallback : tr("family.theme." + id);
const tileName = (name) => tr("family.tile." + name) === "family.tile." + name ? name : tr("family.tile." + name);
export function todayLineText(count) {
  if (!count) return "";
  return count === 1 ? tr("family.todayLine1") : tr("family.todayLineN", undefined, { n: count });
}

function bootFamily() {
  const cRoot = document.getElementById("childrenRoot");
  const dRoot = document.getElementById("daystoryRoot");
  const d = window.CARESITS_FAMILY || { children: [], entries: [], side: "family" };
  if (cRoot) renderChildren(cRoot, d.children || []);
  if (dRoot) renderDayStory(dRoot, d.entries || [], d.side || "family");
  const tl = document.getElementById("todayLine");
  if (tl) {
    const n = (d.entries || []).filter((e) => e.day === todayKey()).length;
    tl.textContent = todayLineText(n);
    tl.hidden = !n;
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootFamily);
  else bootFamily();
}
