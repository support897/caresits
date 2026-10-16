import { t as tr } from "./lang.js";
// Caresitters app2 — the safety sheet (Amendment 4 build).
// One quiet sheet serves every surface: pick a reason, add
// your own words if you like, send. The filer then sees the
// acknowledgement and nothing more, ever. Blocking asks once,
// in plain words, and the person simply leaves your view.
import { planReport, planBlock, REPORT_CATEGORIES } from "./safety-actions.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const nowIso = () => new Date().toISOString();
const write = (kind, payload) => { if (typeof window.CARESITS_WRITE === "function") window.CARESITS_WRITE(kind, payload); };

function closeSheet() { document.getElementById("safetySheet")?.remove(); }

function openSheet(build) {
  closeSheet();
  const wrap = el("div", "sheetWrap");
  wrap.id = "safetySheet";
  const sheet = el("div", "sheetCard");
  const x = el("button", "closeBtn sheetX", tr("safety.close"));
  x.type = "button";
  x.addEventListener("click", closeSheet);
  sheet.append(x);
  build(sheet);
  wrap.append(sheet);
  document.body.append(wrap);
}

window.CARESITS_REPORT = (reportedUid, ctx = {}) => {
  const me = window.CARESITS_ME || {};
  openSheet((sheet) => {
    sheet.append(el("h3", "findName", tr("safety.report")));
    sheet.append(el("p", null, tr("safety.reportBody")));
    let picked = "other";
    const chips = el("div", "chipRow");
    for (const [key, label] of REPORT_CATEGORIES) {
      const c = el("button", "chipBtn" + (key === picked ? " on" : ""), tr("safety.cat." + key));
      c.type = "button";
      c.addEventListener("click", () => { picked = key; chips.querySelectorAll(".chipBtn").forEach((b) => b.classList.toggle("on", b === c)); });
      chips.append(c);
    }
    sheet.append(chips);
    const words = el("textarea", "txtIn sheetWords");
    words.rows = 3;
    words.placeholder = tr("safety.wordsPh");
    sheet.append(words);
    const send = el("button", "mainBtn", tr("safety.send"));
    send.type = "button";
    send.addEventListener("click", () => {
      const plan = planReport({ reporterUid: me.uid, reportedUid, surface: ctx.surface || "profile", category: picked, words: words.value, snapshot: ctx.snapshot || { items: [], text: "", title: "" }, nowIso: nowIso() });
      if (!plan.ok) return;
      write("report", plan);
      sheet.replaceChildren(el("h3", "findName", tr("safety.thanks")), el("p", null, tr("safety.ack")));
      const done = el("button", "mainBtn", tr("safety.done"));
      done.type = "button";
      done.addEventListener("click", closeSheet);
      sheet.append(done);
    });
    sheet.append(send);
  });
};

window.CARESITS_BLOCK = (otherUid, cardEl) => {
  const me = window.CARESITS_ME || {};
  openSheet((sheet) => {
    sheet.append(el("h3", "findName", tr("safety.blockTitle")));
    sheet.append(el("p", null, tr("safety.blockBody")));
    const yes = el("button", "mainBtn", tr("safety.block"));
    yes.type = "button";
    yes.addEventListener("click", () => {
      const plan = planBlock({ uid: me.uid, otherUid, nowIso: nowIso() });
      if (plan.ok) { write("block", plan); cardEl?.remove(); window.CARESITS_EXCLUDE?.(otherUid); }
      closeSheet();
    });
    const no = el("button", "closeBtn", tr("safety.notNow"));
    no.type = "button";
    no.addEventListener("click", closeSheet);
    sheet.append(yes, no);
  });
};
