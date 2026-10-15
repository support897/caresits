// Caresits app2 — Phase D family surfaces: Children + Day
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
  root.append(el("h2", "findTitle", "Children"));
  if (!children.length) {
    const box = el("div", "cardIn");
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-hello.png";
    img.alt = "The Caresits bunny waving hello";
    box.append(img, el("h3", null, "No children here yet"), el("p", null, "Add your first child below. Their card is private: only you, and a carer you are working with, can ever see it."));
    root.append(box);
  }
  const list = el("div", "findList");
  for (const kid of children) {
    const theme = THEMES.find(([id]) => id === kid.theme) || THEMES[0];
    const card = el("article", "findCard kidCard");
    card.style.borderTop = "6px solid " + theme[2];
    card.append(el("h3", "findName", kid.name));
    card.append(el("p", "findPlace", theme[1] + " theme"));
    const rm = el("button", "quietBtn", "Remove");
    rm.type = "button";
    rm.addEventListener("click", () => confirmRemove(kid, card));
    card.append(rm);
    list.append(card);
  }
  root.append(list);
  const form = el("div", "findCard");
  form.append(el("h3", "findName", "Add a child"));
  const name = el("input", "txtIn");
  name.placeholder = "Their first name";
  name.id = "kName";
  const themeSel = el("select", "txtIn");
  themeSel.id = "kTheme";
  for (const [id, label] of THEMES) { const o = el("option", null, label); o.value = id; themeSel.append(o); }
  const add = el("button", "mainBtn", "Add");
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
  sheet.append(el("h3", "findName", "Remove " + kid.name + "?"));
  sheet.append(el("p", null, "This removes " + kid.name + " and their Day Story notes from your app. It cannot be undone. Download your data first if you want a copy."));
  const yes = el("button", "mainBtn", "Yes, remove");
  yes.type = "button";
  yes.addEventListener("click", () => { write("child-remove", { id: kid.id }); card.remove(); wrap.remove(); });
  const no = el("button", "closeBtn", "Keep");
  no.type = "button";
  no.addEventListener("click", () => wrap.remove());
  sheet.append(yes, no);
  wrap.append(sheet);
  document.body.append(wrap);
}

export function renderDayStory(root, entries, side) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", "Day Story"));
  root.append(el("p", "findPool", "The story of the day, saved day by day like a calendar."));
  const form = el("div", "findCard");
  form.append(el("h3", "findName", "Today"));
  let picked = "Meal";
  const chips = el("div", "chipRow");
  for (const t of TILES) {
    const c = el("button", "chipBtn" + (t === picked ? " on" : ""), t);
    c.type = "button";
    c.dataset.tile = t.toLowerCase().split(" ")[0];
    c.addEventListener("click", () => { picked = t; chips.querySelectorAll(".chipBtn").forEach((b) => b.classList.toggle("on", b.textContent === t)); });
    chips.append(c);
  }
  form.append(chips);
  const note = el("textarea", "txtIn");
  note.id = "tileNote";
  note.placeholder = "A few words about it";
  const save = el("button", "mainBtn", "Save to today");
  save.type = "button";
  save.id = "tileSave";
  save.addEventListener("click", () => {
    const entry = { day: todayKey(), tile: picked, note: note.value, at: new Date().toISOString() };
    write("dayStory", entry);
    renderDayStory(root, [entry, ...entries], side);
  });
  form.append(note, save);
  if (side === "family") {
    const ask = el("button", "closeBtn", "Ask for a photo of the kids");
    ask.type = "button";
    ask.addEventListener("click", () => {
      write("photo-request", { day: todayKey(), at: new Date().toISOString() });
      form.append(el("p", "gateMsg", "Asked. Your carer will see the request in today's story."));
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
      row.append(el("p", "findPlace", e.tile + (e.note ? " · " + e.note : "")));
      sec.append(row);
    }
    root.append(sec);
  }
  if (!entries.length) {
    const box = el("div", "cardIn");
    box.append(el("h3", null, "Nothing logged yet"), el("p", null, "The first tile you save starts today's story."));
    root.append(box);
  }
}

export function todayLineText(count) {
  if (!count) return "";
  return count === 1 ? "1 thing logged today" : count + " things logged today";
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
