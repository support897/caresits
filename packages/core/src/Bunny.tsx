import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import "./bunny.css";
import { t } from "./i18n";
// One layered vector bunny (no images). Geometry and colours come from the interactive build brief.
export type Mood = "hello" | "point" | "celebrate" | "encourage" | "oops" | "rest" | "think";
export const MOODS: Mood[] = ["hello", "point", "celebrate", "encourage", "oops", "rest", "think"];
const MOOD_LABELS: Record<Mood, { key: string; english: string }> = {
  hello: { key: "core.bunny.mood.hello", english: "waving" }, point: { key: "core.bunny.mood.point", english: "pointing" },
  celebrate: { key: "core.bunny.mood.celebrate", english: "celebrating" }, encourage: { key: "core.bunny.mood.encourage", english: "encouraging" },
  oops: { key: "core.bunny.mood.oops", english: "oops" }, rest: { key: "core.bunny.mood.rest", english: "resting" }, think: { key: "core.bunny.mood.think", english: "thinking" },
};
const KEY = "caresits-bunny-calm";
export const isBunnyCalm = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
export const setBunnyCalm = (v: boolean) => { try { localStorage.setItem(KEY, v ? "1" : "0"); if (typeof window !== "undefined") window.dispatchEvent(new Event("bunny-calm-change")); } catch { /* off */ } };
export function shouldAnimateBunny(prefersReducedMotion: boolean, calm: boolean, visible: boolean): boolean { return !prefersReducedMotion && !calm && visible; }
export type BunnyHandle = { set(m: Mood): void; say(text: string, ms?: number): void; hop(): void };
const PINK = "#F4A9BC", PINK_IN = "#F9D3DC", CHEEK = "#F6CBD3", BELLY = "#FBE6D3", HEART = "#E6AD9E", INK = "#2b2023", NOSE = "#D6335F";

function Eyes({ mood, look }: { mood: Mood; look: { x: number; y: number } }) {
  if (mood === "celebrate" || mood === "rest") {
    const d = mood === "rest" ? "M74 96q8 6 16 0M110 96q8 6 16 0" : "M74 98q8-9 16 0M110 98q8-9 16 0";
    return <path d={d} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />;
  }
  const ox = look.x * 3.2 + (mood === "think" ? 2 : 0), oy = look.y * 2.6 + (mood === "think" ? -3 : mood === "oops" ? 1 : 0);
  return <g className="b-eyes"><g className="b-pupils" style={{ transform: `translate(${ox}px,${oy}px)` }}>
    <circle cx="82" cy="94" r="8" fill={INK} /><circle cx="118" cy="94" r="8" fill={INK} /><circle cx="85" cy="91" r="2.8" fill="#fff" /><circle cx="121" cy="91" r="2.8" fill="#fff" /></g></g>;
}
function Mouth({ mood }: { mood: Mood }) {
  const nose = <ellipse cx="100" cy="106" rx="5" ry="3.6" fill={NOSE} />;
  if (mood === "celebrate") return <>{nose}<path d="M90 113q10 13 20 0z" fill="#8f2a47" stroke={INK} strokeWidth="2" strokeLinejoin="round" /></>;
  if (mood === "oops") return <>{nose}<path d="M92 120q8-7 16 0" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" /></>;
  if (mood === "think") return <>{nose}<path d="M95 116h10" stroke={INK} strokeWidth="2.4" strokeLinecap="round" /></>;
  if (mood === "rest") return <>{nose}<path d="M95 115q5 4 10 0" stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" /></>;
  return <>{nose}<path d="M92 114q8 8 16 0" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" /></>;
}
function Arms({ mood }: { mood: Mood }) {
  const arm = (cls: string, cx: number, cy: number, rot: number, rx = 9, ry = 24) => <ellipse className={`b-arm ${cls}`} cx={cx} cy={cy} rx={rx} ry={ry} fill={PINK} transform={`rotate(${rot} ${cx} ${cy})`} />;
  if (mood === "hello") return <>{arm("a-rest", 62, 160, 14)}<g className="b-wave" style={{ transformOrigin: "146px 150px" }}>{arm("", 150, 128, -24)}<circle cx="156" cy="104" r="8" fill={PINK} /></g></>;
  if (mood === "point") return <>{arm("a-rest", 62, 160, 14)}<g>{arm("", 156, 160, -78, 9, 26)}<circle cx="184" cy="152" r="8" fill={PINK} /><ellipse cx="193" cy="150" rx="7" ry="4" fill={PINK} /></g></>;
  if (mood === "celebrate") return <><g className="b-clap-l" style={{ transformOrigin: "62px 150px" }}>{arm("", 58, 118, 22, 9, 26)}<circle cx="70" cy="92" r="8" fill={PINK} /></g><g className="b-clap-r" style={{ transformOrigin: "138px 150px" }}>{arm("", 142, 118, -22, 9, 26)}<circle cx="130" cy="92" r="8" fill={PINK} /></g></>;
  if (mood === "encourage") return <>{arm("a-rest", 62, 160, 14)}{arm("", 140, 130, -30, 9, 26)}<circle cx="150" cy="106" r="8" fill={PINK} /><rect x="146" y="92" width="6" height="12" rx="3" fill={PINK} /></>;
  if (mood === "think") return <>{arm("a-rest", 62, 160, 14)}{arm("", 112, 146, 60, 9, 24)}<circle cx="104" cy="126" r="8" fill={PINK} /></>;
  if (mood === "oops") return <>{arm("", 66, 130, 38, 9, 24)}{arm("", 134, 130, -38, 9, 24)}<circle cx="82" cy="112" r="7" fill={PINK} /><circle cx="118" cy="112" r="7" fill={PINK} /></>;
  return <>{arm("a-rest", 62, 160, 14)}{arm("a-rest", 138, 160, -14)}</>;
}
function Extras({ mood }: { mood: Mood }) {
  if (mood === "celebrate") return <g className="b-spark" fill="#F2B84B"><path d="M26 40l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" /><path d="M176 28l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" /><circle cx="170" cy="84" r="3" fill={PINK} /><circle cx="30" cy="96" r="3" fill={PINK} /></g>;
  if (mood === "oops") return <path className="b-drop" d="M150 62c-7 10-9 15-9 19a9 9 0 0018 0c0-4-2-9-9-19z" fill="#8EC5E8" />;
  if (mood === "think") return <g className="b-bubble"><circle cx="150" cy="58" r="5" fill="#fff" stroke={HEART} strokeWidth="1.5" /><circle cx="162" cy="40" r="8" fill="#fff" stroke={HEART} strokeWidth="1.5" /><text x="162" y="46" textAnchor="middle" fontSize="15" fontWeight="700" fill={NOSE}>?</text></g>;
  if (mood === "rest") return <g className="b-zzz" fill={HEART} fontWeight="700" fontFamily="var(--font-title)"><text x="146" y="48" fontSize="20">z</text><text x="160" y="30" fontSize="15">z</text></g>;
  return null;
}
export const Bunny = forwardRef<BunnyHandle, { mood?: Mood; size?: number; onTap?: () => void; caption?: string; className?: string }>(function Bunny({ mood = "hello", size = 140, onTap, caption, className }, ref) {
  const [m, setM] = useState<Mood>(mood), [hop, setHop] = useState(false), [vis, setVis] = useState(true), [cap, setCap] = useState(caption);
  const [look, setLook] = useState({ x: 0, y: 0 }), [tilt, setTilt] = useState(false);
  const [calm, setCalm] = useState(isBunnyCalm), [reduced, setReduced] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const el = useRef<HTMLDivElement>(null); const hopTimer = useRef(0); const uid = useId().replace(/:/g, "");
  const run = shouldAnimateBunny(reduced, calm, vis);
  const doHop = () => { setHop(true); clearTimeout(hopTimer.current); hopTimer.current = window.setTimeout(() => setHop(false), 700); };
  useEffect(() => setM(mood), [mood]); useEffect(() => setCap(caption), [caption]);
  useImperativeHandle(ref, () => ({ set: setM, hop: doHop, say: (text, ms = 3500) => { setCap(text); setTimeout(() => setCap(undefined), ms); } }));
  useEffect(() => { const media = matchMedia("(prefers-reduced-motion: reduce)"); const update = () => setReduced(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  useEffect(() => { const update = () => setCalm(isBunnyCalm()); window.addEventListener("bunny-calm-change", update); window.addEventListener("storage", update); return () => { window.removeEventListener("bunny-calm-change", update); window.removeEventListener("storage", update); }; }, []);
  useEffect(() => { if (!el.current || !("IntersectionObserver" in window)) return; const io = new IntersectionObserver(([e]) => setVis(!!e?.isIntersecting)); io.observe(el.current); return () => io.disconnect(); }, []);
  // Eyes follow the finger or pointer; a still user makes the bunny tilt its head.
  useEffect(() => {
    if (!run) { setLook({ x: 0, y: 0 }); setTilt(false); return; }
    let idle = 0;
    const bump = () => { setTilt(false); clearTimeout(idle); idle = window.setTimeout(() => setTilt(true), 7000); };
    const mv = (e: PointerEvent) => { const r = el.current?.getBoundingClientRect(); if (!r) return; const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * .4); const d = Math.hypot(dx, dy) || 1; const k = Math.min(1, d / 160); setLook({ x: (dx / d) * k, y: (dy / d) * k }); bump(); };
    addEventListener("pointermove", mv, { passive: true }); addEventListener("pointerdown", mv, { passive: true }); bump();
    return () => { removeEventListener("pointermove", mv); removeEventListener("pointerdown", mv); clearTimeout(idle); };
  }, [run]);
  // Occasional look-around when nobody touches the screen.
  useEffect(() => { if (!run) return; let back = 0; const timer = window.setInterval(() => { setLook({ x: Math.random() < .5 ? -1 : 1, y: Math.random() * .6 - .3 }); clearTimeout(back); back = window.setTimeout(() => setLook({ x: 0, y: 0 }), 1300); }, 8000); return () => { clearInterval(timer); clearTimeout(back); }; }, [run]);
  // Taps anywhere on the bunny hop, even when it never blocks touches.
  useEffect(() => { if (!run || onTap) return; const tapThrough = (event: PointerEvent) => { const r = el.current?.getBoundingClientRect(); if (!r || event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) return; doHop(); }; document.addEventListener("pointerdown", tapThrough, { passive: true }); return () => document.removeEventListener("pointerdown", tapThrough); }, [run, onTap]);
  const tap = () => { if (run) doHop(); onTap?.(); };
  const keyTap = (event: KeyboardEvent<HTMLDivElement>) => { if (onTap && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); tap(); } };
  const w = Math.round(size * 200 / 230);
  const st = { width: Math.max(w, onTap ? 44 : 0), height: Math.max(size, onTap ? 44 : 0), pointerEvents: onTap ? "auto" : "none" } as CSSProperties;
  const moodName = t(MOOD_LABELS[m].key, MOOD_LABELS[m].english);
  const droop = m === "oops" || m === "rest";
  return <div ref={el} role={onTap ? "button" : "img"} aria-label={onTap ? t("core.bunny.tap", "Bunny, {mood}; tap to interact", { mood: moodName }) : t("core.bunny.label", "Bunny, {mood}", { mood: moodName })} tabIndex={onTap ? 0 : undefined} className={`bny${run ? " run" : ""}${hop ? " hop" : ""}${tilt ? " tilt" : ""} m-${m} ${className ?? ""}`} onClick={onTap ? tap : undefined} onKeyDown={keyTap} style={st}>
    <svg viewBox="0 0 200 230" aria-hidden="true" focusable="false" data-bunny={uid}>
      <ellipse className="b-shadow" cx="100" cy="226" rx="46" ry="4" fill="#000" opacity=".09" />
      <g className="b-all">
        <g className={`b-ear b-earL${droop ? " droop" : ""}`}><ellipse cx="72" cy="38" rx="17" ry="42" transform="rotate(-8 72 38)" fill={PINK} /><ellipse cx="73" cy="42" rx="8" ry="28" transform="rotate(-8 72 42)" fill={PINK_IN} /></g>
        <g className={`b-ear b-earR${droop ? " droop" : ""}`}><ellipse cx="128" cy="38" rx="17" ry="42" transform="rotate(8 128 38)" fill={PINK} /><ellipse cx="127" cy="42" rx="8" ry="28" transform="rotate(8 128 42)" fill={PINK_IN} /></g>
        <g className="b-body">
          <ellipse cx="100" cy="168" rx="46" ry="52" fill={PINK} /><ellipse cx="100" cy="172" rx="29" ry="34" fill={BELLY} />
          <path d="M100 192c-17-12-24-21-24-30 0-8 6-12 12-12 5 0 9 3 12 7 3-4 7-7 12-7 6 0 12 4 12 12 0 9-7 18-24 30z" fill={HEART} />
          <ellipse cx="78" cy="218" rx="16" ry="8" fill={PINK} /><ellipse cx="122" cy="218" rx="16" ry="8" fill={PINK} />
          <Arms mood={m} />
          <g className="b-head"><circle cx="100" cy="96" r="46" fill={PINK} /><circle cx="72" cy="108" r="9" fill={CHEEK} /><circle cx="128" cy="108" r="9" fill={CHEEK} />
            <Eyes mood={m} look={look} /><Mouth mood={m} /></g>
        </g>
        <Extras mood={m} />
      </g>
    </svg>
    {cap && <div className="bCap" role="status" aria-live="polite" aria-atomic="true">{cap}</div>}</div>;
});
