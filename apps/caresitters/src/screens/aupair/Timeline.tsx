import { useEffect, useRef, useState } from "react";
import { BackBar, Bunny, auth, db, agentSay, t, useNav, type ScreenProps } from "@cc/core";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { STEPS, loadLocal, merge, progress, saveLocal, toggle, type Done } from "../../data/timeline";
import "./components/timeline.css";

type Params = { relId?: string; destination?: string };

export default function Timeline({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const uid = auth().currentUser?.uid ?? "me";
  const relId = params.relId;
  const [done, setDone] = useState<Done>(() => loadLocal(uid, relId));
  const [shared, setShared] = useState<"solo" | "shared" | "local">(relId ? "local" : "solo");
  const first = useRef(true);

  useEffect(() => {
    if (!relId) return;
    let live = true;
    void getDoc(doc(db, "relationships", relId, "timeline", "state")).then((snap) => {
      if (!live) return;
      const remote = (snap.exists() ? (snap.data().done as Done) : {}) ?? {};
      setDone((cur) => merge(cur, remote));
      setShared("shared");
    }).catch(() => { if (live) setShared("local"); });
    return () => { live = false; };
  }, [relId]);

  useEffect(() => {
    saveLocal(uid, relId, done);
    if (first.current) { first.current = false; return; }
    if (relId && shared === "shared") void setDoc(doc(db, "relationships", relId, "timeline", "state"), { done }, { merge: false }).catch(() => setShared("local"));
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = progress(done);
  function tick(id: string) {
    const next = toggle(done, id, uid);
    setDone(next);
    if (next[id]) agentSay(progress(next).n === STEPS.length ? "timeline-done" : "timeline-step", Date.now());
  }
  return <div className="tl-screen" data-testid="timeline">
    <BackBar title={t("timeline.title", "Your journey")} onBack={nav.back} />
    <div className="scroll"><div className="tl-body">
      <div className="tl-top"><Bunny mood={p.n === STEPS.length ? "celebrate" : "hello"} size={72} />
        <div><b>{p.n === STEPS.length ? t("timeline.allDone", "You made it!") : t("timeline.next", "Next: {step}", { step: p.next?.title ?? "" })}</b>
          <div className="tl-bar" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${p.pct}%` }} /></div>
          <span className="tl-count">{p.n}/{p.total}</span></div></div>
      {relId && <p className="tl-share" data-testid="tl-share">{shared === "shared" ? t("timeline.shared", "Shared with your match") : t("timeline.sharedSoon", "Saved on this phone")}</p>}
      <ol className="tl-list">{STEPS.map((s) => { const d = done[s.id]; return <li key={s.id} className={d ? "on" : ""}>
        <button type="button" className="tl-step" aria-pressed={!!d} onClick={() => tick(s.id)} data-testid={`step-${s.id}`}>
          <span className="tl-dot" aria-hidden="true">{d ? "\u2713" : ""}</span>
          <span className="tl-txt"><b>{s.title}</b><small>{s.hint}</small></span>
          {s.id === "visa" && params.destination && <span role="link" tabIndex={0} className="tl-link" onClick={(e) => { e.stopPropagation(); nav.push("aupair-visa", { destination: params.destination }); }}>{t("timeline.visaLink", "Visa guide")}</span>}
        </button></li>; })}</ol>
    </div></div>
  </div>;
}
