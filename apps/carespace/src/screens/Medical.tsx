import { useEffect, useState } from "react";
import { BackBar, Button, t, useNav, type ScreenProps } from "@cc/core";
import { canReadMedicalRecord, canWriteMedicalRecord, DEMO_MEDICAL, EMPTY_MEDICAL, loadMedicalRecord, saveMedicalRecord, type AllergyRecord, type EmergencyContact, type MedicalRecord, type MedicationRecord } from "../data/medical";
import type { CarePerms, CareRole } from "../data/children";
import { AllergyBanner, CareEmpty, DemoNotice } from "./care/common";
import "./care/care.css";

type Params = { spaceId?: string; childId?: string; childName?: string; uid?: string; role?: CareRole; perms?: CarePerms; demo?: boolean };
const demoMode = (explicit?: boolean) => explicit === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");
const cloneRecord = (record: MedicalRecord): MedicalRecord => ({ allergies: record.allergies.map((item) => ({ ...item })), medication: record.medication.map((item) => ({ ...item })), emergency: { ...record.emergency, contacts: record.emergency.contacts.map((item) => ({ ...item })) } });

export default function Medical({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const demo = demoMode(params.demo);
  const spaceId = params.spaceId ?? "";
  const childId = params.childId ?? "";
  const childName = params.childName ?? t("care.childTitle", "Child");
  const uid = params.uid ?? "";
  const role = params.role ?? (demo ? "admin" : "viewer");
  const perms = params.perms ?? { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false };
  const allowed = canReadMedicalRecord({ role, perms });
  const editable = canWriteMedicalRecord(role);
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [draft, setDraft] = useState<MedicalRecord>(cloneRecord(EMPTY_MEDICAL));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    if (!allowed) return;
    const request = demo ? Promise.resolve(DEMO_MEDICAL[childId] ?? EMPTY_MEDICAL) : loadMedicalRecord(spaceId, childId, { role, perms });
    request.then((value) => {
      if (!live || !value) return;
      setRecord(value); setDraft(cloneRecord(value));
    }).catch(() => { if (live) setError(t("care.medicalLoadError", "Medical details could not be read. Check access with an admin.")); });
    return () => { live = false; };
  }, [allowed, demo, childId, spaceId, role, perms]);

  function updateAllergy(index: number, key: keyof AllergyRecord, value: string) {
    setDraft({ ...draft, allergies: draft.allergies.map((item, i) => i === index ? { ...item, [key]: value } : item) });
  }
  function updateMedication(index: number, key: keyof MedicationRecord, value: string) {
    setDraft({ ...draft, medication: draft.medication.map((item, i) => i === index ? { ...item, [key]: value } : item) });
  }
  function updateContact(index: number, key: keyof EmergencyContact, value: string) {
    setDraft({ ...draft, emergency: { ...draft.emergency, contacts: draft.emergency.contacts.map((item, i) => i === index ? { ...item, [key]: value } : item) } });
  }

  async function save() {
    if (!editable || !record || !uid) { setError(t("care.medicalEditGuard", "Only an admin can edit these details. Sign in again if needed.")); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      if (!demo) await saveMedicalRecord(spaceId, childId, draft, uid, childName, role);
      setRecord(cloneRecord(draft)); setEditing(false);
      setNotice(t("care.medicalSaved", "Medical details saved. The care team was alerted."));
    } catch { setError(t("care.medicalSaveError", "Could not save medical details. Check admin access and try again.")); }
    finally { setBusy(false); }
  }

  return <div className="app">
    <BackBar title={t("care.medicalTitle", "Medical and emergency details")} onBack={nav.back} right={<span className="care-badge">{t("care.private", "Private")}</span>} />
    <div className="scroll"><div className="care-wrap">
      {demo && <DemoNotice />}
      {!allowed ? <CareEmpty title={t("care.medicalNoAccess", "You cannot read these details")} detail={t("care.medicalNoAccessHint", "A parent can grant allergy and medication access for this family space.")} /> : <>
        {record && <AllergyBanner names={record.allergies.map((item) => item.name).filter(Boolean)} />}
        <div className="care-info"><b>{t("care.medicalSeparate", "Private care information")}</b><p>{t("care.medicalSeparateHint", "Allergies, medication, and emergency instructions are stored apart from daily notes. Only an admin can edit them. Each saved change alerts the care team.")}</p></div>
        {error && <div className="care-info care-warning" role="alert">{error}</div>}
        {notice && <div className="care-status" role="status">{notice}</div>}
        {!record ? <div className="sk" style={{ height: 180, marginTop: 12 }} /> : <>
          <div className="care-head"><div><h1>{childName}</h1><p>{t("care.medicalForChild", "Medical details for this child")}</p></div></div>
          {editable && !editing && <Button onClick={() => { setDraft(cloneRecord(record)); setEditing(true); }}>{t("care.editMedical", "Edit details")}</Button>}
          <section className="care-section">
            <div className="care-card"><h2>{t("care.allergies", "Allergies")}</h2>
              {draft.allergies.length ? draft.allergies.map((item, index) => <div className="care-section-card" key={`allergy-${index}`}>
                {editing ? <div className="care-grid">
                  <label className="care-field"><span>{t("care.allergyName", "Allergy name")}</span><input value={item.name} onChange={(event) => updateAllergy(index, "name", event.target.value)} /></label>
                  <label className="care-field"><span>{t("care.severity", "Severity stated by parent")}</span><input value={item.severity} onChange={(event) => updateAllergy(index, "severity", event.target.value)} /></label>
                  <label className="care-field"><span>{t("care.allergyNotes", "Parent’s notes")}</span><textarea value={item.notes} onChange={(event) => updateAllergy(index, "notes", event.target.value)} /></label>
                  <Button alt onClick={() => setDraft({ ...draft, allergies: draft.allergies.filter((_, i) => i !== index) })}>{t("care.removeAllergy", "Remove allergy")}</Button>
                </div> : <><b>{item.name}</b>{item.severity && <p>{t("care.severityLabel", "Severity: {severity}", { severity: item.severity })}</p>}{item.notes && <p>{item.notes}</p>}</>}
              </div>) : <p className="care-muted">{t("care.noAllergies", "No allergies recorded in this space. Check with the parent before serving food.")}</p>}
              {editing && <Button alt onClick={() => setDraft({ ...draft, allergies: [...draft.allergies, { name: "", severity: "", notes: "" }] })}>{t("care.addAllergy", "Add an allergy")}</Button>}
            </div>
            <div className="care-card"><h2>{t("care.medications", "Medication")}</h2>
              {draft.medication.length ? draft.medication.map((item, index) => <div className="care-section-card" key={`medicine-${index}`}>
                {editing ? <div className="care-grid">
                  <label className="care-field"><span>{t("care.medName", "Medicine name")}</span><input value={item.name} onChange={(event) => updateMedication(index, "name", event.target.value)} /></label>
                  <label className="care-field"><span>{t("care.dose", "Dose stated by parent")}</span><input value={item.dose} onChange={(event) => updateMedication(index, "dose", event.target.value)} /></label>
                  <label className="care-field"><span>{t("care.medTimes", "Times or instructions")}</span><input value={item.times} onChange={(event) => updateMedication(index, "times", event.target.value)} /></label>
                  <label className="care-field"><span>{t("care.medNotes", "Notes")}</span><textarea value={item.notes} onChange={(event) => updateMedication(index, "notes", event.target.value)} /></label>
                  <Button alt onClick={() => setDraft({ ...draft, medication: draft.medication.filter((_, i) => i !== index) })}>{t("care.removeMedicine", "Remove medicine")}</Button>
                </div> : <><b>{item.name}</b><p>{item.dose} · {item.times}</p>{item.notes && <p>{item.notes}</p>}</>}
              </div>) : <p className="care-muted">{t("care.noMedication", "No medication recorded in this space.")}</p>}
              {editing && <Button alt onClick={() => setDraft({ ...draft, medication: [...draft.medication, { name: "", dose: "", times: "", notes: "" }] })}>{t("care.addMedicine", "Add medication")}</Button>}
            </div>
            <div className="care-card"><h2>{t("care.emergency", "Emergency details")}</h2>
              <h3>{t("care.contacts", "Contacts")}</h3>
              {draft.emergency.contacts.map((contact, index) => <div className="care-section-card" key={`contact-${index}`}>
                {editing ? <div className="care-grid">
                  <label className="care-field"><span>{t("care.contactName", "Contact name")}</span><input value={contact.name} onChange={(event) => updateContact(index, "name", event.target.value)} /></label>
                  <label className="care-field"><span>{t("care.contactPhone", "Phone")}</span><input type="tel" value={contact.phone} onChange={(event) => updateContact(index, "phone", event.target.value)} /></label>
                  <label className="care-field"><span>{t("care.relationship", "Relationship")}</span><input value={contact.relationship} onChange={(event) => updateContact(index, "relationship", event.target.value)} /></label>
                  <Button alt onClick={() => setDraft({ ...draft, emergency: { ...draft.emergency, contacts: draft.emergency.contacts.filter((_, i) => i !== index) } })}>{t("care.removeContact", "Remove contact")}</Button>
                </div> : <p><b>{contact.name}</b> · {contact.relationship} · <a href={`tel:${contact.phone}`}>{contact.phone}</a></p>}
              </div>)}
              {editing && <Button alt onClick={() => setDraft({ ...draft, emergency: { ...draft.emergency, contacts: [...draft.emergency.contacts, { name: "", phone: "", relationship: "" }] } })}>{t("care.addContact", "Add an emergency contact")}</Button>}
              <label className="care-field"><span>{t("care.doctor", "Doctor or clinic")}</span><input value={draft.emergency.doctor} onChange={(event) => setDraft({ ...draft, emergency: { ...draft.emergency, doctor: event.target.value } })} readOnly={!editing} /></label>
              <label className="care-field"><span>{t("care.emergencyNotes", "Emergency instructions")}</span><textarea value={draft.emergency.notes} onChange={(event) => setDraft({ ...draft, emergency: { ...draft.emergency, notes: event.target.value } })} readOnly={!editing} /></label>
            </div>
          </section>
          {editing && <div className="care-row"><Button onClick={() => void save()} disabled={busy}>{t("care.saveMedical", "Save changes")}</Button><Button alt onClick={() => { setDraft(cloneRecord(record)); setEditing(false); }}>{t("care.cancel", "Cancel")}</Button></div>}
          <div className="care-row"><Button alt onClick={() => nav.push("emergency", { spaceId, childId, childName, uid, role, perms, demo })}>{t("care.printSheet", "Open emergency sheet")}</Button></div>
        </>}
      </>}
    </div></div>
  </div>;
}
