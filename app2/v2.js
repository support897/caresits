// Caresitters v2 views (English only).
// Describe box, real map, real two-way messages, photo updates,
// the Me hub and the mode switch. Plain DOM, no framework.
import { canSendMessage } from "../accounts/account.js";

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
    return { id: r.id, other, name: (pc.names || {})[other] || "Your match", familyUid: r.familyUid, carerUid: r.carerUid };
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
  if (url) { const img = el("img"); img.src = url; img.alt = ""; box.append(img); }
  else box.textContent = (name || "?").trim().slice(0, 1).toUpperCase();
  return box;
}

// ---- the describe box (top of Find / Jobs) ----
export function composer(root, viewerDoc) {
  const r = role();
  const isFam = r !== "career";
  const saved = lsGet("need") || {};
  const text0 = saved.text != null ? saved.text : (viewerDoc && viewerDoc.about) || "";
  const state = { text: text0, kinds: saved.kinds || [], days: saved.days || [], parts: saved.parts || [] };
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
      card.append(chips, btn("ghostBtn", "Edit", () => render(true)));
      return;
    }
    card.append(el("h2", "v2Title", isFam ? "What do you need?" : "Tell families about you"));
    card.append(el("p", "v2Sub", isFam ? "A few words is enough. Carers nearby will see it." : "A few words is enough. Families nearby will see it."));
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
    const msg = el("p", "formMsg"); msg.setAttribute("role", "status");
    const save = btn("mainBtn", "Save", async () => {
      if (!state.text.trim()) { msg.textContent = "Write a few words first."; return; }
      save.disabled = true;
      const payload = { text: state.text.trim(), kinds: state.kinds, days: state.days, parts: state.parts };
      lsSet("need", payload);
      const a = await write("need", payload);
      const b = await write("about", { about: payload.text });
      save.disabled = false;
      if (!a || !a.ok) { msg.textContent = "Saved on this phone. Could not reach your account, try again later."; return; }
      if (!b || !b.ok) { msg.textContent = "Saved to your account. Others cannot see it yet."; }
      window.CARESITS_V2_REFRESH && window.CARESITS_V2_REFRESH();
      render(false);
      renderMyDays();
    });
    card.append(msg, save);
  };
  render(!done());
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
    for (const p of pairs) row.append(btn("chipBtn" + (p.id === activePair ? " on" : ""), p.name, () => { activePair = p.id; rerender(); }));
    root.append(row);
  }
  return pairs.find((p) => p.id === activePair);
}

export function openMessages() {
  const root = document.getElementById("threadRoot");
  if (!root) return;
  if (unsubChat) { unsubChat(); unsubChat = null; }
  root.replaceChildren();
  const pairs = livePairs();
  if (!me().uid || !pairs.length) {
    const r = role();
    emptyState(root, "No messages yet", r === "communicate" ? "Messages open when you and your carer or family are connected." : (r === "career" ? "Message a family from the Jobs tab. Your chats show up here." : "Message a carer from the Find tab. Your chats show up here."), role() === "communicate" ? null : "Find people", "find");
    return;
  }
  root.append(el("h2", "findTitle", "Messages"));
  const pair = pickPair(root, openMessages);
  const head = el("div", "v2ChatHead");
  head.append(avatar(pair.name, null), el("strong", null, pair.name));
  profileOf(pair.other).then((p) => { if (p && p.photoUrl) { head.replaceChildren(avatar(pair.name, p.photoUrl), el("strong", null, pair.name)); } });
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
  root.append(head, list, el("div", "v2Compose").appendChild(input) && input, send, note);
  unsubChat = sub(pair.id, (msgs) => {
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
document.addEventListener("caresits-account-ready", () => { renderMyDays(); });
const meBtn = document.getElementById("meBtn");
if (meBtn) meBtn.addEventListener("click", () => nav("me"));
