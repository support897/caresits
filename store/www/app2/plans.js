import { t as tr } from "./lang.js";
import { popupPriceLine } from "./thread.js";
import { purchaseAvailable, buyPlan, restorePurchases } from "./purchase.js";
// Caresitters app2 — the plans surface (payments chapter
// §2/§5; the enabling build). One sheet, three plans, true
// words in the viewer's own currency (prices.js, through
// the popup's own price line helper). THE BUY BUTTONS
// STAND FIRST IN THIS FAMILY (Ilse, 19 Oct 2026): the
// same sheet card, the same bunny, the same .mainBtn
// buttons the app uses everywhere — buying is an app
// action, not a bolted-on store widget. Where the store
// road is live (the packaged app), the buttons buy
// through purchase.js; where it is not (the web), they
// record plan interest and the sheet says so plainly.
// After a buy or a restore the entitlement record is
// re-read in the same session (live.js's refresh seam),
// so what was paid for opens without a restart. Carers
// have no plans and no paywall, ever: nothing in this
// module is offered to a carer account.
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const write = (kind, payload) => { if (typeof window.CARESITS_WRITE === "function") window.CARESITS_WRITE(kind, payload); };

function planBtn(label, plan, wrap, card, status) {
  const b = el("button", "mainBtn popBtn", label);
  b.type = "button";
  b.addEventListener("click", async () => {
    if (!purchaseAvailable()) { write("plans", { plan }); wrap.remove(); return; }
    b.disabled = true;
    status.textContent = tr("plans.buying");
    const res = await buyPlan(plan);
    if (res.ok) {
      status.textContent = tr("plans.done");
    } else if (res.reason === "cancelled") {
      status.textContent = "";
      b.disabled = false;
    } else {
      status.textContent = tr("plans.failed");
      b.disabled = false;
    }
  });
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
  const status = el("p", "plansStatus");
  card.append(el("p", null, popupPriceLine("popup.finding", "finding")));
  card.append(planBtn(tr("popup.joinFinding"), "finding", wrap, card, status));
  card.append(el("p", null, popupPriceLine("popup.plus", "plus")));
  card.append(planBtn(tr("popup.joinPlus"), "family-plus", wrap, card, status));
  card.append(el("p", null, popupPriceLine("plans.pass", "pass")));
  card.append(planBtn(tr("plans.joinPass"), "search-pass", wrap, card, status));
  card.append(status);
  if (purchaseAvailable()) {
    const restore = el("button", "mainBtn popBtn", tr("plans.restore"));
    restore.type = "button";
    restore.addEventListener("click", async () => {
      restore.disabled = true;
      status.textContent = tr("plans.buying");
      const res = await restorePurchases();
      status.textContent = res.ok ? tr("plans.restored") : tr("plans.failed");
      restore.disabled = false;
    });
    card.append(restore);
  } else {
    card.append(el("p", null, tr("plans.appOnly")));
  }
  const close = el("button", "mainBtn popBtn", tr("plans.close"));
  close.type = "button";
  close.addEventListener("click", () => wrap.remove());
  card.append(close);
  wrap.append(card);
  document.body.append(wrap);
}

window.CARESITS_OPEN_PLANS = openPlans;
