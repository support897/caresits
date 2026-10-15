// Caresits app2 — the pair calendar screen (Amendment 5).
// One calendar per pair: the agreed regular week in the soft
// brand colour, one time blocks as outlines with their tag,
// a skipped day as an open outline. Changes are proposals;
// the calendar changes only on an accept, and the accepter
// lands the block. A combined view heads the screen: every
// pair together, every block carrying the other person's
// name, and nothing from one pair inside another.
import { planRequest, planDecision, planBlockLanding, planWeekVersion, clashLine } from "./calendar-actions.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const nowIso = () => new Date().toISOString();
const write = (kind, payload) => { if (typeof window.CARESITS_WRITE === "function") window.CARESITS_WRITE(kind, payload); };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const KIND_WORDS = { extra: "Extra help", off: "A day off", move: "Move a session", "week-change": "Change the regular week" };

function blockChip(b, otherName) {
  const chip = el("div", "calBlock " + (b.kind === "regular" ? "regular" : b.kind === "off" ? "offBlock" : "onceBlock"));
  chip.append(el("span", "calTime", (b.start || "") + (b.end ? " to " + b.end : "")));
  chip.append(el("span", "calWith", " with " + otherName));
  if (b.kind === "off") chip.append(el("span", "calTag", " Day off"));
  else if (b.kind !== "regular") chip.append(el("span", "calTag", " One time"));
  return chip;
}

export function renderPairCalendar(root, viewerUid, pair) {
  const sec = el("section", "calPair");
  sec.append(el("h3", "findName", "Calendar with " + pair.otherName));
  for (const day of DAYS) {
    const regular = (pair.pattern || []).filter((p) => p.day === day);
    const blocks = (pair.blocks || []).filter((b) => b.day === day);
    if (!regular.length && !blocks.length) continue;
    const row = el("div", "calDay");
    row.append(el("p", "calDayName", day));
    for (const p of regular) row.append(blockChip({ ...p, kind: "regular" }, pair.otherName));
    for (const b of blocks) row.append(blockChip(b, pair.otherName));
    sec.append(row);
  }
  const waiting = (pair.requests || []).filter((r) => r.state === "waiting");
  if (waiting.length) {
    sec.append(el("h4", "calReqTitle", "Waiting requests"));
    for (const r of waiting) {
      const box = el("div", "findCard calReq");
      box.append(el("p", "findPlace", KIND_WORDS[r.kind] + " · " + (r.day || "") + (r.start ? " · " + r.start + " to " + (r.end || "") : "")));
      if (r.askedBy === viewerUid) {
        box.append(el("p", "gateMsg", "Waiting for " + pair.otherName + " to answer."));
      } else {
        const clash = clashLine(r, pair.blocks);
        if (clash) box.append(el("p", "gateMsg clash", clash));
        const row = el("div", "actRow");
        const accept = el("button", "mainBtn actBtn", "Accept");
        accept.type = "button";
        accept.addEventListener("click", () => {
          const dec = planDecision(r, viewerUid, true);
          if (!dec.ok) return;
          write("request-decide", { pairId: pair.pairId, reqId: r.id, patch: dec.patch });
          const accepted = { ...r, state: "accepted", decidedBy: viewerUid };
          if (r.kind === "week-change") {
            write("pointer", { pairId: pair.pairId, request: accepted });
          } else {
            const land = planBlockLanding({ pairId: pair.pairId, request: accepted, block: { day: r.day, start: r.start || "", end: r.end || "", kind: r.kind === "move" ? "moved" : r.kind }, actorUid: viewerUid, otherUid: pair.otherUid, nowIso: nowIso() });
            if (land.ok) write("block-land", land);
          }
          box.remove();
        });
        const decline = el("button", "closeBtn", "Decline");
        decline.type = "button";
        decline.addEventListener("click", () => {
          const dec = planDecision(r, viewerUid, false);
          if (dec.ok) write("request-decide", { pairId: pair.pairId, reqId: r.id, patch: dec.patch });
          box.remove();
        });
        row.append(accept, decline);
        box.append(row);
      }
      sec.append(box);
    }
  }
  const form = el("div", "findCard");
  form.append(el("h4", "calReqTitle", "Ask for a change"));
  const kind = el("select", "txtIn");
  for (const [k, w] of Object.entries(KIND_WORDS)) { const o = el("option", null, w); o.value = k; kind.append(o); }
  const day = el("select", "txtIn");
  for (const d of DAYS) day.append(el("option", null, d));
  const start = el("input", "txtIn"); start.placeholder = "Start, like 09:00";
  const end = el("input", "txtIn"); end.placeholder = "End, like 12:00";
  const from = el("input", "txtIn"); from.placeholder = "For a week change: starts on, like 2026-11-02";
  const send = el("button", "mainBtn", "Send the request");
  send.type = "button";
  send.addEventListener("click", () => {
    const versionId = "v" + Date.now();
    const plan = planRequest({ pairId: pair.pairId, kind: kind.value, askedBy: viewerUid, day: day.value, start: start.value, end: end.value, proposedVersionId: versionId, effectiveFrom: from.value, nowIso: nowIso() });
    if (!plan.ok) return;
    if (kind.value === "week-change") {
      const ver = planWeekVersion({ pairId: pair.pairId, versionId, pattern: [{ day: day.value, parts: [], start: start.value, end: end.value }], effectiveFrom: from.value, proposedBy: viewerUid, nowIso: nowIso() });
      write("week-version", ver);
    }
    write("request", plan);
    form.append(el("p", "gateMsg", "Sent. The calendar changes only if " + pair.otherName + " accepts."));
  });
  form.append(kind, day, start, end, from, send);
  sec.append(form);
  root.append(sec);
}

export function renderCalendar(root, viewerUid, pairs) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", "Pair calendar"));
  if (!pairs.length) {
    const box = el("div", "cardIn");
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-rest-calm.png";
    img.alt = "The Caresits bunny, resting calmly";
    box.append(img, el("h3", null, "No pair calendar yet"), el("p", null, "A calendar opens here the moment a match begins."));
    root.append(box);
    return;
  }
  root.append(el("p", "findPool", "Every pair, one view. Each block says who it is with."));
  for (const pair of pairs) renderPairCalendar(root, viewerUid, pair);
}

function bootCalendar() {
  const root = document.getElementById("calendarRoot");
  if (!root) return;
  const d = window.CARESITS_CALENDAR;
  if (d) renderCalendar(root, d.viewerUid || "", d.pairs || []);
  else renderCalendar(root, "", []);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootCalendar);
else bootCalendar();
