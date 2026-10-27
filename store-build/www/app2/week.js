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
    card.append(el("p", "findPlace", tr("week.hoursLine", undefined, { day: tr("journey.day." + e.day), n: e.hours }) + (e.withName ? " · " + tr("week.with", undefined, { name: e.withName }) : "")));
    list.append(card);
  }
  root.append(list);
  const form = el("div", "findCard weekAddForm");
  form.id = "weekHoursForm";
  form.append(el("h3", "findName", tr("week.addHours")));
  const dayLabel = el("label", "fieldLabel", tr("week.dayLabel"));
  dayLabel.htmlFor = "weekHoursDay";
  const day = el("select", "txtIn");
  day.id = "weekHoursDay";
  for (const d of DAYS) { const option = el("option", null, tr("journey.day." + d)); option.value = d; day.append(option); }
  const hoursLabel = el("label", "fieldLabel", tr("week.hoursLabel"));
  hoursLabel.htmlFor = "weekHoursValue";
  const hours = el("input", "txtIn");
  hours.id = "weekHoursValue";
  hours.type = "number";
  hours.min = "0";
  hours.step = "0.25";
  hours.placeholder = tr("week.hoursPh");
  const add = el("button", "mainBtn", tr("week.saveHours"));
  add.type = "button";
  const formMsg = el("p", "formMsg");
  add.addEventListener("click", () => {
    const h = Number(hours.value);
    if (!h) { formMsg.textContent = tr("form.needShift"); return; }
    write("timesheet", { day: day.value, hours: h });
    renderTimesheet(root, [...entries, { day: day.value, hours: h }]);
  });
  form.append(dayLabel, day, hoursLabel, hours, add, formMsg);
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
  const form = el("div", "findCard weekAddForm");
  form.id = "weekReminderForm";
  form.append(el("h3", "findName", tr("week.addReminder")));
  const textLabel = el("label", "fieldLabel", tr("week.remLabel"));
  textLabel.htmlFor = "weekReminderText";
  const text = el("input", "txtIn");
  text.id = "weekReminderText";
  text.placeholder = tr("week.remPh");
  const whenLabel = el("label", "fieldLabel", tr("week.whenLabel"));
  whenLabel.htmlFor = "weekReminderWhen";
  const when = el("input", "txtIn");
  when.id = "weekReminderWhen";
  when.placeholder = tr("week.whenPh");
  const add = el("button", "mainBtn", tr("week.saveReminder"));
  add.type = "button";
  const formMsg = el("p", "formMsg");
  add.addEventListener("click", () => {
    if (!text.value.trim()) { formMsg.textContent = tr("form.needReminder"); return; }
    write("reminder", { text: text.value.trim(), when: when.value });
    renderReminders(root, [...reminders, { text: text.value.trim(), when: when.value }]);
  });
  form.append(textLabel, text, whenLabel, when, add, formMsg);
  root.append(form);
}

export function renderEmergency(root, contacts) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.emergency")));
  root.append(el("p", "findPool", tr("week.emergencyLead")));
  if (!contacts.length) emptyBox(root, tr("week.emEmpty"), tr("week.emEmptyBody"));
  const list = el("div", "findList");
  for (const contact of contacts) {
    const card = el("article", "findCard emergencyCard");
    card.append(el("h3", "findName", contact.name || tr("week.contact")));
    if (contact.phone) {
      card.append(el("p", "findPlace", contact.phone));
      const phone = String(contact.phone).replace(/[^0-9+]/g, "");
      if (phone) {
        const call = el("a", "mainBtn emergencyCall", tr("week.call"));
        call.href = "tel:" + phone;
        call.setAttribute("aria-label", tr("week.callName", undefined, { name: contact.name || tr("week.contact") }));
        card.append(call);
      }
    }
    list.append(card);
  }
  root.append(list);
  const form = el("div", "findCard emergencyForm");
  form.append(el("h3", "findName", contacts.length ? tr("week.editContact") : tr("week.addContact")));
  const nameLabel = el("label", "fieldLabel", tr("week.nameLabel"));
  nameLabel.htmlFor = "emergencyName";
  const name = el("input", "txtIn");
  name.id = "emergencyName";
  name.type = "text";
  name.autocomplete = "name";
  name.placeholder = tr("week.namePh");
  name.value = contacts[0]?.name || "";
  const phoneLabel = el("label", "fieldLabel", tr("week.phoneLabel"));
  phoneLabel.htmlFor = "emergencyPhone";
  const phone = el("input", "txtIn");
  phone.id = "emergencyPhone";
  phone.type = "tel";
  phone.autocomplete = "tel";
  phone.placeholder = tr("week.phonePh");
  phone.value = contacts[0]?.phone || "";
  const save = el("button", "mainBtn", tr("week.saveContact"));
  save.type = "button";
  const formMsg = el("p", "formMsg");
  formMsg.setAttribute("role", "status");
  save.addEventListener("click", () => {
    if (!name.value.trim() || !phone.value.trim()) { formMsg.textContent = tr("form.needContact"); return; }
    const contact = { name: name.value.trim(), phone: phone.value.trim() };
    write("emergency", contact);
    renderEmergency(root, contacts.length ? [contact, ...contacts.slice(1)] : [contact]);
  });
  form.append(nameLabel, name, phoneLabel, phone, save, formMsg);
  root.append(form);
}

const WEEK_TABS = ["calendar", "roster", "timesheet", "reminders"];
let weekTabsSetup = false;
function selectWeekTab(tab) {
  const selected = WEEK_TABS.includes(tab) ? tab : "calendar";
  for (const name of WEEK_TABS) {
    const button = document.querySelector(`[data-week-tab="${name}"]`);
    const panel = document.getElementById("weekPanel" + name[0].toUpperCase() + name.slice(1));
    if (!button || !panel) continue;
    const on = name === selected;
    button.setAttribute("aria-selected", String(on));
    button.tabIndex = on ? 0 : -1;
    panel.hidden = !on;
  }
  const status = document.getElementById("weekAddStatus");
  if (status) status.textContent = "";
}
function setupWeekTabs() {
  if (weekTabsSetup) return;
  weekTabsSetup = true;
  for (const button of document.querySelectorAll("[data-week-tab]")) {
    button.addEventListener("click", () => selectWeekTab(button.dataset.weekTab));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = WEEK_TABS.indexOf(button.dataset.weekTab);
      const rtl = document.documentElement.dir === "rtl";
      const delta = (event.key === "ArrowRight" ? 1 : -1) * (rtl ? -1 : 1);
      const next = event.key === "Home" ? 0 : event.key === "End" ? WEEK_TABS.length - 1
        : (index + delta + WEEK_TABS.length) % WEEK_TABS.length;
      const target = document.querySelector(`[data-week-tab="${WEEK_TABS[next]}"]`);
      selectWeekTab(WEEK_TABS[next]);
      target?.focus();
    });
  }
  window.CARESITS_WEEK_SELECT = selectWeekTab;
  const add = document.getElementById("weekAdd");
  add?.addEventListener("click", () => {
    let selected = document.querySelector('[data-week-tab][aria-selected="true"]')?.dataset.weekTab || "calendar";
    if (selected === "roster") {
      selected = "calendar";
      selectWeekTab(selected);
    }
    const rootId = { calendar: "calendarRoot", timesheet: "timesheetRoot", reminders: "remindersRoot" }[selected];
    const targetRoot = rootId && document.getElementById(rootId);
    const target = targetRoot?.querySelector(".weekAddForm") || (selected === "calendar" ? targetRoot?.querySelector(".findCard") : null);
    const status = document.getElementById("weekAddStatus");
    if (!target) {
      if (status) status.textContent = tr("week.addUnavailable");
      return;
    }
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.querySelector("input, select, textarea, button")?.focus({ preventScroll: true });
  });
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
  setupWeekTabs();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootWeek);
else bootWeek();

// The live boot publishes CARESITS_WEEK after this module has
// booted (QA b104 ROOT B): the boot calls this hook and the
// week surfaces re-render from the member's real records.
if (typeof window !== "undefined") window.CARESITS_WEEK_RENDER = bootWeek;
