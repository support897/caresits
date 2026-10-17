// Caresitters app2 — the two homes (Ilse's commission,
// 17 Oct 2026, from her approved visuals at
// next-phase/homes/). Home carries two postures behind one
// small switch: Finding care (find, finish the questions, top
// matches, urgent) and Our days (the kids, a day planned from
// what they love, the family connect link, the shared
// shopping list, requests). The pick is remembered on the
// device; the first posture is Our days when the viewer
// already has a live pair, Finding care otherwise. Every plan
// is made by the pure planners (activities, invites,
// shopping, calendar-actions); this file only renders and
// wires the writes the live layer already routes.
import { t as tr } from "./lang.js";
import { planDay, planWeek, mondayOfISO, INTERESTS } from "./activities.js";
import { repairChild, ageText, todayLineText } from "./family.js";
import { assembleBrowse } from "./browse.js";
import { FAMILY_PAGES, CARER_PAGES } from "./questions.js";
import { EXPANSION } from "./questions2.js";
import { makeCode, cleanCode, isCode, planInviteCreate, planInviteAccept, inviteLinkText } from "./invites.js";
import { planShoppingSave, addItem, toggleItem } from "./shopping.js";
import { planDecision } from "./calendar-actions.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const POSTURE_KEY = "caresits-home-posture";
const INVITE_KEY = "caresits-my-invite";
const labelText = (s) => tr({ "Perfect Pair": "find.label.perfect", "Strong Fit": "find.label.strong", "Good Fit": "find.label.good" }[s] || "find.label.good");
const nowIso = () => new Date().toISOString();
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function navTo(name) {
  const b = document.querySelector(`[data-nav="${name}"]`);
  if (b) b.click();
}
function gotoThread() {
  // The thread surface has no menu button of its own; it is
  // reached the way the shell reaches it from a pair row.
  document.querySelectorAll(".surface").forEach((s) => s.classList.toggle("active", s.id === "surface-thread"));
  document.querySelectorAll("[data-nav]").forEach((b) => b.classList.toggle("on", false));
  document.getElementById("sideMenu")?.classList.remove("open");
  document.getElementById("scrim")?.classList.remove("show");
  if (typeof window.CARESITS_RENDER_THREAD === "function") window.CARESITS_RENDER_THREAD();
}
function write(kind, payload) {
  if (typeof window.CARESITS_WRITE === "function") return window.CARESITS_WRITE(kind, payload);
  return null;
}
function me() { return window.CARESITS_ME || null; }
function myName() {
  const m = me();
  if (m && m.name) return m.name;
  try { return localStorage.getItem("caresits-name") || ""; } catch { return ""; }
}
function pairs() {
  const cal = window.CARESITS_CALENDAR || {};
  if (Array.isArray(cal.pairs) && cal.pairs.length) return cal.pairs;
  const pc = window.CARESITS_PHASE_C || {};
  const m = me();
  return (pc.rels || []).filter((r) => ["contact", "hired", "pending"].includes(r.state)).map((r) => ({
    pairId: [m?.uid, r.otherUid].sort().join("_"),
    otherUid: r.otherUid,
    otherName: (pc.names || {})[r.otherUid] || "",
    pattern: null, blocks: [], requests: [],
  }));
}
function hasLivePair() {
  const pc = window.CARESITS_PHASE_C || {};
  if ((pc.rels || []).some((r) => r.state === "contact" || r.state === "hired")) return true;
  return pairs().length > 0;
}
function myChildren() {
  const hook = window.CARESITS_HOMES || {};
  if (Array.isArray(hook.children)) return hook.children.map(repairChild);
  const fam = window.CARESITS_FAMILY || {};
  return (fam.children || []).map(repairChild);
}
function readJson(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } }

const state = { posture: null, shopItems: null, decided: new Set(), linkMsg: "", openMsg: "" };

function defaultPosture() {
  try { const saved = localStorage.getItem(POSTURE_KEY); if (saved === "finding" || saved === "days") return saved; } catch { /* storage off */ }
  return hasLivePair() ? "days" : "finding";
}

// ---------- shared bits ----------
function greeting(leadKey, leadVars) {
  const wrap = el("div", "homeHead");
  const name = myName();
  wrap.append(el("h1", "homeHello", name ? tr("homes.helloName", undefined, { name }) : tr("homes.hello")));
  wrap.append(el("p", "lead", tr(leadKey, undefined, leadVars)));
  const tl = el("p", "todayLine");
  tl.id = "todayLine";
  const kids = myChildren();
  const line = todayLineText(kids.length);
  if (line) tl.textContent = line; else tl.hidden = true;
  wrap.append(tl);
  return wrap;
}
function guideLine(key) {
  const row = el("div", "guideRow");
  const img = el("img", "guideBunny");
  img.src = "bunny/bunny-hello.png";
  img.alt = "";
  row.append(img, el("p", "guideText", tr(key)));
  return row;
}
function postureSwitch(current) {
  const row = el("div", "postureRow");
  const mk = (id, key) => {
    const b = el("button", "postureBtn" + (current === id ? " on" : ""), tr(key));
    b.type = "button";
    b.addEventListener("click", () => {
      state.posture = id;
      try { localStorage.setItem(POSTURE_KEY, id); } catch { /* storage off */ }
      renderHome();
    });
    return b;
  };
  row.append(mk("finding", "shell.finding"), mk("days", "homes.daysTab"));
  return row;
}

// ---------- FINDING HOME ----------
function findingHome(root) {
  const m = me();
  const firstPair = pairs()[0];
  root.append(greeting("homes.findingLead"));
  root.append(postureSwitch("finding"));

  // Find card: the postcode on file, then the two doors.
  const draft = readJson("caresits-app2-draft");
  const done = readJson("caresits-app2-questionnaire");
  const postcode = (draft && draft.answers && draft.answers.postcode) || (done && done.answers && done.answers.postcode)
    || (window.CARESITS_TRUST || {}).me?.postcode || "";
  const find = el("section", "cardIn homeCard");
  find.append(el("h2", "findTitle", tr("homes.findCardTitle")));
  find.append(el("p", "homeBody", tr("homes.findCardBody")));
  if (postcode) find.append(el("p", "homePlace", tr("find.postcode", undefined, { n: postcode })));
  const findRow = el("div", "homeBtnRow");
  const fb = el("button", "mainBtn", tr("homes.findCarers")); fb.type = "button";
  fb.addEventListener("click", () => navTo("find"));
  const mb = el("button", "ghostBtn", tr("homes.seeMatches")); mb.type = "button";
  mb.addEventListener("click", () => navTo("matches"));
  findRow.append(fb, mb);
  find.append(findRow);
  root.append(find);

  // Questionnaire progress card.
  const q = el("section", "cardIn homeCard");
  if (done) {
    q.append(el("h2", "findTitle", tr("homes.qTitleDone")));
    q.append(el("p", "homeBody", tr("homes.qBodyDone")));
  } else if (draft) {
    const side = draft.side || (m && m.side) || "family";
    const total = ((side === "carer" ? CARER_PAGES : FAMILY_PAGES).length) + ((EXPANSION[side] || []).length);
    const pct = Math.max(1, Math.min(99, Math.round((100 * (Number(draft.page) || 0)) / Math.max(1, total))));
    q.append(el("h2", "findTitle", tr("homes.qTitlePct", undefined, { n: pct })));
    q.append(el("p", "homeBody", tr("homes.qBody")));
    q.append(el("p", "homeBody homeWarm", tr("homes.qPerfect")));
    const qb = el("button", "mainBtn", tr("homes.qFinishBtn")); qb.type = "button";
    qb.addEventListener("click", () => navTo("questionnaire"));
    q.append(qb);
  } else {
    q.append(el("h2", "findTitle", tr("homes.qTitlePct", undefined, { n: 0 })));
    q.append(el("p", "homeBody", tr("homes.qBody")));
    const qb = el("button", "mainBtn", tr("find.startQ")); qb.type = "button";
    qb.addEventListener("click", () => navTo("questionnaire"));
    q.append(qb);
  }
  root.append(q);

  // Top matches preview.
  const top = el("section", "cardIn homeCard");
  top.append(el("h2", "findTitle", tr("homes.topTitle")));
  const fd = window.CARESITS_FIND_DATA;
  let entries = [];
  if (fd && fd.viewer && Array.isArray(fd.candidates)) {
    try { entries = (assembleBrowse(fd.viewer, fd.candidates).top || []).slice(0, 2); } catch { entries = []; }
  }
  if (!entries.length) {
    top.append(el("p", "homeBody", tr("find.noneTitle")));
    top.append(el("p", "homeBody", tr("find.waitBody")));
  } else {
    for (const e of entries) {
      const row = el("button", "homeMatchRow");
      row.type = "button";
      const left = el("span", "homeMatchWho");
      left.append(el("span", "homeMatchName", e.doc.displayName || tr("find.member")));
      const meta = el("span", "homeMatchMeta");
      if (e.result && e.result.personal !== false) {
        meta.append(el("span", "fitChip", labelText(e.result.label)));
        meta.append(el("span", "fitScore", tr("find.pairFit", undefined, { n: e.result.pair })));
      }
      left.append(meta);
      row.append(left);
      const reasons = (e.result && e.result.reasons || []).slice(0, 2);
      if (reasons.length) row.append(el("span", "homeMatchWhy", reasons.join(" · ")));
      row.addEventListener("click", () => navTo("find"));
      top.append(row);
    }
  }
  root.append(top);

  // Urgent strip.
  const urg = el("section", "cardIn homeCard homeUrgent");
  urg.append(el("h2", "findTitle", tr("homes.urgentTitle")));
  urg.append(el("p", "homeBody", tr("homes.urgentBody")));
  const ub = el("button", "mainBtn", tr("homes.urgentBtn")); ub.type = "button";
  ub.addEventListener("click", () => navTo("board"));
  urg.append(ub);
  root.append(urg);

  root.append(guideLine("homes.guideFinding"));
  if (firstPair) { /* a live pair exists; the days posture is one tap away */ }
}

// ---------- CONNECTED HOME ----------
function kidsCard() {
  const kids = myChildren();
  const card = el("section", "cardIn homeCard");
  card.append(el("h2", "findTitle", tr("homes.kidsTitle")));
  if (!kids.length) {
    card.append(el("p", "homeBody", tr("homes.noKidsBodyDays")));
    const b = el("button", "mainBtn", tr("homes.addKidsBtn")); b.type = "button";
    b.addEventListener("click", () => navTo("children"));
    card.append(b);
    return card;
  }
  const row = el("div", "kidChipRow");
  for (const k of kids) {
    const chip = el("span", "kidChip");
    chip.append(el("span", "kidChipName", k.name));
    if (k.ageYears != null) chip.append(el("span", "kidChipAge", ageText(k.ageYears)));
    row.append(chip);
  }
  card.append(row);
  card.append(el("h3", "homeSub", tr("homes.lovesTitle")));
  const loves = [...new Set(kids.flatMap((k) => k.loves || []))];
  if (!loves.length) {
    card.append(el("p", "homeBody", tr("homes.lovesNone")));
  } else {
    const lr = el("div", "loveChipRow");
    for (const id of INTERESTS.filter((i) => loves.includes(i.id))) lr.append(el("span", "loveChip", tr("homes.love." + id.id)));
    card.append(lr);
  }
  const edit = el("button", "ghostBtn", tr("homes.lovesChange")); edit.type = "button";
  edit.addEventListener("click", () => navTo("children"));
  card.append(edit);
  return card;
}

function todayCard() {
  const kids = myChildren();
  const card = el("section", "cardIn homeCard");
  card.id = "homeToday";
  const names = kids.map((k) => k.name).filter(Boolean);
  const joined = names.length > 1 ? names.slice(0, -1).join(", ") + " " + tr("homes.andWord") + " " + names[names.length - 1] : (names[0] || "");
  card.append(el("h2", "findTitle", names.length ? tr("homes.todayTitle", undefined, { names: joined }) : tr("family.today")));
  if (!kids.length) {
    card.append(el("p", "homeBody", tr("homes.todayEmpty")));
    return card;
  }
  card.append(el("p", "homeBody", tr("homes.todayMade")));
  const plan = planDay(kids, todayISO());
  for (const slot of plan) {
    const row = el("div", "planRow");
    row.append(el("span", "planTime", slot.time));
    const main = el("span", "planMain");
    main.append(el("span", "planTitle", tr("act." + slot.id + ".t")));
    main.append(el("span", "planNote", tr("act." + slot.id + ".n")));
    row.append(main);
    row.append(el("span", "planKids", (slot.kids || []).map((k) => k.name || "").filter(Boolean).join(", ")));
    card.append(row);
  }
  const wk = el("button", "ghostBtn", tr("homes.seeWeek")); wk.type = "button";
  wk.addEventListener("click", () => document.getElementById("homeWeek")?.scrollIntoView({ behavior: "smooth" }));
  card.append(wk);
  return card;
}

function weekCard() {
  const kids = myChildren();
  const card = el("section", "cardIn homeCard");
  card.id = "homeWeek";
  card.append(el("h2", "findTitle", tr("homes.weekTitle")));
  card.append(el("p", "homeBody", tr("homes.weekBody")));
  if (!kids.length) return card;
  const week = planWeek(kids, mondayOfISO(todayISO()));
  const strip = el("div", "weekStrip");
  const today = todayISO();
  for (const day of week) {
    const d = new Date(day.dateISO + "T12:00:00Z");
    const cell = el("div", "weekCell" + (day.dateISO === today ? " today" : ""));
    cell.append(el("span", "weekDay", tr("journey.day." + DAY_KEYS[d.getUTCDay()])));
    const first = day.slots[0];
    cell.append(el("span", "weekFirst", first ? tr("act." + first.id + ".t").split(" ")[0] : ""));
    cell.append(el("span", "weekDot", "•"));
    strip.append(cell);
  }
  card.append(strip);
  return card;
}

function linkCard() {
  const m = me();
  const card = el("section", "cardIn homeCard");
  card.append(el("h2", "findTitle", tr("homes.linkTitle")));
  const myPair = pairs()[0];
  const isFamily = !m || m.side !== "carer";
  if (isFamily) {
    card.append(el("p", "homeBody", tr("homes.linkBody")));
    let code = "";
    const hook = window.CARESITS_HOMES || {};
    if (hook.invite && hook.invite.code) code = hook.invite.code;
    if (!code) { try { code = localStorage.getItem(INVITE_KEY) || ""; } catch { code = ""; } }
    if (code && isCode(code)) {
      card.append(el("p", "linkCode", inviteLinkText(code)));
      const row = el("div", "homeBtnRow");
      const cp = el("button", "mainBtn", tr("homes.copyLink")); cp.type = "button";
      cp.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(inviteLinkText(code)); state.linkMsg = tr("homes.copied"); renderHome(); } catch { /* clipboard closed */ }
      });
      const sh = el("button", "ghostBtn", tr("homes.shareLink")); sh.type = "button";
      sh.addEventListener("click", async () => {
        try { if (navigator.share) await navigator.share({ text: inviteLinkText(code) }); } catch { /* share closed */ }
      });
      row.append(cp, sh);
      card.append(row);
    } else {
      const mk = el("button", "mainBtn", tr("homes.makeLink")); mk.type = "button";
      mk.addEventListener("click", () => {
        if (!m || !m.uid) { state.linkMsg = tr("homes.codeBad"); renderHome(); return; }
        const plan = planInviteCreate({ familyUid: m.uid, code: makeCode(), label: myName(), nowIso: nowIso() });
        if (!plan.ok) { state.linkMsg = tr("homes.codeBad"); renderHome(); return; }
        write(plan.kind, { path: plan.path, data: plan.data });
        try { localStorage.setItem(INVITE_KEY, plan.code); } catch { /* storage off */ }
        state.linkMsg = "";
        renderHome();
      });
      card.append(mk);
    }
    card.append(el("p", "homeBody", myPair && myPair.otherName ? tr("homes.linkConnected", undefined, { name: myPair.otherName }) : tr("homes.linkWaiting")));
    if (state.linkMsg) card.append(el("p", "homeBody homeWarm", state.linkMsg));
  }
  // Open a link you were sent.
  const open = el("div", "openLink");
  open.append(el("h3", "homeSub", tr("homes.openLinkTitle")));
  open.append(el("p", "homeBody", tr("homes.openLinkBody")));
  const row = el("div", "openRow");
  const input = el("input", "codeInput");
  input.type = "text";
  input.placeholder = tr("homes.codePh");
  input.autocomplete = "off";
  const go = el("button", "mainBtn", tr("homes.connectBtn")); go.type = "button";
  go.addEventListener("click", async () => {
    const code = cleanCode(input.value);
    const uid = (me() || {}).uid || "";
    let invite = null;
    if (typeof window.CARESITS_INVITE_LOOKUP === "function") { try { invite = await window.CARESITS_INVITE_LOOKUP(code); } catch { invite = null; } }
    if (!invite && window.CARESITS_HOMES && typeof window.CARESITS_HOMES.inviteByCode === "function") invite = window.CARESITS_HOMES.inviteByCode(code);
    if (!invite && window.CARESITS_INVITES) invite = window.CARESITS_INVITES[code] || null;
    const plan = planInviteAccept({ code, invite, accepterUid: uid, nowIso: nowIso() });
    if (!plan.ok) { state.openMsg = tr("homes.codeBad"); renderHome(); return; }
    write(plan.kind, { relPath: plan.relPath, relData: plan.relData, invitePath: plan.invitePath, stamp: plan.stamp });
    state.openMsg = tr("homes.connectedOk");
    renderHome();
  });
  row.append(input, go);
  open.append(row);
  if (state.openMsg) open.append(el("p", "homeBody homeWarm", state.openMsg));
  card.append(open);
  return card;
}

function manageCard() {
  const card = el("section", "cardIn homeCard");
  card.append(el("h2", "findTitle", tr("homes.manageTitle")));
  const grid = el("div", "tileGrid");
  const tile = (label, fn) => {
    const b = el("button", "homeTile", label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  };
  grid.append(
    tile(tr("homes.tileSchedule"), () => navTo("calendar")),
    tile(tr("homes.tileOff"), () => navTo("calendar")),
    tile(tr("homes.tileExtra"), () => navTo("calendar")),
    tile(tr("homes.tileMessages"), () => gotoThread()),
    tile(tr("homes.tileShopping"), () => document.getElementById("homeShop")?.scrollIntoView({ behavior: "smooth" })),
    tile(tr("shell.daystory"), () => navTo("daystory")),
  );
  card.append(grid);
  return card;
}

function requestsCard() {
  const m = me();
  const card = el("section", "cardIn homeCard");
  card.append(el("h2", "findTitle", tr("homes.reqTitle")));
  const kindWords = { extra: tr("cal.kind.extra"), off: tr("cal.kind.off"), move: tr("cal.kind.move"), "week-change": tr("cal.kind.week-change") };
  const rows = [];
  for (const p of pairs()) {
    for (const r of p.requests || []) {
      if (r.state !== "waiting") continue;
      if (state.decided.has(p.pairId + ":" + r.id)) continue;
      rows.push({ pair: p, req: r });
    }
  }
  if (!rows.length) {
    card.append(el("p", "homeBody", tr("homes.reqEmpty")));
    return card;
  }
  for (const { pair, req } of rows) {
    const row = el("div", "reqRow");
    const what = kindWords[req.kind] || req.kind;
    const mine = m && req.askedBy === m.uid;
    row.append(el("p", "reqWhat", mine
      ? tr("homes.reqYouAsked", undefined, { what })
      : tr("homes.reqTheyAsked", undefined, { name: pair.otherName || tr("find.member"), what })));
    if (mine) {
      row.append(el("p", "homeBody", tr("homes.reqWaiting", undefined, { name: pair.otherName || tr("find.member") })));
    } else {
      row.append(el("p", "homeBody", tr("homes.reqWaitingYou")));
      const btns = el("div", "homeBtnRow");
      const acc = el("button", "mainBtn", tr("cal.accept")); acc.type = "button";
      const dec = el("button", "ghostBtn", tr("cal.decline")); dec.type = "button";
      const decide = (accept) => {
        const plan = planDecision({ ...req, id: req.id }, (m || {}).uid || "", accept);
        if (!plan.ok) return;
        write("request-decide", { pairId: pair.pairId, reqId: req.id, patch: plan.patch });
        state.decided.add(pair.pairId + ":" + req.id);
        renderHome();
      };
      acc.addEventListener("click", () => decide(true));
      dec.addEventListener("click", () => decide(false));
      btns.append(acc, dec);
      row.append(btns);
    }
    card.append(row);
  }
  return card;
}

function shoppingCard() {
  const card = el("section", "cardIn homeCard");
  card.id = "homeShop";
  card.append(el("h2", "findTitle", tr("homes.shopTitle")));
  const pair = pairs()[0];
  if (!pair) {
    card.append(el("p", "homeBody", tr("homes.shopNoPair")));
    return card;
  }
  card.append(el("p", "homeBody", tr("homes.shopBody")));
  if (state.shopItems == null) {
    const hook = window.CARESITS_HOMES || {};
    state.shopItems = Array.isArray(hook.shopping) ? hook.shopping.map((i) => ({ ...i })) : (Array.isArray(window.CARESITS_SHOPPING) ? window.CARESITS_SHOPPING.map((i) => ({ ...i })) : []);
  }
  const uid = (me() || {}).uid || "";
  const save = () => {
    const plan = planShoppingSave({ pairId: pair.pairId, items: state.shopItems, uid, nowIso: nowIso() });
    if (plan.ok) write(plan.kind, { path: plan.path, data: plan.data });
  };
  if (!state.shopItems.length) card.append(el("p", "homeBody", tr("homes.shopEmpty")));
  for (const item of state.shopItems) {
    const row = el("label", "shopRow");
    const box = el("input", "shopBox");
    box.type = "checkbox";
    box.checked = !!item.done;
    box.addEventListener("change", () => {
      state.shopItems = toggleItem(state.shopItems, item.id);
      save();
      renderHome();
    });
    row.append(box, el("span", "shopText" + (item.done ? " done" : ""), item.text));
    card.append(row);
  }
  const row = el("div", "openRow");
  const input = el("input", "codeInput");
  input.type = "text";
  input.placeholder = tr("homes.shopAddPh");
  const add = el("button", "mainBtn", tr("family.add")); add.type = "button";
  add.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    state.shopItems = addItem(state.shopItems, text, uid);
    save();
    renderHome();
  });
  row.append(input, add);
  card.append(row);
  return card;
}

function daysHome(root) {
  const firstPair = pairs()[0];
  root.append(greeting(firstPair && firstPair.otherName ? "homes.daysLeadName" : "homes.daysLead", firstPair && firstPair.otherName ? { name: firstPair.otherName } : undefined));
  root.append(postureSwitch("days"));
  root.append(kidsCard());
  root.append(todayCard());
  root.append(weekCard());
  root.append(linkCard());
  root.append(manageCard());
  root.append(requestsCard());
  root.append(shoppingCard());
  root.append(guideLine("homes.guideDays"));
}

function renderHome() {
  const root = document.getElementById("homeRoot");
  if (!root) return;
  if (!state.posture) state.posture = defaultPosture();
  root.replaceChildren();
  if (state.posture === "days") daysHome(root); else findingHome(root);
}

if (document.getElementById("homeRoot")) renderHome();
window.CARESITS_RENDER_HOME = renderHome;
// The live layer lands its data after the first paint; coming
// back Home re-renders from whatever has arrived by then.
document.querySelector('[data-nav="home"]')?.addEventListener("click", () => setTimeout(renderHome, 0));
