import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import hello from "./assets/bunny/bunny-hello.webp"; import point from "./assets/bunny/bunny-point.webp"; import celebrate from "./assets/bunny/bunny-celebrate.webp";
import encourage from "./assets/bunny/bunny-encourage.webp"; import oops from "./assets/bunny/bunny-oops.webp"; import rest from "./assets/bunny/bunny-rest.webp"; import think from "./assets/bunny/bunny-think.webp";
import "./bunny.css";
import { t } from "./i18n";
export type Mood = "hello" | "point" | "celebrate" | "encourage" | "oops" | "rest" | "think";
const IMG: Record<Mood, string> = { hello, point, celebrate, encourage, oops, rest, think };
const RATIO: Record<Mood, number> = { hello: .554, point: .584, celebrate: .695, encourage: .468, oops: .62, rest: .664, think: .671 };
const MOOD_LABELS: Record<Mood, { key: string; english: string }> = { hello: { key: "core.bunny.mood.hello", english: "waving" }, point: { key: "core.bunny.mood.point", english: "pointing" }, celebrate: { key: "core.bunny.mood.celebrate", english: "celebrating" }, encourage: { key: "core.bunny.mood.encourage", english: "encouraging" }, oops: { key: "core.bunny.mood.oops", english: "oops" }, rest: { key: "core.bunny.mood.rest", english: "resting" }, think: { key: "core.bunny.mood.think", english: "thinking" } };
export const MOODS = Object.keys(IMG) as Mood[];
const KEY = "caresits-bunny-calm";
export const isBunnyCalm = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
export const setBunnyCalm = (v: boolean) => { try { localStorage.setItem(KEY, v ? "1" : "0"); if (typeof window !== "undefined") window.dispatchEvent(new Event("bunny-calm-change")); } catch { /* off */ } };
export function shouldAnimateBunny(prefersReducedMotion: boolean, calm: boolean, visible: boolean): boolean { return !prefersReducedMotion && !calm && visible; }
export type BunnyHandle = { set(m: Mood): void; say(text: string, ms?: number): void };
export const Bunny = forwardRef<BunnyHandle, { mood?: Mood; size?: number; onTap?: () => void; caption?: string; className?: string }>(function Bunny({ mood = "hello", size = 140, onTap, caption, className }, ref) {
  const [m, setM] = useState<Mood>(mood), [prev, setPrev] = useState<Mood | null>(null), [hop, setHop] = useState(false), [lean, setLean] = useState(0), [vis, setVis] = useState(true), [cap, setCap] = useState(caption), [blink, setBlink] = useState(false), [look, setLook] = useState(0);
  const [calm, setCalm] = useState(isBunnyCalm), [reduced, setReduced] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const el = useRef<HTMLDivElement>(null);
  const run = shouldAnimateBunny(reduced, calm, vis);
  const change = (x: Mood) => setM((cur) => { if (cur !== x) { setPrev(cur); setTimeout(() => setPrev(null), 260); } return x; });
  useEffect(() => change(mood), [mood]); useEffect(() => setCap(caption), [caption]);
  useImperativeHandle(ref, () => ({ set: change, say: (t, ms = 3500) => { setCap(t); setTimeout(() => setCap(undefined), ms); } }));
  useEffect(() => { const media = matchMedia("(prefers-reduced-motion: reduce)"); const update = () => setReduced(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  useEffect(() => { const update = () => setCalm(isBunnyCalm()); window.addEventListener("bunny-calm-change", update); window.addEventListener("storage", update); return () => { window.removeEventListener("bunny-calm-change", update); window.removeEventListener("storage", update); }; }, []);
  useEffect(() => { if (!el.current || !("IntersectionObserver" in window)) return; const io = new IntersectionObserver(([e]) => setVis(!!e?.isIntersecting)); io.observe(el.current); return () => io.disconnect(); }, []);
  useEffect(() => { if (!run) return; const mv = (e: PointerEvent) => { const r = el.current?.getBoundingClientRect(); if (!r) return; setLean(Math.max(-1, Math.min(1, ((e.clientX - (r.left + r.width / 2)) / innerWidth) * 2)) * 3); }; addEventListener("pointermove", mv, { passive: true }); return () => removeEventListener("pointermove", mv); }, [run]);
  useEffect(() => { if (!run || onTap) return; const tapThrough = (event: PointerEvent) => { const r = el.current?.getBoundingClientRect(); if (!r || event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) return; setHop(true); window.setTimeout(() => setHop(false), 520); }; document.addEventListener("pointerdown", tapThrough, { passive: true }); return () => document.removeEventListener("pointerdown", tapThrough); }, [run, onTap]);
  useEffect(() => { if (!run) return; let timer = 0, blinkReset = 0; const loop = () => { timer = window.setTimeout(() => { setBlink(true); blinkReset = window.setTimeout(() => setBlink(false), 140); loop(); }, 3000 + Math.random() * 2000); }; loop(); return () => { clearTimeout(timer); clearTimeout(blinkReset); setBlink(false); }; }, [run]);
  useEffect(() => { if (!run) return; let lookReset = 0; const timer = window.setInterval(() => { setLook(Math.random() < .5 ? -1 : 1); clearTimeout(lookReset); lookReset = window.setTimeout(() => setLook(0), 1400); }, 9000); return () => { clearInterval(timer); clearTimeout(lookReset); setLook(0); }; }, [run]);
  const w = Math.round((size * RATIO[m]) / .62);
  const tap = () => { if (run) { setHop(true); setTimeout(() => setHop(false), 520); } onTap?.(); };
  const keyTap = (event: KeyboardEvent<HTMLDivElement>) => { if (onTap && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); tap(); } };
  const st = { width: Math.max(w, onTap ? 44 : 0), height: Math.max(size, onTap ? 44 : 0), pointerEvents: onTap ? "auto" : "none", ["--lean" as string]: `${lean + look * 1.5}deg` } as CSSProperties;
  const moodName = t(MOOD_LABELS[m].key, MOOD_LABELS[m].english);
  return <div ref={el} role={onTap ? "button" : "img"} aria-label={onTap ? t("core.bunny.tap", "Bunny, {mood}; tap to interact", { mood: moodName }) : t("core.bunny.label", "Bunny, {mood}", { mood: moodName })} tabIndex={onTap ? 0 : undefined} className={`bny${run ? " run" : ""}${hop ? " hop" : ""}${blink ? " blink" : ""} m-${m} ${className ?? ""}`} onClick={onTap ? tap : undefined} onKeyDown={keyTap} style={st}>
    <div className="bPose">{prev && <img className="bImg out" src={IMG[prev]} alt="" draggable={false} />}<img key={m} className="bImg in" src={IMG[m]} alt="" draggable={false} decoding="async" /></div>
    {cap && <div className="bCap" role="status" aria-live="polite" aria-atomic="true">{cap}</div>}</div>;
});
