import "../lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { BackBar, Empty, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { createTimeOffRequest, decideTimeOffRequest, readCalendarForSpaces, type CalendarEvent } from "../data/calendar";
import { listUserSpaces, type SpaceSummary } from "../data/spaces";
import { buildTimeOffPeriod, findAffectedScheduleEvents } from "../lib/timeoff";
import { canPost } from "../lib/permissions";

type TimeOffParams = { uid?: string; spaceId?: string; eventId?: string };
type SwapDraft = { start: string; end: string };
type TimeOffReason = "timeoff" | "vacation" | "sick" | "unavailable";
const localField = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const REASONS: Array<[TimeOffReason, string, string]> = [
  ["timeoff", "cs.timeoff.reason.timeoff", "Time off"],
  ["vacation", "cs.timeoff.reason.vacation", "Vacation"],
  ["sick", "cs.timeoff.reason.sick", "Sick leave"],
  ["unavailable", "cs.timeoff.reason.unavailable", "Unavailable"],
];

export default function Screen({ params }: ScreenProps<TimeOffParams>) {
  const nav = useNav();
  const { user } = useAuth();
  const uid = params.uid || user?.uid || "";
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [spaceId, setSpaceId] = useState(params.spaceId ?? "");
  const [date, setDate] = useState(localField(new Date()));
  const [endDate, setEndDate] = useState(localField(new Date()));
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");
  const [allDay, setAllDay] = useState(false);
  const [reason, setReason] = useState<TimeOffReason>("timeoff");
  const [swaps, setSwaps] = useState<Record<string, SwapDraft>>({});
  const [openSwap, setOpenSwap] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    if (!uid) { setLoading(false); return; }
    void (async () => {
      const memberships = (await listUserSpaces(uid)).filter((space) => space.role === "admin" || space.perms?.calendar !== false);
      const result = await readCalendarForSpaces(memberships);
      if (!alive) return;
      setSpaces(memberships);
      setEvents(result.events);
      const requestedSpace = memberships.find((space) => space.id === params.spaceId && space.role !== "admin" && canPost(space.role));
      setSpaceId((current) => current && memberships.some((space) => space.id === current && space.role !== "admin" && canPost(space.role))
        ? current
        : requestedSpace?.id ?? memberships.find((space) => space.role !== "admin" && canPost(space.role))?.id ?? "");
      setOpenSwap(params.eventId ?? "");
    })().catch(() => { if (alive) setNotice(t("cs.timeoff.load.error", "Time-off requests could not load.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params.eventId, params.spaceId, uid]);

  const requestSpaces = useMemo(() => spaces.filter((space) => space.role !== "admin" && canPost(space.role)), [spaces]);
  const requested = useMemo(() => events.filter((event) => event.kind === "timeoff" && event.state === "requested"), [events]);
  const resolved = useMemo(() => events.filter((event) => event.kind === "timeoff" && event.state !== "requested" &&
    (event.ownerUid === uid || spaces.some((space) => space.id === event.spaceId && space.role === "admin"))), [events, spaces, uid]);
  const previewPeriod = useMemo(() => {
    try { return buildTimeOffPeriod(date, endDate, from, to, allDay); }
    catch { return null; }
  }, [allDay, date, endDate, from, to]);
  const affectedPreview = useMemo(() => previewPeriod
    ? findAffectedScheduleEvents(previewPeriod.start, previewPeriod.end, events.filter((event) => event.spaceId === spaceId))
    : [], [events, previewPeriod, spaceId]);
  const selectedSpace = spaces.find((space) => space.id === spaceId);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uid || !spaceId || !date || !endDate || !selectedSpace || selectedSpace.role === "admin" || !canPost(selectedSpace.role) || busy) return;
    let period;
    try { period = buildTimeOffPeriod(date, endDate, from, to, allDay); }
    catch { setNotice(t("cs.timeoff.range.error", "Choose a valid date range and an end time after the start time.")); return; }
    setBusy("new");
    setNotice("");
    try {
      const reasonOption = REASONS.find(([value]) => value === reason) ?? REASONS[0]!;
      const created = await createTimeOffRequest({
        spaceId,
        ownerUid: uid,
        start: period.start,
        end: period.end,
        title: t(reasonOption[1], reasonOption[2]),
      });
      setEvents((current) => [...current, { ...created, spaceName: selectedSpace.name }]);
      const sent = created.queued
        ? t("cs.offline.queued", "Saved here. It will sync when you're back online.")
        : t("cs.timeoff.request.sent", "Request sent to the family.");
      setNotice(affectedPreview.length
        ? `${sent} ${affectedPreview.length} ${t("cs.timeoff.affected.count", "scheduled item(s) may be affected.")}`
        : sent);
    } catch { setNotice(t("cs.timeoff.request.error", "The request could not be sent. Check your access and try again.")); }
    finally { setBusy(""); }
  }

  async function decide(event: CalendarEvent, action: "approve" | "decline" | "swap") {
    const space = spaces.find((entry) => entry.id === event.spaceId);
    if (!space || space.role !== "admin" || busy) return;
    const draft = swaps[event.id];
    const swapStart = draft?.start ? new Date(draft.start) : null;
    const swapEnd = draft?.end ? new Date(draft.end) : null;
    if (action === "swap" && (!swapStart || !swapEnd || Number.isNaN(swapStart.getTime()) || Number.isNaN(swapEnd.getTime()) || swapEnd <= swapStart)) {
      setNotice(t("cs.timeoff.swap.error", "Choose a valid proposed time. The end must follow the start."));
      return;
    }
    const swap = action === "swap" && swapStart && swapEnd
      ? { start: swapStart.toISOString(), end: swapEnd.toISOString() }
      : undefined;
    setBusy(event.id);
    try {
      const updated = await decideTimeOffRequest(space.id, event, action, space.role, swap);
      setEvents((current) => current.map((row) => row.id === event.id && row.spaceId === space.id ? { ...row, ...updated } : row));
      setOpenSwap("");
      setNotice(updated.queued
        ? t("cs.offline.queued", "Saved here. It will sync when you're back online.")
        : action === "approve" ? t("cs.timeoff.approved", "Time off approved.") : action === "decline" ? t("cs.timeoff.declined", "Time off declined.") : t("cs.timeoff.swap.sent", "Swap proposal sent to the carer."));
    } catch { setNotice(t("cs.timeoff.action.error", "This request could not be updated.")); }
    finally { setBusy(""); }
  }

  return <div className="app">
    <BackBar title={t("cs.timeoff.title", "Time off")} onBack={nav.back} />
    <div className="scroll">
      <p className="card" style={{ margin: "0 0 14px", background: "var(--soft)" }}>{t("cs.timeoff.safety", "A request does not cancel a booking. The family chooses what happens next.")}</p>
      {notice && <p role="status" style={{ margin: "0 0 12px" }}>{notice}</p>}
      {!loading && requestSpaces.length > 0 && <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>{t("cs.timeoff.request.heading", "Ask for time off")}</h2>
        <form onSubmit={(event) => void submitRequest(event)} style={{ display: "grid", gap: 10 }}>
          <label>
            <span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.family", "Family")}</span>
            <select className="field" value={spaceId} onChange={(event) => setSpaceId(event.target.value)} aria-label={t("cs.timeoff.family", "Family")}>
              {requestSpaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
            </select>
          </label>
          <label>
            <span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.reason", "Reason")}</span>
            <select className="field" value={reason} onChange={(event) => setReason(event.target.value as TimeOffReason)} aria-label={t("cs.timeoff.reason", "Reason")}>
              {REASONS.map(([value, key, fallback]) => <option key={value} value={value}>{t(key, fallback)}</option>)}
            </select>
          </label>
          <label><span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.date", "Start date")}</span><input className="field" type="date" value={date} onChange={(event) => {
            const next = event.target.value;
            setDate(next);
            if (next > endDate) setEndDate(next);
          }} required /></label>
          <label><span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.endDate", "End date")}</span><input className="field" type="date" value={endDate} min={date} onChange={(event) => setEndDate(event.target.value)} required /></label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, paddingBlock: 4 }}>
            <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} style={{ width: 22, height: 22 }} />
            <span>{t("cs.timeoff.allDay", "Request the whole day")}</span>
          </label>
          {!allDay && <div className="row" style={{ gap: 10 }}>
            <label style={{ flex: 1 }}><span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.from", "From")}</span><input className="field" type="time" value={from} onChange={(event) => setFrom(event.target.value)} required /></label>
            <label style={{ flex: 1 }}><span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.to", "To")}</span><input className="field" type="time" value={to} onChange={(event) => setTo(event.target.value)} required /></label>
          </div>}
          {affectedPreview.length > 0 && <div className="card" role="status" style={{ padding: 12, background: "var(--soft)", boxShadow: "none" }}>
            <strong>{t("cs.timeoff.affected.title", "This request overlaps scheduled care")}</strong>
            <ul style={{ margin: "8px 0 0", paddingInlineStart: 22 }}>
              {affectedPreview.map((event) => <li key={`${event.spaceId}-${event.id}`}>{event.title} · {new Date(event.start).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</li>)}
            </ul>
            <p style={{ margin: "8px 0 0" }}>{t("cs.timeoff.affected.notice", "These bookings stay in place until the family agrees on a change.")}</p>
          </div>}
          <button type="submit" className="btn" disabled={busy === "new" || !spaceId}>{busy === "new" ? t("cs.timeoff.sending", "Sending…") : t("cs.timeoff.send", "Send request")}</button>
        </form>
      </section>}
      <h2 style={{ fontSize: 24, margin: "0 0 10px" }}>{t("cs.timeoff.review.heading", "Family requests")}</h2>
      {loading ? <div className="sk" style={{ height: 130 }} /> : requested.length ? <div style={{ display: "grid", gap: 10 }}>
        {requested.map((event) => {
          const space = spaces.find((entry) => entry.id === event.spaceId);
          const admin = space?.role === "admin";
          const swap = swaps[event.id] ?? { start: "", end: "" };
          const startDate = new Date(event.start);
          const endDate = new Date(event.end);
          const fullDay = startDate.getHours() === 0 && startDate.getMinutes() === 0 && endDate.getHours() === 23 && endDate.getMinutes() === 59;
          const dateFormat: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" };
          const firstDay = startDate.toLocaleDateString(undefined, dateFormat);
          const lastDay = endDate.toLocaleDateString(undefined, dateFormat);
          const dateLabel = `${firstDay}${firstDay === lastDay ? "" : ` – ${lastDay}`}${fullDay ? ` · ${t("cs.timeoff.fullDay.label", "All day")}` : ` · ${startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${endDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}`;
          const affected = findAffectedScheduleEvents(event.start, event.end, events.filter((row) => row.spaceId === event.spaceId));
          return <article key={`${event.spaceId}-${event.id}`} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><strong>{event.title}</strong><span className="tag" style={{ fontSize: 17 }}>{space?.name ?? event.spaceName}</span></div>
            <p style={{ margin: "8px 0" }}>{dateLabel}</p>
            <p className="muted" style={{ margin: "0 0 10px" }}>{event.queued ? t("cs.offline.waiting", "Waiting to sync") : t("cs.timeoff.requested.status", "Waiting for the family")}</p>
            {affected.length > 0 && <div className="card" style={{ padding: 12, marginBottom: 10, background: "var(--soft)", boxShadow: "none" }}>
              <strong>{t("cs.timeoff.affected.title", "This request overlaps scheduled care")}</strong>
              <ul style={{ margin: "8px 0 0", paddingInlineStart: 22 }}>
                {affected.map((item) => <li key={`${item.spaceId}-${item.id}`}>{item.title} · {new Date(item.start).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</li>)}
              </ul>
              <p style={{ margin: "8px 0 0" }}>{t("cs.timeoff.affected.notice", "These bookings stay in place until the family agrees on a change.")}</p>
            </div>}
            {admin && <div className="row" style={{ gap: 8 }}>
              <button type="button" className="chip" disabled={busy === event.id} onClick={() => void decide(event, "approve")}>{t("cs.timeoff.approve", "Approve")}</button>
              <button type="button" className="chip" disabled={busy === event.id} onClick={() => void decide(event, "decline")}>{t("cs.timeoff.decline", "Decline")}</button>
              <button type="button" className="chip" onClick={() => setOpenSwap((current) => current === event.id ? "" : event.id)}>{t("cs.timeoff.propose", "Propose a swap")}</button>
            </div>}
            {!admin && event.ownerUid === uid && <p className="muted" style={{ margin: 0 }}>{t("cs.timeoff.sent.status", "Your request is with the family.")}</p>}
            {admin && openSwap === event.id && <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label><span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.swap.start", "Proposed start")}</span><input className="field" type="datetime-local" value={swap.start} onChange={(input) => setSwaps((current) => ({ ...current, [event.id]: { ...swap, start: input.target.value } }))} /></label>
              <label><span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.swap.end", "Proposed end")}</span><input className="field" type="datetime-local" value={swap.end} onChange={(input) => setSwaps((current) => ({ ...current, [event.id]: { ...swap, end: input.target.value } }))} /></label>
              <button type="button" className="btn sm" disabled={!swap.start || !swap.end || busy === event.id} onClick={() => void decide(event, "swap")}>{t("cs.timeoff.swap.send", "Send swap proposal")}</button>
            </div>}
          </article>;
        })}
      </div> : <Empty mood="rest" title={t("cs.timeoff.empty.title", "No requests waiting")} body={t("cs.timeoff.empty.body", "Requests stay with the family they affect.")} />}
      {!loading && resolved.length > 0 && <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 24, margin: "0 0 10px" }}>{t("cs.timeoff.history.heading", "Recent decisions")}</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {resolved.map((event) => {
            const space = spaces.find((entry) => entry.id === event.spaceId);
            const status = event.state === "approved" ? t("cs.timeoff.history.approved", "Approved")
              : event.state === "declined" ? t("cs.timeoff.history.declined", "Declined")
                : t("cs.timeoff.history.swap", "Swap proposed");
            const swapStart = event.swap?.start ? new Date(event.swap.start) : null;
            const swapEnd = event.swap?.end ? new Date(event.swap.end) : null;
            return <article key={`${event.spaceId}-${event.id}`} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}><strong>{event.title}</strong><span className="tag" style={{ fontSize: 17 }}>{event.queued ? `${status} · ${t("cs.offline.waiting", "Waiting to sync")}` : status}</span></div>
              <p style={{ margin: "8px 0 0" }}>{new Date(event.start).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} · {space?.name ?? event.spaceName}</p>
              {swapStart && swapEnd && <p className="muted" style={{ margin: "8px 0 0" }}>{t("cs.timeoff.history.proposed", "Proposed time")}: {swapStart.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} – {swapEnd.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>}
              {event.state === "swap" && <p className="muted" style={{ margin: "8px 0 0" }}>{t("cs.timeoff.history.swap.pending", "A proposal, not a change. Confirm with the family.")}</p>}
            </article>;
          })}
        </div>
      </section>}
    </div>
  </div>;
}
