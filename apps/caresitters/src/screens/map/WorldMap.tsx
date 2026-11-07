import { useEffect, useMemo, useRef, useState } from "react";
import { agentSay, haptic, t } from "@cc/core";
import type { DeckRow } from "../discover/SwipeDeck";
import { coords, suburbOf } from "../discover/helpers";
import { WORLD_H, WORLD_PATH, WORLD_W, project } from "./worldGeo";
import "./map.css";

/** Pins are placed on a coarse grid (about 5 to 10 km) so nobody's home is ever shown exactly. */
export const FUZZ_DEGREES = 0.08;
export function fuzz(v: number): number { return Math.round(v / FUZZ_DEGREES) * FUZZ_DEGREES; }
export type Pin = { uid: string; x: number; y: number; row: DeckRow };
export function buildPins(rows: DeckRow[]): Pin[] {
  return rows.flatMap((row) => { const c = coords(row.person); if (!c) return []; const p = project(fuzz(c.lat), fuzz(c.lng)); return [{ uid: row.person.uid, x: p.x, y: p.y, row }]; });
}
export type Cluster = { id: string; x: number; y: number; pins: Pin[] };
/** Groups pins that would touch on screen. `cell` is in map units. */
export function clusterPins(pins: Pin[], cell: number): Cluster[] {
  const m = new Map<string, Pin[]>();
  for (const p of pins) { const k = `${Math.round(p.x / cell)}:${Math.round(p.y / cell)}`; (m.get(k) ?? m.set(k, []).get(k)!).push(p); }
  return [...m.entries()].map(([id, ps]) => ({ id, x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length, pins: ps }));
}
type View = { k: number; tx: number; ty: number };
const MAXK = 60;
function fitView(pins: Pin[], vw: number, vh: number): View {
  if (!pins.length) return { k: 1, tx: 0, ty: Math.max(0, (vh - WORLD_H) / 2) };
  const xs = pins.map((p) => p.x), ys = pins.map((p) => p.y);
  const w = Math.max(40, Math.max(...xs) - Math.min(...xs)), h = Math.max(40, Math.max(...ys) - Math.min(...ys));
  const k = Math.min(MAXK, Math.max(1, Math.min(vw / (w * 1.6), vh / (h * 1.9))));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return { k, tx: vw / 2 - cx * k, ty: vh / 2 - cy * k };
}
const PIN = "M0 0C-13-13-19-23-19-33A19 19 0 0 1 19-33C19-23 13-13 0 0Z";

export function WorldMap({ rows, savedIds, onSave, onOpen, focusUid }: { focusUid?: string; rows: DeckRow[]; savedIds: Set<string>; onSave: (row: DeckRow) => void; onOpen: (row: DeckRow) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [vb, setVb] = useState({ w: WORLD_W, h: 1100 });
  const [view, setView] = useState<View>({ k: 1, tx: 0, ty: 0 });
  const [sel, setSel] = useState<string | null>(focusUid ?? null);
  const pins = useMemo(() => buildPins(rows), [rows]);
  const fitted = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ d: number; k: number } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    const el = box.current; if (!el) return;
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width > 0) setVb({ w: WORLD_W, h: WORLD_W * (r.height / r.width) }); };
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => { agentSay("map-open"); }, []);
  useEffect(() => { if (!fitted.current && vb.h > 0) { fitted.current = true; setView(fitView(pins, vb.w, vb.h)); } }, [pins, vb]);

  const clamp = (v: View): View => {
    const k = Math.min(MAXK, Math.max(1, v.k));
    const minTx = vb.w - WORLD_W * k, minTy = vb.h - WORLD_H * k;
    return { k, tx: Math.min(0, Math.max(minTx, v.tx)), ty: WORLD_H * k <= vb.h ? (vb.h - WORLD_H * k) / 2 : Math.min(0, Math.max(minTy, v.ty)) };
  };
  const zoomAt = (factor: number, cx = vb.w / 2, cy = vb.h / 2) => setView((v) => { const k = Math.min(MAXK, Math.max(1, v.k * factor)); const f = k / v.k; return clamp({ k, tx: cx - (cx - v.tx) * f, ty: cy - (cy - v.ty) * f }); });
  const toVb = (e: { clientX: number; clientY: number }) => { const r = box.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) * vb.w / r.width, y: (e.clientY - r.top) * vb.h / r.height, s: vb.w / r.width }; };

  const clusters = useMemo(() => clusterPins(pins, 34 / view.k), [pins, view.k]);
  const selected = sel ? rows.find((r) => r.person.uid === sel) : undefined;

  return <div className="wm-wrap" data-testid="world-map">
    <div ref={box} className="wm-box" role="application" aria-label={t("map.label", "World map of nearby profiles")}
      onPointerDown={(e) => { pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved.current = false;
        if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; gesture.current = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), k: view.k }; } }}
      onPointerMove={(e) => {
        const prev = pointers.current.get(e.pointerId); if (!prev) return;
        const s = toVb(e).s; pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2 && gesture.current) { const [a, b] = [...pointers.current.values()]; const d = Math.hypot(a!.x - b!.x, a!.y - b!.y); const mid = toVb({ clientX: (a!.x + b!.x) / 2, clientY: (a!.y + b!.y) / 2 }); const target = gesture.current.k * d / gesture.current.d; zoomAt(target / view.k, mid.x, mid.y); moved.current = true; return; }
        const dx = (e.clientX - prev.x) * s, dy = (e.clientY - prev.y) * s; if (Math.abs(dx) + Math.abs(dy) > 1.5) { if (!moved.current) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); moved.current = true; }
        setView((v) => clamp({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
      }}
      onPointerUp={(e) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) gesture.current = null; }}
      onPointerCancel={(e) => { pointers.current.delete(e.pointerId); gesture.current = null; }}
      onWheel={(e) => { const p = toVb(e); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, p.x, p.y); }}>
      <svg viewBox={`0 0 ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet" className="wm-svg">
        <rect width={vb.w} height={vb.h} fill="#EEF7FE" />
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          <path d={WORLD_PATH} fill="#FFF5F8" stroke="#F4A9BC" strokeWidth={0.5 / view.k} strokeLinejoin="round" />
          {clusters.map((c) => {
            const one = c.pins.length === 1 ? c.pins[0]! : null; const inv = 2.3 / view.k;
            if (!one) return <g key={c.id} transform={`translate(${c.x} ${c.y}) scale(${inv})`} className="wm-pin" role="button" tabIndex={0} aria-label={t("map.cluster", "{n} profiles, zoom in", { n: c.pins.length })}
              onClick={() => { if (moved.current) return; zoomAt(2.4, c.x * view.k + view.tx, c.y * view.k + view.ty); haptic(); }} onKeyDown={(e) => { if (e.key === "Enter") zoomAt(2.4, c.x * view.k + view.tx, c.y * view.k + view.ty); }}>
              <circle r="21" fill="#fff" stroke="#C2335A" strokeWidth="3" /><text textAnchor="middle" y="6" fontSize="17" fontWeight="800" fill="#C2335A" fontFamily="var(--font-name)">{c.pins.length}</text></g>;
            const saved = savedIds.has(one.uid); const pct = typeof one.row.result.score === "number" ? Math.round(one.row.result.score) : null; const on = sel === one.uid;
            return <g key={c.id} transform={`translate(${one.x} ${one.y}) scale(${inv * (on ? 1.25 : 1)})`} className={`wm-pin${on ? " on" : ""}`} role="button" tabIndex={0} aria-label={`${one.row.person.firstName}${pct !== null ? `, ${pct}%` : ""}`}
              onClick={() => { if (moved.current) return; setSel(one.uid); haptic(); }} onKeyDown={(e) => { if (e.key === "Enter") setSel(one.uid); }}>
              <ellipse cx="-9" cy="-58" rx="5.5" ry="13" fill="#F4A9BC" transform="rotate(-12 -9 -50)" /><ellipse cx="9" cy="-58" rx="5.5" ry="13" fill="#F4A9BC" transform="rotate(12 9 -50)" />
              <path d={PIN} fill={saved ? "#FFD966" : "#C2335A"} stroke="#fff" strokeWidth="2.5" />
              <text textAnchor="middle" y="-28" fontSize={pct !== null && pct >= 100 ? 12 : 14} fontWeight="800" fill={saved ? "#3B2A33" : "#fff"} fontFamily="var(--font-name)">{pct !== null ? `${pct}%` : "♥"}</text></g>;
          })}
        </g>
      </svg>
      <div className="wm-ctrl">
        <button type="button" onClick={() => zoomAt(1.6)} aria-label={t("map.zoomIn", "Zoom in")}>+</button>
        <button type="button" onClick={() => zoomAt(1 / 1.6)} aria-label={t("map.zoomOut", "Zoom out")}>−</button>
        <button type="button" onClick={() => { setView(fitView(pins, vb.w, vb.h)); setSel(null); }} aria-label={t("map.fit", "Show everyone")}>◎</button>
      </div>
      {!pins.length && <p className="wm-empty" role="status">{t("map.empty", "No pins yet. People appear here when they share their area.")}</p>}
    </div>
    {selected && <article className="wm-sheet" aria-label={selected.person.firstName}>
      <button type="button" className="wm-sheet-main" onClick={() => onOpen(selected)}>
        <strong>{selected.person.firstName}</strong>
        <span>{[suburbOf(selected.person), selected.km !== null ? `${selected.km.toFixed(1)} km` : ""].filter(Boolean).join(" · ")}</span>
        {typeof selected.result.score === "number" && <span className="wm-pct">{Math.round(selected.result.score)}% {t("deck.match", "match")}</span>}
      </button>
      <button type="button" className={`wm-like${savedIds.has(selected.person.uid) ? " on" : ""}`} aria-label={t("deck.save", "Save")} aria-pressed={savedIds.has(selected.person.uid)}
        onClick={() => { if (!savedIds.has(selected.person.uid)) { onSave(selected); agentSay("liked-from-map"); } haptic(); }}>♥</button>
    </article>}
  </div>;
}
