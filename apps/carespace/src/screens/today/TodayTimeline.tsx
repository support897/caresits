import "../../lib/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Empty, t } from "@cc/core";
import { MediaPicker } from "@cc/core/src/media/MediaPicker";
import { getPrivateMediaUrl } from "@cc/core/src/media/upload";
import { addTodayItem, answerTodayAsk, askForTodayUpdate, makeTodayAsk, readSpacePhotos, readToday } from "../../data/today";
import { readCalendar, type CalendarEvent } from "../../data/calendar";
import { loadChildren, type ChildProfile } from "../../data/children";
import type { SpaceMember } from "../../data/spaces";
import { canPost, canSeePhotos } from "../../lib/permissions";
import { appendVoiceTranscript, groupTimelineByDay, timelineItemsForChild, type TimelineItem } from "../../lib/timeline";

const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const nowDay = localDay(new Date());
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

const KIND_LABELS: Record<TimelineItem["kind"], [string, string]> = {
  arrival: ["cs.today.kind.arrival", "Arrival"],
  meal: ["cs.today.kind.meal", "Meal"],
  drink: ["cs.today.kind.drink", "Drink"],
  nap: ["cs.today.kind.nap", "Nap"],
  activity: ["cs.today.kind.activity", "Activity"],
  mood: ["cs.today.kind.mood", "Mood"],
  photo: ["cs.today.kind.photo", "Photo"],
  pickup: ["cs.today.kind.pickup", "Pickup"],
  note: ["cs.today.kind.note", "Note"],
};

const QUICK_ACTIONS: Array<{ kind: TimelineItem["kind"]; key: string; label: string; fallbackKey: string; fallback: string }> = [
  { kind: "arrival", key: "cs.today.quick.arrival", label: "Arrival", fallbackKey: "cs.today.quick.default.arrival", fallback: "Arrived" },
  { kind: "meal", key: "cs.today.quick.meal", label: "Meal", fallbackKey: "cs.today.quick.default.meal", fallback: "Meal recorded" },
  { kind: "drink", key: "cs.today.quick.drink", label: "Drink", fallbackKey: "cs.today.quick.default.drink", fallback: "Drink recorded" },
  { kind: "nap", key: "cs.today.quick.nap", label: "Nap", fallbackKey: "cs.today.quick.default.nap", fallback: "Nap recorded" },
  { kind: "activity", key: "cs.today.quick.activity", label: "Activity", fallbackKey: "cs.today.quick.default.activity", fallback: "Activity started" },
  { kind: "mood", key: "cs.today.quick.mood", label: "Mood", fallbackKey: "cs.today.quick.default.mood", fallback: "Mood noted" },
  { kind: "pickup", key: "cs.today.quick.pickup", label: "Pickup", fallbackKey: "cs.today.quick.default.pickup", fallback: "Ready for pickup" },
];

function timeLabel(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function PhotoPreview({ photoKey }: { photoKey: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    void getPrivateMediaUrl(photoKey).then((value) => { if (alive && value) setUrl(value); });
    return () => { alive = false; };
  }, [photoKey]);
  return url
    ? <img src={url} alt={t("cs.today.photo.alt", "Shared care update")} loading="lazy" style={{ display: "block", width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 16, marginTop: 10 }} />
    : <p className="muted" style={{ margin: "8px 0 0" }}>{t("cs.today.photo.saved", "Photo saved to this care update")}</p>;
}

export type PhotoGalleryProps = {
  spaceId: string;
  member: SpaceMember;
  childProfiles?: Array<Pick<ChildProfile, "id" | "name">>;
};

export function PhotoGallery({ spaceId, member, childProfiles = [] }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" || navigator.onLine);
  const [notice, setNotice] = useState("");
  const mayRead = canSeePhotos(member.role, member.perms);
  const refresh = useCallback(async () => {
    if (!mayRead) { setPhotos([]); setLoading(false); return; }
    try {
      const result = await readSpacePhotos(spaceId);
      setPhotos(result.items);
      setFromCache(result.fromCache);
      setOnline((typeof navigator === "undefined" || navigator.onLine) && !result.fromCache);
      setNotice("");
    } catch {
      setNotice(t("cs.photos.load.error", "Photos could not load. Check your access and connection."));
    } finally { setLoading(false); }
  }, [mayRead, spaceId]);

  useEffect(() => {
    void refresh();
    const onlineHandler = () => { setOnline(true); setLoading(true); void refresh(); };
    const offlineHandler = () => { setOnline(false); setLoading(true); void refresh(); };
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, [refresh]);

  if (!mayRead) return <div className="scroll"><Empty mood="rest" title={t("cs.photos.private.title", "Photos are private for this role")} body={t("cs.photos.private.body", "A family admin can change photo access.")} /></div>;
  return <div className="scroll" style={{ paddingTop: 12 }}>
    <h1 style={{ fontSize: 28, marginBottom: 12 }}>{t("cs.photos.title", "Shared photos")}</h1>
    {!online && fromCache && <p role="status" className="card" style={{ margin: "0 0 12px", padding: 12, background: "var(--soft)" }}>{t("cs.offline.banner", "You're offline - showing saved copy")}</p>}
    {!online && !fromCache && <p role="status" className="card" style={{ margin: "0 0 12px", padding: 12, background: "var(--soft)" }}>{t("cs.offline.empty", "You're offline. No saved copy is on this device yet.")}</p>}
    {notice && <p role="status" className="muted">{notice}</p>}
    {loading ? <div className="sk" style={{ height: 150 }} /> : photos.length ? <div style={{ display: "grid", gap: 12 }} aria-label={t("cs.photos.gallery", "Photos shared with this care space")}>
      {photos.map((photo) => <article key={photo.id} className="card" style={{ minWidth: 0 }}>
        {photo.photoKey && <PhotoPreview photoKey={photo.photoKey} />}
        <p style={{ margin: "8px 0 0", overflowWrap: "anywhere" }}>{photo.text}</p>
        {photo.childId && childProfiles.find((child) => child.id === photo.childId)?.name && <p className="muted" style={{ margin: "4px 0 0" }}>{t("cs.photos.child", "For {name}", { name: childProfiles.find((child) => child.id === photo.childId)!.name })}</p>}
        <time className="muted" dateTime={String(photo.at)}>{new Date(photo.at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</time>
      </article>)}
    </div> : <Empty mood="hello" title={t("cs.photos.empty.title", "Shared moments will show here")} body={t("cs.photos.empty.body", "Photos shared with this care space stay together.")} />}
  </div>;
}

export type TodayPreviewData = {
  items: TimelineItem[];
  children: Array<Pick<ChildProfile, "id" | "name" | "ageYears">>;
  events: CalendarEvent[];
};
export type TodayTimelineProps = { spaceId: string; uid: string; member: SpaceMember; previewData?: TodayPreviewData };

export function TodayTimeline({ spaceId, uid, member, previewData }: TodayTimelineProps) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [children, setChildren] = useState<Array<Pick<ChildProfile, "id" | "name" | "ageYears">>>([]);
  const [childId, setChildId] = useState("");
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" || navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [askOpen, setAskOpen] = useState<string | null>(null);
  const [askDrafts, setAskDrafts] = useState<Record<string, string>>({});
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [answerPhotos, setAnswerPhotos] = useState<Record<string, string>>({});
  const [noteOpen, setNoteOpen] = useState(false);
  const role = member.role;
  const showPhotos = canSeePhotos(role, member.perms);
  const canWrite = canPost(role);

  function showWriteResult(queued: boolean) {
    setFromCache((current) => current || queued);
    setNotice(queued ? t("cs.offline.queued", "Saved here. It will sync when you're back online.") : "");
  }

  const refresh = useCallback(async () => {
    if (previewData) {
      setItems(previewData.items);
      setTodayEvents(previewData.events);
      setChildren(previewData.children);
      setChildId((current) => current || previewData.children[0]?.id || "");
      setFromCache(false);
      setOnline(true);
      return;
    }
    try {
      const [todayResult, calendarResult, childResult] = await Promise.all([
        readToday(spaceId, nowDay),
        member.role === "admin" || member.perms?.calendar !== false ? readCalendar(spaceId) : Promise.resolve({ events: [], fromCache: false }),
        loadChildren(spaceId).catch(() => []),
      ]);
      setItems(todayResult.items);
      setTodayEvents(calendarResult.events.filter((event) => localDay(new Date(event.start)) === nowDay));
      setChildren(childResult);
      setChildId((current) => current || childResult[0]?.id || "");
      setFromCache(todayResult.fromCache || calendarResult.fromCache);
      setOnline((typeof navigator === "undefined" || navigator.onLine) && !todayResult.fromCache && !calendarResult.fromCache);
      setNotice("");
    } catch {
      setItems([]);
      setTodayEvents([]);
      setFromCache(false);
      setOnline(typeof navigator === "undefined" || navigator.onLine);
      setNotice(t("cs.today.load.error", "Care updates could not load. Check your access and try again."));
    }
  }, [member.perms?.calendar, member.role, previewData, spaceId]);

  useEffect(() => {
    void refresh();
    const onlineHandler = () => { setOnline(true); void refresh(); };
    const offlineHandler = () => { setOnline(false); void refresh(); };
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, [refresh]);

  const childItems = useMemo(() => timelineItemsForChild(items, childId), [childId, items]);
  const childEvents = useMemo(() => todayEvents.filter((event) => !event.childId || event.childId === childId), [childId, todayEvents]);
  const grouped = useMemo(() => groupTimelineByDay(childItems), [childItems]);
  const nextEvent = useMemo(() => childEvents
    .filter((event) => new Date(event.start).getTime() >= Date.now())
    .sort((left, right) => left.start.localeCompare(right.start))[0], [childEvents]);

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const speechWindow = window as VoiceRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice(t("cs.today.voice.unsupported", "Voice typing is not available here. Try your keyboard’s microphone instead."));
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-AU";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").filter(Boolean).join(" ");
      setDraft((current) => appendVoiceTranscript(current, transcript));
    };
    recognition.onerror = (event) => {
      setListening(false);
      recognitionRef.current = null;
      setNotice(event.error === "not-allowed"
        ? t("cs.today.voice.denied", "Microphone access was not allowed. You can still type your update.")
        : t("cs.today.voice.error", "Voice typing stopped. Try again or type your update."));
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setNotice("");
    setListening(true);
    try { recognition.start(); }
    catch {
      recognitionRef.current = null;
      setListening(false);
      setNotice(t("cs.today.voice.error", "Voice typing stopped. Try again or type your update."));
    }
  }

  async function addQuick(kind: TimelineItem["kind"], defaultText: string) {
    if (!canWrite || busy) return;
    if (!children.length) {
      setNotice(t("cs.today.needChild", "Add a child profile before sharing a day update."));
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const result = await addTodayItem(spaceId, {
        childId,
        day: nowDay,
        kind,
        at: new Date().toISOString(),
        text: draft.trim() || defaultText,
        by: uid,
      });
      setItems((current) => [...current.filter((entry) => entry.id !== result.item.id), result.item]);
      setDraft("");
      setNoteOpen(false);
      showWriteResult(result.queued);
    } catch {
      setNotice(t("cs.today.save.error", "This update could not be saved. Check your access and try again."));
    } finally { setBusy(false); }
  }

  async function addPhoto(photoKey: string) {
    if (!children.length) {
      setNotice(t("cs.today.needChild", "Add a child profile before sharing a day update."));
      return;
    }
    try {
      const result = await addTodayItem(spaceId, {
        childId,
        day: nowDay,
        kind: "photo",
        at: new Date().toISOString(),
        text: t("cs.today.photo.note", "A photo from today"),
        photoKey,
        by: uid,
      });
      setItems((current) => [...current.filter((entry) => entry.id !== result.item.id), result.item]);
      showWriteResult(result.queued);
    } catch { setNotice(t("cs.today.save.error", "This update could not be saved. Check your access and try again.")); }
  }

  async function sendAsk(item: TimelineItem) {
    const text = (askDrafts[item.id] ?? "").trim();
    if (!text || !canWrite) return;
    try {
      const result = await askForTodayUpdate(spaceId, item, makeTodayAsk(uid, text));
      setItems((current) => current.map((entry) => entry.id === item.id ? result.item : entry));
      setAskDrafts((current) => ({ ...current, [item.id]: "" }));
      setAskOpen(null);
      showWriteResult(result.queued);
    } catch { setNotice(t("cs.today.ask.error", "The update request could not be saved.")); }
  }

  async function sendAnswer(item: TimelineItem, askIndex: number) {
    const key = `${item.id}:${askIndex}`;
    const answerText = (answerDrafts[key] ?? "").trim();
    const answerPhotoKey = answerPhotos[key];
    if ((!answerText && !answerPhotoKey) || !canWrite) return;
    try {
      const result = await answerTodayAsk(spaceId, item, askIndex, {
        answeredAt: new Date().toISOString(),
        ...(answerText ? { answerText } : {}),
        ...(answerPhotoKey ? { answerPhotoKey } : {}),
      });
      setItems((current) => current.map((entry) => entry.id === item.id ? result.item : entry));
      setAnswerDrafts((current) => ({ ...current, [key]: "" }));
      setAnswerPhotos((current) => ({ ...current, [key]: "" }));
      showWriteResult(result.queued);
    } catch { setNotice(t("cs.today.answer.error", "The update could not be sent.")); }
  }

  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return <div className="scroll" style={{ paddingTop: 12 }}>
    {!online && fromCache && <p role="status" className="card" style={{ margin: "0 0 12px", padding: 12, background: "var(--soft)" }}>{t("cs.offline.banner", "You're offline - showing saved copy")}</p>}
    {!online && !fromCache && <p role="status" className="card" style={{ margin: "0 0 12px", padding: 12, background: "var(--soft)" }}>{t("cs.offline.empty", "You're offline. No saved copy is on this device yet.")}</p>}

    <header style={{ marginBottom: 16 }}>
      <p className="muted" style={{ margin: "0 0 4px" }}>{t("cs.today.eyebrow", "Today")}</p>
      <h1 style={{ fontSize: 30 }}>{todayLabel}</h1>
      {children.length > 1 && <label style={{ display: "block", marginTop: 12 }}>
        <span className="muted" style={{ display: "block", marginBottom: 6 }}>{t("cs.today.child", "Child")}</span>
        <select className="field" value={childId} onChange={(event) => setChildId(event.target.value)} aria-label={t("cs.today.child", "Child")}>
          {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
        </select>
      </label>}
    </header>

    {notice && <p role="status" style={{ margin: "0 0 12px", color: "var(--muted)" }}>{notice}</p>}

    {nextEvent && <section className="card" aria-label={t("cs.today.next", "Next up")} style={{ marginBottom: 14, borderInlineStart: "5px solid var(--sage)" }}>
      <p className="muted" style={{ margin: "0 0 4px" }}>{t("cs.today.next", "Next up")}</p>
      <strong>{nextEvent.title}</strong>
      <p style={{ margin: "4px 0 0" }}>{timeLabel(nextEvent.start)}</p>
    </section>}

    {canWrite && <section className="card" aria-label={t("cs.today.addUpdate", "Add a care update")} style={{ marginBottom: 16 }}>
      <label htmlFor="today-detail" style={{ display: "block", marginBottom: 8 }}>{t("cs.today.addUpdate", "Add a care update")}</label>
      <input id="today-detail" className="field" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("cs.today.detail.placeholder", "What happened? Meal, drink, nap, or activity")}
        aria-label={t("cs.today.detail.placeholder", "What happened? Meal, drink, nap, or activity")} />
      <div className="row" style={{ marginTop: 10, gap: 8 }}>
        {QUICK_ACTIONS.map((action) => <button key={action.kind} type="button" className="chip" disabled={busy || !children.length} onClick={() => void addQuick(action.kind, t(action.fallbackKey, action.fallback))}>{t(action.key, action.label)}</button>)}
        <button type="button" className="chip" aria-pressed={listening} onClick={toggleDictation}>{listening ? t("cs.today.voice.stop", "Stop dictation") : t("cs.today.voice.start", "Dictate an update")}</button>
        <button type="button" className="chip" disabled={busy || !children.length} onClick={() => setNoteOpen((value) => !value)}>{t("cs.today.quick.note", "Note")}</button>
      </div>
      {noteOpen && <div style={{ marginTop: 10 }}>
        <button type="button" className="btn sm" disabled={busy || !draft.trim()} onClick={() => void addQuick("note", t("cs.today.note.default", "A note from today"))}>{t("cs.today.saveNote", "Save note")}</button>
      </div>}
      {showPhotos && <div style={{ marginTop: 8 }}>
        <MediaPicker kind="gallery" uid={uid} spaceId={spaceId} buttonLabel={t("cs.today.addPhoto", "Add a photo")} onDone={(key) => void addPhoto(key)} />
      </div>}
    </section>}

    {grouped.length ? grouped.map((group) => <section key={group.day} aria-label={group.day} style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 22, margin: "0 0 10px" }}>{new Date(`${group.day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" })}</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {group.items.map((item) => {
          const [kindKey, kindFallback] = KIND_LABELS[item.kind];
          return <article key={item.id} className="card" style={{ padding: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="tag" style={{ background: "var(--soft)", color: "var(--text)", fontSize: 17 }}>{t(kindKey, kindFallback)}</span>
              <time className="muted">{timeLabel(item.at)}</time>
            </div>
            <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{item.text}</p>
            {showPhotos && item.photoKey && <PhotoPreview photoKey={item.photoKey} />}
            {item.mood && <p style={{ margin: "8px 0 0" }}>{t("cs.today.mood", "Mood")}: {item.mood}</p>}

            {!!item.asks?.length && <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {item.asks.map((ask, index) => {
                const answerKey = `${item.id}:${index}`;
                const pendingForCarer = (role === "regular" || role === "limited") && !ask.answeredAt;
                return <div key={`${ask.by}-${ask.at}-${index}`} className="card" style={{ padding: 12, background: "var(--soft)", boxShadow: "none" }}>
                  <strong>{t("cs.today.updateRequest", "Update request")}</strong>
                  <p style={{ margin: "4px 0 0" }}>{ask.text}</p>
                  {ask.answeredAt && <div style={{ marginTop: 8 }}>
                    {ask.answerText && <p style={{ margin: 0 }}>{ask.answerText}</p>}
                    {showPhotos && ask.answerPhotoKey && <PhotoPreview photoKey={ask.answerPhotoKey} />}
                    <p className="muted" style={{ margin: "6px 0 0" }}>{t("cs.today.answered", "Update sent")}</p>
                  </div>}
                  {pendingForCarer && <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    <textarea className="field" value={answerDrafts[answerKey] ?? ""} onChange={(event) => setAnswerDrafts((current) => ({ ...current, [answerKey]: event.target.value }))}
                      placeholder={t("cs.today.answer.placeholder", "Write an update")} aria-label={t("cs.today.answer.placeholder", "Write an update")} />
                    {showPhotos && <MediaPicker kind="gallery" uid={uid} spaceId={spaceId} buttonLabel={t("cs.today.answer.photo", "Add a photo to this update")} onDone={(key) => setAnswerPhotos((current) => ({ ...current, [answerKey]: key }))} />}
                    <button type="button" className="btn sm" disabled={!canWrite || (!(answerDrafts[answerKey] ?? "").trim() && !answerPhotos[answerKey])}
                      onClick={() => void sendAnswer(item, index)}>{t("cs.today.sendUpdate", "Send update")}</button>
                  </div>}
                </div>;
              })}
            </div>}

            {role === "admin" && <div style={{ marginTop: 10 }}>
              {askOpen === item.id ? <div style={{ display: "grid", gap: 8 }}>
                <textarea className="field" value={askDrafts[item.id] ?? ""} onChange={(event) => setAskDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                  placeholder={t("cs.today.ask.placeholder", "What would you like to know?")} aria-label={t("cs.today.ask.placeholder", "What would you like to know?")} />
                <div className="row">
                  <button type="button" className="btn sm" disabled={!(askDrafts[item.id] ?? "").trim()} onClick={() => void sendAsk(item)}>{t("cs.today.sendAsk", "Send request")}</button>
                  <button type="button" className="chip" onClick={() => setAskOpen(null)}>{t("cs.action.close", "Close")}</button>
                </div>
              </div> : <button type="button" className="chip" onClick={() => setAskOpen(item.id)}>{t("cs.today.ask", "Ask for an update")}</button>}
            </div>}
          </article>;
        })}
      </div>
    </section>) : <Empty mood="hello" title={t("cs.today.empty.title", "A fresh day starts here")} body={t("cs.today.empty.body", "Care updates will stay together in this timeline.")} />}
  </div>;
}
