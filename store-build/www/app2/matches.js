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
    const action = el("button", "mainBtn", tr("matches.emptyAction"));
    action.type = "button";
    action.addEventListener("click", () => window.CARESITS_NAV?.("find"));
    box.append(action);
    root.append(box);
    return;
  }
  const list = el("div", "findList");
  for (const rel of rels) {
    const otherUid = rel.members.find((m) => m !== viewerUid);
    const name = names[otherUid] || tr("find.member");
    const card = el("article", "findCard");
    const head = el("div", "findHead");
    head.append(el("div", "findInitial", name.slice(0, 1)));
    const who = el("div", "findWho");
    who.append(el("h3", "findName", name));
    who.append(el("p", "findPlace", STATE_WORDS[rel.state] || rel.state));
    head.append(who);
    card.append(head);
    const status = el("div", "trustRow");
    status.append(el("span", "trustChip", STATE_WORDS[rel.state] || rel.state));
    card.append(status);
    for (const reason of rel.learningMatches || []) {
      const value = reason.type === "style" ? tr("learning.style." + reason.value)
        : reason.type === "area" ? tr("learning.area." + reason.value) : reason.value;
      const key = reason.type === "style" ? "learning.matchStyle" : reason.type === "area" ? "learning.matchArea" : "learning.matchLanguage";
      card.append(el("p", "learningMatchReason", tr(key, undefined, { style: value, area: value, language: value })));
    }
    const details = el("div", "findDetails");
    details.hidden = true;
    details.append(el("p", "findDetailLine", tr("matches.detailsBody", undefined, { state: STATE_WORDS[rel.state] || rel.state })));
    card.append(details);
    const actionRow = el("div", "findActions");
    const detailsButton = el("button", "ghostBtn findDetailsBtn", tr("find.details"));
    detailsButton.type = "button";
    detailsButton.setAttribute("aria-expanded", "false");
    detailsButton.addEventListener("click", () => {
      details.hidden = !details.hidden;
      detailsButton.setAttribute("aria-expanded", String(!details.hidden));
      detailsButton.textContent = tr(details.hidden ? "find.details" : "find.hideDetails");
    });
    const message = el("button", "mainBtn findMsg", tr("find.message"));
    message.type = "button";
    message.addEventListener("click", () => window.CARESITS_NAV?.("thread"));
    actionRow.append(detailsButton, message);
    card.append(actionRow);
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
    if (row.childElementCount) card.append(row);
    const quiet = el("div", "quietRow");
    const rep = el("button", "quietBtn", tr("find.report"));
    rep.type = "button";
    rep.addEventListener("click", () => window.CARESITS_REPORT?.(otherUid, { surface: "profile", snapshot: { items: ["match"], text: "", title: name } }));
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
    const form = el("div", "findCard urgentJobForm");
    form.setAttribute("aria-labelledby", "urgentFormTitle");
    const title = el("h3", "findName", tr("board.postTitle"));
    title.id = "urgentFormTitle";
    form.append(title);
    const progress = document.createElement("progress");
    progress.className = "flowProgress";
    progress.max = 4;
    progress.value = 1;
    progress.setAttribute("aria-label", tr("board.stepOf", undefined, { n: 1, total: 4 }));
    const progressText = el("p", "flowStepText", tr("board.stepOf", undefined, { n: 1, total: 4 }));
    const content = el("div", "urgentStepContent");
    const message = el("p", "formMsg");
    message.setAttribute("role", "status");
    const actions = el("div", "homeBtnRow urgentStepActions");
    form.append(progress, progressText, content, message, actions);
    root.append(form);

    const children = Array.isArray(window.CARESITS_FAMILY?.children) ? window.CARESITS_FAMILY.children : [];
    const draft = {
      when: "today",
      duration: "2 hours",
      child: children[0]?.name || "",
      postcode: window.CARESITS_ME?.postcode || "",
      note: "",
    };
    let step = 0;
    const steps = [
      { key: "when", title: "board.when", options: [["today", "board.today"], ["tomorrow", "board.tomorrow"], ["weekend", "board.weekend"]] },
      { key: "duration", title: "board.duration", options: [["2 hours", "board.duration2"], ["4 hours", "board.duration4"], ["6 hours", "board.duration6"], ["Full day", "board.durationDay"]] },
    ];
    const renderStep = () => {
      progress.value = step + 1;
      progress.setAttribute("aria-label", tr("board.stepOf", undefined, { n: step + 1, total: 4 }));
      progressText.textContent = tr("board.stepOf", undefined, { n: step + 1, total: 4 });
      message.textContent = "";
      content.replaceChildren();
      actions.replaceChildren();
      if (step < 2) {
        const question = steps[step];
        const label = el("p", "findPlace fieldLabel", tr(question.title));
        const choices = el("div", "urgentChoiceList");
        choices.id = step === 0 ? "jobWhen" : "jobDuration";
        choices.setAttribute("role", "group");
        choices.setAttribute("aria-label", tr(question.title));
        for (const [value, labelKey] of question.options) {
          const option = el("button", "urgentChoice" + (draft[question.key] === value ? " on" : ""), tr(labelKey));
          option.type = "button";
          option.setAttribute("aria-pressed", String(draft[question.key] === value));
          option.addEventListener("click", () => {
            draft[question.key] = value;
            choices.querySelectorAll(".urgentChoice").forEach((button) => {
              const selected = button === option;
              button.classList.toggle("on", selected);
              button.setAttribute("aria-pressed", String(selected));
            });
          });
          choices.append(option);
        }
        content.append(label, choices);
      } else if (step === 2) {
        const label = el("label", "fieldLabel", tr("board.childLabel"));
        label.htmlFor = "jobChild";
        const select = el("select", "txtIn");
        select.id = "jobChild";
        if (children.length) {
          for (const child of children) {
            const option = el("option", null, child.name + (child.ageYears != null ? " · " + tr("family.ageMany", undefined, { n: child.ageYears }) : ""));
            option.value = child.name;
            select.append(option);
          }
        } else {
          const option = el("option", null, tr("board.childLater"));
          option.value = "";
          select.append(option);
        }
        if (draft.child) select.value = draft.child;
        select.addEventListener("change", () => { draft.child = select.value; });
        content.append(label, select);
        content.append(el("p", "fieldHint", tr("board.childHint")));
      } else {
        const areaLabel = el("label", "fieldLabel", tr("board.postcodePh"));
        areaLabel.htmlFor = "jobPostcode";
        const postcode = el("input", "txtIn");
        postcode.id = "jobPostcode";
        postcode.type = "text";
        postcode.autocomplete = "postal-code";
        postcode.value = draft.postcode;
        postcode.placeholder = tr("board.postcodePh");
        postcode.addEventListener("input", () => { draft.postcode = postcode.value; });
        const noteLabel = el("label", "fieldLabel", tr("board.noteLabel"));
        noteLabel.htmlFor = "jobNote";
        const note = el("textarea", "txtIn");
        note.id = "jobNote";
        note.rows = 3;
        note.value = draft.note;
        note.placeholder = tr("board.notePh");
        note.addEventListener("input", () => { draft.note = note.value; });
        content.append(areaLabel, postcode, noteLabel, note);
      }

      if (step > 0) {
        const back = el("button", "ghostBtn", tr("board.back"));
        back.type = "button";
        back.addEventListener("click", () => { step -= 1; renderStep(); content.querySelector('.urgentChoice[aria-pressed="true"], select, input, textarea')?.focus({ preventScroll: true }); });
        actions.append(back);
      }
      const next = el("button", "mainBtn", tr(step === 3 ? "board.post" : "board.next"));
      next.type = "button";
      next.id = step === 3 ? "jobPost" : "jobNext";
      next.addEventListener("click", async () => {
        if (step < 3) { step += 1; renderStep(); content.querySelector('.urgentChoice[aria-pressed="true"], select, input, textarea')?.focus({ preventScroll: true }); return; }
        draft.postcode = document.getElementById("jobPostcode")?.value.trim() || "";
        draft.note = document.getElementById("jobNote")?.value.trim() || "";
        if (!draft.postcode) { message.textContent = tr("board.needPostcode"); document.getElementById("jobPostcode")?.focus(); return; }
        const selectedChild = children.find((child) => child.name === draft.child);
        const childDetail = selectedChild?.ageYears != null
          ? tr("board.childAge", undefined, { age: tr("family.ageMany", undefined, { n: selectedChild.ageYears }) })
          : draft.child ? tr("board.childLater") : "";
        const detail = [
          draft.note,
          `${tr("board.durationLabel")}: ${tr(({ "2 hours": "board.duration2", "4 hours": "board.duration4", "6 hours": "board.duration6", "Full day": "board.durationDay" })[draft.duration])}`,
          childDetail,
        ].filter(Boolean).join(" · ");
        const plan = planJobPost({ familyUid: viewer.uid, when: tr("board." + (draft.when || "today")), dayParts: [], postcode: draft.postcode, bands: [], note: detail, nowIso: nowIso(), profileComplete: profileDone() });
        if (!plan.ok && plan.reason === "profile-incomplete") {
          message.textContent = tr("board.gatePost");
          walkToQuestions();
          return;
        }
        if (!plan.ok) { message.textContent = tr("board.postError"); return; }
        next.disabled = true;
        const result = await write("job", plan);
        if (result?.ok) {
          message.textContent = tr("board.postSuccess");
          next.textContent = tr("board.posted");
        } else {
          next.disabled = false;
          message.textContent = tr("board.postError");
        }
      });
      actions.append(next);
    };
    renderStep();
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
    const whenKey = { Today: "board.today", Tomorrow: "board.tomorrow", "This weekend": "board.weekend" }[job.when];
    card.append(el("p", "findPlace", (whenKey ? tr(whenKey) : job.when || tr("board.soon")) + (job.note ? " · " + job.note : "")));
    if (viewer?.side === "carer") {
      const offer = el("button", "mainBtn", tr("board.offer"));
      offer.type = "button";
      const msg = el("p", "gateMsg", "");
      msg.setAttribute("role", "status");
      offer.addEventListener("click", async () => {
        const plan = planInterest({ job, carerUid: viewer.uid, note: "", nowIso: nowIso(), profileComplete: profileDone() });
        if (!plan.ok && plan.reason === "profile-incomplete") { msg.textContent = tr("board.gateNote"); walkToQuestions(); return; }
        if (!plan.ok) { msg.textContent = tr("board.offerError"); return; }
        offer.disabled = true;
        const result = await write("interest", plan);
        if (result?.ok) {
          msg.textContent = tr("board.offerSuccess");
          offer.textContent = tr("board.offered");
        } else {
          offer.disabled = false;
          msg.textContent = tr("board.offerError");
        }
      });
      card.append(offer, msg);
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
