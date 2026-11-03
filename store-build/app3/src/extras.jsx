import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { briefBreakdown } from "./match6.js";
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export function Breakdown({ me, p, radius }) {
  const b = briefBreakdown({ viewer: { side: me.side, card: me.card }, other: { side: p.side, card: p.card }, km: p.km, radius: radius || 25 });
  return <div style={{ margin: "12px 0" }}><h3 style={{ fontSize: 17 }}>How it adds up</h3>
    {b.rows.map((r) => <div key={r.id} style={{ margin: "8px 0" }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}><span>{r.name} <small style={{ opacity: .6 }}>({r.w}%)</small></span><b>{r.s == null ? "Not stated" : Math.round(r.s * 100) + "%"}</b></div>
      <div style={{ height: 8, borderRadius: 4, background: "#E9E3D6", overflow: "hidden" }}><motion.div initial={{ width: 0 }} animate={{ width: (r.s == null ? 0 : r.s * 100) + "%" }} transition={{ duration: .5 }} style={{ height: "100%", background: "#1E4D44" }} /></div></div>)}
    <p style={{ fontSize: 14, opacity: .75 }}>{b.pct == null ? "Not enough stated on both profiles to score by these weights." : "On these weights alone: " + b.pct + "%."} Missing facts are left out, never guessed. Your must-haves are checked separately and can lower the score. Visa eligibility is shown separately and is never part of the percentage.</p></div>;
}

// In-app bell. Facts only, no urgency, no counters designed to pull you back. Each kind can be muted.
const KINDS = [["matches", "Matches and likes"], ["bookings", "Bookings"], ["careday", "Care day updates"]];
export function Bell({ me, rels, people }) {
  const [open, setOpen] = useState(false), [mute, setMute] = useState(() => ls("caresits-bell-mute", {}));
  const toggle = (k) => { const m = { ...mute, [k]: !mute[k] }; setMute(m); localStorage.setItem("caresits-bell-mute", JSON.stringify(m)); };
  const nameOf = (r) => { const o = r.members?.find((u) => u !== me.uid); return people.find((x) => x.uid === o)?.name || "Someone"; };
  const items = [];
  rels.forEach((r) => {
    if (r.state === "pending" && r.createdBy !== me.uid) items.push({ k: "matches", t: nameOf(r) + " liked your profile" });
    if (r.state === "contact") items.push({ k: "matches", t: "You and " + nameOf(r) + " are connected" });
    if (r.state === "booked" || r.state === "accepted") items.push({ k: "bookings", t: "Booking with " + nameOf(r) + " is " + r.state });
  });
  try { const cs = ls("caresits-cs-" + me.uid, {}); (cs.today || []).filter((x) => x.asked).slice(-3).forEach((x) => items.push({ k: "careday", t: "Update asked: " + x.text })); } catch {}
  const shown = items.filter((i) => !mute[i.k]);
  return <>
    <button aria-label="Notifications" onClick={() => setOpen(!open)} style={{ position: "absolute", top: 8, right: 108, zIndex: 55, width: 44, height: 44, borderRadius: 22, border: 0, background: "#FDF8F0", boxShadow: "0 2px 8px #0002", fontSize: 20 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1E4D44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>{shown.length > 0 && <span style={{ position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, background: "#F4A9BC", color: "#1E4D44", fontSize: 11, lineHeight: "16px" }}>{shown.length}</span>}</button>
    <AnimatePresence>{open && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ position: "absolute", top: 60, right: 12, left: 12, zIndex: 56, background: "#FDF8F0", borderRadius: 16, padding: 14, boxShadow: "0 8px 30px #0003", maxHeight: "60%", overflow: "auto" }}>
      <b style={{ fontSize: 18 }}>Notifications</b>
      {shown.length ? shown.map((i, n) => <div key={n} className="li" style={{ padding: 10 }}>{i.t}</div>) : <p style={{ opacity: .7 }}>Nothing new.</p>}
      <div style={{ marginTop: 8 }}>{KINDS.map(([k, l]) => <label key={k} style={{ display: "flex", gap: 10, padding: "6px 0", fontSize: 16 }}><input type="checkbox" checked={!mute[k]} onChange={() => toggle(k)} /> {l}</label>)}</div>
      <small style={{ opacity: .65 }}>Safety alerts are never muted. Push to your phone is not switched on yet.</small></motion.div>}</AnimatePresence></>;
}

export function Offline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => { const a = () => setOn(true), b = () => setOn(false); addEventListener("online", a); addEventListener("offline", b); return () => { removeEventListener("online", a); removeEventListener("offline", b); }; }, []);
  return on ? null : <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 70, background: "#F6CBD3", color: "#1E4D44", textAlign: "center", padding: 6, fontSize: 15 }}>You are offline. You can still read. Messages will send when you are back.</div>;
}
