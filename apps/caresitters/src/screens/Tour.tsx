import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { APP1, Bunny, Button, t, type ScreenProps } from "@cc/core";

type TourParams = { onDone: () => void };
type Target = { left: number; top: number; width: number; height: number };
const STORAGE_KEY = "caresits-tour-step";
const TABS = [
  { name: "Discover", title: "Swipe to find", caption: "Right to save." },
  { name: "Saved", title: "Your favourites", caption: "Compare when ready." },
  { name: "Bookings", title: "Your bookings", caption: "All in one place." },
  { name: "Messages", title: "Say hello", caption: "Chat here." },
  { name: "Me", title: "Your profile", caption: "Photos and details." },
];
function savedStep(): number {
  try { const value = Number(localStorage.getItem(STORAGE_KEY) ?? 0); return Number.isFinite(value) ? Math.max(0, Math.min(TABS.length - 1, Math.floor(value))) : 0; } catch { return 0; }
}

export default function Tour({ params }: ScreenProps) {
  const { onDone } = params as TourParams;
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(savedStep);
  const [target, setTarget] = useState<Target | null>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const current = TABS[step] ?? TABS[0]!;
  const dialogRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    skipRef.current?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); finish(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trapFocus);
    return () => { document.removeEventListener("keydown", trapFocus); previous?.focus(); };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(step)); } catch { /* resume is a convenience */ }
    const timer = window.setTimeout(() => {
      const tabs = Array.from(document.querySelectorAll<HTMLElement>(".tabs .tab"));
      tabs[step]?.click();
      const anchor = document.querySelector<HTMLElement>(".screen h1") ?? tabs[step];
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        setTarget({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      } else setTarget(null);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    const resize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
      const tabs = Array.from(document.querySelectorAll<HTMLElement>(".tabs .tab"));
      const anchor = document.querySelector<HTMLElement>(".screen h1") ?? tabs[step];
      const rect = anchor?.getBoundingClientRect();
      if (rect) setTarget({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [step]);

  function finish() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage may be blocked */ }
    onDone();
  }
  function next() {
    if (step >= TABS.length - 1) finish();
    else setStep((value) => Math.min(TABS.length - 1, value + 1));
  }

  const bunnyX = target ? Math.max(12, Math.min(size.width - 310, target.left + target.width / 2 - 80)) : Math.max(12, size.width / 2 - 80);
  const bunnyY = target ? Math.max(92, target.top - 138) : Math.max(120, size.height - 300);
  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="onb-tour-title" aria-describedby="onb-tour-description" style={{ position: "fixed", inset: 0, zIndex: 70, background: "color-mix(in srgb, var(--ink) 24%, transparent)" }}>
    <div style={{ position: "fixed", insetBlockStart: "calc(12px + var(--safe-t))", insetInline: 12, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 73 }}>
      <p style={{ margin: 0, padding: "8px 12px", borderRadius: 99, background: "var(--card)", fontWeight: 700 }}>{t("onb.tour.step", "{current} of {total}", { current: step + 1, total: TABS.length })}</p>
      <button ref={skipRef} type="button" className="chip" onClick={finish}>{t("onb.tour.skip", "Skip")}</button>
    </div>
    {target && <div aria-hidden="true" style={{ position: "fixed", left: target.left - 5, top: target.top - 5, width: target.width + 10, height: target.height + 10, border: "3px solid var(--bunny)", borderRadius: 20, background: "var(--card)", boxShadow: "0 0 0 5px color-mix(in srgb, var(--bunny) 25%, transparent)", zIndex: 71, pointerEvents: "none" }} />}
    <motion.div aria-hidden="true" initial={false} animate={{ x: bunnyX, y: bunnyY }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 190, damping: 22 }} style={{ position: "fixed", top: 0, left: 0, zIndex: 72, pointerEvents: "none" }}>
      <Bunny mood="point" size={100} caption={t(`onb.tour.caption.${step + 1}`, current.caption)} />
    </motion.div>
    <section style={{ position: "fixed", insetInline: 16, insetBlockEnd: "calc(82px + var(--safe-b))", zIndex: 73, display: "grid", gap: 12, maxWidth: 460, marginInline: "auto", padding: 18, borderRadius: 24, background: "var(--card)", boxShadow: "var(--shadow)" }}>
      <p className="onb-kicker" style={{ margin: 0 }}>{t(`onb.tour.tab.${step + 1}`, current.name)}</p>
      <h2 id="onb-tour-title">{t(`onb.tour.title.${step + 1}`, current.title)}</h2>
      <p id="onb-tour-description" style={{ margin: 0, color: "var(--muted)" }}>{t(`onb.tour.body.${step + 1}`, current.caption)}</p>
      <Button type="button" onClick={next}>{step === TABS.length - 1 ? t("onb.tour.done", "Done") : t("onb.tour.next", "Next")}</Button>
    </section>
  </div>;
}
