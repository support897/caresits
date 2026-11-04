import { useMemo, useState } from "react";
import { t } from "@cc/core";
import { canPost } from "../lib/permissions";
import { createShiftEvent, buildShiftCalendarEvent, findShiftWarnings, type CalendarEventWithRecurrence } from "../data/events";
import { localDateKey } from "../data/calendar";
import type { SpaceSummary } from "../data/spaces";

type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
type Props = {
  uid: string;
  spaces: readonly SpaceSummary[];
  events: readonly CalendarEventWithRecurrence[];
  initialSpaceId: string;
  onSaved: (event: CalendarEventWithRecurrence) => void;
  onCancel: () => void;
};

const DAYS: Array<{ value: Weekday; key: string; label: string }> = [
  { value: "Mon", key: "cs.calendar.shift.week.mon", label: "Mon" },
  { value: "Tue", key: "cs.calendar.shift.week.tue", label: "Tue" },
  { value: "Wed", key: "cs.calendar.shift.week.wed", label: "Wed" },
  { value: "Thu", key: "cs.calendar.shift.week.thu", label: "Thu" },
  { value: "Fri", key: "cs.calendar.shift.week.fri", label: "Fri" },
  { value: "Sat", key: "cs.calendar.shift.week.sat", label: "Sat" },
  { value: "Sun", key: "cs.calendar.shift.week.sun", label: "Sun" },
];

function weekdayForDate(value: string): Weekday {
  const date = new Date(`${value}T12:00:00`);
  return DAYS.find((day) => day.value === (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const)[date.getDay()])?.value ?? "Mon";
}

function localDateTime(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((part) => part === undefined || !Number.isInteger(part))) throw new Error("invalid-time");
  const result = new Date(year!, month! - 1, day!, hour!, minute!);
  if (result.getFullYear() !== year || result.getMonth() !== month! - 1 || result.getDate() !== day
    || result.getHours() !== hour || result.getMinutes() !== minute) throw new Error("invalid-time");
  return result.toISOString();
}

export default function CalendarShiftForm({ uid, spaces, events, initialSpaceId, onSaved, onCancel }: Props) {
  const today = localDateKey(new Date());
  const writableSpaces = useMemo(() => spaces.filter((space) => canPost(space.role)), [spaces]);
  const [spaceId, setSpaceId] = useState(() => writableSpaces.some((space) => space.id === initialSpaceId)
    ? initialSpaceId : writableSpaces[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<Weekday[]>([weekdayForDate(today)]);
  const [weekdaysTouched, setWeekdaysTouched] = useState(false);
  const [until, setUntil] = useState(today);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const preview = useMemo(() => {
    if (!date || !from || !to || (repeat && (!until || weekdays.length === 0))) return null;
    try {
      const start = localDateTime(date, from);
      const end = localDateTime(date, to);
      if (Date.parse(end) <= Date.parse(start)) return null;
      return buildShiftCalendarEvent({
        id: "shift-preview",
        title: title.trim() || t("cs.calendar.shift.defaultTitle", "Shift"),
        start,
        end,
        ownerUid: uid,
        ...(repeat ? { recurring: { weekdays, until } } : {}),
      });
    } catch { return null; }
  }, [date, from, repeat, title, to, uid, until, weekdays]);
  const warnings = useMemo(() => preview ? findShiftWarnings(preview, events) : [], [events, preview]);

  function toggleWeekday(day: Weekday) {
    setWeekdaysTouched(true);
    setWeekdays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !spaceId || !uid || !title.trim()) return;
    if (repeat && !weekdays.length) {
      setNotice(t("cs.calendar.shift.weekday.error", "Choose at least one day for this repeating shift."));
      return;
    }
    if (repeat && until < date) {
      setNotice(t("cs.calendar.shift.until.error", "Choose an end date on or after the first shift."));
      return;
    }
    let start: string;
    let end: string;
    try {
      start = localDateTime(date, from);
      end = localDateTime(date, to);
      if (Date.parse(end) <= Date.parse(start)) throw new Error("invalid-time");
    } catch {
      setNotice(t("cs.calendar.shift.time.error", "Choose a valid date and an end time after the start time."));
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const saved = await createShiftEvent(spaceId, {
        title: title.trim(), start, end, ownerUid: uid,
        ...(repeat ? { recurring: { weekdays, until } } : {}),
      });
      const selectedSpace = writableSpaces.find((space) => space.id === spaceId);
      onSaved({ ...saved, spaceName: selectedSpace?.name });
    } catch {
      setNotice(t("cs.calendar.shift.save.error", "This shift could not be saved. Check your access and try again."));
    } finally { setBusy(false); }
  }

  return <section className="card" style={{ marginBottom: 14 }}>
    <h2 style={{ fontSize: 24, margin: "0 0 12px" }}>{t("cs.calendar.shift.new.title", "Add a shift")}</h2>
    <form onSubmit={(event) => void submit(event)} style={{ display: "grid", gap: 12 }}>
      <label>
        <span style={{ display: "block", marginBottom: 6 }}>{t("cs.calendar.chooseFamily", "Choose a family")}</span>
        <select className="field" value={spaceId} onChange={(event) => setSpaceId(event.target.value)} required aria-label={t("cs.calendar.chooseFamily", "Choose a family")}>
          {writableSpaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
        </select>
      </label>
      <label>
        <span style={{ display: "block", marginBottom: 6 }}>{t("cs.calendar.shift.name", "Shift name")}</span>
        <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required />
      </label>
      <label>
        <span style={{ display: "block", marginBottom: 6 }}>{t("cs.calendar.shift.date", "First shift date")}</span>
        <input className="field" type="date" value={date} onChange={(event) => {
          const next = event.target.value;
          setDate(next);
          setUntil((current) => current < next ? next : current);
          if (!weekdaysTouched && next) setWeekdays([weekdayForDate(next)]);
        }} required />
      </label>
      <div className="row" style={{ gap: 10 }}>
        <label style={{ flex: 1 }}><span style={{ display: "block", marginBottom: 6 }}>{t("cs.calendar.shift.from", "From")}</span><input className="field" type="time" value={from} onChange={(event) => setFrom(event.target.value)} required /></label>
        <label style={{ flex: 1 }}><span style={{ display: "block", marginBottom: 6 }}>{t("cs.calendar.shift.to", "To")}</span><input className="field" type="time" value={to} onChange={(event) => setTo(event.target.value)} required /></label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
        <input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} style={{ width: 22, height: 22 }} />
        <span>{t("cs.calendar.shift.repeat", "Repeat every week")}</span>
      </label>
      {repeat && <>
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend style={{ marginBottom: 8 }}>{t("cs.calendar.shift.weekdays", "Repeat on")}</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
            {DAYS.map((day) => <button key={day.value} type="button" className={`chip${weekdays.includes(day.value) ? " on" : ""}`}
              aria-pressed={weekdays.includes(day.value)} aria-label={t(day.key, day.label)} onClick={() => toggleWeekday(day.value)}
              style={{ minWidth: 0, minHeight: 44, justifyContent: "center", paddingInline: 2 }}>{t(day.key, day.label)}</button>)}
          </div>
          <p className="muted" style={{ margin: "8px 0 0" }}>{t("cs.calendar.shift.first.repeat", "Repeats start on the first selected day on or after the first date.")}</p>
        </fieldset>
        <label>
          <span style={{ display: "block", marginBottom: 6 }}>{t("cs.calendar.shift.until", "Repeat until")}</span>
          <input className="field" type="date" min={date} value={until} onChange={(event) => setUntil(event.target.value)} required />
        </label>
      </>}
      {warnings.length > 0 && <div className="card" role="status" aria-live="polite" style={{ padding: 12, background: "var(--soft)", boxShadow: "none" }}>
        <strong>{t("cs.calendar.shift.conflict.title", "This shift overlaps scheduled care")}</strong>
        <ul style={{ margin: "8px 0 0", paddingInlineStart: 22 }}>
          {warnings.map((warning, index) => <li key={`${warning.id ?? "overlap"}-${warning.start}-${index}`}>
            {warning.eventTitle ?? t("cs.calendar.shift.conflict.event", "Another calendar event")} · {new Date(warning.start).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </li>)}
        </ul>
        <p style={{ margin: "8px 0 0" }}>{t("cs.calendar.shift.conflict.note", "You can still save this shift. Check the overlap with your team first.")}</p>
      </div>}
      {notice && <p role="alert" style={{ margin: 0 }}>{notice}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="chip" onClick={onCancel} style={{ minHeight: 44 }}>{t("cs.calendar.shift.cancel", "Cancel")}</button>
        <button type="submit" className="btn" disabled={busy || !spaceId} style={{ flex: 1, minHeight: 44 }}>{busy ? t("cs.calendar.shift.saving", "Saving…") : t("cs.calendar.shift.save", "Save shift")}</button>
      </div>
    </form>
  </section>;
}
