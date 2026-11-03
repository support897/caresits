import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { TOKENS as T } from "./brand.js";
// Layered SVG bunny, animated with CSS. Moods: hello point celebrate encourage oops rest think.
const MOODS = ["hello", "point", "celebrate", "encourage", "oops", "rest", "think"];
const calm = () => { try { return localStorage.getItem("caresits-bunny-calm") === "1"; } catch { return false; } };
export const setBunnyCalm = (v) => { try { localStorage.setItem("caresits-bunny-calm", v ? "1" : "0"); } catch {} };

export const Bunny = forwardRef(function Bunny({ mood = "hello", size = 140, onTap }, ref) {
  const [m, setM] = useState(MOODS.includes(mood) ? mood : "hello");
  const [blink, setBlink] = useState(false);
  const [hop, setHop] = useState(false);
  const [eye, setEye] = useState([0, 0]);
  const [visible, setVisible] = useState(true);
  const el = useRef(null);
  const still = useRef(false);
  still.current = calm() || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => { if (MOODS.includes(mood)) setM(mood); }, [mood]);
  useImperativeHandle(ref, () => ({ set: (x) => MOODS.includes(x) && setM(x) }));
  useEffect(() => { // pause off-screen
    if (!el.current || !("IntersectionObserver" in window)) return;
    const o = new IntersectionObserver(([e]) => setVisible(e.isIntersecting)); o.observe(el.current); return () => o.disconnect();
  }, []);
  useEffect(() => { // blink every 3-5s
    if (still.current || !visible) return; let t;
    const go = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 140); go(); }, 3000 + Math.random() * 2000); }; go();
    return () => clearTimeout(t);
  }, [visible]);
  useEffect(() => { // eyes follow finger
    if (still.current) return;
    const mv = (e) => { const p = e.touches ? e.touches[0] : e; const r = el.current?.getBoundingClientRect(); if (!r) return;
      const dx = p.clientX - (r.left + r.width / 2), dy = p.clientY - (r.top + r.height / 3);
      const d = Math.hypot(dx, dy) || 1; setEye([(dx / d) * 3, (dy / d) * 2.5]); };
    addEventListener("pointermove", mv, { passive: true }); addEventListener("touchmove", mv, { passive: true });
    return () => { removeEventListener("pointermove", mv); removeEventListener("touchmove", mv); };
  }, []);
  const tap = () => { if (!still.current) { setHop(true); setTimeout(() => setHop(false), 500); } onTap && onTap(); };
  const run = !still.current && visible;
  const arm = { hello: -50, point: -20, celebrate: -140, encourage: 0, oops: 20, rest: 25, think: -70 }[m];
  const happy = m === "celebrate" || m === "hello" || m === "encourage";
  const closed = blink || m === "rest";
  return (
    <div ref={el} className={"bny" + (run ? " run" : "") + (hop ? " hop" : "") + " m-" + m} style={{ width: size, height: size * 1.15, pointerEvents: "none" }} aria-hidden="true">
      <svg viewBox="0 0 200 230" width="100%" height="100%" onClick={tap} style={{ pointerEvents: "auto", overflow: "visible" }}>
        <ellipse cx="100" cy="222" rx="46" ry="6" fill="#000" opacity=".08" />
        <g className="bBody">
          <g className="earL"><path d="M72 70 C40 20 52 -6 70 8 C86 22 90 50 88 72Z" fill={T.bunny} /><path d="M70 60 C58 30 60 14 68 20 C76 30 80 46 80 62Z" fill={T.blush} /></g>
          <g className="earR"><path d="M128 70 C160 20 148 -6 130 8 C114 22 110 50 112 72Z" fill={T.bunny} /><path d="M130 60 C142 30 140 14 132 20 C124 30 120 46 120 62Z" fill={T.blush} /></g>
          <ellipse cx="100" cy="165" rx="42" ry="48" fill={T.bunny} />
          <ellipse cx="100" cy="172" rx="27" ry="31" fill={T.cream} />
          <path d="M100 190 C84 178 82 164 91 162 C96 161 99 164 100 167 C101 164 104 161 109 162 C118 164 116 178 100 190Z" fill={T.blush} stroke={T.bunny} strokeWidth="2" />
          <ellipse cx="80" cy="212" rx="17" ry="9" fill={T.bunny} /><ellipse cx="120" cy="212" rx="17" ry="9" fill={T.bunny} />
          <g style={{ transformOrigin: "62px 150px", transform: `rotate(${m === "oops" ? 10 : 10}deg)` }}><ellipse cx="60" cy="168" rx="9" ry="22" fill={T.bunny} /></g>
          <g className="armR" style={{ transformOrigin: "140px 150px", transform: `rotate(${-arm}deg)` }}><ellipse cx="144" cy="168" rx="9" ry="22" fill={T.bunny} /></g>
          <ellipse cx="100" cy="106" rx="52" ry="46" fill={T.bunny} />
          <ellipse cx="68" cy="118" rx="9" ry="6" fill={T.blush} opacity=".9" /><ellipse cx="132" cy="118" rx="9" ry="6" fill={T.blush} opacity=".9" />
          {closed ? <><path d="M72 102 q9 7 18 0" stroke="#3a2a30" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M110 102 q9 7 18 0" stroke="#3a2a30" strokeWidth="3" fill="none" strokeLinecap="round" /></> :
            <><ellipse cx="81" cy="102" rx="10" ry="12" fill="#2b1d22" /><ellipse cx="119" cy="102" rx="10" ry="12" fill="#2b1d22" />
              <circle cx={84 + eye[0]} cy={98 + eye[1]} r="4" fill="#fff" /><circle cx={122 + eye[0]} cy={98 + eye[1]} r="4" fill="#fff" /></>}
          <ellipse cx="100" cy="116" rx="4.5" ry="3.5" fill="#d9778f" />
          {m === "oops" ? <path d="M90 128 q10 -6 20 0" stroke="#3a2a30" strokeWidth="3" fill="none" strokeLinecap="round" /> :
            m === "think" ? <circle cx="106" cy="128" r="3" fill="#3a2a30" /> :
            <path d={happy ? "M88 124 q12 12 24 0" : "M91 126 q9 6 18 0"} stroke="#3a2a30" strokeWidth="3" fill="none" strokeLinecap="round" />}
          {m === "think" && <g className="dots"><circle cx="150" cy="60" r="4" fill={T.sage} /><circle cx="162" cy="48" r="5" fill={T.sage} /><circle cx="176" cy="34" r="6" fill={T.sage} /></g>}
          {m === "rest" && <text x="146" y="62" fontSize="22" fill={T.sage} className="zz">z</text>}
          {m === "celebrate" && <g className="spk"><path d="M30 40 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill="#F6D67C" /><path d="M170 60 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="#F6D67C" /></g>}
        </g>
      </svg>
    </div>
  );
});
export const bunny = { set: (ref, m) => ref?.current?.set(m) };
