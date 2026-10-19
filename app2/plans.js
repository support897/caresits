import { t as tr } from "./lang.js";
import { popupPriceLine } from "./thread.js";
// Caresitters app2 — the plans surface (payments chapter §2/§5).
// One sheet, three plans, true words in the viewer's own currency
// (prices.js, through the popup's own price line helper). Until
// products are live the sheet carries the honest not-on-sale line
// and its Join buttons only record plan interest, through the same
// write the upgrade popup uses. Buying itself arrives with the
// enabling build; the copy flips there, never here. Carers have
// no plans and no paywall, ever: nothing in this module is offered
// to a carer account, and the Settings entry hides for carers too.
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const write = (kind, payload) => { if (typeof window.CARESITS_WRITE === "function") window.CARESITS_WRITE(kind, payload); };

function joinBtn(label, plan, wrap) {
  const b = el("button", "mainBtn popBtn", label);
  b.type = "button";
  b.addEventListener("click", () => { write("plans", { plan }); wrap.remove(); });
  return b;
}

// reason "plus": the sheet was opened by a locked tap on a Family
// Plus feature, so it speaks first (the locked tap rule, 19 Oct
// 2026). Opened from Settings it simply presents the plans.
export function openPlans(reason) {
  document.getElementById("plansPop")?.remove();
  const wrap = el("div", "sheetWrap");
  wrap.id = "plansPop";
  const card = el("div", "sheetCard tourCard");
  const img = el("img", "bunnyBig");
  img.src = "bunny/bunny-encourage.png";
  img.alt = tr("popup.bunnyAlt");
  card.append(img, el("h3", "findName", tr("plans.title")));
  if (reason === "plus") card.append(el("p", null, tr("plans.locked")));
  card.append(el("p", null, popupPriceLine("popup.finding", "finding")));
  card.append(joinBtn(tr("popup.joinFinding"), "finding", wrap));
  card.append(el("p", null, popupPriceLine("popup.plus", "plus")));
  card.append(joinBtn(tr("popup.joinPlus"), "family-plus", wrap));
  card.append(el("p", null, popupPriceLine("plans.pass", "pass")));
  card.append(joinBtn(tr("plans.joinPass"), "search-pass", wrap));
  card.append(el("p", null, tr("plans.notYet")));
  const close = el("button", "mainBtn popBtn", tr("plans.close"));
  close.type = "button";
  close.addEventListener("click", () => wrap.remove());
  card.append(close);
  wrap.append(card);
  document.body.append(wrap);
}

window.CARESITS_OPEN_PLANS = openPlans;
