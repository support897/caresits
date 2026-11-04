import "../../lib/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Empty, t } from "@cc/core";
import { MediaPicker } from "@cc/core/src/media/MediaPicker";
import { getPrivateMediaUrl } from "@cc/core/src/media/upload";
import { addTodayItem, answerTodayAsk, askForTodayUpdate, makeTodayAsk, readToday } from "../../data/today";
import { readCalendar, type CalendarEvent } from "../../data/calendar";
import { loadChildren, type ChildProfile } from "../../data/children";
import type { SpaceMember } from "../../data/spaces";
import { canPost, canSeePhotos } from "../../lib/permissions";
import { groupTimelineByDay, type TimelineItem } from "../../lib/timeline";

const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const nowDay = localDay(new Date());

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

  const grouped = useMemo(() => groupTimelineByDay(items), [items]);
  const nextEvent = useMemo(() => todayEvents
    .filter((event) => new Date(event.start).getTime() >= Date.now())
    .sort((left, right) => left.start.localeCompare(right.start))[0], [todayEvents]);

  async function addQuick(kind: TimelineItem["kind"], defaultText: string) {
    if (!canWrite || busy) return;
    if (!children.length) {
      setNotice(t("cs.today.needChild", "Add a child profile before sharing a day update."));
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const item = await addTodayItem(spaceId, {
        childId,
        day: nowDay,
        kind,
        at: new Date().toISOString(),
        text: draft.trim() || defaultText,
        by: uid,
      });
      setItems((current) => [...current.filter((entry) => entry.id !== item.id), item]);
      setDraft("");
      setNoteOpen(false);
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
      const item = await addTodayItem(spaceId, {
        childId,
        day: nowDay,
        kind: "photo",
        at: new Date().toISOString(),
        text: t("cs.today.photo.note", "A photo from today"),
        photoKey,
        by: uid,
      });
      setItems((current) => [...current.filter((entry) => entry.id !== item.id), item]);
    } catch { setNotice(t("cs.today.save.error", "This update could not be saved. Check your access and try again.")); }
  }

  async function sendAsk(item: TimelineItem) {
    const text = (askDrafts[item.id] ?? "").trim();
    if (!text || !canWrite) return;
    try {
      const next = await askForTodayUpdate(spaceId, item, makeTodayAsk(uid, text));
      setItems((current) => current.map((entry) => entry.id === item.id ? next : entry));
      setAskDrafts((current) => ({ ...current, [item.id]: "" }));
      setAskOpen(null);
    } catch { setNotice(t("cs.today.ask.error", "The update request could not be saved.")); }
  }

  async function sendAnswer(item: TimelineItem, askIndex: number) {
    const key = `${item.id}:${askIndex}`;
    const answerText = (answerDrafts[key] ?? "").trim();
    const answerPhotoKey = answerPhotos[key];
    if ((!answerText && !answerPhotoKey) || !canWrite) return;
    try {
      const next = await answerTodayAsk(spaceId, item, askIndex, {
        answeredAt: new Date().toISOString(),
        ...(answerText ? { answerText } : {}),
        ...(answerPhotoKey ? { answerPhotoKey } : {}),
      });
      setItems((current) => current.map((entry) => entry.id === item.id ? next : entry));
      setAnswerDrafts((current) => ({ ...current, [key]: "" }));
      setAnswerPhotos((current) => ({ ...current, [key]: "" }));
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
              <span className="tag" style={{ background: "var(--soft)", color: "var(--text)" }}>{t(kindKey, kindFallback)}</span>
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
