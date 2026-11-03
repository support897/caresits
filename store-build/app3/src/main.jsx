import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import "./style.css";
import { Bunny, setBunnyCalm } from "./bunny.jsx";
import { APP1, TAGLINE } from "./brand.js";
import * as D from "./data.js";
import { PRIORITIES, DAYS, RADIUS_STEPS, cyclePriority, emptyPrefs, label } from "../../www/app2/fit.js";

const haptic = (s = "light") => { try { const h = window.Capacitor?.Plugins?.Haptics; if (h) h.impact({ style: s === "heavy" ? "HEAVY" : "LIGHT" }); else navigator.vibrate?.(s === "heavy" ? 30 : 10); } catch {} };
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const spring = { type: "spring", stiffness: 420, damping: 32 };
const Ico = { discover: "M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zM8 9h8M8 13h5", matches: "M12 20s-7-4.4-7-9.6A4 4 0 0112 8a4 4 0 017 2.4C19 15.6 12 20 12 20z", messages: "M4 5h16v12H9l-5 4zM8 10h8M8 13h5", profile: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-7 8-7s8 3 8 7" };

function Auth() {
  const [e, setE] = useState(""), [p, setP] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setMsg("");
    try { try { await D.signInWithEmailAndPassword(D.auth(), e.trim(), p); } catch (er) { if (/user-not-found|invalid-credential/.test(er.code || "")) await D.createUserWithEmailAndPassword(D.auth(), e.trim(), p); else throw er; } }
    catch (er) { setMsg(/weak/.test(er.code) ? "Password needs 6+ characters." : /invalid|wrong/.test(er.code) ? "Email or password is not right." : "Could not sign in. Try again."); setBusy(false); }
  };
  return <div className="auth"><motion.div initial={{ scale: .5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}><Bunny mood="hello" size={130} /></motion.div>
    <h1>{APP1}</h1><p>{TAGLINE}</p>
    <input className="field" type="email" placeholder="you@example.com" value={e} onChange={(x) => setE(x.target.value)} autoComplete="email" />
    <input className="field" type="password" placeholder="Your password" value={p} onChange={(x) => setP(x.target.value)} autoComplete="current-password" />
    <button className="btn" onClick={go} disabled={busy || !e || !p}>{busy ? "One moment…" : "Continue"}</button>
    <p style={{ color: "#B3365A", minHeight: 22 }}>{msg}</p></div>;
}

function Ring({ pct }) {
  const r = 28, c = 2 * Math.PI * r;
  return <div className="pct"><svg viewBox="0 0 68 68"><circle cx="34" cy="34" r={r} fill="#1e4d44cc" stroke="#ffffff44" strokeWidth="6" />
    <motion.circle cx="34" cy="34" r={r} fill="none" stroke={pct >= 85 ? "#F6D67C" : "#9CC5B5"} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ duration: .9, ease: "easeOut" }} /></svg><b>{pct}%</b></div>;
}

function CardView({ p, me, top, onSwipe }) {
  const x = useMotionValue(0);
  const rot = useTransform(x, [-200, 0, 200], [-14, 0, 14]);
  const likeO = useTransform(x, [20, 120], [0, 1]), nopeO = useTransform(x, [-120, -20], [1, 0]);
  const [slide, setSlide] = useState(0);
  const photos = [p.photoUrl, ...(p.raw.gallery || [])].filter(Boolean);
  const days = DAYS.map((d) => { const m = p.card.scheduleNeed || p.card.availability || {}; return [d, !!(m[d] && (Array.isArray(m[d]) ? m[d].length : m[d]))]; });
  const kids = p.card.childrenBands || p.card.agesAccepted || [];
  const end = (_, i) => { if (i.offset.x > 110 || i.velocity.x > 600) onSwipe("like"); else if (i.offset.x < -110 || i.velocity.x < -600) onSwipe("nope"); else animate(x, 0, spring); };
  return <motion.div className="card" style={{ x, rotate: rot, zIndex: top ? 2 : 1 }} drag={top ? "x" : false} dragElastic={.9} dragMomentum={false} onDragEnd={end}
    initial={top ? false : { scale: .94, y: 14 }} animate={top ? { scale: 1, y: 0 } : { scale: .94, y: 14 }} exit={{ x: 600, opacity: 0, transition: { duration: .25 } }}>
    <motion.div className="stamp like" style={{ opacity: likeO }}>LIKE</motion.div><motion.div className="stamp nope" style={{ opacity: nopeO }}>PASS</motion.div>
    <div className="photo" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (photos.length > 1) { haptic(); setSlide((s) => (e.clientX - r.left > r.width / 2 ? Math.min(s + 1, photos.length - 1) : Math.max(s - 1, 0))); } }}>
      {photos.length ? <img src={photos[slide]} alt="" /> : <div className="initial">{p.name[0]}</div>}
      {photos.length > 1 && <div className="dots">{photos.map((_, i) => <i key={i} className={i === slide ? "on" : ""} />)}</div>}
      <div className="shade" /><div className="who"><h2>{p.name}</h2><small>{p.km != null ? `${p.km < 1 ? "<1" : Math.round(p.km)} km away` : "Distance unknown"}{p.postcode ? ` · ${p.postcode}` : ""}</small></div>
      <Ring pct={p.fit.pct} />
    </div>
    <div className="info">
      <b>{label(p.fit.pct)}</b>
      {p.about && <p style={{ margin: "6px 0" }}>{p.about}</p>}
      {kids.length > 0 && <div className="row">{kids.map((k) => <span className="tag" key={k}>{k}</span>)}</div>}
      <div className="days">{days.map(([d, on]) => <span key={d} className={on ? "on" : ""}>{d[0]}</span>)}</div>
      <h3 style={{ fontSize: 18, marginTop: 10 }}>Why it matches you</h3>
      <ul className="why">{(p.fit.reasons || []).slice(0, 4).map((r, i) => <li key={i}>✓ {r.text || r}</li>)}{(p.fit.gaps || []).slice(0, 2).map((g, i) => <li key={"g" + i}>! {g.text || g.id}</li>)}</ul>
    </div></motion.div>;
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({ i, x: Math.random() * 100, c: ["#F6CBD3", "#F6D67C", "#9CC5B5", "#fff"][i % 4], d: Math.random() * .5, r: Math.random() * 720 })), []);
  return <div className="confetti">{bits.map((b) => <motion.i key={b.i} style={{ position: "absolute", left: b.x + "%", top: -20, width: 10, height: 16, background: b.c, borderRadius: 3 }} animate={{ y: 900, rotate: b.r, opacity: [1, 1, 0] }} transition={{ duration: 2.2, delay: b.d }} />)}</div>;
}

function Discover({ me, people, prefs, setPrefs, radius, setRadius, loading }) {
  const [mode, setMode] = useState("swipe"), [seen, setSeen] = useState(() => ls("c3seen-" + me.uid, [])), [sheet, setSheet] = useState(null), [match, setMatch] = useState(null), [toast, setToast] = useState("");
  const ranked = useMemo(() => D.rank(me, people, prefs, radius), [me, people, prefs, radius]);
  const inside = ranked.filter((p) => !seen.includes(p.uid) && (radius === 0 || p.km == null || p.km <= radius));
  const near = ranked.filter((p) => !seen.includes(p.uid)).sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
  const deck = inside.slice(0, 2).reverse();
  const act = async (kind) => {
    const p = inside[0]; if (!p) return;
    haptic(kind === "like" ? "heavy" : "light");
    const next = [...seen, p.uid]; setSeen(next); localStorage.setItem("c3seen-" + me.uid, JSON.stringify(next));
    if (kind === "like") { try { const r = await D.like(me, p); if (r.match) setMatch(p); else { setToast("Interest sent ✨"); setTimeout(() => setToast(""), 1800); } } catch { setToast("Could not send. Try again."); setTimeout(() => setToast(""), 2200); } }
  };
  const undo = () => { const l = seen[seen.length - 1]; if (!l) return; const n = seen.slice(0, -1); setSeen(n); localStorage.setItem("c3seen-" + me.uid, JSON.stringify(n)); haptic(); };
  return <div style={{ height: "100%" }}>
    <div className="deckTop"><span className="logo">Caresitters</span><button className="chip" onClick={() => setSheet("radius")}>{radius ? radius + " km" : "Anywhere"} ▾</button></div>
    <Seg value={mode} onChange={setMode} items={[["swipe", "Swipe"], ["list", "List"]]} />
    {loading ? <div className="deck"><div className="sk" style={{ position: "absolute", inset: 0, borderRadius: 28 }} /></div> :
      mode === "swipe" ? (inside.length ? <>
        <div className="deck"><AnimatePresence>{deck.map((p, idx) => <CardView key={p.uid} p={p} me={me} top={idx === deck.length - 1} onSwipe={act} />)}</AnimatePresence></div>
        <div className="actions"><button className="fab sm" onClick={undo} aria-label="Undo"><svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" /></svg></button>
          <button className="fab" onClick={() => act("nope")} aria-label="Pass"><svg viewBox="0 0 24 24" style={{ color: "#E8607A" }}><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          <button className="fab big" onClick={() => act("like")} aria-label="Like"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-9.6A4 4 0 0112 8a4 4 0 017 2.4C19 15.6 12 20 12 20z" /></svg></button>
          <button className="fab sm" onClick={() => setSheet("prio")} aria-label="What matters"><svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6" /></svg></button></div></> :
        <div className="deck empty"><div style={{ fontSize: 56 }}>🧭</div><h2>No one within {radius || "your"} km</h2><p>{near[0] ? `Closest is ${near[0].name}, ${Math.round(near[0].km ?? 0)} km away.` : "New people join all the time."}</p><button className="btn" style={{ marginTop: 14 }} onClick={() => setRadius(radius ? (RADIUS_STEPS.find((s) => s > radius) ?? 0) : 0)}>Widen search</button></div>)
      : <div className="scroll" style={{ position: "absolute", inset: "96px 0 0" }}>{near.map((p) => <div className="li" key={p.uid}><Avatar p={p} /><div style={{ flex: 1 }}><b>{p.name}</b><div style={{ fontSize: 13, opacity: .7 }}>{p.km != null ? Math.round(p.km) + " km" : "—"} · {label(p.fit.pct)}</div></div><b>{p.fit.pct}%</b></div>)}</div>}
    <AnimatePresence>{sheet === "radius" && <Sheet onClose={() => setSheet(null)}><h2>How far?</h2><div className="row" style={{ margin: "14px 0" }}>{RADIUS_STEPS.map((s) => <button key={s} className="tag" style={{ padding: "10px 16px", background: s === radius ? "var(--ink)" : "", color: s === radius ? "#fff" : "" }} onClick={() => { haptic(); setRadius(s); }}>{s ? s + " km" : "Anywhere"}</button>)}</div><button className="btn" onClick={() => setSheet(null)}>Done</button></Sheet>}
      {sheet === "prio" && <Sheet onClose={() => setSheet(null)}><h2>What matters to you?</h2><p style={{ opacity: .7 }}>Tap to cycle: nice, important, must.</p><div className="row">{(PRIORITIES[me.side] || []).map((it) => { const lv = prefs.levels[it.id]; return <button key={it.id} className="tag" style={{ padding: "10px 14px", background: lv === "must" ? "var(--ink)" : lv === "important" ? "var(--butter)" : lv === "nice" ? "var(--blush)" : "", color: lv === "must" ? "#fff" : "" }} onClick={() => { haptic(); setPrefs({ ...prefs, levels: cyclePriority(prefs.levels, it.id) }); }}>{it.label || it.id}{lv ? " · " + lv : ""}</button>; })}</div><button className="btn" style={{ marginTop: 14 }} onClick={() => setSheet(null)}>Show my matches</button></Sheet>}
    </AnimatePresence>
    <AnimatePresence>{match && <motion.div className="match" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Confetti /><motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: .6 }}><Bunny mood="celebrate" size={150} /></motion.div><h1>It's a match!</h1><p>You and {match.name} both said yes.</p><button className="btn alt" style={{ maxWidth: 280 }} onClick={() => setMatch(null)}>Keep swiping</button></motion.div>}</AnimatePresence>
    <AnimatePresence>{toast && <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "absolute", bottom: 100, left: 0, right: 0, textAlign: "center", zIndex: 40 }}><span className="chip" style={{ background: "var(--ink)", color: "#fff" }}>{toast}</span></motion.div>}</AnimatePresence>
  </div>;
}

const Avatar = ({ p }) => <div className="av">{p.photoUrl ? <img src={p.photoUrl} alt="" /> : p.name[0]}</div>;
function Sheet({ children, onClose }) { return <motion.div className="sheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}><motion.div className="sheetBody" initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }} transition={spring} onClick={(e) => e.stopPropagation()} drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: .6 }} onDragEnd={(_, i) => i.offset.y > 100 && onClose()}><div className="grab" />{children}</motion.div></motion.div>; }
function Seg({ value, onChange, items }) { const i = items.findIndex((x) => x[0] === value); return <div className="seg" style={{ position: "relative" }}><motion.div className="pill" animate={{ left: `calc(${(100 / items.length) * i}% + 3px)`, width: `calc(${100 / items.length}% - 6px)` }} transition={spring} />{items.map(([k, l]) => <button key={k} onClick={() => { haptic(); onChange(k); }}>{l}</button>)}</div>; }

function Matches({ me, rels, people }) {
  const by = Object.fromEntries(people.map((p) => [p.uid, p]));
  const other = (r) => by[r.members.find((m) => m !== me.uid)];
  const incoming = rels.filter((r) => r.state === "pending" && r.createdBy !== me.uid), live = rels.filter((r) => r.state !== "pending" && r.state !== "ended"), sent = rels.filter((r) => r.state === "pending" && r.createdBy === me.uid);
  const Row = ({ r, act }) => { const o = other(r); return <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="li"><Avatar p={o || { name: "?" }} /><div style={{ flex: 1 }}><b>{o?.name || "Member"}</b></div>{act}</motion.div>; };
  return <div className="scroll"><h1 style={{ margin: "8px 0 14px" }}>Matches</h1>
    {incoming.length > 0 && <><h3>Likes you</h3>{incoming.map((r) => <Row key={r.id} r={r} act={<button className="chip" style={{ background: "var(--ink)", color: "#fff" }} onClick={async () => { haptic("heavy"); await D.acceptRel(r.id); location.reload(); }}>Say yes</button>} />)}</>}
    {live.length > 0 && <><h3>Connected</h3>{live.map((r) => <Row key={r.id} r={r} act={<span className="chip">Matched</span>} />)}</>}
    {sent.length > 0 && <><h3>Waiting</h3>{sent.map((r) => <Row key={r.id} r={r} act={<span style={{ opacity: .6 }}>Sent</span>} />)}</>}
    {!rels.length && <div className="empty"><div style={{ fontSize: 56 }}>💌</div><h2>No matches yet</h2><p>Swipe right on people you like. They show up here.</p></div>}</div>;
}

function Messages({ me, rels, people }) {
  const live = rels.filter((r) => r.state === "contact" || r.state === "hired");
  const by = Object.fromEntries(people.map((p) => [p.uid, p]));
  return <div className="scroll"><h1 style={{ margin: "8px 0 14px" }}>Messages</h1>
    {live.map((r) => { const o = by[r.members.find((m) => m !== me.uid)]; return <a key={r.id} className="li" style={{ color: "inherit", textDecoration: "none" }} href={"../app2/index.html#thread"}><Avatar p={o || { name: "?" }} /><div style={{ flex: 1 }}><b>{o?.name || "Member"}</b><div style={{ fontSize: 13, opacity: .7 }}>Open chat</div></div>›</a>; })}
    {!live.length && <div className="empty"><div style={{ fontSize: 56 }}>💬</div><h2>No chats yet</h2><p>Chat opens when you both say yes.</p></div>}</div>;
}

function Profile({ me }) {
  const [about, setAbout] = useState(me.about), [saved, setSaved] = useState(false);
  const save = async () => { await D.saveProfile(me.uid, { about }); setSaved(true); haptic(); setTimeout(() => setSaved(false), 1600); };
  return <div className="scroll"><div style={{ textAlign: "center", padding: "12px 0" }}><div className="av" style={{ width: 96, height: 96, margin: "0 auto", fontSize: 40 }}>{me.photoUrl ? <img src={me.photoUrl} alt="" /> : me.name[0]}</div><h1 style={{ marginTop: 10 }}>{me.name}</h1><span className="chip">{me.side === "family" ? "Family" : "Carer"} · {me.postcode}</span></div>
    <h3>About</h3><textarea className="field" rows={4} value={about} onChange={(e) => setAbout(e.target.value)} />
    <button className="btn" onClick={save}>{saved ? "Saved ✓" : "Save changes"}</button>
    <a className="btn alt" style={{ display: "block", textAlign: "center", marginTop: 10, textDecoration: "none" }} href="../app2/index.html#profile">Edit full profile and badges</a>
    <label className="chip" style={{ display: "flex", gap: 10, margin: "14px 0", padding: 14, fontSize: 17 }}><input type="checkbox" defaultChecked={localStorage.getItem("caresits-bunny-calm") === "1"} onChange={(e) => setBunnyCalm(e.target.checked)} /> Turn the bunny down</label>
    <button className="btn alt" style={{ marginTop: 10 }} onClick={() => D.signOut(D.auth())}>Sign out</button></div>;
}

function App() {
  const [user, setUser] = useState(undefined), [me, setMe] = useState(null), [people, setPeople] = useState([]), [rels, setRels] = useState([]), [tab, setTab] = useState("discover"), [loading, setLoading] = useState(true), [err, setErr] = useState("");
  const [prefs, setPrefsS] = useState(() => ls("caresits-discover-prefs-x", emptyPrefs())), [radius, setRadiusS] = useState(() => ls("caresits-discover-radius-x", 25));
  useEffect(() => { (async () => { await D.restoreSessionMirror(); const a = D.auth(); await D.waitForSession(a); D.onAuthStateChanged(a, (u) => setUser(u || null)); })(); }, []);
  useEffect(() => {
    if (!user) return; (async () => {
      try { const m = await D.loadMe(user.uid); setMe(m); if (m) { const [p, r] = await Promise.all([D.loadPeople(m), D.loadRels(user.uid)]); setPeople(p); setRels(r); } } catch (e) { setErr("Could not load. Pull to retry."); }
      setLoading(false);
    })();
  }, [user]);
  const setPrefs = (p) => { setPrefsS(p); localStorage.setItem("caresits-discover-prefs-x", JSON.stringify(p)); };
  const setRadius = (r) => { setRadiusS(r); localStorage.setItem("caresits-discover-radius-x", JSON.stringify(r)); };
  if (user === undefined) return <div className="auth"><div className="sk" style={{ height: 80 }} /></div>;
  if (!user) return <Auth />;
  if (!loading && !me) return <div className="auth"><Bunny mood="hello" size={150} /><h1>Let's build your profile</h1><p>A few quick questions so we can match you well.</p><a className="btn" style={{ textDecoration: "none" }} href="../app2/index.html">Start</a></div>;
  const tabs = [["discover", "Discover"], ["matches", "Matches"], ["messages", "Messages"], ["profile", "Profile"]];
  const pips = rels.filter((r) => r.state === "pending" && r.createdBy !== user.uid).length;
  return <div className="app"><div className="screen">
    {err && <div className="chip" style={{ position: "absolute", top: 8, left: 16, right: 16, zIndex: 60, textAlign: "center", background: "var(--butter)" }}>{err}</div>}
    <AnimatePresence mode="wait"><motion.div key={tab} style={{ height: "100%" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
      {tab === "discover" && me && <Discover {...{ me, people, prefs, setPrefs, radius, setRadius, loading }} />}
      {tab === "matches" && me && <Matches me={me} rels={rels} people={people} />}
      {tab === "messages" && me && <Messages me={me} rels={rels} people={people} />}
      {tab === "profile" && me && <Profile me={me} />}
    </motion.div></AnimatePresence></div>
    <nav className="tabs"><motion.div className="bar" animate={{ left: `calc(${tabs.findIndex((t) => t[0] === tab) * 25}% + 4%)`, width: "17%" }} transition={spring} />
      {tabs.map(([k, l]) => <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => { haptic(); setTab(k); }}><svg viewBox="0 0 24 24"><path d={Ico[k]} /></svg>{l}{k === "matches" && pips > 0 && <span className="pip">{pips}</span>}</button>)}</nav></div>;
}
createRoot(document.getElementById("root")).render(<App />);
