import { useEffect, useState } from "react";
import { BackBar, Button, MediaPicker, t, useNav, type ScreenProps } from "@cc/core";
import { addChildMemory, canEditChildDetails, canReadAllergies, DEMO_CHILDREN, isRoutineTime, loadChildren, parseChildList, saveChildDetails, saveChildSection, type CarePerms, type CareRole, type ChildDetails, type ChildMilestone, type ChildNap, type ChildProfile, type ChildSectionId } from "../data/children";
import { addGalleryItem } from "../data/gallery";
import { canReadEmergencyRecord, canReadMedicalRecord, DEMO_MEDICAL, loadMedicalRecord, type MedicalRecord } from "../data/medical";
import Gallery from "./Gallery";
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
const NO_PERMS: CarePerms = { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false };
const demoMode = (explicit?: boolean) => explicit === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");
const localDateTimeInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export default function Child({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const demo = demoMode(params.demo);
  const spaceId = params.spaceId ?? "";
  const childId = params.childId ?? "";
  const role = params.role ?? (demo ? "admin" : "viewer");
  const perms = params.perms ?? NO_PERMS;
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [medical, setMedical] = useState<MedicalRecord | null>(null);
  const [medicalLoaded, setMedicalLoaded] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<ChildSectionId, string>>>({});
  const [memoryDraft, setMemoryDraft] = useState("");
  const [foodDraft, setFoodDraft] = useState("");
  const [learningGoalsDraft, setLearningGoalsDraft] = useState("");
  const [wakeDraft, setWakeDraft] = useState("");
  const [bedDraft, setBedDraft] = useState("");
  const [napDrafts, setNapDrafts] = useState<ChildNap[]>([]);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneAt, setMilestoneAt] = useState(() => localDateTimeInput(new Date()));
  const [milestoneNote, setMilestoneNote] = useState("");
  const [milestonePhotoKey, setMilestonePhotoKey] = useState("");
  const [editingMilestoneIndex, setEditingMilestoneIndex] = useState<number | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { if (!child) return;
    setFoodDraft(child.foodPreferences.join(", "));
    setLearningGoalsDraft(child.learningGoals.join(", "));
    setWakeDraft(child.routine.wake ?? "");
    setBedDraft(child.routine.bed ?? "");
    setNapDrafts(child.routine.naps);
  }, [child?.id]);

  useEffect(() => {
    let live = true;
    setChild(null); setMedical(null); setMedicalLoaded(false); setError("");
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

  async function saveDetails(changes: Partial<ChildDetails>): Promise<boolean> {
    if (!child || !canEditChildDetails(role)) return false;
    const details: ChildDetails = {
      foodPreferences: changes.foodPreferences ?? child.foodPreferences,
      learningGoals: changes.learningGoals ?? child.learningGoals,
      milestones: changes.milestones ?? child.milestones,
      routine: changes.routine ?? child.routine,
    };
    setBusy(true); setError("");
    try {
      if (!demo) await saveChildDetails(spaceId, child.name, child.id, details);
      setChild({ ...child, ...details });
      setNotice(t("care.childDetailsSaved", "Child profile details saved."));
      return true;
    } catch { setError(t("care.childDetailsSaveError", "Could not save these child profile details.")); return false; }
    finally { setBusy(false); }
  }

  async function saveRoutine() {
    if (napDrafts.some((nap) => !isRoutineTime(nap.from) || !isRoutineTime(nap.to))) {
      setError(t("care.routineNapTimeError", "Enter a start and end time for each nap."));
      return;
    }
    const routine = { ...(wakeDraft ? { wake: wakeDraft } : {}), ...(bedDraft ? { bed: bedDraft } : {}), naps: napDrafts };
    if (await saveDetails({ routine })) setNotice(t("care.routineSaved", "Routine saved."));
  }

  async function saveMilestone() {
    if (!child || !milestoneTitle.trim() || !milestoneAt || !canEditChildDetails(role)) return;
    const at = new Date(milestoneAt);
    if (!Number.isFinite(at.getTime())) { setError(t("care.milestoneDateError", "Choose a valid date and time.")); return; }
    const milestone: ChildMilestone = {
      title: milestoneTitle.trim(), at,
      ...(milestoneNote.trim() ? { note: milestoneNote.trim() } : {}),
      ...(milestonePhotoKey ? { photoKey: milestonePhotoKey } : {}),
    };
    const milestones = [...child.milestones];
    if (editingMilestoneIndex === null) {
      if (milestones.length >= 100) { setError(t("care.milestoneLimit", "This profile has reached the 100 milestone limit.")); return; }
      milestones.push(milestone);
    } else milestones[editingMilestoneIndex] = milestone;
    if (await saveDetails({ milestones })) {
      setMilestoneTitle(""); setMilestoneAt(localDateTimeInput(new Date())); setMilestoneNote(""); setMilestonePhotoKey(""); setEditingMilestoneIndex(null);
      setNotice(t("care.milestoneSaved", "Milestone saved."));
    }
  }

  function editMilestone(milestone: ChildMilestone, index: number) {
    setMilestoneTitle(milestone.title); setMilestoneAt(localDateTimeInput(milestone.at)); setMilestoneNote(milestone.note ?? "");
    setMilestonePhotoKey(milestone.photoKey ?? ""); setEditingMilestoneIndex(index);
  }

  async function deleteMilestone(index: number) {
    if (!child || !canEditChildDetails(role)) return;
    const milestones = child.milestones.filter((_, itemIndex) => itemIndex !== index);
    if (await saveDetails({ milestones })) {
      if (editingMilestoneIndex === index) { setEditingMilestoneIndex(null); setMilestoneTitle(""); setMilestoneNote(""); setMilestonePhotoKey(""); }
      else if (editingMilestoneIndex !== null && editingMilestoneIndex > index) setEditingMilestoneIndex(editingMilestoneIndex - 1);
    }
  }

  async function addMilestonePhoto(key: string) {
    const uid = params.uid ?? "";
    if (!uid) { setError(t("care.galleryPhotoNeedsAccount", "Sign in again before adding a photo.")); return; }
    try {
      await addGalleryItem(spaceId, { key, kind: "photo", by: uid, childId });
      setMilestonePhotoKey(key);
      setNotice(t("care.milestonePhotoAdded", "Photo added. A parent can share it with the family from Photos and videos."));
    } catch { setError(t("care.milestonePhotoSaveError", "The photo uploaded, but could not be linked to this milestone.")); }
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

  if (galleryOpen && child) return <Gallery params={{ spaceId, childId, childName: child.name, uid: params.uid, role, perms, demo }} onBack={() => setGalleryOpen(false)} />;
  if (!child) return <div className="app"><BackBar title={params.childName ?? t("care.childTitle", "Child profile")} onBack={nav.back} /><div className="scroll"><div className="care-wrap">{demo && <DemoNotice />}{error ? <div className="care-info care-warning" role="alert">{error}</div> : <CareEmpty title={t("care.childLoading", "Loading child profile…")} />}</div></div></div>;

  const allergyNames = canReadAllergies({ role, perms }) ? medical?.allergies?.map((item) => item.name).filter(Boolean) ?? [] : [];
  return <div className="app">
    <BackBar title={child.name} onBack={nav.back} />
    <div className="scroll"><div className="care-wrap">
      {demo && <DemoNotice />}
      <AllergyBanner names={allergyNames} />
      {!canReadAllergies({ role, perms }) && <div className="care-alert" role="alert"><strong>{t("care.allergyInfoMissing", "Allergy details are not available to you.")}</strong><p>{t("care.allergyInfoMissingHint", "Not checked for this child. Ask a parent first.")}</p></div>}
      {canReadAllergies({ role, perms }) && medicalLoaded && medical?.allergies === null && <div className="care-alert" role="alert"><strong>{t("care.allergyUnconfirmed", "Allergy details could not be confirmed.")}</strong><p>{t("care.allergyUnavailableHint", "Ask a parent to confirm allergies before serving food.")}</p></div>}
      {error && <div className="care-info care-warning" role="alert">{error}</div>}
      {notice && <div className="care-status" role="status">{notice}</div>}
      <div className="care-head"><div><h1>{child.name}</h1><p>{t("care.childAge", "Age {age} years", { age: child.ageYears })}</p></div><span className="care-badge">{t("care.profilePrivate", "Private family profile")}</span></div>
      <div className="care-row" aria-label={t("care.childActions", "Child actions")}>
        <Button onClick={() => nav.push("daily-report", { spaceId, childId, childName: child.name, uid: params.uid, role, perms, demo })}>{t("care.dailyReport", "Daily report")}</Button>
        <Button alt onClick={() => nav.push("meals", { spaceId, childId, childName: child.name, uid: params.uid, role, perms, demo })}>{t("care.planMeals", "Meals")}</Button>
        <Button alt onClick={() => setGalleryOpen(true)}>{t("care.galleryOpen", "Photos and videos")}</Button>
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
            {section.id === "meals" && <>
              <label className="care-field"><span>{t("care.foodPreferencesLabel", "Food preferences, separated by commas")}</span><textarea value={foodDraft} onChange={(event) => setFoodDraft(event.target.value)} disabled={!canEditChildDetails(role)} maxLength={3_600} /></label>
              <p className="care-muted">{t("care.foodPreferencesSafety", "Preferences aren't allergy records. Check Medical first.")}</p>
              {canEditChildDetails(role) && <Button alt onClick={() => void saveDetails({ foodPreferences: parseChildList(foodDraft, 30, 120) })} disabled={busy}>{t("care.saveFoodPreferences", "Save food preferences")}</Button>}
            </>}
            {section.id === "sleep" && <>
              <label className="care-field"><span>{t("care.wakeTimeLabel", "Usual wake time")}</span><input type="time" value={wakeDraft} onChange={(event) => setWakeDraft(event.target.value)} disabled={!canEditChildDetails(role)} /></label>
              <label className="care-field"><span>{t("care.bedTimeLabel", "Usual bed time")}</span><input type="time" value={bedDraft} onChange={(event) => setBedDraft(event.target.value)} disabled={!canEditChildDetails(role)} /></label>
              <h3>{t("care.napTimesTitle", "Nap times")}</h3>
              {napDrafts.length ? <div className="care-list">{napDrafts.map((nap, index) => <div className="care-row" key={`nap-${index}`}>
                <label className="care-field"><span>{t("care.napFromLabel", "Nap starts")}</span><input type="time" value={nap.from} onChange={(event) => setNapDrafts((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, from: event.target.value } : item))} disabled={!canEditChildDetails(role)} /></label>
                <label className="care-field"><span>{t("care.napToLabel", "Nap ends")}</span><input type="time" value={nap.to} onChange={(event) => setNapDrafts((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, to: event.target.value } : item))} disabled={!canEditChildDetails(role)} /></label>
                {canEditChildDetails(role) && <Button alt onClick={() => setNapDrafts((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={t("care.removeNap", "Remove nap")}>{t("care.remove", "Remove")}</Button>}
              </div>)}</div> : <p className="care-muted">{t("care.noNaps", "No usual naps recorded.")}</p>}
              {canEditChildDetails(role) && <div className="care-row"><Button alt onClick={() => setNapDrafts((items) => items.length < 10 ? [...items, { from: "", to: "" }] : items)} disabled={napDrafts.length >= 10}>{t("care.addNap", "Add nap")}</Button><Button onClick={() => void saveRoutine()} disabled={busy || (wakeDraft !== "" && !isRoutineTime(wakeDraft)) || (bedDraft !== "" && !isRoutineTime(bedDraft))}>{t("care.saveRoutine", "Save routine")}</Button></div>}
            </>}
            {section.id === "learning" && <>
              <div className="care-row">{child.interests.map((interest) => <span className="care-badge" key={interest}>{interest}</span>)}</div>
              <label className="care-field"><span>{t("care.learningGoalsLabel", "Learning goals, separated by commas")}</span><textarea value={learningGoalsDraft} onChange={(event) => setLearningGoalsDraft(event.target.value)} disabled={!canEditChildDetails(role)} maxLength={6_000} /></label>
              {canEditChildDetails(role) && <Button alt onClick={() => void saveDetails({ learningGoals: parseChildList(learningGoalsDraft, 30, 200) })} disabled={busy}>{t("care.saveLearningGoals", "Save learning goals")}</Button>}
            </>}
            {section.id === "memories" ? <>
              {child.sections.memories.length > 0 ? <ul className="care-list">{child.sections.memories.map((memory, index) => <li key={`${index}-${memory}`}>{memory}</li>)}</ul> : <p className="care-muted">{t("care.noMemories", "No memories saved yet.")}</p>}
              {canEditProfile() && <><label className="care-field"><span>{t("care.memoryLabel", "Add a memory")}</span><textarea value={memoryDraft} onChange={(event) => setMemoryDraft(event.target.value)} maxLength={500} /></label><Button alt onClick={() => void addMemory()} disabled={!memoryDraft.trim() || busy}>{t("care.addMemory", "Add memory")}</Button></>}
              <h3>{t("care.milestonesTitle", "Milestones")}</h3>
              {child.milestones.length ? <ul className="care-list">{child.milestones.map((milestone, index) => <li key={`${milestone.at.toISOString()}-${index}`}>
                <strong>{milestone.title}</strong><p>{milestone.at.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</p>
                {milestone.note && <p>{milestone.note}</p>}
                {milestone.photoKey && <span className="care-badge">{t("care.milestonePhotoAttached", "Photo attached in the private gallery")}</span>}
                {canEditChildDetails(role) && <div className="care-row"><Button alt onClick={() => editMilestone(milestone, index)}>{t("care.editMilestone", "Edit")}</Button><Button alt onClick={() => void deleteMilestone(index)} disabled={busy}>{t("care.deleteMilestone", "Remove")}</Button></div>}
              </li>)}</ul> : <p className="care-muted">{t("care.noMilestones", "No milestones saved yet.")}</p>}
              {canEditChildDetails(role) && <div className="care-card">
                <h3>{t("care.milestoneFormTitle", editingMilestoneIndex === null ? "Add a milestone" : "Edit milestone")}</h3>
                <label className="care-field"><span>{t("care.milestoneTitleLabel", "Milestone")}</span><input value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} maxLength={120} /></label>
                <label className="care-field"><span>{t("care.milestoneDateLabel", "Date and time")}</span><input type="datetime-local" value={milestoneAt} onChange={(event) => setMilestoneAt(event.target.value)} required /></label>
                <label className="care-field"><span>{t("care.milestoneNoteLabel", "Optional note")}</span><textarea value={milestoneNote} onChange={(event) => setMilestoneNote(event.target.value)} maxLength={600} /></label>
                {demo ? null : <>
                  <MediaPicker kind="gallery" uid={params.uid} spaceId={spaceId} buttonLabel={t("care.milestonePhotoButton", "Add optional photo")} onDone={(key) => void addMilestonePhoto(key)} />
                </>}
                {milestonePhotoKey && <p className="care-status" role="status">{t("care.milestonePhotoReady", "A private photo is attached to this milestone.")}</p>}
                <div className="care-row"><Button onClick={() => void saveMilestone()} disabled={busy || !milestoneTitle.trim() || !milestoneAt}>{t("care.saveMilestone", editingMilestoneIndex === null ? "Save milestone" : "Update milestone")}</Button>{editingMilestoneIndex !== null && <Button alt onClick={() => { setEditingMilestoneIndex(null); setMilestoneTitle(""); setMilestoneAt(localDateTimeInput(new Date())); setMilestoneNote(""); setMilestonePhotoKey(""); }}>{t("care.cancelEditMilestone", "Cancel edit")}</Button>}</div>
              </div>}
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
