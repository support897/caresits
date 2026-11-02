// Caresitters app2 - Discover: the swipe deck, travel limit, match %,
// "what matters to you" sheet. Families see carers, carers see families.
// Swipe right = interested (sends the same request the Message button
// sends), left = pass. Photos are slides inside the card (tap left or
// right half of the photo). Everything under the photo is the card's
// own scroll: about, kids, days, why it matches you, badges, reviews.
import { PRIORITIES, DAYS, scoreFit, label, inRadius, RADIUS_STEPS, emptyPrefs, cyclePriority, daysOf } from "./fit.js";
import { kmBetween } from "./browse.js";
import { paintFileImg } from "./files.js";
import { LANGS } from "./questions.js";

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const btn = (cls, text, on) => { const b = el("button", cls, text); b.type = "button"; if (on) b.addEventListener("click", on); return b; };
const svg = (path, cls = "dkIco") => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", cls); s.setAttribute("aria-hidden", "true"); s.innerHTML = path; return s; };
const ICON = {
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>',
  chat: '<path d="M4 5h16v12H9l-5 4z"/><path d="M8 10h8M8 13h5"/>',
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
};

// ---------- per-member memory (device, keyed by uid) ----------
const me = () => window.CARESITS_ME || {};
const key = (n, uid) => `caresits-discover-${n}-${uid || me().uid || "anon"}`;
const load = (n, uid, dflt) => { try { const v = JSON.parse(localStorage.getItem(key(n, uid)) || "null"); return v ?? dflt; } catch { return dflt; } };
const save = (n, uid, v) => { try { localStorage.setItem(key(n, uid), JSON.stringify(v)); } catch { /* storage off */ } };

export const getPrefs = (uid) => ({ ...emptyPrefs(), ...load("prefs", uid, {}) });
export const setPrefs = (uid, p) => save("prefs", uid, p);
export function getRadius(uid, viewerDoc) {
  const v = load("radius", uid, null);
  if (v != null) return Number(v);
  const own = Number(viewerDoc?.card?.maxDistanceKm);
  return own > 0 ? own : 25;
}
export const setRadius = (uid, km) => save("radius", uid, km);
const getSeen = (uid) => load("seen", uid, { pass: [], like: [] });

function toast(text) {
  let t = document.getElementById("dkToast");
  if (!t) { t = el("div", "dkToast"); t.id = "dkToast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.append(t); }
  t.textContent = text; t.classList.add("on");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2600);
}

// ---------- the people ----------
const uidOf = (d) => d.uid || d.displayName;
function slidesOf(doc) {
  const g = Array.isArray(doc.card?.gallery) ? doc.card.gallery.filter((u) => typeof u === "string" && u) : [];
  return [doc.photoUrl, ...g].filter(Boolean).slice(0, 5);
}
function kidsLine(doc) { const b = doc.card?.childrenBands || []; return b.length ? b.join(", ") + " yrs" : ""; }
function whoLine(doc) {
  const c = doc.card || {};
  const age = c.age ? ", " + c.age : "";
  return (doc.displayName || "Member") + age;
}
export function prepare(viewerDoc, candidates, { radiusKm, prefs, engineFor }) {
  const out = [];
  for (const doc of candidates) {
    if (doc.side === viewerDoc.side) continue;
    const km = kmBetween(viewerDoc.card || {}, doc.card || {});
    const fit = scoreFit({ viewer: viewerDoc, other: doc, prefs, radiusKm, km, engine: engineFor ? engineFor(doc) : null });
    out.push({ doc, km, fit, inside: inRadius(km, radiusKm) });
  }
  return out.sort((a, b) => b.fit.pct - a.fit.pct || (a.km ?? 1e9) - (b.km ?? 1e9));
}

// ---------- one card ----------
function buildCard(entry, viewerDoc) {
  const { doc, km, fit } = entry;
  const isFam = doc.side === "family";
  const card = el("article", "dkCard");
  card.dataset.uid = uidOf(doc);
  const scroll = el("div", "dkScroll");
  // photos
  const slides = slidesOf(doc);
  const ph = el("div", "dkPhotos");
  const img = el("img", "dkImg");
  img.alt = "";
  img.draggable = false;
  const ini = el("div", "dkInitial", (doc.displayName || "?").slice(0, 1));
  ph.append(slides.length ? img : ini);
  const dots = el("div", "dkDots");
  let idx = 0;
  const paint = () => {
    if (slides.length) { img.removeAttribute("src"); paintFileImg(img, slides[idx]); }
    dots.replaceChildren(...slides.map((_, i) => el("i", i === idx ? "on" : "")));
  };
  paint();
  if (slides.length > 1) {
    ph.append(dots);
    const prev = btn("dkTap dkTapL", "", (e) => { e.stopPropagation(); idx = (idx + slides.length - 1) % slides.length; paint(); });
    const next = btn("dkTap dkTapR", "", (e) => { e.stopPropagation(); idx = (idx + 1) % slides.length; paint(); });
    prev.setAttribute("aria-label", "Previous photo"); next.setAttribute("aria-label", "Next photo");
    ph.append(prev, next);
  }
  const pct = el("div", "dkPct dkPct" + (fit.pct >= 85 ? "A" : fit.pct >= 70 ? "B" : "C"));
  pct.append(el("b", null, fit.pct + "%"), el("span", null, "match"));
  ph.append(pct);
  const nameBar = el("div", "dkNameBar");
  nameBar.append(el("h3", "dkName", whoLine(doc)));
  const place = [doc.suburb || (doc.postcode ? "Postcode " + doc.postcode : "")].filter(Boolean).join("");
  const dist = el("p", "dkPlace");
  dist.append(svg(ICON.pin));
  dist.append(document.createTextNode(" " + (km != null ? (km < 1 ? "Under 1 km away" : km + " km away") : "Distance unknown") + (place ? " · " + place : "")));
  if (!entry.inside) dist.classList.add("far");
  nameBar.append(dist);
  ph.append(nameBar);
  const stampL = el("div", "dkStamp dkNope", "PASS"), stampR = el("div", "dkStamp dkLike", "LIKE");
  ph.append(stampL, stampR);
  scroll.append(ph);

  const body = el("div", "dkBody");
  body.append(el("p", "dkHint", "Scroll for kids, days and why it matches"));
  const label_ = el("p", "dkLabel dkLabel" + (fit.pct >= 85 ? "A" : fit.pct >= 70 ? "B" : "C"), label(fit.pct) + " for you");
  body.append(label_);
  const about = doc.about || doc.card?.about;
  if (about) { body.append(el("h4", "dkH", isFam ? "About our family" : "About me"), el("p", "dkAbout", about)); }
  if (isFam) {
    const kids = kidsLine(doc);
    const k = el("div", "dkRow"); k.append(el("h4", "dkH", "Children"));
    const chips = el("div", "dkChips");
    for (const b of doc.card?.childrenBands || []) chips.append(el("span", "dkChip", b + " yrs"));
    if (!chips.children.length) chips.append(el("span", "dkChip dim", "Ages not shared yet"));
    if (doc.card?.pets) chips.append(el("span", "dkChip", "Pets at home"));
    k.append(chips); body.append(k);
    if (doc.card?.payOffered) body.append(el("p", "dkPay", "Offers $" + doc.card.payOffered + " / hour"));
    void kids;
  } else {
    const k = el("div", "dkRow"); k.append(el("h4", "dkH", "Cares for"));
    const chips = el("div", "dkChips");
    for (const b of doc.card?.agesAccepted || doc.card?.agesPreferred || []) chips.append(el("span", "dkChip", b + " yrs"));
    for (const l of doc.card?.languages || []) chips.append(el("span", "dkChip", l));
    if (!chips.children.length) chips.append(el("span", "dkChip dim", "Not shared yet"));
    k.append(chips); body.append(k);
    const yrs = doc.card?.experience && Object.values(doc.card.experience).map(Number).filter((n) => !isNaN(n));
    if (yrs && yrs.length) body.append(el("p", "dkPay", Math.max(...yrs) + "+ years experience" + (doc.card?.payFloor ? " · from $" + doc.card.payFloor + " / hour" : "")));
  }
  // days
  const theirDays = daysOf(isFam ? doc.card?.scheduleNeed : doc.card?.availability);
  const mine = daysOf(isFam ? viewerDoc.card?.availability : viewerDoc.card?.scheduleNeed);
  const dr = el("div", "dkRow"); dr.append(el("h4", "dkH", isFam ? "Days they need help" : "Days available"));
  const week = el("div", "dkWeek");
  for (const d of DAYS) {
    const on = theirDays.includes(d), both = on && mine.includes(d);
    const c = el("span", "dkDay" + (on ? " on" : "") + (both ? " both" : ""), d);
    if (on) c.setAttribute("aria-label", d + (both ? ", works for you" : ""));
    week.append(c);
  }
  dr.append(week);
  if (doc.card?.flexible || /flexible/i.test(about || "")) dr.append(el("p", "dkFlex", "Flexible with days and hours"));
  if (!theirDays.length) dr.append(el("p", "dkNote", "No days shared yet"));
  else dr.append(el("p", "dkNote", fit.schedule.both.length ? "Dark days work for both of you" : "No overlap with your days yet"));
  body.append(dr);
  // why
  const why = el("div", "dkWhy"); why.append(el("h4", "dkH", "Why it matches you"));
  const ul = el("ul", "dkReasons");
  for (const r of fit.reasons.slice(0, 5)) ul.append(el("li", "ok", r.text));
  for (const g of fit.gaps.slice(0, 3)) ul.append(el("li", "gap" + (g.level === "must" ? " must" : ""), g.text));
  if (!ul.children.length) ul.append(el("li", "dim", "Tell us what matters to you and we will explain every match."));
  why.append(ul);
  body.append(why);
  // badges
  const badges = el("div", "dkBadges");
  const checks = String(doc.card?.checksLevel || doc.checksLevel || "").toLowerCase();
  if (checks === "register") badges.append(el("span", "dkBadge good", "Background checked"));
  else if (checks === "sighted") badges.append(el("span", "dkBadge good", "ID sighted"));
  else badges.append(el("span", "dkBadge", "Self-reported"));
  if (doc.verified) badges.append(el("span", "dkBadge good", "Verified"));
  if (Number(doc.reviewCount) > 0) badges.append(el("span", "dkBadge good", "★ " + (doc.rating ? Number(doc.rating).toFixed(1) : "") + " · " + doc.reviewCount + " reviews"));
  body.append(badges);
  const revBox = el("div", "v2RevList dkReviews");
  body.append(revBox);
  if (doc.uid && window.CARESITS_V2?.reviewsInto) { try { window.CARESITS_V2.reviewsInto(revBox, doc.uid); } catch { /* no reviews */ } }
  const quiet = el("div", "quietRow");
  quiet.append(btn("quietBtn", "Report", () => window.CARESITS_REPORT?.(doc.uid || "", { surface: "card", snapshot: { items: ["card"], text: "", title: doc.displayName || "Profile card" } })), btn("quietBtn", "Block", () => window.CARESITS_BLOCK?.(doc.uid || "", card)));
  body.append(quiet);
  scroll.append(body);
  card.append(scroll);
  card._stamps = { like: stampR, nope: stampL };
  return card;
}

// ---------- resume ----------
export function resumeText(viewerDoc, other) {
  const c = viewerDoc.card || {};
  const yrs = c.experience && Object.values(c.experience).map(Number).filter((n) => !isNaN(n));
  const lines = [`Hi ${other.displayName || "there"}, I'm ${viewerDoc.displayName || me().name || "a Caresitters carer"}. Here is my resume from my profile.`];
  if (c.age) lines.push("Age: " + c.age);
  if (yrs && yrs.length) lines.push("Experience: " + Math.max(...yrs) + "+ years");
  const ages = c.agesAccepted || c.agesPreferred || [];
  if (ages.length) lines.push("Ages I care for: " + ages.join(", "));
  if ((c.languages || []).length) lines.push("Languages: " + c.languages.join(", "));
  const chk = c.checksLevel;
  lines.push("Checks: " + (chk === "register" ? "Background checked" : chk === "sighted" ? "ID sighted" : "Self-reported"));
  const days = daysOf(c.availability);
  if (days.length) lines.push("Available: " + days.join(", "));
  if (c.drives) lines.push("Drives: yes");
  if ((c.tasks || []).length) lines.push("Can help with: " + c.tasks.join(", "));
  if (c.payFloor) lines.push("Rate from: $" + c.payFloor + " / hour");
  const about = viewerDoc.about || c.about;
  if (about) lines.push("", about);
  return lines.join("\n");
}
async function sendResume(viewerDoc, other) {
  if (typeof window.CARESITS_CONTACT !== "function") { toast("Sign in to send your resume."); return; }
  const ok = await window.CARESITS_CONTACT(other.uid || "", other, { stay: true });
  if (ok === false) return;
  try {
    const { pairIdFor } = await import("./pair-actions.js");
    const myUid = me().uid;
    const pairId = pairIdFor(myUid, other.uid);
    const r = await window.CARESITS_WRITE?.("message", { pairId, text: resumeText(viewerDoc, other), at: new Date().toISOString() });
    toast(r && r.ok === false ? "Resume saved here. Send it again when you are online." : "Resume sent to " + (other.displayName || "them") + ".");
  } catch { toast("Could not send the resume. Try again."); }
}

// ---------- gestures ----------
function attachSwipe(card, onDecide) {
  let sx = 0, sy = 0, dx = 0, drag = false, decided = false, id = null;
  const st = card._stamps;
  const reset = () => { card.style.transition = "transform .25s"; card.style.transform = ""; st.like.style.opacity = st.nope.style.opacity = 0; };
  card.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a, input, textarea")) return;
    sx = e.clientX; sy = e.clientY; dx = 0; drag = false; decided = false; id = e.pointerId;
  });
  card.addEventListener("pointermove", (e) => {
    if (id !== e.pointerId || decided) return;
    const mx = e.clientX - sx, my = e.clientY - sy;
    if (!drag) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3) { drag = true; try { card.setPointerCapture(id); } catch { /* ok */ } card.style.transition = "none"; }
      else return;
    }
    dx = mx;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
    st.like.style.opacity = Math.min(1, Math.max(0, dx / 90));
    st.nope.style.opacity = Math.min(1, Math.max(0, -dx / 90));
  });
  const end = (e) => {
    if (id !== e.pointerId) return;
    id = null;
    if (!drag || decided) return;
    if (Math.abs(dx) > 90) { decided = true; onDecide(dx > 0 ? "like" : "pass"); }
    else reset();
  };
  card.addEventListener("pointerup", end);
  card.addEventListener("pointercancel", end);
}
function flyOut(card, dir, done) {
  card.style.transition = "transform .28s ease-in, opacity .28s";
  card.style.transform = `translateX(${dir === "like" ? 520 : -520}px) rotate(${dir === "like" ? 22 : -22}deg)`;
  card.style.opacity = "0";
  setTimeout(done, 260);
}

// ---------- the deck ----------
export function renderDeck(host, viewerDoc, candidates, opts = {}) {
  host.replaceChildren();
  const uid = viewerDoc.uid || me().uid;
  const isFam = viewerDoc.side === "family";
  const radiusKm = getRadius(uid, viewerDoc);
  const prefs = getPrefs(uid);
  const all = prepare(viewerDoc, candidates, { radiusKm, prefs, engineFor: opts.engineFor });
  const seen = getSeen(uid);
  const handled = new Set([...seen.pass, ...seen.like]);
  const inside = all.filter((e) => e.inside);
  const queue = inside.filter((e) => !handled.has(uidOf(e.doc)));
  const history = [];
  const who = isFam ? "carers" : "families";

  const top = el("div", "dkTop");
  const radiusBtn = btn("dkPill", radiusKm > 0 ? `Within ${radiusKm} km` : "Any distance", () => openRadiusSheet(host, viewerDoc, candidates, opts));
  radiusBtn.prepend(svg(ICON.pin));
  const prefBtn = btn("dkPill", prefs.done || Object.keys(prefs.levels).length ? "What matters" : "What matters?", () => openPrioritySheet(host, viewerDoc, candidates, opts));
  prefBtn.prepend(svg(ICON.sliders));
  if (!Object.keys(prefs.levels).length) prefBtn.classList.add("nudge");
  top.append(radiusBtn, prefBtn);
  host.append(top);
  const count = el("p", "dkCount");
  count.textContent = queue.length ? `${queue.length} ${isFam ? (queue.length === 1 ? "carer" : "carers") : (queue.length === 1 ? "family" : "families")} within reach` : "";
  host.append(count);

  const stage = el("div", "dkStage");
  host.append(stage);
  const actions = el("div", "dkActions");
  host.append(actions);

  const showEmpty = () => {
    stage.replaceChildren();
    actions.replaceChildren();
    actions.hidden = true;
    const box = el("div", "dkEmpty");
    const farther = all.filter((e) => !e.inside && !handled.has(uidOf(e.doc)));
    if (!all.length) {
      box.append(el("h3", null, "No " + who + " here yet"), el("p", null, "We will show them here as soon as they join. Check the map to see everyone."));
    } else if (!inside.length) {
      box.append(el("h3", null, `No ${who} within ${radiusKm} km`), el("p", null, "Here is how far the nearest ones are:"));
      const ul = el("ul", "dkNear");
      for (const e of farther.slice(0, 3).sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9))) ul.append(el("li", null, `${e.doc.displayName || "Member"} · ${e.km != null ? e.km + " km away" : "distance unknown"} · ${e.fit.pct}% match`));
      box.append(ul);
      const nextStep = RADIUS_STEPS.find((s) => s === 0 || s > radiusKm);
      box.append(btn("mainBtn", nextStep ? `Look within ${nextStep || "any"} km` : "Look anywhere", () => { setRadius(uid, nextStep || 0); opts.rerender?.(); }));
    } else {
      box.append(el("h3", null, "You have seen everyone nearby"), el("p", null, farther.length ? `${farther.length} more ${who} live further than ${radiusKm} km.` : "Come back soon, new people join every day."));
      if (farther.length) { const nextStep = RADIUS_STEPS.find((s) => s === 0 || s > radiusKm); box.append(btn("mainBtn", nextStep ? `Look within ${nextStep} km` : "Look anywhere", () => { setRadius(uid, nextStep || 0); opts.rerender?.(); })); }
      box.append(btn("ghostBtn", "See passed profiles again", () => { save("seen", uid, { pass: [], like: seen.like }); opts.rerender?.(); }));
    }
    box.append(btn("ghostBtn", "Open the map", () => opts.setMode?.("map")));
    stage.append(box);
  };

  const decide = (entry, dir, cardEl) => {
    const s = getSeen(uid);
    const id = uidOf(entry.doc);
    if (dir === "like") { if (!s.like.includes(id)) s.like.push(id); } else if (!s.pass.includes(id)) s.pass.push(id);
    save("seen", uid, s);
    history.push({ entry, dir });
    queue.shift();
    const finish = async () => {
      if (dir === "like") {
        let ok = true;
        if (typeof window.CARESITS_CONTACT === "function") ok = await window.CARESITS_CONTACT(entry.doc.uid || "", entry.doc, { stay: true });
        if (ok !== false && opts.isMutual?.(entry.doc.uid)) showMatch(entry.doc);
      }
      draw();
    };
    if (cardEl) flyOut(cardEl, dir, finish); else finish();
  };

  const showMatch = (doc) => {
    const wrap = el("div", "dkMatch"); wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-label", "It's a match");
    wrap.append(el("h2", null, "It's a match!"), el("p", null, `You and ${doc.displayName || "they"} like each other.`));
    wrap.append(btn("mainBtn", "Say hello", () => { wrap.remove(); window.CARESITS_NAV?.("thread"); }), btn("ghostBtn", "Keep swiping", () => wrap.remove()));
    document.body.append(wrap);
  };

  const draw = () => {
    stage.replaceChildren();
    count.textContent = queue.length ? `${queue.length} ${isFam ? (queue.length === 1 ? "carer" : "carers") : (queue.length === 1 ? "family" : "families")} within reach` : "";
    if (!queue.length) { showEmpty(); return; }
    actions.hidden = false;
    const [first, second] = queue;
    if (second) { const back = buildCard(second, viewerDoc); back.classList.add("dkBack"); back.inert = true; stage.append(back); }
    const cardEl = buildCard(first, viewerDoc);
    stage.append(cardEl);
    attachSwipe(cardEl, (dir) => decide(first, dir, cardEl));
    actions.replaceChildren();
    const pass = btn("dkRound dkPass", "", () => decide(first, "pass", cardEl)); pass.append(svg(ICON.x)); pass.setAttribute("aria-label", "Pass");
    const undo = btn("dkRound dkUndo", "", () => {
      const h = history.pop(); if (!h) { toast("Nothing to undo."); return; }
      const s = getSeen(uid); const id = uidOf(h.entry.doc);
      s.pass = s.pass.filter((x) => x !== id); s.like = s.like.filter((x) => x !== id); save("seen", uid, s);
      queue.unshift(h.entry); draw();
    }); undo.append(svg(ICON.undo)); undo.setAttribute("aria-label", "Undo");
    const msg = btn("dkRound dkMsg", "", () => { if (typeof window.CARESITS_CONTACT === "function") window.CARESITS_CONTACT(first.doc.uid || "", first.doc); }); msg.append(svg(ICON.chat)); msg.setAttribute("aria-label", "Message " + (first.doc.displayName || ""));
    const like = btn("dkRound dkLikeBtn", "", () => decide(first, "like", cardEl)); like.append(svg(ICON.heart)); like.setAttribute("aria-label", "Like");
    actions.append(pass, undo, msg);
    if (!isFam) {
      const res = btn("dkRound dkRes", "", () => sendResume(viewerDoc, first.doc)); res.append(svg(ICON.doc)); res.setAttribute("aria-label", "Send my resume");
      const lab = el("span", "dkResLab", "Resume"); res.append(lab);
      actions.append(res);
    }
    actions.append(like);
  };
  draw();
  return { queue, all };
}

// ---------- sheets ----------
function sheet(title, build, onClose) {
  const wrap = el("div", "dkSheetWrap");
  const card = el("section", "dkSheet"); card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-label", title);
  const head = el("div", "dkSheetHead"); head.append(el("h3", null, title), btn("dkSheetX", "Done", () => { wrap.remove(); onClose?.(); }));
  const body = el("div", "dkSheetBody");
  card.append(head, body); wrap.append(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) { wrap.remove(); onClose?.(); } });
  build(body);
  document.body.append(wrap);
  return wrap;
}
function openRadiusSheet(host, viewerDoc, candidates, opts) {
  const uid = viewerDoc.uid || me().uid;
  let km = getRadius(uid, viewerDoc);
  sheet("How far will you go?", (body) => {
    body.append(el("p", "dkSheetNote", viewerDoc.side === "family" ? "Only carers living within this distance of you show in your swipe deck. The map still shows everyone." : "Only families within this distance of you show in your swipe deck. The map still shows everyone."));
    const out = el("p", "dkRadiusOut");
    const range = el("input"); range.type = "range"; range.min = "0"; range.max = String(RADIUS_STEPS.length - 1); range.step = "1";
    const idxOf = (v) => { const i = RADIUS_STEPS.indexOf(v); return i < 0 ? RADIUS_STEPS.findIndex((s) => s >= v && s !== 0) : i; };
    range.value = String(Math.max(0, idxOf(km)));
    range.setAttribute("aria-label", "Distance in kilometres");
    const show = () => { out.textContent = RADIUS_STEPS[+range.value] === 0 ? "Any distance" : RADIUS_STEPS[+range.value] + " km"; };
    range.addEventListener("input", () => { km = RADIUS_STEPS[+range.value]; show(); });
    show();
    const steps = el("div", "dkSteps"); for (const s of RADIUS_STEPS) steps.append(btn("dkStep", s === 0 ? "Any" : s + " km", () => { km = s; range.value = String(RADIUS_STEPS.indexOf(s)); show(); }));
    body.append(out, range, steps);
  }, () => { setRadius(uid, km); opts.rerender?.(); });
}
function openPrioritySheet(host, viewerDoc, candidates, opts) {
  const uid = viewerDoc.uid || me().uid;
  const side = viewerDoc.side === "family" ? "family" : "carer";
  let prefs = getPrefs(uid);
  const LV = { nice: "Nice to have", important: "Important", must: "Must have" };
  sheet(side === "family" ? "What matters in a carer?" : "What matters in a family?", (body) => {
    body.append(el("p", "dkSheetNote", "Tap to choose how much each one matters: once is nice to have, twice important, three times a must. We use this, your days and your distance to score every match. Skip what does not matter."));
    const paint = () => {
      body.querySelectorAll(".dkPrioList").forEach((n) => n.remove());
      const listEl = el("div", "dkPrioList");
      let group = "";
      for (const p of PRIORITIES[side]) {
        if (p.group !== group) { group = p.group; listEl.append(el("h4", "dkH", group)); }
        const lv = prefs.levels[p.id] || "off";
        const b = btn("dkPrio " + lv, "", () => { prefs = { ...prefs, levels: cyclePriority(prefs.levels, p.id), done: true }; setPrefs(uid, prefs); paint(); });
        b.setAttribute("aria-pressed", String(lv !== "off"));
        b.append(el("span", "dkPrioName", p.label), el("span", "dkPrioLv", lv === "off" ? "Skip" : LV[lv]));
        listEl.append(b);
        if (p.config === "languages" && lv !== "off") {
          const row = el("div", "dkChips dkLangs");
          for (const l of LANGS.filter((x) => x !== "English").concat(["English"])) {
            const on = (prefs.languages || []).includes(l);
            const c = btn("dkChip pick" + (on ? " on" : ""), l, () => { const set = new Set(prefs.languages || []); on ? set.delete(l) : set.add(l); prefs = { ...prefs, languages: [...set] }; setPrefs(uid, prefs); paint(); });
            c.setAttribute("aria-pressed", String(on));
            row.append(c);
          }
          listEl.append(row);
        }
      }
      body.append(listEl);
    };
    paint();
  }, () => { setPrefs(uid, { ...prefs, done: true }); opts.rerender?.(); });
}
