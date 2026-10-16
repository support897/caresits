import { t as tr, currentLang, setLang } from "./lang.js";
// Caresitters app2 — Phase D trust surfaces: Checks, Reviews,
// My Profile, Privacy, Settings (with Law E appearance).
// Checks speak in the honest badge words only: Register
// verified where a free official register backs it, Document
// sighted, or Provided by the carer. Nothing stronger is
// ever claimed. Settings carries Law E: white, black, the
// brand colours, or your own picture, with a soft veil so
// words always read.
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const write = (kind, payload) => { if (typeof window.CARESITS_WRITE === "function") window.CARESITS_WRITE(kind, payload); };
const emptyBox = (root, title, words) => {
  const box = el("div", "cardIn");
  const img = el("img", "bunnyBig");
  img.src = "bunny/bunny-rest-calm.png";
  img.alt = tr("find.bunnyRest");
  box.append(img, el("h3", null, title), el("p", null, words));
  root.append(box);
};

export function renderChecks(root, docs) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.checksNav")));
  root.append(el("p", "findPool", tr("checks.lead")));
  if (!docs.length) { emptyBox(root, tr("checks.emptyTitle"), tr("checks.emptyBody")); return; }
  const list = el("div", "findList");
  for (const d of docs) {
    const card = el("article", "findCard");
    card.append(el("h3", "findName", d.title || tr("checks.fallbackTitle")));
    card.append(el("p", "findPlace", d.level || tr("checks.providedBy")));
    if (d.limit) card.append(el("p", "findGate", d.limit));
    list.append(card);
  }
  root.append(list);
}

export function renderReviews(root, reviews) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.reviews")));
  if (!reviews.length) { emptyBox(root, tr("trust.reviewsEmpty"), tr("trust.reviewsEmptyBody")); return; }
  const list = el("div", "findList");
  for (const r of reviews) {
    const card = el("article", "findCard");
    card.append(el("h3", "findName", r.from || tr("find.member")));
    card.append(el("p", "findPlace", "★".repeat(Math.max(1, Math.min(5, r.stars || 5)))));
    if (r.text) card.append(el("p", null, r.text));
    list.append(card);
  }
  root.append(list);
}

export function renderProfile(root, me) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.profile")));
  const card = el("div", "findCard");
  card.append(el("h3", "findName", me.name || tr("trust.nameWaits")));
  card.append(el("p", "findPlace", (me.side === "carer" ? tr("trust.sideCarer") : tr("trust.sideFamily")) + (me.postcode ? " · " + tr("find.postcode", undefined, { n: me.postcode }) : "")));
  card.append(el("p", null, tr("trust.profileBody")));
  const go = el("button", "mainBtn", tr("trust.seeQ"));
  go.type = "button";
  go.addEventListener("click", () => document.querySelector('[data-nav="questionnaire"]')?.click());
  card.append(go);
  root.append(card);
}

export function renderPrivacy(root) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.privacy")));
  const p = el("p", null, tr("trust.privacyBody"));
  const a = el("a", "mainBtn privacyLink", tr("trust.privacyBtn"));
  a.href = "https://support897.github.io/caresits/privacy.html";
  a.target = "_blank";
  a.rel = "noopener";
  root.append(p, a);
}

const BG_KEY = "caresits-app2-bg";
export function applyBackground(choice, dataUrl) {
  const root = document.documentElement;
  root.dataset.theme = choice || "brand";
  document.body.style.backgroundImage = choice === "upload" && dataUrl ? `url(${dataUrl})` : "";
  document.body.classList.toggle("hasPhotoBg", choice === "upload" && !!dataUrl);
}

export function renderSettings(root) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.settings")));
  const card = el("div", "findCard");
  card.append(el("h3", "findName", tr("trust.background")));
  card.append(el("p", null, tr("trust.backgroundBody")));
  const row = el("div", "chipRow");
  const saved = (() => { try { return JSON.parse(localStorage.getItem(BG_KEY)) || { choice: "brand" }; } catch { return { choice: "brand" }; } })();
  for (const [key, label] of [["brand", tr("trust.bg.brand")], ["white", tr("trust.bg.white")], ["black", tr("trust.bg.black")], ["upload", tr("trust.bg.upload")]]) {
    const b = el("button", "chipBtn" + (saved.choice === key ? " on" : ""), label);
    b.type = "button";
    b.dataset.bg = key;
    b.addEventListener("click", () => {
      if (key === "upload") { fileIn.click(); return; }
      localStorage.setItem(BG_KEY, JSON.stringify({ choice: key }));
      applyBackground(key, null);
      write("appearance", { choice: key });
      renderSettings(root);
    });
    row.append(b);
  }
  card.append(row);
  const fileIn = el("input");
  fileIn.type = "file";
  fileIn.accept = "image/*";
  fileIn.hidden = true;
  fileIn.addEventListener("change", () => {
    const f = fileIn.files?.[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/jpeg", 0.82);
      localStorage.setItem(BG_KEY, JSON.stringify({ choice: "upload" }));
      localStorage.setItem(BG_KEY + "-img", url);
      applyBackground("upload", url);
      write("appearance", { choice: "upload" });
      renderSettings(root);
    };
    img.src = URL.createObjectURL(f);
  });
  card.append(fileIn);
  if (saved.choice === "upload") {
    const rm = el("button", "quietBtn", tr("trust.removePic"));
    rm.type = "button";
    rm.addEventListener("click", () => {
      localStorage.setItem(BG_KEY, JSON.stringify({ choice: "brand" }));
      localStorage.removeItem(BG_KEY + "-img");
      applyBackground("brand", null);
      write("appearance", { choice: "brand" });
      renderSettings(root);
    });
    card.append(rm);
  }
  root.append(card);
  const langCard = el("div", "findCard");
  langCard.append(el("h3", "findName", tr("common.language")));
  const langRow = el("div", "chipRow");
  for (const [code, label] of [["en", "English"], ["es", "Español"]]) {
    const b = el("button", "chipBtn" + (currentLang() === code ? " on" : ""), label);
    b.type = "button";
    b.addEventListener("click", () => { setLang(code); location.reload(); });
    langRow.append(b);
  }
  langCard.append(langRow);
  root.append(langCard);
  const acct = el("div", "findCard");
  acct.append(el("h3", "findName", tr("trust.account")));
  acct.append(el("p", null, tr("trust.accountBody")));
  const link = el("a", "mainBtn privacyLink", tr("trust.openAccount"));
  link.href = "../accounts/account.html";
  acct.append(link);
  root.append(acct);
}

function bootTrust() {
  const d = window.CARESITS_TRUST || { docs: [], reviews: [], me: {} };
  const c = document.getElementById("checksRoot");
  const r = document.getElementById("reviewsRoot");
  const p = document.getElementById("profileRoot");
  const pv = document.getElementById("privacyRoot");
  const s = document.getElementById("settingsRoot");
  if (c) renderChecks(c, d.docs || []);
  if (r) renderReviews(r, d.reviews || []);
  if (p) renderProfile(p, d.me || {});
  if (pv) renderPrivacy(pv);
  if (s) renderSettings(s);
  const saved = (() => { try { return JSON.parse(localStorage.getItem(BG_KEY)) || { choice: "brand" }; } catch { return { choice: "brand" }; } })();
  applyBackground(saved.choice, saved.choice === "upload" ? localStorage.getItem(BG_KEY + "-img") : null);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootTrust);
else bootTrust();
