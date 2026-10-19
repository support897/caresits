import { t as tr, currentLang, setLang } from "./lang.js";
import { doneKey, draftKey } from "./storage-keys.js";
import { downloadExport } from "./export.js";
import { pushAvailable, getPushState, registerPush, togglePushKind } from "./push.js";
import { uploadProfilePhoto, uploadGalleryPhoto, uploadToStorage, planResumePath } from "./photo.js";
import { draftFromText, buildHandoff } from "./resume.js";
import { LANGS, NATIONALITIES } from "./questions.js";
import { packById, packByName, checkFor } from "./countries.js";
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

// The Checks surface speaks the viewer's own country's check
// name and register kind (country packs). The country comes from
// the signed in profile when present, else from this device's
// saved questionnaire or draft, else Australia.
function viewerCountryName() {
  const me = (window.CARESITS_TRUST || {}).me || {};
  if ((window.CARESITS_ME || {}).country) return window.CARESITS_ME.country;
  if (me.country) return me.country;
  try {
    const q = JSON.parse(localStorage.getItem(doneKey()) || "null");
    if (q && (q.country || (q.answers && q.answers.country))) return q.country || q.answers.country;
    const d = JSON.parse(localStorage.getItem(draftKey()) || "null");
    if (d && d.answers && d.answers.country) return d.answers.country;
  } catch { /* no local copy */ }
  return "Australia";
}

export function renderChecks(root, docs) {
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.checksNav")));
  root.append(el("p", "findPool", tr("checks.lead")));
  const pack = packByName(viewerCountryName()) || packById("AU");
  if (pack) {
    const me = (window.CARESITS_TRUST || {}).me || {};
    const facts = checkFor(pack, me.postcode || (window.CARESITS_ME || {}).postcode);
    const card = el("article", "findCard countryCard");
    card.append(el("h3", "findName", pack.name + (facts.place ? " · " + facts.place : "")));
    card.append(el("p", "findPlace", facts.name));
    card.append(el("p", null, tr(facts.register ? "country.registerLine" : "country.sightedLine")));
    card.append(el("p", "findGate", facts.costText));
    if (facts.checkUrl) {
      const a = el("a", "quietBtn", tr("country.officialLink"));
      a.href = facts.checkUrl; a.target = "_blank"; a.rel = "noopener";
      card.append(a);
    }
    root.append(card);
  }
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
  if (me.level) {
    card.append(el("p", "findPlace", tr("level.profileLabel")));
    card.append(el("p", null, tr("level." + me.level)));
  }
  card.append(el("p", null, tr("trust.profileBody")));
  const go = el("button", "mainBtn", tr("trust.seeQ"));
  go.type = "button";
  go.addEventListener("click", () => document.querySelector('[data-nav="questionnaire"]')?.click());
  card.append(go);
  root.append(card);
  const pcard = el("div", "cardIn");
  pcard.append(el("h3", null, tr("photo.title")), el("p", null, tr("photo.body")));
  if (me.photoUrl) { const im = el("img", "profilePhoto"); im.src = me.photoUrl; im.alt = ""; pcard.append(im); }
  const pfile = el("input");
  pfile.type = "file";
  pfile.accept = "image/*";
  pfile.hidden = true;
  const pick = el("button", "mainBtn", tr(me.photoUrl ? "photo.change" : "photo.add"));
  pick.type = "button";
  pick.addEventListener("click", () => pfile.click());
  pfile.addEventListener("change", async () => {
    const f = pfile.files && pfile.files[0];
    // F21: clear the pick at once, so picking the same file
    // again still fires change.
    pfile.value = "";
    if (!f) return;
    const uid = window.CARESITS_ME && window.CARESITS_ME.uid;
    const res = await uploadProfilePhoto(uid, f);
    if (res.ok && res.url) {
      write("photo", { photoUrl: res.url });
      if (window.CARESITS_ME) window.CARESITS_ME.photoUrl = res.url;
      pcard.append(el("p", "gateMsg", tr("photo.saved")));
    } else if (res.dataUrl) {
      const im = el("img", "profilePhoto");
      im.src = res.dataUrl;
      im.alt = "";
      pcard.append(im, el("p", "gateMsg", tr("photo.deviceOnly")));
    }
  });
  pcard.append(pick, pfile);
  root.append(pcard);
  if (me.side === "carer") {
    // F14: up to four more photos. The saved list rides the
    // card (card.gallery, slot order) and every change writes
    // the whole list through the gallery seam. A pick with no
    // storage path answers with a device preview instead,
    // exactly like the main photo (F12).
    const gcard = el("div", "cardIn galleryCard");
    gcard.append(el("h3", null, tr("gallery.title")), el("p", null, tr("gallery.body")));
    let gallery = (Array.isArray(me.gallery) ? me.gallery : []).filter((u) => typeof u === "string" && u).slice(0, 4);
    const previews = [];
    const strip = el("div", "galleryStrip");
    const gfile = el("input");
    gfile.type = "file";
    gfile.accept = "image/*";
    gfile.hidden = true;
    gfile.className = "galleryFile";
    const renderStrip = () => {
      strip.replaceChildren();
      gallery.forEach((url, i) => {
        const slot = el("div", "gallerySlot");
        const im = el("img", "galleryThumb");
        im.src = url;
        im.alt = "";
        const rm = el("button", "quietBtn galleryRemove", tr("gallery.remove"));
        rm.type = "button";
        rm.addEventListener("click", () => {
          gallery = gallery.filter((_, j) => j !== i);
          write("gallery", { gallery });
          if (window.CARESITS_ME) window.CARESITS_ME.gallery = gallery;
          renderStrip();
        });
        slot.append(im, rm);
        strip.append(slot);
      });
      for (const dataUrl of previews) {
        const slot = el("div", "gallerySlot");
        const im = el("img", "galleryThumb");
        im.src = dataUrl;
        im.alt = "";
        slot.append(im);
        strip.append(slot);
      }
      for (let s = gallery.length + previews.length; s < 4; s += 1) {
        const add = el("button", "mainBtn galleryAdd", tr("gallery.add"));
        add.type = "button";
        add.addEventListener("click", () => gfile.click());
        strip.append(add);
      }
      if (previews.length) strip.append(el("p", "gateMsg", tr("photo.deviceOnly")));
    };
    gfile.addEventListener("change", async () => {
      const f = gfile.files && gfile.files[0];
      gfile.value = "";
      if (!f) return;
      const uid = window.CARESITS_ME && window.CARESITS_ME.uid;
      const res = await uploadGalleryPhoto(uid, f, gallery.length + 1);
      if (res.ok && res.url) {
        gallery = [...gallery, res.url].slice(0, 4);
        write("gallery", { gallery });
        if (window.CARESITS_ME) window.CARESITS_ME.gallery = gallery;
      } else if (res.dataUrl) {
        previews.push(res.dataUrl);
      }
      renderStrip();
    });
    renderStrip();
    gcard.append(strip, gfile);
    root.append(gcard);
  }
  if (me.side === "carer") {
    const rcard = el("div", "cardIn");
    rcard.append(el("h3", null, tr("resume.title")), el("p", null, tr("resume.body")));
    const rfile = el("input");
    rfile.type = "file";
    rfile.accept = ".txt,.md,.pdf,text/plain,application/pdf";
    rfile.hidden = true;
    const rpick = el("button", "mainBtn", tr("resume.pick"));
    rpick.type = "button";
    rpick.addEventListener("click", () => rfile.click());
    const paste = el("textarea", "txtIn");
    paste.placeholder = tr("resume.or");
    const readBtn = el("button", "mainBtn", tr("resume.read"));
    readBtn.type = "button";
    const out = el("div");
    const runDraft = (text) => {
      out.replaceChildren();
      if (!text || !text.trim()) { out.append(el("p", "gateMsg", tr("resume.none"))); return; }
      const draft = draftFromText(text, { languages: LANGS, nationalities: NATIONALITIES });
      if (!draft.ok) { out.append(el("p", "gateMsg", tr("resume.none"))); return; }
      out.append(el("h4", null, tr("resume.draftTitle")));
      for (const m of draft.marks) {
        const val = m === "xC22" ? draft.deep.xC22 : draft.answers[m];
        out.append(el("p", null, (Array.isArray(val) ? val.join(", ") : String(val)) + " · " + tr("resume.source", undefined, { span: draft.spans[m] || "" })));
      }
      if (draft.experienceYears != null) out.append(el("p", null, tr("resume.years", undefined, { n: draft.experienceYears })));
      const use = el("button", "mainBtn", tr("resume.useBtn"));
      use.type = "button";
      use.addEventListener("click", () => {
        try { localStorage.setItem("caresits-app2-resume-draft", JSON.stringify(buildHandoff(draft))); } catch { /* storage off */ }
        out.append(el("p", "gateMsg", tr("resume.saved")));
      });
      out.append(use);
    };
    rfile.addEventListener("change", async () => {
      const f = rfile.files && rfile.files[0];
      rfile.value = "";
      if (!f) return;
      const buf = await f.arrayBuffer();
      const head = new TextDecoder().decode(new Uint8Array(buf.slice(0, 5)));
      if (head.startsWith("%PDF")) {
        // S-2: storage holds PDFs alone (the storage rules
        // fence admits nothing else). A PDF is kept on the
        // profile; its words are never drafted from.
        const uid = window.CARESITS_ME && window.CARESITS_ME.uid;
        if (uid) { const path = planResumePath(uid, f.name); if (path) uploadToStorage(path, new Blob([buf], { type: "application/pdf" })); }
        out.replaceChildren(el("p", "gateMsg", tr("resume.unread")));
        return;
      }
      // A text pick drafts from its own words and is never
      // uploaded (S-2).
      runDraft(new TextDecoder().decode(buf));
    });
    readBtn.addEventListener("click", () => runDraft(paste.value));
    rcard.append(rpick, rfile, paste, readBtn, out);
    root.append(rcard);
  }
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
    fileIn.value = "";
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
  for (const [code, label] of [["en", "English"], ["es", "Español"], ["zh", "中文"], ["ar", "العربية"], ["vi", "Tiếng Việt"], ["yue", "繁體中文"], ["hi", "हिन्दी"]]) {
    const b = el("button", "chipBtn" + (currentLang() === code ? " on" : ""), label);
    b.type = "button";
    b.addEventListener("click", () => { setLang(code); location.reload(); });
    langRow.append(b);
  }
  langCard.append(langRow);
  root.append(langCard);
  // Plans entry (payments chapter): families only. A carer account
  // never sees a purchase surface (carers have no tiers, ever), so
  // the card stands unless the viewer is known to be a carer. The
  // button opens the plans sheet through its seam.
  const sideNow = ((window.CARESITS_TRUST || {}).me || {}).side || (window.CARESITS_ME || {}).side || "";
  if (sideNow !== "carer") {
    const plansCard = el("div", "findCard");
    plansCard.append(el("h3", "findName", tr("plans.title")));
    const plansBtn = el("button", "mainBtn", tr("plans.title"));
    plansBtn.type = "button";
    plansBtn.id = "plansBtn";
    plansBtn.addEventListener("click", () => { if (typeof window.CARESITS_OPEN_PLANS === "function") window.CARESITS_OPEN_PLANS(); });
    plansCard.append(plansBtn);
    root.append(plansCard);
  }
  // Push switches stand only when the native seam is live on
  // this device (Security fence: no controls that cannot
  // work). The switches write this device's own doc, which
  // the sender checks at send time.
  if (pushAvailable()) {
    const pushCard = el("div", "findCard");
    pushCard.id = "pushCard";
    pushCard.append(el("h3", "findName", tr("push.title")));
    pushCard.append(el("p", null, tr("push.body")));
    const kindsNow = getPushState().kinds;
    for (const [kind, label] of [["message", tr("push.messages")], ["reminder", tr("push.reminders")]]) {
      const row = el("label", "chipRow");
      const box = el("input");
      box.type = "checkbox";
      box.checked = kindsNow[kind] !== false;
      box.dataset.pushKind = kind;
      box.addEventListener("change", () => { togglePushKind(kind, box.checked); });
      row.append(box, el("span", null, label));
      pushCard.append(row);
    }
    pushCard.append(el("p", "findGate", tr("push.note")));
    root.append(pushCard);
    registerPush().catch(() => {});
  }
  const dataCard = el("div", "findCard");
  dataCard.append(el("h3", "findName", tr("export.title")));
  dataCard.append(el("p", null, tr("export.body")));
  const dl = el("button", "mainBtn", tr("export.button"));
  dl.type = "button";
  dl.id = "exportBtn";
  dl.addEventListener("click", async () => {
    const out = await downloadExport();
    const note = el("p", "gateMsg", out && (out.children.length || out.dayStory.length || out.messagesSent.length || out.answers) ? tr("export.done") : tr("export.empty"));
    dataCard.append(note);
  });
  dataCard.append(dl);
  root.append(dataCard);
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

// The live bridge re-publishes the trust seam when the signed
// in member's documents land (F15); this seam lets it refresh
// every trust surface in place, the way the bin refreshes on
// open. Demo and test seams keep working exactly as before:
// they set CARESITS_TRUST and this renders from it.
window.CARESITS_TRUST_RENDER = bootTrust;

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootTrust);
else bootTrust();
