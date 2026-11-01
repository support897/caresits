// Caresitters app2 — the profile view (Difference Map
// 31 Oct 2026, item 8). Until this file, a member was only a
// card plus an expanded footnote: no rate, no experience
// lines, no education, no checks list, no availability grid.
// This is the real profile page, opened from a card or a map
// pin, sections in the order the industry shape uses: header,
// about, the facts, experience, availability, education,
// checks, reviews, location.
//
// It is built ONLY from what the published profile document
// carries. Anything the documents do not publish between
// members is omitted, never faked: member since, a references
// count and a response rate wait on the rules fold, exactly
// as the Difference Map names them.
import { t as tr } from "./lang.js";
import { paintFileImg } from "./files.js";
import { LANGS, BANDS, DAYS, PARTS } from "./questions.js";
import { unpackAuPair } from "./tracks.js";

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const listValue = (value) => (Array.isArray(value) ? value : value == null || value === "" ? [] : [value]);
const norm = (value) => String(value ?? "").trim().toLowerCase();

function updatedStamp(doc) {
  const u = doc && doc.updatedAt;
  if (!u) return "";
  const d = u.toDate ? u.toDate() : new Date(typeof u === "number" ? u : (u.seconds ? u.seconds * 1000 : u));
  if (!d || isNaN(d.getTime())) return "";
  return tr("find.updated", undefined, { n: d.toLocaleString("en", { month: "short", year: "numeric" }) });
}

function section(parent, titleKey) {
  const box = el("section", "profileSection");
  box.append(el("h3", "profileSectionTitle", tr(titleKey)));
  parent.append(box);
  return box;
}

function availGrid(parent, grid) {
  const table = el("table", "profileAvail");
  const head = el("tr");
  head.append(el("th", null, ""));
  for (const d of DAYS) head.append(el("th", null, d.slice(0, 3)));
  table.append(head);
  for (const part of PARTS) {
    const row = el("tr");
    row.append(el("th", null, part.charAt(0).toUpperCase() + part.slice(1)));
    for (const d of DAYS) {
      const cell = el("td", null, "");
      const v = grid ? (grid[d] ?? grid[d.toLowerCase()] ?? grid[d.toUpperCase()]) : null;
      const on = Array.isArray(v) ? v.includes(part) : v === true;
      if (on) { cell.textContent = "●"; cell.className = "on"; }
      row.append(cell);
    }
    table.append(row);
  }
  parent.append(table);
}

export function openProfile(doc, viewerDoc) {
  if (!doc) return;
  document.getElementById("profileOverlay")?.remove();
  const card = doc.card || {};
  const isCarer = doc.side === "carer";
  const wrap = el("div", "sheetWrap profileWrap");
  wrap.id = "profileOverlay";
  const sheet = el("section", "sheetCard profileCard");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", doc.displayName || tr("find.member"));

  const close = el("button", "ghostBtn profileClose", tr("find.closeFilters"));
  close.type = "button";
  sheet.append(close);

  // Header: photo, name, the role in place line, saved heart.
  const head = el("div", "findHead profileHead");
  if (doc.photoUrl) { const img = el("img", "findPhoto profilePhoto"); paintFileImg(img, doc.photoUrl); img.alt = ""; head.append(img); }
  else head.append(el("div", "findInitial profileInitial", (doc.displayName || "?").slice(0, 1)));
  const who = el("div", "findWho");
  who.append(el("h2", "findName profileName", doc.displayName || tr("find.member")));
  const roles = listValue(card.roles || card.role);
  const place = doc.postcode || card.postcode || "";
  if (isCarer && roles.length && place) who.append(el("p", "findRoleLine", tr("find.roleIn", undefined, { role: roles[0], place })));
  else if (isCarer && roles.length) who.append(el("p", "findRoleLine", roles.join(", ")));
  else if (!isCarer && place) who.append(el("p", "findRoleLine", tr("find.lookingIn", undefined, { place })));
  if (place) who.append(el("p", "findPlace", tr("find.postcode", undefined, { n: place })));
  const stamp = updatedStamp(doc);
  if (stamp) who.append(el("p", "findUpdated", stamp));
  head.append(who);
  if (window.CARESITS_V2 && window.CARESITS_V2.heartButton && doc.uid) head.append(window.CARESITS_V2.heartButton(doc.uid));
  sheet.append(head);

  // The honest rate, big, the way the industry shows it.
  const rate = Number(isCarer ? card.payFloor : card.payOffered);
  if (Number.isFinite(rate) && rate > 0) sheet.append(el("p", "profileRate", tr("find.filterCurrency", undefined, { n: rate })));

  // About, with a read more fold when the words run long.
  if (doc.about) {
    const box = section(sheet, "find.profileAbout");
    const text = String(doc.about);
    const p = el("p", "profileAbout", text.length > 240 ? text.slice(0, 240) + "…" : text);
    box.append(p);
    if (text.length > 240) {
      const more = el("button", "quietBtn", tr("find.readMore"));
      more.type = "button";
      let open = false;
      more.addEventListener("click", () => { open = !open; p.textContent = open ? text : text.slice(0, 240) + "…"; more.textContent = tr(open ? "find.readLess" : "find.readMore"); });
      box.append(more);
    }
  }

  // Experience: the years by age band, and the ages line.
  const exp = Object.entries(card.experience || {}).filter(([, v]) => v !== "" && v != null && Number(v) > 0);
  const ages = isCarer ? listValue(card.agesAccepted || card.agesPreferred) : listValue(card.childrenBands);
  if (exp.length || ages.length || (!isCarer && card.childrenCount)) {
    const box = section(sheet, "find.profileExperience");
    // The children count, when the published card carries it.
    // The sealed rules admit no count key yet, so this line
    // stands ready and stays empty until the fold lands.
    if (!isCarer && card.childrenCount) box.append(el("p", "findDetailLine", tr("find.childrenLine", undefined, { n: card.childrenCount })));
    for (const [band, years] of exp) box.append(el("p", "findDetailLine", `${band}: ${years} ${Number(years) === 1 ? "year" : "years"}`));
    if (ages.length) box.append(el("p", "findDetailLine", tr(isCarer ? "find.detailAges" : "find.detailChildren", undefined, { n: ages.join(", ") })));
    const tasks = listValue(card.tasks);
    if (tasks.length) box.append(el("p", "findDetailLine", tasks.join(", ")));
  }

  // Availability: the week grid, dayparts by days.
  const grid = isCarer ? card.availability : card.scheduleNeed;
  if (grid && typeof grid === "object" && Object.keys(grid).length) {
    const box = section(sheet, "find.profileAvailability");
    availGrid(box, grid);
    if (stamp) box.append(el("p", "findUpdated", stamp));
  }

  // Education and courses, when the card carries it. The
  // rules fence does not admit the key yet, so this section
  // stands ready and stays empty until the fold lands.
  if (card.education) {
    const box = section(sheet, "find.profileEducation");
    box.append(el("p", "findDetailLine", String(card.education)));
  }

  // Checks, shown with their state, never just claimed.
  const checksNorm = norm(card.checksLevel || doc.checksLevel);
  const vf = window.CARESITS_VERIFIED && doc.uid ? window.CARESITS_VERIFIED[doc.uid] : null;
  {
    const box = section(sheet, "find.profileChecks");
    if (vf && (!vf.expiry || vf.expiry >= new Date().toISOString().slice(0, 10))) box.append(el("p", "findDetailLine", "✓ Verified: Blue Card"));
    if (["register", "verified", "register verified"].includes(checksNorm)) box.append(el("p", "findDetailLine", tr("find.trustRegister")));
    else if (["sighted", "document sighted"].includes(checksNorm)) box.append(el("p", "findDetailLine", tr("find.trustSighted")));
    box.append(el("p", "findDetailLine", tr("find.detailSelfReported")));
  }

  // Languages.
  const languages = listValue(card.languages).map((v) => LANGS.find((l) => norm(l) === norm(v)) || v);
  if (languages.length) {
    const box = section(sheet, "find.profileLanguages");
    box.append(el("p", "findDetailLine", languages.join(", ")));
  }

  // The au pair facts, when this member is one.
  const ap = card.auPair && card.auPair.on ? unpackAuPair(card.auPair) : null;
  if (ap && ap.track) {
    const box = section(sheet, "find.profileAuPair");
    const facts = [];
    if (ap.country) facts.push(ap.track === "host" ? `Lives in: ${ap.country}` : `From: ${ap.country}`);
    if (ap.dest && ap.dest.length) facts.push(`Wants to go to: ${ap.dest.join(", ")}`);
    if (ap.worldwide) facts.push("Wants to go: anywhere in the world");
    if (ap.ym) facts.push(`Can arrive from: ${ap.ym}`);
    if (ap.stay) facts.push(`Can stay: ${ap.stay} months`);
    if (ap.english) facts.push(`English: ${ap.english}`);
    if (ap.room != null && ap.track === "host") facts.push(ap.room ? "Au pair has a private room" : "Room not confirmed yet");
    if (ap.hours) facts.push(`Hours a week: ${ap.hours}`);
    for (const f of facts) box.append(el("p", "findDetailLine", f));
  }

  // Reviews, the ones the app itself loads.
  {
    const box = section(sheet, "find.profileReviews");
    const revBox = el("div", "v2RevList");
    box.append(revBox);
    if (window.CARESITS_V2 && window.CARESITS_V2.reviewsInto && doc.uid) window.CARESITS_V2.reviewsInto(revBox, doc.uid);
    else revBox.append(el("p", "v2Sub", "No reviews yet."));
  }

  // Location: the postcode area, never an address. The care
  // place rides here when the published card carries it; the
  // sealed rules admit no care place key yet, so the line
  // stands ready and stays empty until the fold lands.
  const carePlace = card.careLocationFamily || card.careLocationCarer || card.careLocation || "";
  if (place || carePlace) {
    const box = section(sheet, "find.profileLocation");
    if (place) box.append(el("p", "findDetailLine", tr("find.postcode", undefined, { n: place })));
    if (carePlace) box.append(el("p", "findDetailLine", tr("find.profileCarePlace", undefined, { n: carePlace })));
    if (place) box.append(el("p", "findDetailLine", tr("find.mapNote")));
  }

  // Actions. A message tap must never die silently (Difference
  // Map item 12): when the contact layer is not standing, the
  // tap says so in plain words, the same toast Find uses.
  const actions = el("div", "findActions");
  const messageButton = el("button", "mainBtn findMsg", tr("find.message"));
  messageButton.type = "button";
  messageButton.addEventListener("click", () => {
    if (typeof window.CARESITS_CONTACT === "function") { window.CARESITS_CONTACT(doc.uid || "", doc); return; }
    const t = el("div", "v2Toast", tr("contact.failed"));
    t.setAttribute("role", "status");
    document.body.append(t);
    setTimeout(() => t.remove(), 4500);
  });
  actions.append(messageButton);
  sheet.append(actions);
  const quiet = el("div", "quietRow");
  const rep = el("button", "quietBtn", tr("find.report"));
  rep.type = "button";
  rep.addEventListener("click", () => window.CARESITS_REPORT?.(doc.uid || "", { surface: "profile", snapshot: { items: ["profile"], text: String(doc.about || ""), title: doc.displayName || "Profile" } }));
  const blk = el("button", "quietBtn", tr("find.block"));
  blk.type = "button";
  blk.addEventListener("click", () => { closeProfile(); window.CARESITS_BLOCK?.(doc.uid || "", null); });
  quiet.append(rep, blk);
  sheet.append(quiet);

  const closeProfile = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (event) => { if (event.key === "Escape") closeProfile(); };
  close.addEventListener("click", closeProfile);
  wrap.addEventListener("click", (event) => { if (event.target === wrap) closeProfile(); });
  document.addEventListener("keydown", onKey);
  wrap.append(sheet);
  document.body.append(wrap);
  close.focus();
}
