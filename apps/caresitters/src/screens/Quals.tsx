import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { BackBar, Bunny, t, useNav, type Person } from "@cc/core";
import { AUSTRALIAN_CHILD_CHECKS, loadQualifications, qualificationDateDay, type AustralianStateCode, type Qualification, uploadQualification } from "../data/quals";

type Params = { me: Person };
const statusCopy: Record<Qualification["status"], string> = {
  submitted: t("quals.status.submitted", "submitted"),
  "under review": t("quals.status.review", "under review"),
  verified: t("quals.status.verified", "verified"),
  expired: t("quals.status.expired", "expired"),
  "needs renewal": t("quals.status.renewal", "needs renewal"),
};
const QUAL_TYPES = [
  t("quals.type.wwcc", "Working with Children Check"),
  t("quals.type.firstAid", "First aid"),
  t("quals.type.cpr", "CPR"),
  t("quals.type.education", "Early childhood education"),
  t("quals.type.other", "Other qualification"),
];
function initialState(me: Person): AustralianStateCode | "" {
  const raw = String(me.card.state ?? me.raw.state ?? me.raw.card?.state ?? "").toUpperCase();
  const aliases: Record<string, AustralianStateCode> = { "AUSTRALIAN CAPITAL TERRITORY": "ACT", "NEW SOUTH WALES": "NSW", "NORTHERN TERRITORY": "NT", QUEENSLAND: "QLD", "SOUTH AUSTRALIA": "SA", TASMANIA: "TAS", VICTORIA: "VIC", "WESTERN AUSTRALIA": "WA" };
  if (["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"].includes(raw)) return raw as AustralianStateCode;
  return aliases[raw] ?? "";
}
function dateLabel(value: unknown): string {
  const day = qualificationDateDay(value);
  if (!day) return t("quals.date.none", "Not recorded");
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, date, 12));
}
function statusStyle(status: Qualification["status"]): CSSProperties {
  if (status === "verified") return { background: "var(--soft)", color: "var(--good)" };
  if (status === "expired") return { background: "var(--danger)", color: "var(--cream)" };
  if (status === "needs renewal" || status === "under review") return { background: "var(--blush)", color: "var(--ink)" };
  return { background: "var(--soft)", color: "var(--muted)" };
}

export default function Quals({ params }: { params: Params }) {
  const nav = useNav();
  const { me } = params;
  const [state, setState] = useState<AustralianStateCode | "">(() => initialState(me));
  const [qualType, setQualType] = useState(QUAL_TYPES[0] ?? "Working with Children Check");
  const [otherLabel, setOtherLabel] = useState("");
  const [rows, setRows] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => AUSTRALIAN_CHILD_CHECKS.find((check) => check.code === state), [state]);

  async function refresh() {
    setError("");
    const records = await loadQualifications(me.uid);
    setRows(records);
  }
  useEffect(() => {
    let live = true;
    void loadQualifications(me.uid).then((records) => { if (live) setRows(records); }).catch(() => { if (live) setError(t("quals.load.error", "Qualifications could not load. Check your connection.")); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [me.uid]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    const label = qualType === QUAL_TYPES[4] ? otherLabel.trim() : qualType;
    if (!file) { setError(t("quals.file.required", "Choose a document first.")); return; }
    if (!label) { setError(t("quals.name.required", "Add a qualification name.")); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await uploadQualification({ uid: me.uid, label, file, state: state || undefined });
      setMessage(t("quals.upload.submitted", "Document submitted for review."));
      if (inputRef.current) inputRef.current.value = "";
      setOtherLabel("");
      await refresh();
    } catch { setError(t("quals.upload.error", "Document could not be uploaded. Check the file and your connection.")); }
    finally { setBusy(false); }
  }

  return <div className="app">
    <BackBar title={t("quals.title", "Qualifications")} onBack={nav.back} />
    <div className="scroll" style={{ display: "grid", gap: 14 }}>
      <header><p className="muted" style={{ margin: 0 }}>{t("quals.kicker", "Checks and training")}</p><h1>{t("quals.title", "Qualifications")}</h1></header>
      <section className="card" aria-labelledby="quals-state-title">
        <h2 id="quals-state-title">{t("quals.state.title", "Your state or territory")}</h2>
        <p className="muted">{t("quals.state.intro", "Pick where you work.")}</p>
        <label>{t("quals.state.label", "State or territory")}<select className="field" value={state} onChange={(event) => setState(event.target.value as AustralianStateCode | "")}>
          <option value="">{t("quals.state.choose", "Choose a state or territory")}</option>
          {AUSTRALIAN_CHILD_CHECKS.map((check) => <option key={check.code} value={check.code}>{t(`quals.stateName.${check.code}`, check.state)}</option>)}
        </select></label>
        {selected ? <div style={{ marginBlockStart: 12, padding: 13, background: "var(--soft)", borderRadius: 14 }}>
          <strong>{t(`quals.checkName.${selected.code}`, selected.name)}</strong><p>{t(`quals.guidance.${selected.code}`, selected.guidance)}</p><p className="muted">{t("quals.state.validity", "Typical validity")}: {t(`quals.validity.${selected.code}`, selected.validity)}</p>
          <a href={selected.officialUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: "var(--text)" }}>{t("quals.state.official", "Open the official government guide")}</a>
          <p className="muted">{t("quals.state.checked", "Official wording last checked")}: {dateLabel(selected.lastChecked)}</p>
        </div> : <p className="muted">{t("quals.state.help", "Queensland: Blue Card. Other states use their own check.")}</p>}
      </section>

      <section className="card" aria-labelledby="quals-list-title">
        <h2 id="quals-list-title">{t("quals.list.title", "Your qualifications")}</h2>
        <p className="muted">{t("quals.upload.warning", "Uploading a document never makes you verified.")}</p>
        {loading ? <div className="sk" aria-busy="true" style={{ height: 86 }} /> : rows.length ? <div className="stack" style={{ marginBlock: 12 }}>
          {rows.map((row) => <article key={row.id} style={{ background: "var(--soft)", borderRadius: 14, padding: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}><h3 style={{ overflowWrap: "anywhere" }}>{row.label}</h3><span className="tag" style={{ ...statusStyle(row.status), minHeight: 44, display: "inline-flex", alignItems: "center", paddingInline: 10, fontSize: 17 }}>{statusCopy[row.status]}</span></div>
            <p className="muted">{t("quals.date.checked", "Date checked")}: {dateLabel(row.checkedOn)}</p><p className="muted">{t("quals.date.expires", "Expiry date")}: {dateLabel(row.expiresOn)}</p>
          </article>)}
        </div> : <div className="empty"><Bunny mood="think" size={76} /><p>{t("quals.empty", "No qualifications added yet.")}</p></div>}
      </section>

      <section className="card" aria-labelledby="quals-upload-title">
        <h2 id="quals-upload-title">{t("quals.upload.title", "Add a qualification")}</h2>
        <p className="muted">{t("quals.upload.note", "Documents are stored privately while they are reviewed.")}</p>
        <form onSubmit={(event) => void upload(event)} className="stack">
          <label>{t("quals.type.label", "Qualification type")}<select className="field" value={qualType} onChange={(event) => setQualType(event.target.value)}>{QUAL_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          {qualType === QUAL_TYPES[4] && <label>{t("quals.name.label", "Qualification name")}<input className="field" value={otherLabel} onChange={(event) => setOtherLabel(event.target.value)} maxLength={100} /></label>}
          <label>{t("quals.file.label", "Document (PDF, JPG or PNG)")}<input ref={inputRef} className="field" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" /></label>
          <button className="btn" type="submit" disabled={busy}>{busy ? t("quals.upload.busy", "Uploading…") : t("quals.upload.button", "Upload document")}</button>
        </form>
        {message && <p role="status" style={{ color: "var(--good)" }}>{message}</p>}{error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      </section>
    </div>
  </div>;
}
