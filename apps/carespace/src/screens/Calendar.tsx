import "../lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { BackBar, Chip, Empty, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { calendarDaysForPeriod, decideTimeOffRequest, readCalendarForSpaces, shiftCalendarMonth, type CalendarEvent, type CalendarPeriod } from "../data/calendar";
import { listUserSpaces, type SpaceSummary } from "../data/spaces";
import type { TimeOffAction } from "../lib/timeoff";

type CalendarParams = { uid: string; spaceId?: string };
type CalendarView = "mine" | "family" | "team";
const WEEKDAYS: Array<[string, string]> = [
  ["cs.calendar.week.sun", "Sun"], ["cs.calendar.week.mon", "Mon"], ["cs.calendar.week.tue", "Tue"],
  ["cs.calendar.week.wed", "Wed"], ["cs.calendar.week.thu", "Thu"], ["cs.calendar.week.fri", "Fri"], ["cs.calendar.week.sat", "Sat"],
];
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const sameDay = (value: string, day: string) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && dayKey(date) === day;
};
const eventTime = (value: string) => new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export default function Screen({ params }: ScreenProps<CalendarParams>) {
  const nav = useNav();
  const { user } = useAuth();
  const uid = params.uid || user?.uid || "";
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [view, setView] = useState<CalendarView>(() => params.spaceId ? "family" : "mine");
  const [period, setPeriod] = useState<CalendarPeriod>("month");
  const [familyId, setFamilyId] = useState(params.spaceId ?? "");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(dayKey(new Date()));
  const [fromCache, setFromCache] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" || navigator.onLine);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let alive = true;
    if (!uid) return;
    const refresh = async () => {
      try {
        const memberships = (await listUserSpaces(uid)).filter((space) => space.role === "admin" || space.perms?.calendar !== false);
        const result = await readCalendarForSpaces(memberships);
        if (!alive) return;
        setSpaces(memberships);
        setEvents(result.events);
        setFamilyId((current) => current || params.spaceId || memberships[0]?.id || "");
        setFromCache(result.fromCache);
        setOnline((typeof navigator === "undefined" || navigator.onLine) && !result.fromCache);
      } catch {
        if (alive) setNotice(t("cs.calendar.load.error", "Calendar could not load. Check your connection and access."));
      }
    };
    void refresh();
    const onlineHandler = () => { setOnline(true); setFromCache(false); void refresh(); };
    const offlineHandler = () => { setOnline(false); setFromCache(true); };
    const changedHandler = () => { void refresh(); };
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    window.addEventListener("carespace:calendar-changed", changedHandler);
    return () => {
      alive = false;
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      window.removeEventListener("carespace:calendar-changed", changedHandler);
    };
  }, [params.spaceId, uid]);

  const filtered = useMemo(() => events.filter((event) => {
    if (view === "mine") return event.ownerUid === uid;
    if (view === "family") return event.spaceId === familyId;
    return true;
  }), [events, familyId, uid, view]);

  const monthEvents = useMemo(() => filtered.filter((event) => {
    const date = new Date(event.start);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  }), [filtered, month]);
  const selectedEvents = useMemo(() => filtered.filter((event) => sameDay(event.start, selectedDay))
    .sort((left, right) => left.start.localeCompare(right.start)), [filtered, selectedDay]);
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array.from({ length: first }, () => null), ...Array.from({ length: count }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))];
  }, [month]);
  const periodDays = useMemo(() => calendarDaysForPeriod(selectedDay, period), [period, selectedDay]);
  const periodEvents = useMemo(() => {
    const days = new Set(periodDays.map((day) => day.key));
    return filtered.filter((event) => days.has(dayKey(new Date(event.start))))
      .sort((left, right) => left.start.localeCompare(right.start));
  }, [filtered, periodDays]);
  const periodLabel = period === "week"
    ? `${periodDays[0]?.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) ?? ""} – ${periodDays.at(-1)?.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) ?? ""}`
    : new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  function moveMonth(direction: -1 | 1) {
    const nextDay = shiftCalendarMonth(selectedDay, direction);
    const nextDate = new Date(`${nextDay}T12:00:00`);
    setSelectedDay(nextDay);
    setMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  }

  function movePeriod(direction: -1 | 1) {
    if (period === "month") {
      moveMonth(direction);
      return;
    }
    const date = new Date(`${selectedDay}T12:00:00`);
    date.setDate(date.getDate() + direction * (period === "week" ? 7 : 1));
    setSelectedDay(dayKey(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  async function decide(event: CalendarEvent, action: TimeOffAction) {
    const space = spaces.find((entry) => entry.id === event.spaceId);
    if (!space || space.role !== "admin" || busyId) return;
    setBusyId(event.id);
    try {
      const updated = await decideTimeOffRequest(space.id, event, action, space.role);
      setEvents((current) => current.map((row) => row.id === updated.id && row.spaceId === space.id ? { ...row, ...updated } : row));
      setNotice(updated.queued
        ? t("cs.offline.queued", "Saved here. It will sync when you're back online.")
        : action === "approve" ? t("cs.calendar.timeoff.approved", "Time-off request approved.") : t("cs.calendar.timeoff.declined", "Time-off request declined."));
    } catch { setNotice(t("cs.calendar.timeoff.error", "The request could not be updated.")); }
    finally { setBusyId(""); }
  }

  function renderEvent(event: CalendarEvent, showDate = false) {
    const space = spaces.find((entry) => entry.id === event.spaceId);
    const pending = event.kind === "timeoff" && event.state === "requested";
    const start = new Date(event.start);
    const end = new Date(event.end);
    const allDay = start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 23 && end.getMinutes() === 59;
    const dateLabel = showDate ? `${start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · ` : "";
    return <article key={`${event.spaceId}-${event.id}`} className="card" style={{ padding: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}><strong>{event.title}</strong><p className="muted" style={{ margin: "4px 0 0" }}>{event.spaceName ?? space?.name ?? ""}</p></div>
        <span className="tag" style={{ background: event.kind === "timeoff" ? "var(--blush)" : "var(--soft)", whiteSpace: "nowrap", fontSize: 17 }}>{t(`cs.calendar.kind.${event.kind}`, event.kind === "timeoff" ? "Time off" : event.kind)}</span>
      </div>
      <p style={{ margin: "8px 0 0" }}>{dateLabel}{allDay ? t("cs.calendar.allDay", "All day") : `${eventTime(event.start)} – ${eventTime(event.end)}`} · {t(`cs.calendar.state.${event.state}`, event.state)}{event.queued ? ` · ${t("cs.offline.waiting", "Waiting to sync")}` : ""}</p>
      {pending && space?.role === "admin" && <div className="row" style={{ marginTop: 10, gap: 8 }}>
        <button type="button" className="chip" disabled={busyId === event.id} onClick={() => void decide(event, "approve")}>{t("cs.calendar.approve", "Approve")}</button>
        <button type="button" className="chip" disabled={busyId === event.id} onClick={() => void decide(event, "decline")}>{t("cs.calendar.decline", "Decline")}</button>
        <button type="button" className="chip" onClick={() => nav.push("timeoff", { uid, spaceId: space.id, eventId: event.id })}>{t("cs.calendar.proposeSwap", "Propose a swap")}</button>
      </div>}
      {event.kind === "booking" && <p className="muted" style={{ margin: "8px 0 0" }}>{t("cs.calendar.booking.status", "Booking status is kept separate from time off.")}</p>}
      {event.kind !== "booking" && <button type="button" className="chip" style={{ marginTop: 10 }} onClick={() => nav.push("event-edit", { uid, spaceId: event.spaceId, eventId: event.id })}>{t("cs.calendar.edit", "Edit event")}</button>}
    </article>;
  }

  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const visibleEvents = period === "month" ? selectedEvents : periodEvents;
  return <div className="app">
    <BackBar title={t("cs.calendar.title", "Calendar")} onBack={nav.back} right={<button type="button" className="chip" onClick={() => nav.push("notifications", { uid })}>{t("cs.calendar.bell", "Notifications")}</button>} />
    <div className="scroll" style={{ paddingTop: 8 }}>
      {!online && fromCache && <p role="status" className="card" style={{ margin: "0 0 12px", padding: 12, background: "var(--soft)" }}>{t("cs.offline.banner", "You're offline - showing saved copy")}</p>}
      {!online && !fromCache && <p role="status" className="card" style={{ margin: "0 0 12px", padding: 12, background: "var(--soft)" }}>{t("cs.offline.empty", "You're offline. No saved copy is on this device yet.")}</p>}
      <div className="row" role="tablist" aria-label={t("cs.calendar.views", "Calendar views")} style={{ gap: 8, marginBottom: 12 }}>
        <Chip on={view === "mine"} role="tab" aria-selected={view === "mine"} onClick={() => setView("mine")}>{t("cs.calendar.mine", "Mine")}</Chip>
        <Chip on={view === "family"} role="tab" aria-selected={view === "family"} onClick={() => setView("family")}>{t("cs.calendar.oneFamily", "One family")}</Chip>
        <Chip on={view === "team"} role="tab" aria-selected={view === "team"} onClick={() => setView("team")}>{t("cs.calendar.team", "Team")}</Chip>
      </div>
      {view === "family" && <label style={{ display: "block", marginBottom: 12 }}>
        <span className="muted" style={{ display: "block", marginBottom: 6 }}>{t("cs.calendar.chooseFamily", "Choose a family")}</span>
        <select className="field" value={familyId} onChange={(event) => setFamilyId(event.target.value)} aria-label={t("cs.calendar.chooseFamily", "Choose a family")}>
          {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
        </select>
      </label>}
      <div className="row" role="tablist" aria-label={t("cs.calendar.periods", "Calendar period")} style={{ gap: 8, marginBottom: 12 }}>
        <Chip on={period === "day"} role="tab" aria-selected={period === "day"} onClick={() => setPeriod("day")}>{t("cs.calendar.period.day", "Day")}</Chip>
        <Chip on={period === "week"} role="tab" aria-selected={period === "week"} onClick={() => setPeriod("week")}>{t("cs.calendar.period.week", "Week")}</Chip>
        <Chip on={period === "month"} role="tab" aria-selected={period === "month"} onClick={() => setPeriod("month")}>{t("cs.calendar.period.month", "Month")}</Chip>
      </div>
      {period !== "month" && <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <button className="chip flip" type="button" style={{ minWidth: 44, minHeight: 44 }} aria-label={t(`cs.calendar.previous.${period}`, period === "day" ? "Previous day" : "Previous week")} onClick={() => movePeriod(-1)}>‹</button>
        <h2 style={{ fontSize: 20, textAlign: "center" }}>{periodLabel}</h2>
        <button className="chip flip" type="button" style={{ minWidth: 44, minHeight: 44 }} aria-label={t(`cs.calendar.next.${period}`, period === "day" ? "Next day" : "Next week")} onClick={() => movePeriod(1)}>›</button>
      </div>}
      {period === "month" && <section className="card" style={{ padding: 4, margin: "0 -16px 14px" }} aria-label={t("cs.calendar.month", "Month view")}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <button className="chip flip" type="button" style={{ minWidth: 44, minHeight: 44 }} aria-label={t("cs.calendar.previousMonth", "Previous month")} onClick={() => moveMonth(-1)}>‹</button>
          <h2 style={{ fontSize: 22 }}>{monthLabel}</h2>
          <button className="chip flip" type="button" style={{ minWidth: 44, minHeight: 44 }} aria-label={t("cs.calendar.nextMonth", "Next month")} onClick={() => moveMonth(1)}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(44px, 1fr))", gap: 0, textAlign: "center" }}>
          {WEEKDAYS.map(([key, label]) => <span key={key} className="muted" style={{ padding: "4px 0" }}>{t(key, label)}</span>)}
          {cells.map((date, index) => {
            if (!date) return <span key={`blank-${index}`} />;
            const key = dayKey(date);
            const hasEvents = monthEvents.some((event) => sameDay(event.start, key));
            return <button key={key} type="button" className={`chip${selectedDay === key ? " on" : ""}`} onClick={() => setSelectedDay(key)} aria-pressed={selectedDay === key}
              aria-label={`${date.toLocaleDateString(undefined, { dateStyle: "full" })}${hasEvents ? `, ${t("cs.calendar.hasEvents", "has events")}` : ""}`}
              style={{ justifyContent: "center", minHeight: 44, minWidth: 44, padding: 0, borderRadius: 12, fontSize: 17 }}>
              {date.getDate()}{hasEvents && <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--good)", position: "absolute", insetBlockEnd: 4 }} />}
            </button>;
          })}
        </div>
      </section>}
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button type="button" className="btn alt" disabled={!spaces.length} onClick={() => nav.push("event-edit", { uid, spaceId: familyId || spaces[0]?.id })}>{t("cs.calendar.add", "Add event")}</button>
        <button type="button" className="btn" disabled={!spaces.length} onClick={() => nav.push("timeoff", { uid, spaceId: familyId || spaces[0]?.id })}>{t("cs.calendar.timeoff", "Request time off")}</button>
      </div>
      {notice && <p role="status" className="muted">{notice}</p>}
      <h2 style={{ fontSize: 24, margin: "4px 0 10px" }}>{period === "month" ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : periodLabel}</h2>
      {visibleEvents.length ? <div style={{ display: "grid", gap: 10 }}>
        {visibleEvents.map((event) => renderEvent(event, period === "week"))}
      </div> : <Empty mood="think" title={t("cs.calendar.empty.title", "Nothing planned for this day")} body={period === "week" ? t("cs.calendar.empty.week", "No shifts, school, activities or pickups are planned this week.") : t("cs.calendar.empty.body", "Shifts, school, activities and pickups will show here.")} />}
    </div>
  </div>;
}
