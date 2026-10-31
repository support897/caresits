// Caresitters v2 views (English only).
// Describe box, real map, real two-way messages, photo updates,
// the Me hub and the mode switch. Plain DOM, no framework.
import { canSendMessage } from "../accounts/account.js";
import { packById, packByName, checkFor, auJurisdiction } from "./countries.js";
import { paintFileImg } from "./files.js";
import { t as tr } from "./lang.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PARTS = [["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]];
const KINDS = ["Babysit", "Nanny", "After school", "Overnight", "Newborn", "Au pair"];

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function btn(cls, text, onClick) {
  const b = el("button", cls, text);
  b.type = "button";
  if (onClick) b.addEventListener("click", onClick);
  return b;
}
const me = () => window.CARESITS_ME || {};
const write = (k, p) => (typeof window.CARESITS_WRITE === "function" ? window.CARESITS_WRITE(k, p) : Promise.resolve({ ok: false, reason: "offline" }));
const nav = (n) => window.CARESITS_NAV && window.CARESITS_NAV(n);

export function role() {
  const m = me();
  if (["family", "career", "communicate"].includes(m.activeSide)) return m.activeSide;
  if (m.entryRole === "communicate" || m.side === "communicate") return "communicate";
  if (m.entryRole === "career" || m.side === "carer") return "career";
  return "family";
}

function lsKey(name) { return me().uid ? `caresits-v2-${name}-${me().uid}` : null; }
function lsGet(name) { try { const k = lsKey(name); return k ? JSON.parse(localStorage.getItem(k) || "null") : null; } catch { return null; } }
function lsSet(name, v) { try { const k = lsKey(name); if (k) localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } }

// ---- who is connected to me (live pairs) ----
export function livePairs() {
  const pc = window.CARESITS_PHASE_C || {};
  const uid = me().uid;
  return (pc.rels || []).filter((r) => ["contact", "hired"].includes(r.state)).map((r) => {
    const other = (r.members || []).find((m) => m !== uid) || "";
    return { id: r.id, other, name: (pc.names || {})[other] || (other === r.familyUid ? "Family" : "Carer"), familyUid: r.familyUid, carerUid: r.carerUid };
  });
}

// ---- small profile reader (photo, name, about), cached ----
const profCache = new Map();
export function profileOf(uid) {
  if (!uid) return Promise.resolve(null);
  if (profCache.has(uid)) return profCache.get(uid);
  const p = (async () => {
    try {
      const { fs, db } = window.CARESITS_DB || {};
      if (!fs) return null;
      const s = await fs.getDoc(fs.doc(db, "profiles", uid));
      return s.exists() ? s.data() : null;
    } catch { return null; }
  })();
  profCache.set(uid, p);
  return p;
}
export function avatar(name, url, cls = "v2Avatar") {
  const box = el("span", cls);
  if (url) { const img = el("img"); paintFileImg(img, url); img.alt = ""; box.append(img); }
  else box.textContent = (name || "?").trim().slice(0, 1).toUpperCase();
  return box;
}

// ---- the describe box (top of Find / Jobs) ----
export function composer(root, viewerDoc) {
  const r = role();
  const isFam = r !== "career";
  const saved = lsGet("need") || {};
  const text0 = saved.text != null ? saved.text : (viewerDoc && viewerDoc.about) || "";
  const state = { name: saved.name != null ? saved.name : ((viewerDoc && viewerDoc.displayName) || ""), text: text0, kinds: saved.kinds || [], days: saved.days || [], parts: saved.parts || [], aupair: saved.aupair || {}, postcode: saved.postcode || (viewerDoc && viewerDoc.postcode) || "", dates: Array.isArray(saved.dates) ? saved.dates : [] };
  const card = el("section", "v2Card v2Composer");
  const done = () => state.text.trim().length > 0;
  const render = (editing) => {
    card.replaceChildren();
    if (!editing && done()) {
      card.append(el("p", "v2Eyebrow", isFam ? "What you need" : "About you"));
      card.append(el("p", "v2About", state.text));
      const chips = el("div", "v2ChipRow");
      for (const k of state.kinds) chips.append(el("span", "v2Tag", k));
      if (state.days.length) chips.append(el("span", "v2Tag", state.days.join(" ")));
      if (isFam && state.postcode) chips.append(el("span", "v2Tag", "Postcode " + state.postcode));
      if (isFam) for (const d of state.dates) chips.append(el("span", "v2Tag", d));
      card.append(chips, btn("ghostBtn", "Edit", () => render(true)));
      return;
    }
    card.append(el("h2", "v2Title", isFam ? "What do you need?" : "Tell families about you"));
    card.append(el("p", "v2Sub", isFam ? "A few words is enough. Carers nearby will see it." : "A few words is enough. Families nearby will see it."));
    const nm = el("input", "txtIn v2Name"); nm.type = "text"; nm.maxLength = 40; nm.placeholder = "Your first name"; nm.value = state.name;
    nm.setAttribute("aria-label", "Your first name");
    nm.addEventListener("input", () => { state.name = nm.value; });
    const ta = el("textarea", "txtIn v2Text");
    ta.rows = 3; ta.maxLength = 300;
    ta.placeholder = isFam ? "Example: Babysitter for my 2 kids (3 and 5), Tuesday and Thursday after school." : "Example: Friendly babysitter, 4 years of experience, first aid trained, free after 3pm.";
    ta.value = state.text;
    ta.addEventListener("input", () => { state.text = ta.value; count.textContent = `${ta.value.length}/300`; });
    const count = el("p", "v2Count", `${ta.value.length}/300`);
    card.append(ta, count);
    card.append(el("p", "v2Label", isFam ? "What kind of help?" : "What can you do?"));
    const kinds = el("div", "v2ChipRow");
    for (const k of KINDS) {
      const b = btn("chipBtn" + (state.kinds.includes(k) ? " on" : ""), k, () => {
        state.kinds = state.kinds.includes(k) ? state.kinds.filter((x) => x !== k) : [...state.kinds, k];
        b.classList.toggle("on", state.kinds.includes(k));
      });
      kinds.append(b);
    }
    card.append(kinds);
    card.append(el("p", "v2Label", isFam ? "Which days do you need help?" : "Which days are you free?"));
    const days = el("div", "v2ChipRow");
    for (const d of DAYS) {
      const b = btn("chipBtn v2Day" + (state.days.includes(d) ? " on" : ""), d, () => {
        state.days = state.days.includes(d) ? state.days.filter((x) => x !== d) : [...state.days, d];
        b.classList.toggle("on", state.days.includes(d));
      });
      days.append(b);
    }
    card.append(days);
    const parts = el("div", "v2ChipRow");
    for (const [v, label] of PARTS) {
      const b = btn("chipBtn" + (state.parts.includes(v) ? " on" : ""), label, () => {
        state.parts = state.parts.includes(v) ? state.parts.filter((x) => x !== v) : [...state.parts, v];
        b.classList.toggle("on", state.parts.includes(v));
      });
      parts.append(b);
    }
    card.append(parts);
    if (isFam) {
      card.append(el("p", "v2Label", "Your postcode"));
      const pc = el("input", "txtIn v2Postcode"); pc.type = "text"; pc.inputMode = "numeric"; pc.maxLength = 4; pc.placeholder = "2031"; pc.value = state.postcode;
      pc.setAttribute("aria-label", "Your postcode");
      pc.addEventListener("input", () => { state.postcode = pc.value.replace(/\D/g, "").slice(0, 4); pc.value = state.postcode; });
      card.append(pc);
      card.append(el("p", "v2Label", "Specific dates (optional)"));
      const dateRow = el("div", "v2ChipRow");
      const renderDates = () => {
        dateRow.replaceChildren();
        for (const d of state.dates) {
          const chip = el("span", "v2Tag", d + "  ");
          const x = btn("chipX", "×", () => { state.dates = state.dates.filter((y) => y !== d); renderDates(); });
          x.setAttribute("aria-label", "Remove " + d);
          chip.append(x);
          dateRow.append(chip);
        }
      };
      renderDates();
      const din = el("input", "txtIn v2Date"); din.type = "date"; din.setAttribute("aria-label", "Add a date");
      const dadd = btn("ghostBtn", "Add date", () => { const v = din.value; if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !state.dates.includes(v) && state.dates.length < 14) { state.dates = [...state.dates, v].sort(); renderDates(); } din.value = ""; });
      card.append(din, dadd, dateRow);
    }
    card.append(nm);
    if (!isFam) card.append(auPairFields(state));
    const msg = el("p", "formMsg"); msg.setAttribute("role", "status");
    const save = btn("mainBtn", "Save", async () => {
      if (!state.text.trim()) { msg.textContent = "Write a few words first."; return; }
      save.disabled = true;
      const payload = { name: (state.name || "").trim(), text: state.text.trim(), kinds: state.kinds, days: state.days, parts: state.parts, postcode: isFam ? state.postcode : "", dates: isFam ? state.dates : [] };
      lsSet("need", payload);
      const a = await write("need", payload);
      const b = await write("about", { about: payload.text, name: payload.name });
      if (!isFam) { payload.aupair = cleanAuPair(state.aupair, state.kinds.includes("Au pair")); lsSet("need", payload); await write("aupair", { auPair: payload.aupair }); }
      save.disabled = false;
      if (!a || !a.ok) { msg.textContent = "Saved on this phone. Could not reach your account, try again later."; return; }
      if (!b || !b.ok) { msg.textContent = "Saved to your account. Others cannot see it yet."; }
      window.CARESITS_V2_REFRESH && window.CARESITS_V2_REFRESH();
      render(false);
      renderMyDays();
    });
    card.append(msg, save);
  };
  if (viewerDoc && done() && (viewerDoc.about !== state.text.trim() || (state.name && viewerDoc.displayName !== state.name.trim()))) write("about", { about: state.text.trim(), name: (state.name || "").trim() });
  render(!done() || !state.name);
  root.append(card);
}

// ---- Calendar tab: my days (week strip) ----
export function renderMyDays() {
  const host = document.getElementById("myDaysRoot");
  if (!host) return;
  host.replaceChildren();
  const r = role();
  if (r === "communicate" || !me().uid) return;
  const need = lsGet("need") || {};
  const card = el("section", "v2Card");
  card.append(el("h2", "v2Title", r === "career" ? "Days I am free" : "Days I need help"));
  const strip = el("div", "v2WeekStrip");
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const name = DAYS[(d.getDay() + 6) % 7];
    const on = (need.days || []).includes(name);
    const cell = el("div", "v2Cell" + (on ? " on" : ""));
    cell.append(el("span", "v2CellDay", name), el("span", "v2CellNum", String(d.getDate())));
    strip.append(cell);
  }
  card.append(strip);
  const parts = (need.parts || []).length ? need.parts.join(", ") : "any time";
  card.append(el("p", "v2Sub", (need.days || []).length ? `Marked days repeat every week. Times: ${parts}.` : "No days marked yet."));
  card.append(btn("ghostBtn", (need.days || []).length ? "Change days" : "Mark my days", () => { nav("find"); }));
  host.append(card);
}

// ---- real map (Leaflet, reused) ----
export function leafletMap(host, points, centre, onPick) {
  const L = window.L;
  if (!L || !points.length) return false;
  const box = el("div", "v2Map");
  host.append(box);
  const map = L.map(box, { zoomControl: true, attributionControl: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
  const icon = L.icon({ iconUrl: "vendor/leaflet/images/marker-icon.png", iconRetinaUrl: "vendor/leaflet/images/marker-icon-2x.png", shadowUrl: "vendor/leaflet/images/marker-shadow.png", iconSize: [25, 41], iconAnchor: [12, 41], shadowSize: [41, 41] });
  const bounds = [];
  for (const p of points) {
    const ll = [p.lat, p.lng];
    bounds.push(ll);
    L.marker(ll, { icon, title: p.name }).addTo(map).on("click", () => onPick(p));
  }
  if (centre) { bounds.push([centre.lat, centre.lng]); L.circleMarker([centre.lat, centre.lng], { radius: 7, color: "#1d4c43", fillColor: "#1d4c43", fillOpacity: 0.9 }).addTo(map); }
  map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
  setTimeout(() => map.invalidateSize(), 250);
  return true;
}

// ---- messages (real, two way) ----
let unsubChat = null;
let unsubPhotos = null;
function sub(pairId, cb) {
  const { fs, db } = window.CARESITS_DB || {};
  if (!fs || !pairId) return () => {};
  try {
    return fs.onSnapshot(fs.query(fs.collection(db, "relationships", pairId, "messages"), fs.orderBy("at")),
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => cb(null));
  } catch { return () => {}; }
}
async function sendMsg(pairId, data) {
  const { fs, db } = window.CARESITS_DB || {};
  if (!fs) return { ok: false, reason: "offline" };
  try {
    await fs.addDoc(fs.collection(db, "relationships", pairId, "messages"), { from: me().uid, at: fs.serverTimestamp(), ...data });
    return { ok: true };
  } catch (e) { return { ok: false, reason: String((e && e.code) || e) }; }
}
const ms = (m) => (m.at && m.at.toMillis ? m.at.toMillis() : Date.now());

function emptyState(root, title, body, cta, ctaNav) {
  root.replaceChildren();
  const box = el("div", "v2Card v2Empty");
  const img = el("img", "bunnyBig"); img.src = "bunny/bunny-rest-calm.png"; img.alt = "";
  box.append(img, el("h2", "v2Title", title), el("p", "v2Sub", body));
  if (cta) box.append(btn("mainBtn", cta, () => nav(ctaNav)));
  root.append(box);
}

let activePair = null;
function pickPair(root, rerender) {
  const pairs = livePairs();
  if (!pairs.length) return null;
  if (!activePair || !pairs.find((p) => p.id === activePair)) activePair = pairs[0].id;
  if (pairs.length > 1) {
    const row = el("div", "v2ChipRow");
    for (const p of pairs) row.append(btn("chipBtn" + (p.id === activePair ? " on" : ""), (unreadSet.has(p.id) && p.id !== activePair ? "\u25cf " : "") + p.name, () => { activePair = p.id; rerender(); }));
    root.append(row);
  }
  return pairs.find((p) => p.id === activePair);
}

async function refreshRels() {
  try {
    const dbx = window.CARESITS_DB; const uid = me().uid; const pc = window.CARESITS_PHASE_C;
    if (!dbx || !uid || !pc) return;
    const { fs, db } = dbx;
    const snap = await fs.getDocs(fs.query(fs.collection(db, "relationships"), fs.where("members", "array-contains", uid)));
    pc.rels = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    pc.names = pc.names || {};
    for (const r of pc.rels) {
      const other = (r.members || []).find((m) => m !== uid);
      if (other && !pc.names[other]) { const p = await profileOf(other); if (p && p.displayName) pc.names[other] = p.displayName; }
    }
  } catch { /* keep what we have */ }
}

function pendingRequests(root) {
  const pc = window.CARESITS_PHASE_C || {};
  const uid = me().uid;
  const rows = (pc.rels || []).filter((r) => r.state === "pending");
  if (!rows.length) return;
  const box = el("section", "v2Card v2Requests");
  box.append(el("h3", "v2Title", "Requests"));
  for (const r of rows) {
    const other = (r.members || []).find((m) => m !== uid) || "";
    const name = (pc.names || {})[other] || "Someone nearby";
    const mine = r.createdBy === uid;
    const row = el("div", "v2ReqRow");
    row.append(avatar(name, null), el("p", "v2ReqText", mine ? `Waiting for ${name} to reply` : `${name} wants to connect`));
    profileOf(other).then((p) => { if (p && p.photoUrl) row.firstChild.replaceWith(avatar(name, p.photoUrl)); });
    if (!mine) {
      row.append(btn("mainBtn", "Accept", async () => {
        const res = await write("transition", { pairId: r.id, patch: { state: "contact", contactBy: uid } });
        if (res && res.ok) { lastRelRefresh = 0; setTimeout(openMessages, 300); }
      }));
      row.append(btn("ghostBtn", "Not now", async () => { await write("transition", { pairId: r.id, patch: { state: "ended" } }); lastRelRefresh = 0; setTimeout(openMessages, 300); }));
    }
    box.append(row);
  }
  root.prepend(box);
}

let lastRelRefresh = 0;
export function openMessages() {
  const root = document.getElementById("threadRoot");
  if (!root) return;
  if (Date.now() - lastRelRefresh > 4000) { lastRelRefresh = Date.now(); refreshRels().then(() => { const s = document.getElementById("surface-thread"); if (s && !s.hidden) openMessages(); }); }
  if (unsubChat) { unsubChat(); unsubChat = null; }
  root.replaceChildren();
  const pairs = livePairs();
  if (!me().uid || !pairs.length) {
    const r = role();
    emptyState(root, "No messages yet", r === "communicate" ? "Messages open when you and your carer or family are connected." : (r === "career" ? "Message a family from the Jobs tab. Your chats show up here." : "Message a carer from the Find tab. Your chats show up here."), role() === "communicate" ? null : "Find people", "find");
    pendingRequests(root);
    return;
  }
  root.append(el("h2", "findTitle", "Messages"));
  const pair = pickPair(root, openMessages);
  const head = el("div", "v2ChatHead");
  head.append(avatar(pair.name, null), el("strong", null, pair.name));
  profileOf(pair.other).then((p) => { if (p && p.photoUrl) { head.replaceChildren(avatar(pair.name, p.photoUrl), el("strong", null, pair.name)); } });
  const revHost = el("div", "v2RevHost");
  head.append(btn("ghostBtn v2RevBtn", "Review", () => { if (!revHost.firstChild) revHost.append(reviewForm(pair.other, pair.name, () => {})); }));
  const list = el("div", "v2Chat");
  const note = el("p", "formMsg"); note.setAttribute("role", "status");
  const input = el("textarea", "txtIn"); input.rows = 2; input.placeholder = "Write a message";
  let latest = [];
  const send = btn("mainBtn", "Send", async () => {
    const text = input.value.trim();
    if (!text) return;
    const todayN = latest.filter((m) => m.from === me().uid && m.kind !== "photo" && new Date(ms(m)).toDateString() === new Date().toDateString()).length;
    if (!canSendMessage({ plan: window.CARESITS_PLAN, tasteUsedToday: todayN })) { window.CARESITS_OPEN_PLANS && window.CARESITS_OPEN_PLANS("plus"); return; }
    send.disabled = true;
    const res = await sendMsg(pair.id, { kind: "text", text });
    send.disabled = false;
    if (res.ok) { input.value = ""; note.textContent = ""; }
    else note.textContent = "Could not send. Check your connection and try again.";
  });
  root.append(head, revHost, list, el("div", "v2Compose").appendChild(input) && input, send, note);
  unsubChat = sub(pair.id, (msgs) => {
    if (msgs && msgs.length) { markSeen(pair.id, Math.max(...msgs.map(ms))); paintUnread(); }
    if (msgs == null) { list.replaceChildren(el("p", "v2Sub", "Messages could not load. Check your connection.")); return; }
    latest = msgs;
    list.replaceChildren();
    const shown = msgs.filter((m) => m.kind !== "photoAsk");
    if (!shown.length) list.append(el("p", "v2Sub", "Say hello."));
    for (const m of shown) {
      const row = el("div", "msgRow " + (m.from === me().uid ? "mine" : "theirs"));
      if (m.img) { const im = el("img", "v2ChatImg"); im.src = m.img; im.alt = "Photo"; row.append(im); }
      if (m.text) row.append(el("p", "msgText", m.text));
      list.append(row);
    }
    list.scrollTop = list.scrollHeight;
  });
}

// ---- photo updates ----
async function fileToDataUrl(file) {
  const bmp = await createImageBitmap(file);
  let max = 900; let q = 0.72;
  for (let i = 0; i < 5; i++) {
    const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * sc)); c.height = Math.max(1, Math.round(bmp.height * sc));
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const u = c.toDataURL("image/jpeg", q);
    if (u.length <= 380000) return u;
    max = Math.round(max * 0.75); q = Math.max(0.5, q - 0.07);
  }
  throw new Error("too-big");
}

export function openPhotos() {
  const root = document.getElementById("photosRoot");
  if (!root) return;
  if (unsubPhotos) { unsubPhotos(); unsubPhotos = null; }
  root.replaceChildren();
  root.append(el("h2", "findTitle", "Photo updates"));
  const pairs = livePairs();
  if (!me().uid || !pairs.length) {
    emptyState(root, "Photos from your carer", "When you are connected, your carer can send a photo of the kids here, and you can ask for one any time.", null);
    return;
  }
  const pair = pickPair(root, openPhotos);
  const ask = el("div", "v2AskBox");
  const grid = el("div", "v2PhotoGrid");
  const note = el("p", "formMsg"); note.setAttribute("role", "status");
  const file = el("input"); file.type = "file"; file.accept = "image/*"; file.hidden = true;
  file.addEventListener("change", async () => {
    const f = file.files && file.files[0];
    file.value = "";
    if (!f) return;
    note.textContent = "Sending photo...";
    try {
      const img = await fileToDataUrl(f);
      const res = await sendMsg(pair.id, { kind: "photo", text: "", img });
      note.textContent = res.ok ? "Photo sent." : "Could not send the photo. Try again.";
    } catch { note.textContent = "That photo is too big. Try another one."; }
  });
  const actions = el("div", "v2BtnRow");
  actions.append(btn("mainBtn", "Send a photo", () => file.click()), btn("ghostBtn", "Ask for a photo", async () => {
    const res = await sendMsg(pair.id, { kind: "photoAsk", text: "Could you send a photo of the kids?" });
    note.textContent = res.ok ? `Asked ${pair.name} for a photo.` : "Could not send. Try again.";
  }));
  root.append(ask, actions, file, note, grid);
  unsubPhotos = sub(pair.id, (msgs) => {
    if (msgs == null) { grid.replaceChildren(el("p", "v2Sub", "Photos could not load. Check your connection.")); return; }
    const photos = msgs.filter((m) => m.kind === "photo" && m.img).reverse();
    const lastAsk = [...msgs].reverse().find((m) => m.kind === "photoAsk");
    const lastPhotoMine = [...msgs].reverse().find((m) => m.kind === "photo" && m.from === me().uid);
    ask.replaceChildren();
    if (lastAsk && lastAsk.from !== me().uid && (!lastPhotoMine || ms(lastPhotoMine) < ms(lastAsk))) {
      const c = el("div", "v2Card v2AskCard");
      c.append(el("p", "v2Title", `${pair.name} would love a photo`), btn("mainBtn", "Send a photo", () => file.click()));
      ask.append(c);
    }
    grid.replaceChildren();
    if (!photos.length) grid.append(el("p", "v2Sub", "No photos yet."));
    for (const m of photos) {
      const fig = el("figure", "v2Photo");
      const im = el("img"); im.src = m.img; im.alt = "Photo update";
      const when = new Date(ms(m)).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      fig.append(im, el("figcaption", null, `${m.from === me().uid ? "You" : pair.name} · ${when}`));
      grid.append(fig);
    }
  });
}

// ---- mode cards (also used in Settings) ----
export function modeCards(root) {
  const current = role();
  const wrap = el("section", "v2Card v2Modes");
  wrap.append(el("h2", "v2Title", "App mode"));
  wrap.append(el("p", "v2Sub", "Pick how you use Caresitters. The whole app changes to fit."));
  const defs = [
    ["family", "Find a carer", "Say what you need, see carers near you on a map, and message them."],
    ["career", "Find families", "See families near you who need help, and tell them about you."],
    ["communicate", "Stay connected", "Already have a carer or family? One shared calendar, fun daily activities picked for your kids' ages and interests, and photo updates. All in one place."],
  ];
  const status = el("p", "formMsg"); status.setAttribute("role", "status");
  for (const [side, title, body] of defs) {
    const b = el("button", "v2ModeBtn" + (side === current ? " on" : ""));
    b.type = "button";
    b.setAttribute("aria-pressed", String(side === current));
    b.append(el("strong", null, title), el("span", null, body));
    b.addEventListener("click", async () => {
      if (side === role()) return;
      status.textContent = "Switching...";
      const ok = window.CARESITS_SET_ACTIVE_SIDE ? await window.CARESITS_SET_ACTIVE_SIDE(side) : false;
      status.textContent = ok ? "" : "Could not switch. Check your connection.";
      if (ok) { renderMe(); }
    });
    wrap.append(b);
  }
  wrap.append(status);
  root.append(wrap);
}

// ---- Me hub ----
export function renderMe() {
  const root = document.getElementById("meRoot");
  if (!root) return;
  root.replaceChildren();
  const m = me();
  const head = el("div", "v2MeHead");
  head.append(avatar(m.name, null, "v2Avatar big"), el("div", null));
  head.lastChild.append(el("strong", null, m.name || "Welcome"), el("span", "v2Sub", role() === "communicate" ? "Staying connected" : role() === "career" ? "Finding families" : "Finding a carer"));
  root.append(head);
  modeCards(root);
  const rows = [["profile", "My profile"], ["questionnaire", "My answers"], ["checks", "Checks and trust"], ["reviews", "Reviews"]];
  if (role() !== "career") rows.push(["children", "My children"], ["emergency", "Emergency contact"], ["daystory", "Day story"]);
  rows.push(["settings", "Settings"], ["help", "Help"], ["privacy", "Privacy policy"], ["bin", "Recently deleted"]);
  const list = el("div", "v2List");
  for (const [n, label] of rows) list.append(btn("v2Row", label, () => nav(n)));
  root.append(list);
}

// ---- wiring ----
window.CARESITS_V2 = { composer, leafletMap, renderMyDays, renderMe, modeCards, profileOf, avatar, role, livePairs };
window.CARESITS_THREAD_OPEN = openMessages;
window.CARESITS_THREAD_RENDER = () => { const s = document.getElementById("surface-thread"); if (s && !s.hidden) openMessages(); };
window.CARESITS_PHOTOS_OPEN = openPhotos;
window.CARESITS_ME_OPEN = renderMe;
async function resaveProfileIfMissing() {
  // The questionnaire keeps answers on the phone if the first save fails.
  // On every sign in, if the account has no profile yet, save them again.
  try {
    const uid = window.CARESITS_UID; const dbx = window.CARESITS_DB;
    if (!uid || !dbx) return;
    const snap = await dbx.fs.getDoc(dbx.fs.doc(dbx.db, "profiles", uid));
    if (snap.exists()) return;
    let b = null;
    for (const base of ["caresits-app2-questionnaire", "caresits-app2-draft"]) {
      try { const raw = localStorage.getItem(`${base}-${uid}`); const j = raw && JSON.parse(raw); if (j && j.answers && j.answers.postcode && j.side) { b = j; break; } } catch { /* skip */ }
    }
    if (b && typeof window.CARESITS_SAVE === "function") { await window.CARESITS_SAVE(b); window.CARESITS_FIND_REFRESH && window.CARESITS_FIND_REFRESH(); }
  } catch { /* try again next time */ }
}
document.addEventListener("caresits-account-ready", () => {
  renderMyDays();
  window.CARESITS_FIND_REFRESH && setTimeout(() => window.CARESITS_FIND_REFRESH(), 400);
  setTimeout(resaveProfileIfMissing, 2500);
});
const meBtn = document.getElementById("meBtn");
if (meBtn) meBtn.addEventListener("click", () => nav("me"));

// A calm word while the account loads, instead of a blank page.
{
  const r = document.getElementById("findRoot");
  if (r && !r.children.length) { const p = document.createElement("p"); p.className = "v2Loading"; p.textContent = "Loading your space…"; r.append(p); }
}


// ---- saved people (hearts) ----
let favSet = null;
function favKey() { return me().uid ? `caresits-v2-favs-${me().uid}` : null; }
export function favs() {
  if (favSet) return favSet;
  let arr = [];
  try { const k = favKey(); arr = k ? JSON.parse(localStorage.getItem(k) || "[]") : []; } catch { arr = []; }
  favSet = new Set(arr);
  const dbx = window.CARESITS_DB;
  if (dbx && me().uid) dbx.fs.getDoc(dbx.fs.doc(dbx.db, "users", me().uid, "meta", "favs")).then((s) => { if (s.exists() && Array.isArray(s.data().uids)) { for (const u of s.data().uids) favSet.add(u); try { localStorage.setItem(favKey(), JSON.stringify([...favSet])); } catch { /* full */ } } }).catch(() => {});
  return favSet;
}
export function toggleFav(uid) {
  const f = favs();
  if (f.has(uid)) f.delete(uid); else f.add(uid);
  try { localStorage.setItem(favKey(), JSON.stringify([...f])); } catch { /* full */ }
  write("favs", { uids: [...f] });
  return f.has(uid);
}
export function heartButton(uid) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "v2Heart";
  const paint = (on) => { b.textContent = on ? "\u2665" : "\u2661"; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", on ? "Remove from saved" : "Save for later"); };
  paint(favs().has(uid));
  b.addEventListener("click", (e) => { e.stopPropagation(); paint(toggleFav(uid)); });
  return b;
}
Object.assign(window.CARESITS_V2, { favs, toggleFav, heartButton });

// ---- reviews and references ----
const SITE_BASE = "https://support897.github.io/caresits/";
const starText = (n) => "\u2605".repeat(n) + "\u2606".repeat(5 - n);
function tsMs(t) { return t && t.toMillis ? t.toMillis() : 0; }

export async function loadReviews(uid) {
  const dbx = window.CARESITS_DB;
  if (!dbx || !uid) return [];
  try {
    const snap = await dbx.fs.getDocs(dbx.fs.collection(dbx.db, "profiles", uid, "reviews"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => tsMs(b.at) - tsMs(a.at));
  } catch { return []; }
}

export async function reviewsInto(box, uid) {
  box.replaceChildren(el("p", "v2Sub", "Loading reviews..."));
  const list = await loadReviews(uid);
  box.replaceChildren();
  if (!list.length) { box.append(el("p", "v2Sub", "No reviews yet.")); return; }
  const avg = list.reduce((s, r) => s + (r.stars || 0), 0) / list.length;
  box.append(el("p", "v2RevSum", `${starText(Math.round(avg))}  ${avg.toFixed(1)} (${list.length})`));
  for (const r of list.slice(0, 6)) {
    const row = el("div", "v2Rev");
    row.append(el("p", "v2RevStars", starText(r.stars || 0)));
    if (r.text) row.append(el("p", "v2RevText", r.text));
    const by = r.kind === "link"
      ? `${r.name || "Someone"}${r.relation ? ", " + r.relation : ""} \u00b7 reference from a link (not checked by Caresitters)`
      : "A Caresitters member they connected with";
    row.append(el("p", "v2RevBy", by));
    box.append(row);
  }
}

export function reviewForm(otherUid, otherName, onDone) {
  const card = el("section", "v2Card v2ReviewForm");
  card.append(el("h3", "v2Title", `Review ${otherName || "them"}`));
  let stars = 0;
  const row = el("div", "v2StarRow");
  for (let i = 1; i <= 5; i++) {
    const b = btn("v2StarBtn", "\u2605", () => { stars = i; [...row.children].forEach((c, k) => c.classList.toggle("on", k < i)); });
    b.setAttribute("aria-label", `${i} star${i > 1 ? "s" : ""}`);
    row.append(b);
  }
  const ta = el("textarea", "txtIn"); ta.rows = 3; ta.maxLength = 500; ta.placeholder = "A few honest words. Be kind and fair.";
  const msg = el("p", "formMsg"); msg.setAttribute("role", "status");
  const send = btn("mainBtn", "Post review", async () => {
    if (!stars) { msg.textContent = "Tap the stars first."; return; }
    const text = ta.value.trim();
    if (text.length < 5) { msg.textContent = "Please write a few words."; return; }
    send.disabled = true;
    const { fs, db } = window.CARESITS_DB;
    try {
      const ref = fs.doc(db, "profiles", otherUid, "reviews", me().uid);
      try { await fs.deleteDoc(ref); } catch { /* none yet */ }
      await fs.setDoc(ref, { from: me().uid, kind: "app", stars, text, at: fs.serverTimestamp() });
      card.replaceChildren(el("p", "v2Sub", "Thank you. Your review is posted."));
      onDone && onDone();
    } catch { send.disabled = false; msg.textContent = "Could not post. Try again."; }
  });
  card.append(row, ta, msg, send, btn("ghostBtn", "Cancel", () => card.remove()));
  return card;
}

async function askReference(note) {
  const dbx = window.CARESITS_DB;
  if (!dbx || !me().uid) return;
  const alpha = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const token = [...bytes].map((b) => alpha[b % alpha.length]).join("");
  try {
    await dbx.fs.setDoc(dbx.fs.doc(dbx.db, "profiles", me().uid, "refInvites", token), { at: dbx.fs.serverTimestamp() });
  } catch { note.textContent = "Could not make a link. Finish your profile first, then try again."; return; }
  const link = `${SITE_BASE}app2/reference.html?c=${encodeURIComponent(me().uid)}&t=${token}&n=${encodeURIComponent(me().name || "")}`;
  const text = `Hi! Could you write a short reference for me on Caresitters? It takes one minute, no account needed: ${link}`;
  try {
    if (navigator.share) { await navigator.share({ text }); note.textContent = "Link shared. It works once."; return; }
  } catch { /* user closed the sheet; fall through to copy */ }
  try { await navigator.clipboard.writeText(text); note.textContent = "Link copied. Paste it in a message. It works once."; }
  catch { note.textContent = link; }
}

function addMeReferences() {
  const root = document.getElementById("meRoot");
  if (!root || root.querySelector(".v2RefBlock")) return;
  const box = el("section", "v2Card v2RefBlock");
  box.append(el("h3", "v2Title", "Reviews and references"));
  box.append(el("p", "v2Sub", "Ask someone you worked for before to write a short reference. They get a link. No app needed."));
  const note = el("p", "formMsg"); note.setAttribute("role", "status");
  box.append(btn("mainBtn", "Send a reference link", () => askReference(note)), note);
  const mine = el("div", "v2RevList");
  box.append(mine);
  root.prepend(box);
  root.insertBefore(box, root.children[2] || null);
  reviewsInto(mine, me().uid);
}

// ---- au pair details (carer) and chips ----
export const AUPAIR_ENGLISH = ["Basic", "Good", "Fluent"];
export function auPairFields(state, card) {
  const wrap = el("details", "v2AuPair");
  wrap.append(el("summary", null, "Au pair details (optional)"));
  const a = state.aupair;
  const months = [];
  const d0 = new Date();
  for (let i = 0; i < 12; i++) { const d = new Date(d0.getFullYear(), d0.getMonth() + i, 1); months.push([`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, d.toLocaleString("en", { month: "short", year: "numeric" })]); }
  const sel = (label, opts, key) => {
    const l = el("label", "v2Field"); l.append(el("span", "v2Label", label));
    const s = el("select", "txtIn");
    for (const [v, t] of [["", "Choose"], ...opts]) { const o = el("option", null, t); o.value = v; s.append(o); }
    s.value = a[key] || ""; s.addEventListener("change", () => { a[key] = s.value; });
    l.append(s); return l;
  };
  const country = el("input", "txtIn"); country.maxLength = 40; country.placeholder = "Home country"; country.value = a.homeCountry || "";
  country.addEventListener("input", () => { a.homeCountry = country.value; });
  const cl = el("label", "v2Field"); cl.append(el("span", "v2Label", "Home country"), country);
  const chk = (label, key) => {
    const l = el("label", "v2Check"); const c = el("input"); c.type = "checkbox"; c.checked = !!a[key];
    c.addEventListener("change", () => { a[key] = c.checked; });
    l.append(c, document.createTextNode(" " + label)); return l;
  };
  wrap.append(sel("Can arrive from", months, "arrival"), cl, sel("English level", AUPAIR_ENGLISH.map((x) => [x, x]), "english"), chk("Qualified to care for babies", "infant"), chk("Drives", "drives"), chk("Swims", "swim"));
  wrap.append(el("p", "v2Sub", tr("find.auPairNote")));
  return wrap;
}
export function cleanAuPair(a, on) {
  return { on: !!on, arrival: String(a.arrival || "").slice(0, 7), homeCountry: String(a.homeCountry || "").trim().slice(0, 40), english: AUPAIR_ENGLISH.includes(a.english) ? a.english : "", infant: !!a.infant, drives: !!a.drives, swim: !!a.swim };
}
Object.assign(window.CARESITS_V2, { loadReviews, reviewsInto, reviewForm, auPairFields, cleanAuPair, AUPAIR_ENGLISH });
{
  const baseMe = renderMe;
  window.CARESITS_ME_OPEN = () => { baseMe(); addMeReferences(); };
}

// ---- free manual verification (Blue Card, checked by hand) ----
window.CARESITS_VERIFIED = window.CARESITS_VERIFIED || {};
async function loadVerified() {
  const dbx = window.CARESITS_DB; if (!dbx) return;
  try {
    const snap = await dbx.fs.getDocs(dbx.fs.collection(dbx.db, "verified"));
    const m = {}; snap.docs.forEach((d) => { m[d.id] = d.data(); });
    window.CARESITS_VERIFIED = m;
    window.CARESITS_FIND_REFRESH && window.CARESITS_FIND_REFRESH();
  } catch { /* badge just does not show */ }
}
// What the viewer's own country calls the check, and where to look it up.
function myCheckFacts() {
  const m = window.CARESITS_ME || {};
  const pack = packByName(m.country || "");
  if (!pack) return null;
  const facts = checkFor(pack, m.postcode || (window.CARESITS_TRUST && window.CARESITS_TRUST.me && window.CARESITS_TRUST.me.postcode)) || {};
  const j = pack.id === "AU" ? auJurisdiction(m.postcode || "") : null;
  return { pack, facts, code: pack.id + (j ? "-" + j.id : "") };
}
function addMeVerify() {
  const root = document.getElementById("meRoot");
  if (!root || root.querySelector(".v2VerBlock")) return;
  if ((window.CARESITS_ME || {}).side === "family") return; // checks are for carers
  const dbx = window.CARESITS_DB; const uid = me().uid;
  const box = el("section", "v2Card v2VerBlock");
  box.append(el("h3", "v2Title", "Get verified (free)"));
  const body = el("div", null); box.append(body);
  root.insertBefore(box, root.children[2] || null);
  const paint = async () => {
    body.replaceChildren();
    const cf = myCheckFacts();
    const checkName = cf && cf.facts.name ? cf.facts.name : "working with children check";
    let ver = null, req = null;
    try { const v = await dbx.fs.getDoc(dbx.fs.doc(dbx.db, "verified", uid)); ver = v.exists() ? v.data() : null; } catch { /* none */ }
    if (ver) { body.append(el("p", "v2RevSum", `\u2713 Verified: ${ver.check || checkName} checked by Caresitters`)); return; }
    try { const r = await dbx.fs.getDoc(dbx.fs.doc(dbx.db, "verifyRequests", uid)); req = r.exists() ? r.data() : null; } catch { /* none */ }
    if (req) { body.append(el("p", "v2Sub", "We got your request. We check it by hand. This can take a few days. It costs you nothing.")); body.append(btn("ghostBtn", "Cancel request", async () => { try { await dbx.fs.deleteDoc(dbx.fs.doc(dbx.db, "verifyRequests", uid)); } catch { /* ignore */ } paint(); })); return; }
    body.append(el("p", "v2Sub", `Add your ${checkName}${cf && cf.facts.place ? " (" + cf.facts.place + ")" : ""}. We check it is real${cf && cf.facts.register ? " on the free official register" : " by looking at your document"}, then show a Verified badge on your profile. Getting verified with Caresitters is always free.`));
    if (cf && cf.facts.costText) body.append(el("p", "v2Sub", "The government check itself: " + cf.facts.costText));
    if (cf && cf.facts.checkUrl) { const a = el("a", null, "Where to apply or check (official site)"); a.href = cf.facts.checkUrl; a.target = "_blank"; a.rel = "noopener"; body.append(a); }
    const nm = el("input", "txtIn"); nm.placeholder = "Full name on the card"; nm.maxLength = 60; nm.value = me().name || "";
    const no = el("input", "txtIn"); no.placeholder = "Card or certificate number"; no.maxLength = 22;
    const ex = el("input", "txtIn"); ex.type = "date"; ex.setAttribute("aria-label", "Expiry date, if it has one");
    const msg = el("p", "formMsg"); msg.setAttribute("role", "status");
    const go = btn("mainBtn", "Ask to be verified", async () => {
      if (!nm.value.trim() || !no.value.trim()) { msg.textContent = "Fill in your name and the number."; return; }
      go.disabled = true;
      try {
        const tag = (cf ? cf.code : "XX") + " ";
        await dbx.fs.setDoc(dbx.fs.doc(dbx.db, "verifyRequests", uid), { kind: "bluecard", number: (tag + no.value.trim()).slice(0, 30), expiry: ex.value || "", name: nm.value.trim(), state: "pending", at: dbx.fs.serverTimestamp() });
        paint();
      } catch { go.disabled = false; msg.textContent = "Could not send. Try again."; }
    });
    body.append(nm, no, el("p", "v2Label", "Expiry date (leave empty if it has none)"), ex, msg, go, el("p", "v2Sub", "Only you and the Caresitters team can see these details."));
  };
  paint();
}
async function addMeAdmin() {
  const root = document.getElementById("meRoot"); const dbx = window.CARESITS_DB;
  if (!root || !dbx || root.querySelector(".v2AdminBlock")) return;
  let docs;
  try { docs = (await dbx.fs.getDocs(dbx.fs.collection(dbx.db, "verifyRequests"))).docs; } catch { return; } // only the admin can list
  if (root.querySelector(".v2AdminBlock")) return;
  const box = el("section", "v2Card v2AdminBlock");
  box.append(el("h3", "v2Title", `Verify requests (${docs.length})`));
  if (!docs.length) box.append(el("p", "v2Sub", "None waiting."));
  for (const d of docs) {
    const r = d.data(); const row = el("div", "v2Rev");
    const mm = /^([A-Z]{2})(?:-([A-Za-z]+))? /.exec(r.number || "");
    const rp = mm ? packById(mm[1]) : null;
    const rj = rp && mm[2] && rp.jurisdictions ? rp.jurisdictions.find((j) => j.id === mm[2]) : null;
    const rname = (rj && rj.checkName) || (rp && rp.checkName) || "check";
    const rurl = (rj && rj.checkUrl) || (rp && rp.checkUrl) || "";
    row.append(el("p", "v2RevText", `${r.name} \u00b7 ${r.number} \u00b7 expires ${r.expiry || "none"}`));
    row.append(el("p", "v2RevBy", `Check it: ${rname}${rurl ? " at " + rurl : ""}, then Approve.`));
    row.append(btn("mainBtn", "Approve", async () => {
      await dbx.fs.setDoc(dbx.fs.doc(dbx.db, "verified", d.id), { level: "checked", check: rname, expiry: r.expiry || "", at: dbx.fs.serverTimestamp() });
      await dbx.fs.deleteDoc(dbx.fs.doc(dbx.db, "verifyRequests", d.id)); row.remove(); loadVerified();
    }), btn("ghostBtn", "Reject", async () => { await dbx.fs.deleteDoc(dbx.fs.doc(dbx.db, "verifyRequests", d.id)); row.remove(); }));
    box.append(row);
  }
  root.insertBefore(box, root.children[2] || null);
}
{
  const prev = window.CARESITS_ME_OPEN;
  window.CARESITS_ME_OPEN = () => { prev(); addMeVerify(); addMeAdmin(); };
}
document.addEventListener("caresits-account-ready", () => setTimeout(loadVerified, 1200));

// ---- invite a friend (growth: more people nearby = better matches) ----
{
  const prev = window.CARESITS_ME_OPEN;
  window.CARESITS_ME_OPEN = () => {
    prev();
    const root = document.getElementById("meRoot");
    if (!root || root.querySelector(".v2InviteRow")) return;
    const row = btn("v2Row v2InviteRow", "Invite a friend to Caresitters", async () => {
      const text = "Find trusted nannies, babysitters and au pairs near you on Caresitters: https://apps.apple.com/app/id6823577907";
      try { if (navigator.share) { await navigator.share({ text }); return; } } catch { return; }
      try { await navigator.clipboard.writeText(text); row.textContent = "Link copied"; } catch { /* ignore */ }
    });
    const list = root.querySelector(".v2List");
    (list || root).prepend(row);
  };
}

// ---- unread dots (Messages tab + chat chips) ----
const unreadSet = new Set();
let pendingIn = 0;
const seenKey = (id) => `caresits-seen-${me().uid}-${id}`;
function markSeen(id, t) { try { localStorage.setItem(seenKey(id), String(t || Date.now())); unreadSet.delete(id); } catch { /* ignore */ } }
function paintUnread() {
  const on = unreadSet.size > 0 || pendingIn > 0;
  document.querySelectorAll("#bottomNav button").forEach((b) => {
    if (/messages/i.test(b.textContent) || b.dataset.nav === "thread") b.classList.toggle("hasDot", on);
  });
}
async function checkUnread() {
  const dbx = window.CARESITS_DB; const uid = me().uid;
  if (!dbx || !uid || document.visibilityState === "hidden") return;
  const pc = window.CARESITS_PHASE_C || {};
  pendingIn = (pc.rels || []).filter((r) => r.state === "waiting" && r.askedBy && r.askedBy !== uid).length;
  for (const p of livePairs()) {
    try {
      const snap = await dbx.fs.getDocs(dbx.fs.query(dbx.fs.collection(dbx.db, "relationships", p.id, "messages"), dbx.fs.orderBy("at", "desc"), dbx.fs.limit(1)));
      const last = snap.docs[0] && snap.docs[0].data();
      if (!last || last.from === uid || !last.at || !last.at.toMillis) { unreadSet.delete(p.id); continue; }
      const seen = Number(localStorage.getItem(seenKey(p.id)) || 0);
      if (last.at.toMillis() > seen) unreadSet.add(p.id); else unreadSet.delete(p.id);
    } catch { /* try next time */ }
  }
  paintUnread();
}
document.addEventListener("caresits-account-ready", () => setTimeout(checkUnread, 3500));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkUnread(); });
setInterval(checkUnread, 90000);
window.CARESITS_CHECK_UNREAD = checkUnread;
