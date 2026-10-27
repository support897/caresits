// Caresitters app2 — the pair calendar screen (Amendment 5).
// One calendar per pair: the agreed regular week in the soft
// brand colour, one time blocks as outlines with their tag,
// a skipped day as an open outline. Changes are proposals;
// the calendar changes only on an accept, and the accepter
// lands the block. A combined view heads the screen: every
// pair together, every block carrying the other person's
// name, and nothing from one pair inside another.
import { planRequest, planDecision, planBlockLanding, planWeekVersion, clashLine, clashParts } from "./calendar-actions.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const nowIso = () => new Date().toISOString();
const write = (kind, payload) => { if (typeof window.CARESITS_WRITE === "function") window.CARESITS_WRITE(kind, payload); };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
import { t as tr } from "./lang.js";
const KIND_WORDS = { extra: tr("cal.kind.extra"), off: tr("cal.kind.off"), move: tr("cal.kind.move"), "week-change": tr("cal.kind.week-change") };

function blockChip(b, otherName) {
  const chip = el("div", "calBlock " + (b.kind === "regular" ? "regular" : b.kind === "off" ? "offBlock" : "onceBlock"));
  chip.append(el("span", "calTime", (b.start || "") + (b.end ? tr("week.to") + b.end : "")));
  chip.append(el("span", "calWith", tr("week.with", undefined, { name: otherName })));
  if (b.kind === "off") chip.append(el("span", "calTag", tr("cal.tagOff")));
  else if (b.kind !== "regular") chip.append(el("span", "calTag", tr("cal.tagOnce")));
  return chip;
}

export function renderPairCalendar(root, viewerUid, pair) {
  const sec = el("section", "calPair");
  sec.append(el("h3", "findName", tr("cal.withTitle", undefined, { name: pair.otherName })));
  for (const day of DAYS) {
    const regular = (pair.pattern || []).filter((p) => p.day === day);
    const blocks = (pair.blocks || []).filter((b) => b.day === day);
    if (!regular.length && !blocks.length) continue;
    const row = el("div", "calDay");
    row.append(el("p", "calDayName", tr("journey.day." + day)));
    for (const p of regular) row.append(blockChip({ ...p, kind: "regular" }, pair.otherName));
    for (const b of blocks) row.append(blockChip(b, pair.otherName));
    sec.append(row);
  }
  const waiting = (pair.requests || []).filter((r) => r.state === "waiting");
  if (waiting.length) {
    sec.append(el("h4", "calReqTitle", tr("cal.waiting")));
    for (const r of waiting) {
      const box = el("div", "findCard calReq");
      box.append(el("p", "findPlace", KIND_WORDS[r.kind] + " · " + (r.day || "") + (r.start ? " · " + r.start + " to " + (r.end || "") : "")));
      if (r.askedBy === viewerUid) {
        box.append(el("p", "gateMsg", tr("cal.waitingFor", undefined, { name: pair.otherName })));
      } else {
        const cp = clashParts(r, pair.blocks);
        if (cp) box.append(el("p", "gateMsg clash", tr("cal.clash", undefined, { day: tr("journey.day." + cp.day), start: cp.start, end: cp.end })));
        const row = el("div", "actRow");
        const accept = el("button", "mainBtn actBtn", tr("cal.accept"));
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
        const decline = el("button", "closeBtn", tr("cal.decline"));
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
  form.append(el("h4", "calReqTitle", tr("cal.ask")));
  const kind = el("select", "txtIn");
  kind.setAttribute("aria-label", tr("cal.kindLabel"));
  form.classList.add("weekAddForm");
  for (const [k, w] of Object.entries(KIND_WORDS)) { const o = el("option", null, w); o.value = k; kind.append(o); }
  const day = el("select", "txtIn");
  day.setAttribute("aria-label", tr("week.dayLabel"));
  for (const d of DAYS) { const o = el("option", null, tr("journey.day." + d)); o.value = d; day.append(o); }
  const start = el("input", "txtIn"); start.placeholder = tr("cal.startPh"); start.setAttribute("aria-label", tr("cal.startPh"));
  const end = el("input", "txtIn"); end.placeholder = tr("cal.endPh"); end.setAttribute("aria-label", tr("cal.endPh"));
  const from = el("input", "txtIn"); from.placeholder = tr("cal.fromPh"); from.setAttribute("aria-label", tr("cal.fromPh"));
  const send = el("button", "mainBtn", tr("cal.send"));
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
    form.append(el("p", "gateMsg", tr("cal.sent", undefined, { name: pair.otherName })));
  });
  form.append(kind, day, start, end, from, send);
  sec.append(form);
  root.append(sec);
}

export function renderCalendar(root, viewerUid, pairs) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.calendar")));
  if (!pairs.length) {
    const box = el("div", "cardIn");
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-rest-calm.png";
    img.alt = tr("find.bunnyRest");
    box.append(img, el("h3", null, tr("cal.empty")), el("p", null, tr("cal.emptyBody")));
    root.append(box);
    return;
  }
  root.append(el("p", "findPool", tr("cal.lead")));
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
