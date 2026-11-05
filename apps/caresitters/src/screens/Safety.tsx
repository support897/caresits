import { useEffect, useState, type FormEvent } from "react";
import { BackBar, Bunny, t, useNav } from "@cc/core";
import { blockUser, loadEmergencyContacts, REPORT_CATEGORIES, saveEmergencyContacts, submitSafetyReport, type EmergencyContact } from "../data/safety";
import { loadRelationshipBookings, watchBlockedPerson } from "../data/chat";
import type { BookingRecord } from "../data/bookings";
import { SafetyCheckin } from "./booking/SafetyCheckin";
import { dateLabel } from "./booking/format";
import "./booking/booking.css";

type Params = { uid: string; otherUid?: string; relId?: string };
type ContactDraft = { name: string; phone: string; relation: string };
const emptyContact: ContactDraft = { name: "", phone: "", relation: "" };
const categoryLabels: Record<string, string> = {
  spam_scam: t("safety.category.spam", "Spam or scam"), rude_abusive: t("safety.category.abuse", "Rude or abusive"), fake_profile: t("safety.category.fake", "Fake profile"), child_safety: t("safety.category.child", "Child safety"), inappropriate: t("safety.category.inappropriate", "Inappropriate"), other: t("safety.category.other", "Other"),
};
const CHECK_SOURCES = [
  { id: "qld", region: t("safety.check.qld", "Queensland"), name: t("safety.check.qld.name", "Queensland’s Working with Children Check (Blue Card)"), url: "https://www.qld.gov.au/jobs/blue-card-services" },
  { id: "nsw", region: t("safety.check.nsw", "New South Wales"), name: t("safety.check.nsw.name", "Working with Children Check (WWCC)"), url: "https://www.service.nsw.gov.au/transaction/apply-for-a-working-with-children-check" },
  { id: "vic", region: t("safety.check.vic", "Victoria"), name: t("safety.check.vic.name", "Working with Children Check (WWCC)"), url: "https://www.vic.gov.au/working-with-children-check" },
  { id: "wa", region: t("safety.check.wa", "Western Australia"), name: t("safety.check.wa.name", "Working with Children (WWC) Check"), url: "https://www.wa.gov.au/organisation/department-of-communities/working-children-check" },
  { id: "sa", region: t("safety.check.sa", "South Australia"), name: t("safety.check.sa.name", "Working with Children Check"), url: "https://www.sa.gov.au/topics/rights-and-law/rights-and-responsibilities/screening-checks/screening-wwcc/for-individuals/apply-for-a-check" },
  { id: "tas", region: t("safety.check.tas", "Tasmania"), name: t("safety.check.tas.name", "Registration to Work with Vulnerable People (RWVP)"), url: "https://www.service.tas.gov.au/services/education-and-skills/working-with-vulnerable-people-including-children/apply-for-registration-to-work-with-vulnerable-people/" },
  { id: "act", region: t("safety.check.act", "Australian Capital Territory"), name: t("safety.check.act.name", "Working with Vulnerable People (WWVP) registration"), url: "https://www.accesscanberra.act.gov.au/business-and-work/working-with-vulnerable-people/working-with-vulnerable-people-scheme" },
  { id: "nt", region: t("safety.check.nt", "Northern Territory"), name: t("safety.check.nt.name", "Working with Children Clearance (WWCC), also known as an Ochre Card"), url: "https://nt.gov.au/emergency/child-safety/working-with-children-clearance/wwcc-apply-and-renew" },
] as const;
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function bookingStateLabel(state: BookingRecord["state"]): string {
  return ({ requested: t("safety.booking.requested", "Waiting for acceptance"), accepted: t("safety.booking.accepted", "Accepted"), declined: t("safety.booking.declined", "Declined"), cancelled: t("safety.booking.cancelled", "Cancelled"), completed: t("safety.booking.completed", "Completed") })[state];
}

export default function Safety({ params }: { params: Params }) {
  const nav = useNav();
  const { uid, otherUid = "", relId = "" } = params;
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(Boolean(relId));
  const [bookingError, setBookingError] = useState("");
  const [personBlocked, setPersonBlocked] = useState(false);
  const [blockStatusReady, setBlockStatusReady] = useState(false);
  const [blockStatusError, setBlockStatusError] = useState(false);
  const [confirmReport, setConfirmReport] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [draft, setDraft] = useState<ContactDraft>(emptyContact);
  const [editing, setEditing] = useState<number | null>(null);
  const [category, setCategory] = useState<string>(REPORT_CATEGORIES[0][0]);
  const [reportText, setReportText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [contactStatus, setContactStatus] = useState("");
  const [contactError, setContactError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setContacts([]);
    setLoading(true);
    setContactError("");
    void loadEmergencyContacts(uid).then((rows) => { if (live) setContacts(rows); }).catch(() => { if (live) setContactError(t("safety.contacts.loadError", "Saved contacts could not load. You can add and save them here.")); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [uid]);

  useEffect(() => {
    let live = true;
    setBookings([]);
    setBookingError("");
    if (!uid || !otherUid || !relId) { setBookingsLoading(false); return () => { live = false; }; }
    setBookingsLoading(true);
    void loadRelationshipBookings(uid, otherUid, relId).then((rows) => { if (live) setBookings(rows); }).catch(() => { if (live) setBookingError(t("safety.bookings.error", "Booking records could not load. Check your connection and access.")); }).finally(() => { if (live) setBookingsLoading(false); });
    return () => { live = false; };
  }, [uid, otherUid, relId]);

  useEffect(() => {
    if (!uid || !otherUid) { setPersonBlocked(false); setBlockStatusReady(true); return undefined; }
    setPersonBlocked(false);
    setBlockStatusReady(false);
    setBlockStatusError(false);
    return watchBlockedPerson(uid, otherUid, (value) => {
      setBlockStatusReady(true);
      setPersonBlocked(value !== false);
      setBlockStatusError(value === null);
    });
  }, [uid, otherUid]);

  function beginEdit(index: number) {
    const contact = contacts[index];
    if (!contact) return;
    setEditing(index);
    setDraft({ name: contact.name, phone: contact.phone, relation: contact.relation ?? "" });
  }
  function addOrUpdateContact(event: FormEvent) {
    event.preventDefault();
    const next = { name: draft.name.trim().slice(0, 80), phone: draft.phone.trim().slice(0, 40), relation: draft.relation.trim().slice(0, 60) };
    if (!next.name || !next.phone) { setContactError(t("safety.contacts.required", "Add a name and phone number.")); return; }
    if (editing === null && contacts.length >= 3) { setContactError(t("safety.contacts.limit", "You can save up to 3 contacts.")); return; }
    const value: EmergencyContact = { name: next.name, phone: next.phone, ...(next.relation ? { relation: next.relation } : {}) };
    setContacts((current) => editing === null ? [...current, value] : current.map((row, index) => index === editing ? value : row));
    setDraft(emptyContact);
    setEditing(null);
    setContactError("");
    setContactStatus(t("safety.contacts.unsaved", "Contact changes are ready to save."));
  }

  async function saveContacts() {
    setSaving(true); setContactError(""); setContactStatus("");
    try { await saveEmergencyContacts(uid, contacts); setContactStatus(t("safety.contacts.saved", "Emergency contacts saved.")); }
    catch { setContactError(t("safety.contacts.saveError", "Emergency contacts could not save. Check your connection.")); }
    finally { setSaving(false); }
  }
  function reviewReport(event: FormEvent) {
    event.preventDefault();
    if (!otherUid) { setError(t("safety.report.noTarget", "Open Safety from a conversation or profile to report a person.")); return; }
    setError("");
    setConfirmReport(true);
  }
  async function sendReport() {
    if (!otherUid) return;
    setSaving(true); setError(""); setStatus(""); setConfirmReport(false);
    try { await submitSafetyReport({ uid, otherUid, category, words: reportText, surface: "message" }); setReportText(""); setStatus(t("safety.report.sent", "Report sent for review.")); }
    catch { setError(t("safety.report.error", "Report could not be sent. Check your connection.")); }
    finally { setSaving(false); }
  }
  function reviewBlock() {
    if (!otherUid) { setError(t("safety.report.noTarget", "Open Safety from a conversation or profile to report a person.")); return; }
    setError("");
    setConfirmBlock(true);
  }
  async function confirmBlockUser() {
    if (!otherUid || !blockStatusReady || personBlocked || blockStatusError) return;
    setSaving(true); setError(""); setStatus(""); setConfirmBlock(false);
    try { await blockUser(uid, otherUid); setPersonBlocked(true); setStatus(t("safety.block.saved", "This person is blocked. They are not notified.")); }
    catch { setError(t("safety.block.error", "This person could not be blocked. Check your connection.")); }
    finally { setSaving(false); }
  }

  return <div className="app">
    <BackBar title={t("safety.title", "Safety") } onBack={nav.back} />
    <div className="scroll" style={{ display: "grid", gap: 14 }}>
      <section className="card" aria-labelledby="safety-tools-title">
        <div className="row" style={{ justifyContent: "space-between" }}><div><p className="muted" style={{ margin: 0 }}>{t("safety.kicker", "Care with clear records")}</p><h1 id="safety-tools-title">{t("safety.tools.title", "Your safety tools")}</h1></div><Bunny mood="think" size={74} /></div>
        <p>{t("safety.records", "Keep bookings in the app.")}</p>
        <p style={{ marginBlockEnd: 6 }}><strong>{t("safety.emergency.number", "National emergency number")}</strong></p>
        <a className="btn" href="tel:000" aria-label={t("safety.emergency.call", "Call 000")} style={{ minHeight: 48 }}>{t("safety.emergency.000", "000")}</a>
        <p className="muted">{t("safety.emergency.note", "In danger? Call 000. The app can't call for you.")}</p>
        <details style={{ marginBlockStart: 12 }}>
          <summary style={{ minHeight: 44, display: "flex", alignItems: "center", cursor: "pointer" }}>{t("safety.checks.summary", "Official child-safety checks by state or territory")}</summary>
          <p className="muted">{t("safety.checks.disclaimer", "Check current rules with your state. Links don't confirm anyone's check.")}</p>
          <ul style={{ display: "grid", gap: 12, paddingInlineStart: 24 }}>
            {CHECK_SOURCES.map((source) => <li key={source.id}>
              <strong>{source.region}</strong>
              <p style={{ margin: "4px 0" }}>{source.name}</p>
              <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={t("safety.checks.open", "Open official {region} check information", { region: source.region })} style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>{t("safety.checks.link", "Open official website")}</a>
            </li>)}
          </ul>
        </details>
      </section>

      <section className="card" aria-labelledby="safety-bookings-title">
        <h2 id="safety-bookings-title">{t("safety.bookings.title", "Booking records")}</h2>
        <p className="muted">{t("safety.bookings.intro", "Only you two can see these.")}</p>
        {!otherUid || !relId ? <p className="muted">{t("safety.bookings.noRelationship", "Open Safety from a conversation to view its booking records.")}</p> : bookingsLoading ? <p role="status">{t("safety.bookings.loading", "Loading booking records…")}</p> : bookingError ? <p role="alert" style={{ color: "var(--danger)" }}>{bookingError}</p> : bookings.length ? <div className="stack">
          {bookings.map((booking) => <article className="booking-card" key={`${booking.pairId}-${booking.id}`}>
            <div className="booking-between"><strong>{booking.date ? dateLabel(booking.date) : t("safety.booking.noDate", "Date not set")}</strong><span className="booking-status">{bookingStateLabel(booking.state)}</span></div>
            <p className="booking-meta">{[booking.from, booking.to].filter(Boolean).join("–") || t("safety.booking.noTime", "Time not set")}</p>
            {booking.state === "accepted" && booking.date === localToday() && <SafetyCheckin booking={booking} uid={uid} />}
          </article>)}
        </div> : <p className="muted">{t("safety.bookings.empty", "No booking records for this care relationship yet.")}</p>}
      </section>

      <section className="card" aria-labelledby="safety-contacts-title">
        <h2 id="safety-contacts-title">{t("safety.contacts.title", "Emergency contacts")}</h2>
        <p className="muted">{t("safety.contacts.intro", "Save up to 3 people you trust. Their details stay in your account.")}</p>
        {loading ? <p role="status">{t("safety.contacts.loading", "Loading saved contacts…")}</p> : contacts.length ? <div className="stack" style={{ marginBlock: 12 }}>
          {contacts.map((contact, index) => <article key={`${contact.phone}-${index}`} style={{ padding: 12, background: "var(--soft)", borderRadius: 14 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><strong>{contact.name}</strong><div className="row"><button className="chip" type="button" aria-label={t("safety.contacts.editNamed", "Edit {name}", { name: contact.name })} onClick={() => beginEdit(index)} style={{ minHeight: 44 }}>{t("safety.edit", "Edit")}</button><button className="chip" type="button" aria-label={t("safety.contacts.removeNamed", "Remove {name}", { name: contact.name })} onClick={() => { setContacts((current) => current.filter((_, i) => i !== index)); if (editing === index) { setEditing(null); setDraft(emptyContact); } setContactStatus(t("safety.contacts.unsaved", "Contact changes are ready to save.")); }} style={{ minHeight: 44 }}>{t("safety.remove", "Remove")}</button></div></div>
            <p className="muted" style={{ marginBlock: 4 }}>{[contact.relation, contact.phone].filter(Boolean).join(" · ")}</p>
            <a href={`tel:${contact.phone}`} style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>{t("safety.contacts.call", "Call {name}", { name: contact.name })}</a>
          </article>)}
        </div> : <div className="empty"><Bunny mood="point" size={70} /><p>{t("safety.contacts.empty", "Add a person you trust for a safety check-in.")}</p></div>}
        {(contacts.length < 3 || editing !== null) && <form onSubmit={addOrUpdateContact} className="stack">
          <h3>{editing === null ? t("safety.contacts.addTitle", "Add a contact") : t("safety.contacts.editTitle", "Edit contact")}</h3>
          <label>{t("safety.contacts.name", "Name")}<input className="field" autoComplete="name" required value={draft.name} onChange={(event) => setDraft((row) => ({ ...row, name: event.target.value }))} maxLength={80} style={{ minHeight: 48 }} /></label>
          <label>{t("safety.contacts.phone", "Phone number")}<input className="field" autoComplete="tel" type="tel" required value={draft.phone} onChange={(event) => setDraft((row) => ({ ...row, phone: event.target.value }))} maxLength={40} style={{ minHeight: 48 }} /></label>
          <label>{t("safety.contacts.relation", "Relationship (optional)")}<input className="field" value={draft.relation} onChange={(event) => setDraft((row) => ({ ...row, relation: event.target.value }))} maxLength={60} style={{ minHeight: 48 }} /></label>
          <button className="btn alt" type="submit" style={{ minHeight: 48 }}>{editing === null ? t("safety.contacts.add", "Add contact") : t("safety.contacts.update", "Update contact")}</button>
        </form>}
        {contactError && <p role="alert" style={{ color: "var(--danger)" }}>{contactError}</p>}
        {contactStatus && <p role="status">{contactStatus}</p>}
        <button className="btn" type="button" onClick={() => void saveContacts()} disabled={saving || loading} style={{ minHeight: 48 }}>{saving ? t("safety.saving", "Saving…") : t("safety.contacts.save", "Save contacts")}</button>
      </section>

      <section className="card" aria-labelledby="safety-report-title">
        <h2 id="safety-report-title">{t("safety.report.title", "Report or block")}</h2>
        <p className="muted">{t("safety.report.intro", "Reports go to our safety team.")}</p>
        <form onSubmit={reviewReport} className="stack">
          <label>{t("safety.report.reason", "Why are you reporting this person?")}<select className="field" value={category} onChange={(event) => setCategory(event.target.value)} style={{ minHeight: 48 }}>{REPORT_CATEGORIES.map(([key]) => <option key={key} value={key}>{categoryLabels[key]}</option>)}</select></label>
          <label>{t("safety.report.details", "More details (optional)")}<textarea className="field" rows={4} maxLength={1000} value={reportText} onChange={(event) => setReportText(event.target.value)} /></label>
          <button className="btn" type="submit" disabled={saving || !otherUid} style={{ minHeight: 48 }}>{t("safety.report.send", "Review report")}</button>
        </form>
        {confirmReport && <div role="group" aria-labelledby="safety-report-confirm-title" style={{ marginBlockStart: 12, padding: 12, border: "1px solid var(--line)", borderRadius: 14, background: "var(--soft)" }}>
          <h3 id="safety-report-confirm-title">{t("safety.report.confirm.title", "Review before sending")}</h3>
          <p>{t("safety.report.confirm.reason", "Report reason: {reason}", { reason: categoryLabels[category] ?? t("safety.category.other", "Other") })}</p>
          {reportText.trim() && <blockquote style={{ marginInline: 0, paddingInlineStart: 12, borderInlineStart: "3px solid var(--line)" }}>{reportText}</blockquote>}
          <p className="muted">{t("safety.report.confirm.note", "Your report will go to the safety team for review.")}</p>
          <div className="row"><button className="btn" type="button" onClick={() => void sendReport()} disabled={saving} style={{ minHeight: 48 }}>{saving ? t("safety.saving", "Saving…") : t("safety.report.confirm.send", "Confirm and send report")}</button><button className="chip" type="button" onClick={() => setConfirmReport(false)} disabled={saving} style={{ minHeight: 48 }}>{t("safety.cancel", "Cancel")}</button></div>
        </div>}
        {!personBlocked ? <button className="btn alt" type="button" onClick={reviewBlock} disabled={saving || !otherUid || !blockStatusReady || blockStatusError} style={{ marginBlockStart: 10, minHeight: 48 }}>{t("safety.block.button", "Block this person")}</button> : <p role="status">{t("safety.block.already", "This person is blocked. New messages are stopped.")}</p>}
        {otherUid && !blockStatusReady && <p role="status">{t("safety.block.checking", "Checking block status…")}</p>}
        {otherUid && blockStatusError && <p role="alert" style={{ color: "var(--danger)" }}>{t("safety.block.statusError", "Block status could not be checked. Blocking is paused.")}</p>}
        {confirmBlock && <div role="group" aria-labelledby="safety-block-confirm-title" style={{ marginBlockStart: 12, padding: 12, border: "1px solid var(--danger)", borderRadius: 14, background: "var(--soft)" }}>
          <h3 id="safety-block-confirm-title">{t("safety.block.confirm.title", "Block this person?")}</h3>
          <p>{t("safety.block.confirm.body", "They can't contact you. They aren't told.")}</p>
          <div className="row"><button className="btn alt" type="button" onClick={() => void confirmBlockUser()} disabled={saving} style={{ minHeight: 48 }}>{saving ? t("safety.saving", "Saving…") : t("safety.block.confirm.button", "Confirm block")}</button><button className="chip" type="button" onClick={() => setConfirmBlock(false)} disabled={saving} style={{ minHeight: 48 }}>{t("safety.cancel", "Cancel")}</button></div>
        </div>}
        {!otherUid && <p className="muted">{t("safety.report.noTarget", "Open Safety from a conversation or profile to report a person.")}</p>}
        {status && <p role="status" style={{ color: "var(--good)" }}>{status}</p>}
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      </section>
    </div>
  </div>;
}
