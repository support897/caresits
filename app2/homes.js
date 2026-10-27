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
import { accountKey, doneKey, draftKey } from "./storage-keys.js";
import { planDay, planWeek, mondayOfISO, INTERESTS, LEARNING_AGE_BANDS, LEARNING_AREAS, LEARNING_STYLES, normaliseLearningPlan, learningBandForAge } from "./activities.js";
import { LANGS } from "./questions.js";
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
  // The thread surface has no menu button of its own; it opens
  // by the shell's own mechanism (show, through its seam: the
  // hidden property on the surfaces), never by a class the
  // shell does not use (HQ ruling on Leg 14).
  if (typeof window.CARESITS_NAV === "function") window.CARESITS_NAV("thread");
  else {
    document.querySelectorAll(".surface").forEach((s) => (s.hidden = s.id !== "surface-thread"));
    document.querySelectorAll("[data-nav]").forEach((b) => b.classList.toggle("on", false));
  }
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
  // The stored device name belongs to the signed in world only
  // (HQ ruling on Leg 3 Note 2): on a shared device, a demo
  // never greets with the last person's name. The name renders
  // in the tour itself and inside the signed in account world.
  if (m && m.uid) { try { return localStorage.getItem(accountKey("caresits-name", m.uid)) || ""; } catch { return ""; } }
  return "";
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
function readJson(key) { if (!key) return null; try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } }

const state = { posture: null, shopItems: null, decided: new Set(), linkMsg: "", openMsg: "", uid: null };

function defaultPosture() {
  try { const key = accountKey(POSTURE_KEY); const saved = key ? localStorage.getItem(key) : null; if (saved === "finding" || saved === "days") return saved; } catch { /* storage off */ }
  return hasLivePair() ? "days" : "finding";
}

// ---------- shared bits ----------
function greeting(leadKey, leadVars) {
  const wrap = el("div", "homeHead");
  const name = myName();
  // The salutation follows the device's own clock (Polar
  // C2: the greeting was a fixed "Good morning" at every
  // hour). Morning before noon, afternoon to five, evening
  // after.
  const h = new Date().getHours();
  const part = h < 12 ? "" : h < 17 ? "Aft" : "Eve";
  const helloKey = "homes.hello" + part + (name ? "Name" : "");
  const currentMember = me();
  const roleHeading = { career: "homes.roleCareer", family: "homes.roleFamily", communicate: "homes.roleCommunicate" }[currentMember?.entryRole];
  if (roleHeading) wrap.append(el("p", "homeRoleHeading", tr(roleHeading)));
  wrap.append(el("h1", "homeHello", tr(helloKey, undefined, name ? { name } : undefined)));
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
      try { const key = accountKey(POSTURE_KEY); if (key) localStorage.setItem(key, id); } catch { /* storage off */ }
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
  const draft = readJson(draftKey());
  const done = readJson(doneKey());
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

  // Questionnaire progress card. The server seam (the boot's
  // judgement of the member's FULL saved state) outranks the
  // device keys: the drain consumes the done envelope by
  // design, so a member who finished on any device read 0%
  // here on every fresh boot (QA night N1). A completed seam
  // reads done; a partial seam reads its true count; the
  // device draft still speaks for a journey in progress on
  // this device.
  const sq = window.CARESITS_QUESTIONS || null;
  const sideForTotal = (sq && sq.side) || (draft && draft.side) || (m && m.side) || "family";
  const totalQ = ((sideForTotal === "carer" ? CARER_PAGES : FAMILY_PAGES).flatMap((p) => p.fields).length)
    + ((EXPANSION[sideForTotal] || []).flatMap((p) => p.fields).length);
  const serverDone = !!(sq && sq.answered > 0 && (sq.level === "full" || sq.answered >= totalQ));
  const q = el("section", "cardIn homeCard");
  if (serverDone) {
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
  } else if (sq && sq.answered > 0) {
    const pct = Math.max(1, Math.min(99, Math.round((100 * sq.answered) / Math.max(1, totalQ))));
    q.append(el("h2", "findTitle", tr("homes.qTitlePct", undefined, { n: pct })));
    q.append(el("p", "homeBody", tr("homes.qBody")));
    q.append(el("p", "homeBody homeWarm", tr("homes.qPerfect")));
    const qb = el("button", "mainBtn", tr("homes.qFinishBtn")); qb.type = "button";
    qb.addEventListener("click", () => navTo("questionnaire"));
    q.append(qb);
  } else if (done) {
    q.append(el("h2", "findTitle", tr("homes.qTitleDone")));
    q.append(el("p", "homeBody", tr("homes.qBodyDone")));
  } else if (!sq) {
    // No seam has landed yet (the boot's deep read is still
    // travelling): the card asserts nothing numeric. A 0%
    // printed here would be a guess dressed as a fact, and
    // for a completed member a false one (QA F-CS-RT-1).
    // The publication re-renders Home when it lands.
    q.append(el("h2", "findTitle", tr("homes.qReading")));
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
    const d = new Date(day.date + "T12:00:00Z");
    const cell = el("div", "weekCell" + (day.date === today ? " today" : ""));
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
    if (!code) { try { const key = accountKey(INVITE_KEY, m?.uid); code = key ? localStorage.getItem(key) || "" : ""; } catch { code = ""; } }
    if (code && isCode(code)) {
      card.append(el("p", "linkCode", inviteLinkText(code)));
      const row = el("div", "homeBtnRow");
      const cp = el("button", "mainBtn", tr("homes.copyLink")); cp.type = "button";
      cp.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(inviteLinkText(code)); state.linkMsg = tr("homes.copied"); renderHome(); } catch { state.linkMsg = tr("homes.copyFail"); renderHome(); }
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
        try { const key = accountKey(INVITE_KEY, m?.uid); if (key) localStorage.setItem(key, plan.code); } catch { /* storage off */ }
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

function entryRole() {
  const m = me() || {};
  if (m.entryRole === "communicate" || m.side === "communicate") return "communicate";
  if (m.entryRole === "career" || m.side === "carer") return "career";
  return "family";
}

function careerHome(root) {
  root.append(greeting("homes.careerLead"));
  const profile = el("section", "cardIn homeCard");
  profile.append(el("h2", "findTitle", tr("homes.careerProfileTitle")));
  profile.append(el("p", "homeBody", tr("homes.careerProfileBody")));
  const status = window.CARESITS_PROFILE_COMPLETE ? tr("homes.careerProfileDone") : tr("homes.careerProfileStart");
  profile.append(el("p", "homeBody homeWarm", status));
  const questionnaire = el("button", "mainBtn", tr("homes.careerQuestionnaire"));
  questionnaire.type = "button";
  questionnaire.addEventListener("click", () => navTo("questionnaire"));
  profile.append(questionnaire);
  root.append(profile);

  const jobs = el("section", "cardIn homeCard homeUrgent");
  jobs.append(el("h2", "findTitle", tr("homes.careerJobsTitle")));
  jobs.append(el("p", "homeBody", tr("homes.careerJobsBody")));
  const board = el("button", "mainBtn", tr("homes.careerJobsOpen"));
  board.type = "button";
  board.addEventListener("click", () => navTo("board"));
  jobs.append(board);
  root.append(jobs);
  root.append(guideLine("homes.careerGuide"));
}

function learningPlanKey() { return accountKey("caresits-learning-plan-draft"); }
function saveLearningDraft(plan) {
  const clean = normaliseLearningPlan({ ...plan, updatedAt: new Date().toISOString() });
  const key = learningPlanKey();
  try { if (key) localStorage.setItem(key, JSON.stringify(clean)); } catch { /* private storage is optional */ }
  window.CARESITS_LEARNING_PLAN = clean;
  if (window.CARESITS_ME) window.CARESITS_ME = { ...window.CARESITS_ME, learningPlan: clean };
  return clean;
}
function initialLearningPlan() {
  const stored = readJson(learningPlanKey());
  const shared = window.CARESITS_LEARNING_PLAN || window.CARESITS_ME?.learningPlan;
  const pairPlan = (window.CARESITS_PHASE_C?.rels || []).find((rel) => ["contact", "hired"].includes(rel.state) && rel.learningPlan)?.learningPlan;
  if (pairPlan) return normaliseLearningPlan(pairPlan);
  if (shared) return normaliseLearningPlan(shared);
  if (stored) return normaliseLearningPlan(stored);
  const kids = myChildren();
  return normaliseLearningPlan({ children: kids.map((kid) => ({ band: learningBandForAge(kid.ageYears) })) });
}
function persistLearningPlan(plan) {
  const clean = saveLearningDraft(plan);
  const rels = window.CARESITS_PHASE_C?.rels || [];
  const pair = rels.find((rel) => ["contact", "hired"].includes(rel.state));
  const pairId = pair?.id || "";
  const save = window.CARESITS_WRITE;
  if (typeof save === "function") {
    Promise.resolve(save("learning-plan", { plan: clean, pairId })).then((result) => {
      if (result && result.ok && pairId) {
        window.CARESITS_LEARNING_PLAN = clean;
        window.CARESITS_RENDER_HOME?.();
      }
    }).catch(() => {});
  }
  return clean;
}
function learningChoiceRow(items, values, keyPrefix, onChange) {
  const row = el("div", "chipRow learningChoices");
  for (const item of items) {
    const id = typeof item === "string" ? item : item.id;
    const label = typeof item === "string" ? tr("learning." + keyPrefix + "." + item) : tr(item.key);
    const button = el("button", "chipBtn" + (values.includes(id) ? " on" : ""), label);
    button.type = "button";
    button.setAttribute?.("aria-pressed", String(values.includes(id)));
    button.addEventListener("click", () => onChange(id));
    row.append(button);
  }
  return row;
}
function learningSetupCard() {
  let plan = initialLearningPlan();
  const card = el("section", "cardIn homeCard learningCard");
  card.append(el("h2", "findTitle", tr("learning.title")));
  card.append(el("p", "homeBody", tr("learning.lead")));
  if (!plan.setupComplete) {
    const step = plan.step;
    const stepName = ["learning.stepAge", "learning.stepAreas", "learning.stepStyle"][step];
    card.append(el("p", "learningStep", tr("learning.step", undefined, { n: step + 1 })), el("h3", "findName", tr(stepName)));
    if (step === 0) {
      card.append(el("p", "findPlace", tr("learning.ageHelp")));
      const list = el("div", "learningAgeList");
      if (!plan.children.length) plan.children = [{ band: "" }];
      const renderAges = () => {
        list.replaceChildren();
        plan.children.forEach((child, index) => {
          const row = el("label", "learningAgeRow");
          const name = el("span", "learningChildLabel", tr("learning.child", undefined, { n: index + 1 }));
          const select = el("select", "txtIn");
          select.setAttribute?.("aria-label", tr("learning.childAge", undefined, { n: index + 1 }));
          const blank = el("option", null, tr("learning.chooseAge")); blank.value = ""; select.append(blank);
          for (const band of LEARNING_AGE_BANDS) { const option = el("option", null, tr(band.key)); option.value = band.id; select.append(option); }
          select.value = child.band || "";
          select.addEventListener("change", () => {
            plan.children[index] = { band: select.value };
            plan = saveLearningDraft(plan);
          });
          row.append(name, select);
          if (plan.children.length > 1) {
            const remove = el("button", "quietBtn", tr("learning.removeChild"));
            remove.type = "button";
            remove.addEventListener("click", () => {
              plan.children.splice(index, 1);
              plan = saveLearningDraft(plan);
              renderAges();
            });
            row.append(remove);
          }
          list.append(row);
        });
      };
      renderAges();
      const add = el("button", "quietBtn learningAdd", tr("learning.addChild"));
      add.type = "button";
      add.addEventListener("click", () => {
        plan.children.push({ band: "" });
        plan = saveLearningDraft(plan);
        renderAges();
      });
      card.append(list, add);
    } else if (step === 1) {
      card.append(el("p", "findPlace", tr("learning.optional")));
      card.append(learningChoiceRow(LEARNING_AREAS, plan.areas, "area", (id) => {
        plan.areas = plan.areas.includes(id) ? plan.areas.filter((v) => v !== id) : [...plan.areas, id];
        plan = saveLearningDraft(plan);
        window.CARESITS_RENDER_HOME?.();
      }));
    } else {
      card.append(el("p", "findPlace", tr("learning.optional")));
      card.append(el("p", "learningSubhead", tr("learning.stylesTitle")));
      card.append(learningChoiceRow(LEARNING_STYLES, plan.styles, "style", (id) => {
        plan.styles = plan.styles.includes(id) ? plan.styles.filter((v) => v !== id) : [...plan.styles, id];
        plan = saveLearningDraft(plan);
        window.CARESITS_RENDER_HOME?.();
      }));
      card.append(el("p", "learningSubhead", tr("learning.languagesTitle")));
      const languageOptions = [...new Set([...LANGS, "Cantonese", "Other"])];
      const langRow = el("div", "chipRow learningChoices");
      for (const language of languageOptions) {
        const selected = plan.languages.includes(language);
        const button = el("button", "chipBtn" + (selected ? " on" : ""), language === "Other" ? tr("learning.other") : language);
        button.type = "button";
        button.setAttribute?.("aria-pressed", String(selected));
        button.addEventListener("click", () => {
          plan.languages = selected ? plan.languages.filter((v) => v !== language) : [...plan.languages, language];
          plan = saveLearningDraft(plan);
          window.CARESITS_RENDER_HOME?.();
        });
        langRow.append(button);
      }
      card.append(langRow);
      if (plan.languages.includes("Other")) {
        const other = el("input", "txtIn");
        other.placeholder = tr("learning.otherLanguagePh");
        other.value = plan.otherLanguage;
        other.addEventListener("input", () => { plan.otherLanguage = other.value; plan = saveLearningDraft(plan); });
        card.append(other);
      }
    }
    const actions = el("div", "homeBtnRow learningActions");
    if (step > 0) {
      const back = el("button", "ghostBtn", tr("learning.back"));
      back.type = "button";
      back.addEventListener("click", () => { plan = persistLearningPlan({ ...plan, step: step - 1, setupComplete: false }); window.CARESITS_RENDER_HOME?.(); });
      actions.append(back);
    }
    const skip = el("button", "ghostBtn", tr("learning.skip"));
    skip.type = "button";
    skip.addEventListener("click", () => {
      const last = step === 2;
      plan = persistLearningPlan({ ...plan, step: last ? 2 : step + 1, setupComplete: last });
      window.CARESITS_RENDER_HOME?.();
    });
    const next = el("button", "mainBtn", tr(step === 2 ? "learning.finish" : "learning.continue"));
    next.type = "button";
    next.addEventListener("click", () => {
      const last = step === 2;
      plan = persistLearningPlan({ ...plan, step: last ? 2 : step + 1, setupComplete: last });
      window.CARESITS_RENDER_HOME?.();
    });
    actions.append(skip, next);
    card.append(actions);
  } else {
    const summary = [];
    const ages = plan.children.map((child) => LEARNING_AGE_BANDS.find((band) => band.id === child.band)).filter(Boolean).map((band) => tr(band.key));
    if (ages.length) summary.push(ages.join(", "));
    if (plan.areas.length) summary.push(plan.areas.map((id) => tr("learning.area." + id)).join(", "));
    if (plan.styles.length) summary.push(plan.styles.map((id) => tr("learning.style." + id)).join(", "));
    if (plan.languages.length) summary.push(plan.languages.join(", "));
    card.append(el("p", "homeBody", summary.join(" · ") || tr("learning.noChoices")));
    const edit = el("button", "ghostBtn", tr("learning.edit"));
    edit.type = "button";
    edit.addEventListener("click", () => {
      plan = persistLearningPlan({ ...plan, step: 0, setupComplete: false });
      window.CARESITS_RENDER_HOME?.();
    });
    card.append(edit);
  }
  return card;
}

function communicateHome(root) {
  root.append(greeting("homes.communicateLead"));
  root.append(learningSetupCard());
  const card = el("section", "cardIn homeCard");
  card.append(el("h2", "findTitle", tr("homes.conversations")));
  card.append(el("p", "homeBody", tr("homes.communicateBody")));
  const thread = window.CARESITS_THREAD;
  if (thread && thread.pairId) {
    card.append(el("h3", "findName", thread.otherName || tr("thread.title")));
  } else {
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-rest-calm.png";
    img.alt = "";
    card.append(img, el("p", "homeBody", tr("homes.noConversations")));
  }
  const open = el("button", "mainBtn", tr("homes.openConversations"));
  open.type = "button";
  open.addEventListener("click", () => navTo("thread"));
  card.append(open);
  root.append(card);
}

function renderHome() {
  const root = document.getElementById("homeRoot");
  if (!root) return;
  const uid = (me() || {}).uid || null;
  if (state.uid !== uid) { state.uid = uid; state.posture = null; }
  root.replaceChildren();
  const role = entryRole();
  if (role === "career") { careerHome(root); return; }
  if (role === "communicate") { communicateHome(root); return; }
  if (!state.posture) state.posture = defaultPosture();
  if (state.posture === "days") daysHome(root); else findingHome(root);
}

if (document.getElementById("homeRoot")) renderHome();
window.CARESITS_RENDER_HOME = renderHome;
// The live layer lands its data after the first paint; coming
// back Home re-renders from whatever has arrived by then.
document.querySelector('[data-nav="home"]')?.addEventListener("click", () => setTimeout(renderHome, 0));
