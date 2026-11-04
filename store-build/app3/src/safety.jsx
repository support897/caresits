// USAGE: import ReportBlock, EmergencyContacts, CheckIn, and Qualifications; each component accepts the props in its signature.
import React, { useEffect, useState } from "react";
import { addDoc, collection, doc, getDoc, increment, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { t } from "./tr.js";
import { Bunny } from "./bunny.jsx";
import { auth, db } from "./data.js";
import { planBlock, planReport, REPORT_CATEGORIES } from "../../www/app2/safety-actions.js";
import { qualificationDateDay, qualificationDates, qualificationStatus } from "./qual-logic.js";
import { WWCC_CHECKS } from "./wwcc.js";

const isTestMode = () => Boolean(globalThis.__C3_TEST);
const uidOf = (me) => me?.uid || me?.id || "";
const contactsFrom = (data) => Array.isArray(data) ? data.slice(0, 3).map((item) => ({ name: String(item?.name || ""), relationship: String(item?.relationship || ""), phone: String(item?.phone || "") })) : [];

function SafetyStyles() {
  return <style>{`
    .safe-root{box-sizing:border-box;width:100%;max-width:700px;margin:0 auto;padding:0 12px;color:#1E4D44;font-family:Atkinson,system-ui,sans-serif;font-size:17px;line-height:1.45;overflow-wrap:anywhere}
    .safe-root *{box-sizing:border-box}
    .safe-card{background:#fff;border:1px solid #D8E4DC;border-radius:22px;padding:20px;margin:0 0 16px;box-shadow:0 8px 24px #1E4D4412}
    .safe-title{font:700 27px/1.15 Newsreader,Georgia,serif;margin:0 0 8px;color:#1E4D44}
    .safe-copy{font-size:17px;line-height:1.45;margin:4px 0 14px}
    .safe-label{display:block;font-size:17px;font-weight:700;margin:12px 0 5px}
    .safe-input,.safe-select,.safe-textarea{display:block;width:100%;min-width:0;max-width:100%;font:400 17px/1.4 Atkinson,system-ui,sans-serif;color:#1E4D44;background:#fff;border:2px solid #9CC5B5;border-radius:13px;padding:11px 12px;min-height:48px}
    .safe-textarea{min-height:104px;resize:vertical}
    .safe-input:focus-visible,.safe-select:focus-visible,.safe-textarea:focus-visible,.safe-btn:focus-visible,.safe-link:focus-visible{outline:3px solid #B05D70;outline-offset:2px}
    .safe-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:10px 15px;border:0;border-radius:14px;font:700 17px/1.3 Atkinson,system-ui,sans-serif;text-align:center;cursor:pointer;white-space:normal}
    .safe-btn:disabled{opacity:.55;cursor:not-allowed}
    .safe-primary{background:#1E4D44;color:#fff}
    .safe-soft{background:#E6F2EC;color:#1E4D44}
    .safe-danger{background:#7B1C32;color:#fff}
    .safe-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
    .safe-actions .safe-btn{flex:1 1 155px}
    .safe-field-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}
    .safe-wide{grid-column:1/-1}
    .safe-list{display:grid;gap:10px;margin:14px 0}
    .safe-contact,.safe-qualification{border:1px solid #D8E4DC;border-radius:15px;padding:13px;background:#FDF8F0;min-width:0}
    .safe-contact-top,.safe-qualification-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;min-width:0}
    .safe-contact-title,.safe-qualification-title{font-weight:700;min-width:0;overflow-wrap:anywhere}
    .safe-small-btn{min-width:44px;min-height:44px;padding:8px 10px;border-radius:12px;background:#E6F2EC;color:#1E4D44;font:700 17px Atkinson,system-ui,sans-serif}
    .safe-muted{color:#314E46;font-size:17px;margin:6px 0}
    .safe-status{display:inline-flex;align-items:center;min-height:36px;padding:5px 11px;border-radius:99px;font-size:17px;font-weight:700;white-space:normal}
    .safe-status-verified{background:#D8EEE3;color:#174638}
    .safe-status-submitted{background:#E6F2EC;color:#1E4D44}
    .safe-status-under-review{background:#F6E9BC;color:#473807}
    .safe-status-expired{background:#7B1C32;color:#fff}
    .safe-status-needs-renewal{background:#F6E9BC;color:#473807}
    .safe-message{border-left:4px solid #1E4D44;background:#E6F2EC;border-radius:8px;padding:11px 12px;margin:12px 0}
    .safe-alert{border-left-color:#7B1C32;background:#FBE7EC}
    .safe-emergency-number{font:700 36px/1 Newsreader,Georgia,serif;color:#7B1C32;margin:4px 0 10px}
    .safe-link{color:#1E4D44;font-weight:700;text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}
    .safe-divider{height:1px;border:0;background:#D8E4DC;margin:16px 0}
    .safe-empty{display:flex;align-items:center;gap:10px}
    .safe-error{color:#7B1C32;font-weight:700;margin:10px 0}
    @media(max-width:360px){.safe-root{padding:0 8px}.safe-card{padding:15px;border-radius:18px}.safe-title{font-size:24px}.safe-field-grid{grid-template-columns:1fr}.safe-wide{grid-column:auto}.safe-actions{display:grid;grid-template-columns:1fr}.safe-actions .safe-btn{width:100%}.safe-contact-top,.safe-qualification-top{flex-direction:column}.safe-small-btn{width:100%}}
    @media(prefers-color-scheme:dark){.safe-root{color:#E8F1EC}.safe-card{background:#16282A;border-color:#2A4640}.safe-title{color:#CFE6DC}.safe-input,.safe-select,.safe-textarea{background:#0F1F1B;color:#E8F1EC;border-color:#4E776C}.safe-contact,.safe-qualification{background:#1B332D;border-color:#2A4640}.safe-muted{color:#D6E5DE}.safe-soft{background:#1B332D;color:#D8EEE3}.safe-link{color:#D8EEE3}.safe-message{background:#1B332D;color:#E8F1EC;border-left-color:#9CC5B5}.safe-alert{background:#402831;border-left-color:#F4A9BC}.safe-divider{background:#2A4640}.safe-status-verified{background:#1E4D44;color:#E8F1EC}.safe-status-submitted{background:#29483E;color:#E8F1EC}.safe-status-under-review,.safe-status-needs-renewal{background:#64552B;color:#FFF5D4}.safe-status-expired{background:#7B1C32;color:#fff}}
  `}</style>;
}

function useEmergencyContacts(me) {
  const uid = uidOf(me);
  const initial = contactsFrom(me?.emergencyContacts || me?.raw?.emergencyContacts);
  const [contacts, setContacts] = useState(initial);
  const [loading, setLoading] = useState(Boolean(uid && !isTestMode()));
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    if (!uid || isTestMode()) { setLoading(false); return () => { active = false; }; }
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (!active) return;
      if (snap.exists()) setContacts(contactsFrom(snap.data().emergencyContacts));
    }).catch(() => {
      if (active) setLoadError(t("safety.contacts.loadError", "Could not load saved contacts. You can still edit and save them."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [uid]);
  return { contacts, setContacts, loading, loadError, setLoadError };
}

function requireSelf(uid) {
  if (!uid) throw new Error(t("safety.signIn", "Sign in to save this safety information."));
  const current = auth().currentUser;
  if (!isTestMode() && (!current || current.uid !== uid)) throw new Error(t("safety.accountMismatch", "Your signed-in account does not match this profile."));
}

const reasonLabel = (key) => ({
  spam_scam: t("safety.reason.spam", "Spam or scam"),
  rude_abusive: t("safety.reason.abuse", "Rude or abusive"),
  fake_profile: t("safety.reason.fake", "Fake profile"),
  child_safety: t("safety.reason.childSafety", "Child safety"),
  inappropriate: t("safety.reason.inappropriate", "Inappropriate"),
  other: t("safety.reason.other", "Other"),
}[key] || key);

export function ReportBlock({ me, other, onDone }) {
  const [category, setCategory] = useState(REPORT_CATEGORIES[0]?.[0] || "other");
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const uid = uidOf(me), otherUid = uidOf(other);
  const submitReport = async (event) => {
    event.preventDefault(); setBusy("report"); setMessage(""); setError("");
    try {
      requireSelf(uid);
      const plan = planReport({ reporterUid: uid, reportedUid: otherUid, surface: "profile", category, words, snapshot: { title: other?.name || other?.displayName || "" }, nowIso: new Date().toISOString() });
      if (!plan.ok) throw new Error(t("safety.report.invalid", "This report could not be prepared."));
      if (!isTestMode()) {
        const batch = writeBatch(db);
        batch.set(doc(collection(db, "safetyReports")), { ...plan.data, createdAt: serverTimestamp() });
        batch.set(doc(db, "_owner", "aggregates", "safetyFiled", "main"), { filed: increment(1) }, { merge: true });
        batch.set(doc(db, "_owner", "aggregates", "safetyOpen", "main"), { open: increment(1) }, { merge: true });
        await batch.commit();
      }
      setMessage(t("safety.report.saved", "Report sent for review. You will not be told the outcome."));
      onDone?.({ type: "report", category });
    } catch (e) { setError(e?.message || t("safety.saveError", "Could not save this safety action. Try again.")); }
    finally { setBusy(""); }
  };
  const blockPerson = async () => {
    setBusy("block"); setMessage(""); setError("");
    try {
      requireSelf(uid);
      const plan = planBlock({ uid, otherUid, nowIso: new Date().toISOString() });
      if (!plan.ok) throw new Error(t("safety.block.invalid", "This person cannot be blocked from this profile."));
      if (!isTestMode()) await setDoc(doc(db, "users", uid, "blocks", otherUid), { createdAt: serverTimestamp() });
      setMessage(t("safety.block.saved", "This person is blocked. They are not notified."));
      onDone?.({ type: "block" });
    } catch (e) { setError(e?.message || t("safety.saveError", "Could not save this safety action. Try again.")); }
    finally { setBusy(""); }
  };
  return <section className="safe-root" aria-labelledby="safety-report-title"><SafetyStyles/><div className="safe-card">
    <h2 className="safe-title" id="safety-report-title">{t("safety.report.title", "Report or block")}</h2>
    <p className="safe-copy">{t("safety.report.intro", "Tell us what went wrong. A report goes to the safety team. Blocking keeps this person from contacting you through the app.")}</p>
    <form onSubmit={submitReport}>
      <label className="safe-label" htmlFor="safe-report-reason">{t("safety.report.reason", "Why are you reporting this profile?")}</label>
      <select className="safe-select" id="safe-report-reason" value={category} onChange={(e) => setCategory(e.target.value)}>
        {REPORT_CATEGORIES.map(([key]) => <option key={key} value={key}>{reasonLabel(key)}</option>)}
      </select>
      <label className="safe-label" htmlFor="safe-report-words">{t("safety.report.details", "More details (optional)")}</label>
      <textarea className="safe-textarea" id="safe-report-words" maxLength={1000} value={words} onChange={(e) => setWords(e.target.value)} placeholder={t("safety.report.placeholder", "Share only what helps explain your concern.")} />
      <div className="safe-actions"><button className="safe-btn safe-primary" type="submit" disabled={Boolean(busy)}>{busy === "report" ? t("safety.saving", "Saving…") : t("safety.report.submit", "Send report")}</button></div>
    </form>
    <hr className="safe-divider"/>
    <p className="safe-copy">{t("safety.block.note", "Blocking does not send a report. You can do either or both.")}</p>
    <button className="safe-btn safe-danger" type="button" onClick={blockPerson} disabled={Boolean(busy)}>{busy === "block" ? t("safety.saving", "Saving…") : t("safety.block.submit", "Block this person")}</button>
    {message && <p className="safe-message" role="status" aria-live="polite">{message}</p>}
    {error && <p className="safe-error" role="alert">{error}</p>}
  </div></section>;
}

export function EmergencyContacts({ me }) {
  const { contacts, setContacts, loading, loadError, setLoadError } = useEmergencyContacts(me);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", relationship: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const beginAdd = () => { setEditing(null); setForm({ name: "", relationship: "", phone: "" }); setError(""); };
  const beginEdit = (index) => { setEditing(index); setForm({ ...contacts[index] }); setError(""); };
  const saveForm = (event) => {
    event.preventDefault(); setError("");
    const next = { name: form.name.trim().slice(0, 80), relationship: form.relationship.trim().slice(0, 60), phone: form.phone.trim().slice(0, 40) };
    if (!next.name || !next.phone) { setError(t("safety.contacts.required", "Add a name and phone number.")); return; }
    if (editing == null && contacts.length >= 3) { setError(t("safety.contacts.limit", "You can save up to 3 contacts.")); return; }
    setContacts((current) => editing == null ? [...current, next].slice(0, 3) : current.map((item, index) => index === editing ? next : item));
    setEditing(null); setForm({ name: "", relationship: "", phone: "" }); setMessage(t("safety.contacts.unsaved", "Changes are not saved yet. Tap Save contacts."));
  };
  const remove = (index) => { setContacts((current) => current.filter((_, i) => i !== index)); setEditing(null); setMessage(t("safety.contacts.unsaved", "Changes are not saved yet. Tap Save contacts.")); };
  const saveContacts = async () => {
    const uid = uidOf(me); setBusy(true); setError(""); setMessage("");
    try {
      requireSelf(uid);
      const clean = contactsFrom(contacts).filter((contact) => contact.name && contact.phone).slice(0, 3);
      if (!isTestMode()) await setDoc(doc(db, "users", uid), { emergencyContacts: clean }, { merge: true });
      setContacts(clean); setMessage(t("safety.contacts.saved", "Emergency contacts saved.")); setLoadError("");
    } catch (e) { setError(e?.message || t("safety.saveError", "Could not save this safety action. Try again.")); }
    finally { setBusy(false); }
  };
  return <section className="safe-root" aria-labelledby="safety-contacts-title"><SafetyStyles/><div className="safe-card">
    <h2 className="safe-title" id="safety-contacts-title">{t("safety.contacts.title", "Emergency contacts")}</h2>
    <p className="safe-copy">{t("safety.contacts.intro", "Save up to 3 people you trust. These numbers are shown during a safety check-in; the app does not call them.")}</p>
    {loading && <p className="safe-muted" role="status">{t("safety.contacts.loading", "Loading saved contacts…")}</p>}
    {loadError && <p className="safe-error" role="status">{loadError}</p>}
    {contacts.length > 0 ? <div className="safe-list">{contacts.map((contact, index) => <div className="safe-contact" key={`${contact.phone}-${index}`}>
      <div className="safe-contact-top"><div className="safe-contact-title">{contact.name}<div className="safe-muted">{[contact.relationship, contact.phone].filter(Boolean).join(" · ")}</div></div>
        <div className="safe-actions" style={{ marginTop: 0 }}><button className="safe-small-btn" type="button" onClick={() => beginEdit(index)}>{t("safety.edit", "Edit")}</button><button className="safe-small-btn" type="button" onClick={() => remove(index)}>{t("safety.remove", "Remove")}</button></div>
      </div>
    </div>)}</div> : <p className="safe-muted">{t("safety.contacts.empty", "No emergency contacts saved yet.")}</p>}
    {contacts.length < 3 && editing == null && <button className="safe-btn safe-soft" type="button" onClick={beginAdd}>{t("safety.contacts.add", "Add a contact")}</button>}
    {editing != null || contacts.length < 3 ? <form onSubmit={saveForm}>
      <h3 className="safe-title" style={{ fontSize: 22, marginTop: 16 }}>{editing == null ? t("safety.contacts.new", "New contact") : t("safety.contacts.edit", "Edit contact")}</h3>
      <div className="safe-field-grid">
        <div><label className="safe-label" htmlFor="safe-contact-name">{t("safety.contacts.name", "Name")}</label><input className="safe-input" id="safe-contact-name" autoComplete="name" maxLength={80} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}/></div>
        <div><label className="safe-label" htmlFor="safe-contact-relation">{t("safety.contacts.relationship", "Relationship (optional)")}</label><input className="safe-input" id="safe-contact-relation" maxLength={60} value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}/></div>
        <div className="safe-wide"><label className="safe-label" htmlFor="safe-contact-phone">{t("safety.contacts.phone", "Phone number")}</label><input className="safe-input" id="safe-contact-phone" type="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}/></div>
      </div>
      {error && <p className="safe-error" role="alert">{error}</p>}
      <div className="safe-actions"><button className="safe-btn safe-soft" type="submit">{editing == null ? t("safety.contacts.add", "Add a contact") : t("safety.contacts.update", "Update contact")}</button>{editing != null && <button className="safe-btn safe-soft" type="button" onClick={beginAdd}>{t("safety.cancel", "Cancel")}</button>}</div>
    </form> : null}
    {error && editing == null && <p className="safe-error" role="alert">{error}</p>}
    <div className="safe-actions"><button className="safe-btn safe-primary" type="button" onClick={saveContacts} disabled={busy || loading}>{busy ? t("safety.saving", "Saving…") : t("safety.contacts.save", "Save contacts")}</button></div>
    {message && <p className="safe-message" role="status" aria-live="polite">{message}</p>}
  </div></section>;
}

const checkInLabels = {
  arrived: t("safety.checkin.arrived", "I arrived safely"),
  leaving: t("safety.checkin.leaving", "I'm leaving"),
  help: t("safety.checkin.help", "I need help"),
};

export function CheckIn({ booking, me, onDone }) {
  const { contacts, loading } = useEmergencyContacts(me);
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const uid = uidOf(me);
  const bookingId = String(booking?.id || booking?.bookingId || "");
  const checkIn = async (action) => {
    setActiveAction(action); setError(""); setMessage(""); setBusy(true);
    try {
      requireSelf(uid);
      if (!isTestMode()) await addDoc(collection(db, "users", uid, "bookingSafety"), { bookingId: bookingId.slice(0, 160), action, createdAt: serverTimestamp() });
      setMessage(t("safety.checkin.saved", "Check-in saved to your private booking records. It does not contact anyone."));
      if (action !== "help") onDone?.({ type: "safety-check-in", action, bookingId, saved: true });
    } catch (e) { setError(e?.message || t("safety.checkin.error", "Could not save this check-in. If you need urgent help, call 000 yourself.")); }
    finally { setBusy(false); }
  };
  return <section className="safe-root" aria-labelledby="safety-checkin-title"><SafetyStyles/><div className="safe-card">
    <h2 className="safe-title" id="safety-checkin-title">{t("safety.checkin.title", "Booking safety check-in")}</h2>
    <p className="safe-copy">{t("safety.checkin.intro", "Choose a check-in. It is saved privately for you and does not call or message anyone.")}</p>
    {booking?.title && <p className="safe-muted">{booking.title}</p>}
    <div className="safe-actions">{["arrived", "leaving", "help"].map((action) => <button key={action} className={`safe-btn ${action === "help" ? "safe-danger" : "safe-primary"}`} type="button" onClick={() => checkIn(action)} disabled={busy} aria-pressed={activeAction === action}>{busy && activeAction === action ? t("safety.saving", "Saving…") : checkInLabels[action]}</button>)}</div>
    {message && <p className="safe-message" role="status" aria-live="polite">{message}</p>}
    {error && <p className="safe-error" role="alert">{error}</p>}
    {activeAction === "help" && <div className="safe-message safe-alert" role="region" aria-label={t("safety.checkin.helpPanel", "Help information")}>
      <strong>{t("safety.checkin.emergency", "Australia emergency number")}</strong><div className="safe-emergency-number">000</div>
      <p className="safe-copy">{t("safety.checkin.noAutoCall", "The app will not call anyone. If there is immediate danger, call 000 yourself.")}</p>
      <strong>{t("safety.checkin.contacts", "Your emergency contacts")}</strong>
      {loading ? <p className="safe-muted">{t("safety.contacts.loading", "Loading saved contacts…")}</p> : contacts.length ? <div className="safe-list">{contacts.map((contact, index) => <div className="safe-contact" key={`${contact.phone}-${index}`}><strong>{contact.name}</strong><div className="safe-muted">{[contact.relationship, contact.phone].filter(Boolean).join(" · ")}</div></div>)}</div> : <p className="safe-muted">{t("safety.checkin.noContacts", "No emergency contacts saved. You can add them in Emergency contacts.")}</p>}
      <button className="safe-btn safe-soft" type="button" onClick={() => onDone?.({ type: "safety-check-in", action: "help", bookingId, saved: !error })}>{t("safety.done", "Done")}</button>
    </div>}
  </div></section>;
}

const CHECKED_LABEL = t("safety.qual.checked", "Date checked");
const EXPIRY_LABEL = t("safety.qual.expiry", "Expiry");
const statusText = (status) => t(`safety.qual.status.${status.replace(/ /g, "-")}`, status);
const profileState = (me) => me?.state || me?.card?.state || me?.raw?.state || me?.raw?.card?.state || "";
const stateAliases = { ACT: "Australian Capital Territory", NSW: "New South Wales", NT: "Northern Territory", QLD: "Queensland", SA: "South Australia", TAS: "Tasmania", VIC: "Victoria", WA: "Western Australia" };
const initialState = (me) => { const value = profileState(me); return stateAliases[String(value).toUpperCase()] || String(value); };
const displayDate = (value) => {
  const day = qualificationDateDay(value);
  if (!day) return t("safety.qual.notRecorded", "Not recorded");
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, date, 12));
};

export function Qualifications({ me, docs = [], editable = false }) {
  const [state, setState] = useState(() => initialState(me));
  const selected = WWCC_CHECKS.find((item) => item.state === state);
  return <section className="safe-root" aria-labelledby="safety-qual-title"><SafetyStyles/><div className="safe-card">
    <h2 className="safe-title" id="safety-qual-title">{t("safety.qual.title", "Qualifications and checks")}</h2>
    <p className="safe-copy">{t("safety.qual.intro", "Each qualification has its own status. Uploading a document does not verify a check.")}</p>
    <p className="safe-muted">{editable ? t("safety.qual.stateEdit", "Choose the state or territory for this check. This choice only changes the information shown here.") : t("safety.qual.stateView", "Choose any state or territory to see its official check name.")}</p>
    <label className="safe-label" htmlFor="safe-check-state">{t("safety.qual.state", "State or territory")}</label>
    <select className="safe-select" id="safe-check-state" value={state} onChange={(e) => setState(e.target.value)}>
      <option value="">{t("safety.qual.chooseState", "Choose your state or territory")}</option>
      {WWCC_CHECKS.map((item) => <option key={item.state} value={item.state}>{item.state}</option>)}
    </select>
    {selected ? <div className="safe-message">
      <strong>{selected.name}</strong>
      <p className="safe-copy">{t("safety.qual.stateNote", "This is the official local check name. Choosing a state does not verify a qualification.")}</p>
      <a className="safe-link" href={selected.officialUrl} target="_blank" rel="noreferrer">{t("safety.qual.official", "Open the official site")}</a>
      <p className="safe-muted">{t("safety.qual.lastChecked", "Official wording checked")}: {displayDate(selected.lastChecked)}</p>
    </div> : <p className="safe-muted">{t("safety.qual.stateHelp", "Each Australian state and territory has its own check. Queensland uses a Blue Card; other places use their own check or registration.")}</p>}
    <hr className="safe-divider"/>
    {docs.length ? <div className="safe-list">{docs.map((item, index) => {
      const { checkedOn, expiresOn } = qualificationDates(item);
      const status = qualificationStatus(item);
      const title = item.name || item.title || item.qualification || item.kind || t("safety.qual.unknown", "Qualification");
      return <article className="safe-qualification" key={item.id || `${title}-${index}`}>
        <div className="safe-qualification-top"><div className="safe-qualification-title">{title}</div><span className={`safe-status safe-status-${status.replace(/ /g, "-")}`}>{statusText(status)}</span></div>
        <p className="safe-muted">{CHECKED_LABEL}: {displayDate(checkedOn)}</p>
        <p className="safe-muted">{EXPIRY_LABEL}: {displayDate(expiresOn)}</p>
      </article>;
    })}</div> : <div className="safe-empty"><Bunny mood="think" size={78}/><p className="safe-muted">{t("safety.qual.empty", "No qualifications added yet.")}</p></div>}
  </div></section>;
}
