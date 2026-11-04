import { useEffect, useState } from "react";
import { BackBar, Button, t, useNav, type ScreenProps } from "@cc/core";
import { canReadEmergencyRecord, DEMO_MEDICAL, EMPTY_MEDICAL, loadMedicalRecord, type MedicalRecord } from "../data/medical";
import type { CarePerms, CareRole } from "../data/children";
import { AllergyBanner, CareEmpty, DemoNotice } from "./care/common";
import "./care/care.css";

type Params = { spaceId?: string; childId?: string; childName?: string; uid?: string; role?: CareRole; perms?: CarePerms; demo?: boolean };
const demoMode = (explicit?: boolean) => explicit === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");

export default function EmergencySheet({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const demo = demoMode(params.demo);
  const spaceId = params.spaceId ?? "";
  const childId = params.childId ?? "";
  const childName = params.childName ?? t("care.childTitle", "Child");
  const role = params.role ?? (demo ? "admin" : "viewer");
  const perms = params.perms ?? { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false };
  const allowed = canReadEmergencyRecord({ role, perms });
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    if (!allowed) return;
    const request = demo ? Promise.resolve(DEMO_MEDICAL[childId] ?? EMPTY_MEDICAL) : loadMedicalRecord(spaceId, childId, { role, perms });
    request.then((value) => { if (live && value) setRecord(value); }).catch(() => { if (live) setError(t("care.emergencyLoadError", "Could not read emergency details. Ask an admin for access.")); });
    return () => { live = false; };
  }, [allowed, demo, childId, spaceId, role, perms]);

  return <div className="app">
    <BackBar title={t("care.emergencySheetTitle", "Emergency sheet")} onBack={nav.back} right={allowed && record ? <Button small alt className="no-print" onClick={() => window.print()}>{t("care.print", "Print")}</Button> : undefined} />
    <div className="scroll"><div className="care-wrap">
      {demo && <DemoNotice />}
      {error && <div className="care-info care-warning" role="alert">{error}</div>}
      {!allowed ? <CareEmpty title={t("care.medicalNoAccess", "You cannot read these details")} detail={t("care.emergencyNoAccessHint", "Only a family admin can read emergency contacts and instructions.")} /> : !record ? <div className="sk" style={{ height: 160 }} /> : <>
        <div className="care-print-actions no-print"><Button onClick={() => window.print()}>{t("care.printSheet", "Print emergency sheet")}</Button><Button alt onClick={nav.back}>{t("care.done", "Done")}</Button></div>
        <article className="emergency-print care-card" aria-label={t("care.emergencySheetTitle", "Emergency sheet")}>
          <h1>{t("care.emergencySheetTitle", "Emergency sheet")}</h1>
          <h2>{childName}</h2>
          <p>{t("care.emergencySheetDate", "Prepared on {date}", { date: new Date().toLocaleDateString() })}</p>
          <AllergyBanner names={record.allergies?.map((item) => item.name).filter(Boolean) ?? []} />
          <section><h2>{t("care.contacts", "Emergency contacts")}</h2>
            {record.emergency === null ? <p role="alert">{t("care.emergencyUnavailable", "Emergency details are not available or recorded. Ask a parent before relying on them.")}</p> : record.emergency.contacts.length ? <ul className="care-list">{record.emergency.contacts.map((contact, index) => <li key={`${contact.name}-${index}`}><b>{contact.name}</b><br />{contact.relationship}<br /><a href={`tel:${contact.phone}`}>{contact.phone}</a></li>)}</ul> : <p>{t("care.noContacts", "No emergency contacts recorded.")}</p>}
          </section>
          <section><h2>{t("care.doctor", "Doctor or clinic")}</h2>{record.emergency === null ? <p>{t("care.emergencyUnavailable", "Emergency details are not available or recorded. Ask a parent before relying on them.")}</p> : <><p>{record.emergency.doctor || t("care.noDoctor", "No doctor or clinic recorded.")}</p>{record.emergency.notes && <p>{record.emergency.notes}</p>}</>}</section>
          <section><h2>{t("care.allergies", "Allergies")}</h2>
            {record.allergies === null ? <p role="alert">{t("care.allergyUnavailableHint", "Ask a parent to record and confirm this child’s allergies before serving food.")}</p> : record.allergies.length ? <ul className="care-list">{record.allergies.map((allergy, index) => <li key={`${allergy.name}-${index}`}><b>{allergy.name}</b>{allergy.severity && <p>{t("care.severityLabel", "Severity: {severity}", { severity: allergy.severity })}</p>}{allergy.notes && <p>{allergy.notes}</p>}</li>)}</ul> : <p>{t("care.noAllergies", "No allergies recorded in this space. Check with the parent before serving food.")}</p>}
          </section>
          <section><h2>{t("care.medications", "Medication")}</h2>
            {record.medication === null ? <p role="alert">{t("care.medicationUnavailable", "Medication details are not available or recorded. Ask a parent before relying on them.")}</p> : record.medication.length ? <ul className="care-list">{record.medication.map((medication, index) => <li key={`${medication.name}-${index}`}><b>{medication.name}</b><p>{medication.dose} · {medication.times}</p>{medication.notes && <p>{medication.notes}</p>}</li>)}</ul> : <p>{t("care.noMedication", "No medication recorded in this space.")}</p>}
          </section>
          <p><b>{t("care.emergencyAccuracy", "Follow the parent’s latest instructions. If there is immediate danger, call local emergency services.")}</b></p>
        </article>
      </>}
    </div></div>
  </div>;
}
