import { useEffect, useState, type FormEvent } from "react";
import { BackBar, Bunny, t, useNav } from "@cc/core";
import { blockUser, loadEmergencyContacts, REPORT_CATEGORIES, saveEmergencyContacts, submitSafetyReport, type EmergencyContact } from "../data/safety";

type Params = { uid: string; otherUid?: string };
type ContactDraft = { name: string; phone: string; relation: string };
const emptyContact: ContactDraft = { name: "", phone: "", relation: "" };
const categoryLabels: Record<string, string> = {
  spam_scam: t("safety.category.spam", "Spam or scam"), rude_abusive: t("safety.category.abuse", "Rude or abusive"), fake_profile: t("safety.category.fake", "Fake profile"), child_safety: t("safety.category.child", "Child safety"), inappropriate: t("safety.category.inappropriate", "Inappropriate"), other: t("safety.category.other", "Other"),
};

export default function Safety({ params }: { params: Params }) {
  const nav = useNav();
  const { uid, otherUid = "" } = params;
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [draft, setDraft] = useState<ContactDraft>(emptyContact);
  const [editing, setEditing] = useState<number | null>(null);
  const [category, setCategory] = useState<string>(REPORT_CATEGORIES[0][0]);
  const [reportText, setReportText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void loadEmergencyContacts(uid).then((rows) => { if (live) setContacts(rows); }).catch(() => { if (live) setError(t("safety.contacts.loadError", "Saved contacts could not load. You can add and save them here.")); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [uid]);

  function beginEdit(index: number) {
    const contact = contacts[index];
    if (!contact) return;
    setEditing(index);
    setDraft({ name: contact.name, phone: contact.phone, relation: contact.relation ?? "" });
  }
  function addOrUpdateContact(event: FormEvent) {
    event.preventDefault();
    const next = { name: draft.name.trim().slice(0, 80), phone: draft.phone.trim().slice(0, 40), relation: draft.relation.trim().slice(0, 60) };
    if (!next.name || !next.phone) { setError(t("safety.contacts.required", "Add a name and phone number.")); return; }
    if (editing === null && contacts.length >= 3) { setError(t("safety.contacts.limit", "You can save up to 3 contacts.")); return; }
    const value: EmergencyContact = { name: next.name, phone: next.phone, ...(next.relation ? { relation: next.relation } : {}) };
    setContacts((current) => editing === null ? [...current, value] : current.map((row, index) => index === editing ? value : row));
    setDraft(emptyContact);
    setEditing(null);
    setError("");
    setStatus(t("safety.contacts.unsaved", "Contact changes are ready to save."));
  }

  async function saveContacts() {
    setSaving(true); setError(""); setStatus("");
    try { await saveEmergencyContacts(uid, contacts); setStatus(t("safety.contacts.saved", "Emergency contacts saved.")); }
    catch { setError(t("safety.contacts.saveError", "Emergency contacts could not save. Check your connection.")); }
    finally { setSaving(false); }
  }
  async function sendReport(event: React.FormEvent) {
    event.preventDefault();
    if (!otherUid) { setError(t("safety.report.noTarget", "Open Safety from a conversation or profile to report a person.")); return; }
    setSaving(true); setError(""); setStatus("");
    try { await submitSafetyReport({ uid, otherUid, category, words: reportText, surface: "message" }); setReportText(""); setStatus(t("safety.report.sent", "Report sent for review.")); }
    catch { setError(t("safety.report.error", "Report could not be sent. Check your connection.")); }
    finally { setSaving(false); }
  }
  async function blockPerson() {
    if (!otherUid) { setError(t("safety.report.noTarget", "Open Safety from a conversation or profile to report a person.")); return; }
    setSaving(true); setError(""); setStatus("");
    try { await blockUser(uid, otherUid); setStatus(t("safety.block.saved", "This person is blocked. They are not notified.")); }
    catch { setError(t("safety.block.error", "This person could not be blocked. Check your connection.")); }
    finally { setSaving(false); }
  }

  return <div className="app">
    <BackBar title={t("safety.title", "Safety") } onBack={nav.back} />
    <div className="scroll" style={{ display: "grid", gap: 14 }}>
      <section className="card" aria-labelledby="safety-tools-title">
        <div className="row" style={{ justifyContent: "space-between" }}><div><p className="muted" style={{ margin: 0 }}>{t("safety.kicker", "Care with clear records")}</p><h1 id="safety-tools-title">{t("safety.tools.title", "Your safety tools")}</h1></div><Bunny mood="think" size={74} /></div>
        <p>{t("safety.records", "Keep booking records and payments in the app so care plans and costs stay together.")}</p>
        <p style={{ marginBlockEnd: 6 }}><strong>{t("safety.emergency.number", "National emergency number")}</strong></p>
        <a className="btn" href="tel:000" aria-label={t("safety.emergency.call", "Call 000")}>{t("safety.emergency.000", "000")}</a>
        <p className="muted">{t("safety.emergency.note", "If someone is in immediate danger, call 000 yourself. The app does not call for you.")}</p>
      </section>

      <section className="card" aria-labelledby="safety-contacts-title">
        <h2 id="safety-contacts-title">{t("safety.contacts.title", "Emergency contacts")}</h2>
        <p className="muted">{t("safety.contacts.intro", "Save up to 3 people you trust. Their details stay in your account.")}</p>
        {loading ? <p role="status">{t("safety.contacts.loading", "Loading saved contacts…")}</p> : contacts.length ? <div className="stack" style={{ marginBlock: 12 }}>
          {contacts.map((contact, index) => <article key={`${contact.phone}-${index}`} style={{ padding: 12, background: "var(--soft)", borderRadius: 14 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><strong>{contact.name}</strong><div className="row"><button className="chip" type="button" onClick={() => beginEdit(index)}>{t("safety.edit", "Edit")}</button><button className="chip" type="button" onClick={() => setContacts((current) => current.filter((_, i) => i !== index))}>{t("safety.remove", "Remove")}</button></div></div>
            <p className="muted" style={{ marginBlock: 4 }}>{[contact.relation, contact.phone].filter(Boolean).join(" · ")}</p>
            <a href={`tel:${contact.phone}`}>{t("safety.contacts.call", "Call {name}", { name: contact.name })}</a>
          </article>)}
        </div> : <div className="empty"><Bunny mood="point" size={70} /><p>{t("safety.contacts.empty", "Add a person you trust for a safety check-in.")}</p></div>}
        {(contacts.length < 3 || editing !== null) && <form onSubmit={addOrUpdateContact} className="stack">
          <h3>{editing === null ? t("safety.contacts.addTitle", "Add a contact") : t("safety.contacts.editTitle", "Edit contact")}</h3>
          <label>{t("safety.contacts.name", "Name")}<input className="field" autoComplete="name" value={draft.name} onChange={(event) => setDraft((row) => ({ ...row, name: event.target.value }))} maxLength={80} /></label>
          <label>{t("safety.contacts.phone", "Phone number")}<input className="field" autoComplete="tel" type="tel" value={draft.phone} onChange={(event) => setDraft((row) => ({ ...row, phone: event.target.value }))} maxLength={40} /></label>
          <label>{t("safety.contacts.relation", "Relationship (optional)")}<input className="field" value={draft.relation} onChange={(event) => setDraft((row) => ({ ...row, relation: event.target.value }))} maxLength={60} /></label>
          <button className="btn alt" type="submit">{editing === null ? t("safety.contacts.add", "Add contact") : t("safety.contacts.update", "Update contact")}</button>
        </form>}
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        <button className="btn" type="button" onClick={() => void saveContacts()} disabled={saving || loading}>{saving ? t("safety.saving", "Saving…") : t("safety.contacts.save", "Save contacts")}</button>
      </section>

      <section className="card" aria-labelledby="safety-report-title">
        <h2 id="safety-report-title">{t("safety.report.title", "Report or block")}</h2>
        <p className="muted">{t("safety.report.intro", "Reports go to the safety team. Blocking keeps this person from contacting you through the app.")}</p>
        <form onSubmit={(event) => void sendReport(event)} className="stack">
          <label>{t("safety.report.reason", "Why are you reporting this person?")}<select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>{REPORT_CATEGORIES.map(([key]) => <option key={key} value={key}>{categoryLabels[key]}</option>)}</select></label>
          <label>{t("safety.report.details", "More details (optional)")}<textarea className="field" rows={4} maxLength={1000} value={reportText} onChange={(event) => setReportText(event.target.value)} /></label>
          <button className="btn" type="submit" disabled={saving || !otherUid}>{t("safety.report.send", "Send report")}</button>
        </form>
        <button className="btn alt" type="button" onClick={() => void blockPerson()} disabled={saving || !otherUid} style={{ marginBlockStart: 10 }}>{t("safety.block.button", "Block this person")}</button>
        {!otherUid && <p className="muted">{t("safety.report.noTarget", "Open Safety from a conversation or profile to report a person.")}</p>}
        {status && <p role="status" style={{ color: "var(--good)" }}>{status}</p>}
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      </section>
    </div>
  </div>;
}
