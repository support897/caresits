import { useEffect, useState } from "react";
import { Button, t } from "@cc/core";
import { loadQualifications, uploadQualification, type Qualification } from "../../data/quals";

const STATUS: Record<Qualification["status"], string> = {
  submitted: "Submitted", "under review": "Under review", verified: "Verified", expired: "Expired", "needs renewal": "Needs renewal",
};

export function QualificationsStep({ uid }: { uid: string }) {
  const [items, setItems] = useState<Qualification[]>([]);
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let live = true; void loadQualifications(uid).then((rows) => { if (live) setItems(rows); }).catch(() => { if (live) setError(t("onb.quals.loadError", "Could not load your saved documents.")); }); return () => { live = false; }; }, [uid]);
  async function add() {
    if (!file || !label.trim()) return;
    setBusy(true); setError("");
    try {
      const id = await uploadQualification({ uid, label, file });
      setItems((current) => [...current, { id, label: label.trim().slice(0, 100), status: "submitted" }]);
      setLabel(""); setFile(null);
      const input = document.getElementById("onb-qualification-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("onb.quals.error", "Could not add this document. Try again.")); }
    finally { setBusy(false); }
  }
  return <div className="onb-quals-step">
    <p className="onb-trust-note">{t("onb.quals.trust", "Adding a document never makes you verified. A real check does.")}</p>
    {items.length > 0 && <ul className="onb-qual-list">{items.map((item) => <li key={item.id}><span>{item.label}</span><span className="onb-status">{t(`onb.quals.status.${item.status.replaceAll(" ", "-")}`, STATUS[item.status])}</span></li>)}</ul>}
    <label className="onb-label" htmlFor="onb-qualification-name">{t("onb.quals.name", "Qualification name")}</label>
    <input id="onb-qualification-name" className="field" maxLength={100} value={label} onChange={(event) => setLabel(event.target.value)} placeholder={t("onb.quals.example", "For example, First aid")}/>
    <label className="onb-file-label">{t("onb.quals.file", "Add a document")}
      <input id="onb-qualification-file" className="field" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} aria-label={t("onb.quals.fileLabel", "Choose a qualification document")} />
    </label>
    <Button type="button" alt disabled={!label.trim() || !file || busy} onClick={() => void add()}>{busy ? t("onb.quals.adding", "Adding…") : t("onb.quals.add", "Add qualification")}</Button>
    {!items.length && <p className="muted onb-note">{t("onb.quals.optional", "You can add documents now or do it later.")}</p>}
    {error && <p role="alert" className="onb-error">{error}</p>}
  </div>;
}
