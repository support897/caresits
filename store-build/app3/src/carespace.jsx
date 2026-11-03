import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bunny } from "./bunny.jsx";
import { APP2 } from "./brand.js";
import { checkMeal, ALLERGENS } from "./allergy.js";
import * as D from "./data.js";
const spring = { type: "spring", stiffness: 420, damping: 32 };
const hap = () => { try { navigator.vibrate?.(8); window.Capacitor?.Plugins?.Haptics?.impact({ style: "LIGHT" }); } catch {} };
// Local-first store. Firestore careSpaces/* rules are written in accounts/ but NOT deployed (OWNER MUST DEPLOY), so nothing here is synced yet.
function useStore(uid) {
  const k = "caresits-cs-" + uid;
  const [s, setS] = useState(() => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } });
  const DEF = { children: [], events: [], team: [], reports: [], shopping: [], today: [] };
  const upd = (patch) => setS((o0) => { const o = { ...DEF, ...o0 }; const n = { ...o, ...(typeof patch === "function" ? patch(o) : patch) }; localStorage.setItem(k, JSON.stringify(n)); return n; });
  return [{ children: [], events: [], team: [], reports: [], shopping: [], today: [], ...s }, upd];
}
const SEC = ["Health and safety", "Meals", "Sleep and routine", "Mood", "Learning", "Memories"];
const IDEAS = [
  { age: [0, 2], t: "Treasure basket", min: 15, mat: "Safe household objects", steps: "Put 5 safe items in a basket. Let baby explore.", goal: "Senses and grasping", es: "Cesta del tesoro" },
  { age: [1, 4], t: "Shaving foam painting", min: 20, mat: "Foam, tray", steps: "Spread foam on a tray. Draw shapes with fingers.", goal: "Fine motor", es: "Pintura con espuma" },
  { age: [2, 5], t: "Obstacle course", min: 25, mat: "Cushions, tape", steps: "Make a path to crawl, hop and balance.", goal: "Gross motor", es: "Circuito de obstaculos" },
  { age: [3, 7], t: "Kitchen helper pizza", min: 40, mat: "Dough, toppings", steps: "Roll dough, add toppings, bake with an adult.", goal: "Counting and sharing", es: "Pizza con ayudante" },
  { age: [5, 12], t: "Backyard science", min: 30, mat: "Cups, soil, seeds", steps: "Plant seeds and guess how fast they grow.", goal: "Curiosity", es: "Ciencia en el jardin" },
];
const ROLES = [["admin", "Admin (parent)"], ["regular", "Regular carer"], ["limited", "Limited carer"], ["viewer", "Family viewer"]];

export function CareSpace({ me, rels, people, onExit }) {
  const [tab, setTab] = useState("chats"), [st, upd] = useStore(me.uid);
  const tabs = [["chats", "Chats"], ["calendar", "Calendar"], ["care", "Care"], ["activities", "Activities"], ["profile", "Profile"]];
  return <div className="app cs"><div className="csHead"><b>{APP2}</b><button className="chip" onClick={onExit}>Back to Caresitters</button></div>
    <div className="screen" style={{ top: 50 }}><AnimatePresence mode="wait"><motion.div key={tab} style={{ height: "100%" }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .15 }}>
      {tab === "chats" && <Chats {...{ me, rels, people }} />}
      {tab === "calendar" && <Cal {...{ me, st, upd }} />}
      {tab === "care" && <Care {...{ me, st, upd }} />}
      {tab === "activities" && <Acts {...{ st, upd }} />}
      {tab === "profile" && <CsProfile {...{ me, st, upd }} />}
    </motion.div></AnimatePresence></div>
    <nav className="tabs">{tabs.map(([k, l]) => <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => { hap(); setTab(k); }}>{l}</button>)}</nav></div>;
}

function Chats({ me, rels, people }) {
  const [f, setF] = useState("All"), [open, setOpen] = useState(null), [txt, setTxt] = useState(""), [sent, setSent] = useState([]);
  const by = Object.fromEntries(people.map((p) => [p.uid, p]));
  const spaces = rels.filter((r) => r.state === "contact" || r.state === "hired").map((r) => ({ r, o: by[r.members.find((m) => m !== me.uid)] })).filter((x) => x.o);
  const reqs = rels.filter((r) => r.state === "pending").length;
  const show = spaces.filter(({ o }) => f === "All" || f === "Requests" ? f === "All" : f === "Families" ? o.side === "family" : f === "Carers" ? o.side === "carer" : false);
  if (open) return <div className="scroll"><button className="chip" onClick={() => setOpen(null)}>‹ Chats</button><h2 style={{ margin: "10px 0" }}>{open.o.name}</h2><p className="chip" style={{ display: "block", padding: 10, fontSize: 15 }}>Private Care Space: only you and {open.o.name} can see this.</p>
    {sent.filter((m) => m.to === open.o.uid).map((m, i) => <div key={i} className="bub me">{m.text}</div>)}
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}><input className="field" style={{ flex: 1 }} placeholder="Message" value={txt} onChange={(e) => setTxt(e.target.value)} /><button className="btn" style={{ width: "auto" }} disabled={!txt.trim()} onClick={async () => { await D.sendMsg(me, open.o, txt.trim()); setSent([...sent, { to: open.o.uid, text: txt.trim() }]); setTxt(""); }}>Send</button></div></div>;
  return <div className="scroll"><h1 style={{ margin: "8px 0" }}>Chats</h1>
    <div className="secs" style={{ padding: "0 0 8px" }}>{["All", "Families", "Carers", "Unread", "Requests"].map((x) => <button key={x} className={"tag" + (f === x ? " on" : "")} onClick={() => setF(x)}>{x}{x === "Requests" && reqs ? " " + reqs : ""}</button>)}</div>
    {show.map(({ r, o }) => <button key={r.id} className="li" style={{ width: "100%", textAlign: "left" }} onClick={() => setOpen({ r, o })}><div className="av" style={{ width: 44, height: 44 }}>{o.name[0]}</div><div style={{ flex: 1 }}><b>{o.name}</b><div style={{ fontSize: 14, opacity: .7 }}>Separate Care Space</div></div></button>)}
    {!show.length && <div className="empty"><Bunny mood="rest" size={110} /><h2>No chats here</h2><p>{f === "Requests" ? "Open requests show in Matches." : "Chats open when you both say yes."}</p></div>}</div>;
}

function Cal({ me, st, upd }) {
  const [add, setAdd] = useState(false), [f, setF] = useState({ title: "", date: "", kind: "shift" });
  const sorted = [...st.events].sort((a, b) => a.date.localeCompare(b.date));
  const setStatus = (id, status) => upd((o) => ({ events: o.events.map((e) => e.id === id ? { ...e, status } : e) }));
  return <div className="scroll"><h1 style={{ margin: "8px 0" }}>Calendar</h1>
    <button className="btn" onClick={() => setAdd(!add)}>{add ? "Close" : "Add to calendar"}</button>
    {add && <div style={{ margin: "12px 0" }}><input className="field" placeholder="What (shift, school, pickup)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><input className="field" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={{ marginTop: 8 }} />
      <div className="cards" style={{ marginTop: 8 }}>{[["shift", "Shift"], ["school", "School"], ["pickup", "Pickup"], ["timeoff", "Time off request"]].map(([k, l]) => <button key={k} className={"sc" + (f.kind === k ? " on" : "")} onClick={() => setF({ ...f, kind: k })}>{l}</button>)}</div>
      <button className="btn" disabled={!f.title || !f.date} onClick={() => { upd((o) => ({ events: [...o.events, { id: Date.now() + "", ...f, status: f.kind === "timeoff" ? "waiting for family" : "set" }] })); setF({ title: "", date: "", kind: "shift" }); setAdd(false); }}>Save</button></div>}
    {sorted.map((e) => <div className="li" key={e.id} style={{ display: "block" }}><b>{e.title}</b><div style={{ fontSize: 14, opacity: .7 }}>{e.date} · {e.kind === "timeoff" ? "Time off" : e.kind} · {e.status}</div>
      {e.kind === "timeoff" && e.status === "waiting for family" && me.side === "family" && <div className="row" style={{ marginTop: 8 }}><button className="chip" onClick={() => setStatus(e.id, "approved")}>Approve</button><button className="chip" onClick={() => setStatus(e.id, "declined")}>Decline</button><button className="chip" onClick={() => setStatus(e.id, "swap proposed")}>Propose a swap</button></div>}
      <p style={{ fontSize: 13, opacity: .6 }}>{e.kind === "timeoff" ? "A booking is never cancelled silently. The family decides." : ""}</p></div>)}
    {!sorted.length && <div className="empty"><Bunny mood="think" size={100} /><p>Nothing planned yet.</p></div>}</div>;
}

function Care({ me, st, upd }) {
  const [sel, setSel] = useState(null), [nm, setNm] = useState(""), [al, setAl] = useState([]);
  const kid = st.children.find((c) => c.id === sel);
  const edit = (patch) => upd((o) => ({ children: o.children.map((c) => c.id === sel ? { ...c, ...patch } : c) }));
  if (kid) return <div className="scroll"><button className="chip" onClick={() => setSel(null)}>‹ Children</button><h1 style={{ margin: "8px 0" }}>{kid.name}</h1>
    {kid.allergies.length > 0 && <div className="alert">⚠ Allergies: {kid.allergies.join(", ")}</div>}
    <Meal kid={kid} edit={edit} />
    <h3 style={{ marginTop: 14 }}>Daily report</h3><div className="row">{["Ate well", "Napped", "Happy", "Tired", "Played outside"].map((x) => <button key={x} className="tag" style={{ padding: "10px 14px" }} onClick={() => { hap(); upd((o) => ({ today: [...o.today, { at: new Date().toTimeString().slice(0, 5), text: kid.name + ": " + x }] })); }}>{x}</button>)}</div>
    {SEC.map((s) => <details key={s} className="sec" open={s === "Health and safety"}><summary>{s}</summary>{s === "Health and safety" ? <p style={{ fontSize: 14, opacity: .7 }}>Allergy and medication details are edited by an Admin only and each change alerts the care team. Not a medical record.</p> : null}<textarea className="field" rows={2} placeholder={"Notes: " + s} value={kid.notes?.[s] || ""} onChange={(e) => edit({ notes: { ...(kid.notes || {}), [s]: e.target.value } })} disabled={s === "Health and safety" && me.side !== "family"} /></details>)}</div>;
  return <div className="scroll"><h1 style={{ margin: "8px 0" }}>Care</h1>
    <h3>Today</h3>{st.today.length ? st.today.slice(-6).map((t, i) => <div key={i} className="li"><b>{t.at}</b> {t.text}</div>) : <p style={{ opacity: .7 }}>Arrival, meals, naps and pickup show here as the day goes. Parents can ask for an update on any item.</p>}
    <h3 style={{ marginTop: 14 }}>Children</h3>
    {st.children.map((c) => <button key={c.id} className="li" style={{ width: "100%", textAlign: "left" }} onClick={() => setSel(c.id)}><div className="av" style={{ width: 40, height: 40 }}>{c.name[0]}</div><b style={{ flex: 1 }}>{c.name}</b>{c.allergies.length > 0 && <span className="chip" style={{ background: "#F6CBD3" }}>⚠ {c.allergies.length}</span>}</button>)}
    {me.side === "family" ? <div className="li" style={{ display: "block" }}><input className="field" placeholder="Name or nickname" value={nm} onChange={(e) => setNm(e.target.value)} /><p style={{ margin: "8px 0 4px" }}>Allergies</p><div className="row">{Object.keys(ALLERGENS).map((a) => <button key={a} className={"tag" + (al.includes(a) ? " good" : "")} style={{ padding: "8px 12px" }} onClick={() => setAl(al.includes(a) ? al.filter((x) => x !== a) : [...al, a])}>{a}</button>)}</div>
      <button className="btn" style={{ marginTop: 10 }} disabled={!nm.trim()} onClick={() => { upd((o) => ({ children: [...o.children, { id: Date.now() + "", name: nm.trim(), allergies: al, notes: {} }] })); setNm(""); setAl([]); }}>Add child (private to you)</button></div> : <p style={{ opacity: .7 }}>Only a parent adds child profiles.</p>}</div>;
}
function Meal({ kid, edit }) {
  const [t, setT] = useState(""); const r = t ? checkMeal(kid.allergies, t) : null;
  return <><h3 style={{ marginTop: 14 }}>Log a meal</h3><input className="field" placeholder="rice, chicken, apple" value={t} onChange={(e) => setT(e.target.value)} />
    {r && <div className={"alert" + (r.level === "stop" ? " stop" : "")}>{r.warn.map((w, i) => <div key={i}>{w}</div>)}<small>This is a helper. It never decides what is safe. A person must read every label.</small></div>}</>;
}

function Acts({ st, upd }) {
  const [age, setAge] = useState(3), [v, setV] = useState({});
  const list = IDEAS.filter((i) => age >= i.age[0] && age <= i.age[1]);
  return <div className="scroll"><h1 style={{ margin: "8px 0" }}>Activities</h1><label>Child age: <b>{age}</b><input type="range" min="0" max="12" value={age} onChange={(e) => setAge(+e.target.value)} style={{ width: "100%" }} /></label>
    {list.map((i) => <div className="li" key={i.t} style={{ display: "block" }}><b>{v[i.t] === "es" ? i.es : i.t}</b> · {i.min} min<div style={{ fontSize: 15 }}>Materials: {i.mat}</div><div style={{ fontSize: 15 }}>{v[i.t] === "simple" ? "Do just the first step and let them lead." : v[i.t] === "more" ? "Make it a team game: take turns each step." : i.steps}</div><div style={{ fontSize: 14, opacity: .7 }}>Goal: {i.goal}</div>
      <div className="row" style={{ marginTop: 8 }}>{[["simple", "Simpler"], ["more", "More kids"], ["es", "Spanish version"]].map(([k, l]) => <button key={k} className="tag" onClick={() => setV({ ...v, [i.t]: v[i.t] === k ? "" : k })}>{l}</button>)}<button className="tag good" onClick={() => { upd((o) => ({ shopping: [...o.shopping, { id: Date.now() + "", item: i.mat, from: i.t, bought: false }] })); hap(); }}>+ Shopping list</button></div></div>)}
    <h3 style={{ marginTop: 14 }}>Shopping list</h3>{st.shopping.map((s) => <label key={s.id} className="li"><input type="checkbox" checked={s.bought} onChange={() => upd((o) => ({ shopping: o.shopping.map((x) => x.id === s.id ? { ...x, bought: !x.bought } : x) }))} /> <span style={{ flex: 1, textDecoration: s.bought ? "line-through" : "" }}>{s.item} <small>({s.from})</small></span></label>)}</div>;
}

function CsProfile({ me, st, upd }) {
  const [nm, setNm] = useState(""), [role, setRole] = useState("regular");
  return <div className="scroll"><h1 style={{ margin: "8px 0" }}>Profile</h1><b>{me.name}</b>
    <h3 style={{ marginTop: 14 }}>Care Team</h3><p style={{ fontSize: 14, opacity: .7 }}>A parent chooses who sees allergies, medication, photos, calendar and messages. Access can be removed at any time.</p>
    {st.team.map((t) => <div key={t.id} className="li"><div style={{ flex: 1 }}><b>{t.name}</b><div style={{ fontSize: 14, opacity: .7 }}>{ROLES.find((r) => r[0] === t.role)?.[1]}</div></div>{me.side === "family" && <button className="chip" onClick={() => upd((o) => ({ team: o.team.filter((x) => x.id !== t.id) }))}>Remove access</button>}</div>)}
    {me.side === "family" && <><input className="field" placeholder="Name" value={nm} onChange={(e) => setNm(e.target.value)} /><div className="cards" style={{ marginTop: 8 }}>{ROLES.map(([k, l]) => <button key={k} className={"sc" + (role === k ? " on" : "")} onClick={() => setRole(k)}>{l}</button>)}</div><button className="btn" disabled={!nm.trim()} onClick={() => { upd((o) => ({ team: [...o.team, { id: Date.now() + "", name: nm.trim(), role }] })); setNm(""); }}>Add to Care Team</button></>}
    <h3 style={{ marginTop: 14 }}>Notifications</h3><p style={{ fontSize: 15 }}>One bell. Parents choose every update, key events or a daily recap. Carers can mute non-urgent items. Safety alerts always get through. (Push is not switched on yet.)</p></div>;
}
