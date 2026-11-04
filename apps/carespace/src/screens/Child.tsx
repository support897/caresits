import { useEffect, useState } from "react";
import { BackBar, Button, t, useNav, type ScreenProps } from "@cc/core";
import { addChildMemory, canReadAllergies, DEMO_CHILDREN, loadChildren, saveChildSection, type CarePerms, type CareRole, type ChildProfile, type ChildSectionId } from "../data/children";
import { canReadEmergencyRecord, canReadMedicalRecord, DEMO_MEDICAL, loadMedicalRecord, type MedicalRecord } from "../data/medical";
import { AllergyBanner, CareEmpty, DemoNotice } from "./care/common";
import "./care/care.css";

type Params = { spaceId?: string; childId?: string; childName?: string; uid?: string; role?: CareRole; perms?: CarePerms; ownerUid?: string; demo?: boolean };
const SECTIONS: { id: ChildSectionId | "memories"; title: string; field?: ChildSectionId; description: string }[] = [
  { id: "health", field: "health", title: "Health and safety", description: "General care notes only. Allergies, medicine, and emergency details stay in Medical." },
  { id: "meals", field: "meals", title: "Meals", description: "Food preferences, meal plans, ingredients, and water notes." },
  { id: "sleep", field: "sleep", title: "Sleep and routine", description: "Rest times, wake-up notes, and bedtime routines." },
  { id: "mood", field: "mood", title: "Mood", description: "Comfort, energy, and changes to share with the family." },
  { id: "learning", field: "learning", title: "Learning", description: "Interests, learning goals, and favorite activities." },
  { id: "memories", title: "Memories", description: "Small moments, photos, and milestones to keep." },
];
const demoMode = (explicit?: boolean) => explicit === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");

export default function Child({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const demo = demoMode(params.demo);
  const spaceId = params.spaceId ?? "";
  const childId = params.childId ?? "";
  const role = params.role ?? (demo ? "admin" : "viewer");
  const perms = params.perms ?? { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false };
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [medical, setMedical] = useState<MedicalRecord | null>(null);
  const [medicalLoaded, setMedicalLoaded] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<ChildSectionId, string>>>({});
  const [memoryDraft, setMemoryDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setMedical(null); setMedicalLoaded(false);
    if (!spaceId || !childId) return;
    const childrenRequest = demo ? Promise.resolve(DEMO_CHILDREN) : loadChildren(spaceId);
    childrenRequest.then(async (items) => {
      const found = items.find((item) => item.id === childId) ?? null;
      if (live) setChild(found);
      if (!canReadMedicalRecord({ role, perms })) return;
      try {
        const result = demo ? DEMO_MEDICAL[childId] ?? null : await loadMedicalRecord(spaceId, childId, { role, perms });
        if (live) { setMedical(result); setMedicalLoaded(true); }
      } catch { if (live) { setMedicalLoaded(true); setError(t("care.childMedicalError", "Medical details could not be read. Check access with a parent.")); } }
    }).catch(() => { if (live) setError(t("care.childLoadError", "Could not load this child profile.")); });
    return () => { live = false; };
  }, [spaceId, childId, demo, role, perms]);

  async function saveSection(section: ChildSectionId, value: string) {
    if (!child || !canEditProfile()) return;
    setBusy(true); setError("");
    try {
      if (!demo) await saveChildSection(spaceId, child.id, section, value);
      setChild({ ...child, sections: { ...child.sections, [section]: { notes: value } } });
      setNotice(t("care.sectionSaved", "Care note saved."));
    } catch { setError(t("care.sectionSaveError", "Could not save this care note.")); }
    finally { setBusy(false); }
  }

  function canEditProfile() { return role === "admin" || role === "regular"; }

  async function addMemory() {
    if (!child || !memoryDraft.trim() || !canEditProfile()) return;
    setBusy(true); setError("");
    try {
      if (!demo) await addChildMemory(spaceId, child.id, memoryDraft.trim());
      setChild({ ...child, sections: { ...child.sections, memories: [...child.sections.memories, memoryDraft.trim()] } });
      setMemoryDraft(""); setNotice(t("care.memorySaved", "Memory added."));
    } catch { setError(t("care.memorySaveError", "Could not add this memory.")); }
    finally { setBusy(false); }
  }

  if (!child) return <div className="app"><BackBar title={params.childName ?? t("care.childTitle", "Child profile")} onBack={nav.back} /><div className="scroll"><div className="care-wrap">{demo && <DemoNotice />}{error ? <div className="care-info care-warning" role="alert">{error}</div> : <CareEmpty title={t("care.childLoading", "Loading child profile…")} />}</div></div></div>;

  const allergyNames = canReadAllergies({ role, perms }) ? medical?.allergies?.map((item) => item.name).filter(Boolean) ?? [] : [];
  return <div className="app">
    <BackBar title={child.name} onBack={nav.back} />
    <div className="scroll"><div className="care-wrap">
      {demo && <DemoNotice />}
      <AllergyBanner names={allergyNames} />
      {!canReadAllergies({ role, perms }) && <div className="care-alert" role="alert"><strong>{t("care.allergyInfoMissing", "Allergy details are not available to you.")}</strong><p>{t("care.allergyInfoMissingHint", "Ask a parent before serving food.")}</p></div>}
      {canReadAllergies({ role, perms }) && medicalLoaded && medical?.allergies === null && <div className="care-alert" role="alert"><strong>{t("care.allergyUnconfirmed", "Allergy details could not be confirmed.")}</strong><p>{t("care.allergyUnavailableHint", "Ask a parent to record and confirm this child’s allergies before serving food.")}</p></div>}
      {error && <div className="care-info care-warning" role="alert">{error}</div>}
      {notice && <div className="care-status" role="status">{notice}</div>}
      <div className="care-head"><div><h1>{child.name}</h1><p>{t("care.childAge", "Age {age} years", { age: child.ageYears })}</p></div><span className="care-badge">{t("care.profilePrivate", "Private family profile")}</span></div>
      <div className="care-row" aria-label={t("care.childActions", "Child actions")}>
        <Button onClick={() => nav.push("daily-report", { spaceId, childId, childName: child.name, uid: params.uid, role, perms, demo })}>{t("care.dailyReport", "Daily report")}</Button>
        <Button alt onClick={() => nav.push("meals", { spaceId, childId, childName: child.name, uid: params.uid, role, perms, demo })}>{t("care.planMeals", "Meals")}</Button>
        {canReadMedicalRecord({ role, perms }) && <Button alt onClick={() => nav.push("medical", { spaceId, childId, childName: child.name, uid: params.uid, role, perms, demo })}>{t("care.medical", "Medical")}</Button>}
        {canReadEmergencyRecord({ role, perms }) && <Button alt onClick={() => nav.push("emergency", { spaceId, childId, childName: child.name, uid: params.uid, role, perms, demo })}>{t("care.emergencySheet", "Emergency sheet")}</Button>}
      </div>
      <section className="care-section" aria-label={t("care.sixSections", "Child care sections")}>
        {SECTIONS.map((section) => {
          const value = section.field ? child.sections[section.field].notes : "";
          const draft = section.field ? drafts[section.field] ?? value : "";
          return <details className="care-section-card" key={section.id} open={section.id === "health"}>
            <summary>{t(`care.section.${section.id}`, section.title)}</summary>
            <p className="care-muted">{section.id === "health" ? t("care.healthSectionGuard", section.description) : t(`care.sectionHint.${section.id}`, section.description)}</p>
            {section.id === "learning" && <div className="care-row">{child.interests.map((interest) => <span className="care-badge" key={interest}>{interest}</span>)}</div>}
            {section.id === "memories" ? <>
              {child.sections.memories.length > 0 ? <ul className="care-list">{child.sections.memories.map((memory, index) => <li key={`${index}-${memory}`}>{memory}</li>)}</ul> : <p className="care-muted">{t("care.noMemories", "No memories saved yet.")}</p>}
              {canEditProfile() && <><label className="care-field"><span>{t("care.memoryLabel", "Add a memory")}</span><textarea value={memoryDraft} onChange={(event) => setMemoryDraft(event.target.value)} maxLength={500} /></label><Button alt onClick={() => void addMemory()} disabled={!memoryDraft.trim() || busy}>{t("care.addMemory", "Add memory")}</Button></>}
            </> : section.field && <>
              <label className="care-field"><span>{t("care.notesLabel", "Care notes")}</span><textarea value={draft} onChange={(event) => setDrafts({ ...drafts, [section.field!]: event.target.value })} disabled={!canEditProfile()} maxLength={1500} /></label>
              {canEditProfile() && <Button alt onClick={() => void saveSection(section.field!, draft)} disabled={busy}>{t("care.saveSection", "Save {section}", { section: t(`care.section.${section.id}`, section.title) })}</Button>}
            </>}
          </details>;
        })}
      </section>
    </div></div>
  </div>;
}
