// Caresitters app2 — Matches and the urgent board (Phase C).
// Every button is planned by pair-actions.js first, so the app
// never offers a move the rules would refuse. Writes ride
// CARESITS_WRITE (the live account layer) when it is present.
// The browse gate lives in the planners: an unfinished profile
// is walked to the questionnaire, never scolded.
import { planContact, planTransition, planJobPost, planInterest, cleanJobListings } from "./pair-actions.js";
import { learningMatchDetails, mergeLearningPlans } from "./activities.js";
import { accountKey } from "./storage-keys.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const nowIso = () => new Date().toISOString();
const today = () => nowIso().slice(0, 10);
const write = (kind, payload) => { if (typeof window.CARESITS_WRITE === "function") return window.CARESITS_WRITE(kind, payload); return null; };
const walkToQuestions = () => document.querySelector('[data-nav="questionnaire"]')?.click();
const profileDone = () => window.CARESITS_PROFILE_COMPLETE === true;
const connectionPromptMemory = new Set();
function connectionPromptKey(uid) { return accountKey("caresits-connected-prompts", uid); }
function connectionPromptSeen(uid, pairId) {
  const marker = `${uid}:${pairId}`;
  if (connectionPromptMemory.has(marker)) return true;
  try {
    const key = connectionPromptKey(uid);
    const seen = key ? JSON.parse(localStorage.getItem(key) || "[]") : [];
    return Array.isArray(seen) && seen.includes(pairId);
  } catch { return false; }
}
function markConnectionPromptSeen(uid, pairId) {
  const marker = `${uid}:${pairId}`;
  connectionPromptMemory.add(marker);
  try {
    const key = connectionPromptKey(uid);
    if (!key) return;
    const seen = JSON.parse(localStorage.getItem(key) || "[]");
    const list = Array.isArray(seen) ? seen : [];
    if (!list.includes(pairId)) localStorage.setItem(key, JSON.stringify([...list, pairId].slice(-100)));
  } catch { /* the in-memory guard still prevents repeats this session */ }
}
function switchToCommunicate() {
  if (typeof window.CARESITS_SET_ACTIVE_SIDE === "function") {
    window.CARESITS_SET_ACTIVE_SIDE("communicate");
    return;
  }
  const me = window.CARESITS_ME;
  if (me) window.CARESITS_ME = { ...me, activeSide: "communicate" };
  document.documentElement.dataset.entryRole = "communicate";
  window.CARESITS_ROLE_NAV?.("communicate");
  window.CARESITS_NAV?.("home");
}
export function showConnectedPrompt(pairId) {
  const uid = window.CARESITS_ME?.uid;
  if (!uid || !pairId || connectionPromptSeen(uid, pairId) || document.getElementById("connectedPrompt")) return false;
  markConnectionPromptSeen(uid, pairId);
  const wrap = el("div", "sheetWrap");
  wrap.id = "connectedPrompt";
  const card = el("section", "sheetCard connectedPromptCard");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "connectedPromptTitle");
  card.append(el("h2", "findTitle", tr("connected.title")));
  card.lastChild.id = "connectedPromptTitle";
  card.append(el("p", "homeBody", tr("connected.body")));
  const row = el("div", "homeBtnRow");
  const yes = el("button", "mainBtn", tr("connected.yes"));
  yes.type = "button";
  yes.addEventListener("click", () => { wrap.remove(); switchToCommunicate(); });
  const later = el("button", "ghostBtn", tr("connected.later"));
  later.type = "button";
  later.addEventListener("click", () => wrap.remove());
  row.append(yes, later);
  card.append(row);
  wrap.append(card);
  wrap.addEventListener("click", (event) => { if (event.target === wrap) wrap.remove(); });
  document.body.append(wrap);
  yes.focus();
  return true;
}

import { t as tr } from "./lang.js";
const STATE_WORDS = { pending: tr("matches.state.pending"), contact: tr("matches.state.contact"), hired: tr("matches.state.hired"), ended: tr("matches.state.ended") };

export function renderMatches(root, viewerUid, rels, names) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.matches")));
  if (!rels.length) {
    const box = el("div", "cardIn");
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-rest-calm.png";
    img.alt = tr("find.bunnyRest");
    box.append(img, el("h3", null, tr("find.noneTitle")), el("p", null, tr("matches.emptyBody")));
    root.append(box);
    return;
  }
  const list = el("div", "findList");
  for (const rel of rels) {
    const otherUid = rel.members.find((m) => m !== viewerUid);
    const card = el("article", "findCard");
    card.append(el("h3", "findName", names[otherUid] || tr("find.member")));
    card.append(el("p", "findPlace", STATE_WORDS[rel.state] || rel.state));
    for (const reason of rel.learningMatches || []) {
      const value = reason.type === "style" ? tr("learning.style." + reason.value)
        : reason.type === "area" ? tr("learning.area." + reason.value) : reason.value;
      const key = reason.type === "style" ? "learning.matchStyle" : reason.type === "area" ? "learning.matchArea" : "learning.matchLanguage";
      card.append(el("p", "learningMatchReason", tr(key, undefined, { style: value, area: value, language: value })));
    }
    const row = el("div", "actRow");
    const addBtn = (label, to) => {
      const plan = planTransition(rel, viewerUid, to);
      if (!plan.ok) return;
      const b = el("button", "mainBtn actBtn", label);
      b.type = "button";
      b.addEventListener("click", async () => {
        const result = await write("transition", { pairId: rel.id, patch: plan.patch });
        if (result?.ok && to === "contact") {
          const me = window.CARESITS_ME || {};
          if (!rel.learningPlan && me.learningPlan) await write("learning-plan", { plan: me.learningPlan, pairId: rel.id });
          showConnectedPrompt(rel.id);
        }
      });
      row.append(b);
    };
    if (rel.state === "pending" && rel.createdBy !== viewerUid) addBtn(tr("matches.confirm"), "contact");
    if (rel.state === "contact" && rel.familyUid === viewerUid) addBtn(tr("matches.hired"), "hired");
    if (rel.state !== "ended") addBtn(tr("matches.end"), "ended");
    card.append(row);
    const quiet = el("div", "quietRow");
    const rep = el("button", "quietBtn", tr("find.report"));
    rep.type = "button";
    rep.addEventListener("click", () => window.CARESITS_REPORT?.(otherUid, { surface: "profile", snapshot: { items: ["match"], text: "", title: names[otherUid] || tr("find.member") } }));
    const blk = el("button", "quietBtn", tr("find.block"));
    blk.type = "button";
    blk.addEventListener("click", () => window.CARESITS_BLOCK?.(otherUid, card));
    quiet.append(rep, blk);
    card.append(quiet);
    list.append(card);
  }
  root.append(list);
}

export function renderBoard(root, viewer, jobs) {
  const visibleJobs = cleanJobListings(jobs);
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.board")));
  root.append(el("p", "findPool", tr("board.lead")));
  if (viewer?.side === "family") {
    const form = el("div", "findCard");
    form.append(el("h3", "findName", tr("board.postTitle")));
    const when = el("select", "txtIn");
    when.setAttribute("aria-label", tr("board.when"));
    when.id = "jobWhen";
    const whenLabel = el("label", "findPlace", tr("board.when"));
    whenLabel.htmlFor = when.id;
    for (const [value, label] of [["Today", tr("board.today")], ["Tomorrow", tr("board.tomorrow")], ["This weekend", tr("board.weekend")]]) {
      const option = el("option", null, label);
      option.value = value;
      when.append(option);
    }
    const suburb = el("input", "txtIn");
    suburb.placeholder = tr("board.postcodePh");
    suburb.setAttribute("aria-label", tr("board.postcodePh"));
    const note = el("input", "txtIn");
    note.placeholder = tr("board.notePh");
    note.setAttribute("aria-label", tr("board.notePh"));
    const post = el("button", "mainBtn", tr("board.post"));
    post.type = "button";
    const msg = el("p", "gateMsg", "");
    post.addEventListener("click", () => {
      if (!suburb.value.trim() || !note.value.trim()) { msg.textContent = tr("board.postMissing"); return; }
      const plan = planJobPost({ familyUid: viewer.uid, when: when.value || tr("board.soon"), dayParts: [], postcode: suburb.value.trim(), bands: [], note: note.value.trim(), nowIso: nowIso(), profileComplete: profileDone() });
      if (!plan.ok && plan.reason === "profile-incomplete") { msg.textContent = tr("board.gatePost"); walkToQuestions(); return; }
      if (plan.ok) write("job", plan);
    });
    form.append(whenLabel, when, suburb, note, post, msg);
    root.append(form);
  }
  if (!visibleJobs.length) {
    const box = el("div", "cardIn");
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-rest-calm.png";
    img.alt = tr("find.bunnyRest");
    box.append(img, el("h3", null, tr("board.emptyTitle")), el("p", null, tr("board.none")));
    root.append(box);
    return;
  }
  const list = el("div", "findList");
  for (const job of visibleJobs) {
    const card = el("article", "findCard");
    card.append(el("h3", "findName", job.postcode ? tr("find.postcode", undefined, { n: job.postcode }) : tr("board.nearby")));
    card.append(el("p", "findPlace", (job.when || tr("board.soon")) + (job.note ? " · " + job.note : "")));
    if (viewer?.side === "carer") {
      const noteIn = el("input", "txtIn");
      noteIn.placeholder = tr("board.interestPh");
      const offer = el("button", "mainBtn", tr("board.offer"));
      offer.type = "button";
      const msg = el("p", "gateMsg", "");
      offer.addEventListener("click", () => {
        const plan = planInterest({ job, carerUid: viewer.uid, note: noteIn.value, nowIso: nowIso(), profileComplete: profileDone() });
        if (!plan.ok && plan.reason === "profile-incomplete") { msg.textContent = tr("board.gateNote"); walkToQuestions(); return; }
        if (plan.ok) write("interest", plan);
      });
      card.append(noteIn, offer, msg);
    }
    list.append(card);
  }
  root.append(list);
}

function bootPhaseC() {
  const mRoot = document.getElementById("matchesRoot");
  const bRoot = document.getElementById("boardRoot");
  if (window.CARESITS_PHASE_C) {
    const d = window.CARESITS_PHASE_C;
    if (mRoot) renderMatches(mRoot, d.viewer?.uid || "", d.rels || [], d.names || {});
    if (bRoot) renderBoard(bRoot, d.viewer || null, d.jobs || []);
  } else {
    if (mRoot) renderMatches(mRoot, "", [], {});
    if (bRoot) renderBoard(bRoot, null, []);
  }
  window.CARESITS_CONTACT = async (otherUid, otherDoc) => {
    const me = window.CARESITS_ME || {};
    const familyUid = me.side === "family" ? me.uid : otherUid;
    const carerUid = me.side === "family" ? otherUid : me.uid;
    const familyPlan = me.side === "family" ? me.learningPlan : otherDoc?.learningPlan;
    const carerPlan = me.side === "carer" ? me.learningPlan : otherDoc?.learningPlan;
    const learning = learningMatchDetails(familyPlan, carerPlan);
    const sharedPlan = mergeLearningPlans(familyPlan, carerPlan);
    const plan = planContact({ familyUid, carerUid, createdBy: me.uid, nowIso: nowIso(), createdDay: today(), profileComplete: profileDone(), learningPlan: sharedPlan, learningMatches: learning.reasons });
    if (!plan.ok && plan.reason === "profile-incomplete") { walkToQuestions(); return; }
    if (plan.ok) {
      const result = await write("contact", plan);
      if (result?.ok) {
        document.querySelector('[data-nav="matches"]')?.click();
        showConnectedPrompt(plan.pairId);
      }
    }
  };
}

// The live bridge fills CARESITS_PHASE_C when the member's own
// world lands (F19) and calls this seam to render it in place,
// the way the trust surfaces refresh on their render seam.
window.CARESITS_PHASE_C_RENDER = bootPhaseC;
window.CARESITS_SHOW_CONNECTED_PROMPT = showConnectedPrompt;

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootPhaseC);
else bootPhaseC();
