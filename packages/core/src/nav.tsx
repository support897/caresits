// Tiny stack navigator shared by both apps. Screens open others with nav.push("person", { uid }) and go back with nav.back().
import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode, type ComponentType, Suspense } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { t } from "./i18n";
export type Params = Record<string, unknown>;
export type Frame = { name: string; params: Params };
export type Nav = { push(name: string, params?: Params): void; back(): void; replace(name: string, params?: Params): void; reset(): void; stack: Frame[] };
const Ctx = createContext<Nav>({ push() {}, back() {}, replace() {}, reset() {}, stack: [] });
export const useNav = () => useContext(Ctx);
export type ScreenProps<P extends Params = Params> = { params: P };
export type Registry = Record<string, () => Promise<{ default: ComponentType<ScreenProps<any>> }>>;
import { lazy } from "react";
export function NavHost({ registry, children }: { registry: Registry; children: ReactNode }) {
  const [stack, setStack] = useState<Frame[]>([]), reduced = useReducedMotion();
  const [rtl, setRtl] = useState(() => typeof document !== "undefined" && document.documentElement.dir === "rtl");
  useEffect(() => { if (typeof document === "undefined") return; const observer = new MutationObserver(() => setRtl(document.documentElement.dir === "rtl")); observer.observe(document.documentElement, { attributes: true, attributeFilter: ["dir"] }); return () => observer.disconnect(); }, []);
  const offscreenX = rtl ? "-100%" : "100%";
  const push = useCallback((name: string, params: Params = {}) => setStack((s) => [...s, { name, params }]), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const replace = useCallback((name: string, params: Params = {}) => setStack((s) => [...s.slice(0, -1), { name, params }]), []);
  const reset = useCallback(() => setStack([]), []);
  const comps = useMemo(() => Object.fromEntries(Object.entries(registry).map(([k, f]) => [k, lazy(f)])), [registry]);
  const nav = useMemo(() => ({ push, back, replace, reset, stack }), [push, back, replace, reset, stack]);
  const top = stack[stack.length - 1]; const Top = top ? comps[top.name] : undefined;
  return <Ctx.Provider value={nav}>{children}
    <AnimatePresence>{top && Top && <motion.div key={stack.length + top.name} className="app" style={{ position: "fixed", inset: 0, zIndex: 50, background: "var(--cream)" }} initial={reduced ? false : { x: offscreenX }} animate={{ x: 0 }} exit={reduced ? { opacity: 0 } : { x: offscreenX }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36 }}>
      <Suspense fallback={<div className="scroll"><div className="sk" style={{ height: 120 }} /></div>}><Top params={top.params} /></Suspense></motion.div>}</AnimatePresence></Ctx.Provider>;
}
export const BackBar = ({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) => <header className="row" style={{ padding: "10px 12px", minHeight: 56, justifyContent: "space-between" }}><button type="button" className="chip" onClick={onBack} aria-label={t("core.nav.back", "Back")}><span className="flip" aria-hidden="true">‹</span> {t("core.nav.back", "Back")}</button><b style={{ fontFamily: "Newsreader,serif", fontSize: 20 }}>{title}</b><span style={{ minWidth: 70, textAlign: "end" }}>{right}</span></header>;
