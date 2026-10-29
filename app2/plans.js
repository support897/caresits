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
let activePlansClose = null;

function planBtn(label, plan, wrap, card, status, closeSheet) {
  const b = el("button", "mainBtn popBtn", label);
  b.type = "button";
  b.addEventListener("click", async () => {
    if (!purchaseAvailable()) { write("plans", { plan }); closeSheet(); return; }
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
  activePlansClose?.();
  const wrap = el("div", "sheetWrap");
  wrap.id = "plansPop";
  let keyHandler = null;
  const closeSheet = () => {
    wrap.remove();
    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    if (activePlansClose === closeSheet) activePlansClose = null;
  };
  activePlansClose = closeSheet;
  keyHandler = (event) => { if (event.key === "Escape") closeSheet(); };
  document.addEventListener("keydown", keyHandler);
  wrap.addEventListener("click", (event) => { if (event.target === wrap) closeSheet(); });
  const card = el("div", "sheetCard tourCard plansSheet");
  const close = el("button", "closeBtn plansCloseTop", tr("plans.close"));
  close.type = "button";
  close.setAttribute("aria-label", tr("plans.close"));
  close.addEventListener("click", closeSheet);
  card.append(close);
  const img = el("img", "bunnyBig");
  img.src = "bunny/bunny-encourage.png";
  img.alt = tr("popup.bunnyAlt");
  card.append(img, el("h3", "findName", tr("plans.title")));
  if (reason === "plus") card.append(el("p", null, tr("plans.locked")));
  const status = el("p", "plansStatus");
  card.append(el("p", null, popupPriceLine("popup.finding", "finding")));
  card.append(planBtn(tr("popup.joinFinding"), "finding", wrap, card, status, closeSheet));
  card.append(el("p", null, popupPriceLine("popup.plus", "plus")));
  card.append(planBtn(tr("popup.joinPlus"), "family-plus", wrap, card, status, closeSheet));
  card.append(el("p", null, popupPriceLine("plans.pass", "pass")));
  card.append(planBtn(tr("plans.joinPass"), "search-pass", wrap, card, status, closeSheet));
  // The renewal disclosure + the legal links stand ON
  // the paywall (Store Review's G7 item, HQ's fix wave
  // on the fleet's proven pattern): the whole renewal
  // truth for both subscriptions in plain words at
  // small print volume, built from standing parts only.
  // The prices inside it render through the SAME helper
  // as the plan lines above (popupPriceLine), so the
  // disclosure and the buttons can never drift apart;
  // the Search Pass line inside the block is the sheet's
  // own pass line, reused. The block renders in every
  // state of the sheet, entitled included.
  const legal = el("div", "plansLegal");
  legal.append(
    el("p", null, popupPriceLine("plans.renewFinding", "finding")),
    el("p", null, popupPriceLine("plans.renewPlus", "plus")),
    el("p", null, tr("plans.renew2")),
    el("p", null, popupPriceLine("plans.pass", "pass")),
  );
  card.append(legal);
  const links = el("div", "plansLinks");
  const priv = el("a", null, tr("plans.privacy"));
  priv.href = "https://support897.github.io/caresits/privacy.html";
  priv.target = "_blank";
  priv.rel = "noopener";
  const terms = el("a", null, tr("plans.terms"));
  terms.href = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
  terms.target = "_blank";
  terms.rel = "noopener";
  links.append(priv, terms);
  card.append(links);
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
  wrap.append(card);
  document.body.append(wrap);
}

window.CARESITS_OPEN_PLANS = openPlans;
