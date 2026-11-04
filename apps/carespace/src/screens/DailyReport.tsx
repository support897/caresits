import { useEffect, useMemo, useState } from "react";
import { BackBar, Button, t, useNav, type ScreenProps } from "@cc/core";
import { MediaPicker } from "@cc/core/src/media/MediaPicker";
import { addDayStoryItem, DEMO_CHILDREN, loadChildren, loadDayStory, type CarePerms, type CareRole, type DayStoryItem, type DayStoryKind } from "../data/children";
import { DEMO_MEDICAL, loadMedicalRecord } from "../data/medical";
import { checkAllergy } from "../lib/allergy";
import { AllergyCheckNotice, AllergyBanner, CareEmpty, DemoNotice } from "./care/common";
import "./care/care.css";

type Params = { spaceId?: string; childId?: string; childName?: string; uid?: string; role?: CareRole; perms?: CarePerms; demo?: boolean };
const demoMode = (explicit?: boolean) => explicit === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");
const todayKey = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); };
const QUICK: { label: string; kind: DayStoryKind; text: string; mood?: string }[] = [
  { label: "Ate well", kind: "meal", text: "Ate well · ingredients not listed" },
  { label: "Drank water", kind: "drink", text: "Drank water" },
  { label: "Napped", kind: "nap", text: "Napped" },
  { label: "Happy", kind: "mood", text: "Happy", mood: "happy" },
  { label: "Tired", kind: "mood", text: "Tired", mood: "tired" },
  { label: "Played outside", kind: "activity", text: "Played outside" },
  { label: "Arrived", kind: "arrival", text: "Arrived" },
  { label: "Picked up", kind: "pickup", text: "Picked up" },
];

export default function DailyReport({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const demo = demoMode(params.demo);
  const spaceId = params.spaceId ?? "";
  const childId = params.childId ?? "";
  const uid = params.uid ?? "";
  const role = params.role ?? (demo ? "admin" : "viewer");
  const perms = params.perms ?? { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false };
  const [allergies, setAllergies] = useState<string[]>([]);
  const [items, setItems] = useState<DayStoryItem[]>([]);
  const [mealText, setMealText] = useState("");
  const [mealQuickCheck, setMealQuickCheck] = useState<ReturnType<typeof checkAllergy> | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const day = useMemo(todayKey, []);
  const check = useMemo(() => checkAllergy(mealText, allergies), [mealText, allergies]);

  async function refresh() {
    if (!spaceId || !childId || demo) return;
    const story = await loadDayStory(spaceId, childId, day);
    setItems(story);
  }

  useEffect(() => {
    let live = true;
    if (!spaceId || !childId) return;
    const allergyRequest = demo
      ? Promise.resolve(DEMO_MEDICAL[childId]?.allergies.map((item) => item.name) ?? [])
      : (async () => {
          const children = await loadChildren(spaceId);
          const medical = await loadMedicalRecord(spaceId, childId, { role, perms });
          return children.some((item) => item.id === childId) ? medical?.allergies.map((item) => item.name) ?? [] : [];
        })();
    allergyRequest.then((value) => { if (live) setAllergies(value); }).catch(() => { if (live) setError(t("care.reportAllergyError", "Allergy details could not be read. Ask a parent before logging food.")); });
    if (demo) {
      setItems([{ id: "demo-story-1", childId, day, kind: "activity", at: new Date().toISOString(), text: "Read a picture book together." }]);
    } else {
      refresh().catch(() => { if (live) setError(t("care.reportLoadError", "Could not load today’s report.")); });
    }
    return () => { live = false; };
  }, [spaceId, childId, day, demo, role, perms]);

  async function saveItem(kind: DayStoryKind, text: string, mood?: string, photoKey?: string) {
    if (!spaceId || !childId || !text.trim()) return;
    setBusy(true); setError("");
    const local: DayStoryItem = { id: `local-${Date.now()}`, childId, day, kind, at: new Date().toISOString(), text: text.trim(), ...(mood ? { mood } : {}), ...(photoKey ? { photoKey } : {}), ...(uid ? { by: uid } : {}) };
    try {
      if (!demo) {
        const id = await addDayStoryItem(spaceId, { childId, day, kind, text: text.trim(), ...(mood ? { mood } : {}), ...(photoKey ? { photoKey } : {}), ...(uid ? { by: uid } : {}) });
        local.id = id;
      }
      setItems((current) => [local, ...current]);
    } catch { setError(t("care.reportSaveError", "Could not save this report item. Try again.")); }
    finally { setBusy(false); }
  }

  async function saveMeal() {
    const entered = mealText.trim();
    if (!entered) return;
    await saveItem("meal", entered);
    setMealText("");
  }

  async function saveNote() {
    const entered = note.trim();
    if (!entered) return;
    await saveItem("note", entered);
    setNote("");
  }

  async function savePhoto(key: string) {
    await saveItem("photo", t("care.photoAdded", "Photo added to today’s report."), undefined, key);
  }

  const title = params.childName ?? DEMO_CHILDREN.find((child) => child.id === childId)?.name ?? t("care.childTitle", "Child");
  return <div className="app">
    <BackBar title={t("care.dailyReportTitle", "Daily report")} onBack={nav.back} />
    <div className="scroll"><div className="care-wrap">
      {demo && <DemoNotice />}
      <div className="care-head"><div><h1>{title}</h1><p>{t("care.reportDate", "Today · {day}", { day })}</p></div></div>
      {!!allergies.length && <AllergyBanner names={allergies} />}
      {error && <div className="care-info care-warning" role="alert">{error}</div>}
      <section className="care-card">
        <h2>{t("care.quickReport", "One-tap updates")}</h2>
        <p className="care-muted">{t("care.quickReportHint", "Tap once to add an update to today’s story.")}</p>
        {mealQuickCheck && <AllergyCheckNotice result={mealQuickCheck} />}
        <div className="care-actions">{QUICK.map((action) => <Button key={action.label} alt onClick={() => { if (action.kind === "meal") setMealQuickCheck(checkAllergy("", allergies)); void saveItem(action.kind, action.text, action.mood); }} disabled={busy}>{t(`care.quick.${action.label.toLowerCase().replaceAll(" ", "")}`, action.label)}</Button>)}</div>
      </section>
      <section className="care-card care-section">
        <h2>{t("care.logMeal", "Log a meal")}</h2>
        <label className="care-field"><span>{t("care.ingredientsLabel", "What was served? Add every ingredient you know.")}</span><textarea value={mealText} onChange={(event) => { setMealText(event.target.value); setMealQuickCheck(null); }} placeholder={t("care.ingredientsExample", "For example: rice, chicken, carrot")} /></label>
        {(allergies.length > 0 || mealText.length > 0) && <AllergyCheckNotice result={check} />}
        <Button onClick={() => void saveMeal()} disabled={!mealText.trim() || busy}>{t("care.saveMeal", "Save meal update")}</Button>
      </section>
      <section className="care-card care-section">
        <h2>{t("care.addNote", "Add a note")}</h2>
        <label className="care-field"><span>{t("care.noteLabel", "Note for the family")}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} /></label>
        <Button onClick={() => void saveNote()} disabled={!note.trim() || busy}>{t("care.saveNote", "Save note")}</Button>
      </section>
      <section className="care-card care-section">
        <h2>{t("care.photoSection", "Add a photo")}</h2>
        {demo ? <Button alt onClick={() => void savePhoto("demo/photos/example.jpg")}>{t("care.samplePhoto", "Add sample photo")}</Button> : uid ? <MediaPicker kind="gallery" uid={uid} spaceId={spaceId} buttonLabel={t("care.choosePhoto", "Choose a photo")} onDone={(key) => void savePhoto(key)} /> : <p className="care-muted">{t("care.photoNeedsAccount", "A signed-in team member can add a photo here.")}</p>}
      </section>
      <section className="care-card care-section">
        <h2>{t("care.voiceSection", "Voice note")}</h2>
        <Button alt disabled aria-disabled="true">{t("care.voiceUnavailable", "Voice notes are not available here yet")}</Button>
        <p className="care-muted">{t("care.voiceGuard", "Audio is not saved or shared until secure audio storage is ready. Use a written note or photo instead.")}</p>
      </section>
      <section className="care-section">
        <h2>{t("care.todayStory", "Today’s story")}</h2>
        {items.length ? <ul className="care-list">{items.map((item) => <li key={item.id}><b>{new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</b> · {item.text}{item.photoKey && <p className="care-muted">{t("care.photoStored", "Photo saved with this report.")}</p>}</li>)}</ul> : <CareEmpty title={t("care.noReportItems", "Your day is ready to record")} detail={t("care.noReportItemsHint", "Use one tap, a note, or a photo to start today’s story.")} />}
      </section>
    </div></div>
  </div>;
}
