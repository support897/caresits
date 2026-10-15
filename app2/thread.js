// Caresits app2 — the message thread + the free taste wall.
// The account layer's own logic decides (canSendMessage): a
// family on the free taste gets one message a day; carers and
// door open plans write freely. The second message on the
// free taste meets the upgrade moment, at that moment only,
// with the copy exactly as passed (Quality, 15 Oct): benefit
// first, true prices plain, no invented claims, and Not now
// standing as tall as every other button.
import { canSendMessage } from "../accounts/account.js";

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
export function showUpgradePopup(edge) {
  if (edge && latchedEdges.has(edge)) return;
  document.getElementById("upgradePop")?.remove();
  const wrap = el("div", "sheetWrap");
  wrap.id = "upgradePop";
  const card = el("div", "sheetCard tourCard");
  const img = el("img", "bunnyBig");
  img.src = "bunny/bunny-encourage.png";
  img.alt = "The Caresits bunny, cheering you on";
  card.append(img, el("h3", "findName", "You found someone worth writing to"));
  card.append(el("p", null, "Your free message for today is on its way. Finding members can keep the conversation going, with as many messages as they like."));
  card.append(el("p", null, "Finding is A$14.95 a month, and you can stop any time."));
  card.append(el("p", null, "Family Plus is the everything plan: A$24.95 a month, with the first month free."));
  const finding = el("button", "mainBtn popBtn", "Join Finding");
  finding.type = "button";
  finding.addEventListener("click", () => { write("plans", { plan: "finding" }); wrap.remove(); });
  const plus = el("button", "mainBtn popBtn", "Join Family Plus");
  plus.type = "button";
  plus.addEventListener("click", () => { write("plans", { plan: "family-plus" }); wrap.remove(); });
  const notNow = el("button", "mainBtn popBtn", "Not now");
  notNow.type = "button";
  notNow.addEventListener("click", () => { if (edge) latchedEdges.add(edge); wrap.remove(); });
  card.append(finding, plus, notNow);
  wrap.append(card);
  document.body.append(wrap);
}

export function renderThread(root, { pairId, otherName, messages, plan, tasteUsedToday }) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", otherName || "Messages"));
  const list = el("div", "findList threadList");
  for (const m of messages) {
    const row = el("div", "msgRow " + (m.mine ? "mine" : "theirs"));
    row.append(el("p", "msgText", m.text));
    list.append(row);
  }
  if (!messages.length) list.append(el("p", null, "No messages yet. The first hello is yours."));
  root.append(list);
  const box = el("div", "findCard");
  const input = el("textarea", "txtIn");
  input.placeholder = "Write a message";
  input.rows = 2;
  const send = el("button", "mainBtn", "Send");
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
