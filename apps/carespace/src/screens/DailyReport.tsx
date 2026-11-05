import { useEffect, useMemo, useRef, useState } from "react";
import { BackBar, Button, t, useNav, type ScreenProps } from "@cc/core";
import { MediaPicker } from "@cc/core/src/media/MediaPicker";
import { addDayStoryItem, DEMO_CHILDREN, loadChildren, loadDayStory, type CarePerms, type CareRole, type DayStoryItem, type DayStoryKind } from "../data/children";
import { canReadAllergies, DEMO_MEDICAL, loadMedicalRecord } from "../data/medical";
import { checkAllergy } from "../lib/allergy";
import { appendVoiceTranscript } from "../lib/timeline";
import { canPost, canSeePhotos } from "../lib/permissions";
import { AllergyCheckNotice, AllergyBanner, CareEmpty, DemoNotice } from "./care/common";
import "./care/care.css";

type Params = { spaceId?: string; childId?: string; childName?: string; uid?: string; role?: CareRole; perms?: CarePerms; demo?: boolean };
const demoMode = (explicit?: boolean) => explicit === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");
const todayKey = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); };
type VoiceRecognitionResult = { 0?: { transcript?: string } };
type VoiceRecognitionEvent = { results: ArrayLike<VoiceRecognitionResult> };
type VoiceRecognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type VoiceRecognitionWindow = Window & {
  SpeechRecognition?: new () => VoiceRecognition;
  webkitSpeechRecognition?: new () => VoiceRecognition;
};

const QUICK: { label: string; kind: DayStoryKind; text: string; mood?: string }[] = [
  { label: "Log a meal", kind: "meal", text: "" },
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
  const allergyAccess = demo || canReadAllergies({ role, perms });
  const canWrite = canPost(role);
  const canAddPhoto = canSeePhotos(role, perms);
  const [allergies, setAllergies] = useState<string[] | null>(null);
  const [items, setItems] = useState<DayStoryItem[]>([]);
  const [mealText, setMealText] = useState("");
  const [mealConfirmed, setMealConfirmed] = useState(false);
  const [mealQuickCheck, setMealQuickCheck] = useState<ReturnType<typeof checkAllergy> | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const mealInputRef = useRef<HTMLTextAreaElement>(null);
  const day = useMemo(todayKey, []);
  const check = useMemo(() => checkAllergy(mealText, allergies ?? []), [mealText, allergies]);

  async function refresh() {
    if (!spaceId || !childId || demo) return;
    const story = await loadDayStory(spaceId, childId, day);
    setItems(story);
  }

  useEffect(() => {
    let live = true;
    if (!spaceId || !childId) return;
    const allergyRequest = demo
      ? Promise.resolve(DEMO_MEDICAL[childId]?.allergies?.map((item) => item.name) ?? [])
      : !allergyAccess ? Promise.resolve(null)
        : (async () => {
            const children = await loadChildren(spaceId);
            const medical = await loadMedicalRecord(spaceId, childId, { role, perms });
            return children.some((item) => item.id === childId) ? medical?.allergies?.map((item) => item.name) ?? null : null;
          })();
    allergyRequest.then((value) => { if (live) setAllergies(value); }).catch(() => {
      if (live) { setAllergies(null); setError(t("care.reportAllergyError", "Allergy details could not be read. Ask a parent before logging food.")); }
    });
    if (demo) {
      setItems([{ id: "demo-story-1", childId, day, kind: "activity", at: new Date().toISOString(), text: "Read a picture book together." }]);
    } else {
      refresh().catch(() => { if (live) setError(t("care.reportLoadError", "Could not load today’s report.")); });
    }
    return () => { live = false; };
  }, [spaceId, childId, day, demo, role, perms]);

  async function saveItem(kind: DayStoryKind, text: string, mood?: string, photoKey?: string): Promise<boolean> {
    if (!canWrite) { setError(t("care.reportReadOnly", "You do not have permission to add updates to this family’s report.")); return false; }
    if (!spaceId || !childId || !text.trim()) return false;
    setBusy(true); setError("");
    const local: DayStoryItem = { id: `local-${Date.now()}`, childId, day, kind, at: new Date().toISOString(), text: text.trim(), ...(mood ? { mood } : {}), ...(photoKey ? { photoKey } : {}), ...(uid ? { by: uid } : {}) };
    try {
      if (!demo) {
        const id = await addDayStoryItem(spaceId, { childId, day, kind, text: text.trim(), ...(mood ? { mood } : {}), ...(photoKey ? { photoKey } : {}), ...(uid ? { by: uid } : {}) });
        local.id = id;
      }
      setItems((current) => [local, ...current]);
      return true;
    } catch {
      setError(t("care.reportSaveError", "Could not save this report item. Try again."));
      return false;
    } finally { setBusy(false); }
  }

  async function saveMeal() {
    const entered = mealText.trim();
    if (!entered) return;
    if (allergies === null) {
      setError(t("care.reportAllergyError", "Allergy details could not be confirmed. Ask a parent before logging food."));
      return;
    }
    if (!mealConfirmed) {
      setError(t("care.mealConfirmRequired", "Check ingredients and parent's notes first."));
      return;
    }
    if (await saveItem("meal", entered)) {
      setMealText(""); setMealConfirmed(false); setMealQuickCheck(null);
    }
  }

  async function saveNote() {
    const entered = note.trim();
    if (!entered) return;
    if (await saveItem("note", entered)) setNote("");
  }

  async function savePhoto(key: string) {
    await saveItem("photo", t("care.photoAdded", "Photo added to today’s report."), undefined, key);
  }

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  function toggleVoiceTyping() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const speechWindow = window as VoiceRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice(t("care.voiceUnsupported", "Voice typing isn't available here. Type your note."));
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-AU";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").filter(Boolean).join(" ");
      setNote((current) => appendVoiceTranscript(current, transcript));
    };
    recognition.onerror = (event) => {
      setListening(false); recognitionRef.current = null;
      setNotice(event.error === "not-allowed"
        ? t("care.voiceDenied", "Microphone access was not allowed. You can still type your note.")
        : t("care.voiceError", "Voice typing stopped. Try again or type your note."));
    };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    setNotice(""); setError(""); setListening(true);
    try { recognition.start(); }
    catch {
      recognitionRef.current = null; setListening(false);
      setNotice(t("care.voiceError", "Voice typing stopped. Try again or type your note."));
    }
  }

  function quickUpdate(action: (typeof QUICK)[number]) {
    if (action.kind === "meal") {
      if (allergies === null) {
        setError(t("care.reportAllergyError", "Allergy details could not be confirmed. Ask a parent before logging food."));
        return;
      }
      setMealQuickCheck(checkAllergy("", allergies));
      setNotice(t("care.addMealIngredients", "Add every ingredient you know, check the labels, then save the meal."));
      mealInputRef.current?.focus();
      return;
    }
    const key = action.label.toLowerCase().replaceAll(" ", "");
    const text = t(`care.quickLog.${key}`, action.text);
    void saveItem(action.kind, text, action.mood ? t(`care.mood.${action.mood}`, action.mood) : undefined);
  }

  const title = params.childName ?? DEMO_CHILDREN.find((child) => child.id === childId)?.name ?? t("care.childTitle", "Child");
  return <div className="app">
    <BackBar title={t("care.dailyReportTitle", "Daily report")} onBack={nav.back} />
    <div className="scroll"><div className="care-wrap">
      {demo && <DemoNotice />}
      {!canWrite && <div className="care-alert" role="alert">{t("care.reportReadOnly", "You do not have permission to add updates to this family’s report.")}</div>}
      <div className="care-head"><div><h1>{title}</h1><p>{t("care.reportDate", "Today · {day}", { day })}</p></div></div>
      {allergies?.length ? <AllergyBanner names={allergies} /> : null}
      {!allergyAccess && <div className="care-alert" role="alert"><strong>{t("care.allergyInfoMissing", "Allergy details are not available to you.")}</strong><p>{t("care.allergyInfoMissingHint", "Not checked for this child. Ask a parent first.")}</p></div>}
      {allergyAccess && allergies === null && <div className="care-alert" role="alert"><strong>{t("care.allergyInfoLoading", "Allergy details could not be confirmed.")}</strong><p>{t("care.reportAllergyError", "Ask a parent before logging food.")}</p></div>}
      {error && <div className="care-info care-warning" role="alert">{error}</div>}
      {notice && <div className="care-status" role="status">{notice}</div>}
      <section className="care-card">
        <h2>{t("care.quickReport", "One-tap updates")}</h2>
        <p className="care-muted">{t("care.quickReportHint", "Tap once to add an update to today’s story.")}</p>
        {mealQuickCheck && <AllergyCheckNotice result={mealQuickCheck} />}
        <div className="care-actions">{QUICK.map((action) => <Button key={action.label} alt onClick={() => quickUpdate(action)} disabled={busy || !canWrite}>{t(`care.quick.${action.label.toLowerCase().replaceAll(" ", "")}`, action.label)}</Button>)}</div>
      </section>
      <section className="care-card care-section">
        <h2>{t("care.logMeal", "Log a meal")}</h2>
        <label className="care-field"><span>{t("care.ingredientsLabel", "What was served? Add every ingredient you know.")}</span><textarea ref={mealInputRef} value={mealText} disabled={!canWrite} onChange={(event) => { setMealText(event.target.value); setMealConfirmed(false); setMealQuickCheck(null); }} placeholder={t("care.ingredientsExample", "For example: rice, chicken, carrot")} /></label>
        {allergyAccess && allergies !== null && (allergies.length > 0 || mealText.length > 0) && <AllergyCheckNotice result={check} />}
        <label className="care-check"><input type="checkbox" checked={mealConfirmed} disabled={!canWrite || allergies === null} onChange={(event) => setMealConfirmed(event.currentTarget.checked)} /><span>{t("care.mealConfirm", "I checked the full labels and the parent’s instructions.")}</span></label>
        <Button onClick={() => void saveMeal()} disabled={!canWrite || allergies === null || !mealText.trim() || !mealConfirmed || busy}>{t("care.saveMeal", "Save meal update")}</Button>
      </section>
      <section className="care-card care-section">
        <h2>{t("care.addNote", "Add a note")}</h2>
        <label className="care-field"><span>{t("care.noteLabel", "Note for the family")}</span><textarea value={note} disabled={!canWrite} onChange={(event) => setNote(event.target.value)} maxLength={1000} /></label>
        <p className="care-muted">{t("care.voicePrivacy", "Voice typing may use your browser's speech service. Check the words.")}</p>
        <Button alt onClick={toggleVoiceTyping} aria-pressed={listening} disabled={busy || !canWrite}>{listening ? t("care.voiceStop", "Stop voice typing") : t("care.voiceStart", "Use voice typing")}</Button>
        <Button onClick={() => void saveNote()} disabled={!canWrite || !note.trim() || busy}>{t("care.saveNote", "Save note")}</Button>
      </section>
      <section className="care-card care-section">
        <h2>{t("care.photoSection", "Add a photo")}</h2>
        {!canWrite ? <p className="care-muted">{t("care.reportReadOnly", "You do not have permission to add updates to this family’s report.")}</p> : !canAddPhoto ? <p className="care-muted">{t("care.photoNoAccess", "Only a parent or a member with photo access can add a photo.")}</p> : demo ? <Button alt onClick={() => void savePhoto("demo/photos/example.jpg")}>{t("care.samplePhoto", "Add sample photo")}</Button> : uid ? <MediaPicker kind="gallery" uid={uid} spaceId={spaceId} buttonLabel={t("care.choosePhoto", "Choose a photo")} onDone={(key) => void savePhoto(key)} /> : <p className="care-muted">{t("care.photoNeedsAccount", "A signed-in team member can add a photo here.")}</p>}
      </section>
      <section className="care-section">
        <h2>{t("care.todayStory", "Today’s story")}</h2>
        {items.length ? <ul className="care-list">{items.map((item) => <li key={item.id}><b>{new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</b> · {item.text}{item.photoKey && <p className="care-muted">{t("care.photoStored", "Photo saved with this report.")}</p>}</li>)}</ul> : <CareEmpty title={t("care.noReportItems", "Your day is ready to record")} detail={t("care.noReportItemsHint", "Use one tap, a note, or a photo to start today’s story.")} />}
      </section>
    </div></div>
  </div>;
}
