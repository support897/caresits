// Caresitters app2 — the Find screen on browse.js.
// Browsing is never gated: anyone can look. The screen shows
// the live pool count, the Top 5 first, View more for the
// rest, and (families only) the nearly list. A Message button
// rides every card; what it may do is decided by the pair
// action layer, not here. Data arrives from the live account
// layer when it can; otherwise the designed empty states
// stand. Test and live hooks may set CARESITS_FIND_DATA.
import { assembleBrowse, pinLayout, kmBetween } from "./browse.js";
import { t as tr } from "./lang.js";
import { frameUser } from "./account-save.js";
const labelText = (s) => tr({ "Perfect Pair": "find.label.perfect", "Strong Fit": "find.label.strong", "Good Fit": "find.label.good" }[s] || "find.label.good");
const qualText = (s) => (s === "Quick profile, rough match" ? tr("find.qualifier") : s);
const reasonText = (result, r, i) => { const code = result.reasonCodes?.[i]; return code ? tr("reason." + code) : r; };
const gateText = (item) => (item.failedGateCode ? tr("gate." + item.failedGateCode) : item.failedGate);

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

function cardFor(entry) {
  const { doc, result, distanceKm } = entry;
  const card = el("article", "findCard");
  const head = el("div", "findHead");
  if (doc.photoUrl) {
    const img = el("img", "findPhoto");
    img.src = doc.photoUrl;
    img.alt = "";
    head.append(img);
  } else {
    head.append(el("div", "findInitial", (doc.displayName || "?").slice(0, 1)));
  }
  const who = el("div", "findWho");
  who.append(el("h3", "findName", doc.displayName || tr("find.member")));
  const place = [doc.postcode ? tr("find.postcode", undefined, { n: doc.postcode }) : null, distanceKm != null ? tr("find.away", undefined, { n: distanceKm }) : null].filter(Boolean).join(" · ");
  who.append(el("p", "findPlace", place));
  head.append(who);
  card.append(head);
  // F14: the carer's extra photos ride under the main photo
  // when the card carries them, as a small row of thumbs.
  const gallery = doc.card && Array.isArray(doc.card.gallery) ? doc.card.gallery.filter((u) => typeof u === "string" && u).slice(0, 4) : [];
  if (gallery.length) {
    const row = el("div", "galleryThumbs");
    for (const u of gallery) {
      const im = el("img", "galleryThumbSm");
      im.src = u;
      im.alt = "";
      row.append(im);
    }
    card.append(row);
  }
  if (result.personal === false) {
    card.append(el("p", "findInvite", tr("find.invite")));
  } else {
    const fit = el("p", "findFit");
    fit.append(el("span", "fitChip", labelText(result.label)));
    fit.append(el("span", "fitScore", tr("find.pairFit", undefined, { n: result.pair })));
    card.append(fit);
  }
  const ul = el("ul", "findReasons");
  (result.reasons || []).slice(0, 3).forEach((r, i) => ul.append(el("li", null, reasonText(result, r, i))));
  card.append(ul);
  if (result.qualifier) card.append(el("p", "qualLine", qualText(result.qualifier)));
  const btn = el("button", "mainBtn findMsg", tr("find.message"));
  btn.type = "button";
  btn.addEventListener("click", () => {
    if (typeof window.CARESITS_CONTACT === "function") window.CARESITS_CONTACT(doc.uid || "", doc);
  });
  card.append(btn);
  const quiet = el("div", "quietRow");
  const rep = el("button", "quietBtn", tr("find.report"));
  rep.type = "button";
  rep.addEventListener("click", () => window.CARESITS_REPORT?.(doc.uid || "", { surface: "card", snapshot: { items: ["card"], text: (result.reasons || []).join(" "), title: doc.displayName || "Profile card" } }));
  const blk = el("button", "quietBtn", tr("find.block"));
  blk.type = "button";
  blk.addEventListener("click", () => window.CARESITS_BLOCK?.(doc.uid || "", card));
  quiet.append(rep, blk);
  card.append(quiet);
  return card;
}


function mapCardFor(doc, entry, viewerLevel, distanceKm) {
  const card = el("article", "findCard mapCard");
  const who = el("div", "findWho");
  who.append(el("h3", "findName", doc.displayName || tr("find.member")));
  who.append(el("p", "findPlace", [doc.postcode ? tr("find.postcode", undefined, { n: doc.postcode }) : null, distanceKm != null ? tr("find.away", undefined, { n: distanceKm }) : null].filter(Boolean).join(" · ")));
  card.append(who);
  if (!entry || entry.result.personal === false) {
    card.append(el("p", null, tr("find.invite")));
    return card;
  }
  const pct = el("p", "findFit");
  pct.append(el("span", "fitChip", labelText(entry.result.label)));
  pct.append(el("span", "fitScore mapPct", tr("find.matchPct", undefined, { n: entry.result.pair })));
  card.append(pct);
  const ul = el("ul", "findReasons");
  (entry.result.reasons || []).slice(0, 3).forEach((r, i) => ul.append(el("li", null, reasonText(entry.result, r, i))));
  card.append(ul);
  if (entry.result.qualifier) card.append(el("p", "qualLine", qualText(entry.result.qualifier)));
  return card;
}

function mapSection(viewerDoc, candidateDocs, browse) {
  const wrap = el("div", "mapWrap");
  const panel = el("div", "mapPanel");
  panel.setAttribute("aria-label", tr("find.mapAria"));
  const byUid = new Map();
  if (browse) for (const e of [...browse.top, ...browse.more]) byUid.set(e.doc.uid || e.doc.displayName, e);
  const entries = candidateDocs.filter((d) => d.side !== (viewerDoc?.side || "family")).map((doc) => ({ doc, result: null }));
  const pins = pinLayout(viewerDoc?.card || null, entries);
  const slot = el("div", "mapSlot");
  for (const p of pins) {
    const doc = entries.find((e) => (e.doc.uid || e.doc.displayName) === p.uid).doc;
    const pin = el("button", "mapPin", (doc.displayName || "?").slice(0, 1));
    pin.type = "button";
    pin.style.left = p.x + "%";
    pin.style.top = p.y + "%";
    pin.setAttribute("aria-label", (doc.displayName || tr("find.member")) + (doc.postcode ? ", " + tr("find.postcode", undefined, { n: doc.postcode }) : ""));
    pin.addEventListener("click", () => {
      const entry = byUid.get(doc.uid || doc.displayName) || null;
      const km = viewerDoc ? kmBetween(viewerDoc.card || {}, doc.card || {}) : null;
      slot.replaceChildren(mapCardFor(doc, entry, viewerDoc?.level, km));
    });
    panel.append(pin);
  }
  panel.append(el("p", "mapNote", tr("find.mapNote")));
  wrap.append(panel, slot);
  return wrap;
}

const excludedUids = new Set();
let lastRender = null;
export function renderFind(root, viewerDoc, candidateDocs) {
  lastRender = { root, viewerDoc, candidateDocs };
  candidateDocs = candidateDocs.filter((d) => !excludedUids.has(d.uid || d.displayName));
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.find")));
  if (!viewerDoc) {
    const box = el("div", "cardIn");
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-rest-calm.png";
    img.alt = tr("find.bunnyRest");
    box.append(img, el("h3", null, tr("find.waitTitle")), el("p", null, tr("find.waitBody")));
    const go = el("button", "mainBtn", tr("find.startQ"));
    go.type = "button";
    go.addEventListener("click", () => document.querySelector('[data-nav="questionnaire"]')?.click());
    box.append(go);
    root.append(box);
    root.append(el("h3", "findNearlyTitle", tr("find.nearYou")));
    root.append(mapSection(null, candidateDocs, null));
    return;
  }
  const b = assembleBrowse(viewerDoc, candidateDocs);
  const poolWord = viewerDoc.side === "family"
    ? (b.poolCount === 1 ? tr("find.pool.carer1") : tr("find.pool.carerN", undefined, { n: b.poolCount }))
    : (b.poolCount === 1 ? tr("find.pool.family1") : tr("find.pool.familyN", undefined, { n: b.poolCount }));
  const matchWord = b.shownCount === 1 ? tr("find.pool.match1") : tr("find.pool.matchN", undefined, { n: b.shownCount });
  root.append(el("p", "findPool", poolWord + " · " + matchWord));
  const toggle = el("div", "viewToggle");
  const listBtn = el("button", "chip on", tr("find.list"));
  const mapBtn = el("button", "chip", tr("find.map"));
  listBtn.type = "button"; mapBtn.type = "button";
  const mapWrap = mapSection(viewerDoc, candidateDocs, b);
  mapWrap.hidden = true;
  listBtn.addEventListener("click", () => { mapWrap.hidden = true; listBtn.classList.add("on"); mapBtn.classList.remove("on"); });
  mapBtn.addEventListener("click", () => { mapWrap.hidden = false; mapBtn.classList.add("on"); listBtn.classList.remove("on"); });
  toggle.append(listBtn, mapBtn);
  root.append(toggle, mapWrap);
  if (b.shownCount === 0) {
    const box = el("div", "cardIn");
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-rest-calm.png";
    img.alt = tr("find.bunnyRest");
    box.append(img, el("h3", null, tr("find.noneTitle")), el("p", null, tr("find.noneBody")));
    root.append(box);
  }
  const list = el("div", "findList");
  for (const e of b.top) list.append(cardFor(e));
  root.append(list);
  if (b.more.length) {
    const moreBox = el("div", "findList");
    moreBox.hidden = true;
    for (const e of b.more) moreBox.append(cardFor(e));
    const btn = el("button", "mainBtn findMore", tr("find.more"));
    btn.type = "button";
    btn.addEventListener("click", () => { moreBox.hidden = false; btn.remove(); });
    root.append(btn, moreBox);
  }
  if (b.nearly.length) {
    root.append(el("h3", "findNearlyTitle", tr("find.nearlyTitle")));
    root.append(el("p", "findNearlyNote", tr("find.nearlyNote")));
    const nl = el("div", "findList");
    for (const nItem of b.nearly) {
      const c = el("article", "findCard nearly");
      c.append(el("h3", "findName", nItem.doc.displayName || tr("find.member")));
      c.append(el("p", "findPlace", nItem.doc.postcode ? tr("find.postcode", undefined, { n: nItem.doc.postcode }) : ""));
      c.append(el("p", "findGate", tr("find.gateLine", undefined, { g: gateText(nItem) })));
      nl.append(c);
    }
    root.append(nl);
  }
}

// The pool fetch, shared by Find's own cold path and the
// shell's warm Phase C publication (QA b110 FLAGREAD): the
// viewer's stitched card plus every candidate's, from the
// live documents. A viewer with no card yet reads as null —
// the waiting state is for them, and only them.
export async function fetchFindData(fsMod, db, uid) {
  const mine = await fsMod.getDoc(fsMod.doc(db, "profiles", uid));
  if (!mine.exists()) return { viewer: null, candidates: [] };
  const withAnswers = async (id, data) => {
    const aSnap = await fsMod.getDocs(fsMod.collection(db, "profiles", id, "answers"));
    const docs = [];
    aSnap.forEach((d) => docs.push({ code: d.id, data: d.data() }));
    return stitchAnswers({ uid: id, ...data }, docs);
  };
  const viewer = await withAnswers(uid, mine.data());
  const snap = await fsMod.getDocs(fsMod.query(fsMod.collection(db, "profiles"), fsMod.limit(100)));
  const candidates = [];
  for (const d of snap.docs) { if (d.id !== uid) candidates.push(await withAnswers(d.id, d.data())); }
  return { viewer, candidates };
}

async function bootFind() {
  const root = document.getElementById("findRoot");
  if (!root) return;
  if (window.CARESITS_FIND_DATA) {
    renderFind(root, window.CARESITS_FIND_DATA.viewer, window.CARESITS_FIND_DATA.candidates || []);
    return;
  }
  try {
    const cfgMod = await import("./firebase-config.js");
    const appMod = await import("../accounts/sdk/firebase-app.js");
    const authMod = await import("../accounts/sdk/firebase-auth.js");
    const fsMod = await import("../accounts/sdk/firebase-firestore.js");
    // The DEFAULT app only, shared with the door: a named app carries
    // its own auth session and would never see the signed-in user (R1).
    const app = appMod.getApps().find((a) => a.name === "[DEFAULT]") || appMod.initializeApp(cfgMod.firebaseConfig);
    // The same frame rule as the journey save (QA b104 ROOT A):
    // judge the user after the session restore settles, never
    // on a synchronous read in a still-restoring frame.
    const user = await frameUser(authMod.getAuth(app));
    if (!user || user.isAnonymous) { renderFind(root, null, []); return; }
    const db = fsMod.getFirestore(app);
    const fd = await fetchFindData(fsMod, db, user.uid);
    renderFind(root, fd.viewer, fd.candidates);
  } catch {
    renderFind(root, null, []);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootFind);
  else bootFind();
}

window.CARESITS_EXCLUDE = (uid) => { excludedUids.add(uid); if (lastRender) renderFind(lastRender.root, lastRender.viewerDoc, lastRender.candidateDocs); };
// The shell's warm boot publishes CARESITS_FIND_DATA after
// this module's cold first pass; the re-render hook lets
// that publication replace the cold judgement in place.
window.CARESITS_FIND_RENDER = () => bootFind();
