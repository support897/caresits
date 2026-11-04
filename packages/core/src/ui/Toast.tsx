import { useEffect, useState } from "react";
let say: (m: string) => void = () => {};
export const toast = (m: string) => say(m);
export function ToastHost() { const [m, set] = useState(""); useEffect(() => { say = (x) => { set(x); setTimeout(() => set(""), 2600); }; }, []); return m ? <div role="status" style={{ position: "fixed", left: 16, right: 16, bottom: 96, zIndex: 200, background: "var(--text)", color: "var(--cream)", borderRadius: 16, padding: "12px 16px", textAlign: "center", fontWeight: 700 }}>{m}</div> : null; }
