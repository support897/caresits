import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bunny, type Mood } from "../Bunny";
import { haptic } from "../haptics";
export const spring = { type: "spring", stiffness: 380, damping: 30 } as const;
export const Button = ({ alt, small, children, ...r }: ButtonHTMLAttributes<HTMLButtonElement> & { alt?: boolean; small?: boolean }) => <button {...r} className={`btn${alt ? " alt" : ""}${small ? " sm" : ""} ${r.className ?? ""}`}>{children}</button>;
export const Chip = ({ on, children, ...r }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) => <button {...r} className={`chip${on ? " on" : ""}`} aria-pressed={on}>{children}</button>;
export function Sheet({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  return <AnimatePresence><motion.div className="sheet" role="dialog" aria-modal="true" aria-label={label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div initial={{ y: 60 }} animate={{ y: 0 }} transition={spring} onClick={(e) => e.stopPropagation()}>{children}</motion.div></motion.div></AnimatePresence>;
}
export const Empty = ({ mood = "rest", title, body, action }: { mood?: Mood; title: string; body?: string; action?: ReactNode }) => <div className="empty"><Bunny mood={mood} size={110} /><h3>{title}</h3>{body && <p className="muted" style={{ margin: 0 }}>{body}</p>}{action}</div>;
export const Avatar = ({ name, url, size = 48 }: { name: string; url?: string; size?: number }) => <div className="av" style={{ width: size, height: size, fontSize: size * .42 }} aria-hidden="true">{url ? <img src={url} alt="" /> : (name[0] ?? "?").toUpperCase()}</div>;
export function Ring({ pct, label }: { pct: number; label: string }) { const r = 28, c = 2 * Math.PI * r; return <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label} style={{ position: "relative", width: 68, height: 68 }}><svg viewBox="0 0 68 68" width="68" height="68"><circle cx="34" cy="34" r={r} fill="none" stroke="var(--line)" strokeWidth="6" /><motion.circle cx="34" cy="34" r={r} fill="none" stroke="var(--good)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ duration: .8 }} transform="rotate(-90 34 34)" /></svg><b style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{pct}%</b></div>; }
export type TabDef = { key: string; label: string; icon: string; badge?: number };
export function TabBar({ tabs, value, onChange }: { tabs: TabDef[]; value: string; onChange: (k: string) => void }) {
  return <nav className="tabs" aria-label="Main">{tabs.map((x) => <button key={x.key} className={`tab${value === x.key ? " on" : ""}`} aria-current={value === x.key ? "page" : undefined} onClick={() => { haptic(); onChange(x.key); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={x.icon} /></svg>{x.label}{!!x.badge && <span className="pip" aria-label={`${x.badge} new`}>{x.badge}</span>}</button>)}</nav>;
}
export const ICON = { discover: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z", heart: "M12 20s-7-4.4-7-9.6A4 4 0 0112 8a4 4 0 017 2.4C19 15.6 12 20 12 20z", chat: "M4 5h16v11H9l-5 4z", user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6", cal: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4", care: "M12 21s-8-5-8-11a5 5 0 018-3 5 5 0 018 3c0 6-8 11-8 11z", sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2", home: "M3 11l9-8 9 8v9H3z", bag: "M5 8h14l-1 12H6zM9 8a3 3 0 016 0" } as const;
