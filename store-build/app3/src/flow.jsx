import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bunny } from "./bunny.jsx";
import { APP1, TAGLINE } from "./brand.js";
import * as D from "./data.js";
import { DAYS } from "../../www/app2/fit.js";
const spring = { type: "spring", stiffness: 420, damping: 32 };
const haptic = () => { try { navigator.vibrate?.(8); window.Capacitor?.Plugins?.Haptics?.impact({ style: "LIGHT" }); } catch {} };
export const getSide = () => { try { return localStorage.getItem("caresits-side") || ""; } catch { return ""; } };
export const setSide = (s) => { try { localStorage.setItem("caresits-side", s); } catch {} };

export function Welcome({ onPick }) {
  return <div className="auth"><Bunny mood="hello" size={150} /><h1>{APP1}</h1><p style={{ fontSize: 19 }}>{TAGLINE}</p>
    {[["family", "I need care", "Find a babysitter, nanny or au pair", "🏡"], ["carer", "I give care", "Find families. Carers always use it free.", "💛"]].map(([k, t, d, e], i) =>
      <motion.button key={k} className="pick" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring, delay: .1 + i * .1 }} whileTap={{ scale: .97 }} onClick={() => { haptic(); setSide(k); onPick(k); }}><span style={{ fontSize: 34 }}>{e}</span><span><b>{t}</b><br /><small>{d}</small></span></motion.button>)}
  </div>;
}

const STEPS = [
  ["Your first screen", "Swipe right to like, left to pass. Tap the % to see why you match."],
  ["Priorities", "Tell us what matters most. We use it to sort your matches."],
  ["Distance", "Choose how far you are happy to go. The map shows everyone."],
  ["Checks", "A badge means a real check happened. Uploading a paper is not enough."],
  ["Messages", "Say hello when you like someone. When you both say yes, you can chat."],
];
export function Tour({ onDone }) {
  const [i, setI] = useState(0);
  const mood = ["hello", "point", "point", "think", "encourage"][i];
  return <motion.div className="tour" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <button className="skip" onClick={onDone}>Skip</button>
    <Bunny mood={mood} size={140} />
    <AnimatePresence mode="wait"><motion.div key={i} className="bubble" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}><h2>{STEPS[i][0]}</h2><p>{STEPS[i][1]}</p></motion.div></AnimatePresence>
    <div className="dotsRow">{STEPS.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}</div>
    <button className="btn" onClick={() => { haptic(); i < 4 ? setI(i + 1) : onDone(); }}>{i < 4 ? "Next" : "Let's go"}</button>
  </motion.div>;
}

function Ring({ pct }) { const r = 22, c = 2 * Math.PI * r; return <svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r={r} stroke="var(--line)" strokeWidth="6" fill="none" /><motion.circle cx="28" cy="28" r={r} stroke="var(--ink)" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={c} animate={{ strokeDashoffset: c * (1 - pct) }} transform="rotate(-90 28 28)" /></svg>; }
const Cards = ({ opts, val, multi, onChange }) => <div className="cards">{opts.map(([k, l, e]) => { const on = multi ? (val || []).includes(k) : val === k; return <motion.button key={k} whileTap={{ scale: .95 }} className={"sc" + (on ? " on" : "")} onClick={() => { haptic(); onChange(multi ? (on ? val.filter((x) => x !== k) : [...(val || []), k]) : k); }}>{e && <span style={{ fontSize: 26 }}>{e}</span>}{l}</motion.button>; })}</div>;
const AGES = [["0-1", "Baby 0-1"], ["1-3", "Toddler 1-3"], ["3-5", "Preschool 3-5"], ["5-8", "School 5-8"], ["8-12", "Older 8-12"], ["12+", "Teen 12+"]];
const LANGS = ["English", "Spanish", "Arabic", "Hindi", "Vietnamese", "Cantonese", "Mandarin", "French", "Italian"].map((l) => [l, l]);
const dayMap = (arr) => Object.fromEntries((arr || []).map((d) => [d, ["morning", "afternoon"]]));

export function Builder({ user, side, onDone }) {
  const fam = side === "family";
  const [a, setA] = useState({ name: user.displayName || "", postcode: "", ages: [], care: [], days: [], budget: "", about: "", langs: [], years: "", rate: "", headline: "", flexible: false, drives: false });
  const [i, setI] = useState(0), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const set = (k) => (v) => setA((s) => ({ ...s, [k]: v }));
  const T = (k, ph, type = "text") => <input className="field" type={type} placeholder={ph} value={a[k]} onChange={(e) => set(k)(e.target.value)} />;
  const steps = fam ? [
    ["What should we call your family?", "A first name or nickname is fine. No exact address is shown.", <>{T("name", "Family name")}{T("postcode", "Postcode", "tel")}</>, a.name.trim() && a.postcode.trim()],
    ["How old are your children?", "Pick all that fit. Photos and exact ages stay private until you share them.", <Cards multi opts={AGES} val={a.ages} onChange={set("ages")} />, a.ages.length],
    ["What kind of care?", "Choose one or more.", <Cards multi opts={[["babysitter", "Babysitter", "🌙"], ["nanny", "Nanny", "☀️"], ["aupair", "Au pair", "🌍"]]} val={a.care} onChange={set("care")} />, a.care.length],
    ["Which days do you need help?", "Tap the days. Say if you are flexible.", <><Cards multi opts={DAYS.map((d) => [d, d])} val={a.days} onChange={set("days")} /><Cards multi opts={[["flex", "I am flexible", "🔁"]]} val={a.flexible ? ["flex"] : []} onChange={(v) => set("flexible")(v.length > 0)} /></>, a.days.length || a.flexible],
    ["What is your budget?", "Per hour. You can change it any time.", <Cards opts={[["25", "Up to $25"], ["35", "Up to $35"], ["45", "Up to $45"], ["60", "$60+"]]} val={a.budget} onChange={set("budget")} />, a.budget],
    ["Languages and values", "Pick languages you would like at home.", <Cards multi opts={LANGS} val={a.langs} onChange={set("langs")} />, true],
    ["Tell carers about you", "Two or three kind sentences. You confirm the words.", <textarea className="field" rows={5} placeholder="We are a busy family who loves the outdoors..." value={a.about} onChange={(e) => set("about")(e.target.value)} />, true],
  ] : [
    ["What should families call you?", "First name only. Your photo can be added in Profile.", <>{T("name", "First name")}{T("postcode", "Postcode", "tel")}</>, a.name.trim() && a.postcode.trim()],
    ["Your headline", "One short line families see first.", <>{T("headline", "Warm, reliable nanny with 5 years experience")}</>, true],
    ["Which ages do you like?", "Pick all that fit.", <Cards multi opts={AGES} val={a.ages} onChange={set("ages")} />, a.ages.length],
    ["Your experience", "Years of paid or family childcare.", <Cards opts={[["1", "Under 2"], ["3", "2-4"], ["6", "5-9"], ["10", "10+"]]} val={a.years} onChange={set("years")} />, a.years],
    ["Languages you speak", "Families often search by language.", <Cards multi opts={LANGS} val={a.langs} onChange={set("langs")} />, a.langs.length],
    ["When are you free?", "Tap the days.", <><Cards multi opts={DAYS.map((d) => [d, d])} val={a.days} onChange={set("days")} /><Cards multi opts={[["flex", "I am flexible", "🔁"], ["car", "I drive", "🚗"]]} val={[...(a.flexible ? ["flex"] : []), ...(a.drives ? ["car"] : [])]} onChange={(v) => { set("flexible")(v.includes("flex")); set("drives")(v.includes("car")); }} /></>, a.days.length || a.flexible],
    ["Your rate", "Per hour. Carers pay nothing to use Caresitters.", <Cards opts={[["25", "$25"], ["30", "$30"], ["35", "$35"], ["45", "$45+"]]} val={a.rate} onChange={set("rate")} />, a.rate],
    ["About you", "Qualifications are added in Profile and show as submitted until a real check happens.", <textarea className="field" rows={5} placeholder="I love creative play and outdoor days..." value={a.about} onChange={(e) => set("about")(e.target.value)} />, true],
  ];
  const [title, sub, body, ok] = steps[i];
  const finish = async () => {
    setBusy(true); setErr("");
    const card = fam ? { postcode: a.postcode.trim(), firstName: a.name.trim(), childrenBands: a.ages, careType: a.care, scheduleNeed: dayMap(a.days), flexible: a.flexible, languages: a.langs, budgetMax: Number(a.budget) || null, about: a.about }
      : { postcode: a.postcode.trim(), firstName: a.name.trim(), headline: a.headline, agesAccepted: a.ages, experience: { years: a.years }, languages: a.langs, availability: dayMap(a.days), flexible: a.flexible, drives: a.drives, payFloor: Number(a.rate) || null, checksLevel: "", about: a.about };
    try { await D.saveProfile(user.uid, { side, displayName: a.name.trim(), about: a.about, postcode: a.postcode.trim(), card }); onDone(); }
    catch { setErr("Could not save. Check your connection and try again."); setBusy(false); }
  };
  return <div className="build"><div className="bTop"><button className="back" disabled={!i} onClick={() => setI(i - 1)} aria-label="Back">‹</button><div style={{ position: "relative" }}><Ring pct={(i + 1) / steps.length} /><span className="rn">{i + 1}/{steps.length}</span></div></div>
    <AnimatePresence mode="wait"><motion.div key={i} className="bBody" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} transition={{ duration: .2 }}><h1>{title}</h1><p style={{ opacity: .75, marginBottom: 14 }}>{sub}</p>{body}</motion.div></AnimatePresence>
    <p style={{ color: "#B3365A", minHeight: 22, textAlign: "center" }}>{err}</p>
    <button className="btn" disabled={!ok || busy} onClick={() => { haptic(); i < steps.length - 1 ? setI(i + 1) : finish(); }}>{busy ? "Saving..." : i < steps.length - 1 ? "Continue" : "Finish"}</button></div>;
}
