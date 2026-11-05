import { useEffect, useRef, useState } from "react";
import { BackBar, Bunny, t, toast, useNav, type Person } from "@cc/core";
import { loadResume, saveResume } from "../data/resume";
import { EMPTY_RESUME, extractFileText, parseResumeText, type Resume } from "../lib/resume";

const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
export default function ResumeEdit({ params }: { params: { me: Person } }) {
  const nav = useNav(); const uid = params.me.uid; const fileRef = useRef<HTMLInputElement>(null);
  const [r, setR] = useState<Resume>(EMPTY_RESUME); const [paste, setPaste] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  useEffect(() => { let live = true; void loadResume(uid).then((x) => { if (live && x) setR(x); }); return () => { live = false; }; }, [uid]);
  async function onFile(file?: File) {
    if (!file) return; setBusy(true); setMsg("");
    try { const text = await extractFileText(file); const next = parseResumeText(text); setR(next); setMsg(t("resume.read", "We read it on your phone. Phone numbers and emails were removed. Please check it.")); }
    catch { setMsg(t("resume.readFail", "We could not read that file. Paste the text instead.")); }
    setBusy(false);
  }
  async function save() {
    setBusy(true);
    try { setR(await saveResume(uid, r)); toast(t("resume.saved", "Resume saved")); nav.back(); } catch { setMsg(t("resume.saveFail", "Could not save. Try again.")); }
    setBusy(false);
  }
  const area = (label: string, key: "jobs" | "education" | "certificates" | "skills") => <label style={{ display: "block", marginBlockEnd: 12 }}><strong>{label}</strong><span className="muted" style={{ display: "block" }}>{t("resume.oneLine", "One per line")}</span>
    <textarea aria-label={label} rows={4} value={r[key].join("\n")} onChange={(e) => setR({ ...r, [key]: lines(e.target.value) })} style={{ width: "100%", font: "inherit", fontSize: 17, padding: 12, borderRadius: 14, border: "2px solid var(--line)" }} /></label>;
  return <div style={{ height: "100%", overflowY: "auto", background: "var(--cream)" }}>
    <BackBar title={t("resume.edit", "My resume")} onBack={() => nav.back()} />
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <section className="card"><Bunny mood="hello" size={64} />
        <p>{t("resume.how", "Add your resume file or paste the text. We read it on your phone, take out phone numbers and emails, and you check it before saving. The file itself is never uploaded.")}</p>
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" aria-label={t("resume.file", "Resume file")} hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <button className="btn" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>{t("resume.pick", "Choose resume file")}</button>
        <label style={{ display: "block", marginBlockStart: 12 }}><strong>{t("resume.pasteLabel", "Or paste your resume")}</strong>
          <textarea aria-label={t("resume.pasteLabel", "Or paste your resume")} rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} style={{ width: "100%", font: "inherit", fontSize: 17, padding: 12, borderRadius: 14, border: "2px solid var(--line)" }} /></label>
        <button className="btn alt" type="button" disabled={busy || !paste.trim()} onClick={() => { setR(parseResumeText(paste)); setMsg(t("resume.read", "We read it on your phone. Phone numbers and emails were removed. Please check it.")); }} style={{ marginBlockStart: 8 }}>{t("resume.fill", "Fill in from text")}</button>
        {msg && <p role="status">{msg}</p>}
      </section>
      <section className="card">
        <label style={{ display: "block", marginBlockEnd: 12 }}><strong>{t("resume.summary", "About you")}</strong>
          <textarea aria-label={t("resume.summary", "About you")} rows={3} maxLength={600} value={r.summary} onChange={(e) => setR({ ...r, summary: e.target.value })} style={{ width: "100%", font: "inherit", fontSize: 17, padding: 12, borderRadius: 14, border: "2px solid var(--line)" }} /></label>
        {area(t("resume.jobs", "Work"), "jobs")}{area(t("resume.education", "Study"), "education")}{area(t("resume.certificates", "Certificates you list"), "certificates")}{area(t("resume.skills", "Skills"), "skills")}
        <p className="muted">{t("resume.note", "This is what you say about yourself. It does not show as checked. Checks come from Qualifications.")}</p>
        <button className="btn" type="button" disabled={busy} onClick={() => void save()}>{t("resume.save", "Save resume")}</button>
      </section>
    </div>
  </div>;
}
