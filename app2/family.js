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
// A removal joins the bin's live list in the same moment it
// is planned (QA b104 Leg 7): the bin surface renders from
// that list on open, and a record binned this session must
// not wait for the next boot to appear in it.
const joinBin = (plan) => {
  if (typeof window.CARESITS_BIN_ADD === "function") {
    window.CARESITS_BIN_ADD({ id: plan.binId, kind: plan.data.kind, data: plan.data.data, deletedAt: plan.data.deletedAt });
  }
};
const todayKey = () => new Date().toISOString().slice(0, 10);

// The export seam. This module's renders are the commit points
// for children and the Day Story: every add, save and remove
// re renders with the new list, so the mirror below always
// holds what is on screen right now. window.CARESITS_FAMILY is
// assigned once at boot (the live layer) and never moves again,
// so the exporter reads through CARESITS_FAMILY_NOW and a same
// session add is never left out of the user's own copy.
const familyNow = { children: [], entries: [], side: "family" };

export function renderChildren(root, rawChildren, editingId = null) {
  const children = (rawChildren || []).map((kid) => normaliseChild(kid));
  familyNow.children = children;
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
    if (kid.ageYears != null) card.append(el("p", "findPlace", ageText(kid.ageYears)));
    if (kid.loves.length) card.append(el("p", "findPlace", tr("family.kidLovesLine", undefined, { list: kid.loves.map((id) => tr("homes.love." + id)).join(", ") })));
    const edit = el("button", "quietBtn", tr("family.editChild"));
    edit.type = "button";
    edit.addEventListener("click", () => openChildSheet(kid, edit));
    const rm = el("button", "quietBtn", tr("family.remove"));
    rm.type = "button";
    rm.addEventListener("click", () => confirmRemove(kid, card));
    card.append(edit, rm);
    list.append(card);
  }
  root.append(list);
  const add = el("button", "mainBtn", tr("family.addChild"));
  add.type = "button";
  add.id = "kAddOpen";
  add.addEventListener("click", () => openChildSheet(null, add));
  root.append(add);

  function openChildSheet(editingKid, returnFocus) {
    document.getElementById("childSheet")?.remove();
    const wrap = el("div", "sheetWrap");
    wrap.id = "childSheet";
    const sheet = el("section", "sheetCard childSheetCard");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "childSheetTitle");
    const title = el("h3", "findName", tr(editingKid ? "family.editChild" : "family.addChild"));
    title.id = "childSheetTitle";
    const close = el("button", "closeBtn sheetX", tr("family.cancel"));
    close.type = "button";
    const closeSheet = () => { wrap.remove(); returnFocus?.focus(); };
    close.addEventListener("click", closeSheet);
    sheet.append(close, title);

    const nameLabel = el("label", "fieldLabel", tr("family.childName"));
    nameLabel.htmlFor = "kName";
    const name = el("input", "txtIn");
    name.id = "kName";
    name.type = "text";
    name.autocomplete = "given-name";
    name.placeholder = tr("family.namePh");
    if (editingKid) name.value = editingKid.name;

    const ageLabel = el("label", "fieldLabel", tr("family.agePick"));
    ageLabel.htmlFor = "kAge";
    const ageSel = el("select", "txtIn");
    ageSel.id = "kAge";
    const ageBlank = el("option", null, tr("family.agePick"));
    ageBlank.value = "";
    ageSel.append(ageBlank);
    for (let age = 0; age <= 12; age += 1) {
      const option = el("option", null, ageText(age));
      option.value = String(age);
      ageSel.append(option);
    }
    if (editingKid && editingKid.ageYears != null) ageSel.value = String(editingKid.ageYears);

    // The card theme picker rides the sheet too: a theme the
    // family can never pick is a colour they never chose.
    const themeLabel = el("label", "fieldLabel", tr("family.themeLabel"));
    themeLabel.htmlFor = "kTheme";
    const themeSel = el("select", "txtIn");
    themeSel.id = "kTheme";
    for (const [id, label] of THEMES) { const o = el("option", null, themeName(id, label)); o.value = id; themeSel.append(o); }
    themeSel.value = editingKid?.theme || THEMES[0][0];

    const loveLabel = el("p", "fieldLabel", tr("family.lovesLabel"));
    const loveRow = el("div", "chipRow childLoveChoices");
    loveRow.id = "kLoves";
    loveRow.setAttribute("role", "group");
    loveRow.setAttribute("aria-label", tr("family.lovesLabel"));
    const pickedLoves = new Set(editingKid?.loves || []);
    const shownCount = 4;
    let moreOpen = (editingKid?.loves || []).some((id) => INTERESTS.findIndex((item) => item.id === id) >= shownCount);
    const more = el("button", "quietBtn childMoreBtn", tr(moreOpen ? "family.fewerInterests" : "family.moreInterests"));
    more.type = "button";
    more.setAttribute("aria-expanded", String(moreOpen));
    const renderLoveChoices = () => {
      loveRow.replaceChildren();
      INTERESTS.forEach((love, index) => {
        if (index >= shownCount && !moreOpen) return;
        const choice = el("button", "chipBtn" + (pickedLoves.has(love.id) ? " on" : ""), tr(love.key));
        choice.type = "button";
        choice.dataset.love = love.id;
        choice.setAttribute("aria-pressed", String(pickedLoves.has(love.id)));
        choice.addEventListener("click", () => {
          if (pickedLoves.has(love.id)) pickedLoves.delete(love.id);
          else pickedLoves.add(love.id);
          choice.classList.toggle("on", pickedLoves.has(love.id));
          choice.setAttribute("aria-pressed", String(pickedLoves.has(love.id)));
        });
        loveRow.append(choice);
      });
      more.hidden = INTERESTS.length <= shownCount;
      more.textContent = tr(moreOpen ? "family.fewerInterests" : "family.moreInterests");
      more.setAttribute("aria-expanded", String(moreOpen));
    };
    more.addEventListener("click", () => { moreOpen = !moreOpen; renderLoveChoices(); });
    renderLoveChoices();

    const save = el("button", "mainBtn", tr(editingKid ? "family.saveChild" : "family.addChild"));
    save.type = "button";
    save.id = "kAdd";
    const formMsg = el("p", "formMsg");
    formMsg.setAttribute("role", "status");
    save.addEventListener("click", () => {
      const childName = name.value.trim();
      if (!childName) {
        formMsg.textContent = tr("form.needChild");
        name.focus();
        return;
      }
      const ageYears = ageSel.value === "" ? null : Number(ageSel.value);
      const loves = INTERESTS.map((item) => item.id).filter((id) => pickedLoves.has(id));
      // Keep the existing per-member write and record ID shape.
      const kid = { ...(editingKid || {}), id: editingKid?.id || "local-" + Date.now(), name: childName, theme: themeSel.value || editingKid?.theme || THEMES[0][0], ageYears, loves };
      write("child-add", { id: kid.id, name: childName, theme: kid.theme, ageYears, loves });
      wrap.remove();
      renderChildren(root, editingKid ? children.map((oldKid) => oldKid.id === kid.id ? kid : oldKid) : [...children, kid]);
      document.getElementById("kAddOpen")?.focus();
    });
    const actions = el("div", "homeBtnRow childSheetActions");
    actions.append(save);
    if (editingKid) {
      const cancel = el("button", "ghostBtn", tr("family.cancel"));
      cancel.type = "button";
      cancel.addEventListener("click", closeSheet);
      actions.append(cancel);
    }
    sheet.append(nameLabel, name, ageLabel, ageSel, themeLabel, themeSel, loveLabel, loveRow, more, actions, formMsg);
    wrap.append(sheet);
    wrap.addEventListener("click", (event) => { if (event.target === wrap) closeSheet(); });
    wrap.addEventListener("keydown", (event) => { if (event.key === "Escape") closeSheet(); });
    document.body.append(wrap);
    name.focus();
  }
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
    if (uid) { const plan = planBinMove({ uid, kind: "child", record: kid, nowIso: new Date().toISOString() }); if (plan.ok) { write("bin-move", { path: plan.path, data: plan.data }); joinBin(plan); } }
    write("child-remove", { id: kid.id });
    familyNow.children = familyNow.children.filter((k) => k.id !== kid.id);
    card.remove(); wrap.remove();
  });
  const no = el("button", "closeBtn", tr("family.keep"));
  no.type = "button";
  no.addEventListener("click", () => wrap.remove());
  sheet.append(yes, no);
  wrap.append(sheet);
  document.body.append(wrap);
}

export function renderDayStory(root, entries, side) {
  familyNow.entries = entries;
  if (side) familyNow.side = side;
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
    // The entry carries its local id from birth (id unity):
    // the write, the bin and the remove all speak it.
    const entry = { id: "local-" + Date.now(), day: todayKey(), tile: picked, note: note.value, at: new Date().toISOString() };
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
        if (uid) { const plan = planBinMove({ uid, kind: "dayStory", record: e, nowIso: new Date().toISOString() }); if (plan.ok) { write("bin-move", { path: plan.path, data: plan.data }); joinBin(plan); } }
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

// The bin restore seam. A restore in bin.js writes through
// the live layer and never passes through this module, so
// without this the mirror (and the screens) would not see the
// record again until the next boot. bin.js calls noteRestored
// after a restore lands; the record re enters through the
// same render paths as every other commit, so the mirror
// keeps holding what is on screen right now.
export function noteRestored(kind, record) {
  if (!record || typeof record !== "object") return;
  if (kind === "child") {
    const kid = normaliseChild(record);
    if (familyNow.children.some((k) => k.id === kid.id)) return;
    familyNow.children = [...familyNow.children, kid];
    const root = typeof document !== "undefined" ? document.getElementById("childrenRoot") : null;
    if (root) renderChildren(root, familyNow.children);
  } else if (kind === "dayStory") {
    const same = record.id != null
      ? (e) => e.id === record.id
      : (e) => e.day === record.day && e.tile === record.tile && e.at === record.at && e.note === record.note;
    if (familyNow.entries.some(same)) return;
    familyNow.entries = [record, ...familyNow.entries];
    const root = typeof document !== "undefined" ? document.getElementById("daystoryRoot") : null;
    if (root) renderDayStory(root, familyNow.entries, familyNow.side);
  }
}

import { t as tr } from "./lang.js";
import { planBinMove } from "./bin.js";
import { INTERESTS, normaliseChild } from "./activities.js";
export const repairChild = normaliseChild;
export function ageText(ageYears) {
  if (ageYears === 0) return tr("family.ageBaby");
  if (ageYears === 1) return tr("family.ageOne");
  return tr("family.ageMany", undefined, { n: ageYears });
}
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
  familyNow.children = d.children || [];
  familyNow.entries = d.entries || [];
  familyNow.side = d.side || "family";
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

if (typeof window !== "undefined") {
  window.CARESITS_FAMILY_NOW = () => ({ children: familyNow.children, entries: familyNow.entries, side: familyNow.side });
  window.CARESITS_FAMILY_RESTORE = noteRestored;
  // The live boot publishes CARESITS_FAMILY after this module
  // has booted (QA b104 ROOT B): the boot calls this hook and
  // the surfaces re-render from the member's real records.
  window.CARESITS_FAMILY_RENDER = bootFamily;
}
