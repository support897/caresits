import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from "react";
import hello from "./assets/bunny/bunny-hello.webp"; import point from "./assets/bunny/bunny-point.webp"; import celebrate from "./assets/bunny/bunny-celebrate.webp";
import encourage from "./assets/bunny/bunny-encourage.webp"; import oops from "./assets/bunny/bunny-oops.webp"; import rest from "./assets/bunny/bunny-rest.webp"; import think from "./assets/bunny/bunny-think.webp";
import "./bunny.css";
export type Mood = "hello" | "point" | "celebrate" | "encourage" | "oops" | "rest" | "think";
const IMG: Record<Mood, string> = { hello, point, celebrate, encourage, oops, rest, think };
const RATIO: Record<Mood, number> = { hello: .554, point: .584, celebrate: .695, encourage: .468, oops: .62, rest: .664, think: .671 };
export const MOODS = Object.keys(IMG) as Mood[];
const KEY = "caresits-bunny-calm";
export const isBunnyCalm = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
export const setBunnyCalm = (v: boolean) => { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* off */ } };
export type BunnyHandle = { set(m: Mood): void; say(text: string, ms?: number): void };
export const Bunny = forwardRef<BunnyHandle, { mood?: Mood; size?: number; onTap?: () => void; caption?: string; className?: string }>(function Bunny({ mood = "hello", size = 140, onTap, caption, className }, ref) {
  const [m, setM] = useState<Mood>(mood), [prev, setPrev] = useState<Mood | null>(null), [hop, setHop] = useState(false), [lean, setLean] = useState(0), [vis, setVis] = useState(true), [cap, setCap] = useState(caption), [blink, setBlink] = useState(false), [look, setLook] = useState(0);
  const el = useRef<HTMLDivElement>(null);
  const still = isBunnyCalm() || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const change = (x: Mood) => setM((cur) => { if (cur !== x) { setPrev(cur); setTimeout(() => setPrev(null), 260); } return x; });
  useEffect(() => change(mood), [mood]); useEffect(() => setCap(caption), [caption]);
  useImperativeHandle(ref, () => ({ set: change, say: (t, ms = 3500) => { setCap(t); setTimeout(() => setCap(undefined), ms); } }));
  useEffect(() => { if (!el.current || !("IntersectionObserver" in window)) return; const io = new IntersectionObserver(([e]) => setVis(!!e?.isIntersecting)); io.observe(el.current); return () => io.disconnect(); }, []);
  useEffect(() => { if (still) return; const mv = (e: PointerEvent) => { const r = el.current?.getBoundingClientRect(); if (!r) return; setLean(Math.max(-1, Math.min(1, ((e.clientX - (r.left + r.width / 2)) / innerWidth) * 2)) * 3); }; addEventListener("pointermove", mv, { passive: true }); return () => removeEventListener("pointermove", mv); }, [still]);
  useEffect(() => { if (still || !vis) return; let t: number; const loop = () => { t = window.setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 140); loop(); }, 3000 + Math.random() * 2000); }; loop(); return () => clearTimeout(t); }, [still, vis]);
  useEffect(() => { if (still || !vis) return; const t = setInterval(() => { setLook(Math.random() < .5 ? -1 : 1); setTimeout(() => setLook(0), 1400); }, 9000); return () => clearInterval(t); }, [still, vis]);
  const run = vis && !still, w = Math.round((size * RATIO[m]) / .62);
  const tap = () => { if (!still) { setHop(true); setTimeout(() => setHop(false), 520); } onTap?.(); };
  const st = { width: w, height: size, pointerEvents: onTap ? "auto" : "none", ["--lean" as string]: `${lean + look * 1.5}deg` } as CSSProperties;
  return <div ref={el} role="img" aria-label={`Bunny, ${m}`} className={`bny${run ? " run" : ""}${hop ? " hop" : ""}${blink ? " blink" : ""} m-${m} ${className ?? ""}`} onClick={tap} style={st}>
    <div className="bPose">{prev && <img className="bImg out" src={IMG[prev]} alt="" draggable={false} />}<img key={m} className="bImg in" src={IMG[m]} alt="" draggable={false} decoding="async" /></div>
    {cap && <div className="bCap" role="status">{cap}</div>}</div>;
});
