import { t as tr } from "./lang.js";
// Caresitters app2 — Phase D week surfaces: Roster, Timesheet,
// Reminders. All read through CARESITS_WEEK when the live
// layer provides it; writes ride CARESITS_WRITE. The roster
// wears the pair calendar's regular look; the timesheet adds
// its hours up in the open; reminders stay plain.
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const write = (kind, payload) => { if (typeof window.CARESITS_WRITE === "function") window.CARESITS_WRITE(kind, payload); };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const emptyBox = (root, title, words) => {
  const box = el("div", "cardIn");
  const img = el("img", "bunnyBig");
  img.src = "bunny/bunny-rest-calm.png";
  img.alt = tr("find.bunnyRest");
  box.append(img, el("h3", null, title), el("p", null, words));
  root.append(box);
};

export function renderRoster(root, sessions) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.roster")));
  if (!sessions.length) { emptyBox(root, tr("week.rosterEmpty"), tr("week.rosterEmptyBody")); return; }
  for (const day of DAYS) {
    const rows = sessions.filter((s) => s.day === day);
    if (!rows.length) continue;
    const sec = el("section", "calPair");
    sec.append(el("h3", "findName", tr("journey.day." + day)));
    for (const s of rows) {
      const chip = el("div", "calBlock regular");
      chip.append(el("span", "calTime", (s.start || "") + (s.end ? tr("week.to") + s.end : "")), el("span", "calWith", tr("week.with", undefined, { name: s.withName || tr("week.yourCarer") })));
      sec.append(chip);
    }
    root.append(sec);
  }
}

export function renderTimesheet(root, entries) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.timesheet")));
  const total = entries.reduce((a, e) => a + (Number(e.hours) || 0), 0);
  root.append(el("p", "findPool", tr("week.hours", undefined, { n: Math.round(total * 100) / 100 })));
  const list = el("div", "findList");
  for (const e of entries) {
    const card = el("article", "findCard");
    card.append(el("p", "findPlace", e.day + " · " + e.hours + " hours" + (e.withName ? " · with " + e.withName : "")));
    list.append(card);
  }
  root.append(list);
  const form = el("div", "findCard");
  form.append(el("h3", "findName", tr("week.addHours")));
  const day = el("select", "txtIn");
  for (const d of DAYS) day.append(el("option", null, d));
  const hours = el("input", "txtIn");
  hours.type = "number";
  hours.min = "0";
  hours.step = "0.25";
  hours.placeholder = tr("week.hoursPh");
  const add = el("button", "mainBtn", tr("family.add"));
  add.type = "button";
  const formMsg = el("p", "formMsg");
  add.addEventListener("click", () => {
    const h = Number(hours.value);
    if (!h) { formMsg.textContent = tr("form.needShift"); return; }
    write("timesheet", { day: day.value, hours: h });
    renderTimesheet(root, [...entries, { day: day.value, hours: h }]);
  });
  form.append(day, hours, add, formMsg);
  root.append(form);
}

export function renderReminders(root, reminders) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.reminders")));
  if (!reminders.length) emptyBox(root, tr("week.remEmpty"), tr("week.remEmptyBody"));
  const list = el("div", "findList");
  for (const r of reminders) {
    const card = el("article", "findCard");
    card.append(el("p", "findPlace", r.text + (r.when ? " · " + r.when : "")));
    list.append(card);
  }
  root.append(list);
  const form = el("div", "findCard");
  const text = el("input", "txtIn");
  text.placeholder = tr("week.remPh");
  const when = el("input", "txtIn");
  when.placeholder = tr("week.whenPh");
  const add = el("button", "mainBtn", tr("family.add"));
  add.type = "button";
  const formMsg = el("p", "formMsg");
  add.addEventListener("click", () => {
    if (!text.value.trim()) { formMsg.textContent = tr("form.needReminder"); return; }
    write("reminder", { text: text.value.trim(), when: when.value });
    renderReminders(root, [...reminders, { text: text.value.trim(), when: when.value }]);
  });
  form.append(text, when, add, formMsg);
  root.append(form);
}

export function renderEmergency(root, contacts) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.emergency")));
  if (!contacts.length) { emptyBox(root, tr("week.emEmpty"), tr("week.emEmptyBody")); }
  const list = el("div", "findList");
  for (const c of contacts) {
    const card = el("article", "findCard");
    card.append(el("h3", "findName", c.name || tr("week.contact")));
    card.append(el("p", "findPlace", c.phone || ""));
    list.append(card);
  }
  root.append(list);
  const form = el("div", "findCard");
  const name = el("input", "txtIn");
  name.placeholder = tr("week.namePh");
  const phone = el("input", "txtIn");
  phone.placeholder = tr("week.phonePh");
  const add = el("button", "mainBtn", tr("family.add"));
  add.type = "button";
  const formMsg = el("p", "formMsg");
  add.addEventListener("click", () => {
    if (!name.value.trim() || !phone.value.trim()) { formMsg.textContent = tr("form.needContact"); return; }
    write("emergency", { name: name.value.trim(), phone: phone.value });
    renderEmergency(root, [...contacts, { name: name.value.trim(), phone: phone.value }]);
  });
  form.append(name, phone, add, formMsg);
  root.append(form);
}

function bootWeek() {
  const d = window.CARESITS_WEEK || { sessions: [], entries: [], reminders: [] };
  const r = document.getElementById("rosterRoot");
  const t = document.getElementById("timesheetRoot");
  const m = document.getElementById("remindersRoot");
  if (r) renderRoster(r, d.sessions || []);
  if (t) renderTimesheet(t, d.entries || []);
  if (m) renderReminders(m, d.reminders || []);
  const em = document.getElementById("emergencyRoot");
  if (em) renderEmergency(em, d.emergency || []);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootWeek);
else bootWeek();
