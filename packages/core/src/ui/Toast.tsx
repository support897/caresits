import { useEffect, useRef, useState } from "react";
let say: (m: string) => void = () => {};
export const toast = (m: string) => say(m);
export function ToastHost() {
  const [m, set] = useState(""), timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    say = (x) => { set(x); if (timer.current !== undefined) clearTimeout(timer.current); timer.current = window.setTimeout(() => set(""), 2600); };
    return () => { say = () => {}; if (timer.current !== undefined) clearTimeout(timer.current); };
  }, []);
  return m ? <div role="status" aria-live="polite" aria-atomic="true" style={{ position: "fixed", insetInline: 16, insetBlockEnd: 96, zIndex: 200, background: "var(--text)", color: "var(--cream)", borderRadius: 16, padding: "12px 16px", textAlign: "center", fontWeight: 700 }}>{m}</div> : null;
}
