// Caresitters app2 — Find for the au pair world (31 Oct 2026).
// Au pairs see host families in the countries they picked, on a world
// map and in a list. Host families see au pairs who want their country.
// The nanny Find (find.js) is untouched: it never shows these cards.
import { unpackAuPair, auPairFit, countryByCode, countryPoint, ymToMonth } from "./tracks.js";
import { paintFileImg } from "./files.js";

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
export const docAuTrack = (doc) => unpackAuPair(doc && doc.card && doc.card.auPair).track;
export const viewerIsAuPairWorld = (doc) => { const t = docAuTrack(doc); return t === "aupair" || t === "host"; };

let mapCountry = "";

function factsOf(doc) {
  const u = unpackAuPair(doc.card && doc.card.auPair);
  return { ...u, uid: doc.uid };
}
const list = (a) => (Array.isArray(a) ? a.filter(Boolean) : []);

function detailLines(doc, u) {
  const c = doc.card || {};
  const L = [];
  if (u.track === "aupair") {
    if (c.age) L.push(`Age: ${c.age}`);
    if (u.country) L.push(`From: ${u.country}`);
    if (list(c.languages).length) L.push(`Languages: ${list(c.languages).join(", ")}`);
    if (u.english) L.push(`English: ${u.english}`);
    L.push(u.worldwide ? "Wants to go: anywhere in the world" : `Wants to go to: ${u.dest.map((d) => (countryByCode(d) || {}).name || d).join(", ") || "not set"}`);
    if (u.ym) L.push(`Can arrive from: ${ymToMonth(u.ym)}`);
    if (u.stay) L.push(`Can stay: ${u.stay} months`);
    const exp = Object.entries(c.experience || {}).filter(([, v]) => v);
    if (exp.length) L.push("Experience: " + exp.map(([b, y]) => `${y} yr with ages ${b}`).join(", "));
    L.push(u.infant ? "Has looked after a baby" : "Has not looked after a baby");
    L.push(u.swim ? "Can swim" : "Cannot swim yet");
    if (u.drives) L.push("Drives");
  } else {
    if (u.country) L.push(`Lives in: ${u.country}`);
    if (list(c.childrenBands).length) L.push(`Children's ages: ${list(c.childrenBands).join(", ")}`);
    if (list(c.languages).length) L.push(`Languages at home: ${list(c.languages).join(", ")}`);
    if (u.hours) L.push(`Hours a week: ${u.hours}`);
    L.push(u.room ? "Au pair has a private room" : "Room not confirmed yet");
    if (u.ym) L.push(`Wants an au pair from: ${ymToMonth(u.ym)}`);
    if (u.stay) L.push(`For: ${u.stay} months`);
    if (c.pets) L.push("Has pets");
    if (c.smokerHousehold) L.push("Someone smokes at home");
  }
  if (doc.about) L.push(doc.about);
  return L;
}

function cardEl(doc, u, fit) {
  const card = el("article", "findCard apCard");
  const head = el("div", "findHead");
  if (doc.photoUrl) { const img = el("img", "findPhoto"); paintFileImg(img, doc.photoUrl); img.alt = ""; head.append(img); }
  else head.append(el("div", "findInitial", (doc.displayName || "?").slice(0, 1)));
  const who = el("div", "findWho");
  who.append(el("h3", "findName", doc.displayName || "Member"));
  who.append(el("p", "findPlace", u.track === "host" ? (u.country || "") : (u.country ? `From ${u.country}` : "")));
  const tags = el("p", "findUpdated");
  tags.append(el("span", "tag " + (u.track === "host" ? "hostTag" : "apTag"), u.track === "host" ? "Host family" : "Au pair"));
  const ver = (window.CARESITS_VERIFIED || {})[doc.uid];
  if (ver) tags.append(el("span", "tag", "\u2713 Verified"));
  who.append(tags);
  head.append(who);
  if (window.CARESITS_V2 && window.CARESITS_V2.heartButton && doc.uid) head.append(window.CARESITS_V2.heartButton(doc.uid));
  card.append(head);
  const p = el("p", "findFit");
  p.append(el("span", "fitChip", fit.ok ? (fit.score >= 75 ? "Strong fit" : "Good fit") : "Different country"), el("span", "fitScore", fit.score + "% fit"));
  card.append(p);
  const ul = el("ul", "findReasons apFit");
  fit.fits.slice(0, 3).forEach((t) => ul.append(el("li", null, t)));
  fit.misses.slice(0, 2).forEach((t) => ul.append(el("li", "miss", t)));
  card.append(ul);
  const details = el("div", "findDetails"); details.hidden = true;
  detailLines(doc, u).forEach((t) => details.append(el("p", "findDetailLine", t)));
  card.append(details);
  const actions = el("div", "findActions");
  const more = el("button", "ghostBtn findDetailsBtn", "See profile"); more.type = "button"; more.setAttribute("aria-expanded", "false");
  const toggle = () => { details.hidden = !details.hidden; more.setAttribute("aria-expanded", String(!details.hidden)); more.textContent = details.hidden ? "See profile" : "Hide profile"; };
  more.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
  const say = el("button", "mainBtn findMsg", "Say hello"); say.type = "button";
  say.addEventListener("click", (e) => { e.stopPropagation(); if (typeof window.CARESITS_CONTACT === "function") window.CARESITS_CONTACT(doc.uid || "", doc); });
  actions.append(more, say);
  card.append(actions);
  // The whole card opens the profile, not only the small button.
  head.addEventListener("click", toggle);
  head.style.cursor = "pointer";
  return card;
}

function drawMap(host, groups, onPick) {
  const L = window.L;
  if (!L || !groups.length) { host.hidden = !groups.length; return false; }
  const map = L.map(host, { worldCopyJump: true, scrollWheelZoom: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 7, minZoom: 1, attribution: "\u00a9 OpenStreetMap" }).addTo(map);
  const pts = [];
  for (const g of groups) {
    const p = countryPoint(g.country);
    if (!p) continue;
    pts.push([p.lat, p.lng]);
    const icon = L.divIcon({ className: "", html: `<div style="background:#e91e63;color:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font:700 14px system-ui;border:2px solid #fff;box-shadow:0 1px 4px #0006">${g.n}</div>`, iconSize: [30, 30] });
    L.marker([p.lat, p.lng], { icon, title: `${g.country}: ${g.n}` }).addTo(map).on("click", () => onPick(g.country));
  }
  if (pts.length > 1) map.fitBounds(pts, { padding: [30, 30], maxZoom: 5 });
  else if (pts.length === 1) map.setView(pts[0], 4);
  else map.setView([20, 10], 1);
  setTimeout(() => map.invalidateSize(), 250);
  return true;
}

export function renderAuPairFind(root, viewerDoc, candidateDocs) {
  const me = factsOf(viewerDoc);
  const meIsAuPair = me.track === "aupair";
  const want = meIsAuPair ? "host" : "aupair";
  root.replaceChildren();
  root.append(el("h2", "findTitle", meIsAuPair ? "Host families" : "Au pairs"));
  const rows = candidateDocs
    .filter((d) => d.uid !== viewerDoc.uid && d.side !== viewerDoc.side)
    .map((d) => ({ doc: d, u: factsOf(d) }))
    .filter((r) => r.u.track === want)
    .map((r) => {
      const fit = meIsAuPair ? auPairFit(me, r.u) : auPairFit(r.u, { country: me.country, ym: me.ym, stay: me.stay, infant: me.infant });
      return { ...r, fit };
    });
  const matches = rows.filter((r) => r.fit.ok).sort((a, b) => b.fit.score - a.fit.score);
  const others = rows.filter((r) => !r.fit.ok);
  const noun = meIsAuPair ? (matches.length === 1 ? "family" : "families") : (matches.length === 1 ? "au pair" : "au pairs");
  root.append(el("p", "findPool", meIsAuPair
    ? (me.worldwide ? `${matches.length} ${noun} anywhere in the world` : `${matches.length} ${noun} in the countries you picked`)
    : `${matches.length} ${noun} who want ${me.country || "your country"}`));

  // the map: one pin per country with a number
  const groups = new Map();
  for (const r of matches) {
    const country = meIsAuPair ? r.u.country : (r.u.country || "");
    if (!country) continue;
    groups.set(country, (groups.get(country) || 0) + 1);
  }
  const mapHost = el("div", "apMap"); mapHost.setAttribute("role", "img"); mapHost.setAttribute("aria-label", "World map with a number on each country");
  const listHost = el("div", "findList");
  const paint = () => {
    listHost.replaceChildren();
    const shown = matches.filter((r) => !mapCountry || (r.u.country === mapCountry));
    if (mapCountry) {
      const clear = el("button", "ghostBtn", `Showing ${mapCountry}. Show all`); clear.type = "button";
      clear.addEventListener("click", () => { mapCountry = ""; paint(); });
      listHost.append(clear);
    }
    if (!shown.length) {
      const box = el("div", "cardIn");
      const img = el("img", "bunnyBig"); img.src = "bunny/bunny-rest-calm.png"; img.alt = "";
      box.append(img, el("h3", null, meIsAuPair ? "No families in your countries yet" : "No au pairs for your country yet"),
        el("p", null, meIsAuPair ? "More families join every day. You can add more countries, or pick Worldwide." : "More au pairs join every day. Check that your dates are not too early."));
      const b = el("button", "mainBtn", "Change my answers"); b.type = "button";
      b.addEventListener("click", () => document.querySelector('[data-nav="questionnaire"]')?.click());
      box.append(b);
      listHost.append(box);
    }
    shown.forEach((r) => listHost.append(cardEl(r.doc, r.u, r.fit)));
    if (others.length && !mapCountry) {
      const d = el("details", "apOthers"); d.append(el("summary", null, meIsAuPair ? `Families in other countries (${others.length})` : `Au pairs who picked other countries (${others.length})`));
      others.forEach((r) => d.append(cardEl(r.doc, r.u, r.fit)));
      listHost.append(d);
    }
  };
  root.append(mapHost);
  drawMap(mapHost, [...groups].map(([country, n]) => ({ country, n })), (country) => { mapCountry = country; paint(); listHost.scrollIntoView({ behavior: "smooth", block: "start" }); });
  root.append(listHost);
  paint();
}
