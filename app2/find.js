// Caresits app2 — the Find screen on browse.js.
// Browsing is never gated: anyone can look. The screen shows
// the live pool count, the Top 5 first, View more for the
// rest, and (families only) the nearly list. A Message button
// rides every card; what it may do is decided by the pair
// action layer, not here. Data arrives from the live account
// layer when it can; otherwise the designed empty states
// stand. Test and live hooks may set CARESITS_FIND_DATA.
import { assembleBrowse, pinLayout, kmBetween } from "./browse.js";

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
  who.append(el("h3", "findName", doc.displayName || "A member"));
  const place = [doc.postcode ? "Postcode " + doc.postcode : null, distanceKm != null ? "about " + distanceKm + " km away" : null].filter(Boolean).join(" · ");
  who.append(el("p", "findPlace", place));
  head.append(who);
  card.append(head);
  if (result.personal === false) {
    card.append(el("p", "findInvite", "Answer the quick questions to see your match number with this carer."));
  } else {
    const fit = el("p", "findFit");
    fit.append(el("span", "fitChip", result.label));
    fit.append(el("span", "fitScore", " Pair fit " + result.pair + " of 100"));
    card.append(fit);
  }
  const ul = el("ul", "findReasons");
  for (const r of (result.reasons || []).slice(0, 3)) ul.append(el("li", null, r));
  card.append(ul);
  if (result.qualifier) card.append(el("p", "qualLine", result.qualifier));
  const btn = el("button", "mainBtn findMsg", "Message");
  btn.type = "button";
  btn.addEventListener("click", () => {
    if (typeof window.CARESITS_CONTACT === "function") window.CARESITS_CONTACT(doc.uid || "", doc);
  });
  card.append(btn);
  const quiet = el("div", "quietRow");
  const rep = el("button", "quietBtn", "Report");
  rep.type = "button";
  rep.addEventListener("click", () => window.CARESITS_REPORT?.(doc.uid || "", { surface: "card", snapshot: { items: ["card"], text: (result.reasons || []).join(" "), title: doc.displayName || "Profile card" } }));
  const blk = el("button", "quietBtn", "Block");
  blk.type = "button";
  blk.addEventListener("click", () => window.CARESITS_BLOCK?.(doc.uid || "", card));
  quiet.append(rep, blk);
  card.append(quiet);
  return card;
}


function mapCardFor(doc, entry, viewerLevel, distanceKm) {
  const card = el("article", "findCard mapCard");
  const who = el("div", "findWho");
  who.append(el("h3", "findName", doc.displayName || "A member"));
  who.append(el("p", "findPlace", [doc.postcode ? "Postcode " + doc.postcode : null, distanceKm != null ? "about " + distanceKm + " km away" : null].filter(Boolean).join(" · ")));
  card.append(who);
  if (!entry || entry.result.personal === false) {
    card.append(el("p", null, "Answer the quick questions to see your match number with this carer."));
    return card;
  }
  const pct = el("p", "findFit");
  pct.append(el("span", "fitChip", entry.result.label));
  pct.append(el("span", "fitScore mapPct", " Match " + entry.result.pair + "%"));
  card.append(pct);
  const ul = el("ul", "findReasons");
  for (const r of (entry.result.reasons || []).slice(0, 3)) ul.append(el("li", null, r));
  card.append(ul);
  if (entry.result.qualifier) card.append(el("p", "qualLine", entry.result.qualifier));
  return card;
}

function mapSection(viewerDoc, candidateDocs, browse) {
  const wrap = el("div", "mapWrap");
  const panel = el("div", "mapPanel");
  panel.setAttribute("aria-label", "Map of your area. Pins sit at postcode area level, never at a home address.");
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
    pin.setAttribute("aria-label", (doc.displayName || "A member") + (doc.postcode ? ", postcode " + doc.postcode : ""));
    pin.addEventListener("click", () => {
      const entry = byUid.get(doc.uid || doc.displayName) || null;
      const km = viewerDoc ? kmBetween(viewerDoc.card || {}, doc.card || {}) : null;
      slot.replaceChildren(mapCardFor(doc, entry, viewerDoc?.level, km));
    });
    panel.append(pin);
  }
  panel.append(el("p", "mapNote", "Pins sit at postcode area level, never at a home address."));
  wrap.append(panel, slot);
  return wrap;
}

const excludedUids = new Set();
let lastRender = null;
export function renderFind(root, viewerDoc, candidateDocs) {
  lastRender = { root, viewerDoc, candidateDocs };
  candidateDocs = candidateDocs.filter((d) => !excludedUids.has(d.uid || d.displayName));
  root.replaceChildren();
  root.append(el("h2", "findTitle", "Find"));
  if (!viewerDoc) {
    const box = el("div", "cardIn");
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-rest-calm.png";
    img.alt = "The Caresits bunny, resting calmly";
    box.append(img, el("h3", null, "Your matches wait for your answers"), el("p", null, "Finish the questionnaire and we can line up the people who fit your family. Looking around costs nothing, always."));
    const go = el("button", "mainBtn", "Start the questionnaire");
    go.type = "button";
    go.addEventListener("click", () => document.querySelector('[data-nav="questionnaire"]')?.click());
    box.append(go);
    root.append(box);
    root.append(el("h3", "findNearlyTitle", "Caregivers near you"));
    root.append(mapSection(null, candidateDocs, null));
    return;
  }
  const b = assembleBrowse(viewerDoc, candidateDocs);
  const noun = viewerDoc.side === "family" ? "carers" : "families";
  root.append(el("p", "findPool", b.poolCount + " " + noun + " in your pool · " + b.shownCount + " match your musts"));
  const toggle = el("div", "viewToggle");
  const listBtn = el("button", "chip on", "List");
  const mapBtn = el("button", "chip", "Map");
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
    img.alt = "The Caresits bunny, resting calmly";
    box.append(img, el("h3", null, "No matches yet"), el("p", null, "Nobody in your pool fits every must right now. New people join all the time, and loosening one must can open the pool up."));
    root.append(box);
  }
  const list = el("div", "findList");
  for (const e of b.top) list.append(cardFor(e));
  root.append(list);
  if (b.more.length) {
    const moreBox = el("div", "findList");
    moreBox.hidden = true;
    for (const e of b.more) moreBox.append(cardFor(e));
    const btn = el("button", "mainBtn findMore", "View more");
    btn.type = "button";
    btn.addEventListener("click", () => { moreBox.hidden = false; btn.remove(); });
    root.append(btn, moreBox);
  }
  if (b.nearly.length) {
    root.append(el("h3", "findNearlyTitle", "Nearly there"));
    root.append(el("p", "findNearlyNote", "These people missed one must. Only you can loosen a must."));
    const nl = el("div", "findList");
    for (const nItem of b.nearly) {
      const c = el("article", "findCard nearly");
      c.append(el("h3", "findName", nItem.doc.displayName || "A member"));
      c.append(el("p", "findPlace", nItem.doc.postcode ? "Postcode " + nItem.doc.postcode : ""));
      c.append(el("p", "findGate", "One thing did not line up: " + nItem.failedGate + "."));
      nl.append(c);
    }
    root.append(nl);
  }
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
    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const authMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const fsMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(cfgMod.firebaseConfig, "app2-find");
    const user = authMod.getAuth(app).currentUser;
    if (!user || user.isAnonymous) { renderFind(root, null, []); return; }
    const db = fsMod.getFirestore(app);
    const mine = await fsMod.getDoc(fsMod.doc(db, "profiles", user.uid));
    if (!mine.exists()) { renderFind(root, null, []); return; }
    const withAnswers = async (uid, data) => {
      const aSnap = await fsMod.getDocs(fsMod.collection(db, "profiles", uid, "answers"));
      const docs = [];
      aSnap.forEach((d) => docs.push({ code: d.id, data: d.data() }));
      return stitchAnswers({ uid, ...data }, docs);
    };
    const viewer = await withAnswers(user.uid, mine.data());
    const snap = await fsMod.getDocs(fsMod.query(fsMod.collection(db, "profiles"), fsMod.limit(100)));
    const candidates = [];
    for (const d of snap.docs) { if (d.id !== user.uid) candidates.push(await withAnswers(d.id, d.data())); }
    renderFind(root, viewer, candidates);
  } catch {
    renderFind(root, null, []);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootFind);
  else bootFind();
}

window.CARESITS_EXCLUDE = (uid) => { excludedUids.add(uid); if (lastRender) renderFind(lastRender.root, lastRender.viewerDoc, lastRender.candidateDocs); };
