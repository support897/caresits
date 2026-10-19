import { t as tr } from "./lang.js";
import { doneKey, draftKey } from "./storage-keys.js";
// Caresitters app2 — the message thread + the free taste wall.
// The account layer's own logic decides (canSendMessage): a
// family on the free taste gets one message a day; carers and
// door open plans write freely. The second message on the
// free taste meets the upgrade moment, at that moment only,
// with the copy exactly as passed (Quality, 15 Oct): benefit
// first, true prices plain, no invented claims, and Not now
// standing as tall as every other button.
import { canSendMessage } from "../accounts/account.js";
import { priceFor, localiseSentence } from "./prices.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const write = (kind, payload) => { if (typeof window.CARESITS_WRITE === "function") window.CARESITS_WRITE(kind, payload); };

// The popup latch (house rule U2, HQ ruling 15 Oct 2026):
// after "Not now", that edge stays quiet for the rest of the
// session. A fresh try past the free taste simply does not
// send, with no popup refire. A new session may speak once
// per edge.
const latchedEdges = new Set();

// The viewer's country for price display, resolved exactly the
// way the Checks surface resolves it (trust.js): the signed in
// profile when present, else this device's saved questionnaire
// or draft, else Australia.
export function viewerCountry() {
  if ((window.CARESITS_ME || {}).country) return window.CARESITS_ME.country;
  const me = (window.CARESITS_TRUST || {}).me || {};
  if (me.country) return me.country;
  try {
    const q = JSON.parse(localStorage.getItem(doneKey()) || "null");
    if (q && (q.country || (q.answers && q.answers.country))) return q.country || q.answers.country;
    const d = JSON.parse(localStorage.getItem(draftKey()) || "null");
    if (d && d.answers && d.answers.country) return d.answers.country;
  } catch { /* no local copy */ }
  return "Australia";
}

// The popup's price lines in the viewer's own currency
// (prices.js): the gate passed sentence stands, with its A$
// figure swapped for the viewer's band price and the A$ worth
// beside it. In Australia the sentence reads word for word as
// passed. Buying itself stays inert: the Join buttons below
// record plan interest, exactly as before.
export function popupPriceLine(key, plan) {
  const country = viewerCountry();
  const p = priceFor(plan, country);
  const phrase = p && p.worth ? tr("price.worth", undefined, { worth: p.worth }) : null;
  return localiseSentence(tr(key), plan, country, phrase);
}

export function showUpgradePopup(edge) {
  if (edge && latchedEdges.has(edge)) return;
  document.getElementById("upgradePop")?.remove();
  const wrap = el("div", "sheetWrap");
  wrap.id = "upgradePop";
  const card = el("div", "sheetCard tourCard");
  const img = el("img", "bunnyBig");
  img.src = "bunny/bunny-encourage.png";
  img.alt = tr("popup.bunnyAlt");
  card.append(img, el("h3", "findName", tr("popup.title")));
  card.append(el("p", null, tr("popup.body")));
  card.append(el("p", null, popupPriceLine("popup.finding", "finding")));
  card.append(el("p", null, popupPriceLine("popup.plus", "plus")));
  const finding = el("button", "mainBtn popBtn", tr("popup.joinFinding"));
  finding.type = "button";
  finding.addEventListener("click", () => { write("plans", { plan: "finding" }); wrap.remove(); });
  const plus = el("button", "mainBtn popBtn", tr("popup.joinPlus"));
  plus.type = "button";
  plus.addEventListener("click", () => { write("plans", { plan: "family-plus" }); wrap.remove(); });
  const notNow = el("button", "mainBtn popBtn", tr("popup.notNow"));
  notNow.type = "button";
  notNow.addEventListener("click", () => { if (edge) latchedEdges.add(edge); wrap.remove(); });
  card.append(finding, plus, notNow);
  wrap.append(card);
  document.body.append(wrap);
}

export function renderThread(root, { pairId, otherName, messages, plan, tasteUsedToday }) {
  // A live thread with no plan of its own takes the plan the live
  // bridge resolved from the entitlement record at boot. Demo seam
  // data always carries its own plan and never reaches this line.
  if (!plan && typeof window !== "undefined" && window.CARESITS_PLAN) plan = window.CARESITS_PLAN;
  root.replaceChildren();
  root.append(el("h2", "findTitle", otherName || tr("thread.title")));
  const list = el("div", "findList threadList");
  for (const m of messages) {
    const row = el("div", "msgRow " + (m.mine ? "mine" : "theirs"));
    row.append(el("p", "msgText", m.text));
    list.append(row);
  }
  if (!messages.length) list.append(el("p", null, tr("thread.empty")));
  root.append(list);
  const box = el("div", "findCard");
  const input = el("textarea", "txtIn");
  input.placeholder = tr("thread.ph");
  input.rows = 2;
  const send = el("button", "mainBtn", tr("thread.send"));
  send.type = "button";
  send.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    const allowed = canSendMessage({ plan, tasteUsedToday: tasteUsedToday || 0 });
    if (!allowed) { showUpgradePopup(pairId); return; }
    write("message", { pairId, text, at: new Date().toISOString() });
    renderThread(root, { pairId, otherName, messages: [...messages, { text, mine: true }], plan, tasteUsedToday: (tasteUsedToday || 0) + 1 });
  });
  box.append(input, send);
  root.append(box);
}

function bootThread() {
  const root = document.getElementById("threadRoot");
  if (!root) return;
  const d = window.CARESITS_THREAD;
  if (d) renderThread(root, d);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootThread);
else bootThread();
