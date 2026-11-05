import { useEffect, useState } from "react";
import { t } from "@cc/core";
import { loadResume } from "../data/resume";
import { hasResume, type Resume } from "../lib/resume";

/** Read-only resume block. Shown on a carer's profile. Always labelled self-reported. */
export function ResumeView({ uid, className = "booking-card booking-section" }: { uid: string; className?: string }) {
  const [r, setR] = useState<Resume | null>(null);
  useEffect(() => { let live = true; void loadResume(uid).then((x) => { if (live) setR(x); }); return () => { live = false; }; }, [uid]);
  if (!hasResume(r) || !r) return null;
  const list = (title: string, items: string[]) => items.length ? <><h3>{title}</h3><ul style={{ margin: "0 0 10px", paddingInlineStart: 22 }}>{items.map((x, i) => <li key={`${i}-${x}`}>{x}</li>)}</ul></> : null;
  return <section className={className} data-testid="resume-view" aria-label={t("resume.title", "Resume")}>
    <h2>{t("resume.title", "Resume")}</h2>
    <p className="muted" style={{ marginTop: 0 }}>{t("resume.selfReported", "Written by the carer. Not checked by us.")}</p>
    {r.summary && <p style={{ overflowWrap: "anywhere" }}>{r.summary}</p>}
    {list(t("resume.jobs", "Work"), r.jobs)}{list(t("resume.education", "Study"), r.education)}{list(t("resume.certificates", "Certificates they list"), r.certificates)}
    {r.skills.length > 0 && <><h3>{t("resume.skills", "Skills")}</h3><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{r.skills.map((x, i) => <span className="chip" key={`${i}-${x}`}>{x}</span>)}</div></>}
  </section>;
}
