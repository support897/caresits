import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
// Real artwork bunny (transparent WebP, public/bunny/). Moods: hello point celebrate encourage oops rest think.
// Motion is gentle CSS on the picture: breathing, a tiny weight shift, a hop on tap, a lean toward the finger.
const MOODS = ["hello", "point", "celebrate", "encourage", "oops", "rest", "think"];
const RATIO = { hello: .554, point: .584, celebrate: .695, encourage: .468, oops: .62, rest: .664, think: .671 };
const calm = () => { try { return localStorage.getItem("caresits-bunny-calm") === "1"; } catch { return false; } };
export const setBunnyCalm = (v) => { try { localStorage.setItem("caresits-bunny-calm", v ? "1" : "0"); } catch {} };
const src = (m) => `${import.meta.env.BASE_URL}bunny/bunny-${m}.webp`;

export const Bunny = forwardRef(function Bunny({ mood = "hello", size = 140, onTap, caption }, ref) {
  const [m, setM] = useState(MOODS.includes(mood) ? mood : "hello");
  const [prev, setPrev] = useState(null);
  const [hop, setHop] = useState(false);
  const [lean, setLean] = useState(0);
  const [visible, setVisible] = useState(true);
  const el = useRef(null);
  const still = calm() || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const change = (x) => { if (!MOODS.includes(x)) return; setM((cur) => { if (cur !== x) { setPrev(cur); setTimeout(() => setPrev(null), 260); } return x; }); };
  useEffect(() => { change(mood); }, [mood]);
  useImperativeHandle(ref, () => ({ set: change }));
  useEffect(() => {
    if (!el.current || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting)); io.observe(el.current); return () => io.disconnect();
  }, []);
  useEffect(() => { // lean toward the finger
    if (still) return;
    const mv = (e) => { const t = e.touches ? e.touches[0] : e; const r = el.current?.getBoundingClientRect(); if (!r) return; const dx = (t.clientX - (r.left + r.width / 2)) / innerWidth; setLean(Math.max(-1, Math.min(1, dx * 2)) * 3); };
    addEventListener("pointermove", mv, { passive: true }); return () => removeEventListener("pointermove", mv);
  }, [still]);
  const w = Math.round(size * RATIO[m] / .62), run = visible && !still;
  const tap = () => { if (!still) { setHop(true); setTimeout(() => setHop(false), 520); } onTap && onTap(); };
  return (
    <div ref={el} className={"bny" + (run ? " run" : "") + (hop ? " hop" : "") + " m-" + m} onClick={tap} style={{ width: w, height: size, pointerEvents: onTap ? "auto" : "none", ["--lean"]: lean + "deg" }} aria-hidden="true">
      <div className="bPose">
        {prev && <img className="bImg out" src={src(prev)} alt="" draggable="false" />}
        <img key={m} className="bImg in" src={src(m)} alt="" draggable="false" decoding="async" />
      </div>
      {caption && <div className="bCap">{caption}</div>}
    </div>
  );
});
export const bunny = { set: (ref, m) => ref?.current?.set(m) };
