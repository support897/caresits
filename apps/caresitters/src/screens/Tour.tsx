import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Bunny, Button, t, type ScreenProps } from "@cc/core";
import { ROLE_TOURS, clampStep, loadProgress, saveProgress, tourRolesFor, type TourStep } from "../data/tours";

type Person = { uid: string; side: "family" | "carer"; card?: unknown };
type TourParams = { me: Person; onDone: () => void; onPause: () => void; startAt?: number };
type Target = { left: number; top: number; width: number; height: number };
const SERVICE_LABEL: Record<string, string> = { nanny: "Nanny", babysitter: "Babysitter", au_pair: "Au pair" };
const roleKey = (uid: string) => `caresits-tour-role:${uid}`;

export default function Tour({ params }: ScreenProps) {
  const { me, onDone, onPause } = params as TourParams;
  const roles = tourRolesFor(me);
  const reduceMotion = useReducedMotion();
  const [role, setRole] = useState(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(roleKey(me.uid)) ?? localStorage.getItem(`caresitters-intent-${me.uid}`); } catch { /* ignore */ }
    const found = roles.find((r) => r.endsWith(`:${saved}`));
    return found ?? (roles.length === 1 ? roles[0]! : null);
  });
  const tour = role ? ROLE_TOURS[role] : null;
  const steps: TourStep[] = tour?.steps ?? [];
  const [step, setStep] = useState(() => (role ? clampStep(loadProgress(me.uid, role).step, ROLE_TOURS[role].steps.length) : 0));
  const [dir, setDir] = useState<1 | -1>(1);
  const [target, setTarget] = useState<Target | null>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const current = steps[step];
  const dialogRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  function persist(patch: { step?: number; done?: boolean; paused?: boolean }) {
    if (role) saveProgress(me.uid, role, { step, done: false, paused: false, ...patch });
  }
  const finish = () => { persist({ done: true, step: 0 }); onDone(); };
  const pause = () => { persist({ paused: true }); onPause(); };

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    skipRef.current?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); pause(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!first || !last) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); previous?.focus(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, step]);

  // Go to the step's real control. If the control is missing, skip the step (never point at nothing).
  useEffect(() => {
    if (!current) return;
    persist({ step, paused: false });
    const timer = window.setTimeout(() => {
      const tabs = Array.from(document.querySelectorAll<HTMLElement>(".tabs .tab"));
      if (!tabs[current.tab]) { setStep((v) => clampStep(v + dir, steps.length)); return; }
      tabs[current.tab]!.click();
      window.setTimeout(() => {
        const el = current.selector ? document.querySelector<HTMLElement>(current.selector) : (document.querySelector<HTMLElement>(".screen h1") ?? tabs[current.tab]);
        if (current.selector && !el) {
          if (step >= steps.length - 1 && dir > 0) finish();
          else if (step <= 0 && dir < 0) setStep(0);
          else setStep((v) => clampStep(v + dir, steps.length));
          return;
        }
        const rect = el?.getBoundingClientRect();
        setTarget(rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null);
      }, 80);
    }, 60);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, step]);

  useEffect(() => {
    const resize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
      const el = current?.selector ? document.querySelector<HTMLElement>(current.selector) : document.querySelector<HTMLElement>(".screen h1");
      const rect = el?.getBoundingClientRect();
      if (rect) setTarget({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [current]);

  const frame: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 70, background: "color-mix(in srgb, var(--ink) 24%, transparent)" };
  const topBar = (label: string) => <div style={{ position: "fixed", insetBlockStart: "calc(12px + var(--safe-t))", insetInline: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, zIndex: 73 }}>
    <p style={{ margin: 0, padding: "8px 12px", borderRadius: 99, background: "var(--card)", fontWeight: 700 }}>{label}</p>
    <span style={{ display: "flex", gap: 8 }}>
      {tour && <button type="button" className="chip" onClick={pause}>{t("onb.tour.pause", "Pause")}</button>}
      <button ref={skipRef} type="button" className="chip" onClick={finish}>{t("onb.tour.skip", "Skip")}</button>
    </span>
  </div>;

  // Several services: ask which tour to take.
  if (!tour) {
    return <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="onb-tour-title" style={frame}>
      {topBar(t("onb.tour.welcome", "Quick guide"))}
      <section style={{ position: "fixed", insetInline: 16, insetBlockEnd: "calc(82px + var(--safe-b))", zIndex: 73, display: "grid", gap: 12, maxWidth: 460, marginInline: "auto", padding: 18, borderRadius: 24, background: "var(--card)", boxShadow: "var(--shadow)" }}>
        <h2 id="onb-tour-title">{t("onb.tour.pick", "Which guide do you want?")}</h2>
        {roles.map((r) => <Button key={r} type="button" onClick={() => { try { localStorage.setItem(roleKey(me.uid), r.split(":")[1]!); } catch { /* ignore */ } setRole(r); setStep(clampStep(loadProgress(me.uid, r).step, ROLE_TOURS[r].steps.length)); }}>{ROLE_TOURS[r].label || SERVICE_LABEL[r.split(":")[1]!]}</Button>)}
      </section>
    </div>;
  }
  if (!current) return null;
  const last = step >= steps.length - 1;
  const bunnyX = target ? Math.max(12, Math.min(size.width - 310, target.left + target.width / 2 - 80)) : Math.max(12, size.width / 2 - 80);
  const bunnyY = target ? Math.max(92, target.top - 138) : Math.max(120, size.height - 300);
  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="onb-tour-title" aria-describedby="onb-tour-description" data-tour-role={role ?? ""} style={frame}>
    {topBar(t("onb.tour.step", "{current} of {total}", { current: step + 1, total: steps.length }))}
    {target && <div aria-hidden="true" style={{ position: "fixed", left: target.left - 5, top: target.top - 5, width: target.width + 10, height: target.height + 10, border: "3px solid var(--bunny)", borderRadius: 20, background: "var(--card)", boxShadow: "0 0 0 5px color-mix(in srgb, var(--bunny) 25%, transparent)", zIndex: 71, pointerEvents: "none" }} />}
    <motion.div aria-hidden="true" initial={false} animate={{ x: bunnyX, y: bunnyY }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 190, damping: 22 }} style={{ position: "fixed", top: 0, left: 0, zIndex: 72, pointerEvents: "none" }}>
      <Bunny mood="point" size={100} caption={current.title} />
    </motion.div>
    <section style={{ position: "fixed", insetInline: 16, insetBlockEnd: "calc(82px + var(--safe-b))", zIndex: 73, display: "grid", gap: 12, maxWidth: 460, marginInline: "auto", padding: 18, borderRadius: 24, background: "var(--card)", boxShadow: "var(--shadow)" }}>
      <p className="onb-kicker" style={{ margin: 0 }}>{tour.label}</p>
      <h2 id="onb-tour-title">{current.title}</h2>
      <p id="onb-tour-description" style={{ margin: 0, color: "var(--muted)" }}>{current.body}</p>
      <div style={{ display: "flex", gap: 8 }}>
        {step > 0 && <Button type="button" alt onClick={() => { setDir(-1); setStep(step - 1); }}>{t("onb.tour.back", "Back")}</Button>}
        <Button type="button" onClick={() => { if (last) finish(); else { setDir(1); setStep(step + 1); } }}>{last ? t("onb.tour.done", "Done") : t("onb.tour.next", "Next")}</Button>
      </div>
    </section>
  </div>;
}
