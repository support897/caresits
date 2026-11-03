import React, { useState } from "react";
import { motion } from "framer-motion";
import { Bunny } from "./bunny.jsx";
import * as D from "./data.js";
// Visa facts are NOT encoded. Each country gives the official page and a last-checked date; status stays "Unknown" so we never imply eligibility.
export const COUNTRIES = [
  { id: "AU", name: "Australia", flag: "🇦🇺", x: 87, y: 72, route: "Working Holiday (417) or Work and Holiday (462) visa. Rules depend on your passport.", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-holiday-462", checked: "2026-11-03" },
  { id: "US", name: "United States", flag: "🇺🇸", x: 22, y: 35, route: "J-1 Au Pair exchange programme, through a sponsor agency.", url: "https://j1visa.state.gov/programs/au-pair/", checked: "" },
  { id: "DE", name: "Germany", flag: "🇩🇪", x: 52, y: 28, route: "Au pair residence permit.", url: "https://www.make-it-in-germany.com/en/visa-residence/types/au-pair", checked: "" },
  { id: "UK", name: "United Kingdom", flag: "🇬🇧", x: 48, y: 25, route: "Check gov.uk for the routes open to your passport.", url: "https://www.gov.uk/browse/visas-immigration", checked: "" },
  { id: "CA", name: "Canada", flag: "🇨🇦", x: 24, y: 24, route: "Check the official Canada immigration pages.", url: "https://www.canada.ca/en/immigration-refugees-citizenship.html", checked: "" },
  { id: "IE", name: "Ireland", flag: "🇮🇪", x: 46, y: 26, route: "Check the official Irish immigration service.", url: "https://www.irishimmigration.ie/", checked: "" },
  { id: "FR", name: "France", flag: "🇫🇷", x: 50, y: 31, route: "Check the official France-Visas site.", url: "https://france-visas.gouv.fr/en/", checked: "" },
  { id: "ES", name: "Spain", flag: "🇪🇸", x: 48, y: 36, route: "Check the official Spanish foreign ministry.", url: "https://www.exteriores.gob.es/", checked: "" },
  { id: "NL", name: "Netherlands", flag: "🇳🇱", x: 51, y: 27, route: "Check the official Dutch immigration service (IND).", url: "https://ind.nl/en", checked: "" },
  { id: "NZ", name: "New Zealand", flag: "🇳🇿", x: 95, y: 82, route: "Check Immigration New Zealand.", url: "https://www.immigration.govt.nz/", checked: "" },
];
const PASS = ["Australia", "United Kingdom", "United States", "Canada", "Ireland", "Germany", "France", "Spain", "Italy", "Brazil", "Colombia", "Philippines", "India", "South Africa", "Other"];
const CHILD = ["Play and activities", "School runs", "Child meals", "Bath and bedtime", "Homework help"], HOUSE = ["Child's laundry", "Tidying kids' rooms", "Light cleaning", "Cooking for the family", "Garden or pets"];

export function AuPair({ me, onBack }) {
  const [view, setView] = useState("map"), [c, setC] = useState(null), [pp, setPp] = useState(() => localStorage.getItem("caresits-passport") || ""), [saved, setSaved] = useState(false);
  const mine = me.card.auPair || {};
  const [f, setF] = useState({ room: mine.room || "", pocket: mine.pocket || "", hours: mine.hours || "", child: mine.child || [], house: mine.house || [], langs: mine.langs || "", visaHelp: !!mine.visaHelp, about: mine.about || "" });
  const host = me.side === "family";
  const tog = (k, v) => setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));
  const save = async () => { await D.saveProfile(me.uid, { card: { auPair: f } }); setSaved(true); setTimeout(() => setSaved(false), 1600); };
  const st = (co) => !pp ? "Unknown. Pick your passport to see the official page for it." : "Unknown. We do not decide eligibility. Read the official page.";
  return <div className="scroll"><button className="chip" onClick={c ? () => setC(null) : onBack}>‹ Back</button><h1 style={{ margin: "10px 0 4px" }}>Au pair world</h1>
    <p style={{ opacity: .75 }}>A separate path for live-in childcare abroad. Compatibility and visa status are two different things here.</p>
    <div className="secs" style={{ padding: "0 0 8px" }}>{[["map", "Countries"], ["profile", host ? "Host profile" : "Au pair profile"]].map(([k, l]) => <button key={k} className={"tag" + (view === k ? " on" : "")} onClick={() => { setView(k); setC(null); }}>{l}</button>)}</div>
    {view === "map" && !c && <><div className="wmap" role="img" aria-label="World map of countries">{COUNTRIES.map((co) => <button key={co.id} className="pin" style={{ left: co.x + "%", top: co.y + "%" }} onClick={() => setC(co)} aria-label={co.name}>{co.flag}</button>)}</div>
      {COUNTRIES.map((co) => <button key={co.id} className="li" style={{ width: "100%", textAlign: "left" }} onClick={() => setC(co)}><span style={{ fontSize: 28 }}>{co.flag}</span><b style={{ flex: 1 }}>{co.name}</b>›</button>)}</>}
    {view === "map" && c && <div><h2>{c.flag} {c.name}</h2>
      <label style={{ display: "block", margin: "8px 0" }}>Your passport<select className="field" value={pp} onChange={(e) => { setPp(e.target.value); localStorage.setItem("caresits-passport", e.target.value); }}><option value="">Choose</option>{PASS.map((p) => <option key={p}>{p}</option>)}</select></label>
      <div className="li" style={{ display: "block" }}><b>Compatibility</b><div>Shown on each profile, based on what hosts and au pairs both asked for.</div></div>
      <div className="li" style={{ display: "block" }}><b>Visa status (separate)</b><div className="chip" style={{ background: "var(--butter)", margin: "6px 0", display: "inline-block" }}>Unknown</div><div>{st(c)}</div><div style={{ marginTop: 6 }}>{c.route}</div><p style={{ fontSize: 14, opacity: .7, marginTop: 6 }}>Official source: <a href={c.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{c.url.replace("https://", "")}</a><br />Last checked: {c.checked || "not checked yet"}</p></div></div>}
    {view === "profile" && <div><p style={{ opacity: .75 }}>{host ? "Tell au pairs what living with you is like." : "Tell hosts what you can and cannot do."}</p>
      {host && <><input className="field" placeholder="Room (private bedroom, own bathroom...)" value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /><input className="field" style={{ marginTop: 8 }} placeholder="Pocket money per week" value={f.pocket} onChange={(e) => setF({ ...f, pocket: e.target.value })} inputMode="numeric" /></>}
      <input className="field" style={{ margin: "8px 0" }} placeholder="Hours per week" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} inputMode="numeric" />
      <h3>Childcare duties</h3><div className="row">{CHILD.map((d) => <button key={d} className={"tag" + (f.child.includes(d) ? " good" : "")} onClick={() => tog("child", d)}>{d}</button>)}</div>
      <h3 style={{ marginTop: 10 }}>Housework linked to the children</h3><p style={{ fontSize: 14, opacity: .7 }}>Anything else, like cleaning the whole house, is not au pair work. Keep the line clear.</p><div className="row">{HOUSE.map((d) => <button key={d} className={"tag" + (f.house.includes(d) ? " good" : "")} onClick={() => tog("house", d)}>{d}</button>)}</div>
      <input className="field" style={{ marginTop: 10 }} placeholder="Languages (spoken at home / you speak)" value={f.langs} onChange={(e) => setF({ ...f, langs: e.target.value })} />
      {host && <label className="chip" style={{ display: "flex", gap: 10, padding: 14, margin: "10px 0", fontSize: 16 }}><input type="checkbox" checked={f.visaHelp} onChange={(e) => setF({ ...f, visaHelp: e.target.checked })} /> I can help with visa paperwork (not legal advice)</label>}
      <textarea className="field" rows={3} placeholder="About you" value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} />
      <button className="btn" style={{ marginTop: 10 }} onClick={save}>{saved ? "Saved ✓" : "Save"}</button></div>}
  </div>;
}
