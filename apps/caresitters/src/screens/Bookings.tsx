import { useCallback, useEffect, useMemo, useState } from "react";
import { CANCEL_POLICY, type Person, type ScreenProps, BackBar, Button, Empty, auth, loadProfile, t, useNav } from "@cc/core";
import { bookingEndAtMillis, createBookingRequest, loadBookingSeriesForUser, loadBookingsForUser, transitionBooking, transitionBookingSeries, type BookingRecord, type BookingSeriesRecord, type BookingSeriesState } from "../data/bookings";
import { checkAvailability, estimateCost, isProfileComplete } from "../lib/booking";
import { SafetyCheckin } from "./booking/SafetyCheckin";
import { LeaveReview } from "./Reviews";
import { dateLabel, moneyLabel } from "./booking/format";
import "./booking/booking.css";

type Params = { me: Person };
type ParentView = "upcoming" | "past";
function localToday(): string { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function weekdayFor(dateValue: string): string { const day = new Date(`${dateValue}T12:00:00`).getDay(); return WEEKDAYS[(day + 6) % 7] ?? "Mon"; }
function nextDateForDays(days: string[]): string {
  const wanted = new Set(days.map((day) => day.slice(0, 3).toLowerCase()));
  const date = new Date();
  for (let offset = 1; offset <= 14; offset++) {
    const candidate = new Date(date);
    candidate.setDate(date.getDate() + offset);
    const day = WEEKDAYS[(candidate.getDay() + 6) % 7] ?? "Mon";
    if (wanted.has(day.toLowerCase())) return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}`;
  }
  return localToday();
}
function statusText(state: BookingRecord["state"]): string {
  return ({ requested: t("bookings.requested", "Waiting for acceptance"), accepted: t("bookings.accepted", "Accepted"), declined: t("bookings.declined", "Declined"), cancelled: t("bookings.cancelled", "Cancelled"), completed: t("bookings.completed", "Completed") })[state];
}
function seriesStatusText(state: BookingSeriesState): string {
  return ({ requested: t("bookings.seriesRequested", "Waiting for carer"), active: t("bookings.seriesActive", "Active"), paused: t("bookings.seriesPaused", "Paused"), ended: t("bookings.seriesEnded", "Ended") })[state];
}
function hasBookingEnded(booking: BookingRecord, now: number): boolean {
  const endAt = bookingEndAtMillis(booking.date, booking.to);
  return endAt !== null && endAt <= now;
}

export default function Bookings({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const me = params.me;
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [series, setSeries] = useState<BookingSeriesRecord[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [clock, setClock] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<ParentView>("upcoming");
  const [busyId, setBusyId] = useState("");
  const [seriesBusyId, setSeriesBusyId] = useState("");
  const [repeatBusy, setRepeatBusy] = useState(false);
  const [repeatMessage, setRepeatMessage] = useState("");
  const [repeatError, setRepeatError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    const [rows, seriesRows] = await Promise.all([
      loadBookingsForUser(me.uid, me.side),
      loadBookingSeriesForUser(me.uid, me.side),
    ]);
    setBookings(rows);
    setSeries(seriesRows);
    const otherUids = [...new Set([
      ...rows.map((row) => me.side === "family" ? row.carerUid : row.familyUid),
      ...seriesRows.map((row) => me.side === "family" ? row.carerUid : row.familyUid),
    ])];
    const profiles = await Promise.all(otherUids.map(async (uid) => [uid, await loadProfile(uid).catch(() => null)] as const));
    setNames(Object.fromEntries(profiles.map(([uid, profile]) => [uid, profile?.firstName ?? t("bookings.person", "Care partner")] )));
  }, [me.uid, me.side]);

  useEffect(() => {
    let live = true;
    void refresh().catch(() => { if (live) setError(t("bookings.loadError", "Bookings could not load. Check your connection and try again.")); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = localToday();
  const sorted = useMemo(() => [...bookings].sort((a, b) => `${a.date} ${a.from}`.localeCompare(`${b.date} ${b.from}`)), [bookings]);
  const pendingSeriesIds = useMemo(() => new Set(series.filter((row) => row.state === "requested").map((row) => row.id)), [series]);
  const past = useMemo(() => sorted.filter((booking) => booking.date < today || booking.state === "declined" || booking.state === "cancelled" || booking.state === "completed"), [sorted, today]);
  const upcoming = useMemo(() => sorted.filter((booking) => booking.date >= today && (booking.state === "requested" || booking.state === "accepted") && !(booking.seriesId && pendingSeriesIds.has(booking.seriesId))), [sorted, today, pendingSeriesIds]);
  const requests = useMemo(() => sorted.filter((booking) => booking.state === "requested" && booking.date >= today && !booking.seriesId), [sorted, today]);
  const nextBooking = useMemo(() => sorted.find((booking) => booking.state === "accepted" && booking.date >= today), [sorted, today]);
  const completedBookings = useMemo(() => sorted.filter((booking) => booking.state === "completed"), [sorted]);
  const readyToComplete = useMemo(() => sorted.filter((booking) => booking.state === "accepted" && hasBookingEnded(booking, clock)), [sorted, clock]);
  const earnings = useMemo(() => completedBookings.reduce((total, booking) => total + Number(booking.estimate || 0), 0), [completedBookings]);
  const visibleSeries = useMemo(() => series.filter((row) => row.state !== "ended" || row.decidedAt), [series]);
  const seriesRequests = useMemo(() => series.filter((row) => row.state === "requested"), [series]);
  const usual = useMemo(() => [...sorted].reverse().find((booking) => booking.familyUid === me.uid && (booking.state === "completed" || (booking.state === "accepted" && booking.date < today))), [sorted, me.uid, today]);
  const usualDays = usual ? (usual.weekdays.length ? usual.weekdays : [weekdayFor(usual.date)]) : [];
  const usualRepeatDate = usual ? nextDateForDays(usualDays) : "";
  const usualEstimate = usual ? estimateCost(usual.from, usual.to, usual.rate) : null;

  async function changeState(booking: BookingRecord, next: "accepted" | "declined" | "cancelled" | "completed") {
    if (busyId) return;
    if (next === "cancelled" && typeof window !== "undefined" && !window.confirm(`${t("bookings.cancelConfirm", "Cancel this time? Policy: {policy}", { policy: CANCEL_POLICY })}`)) return;
    setBusyId(booking.id);
    setError("");
    try {
      const uid = auth().currentUser?.uid ?? me.uid;
      await transitionBooking(booking.pairId, booking.id, next, me.side, uid);
      await refresh();
      if (next === "accepted") nav.push("accepted", { bookingId: booking.id, pairId: booking.pairId });
    } catch {
      setError(t("bookings.updateError", "This booking could not be updated. Check your connection and try again."));
    } finally { setBusyId(""); }
  }

  async function changeSeriesState(item: BookingSeriesRecord, next: BookingSeriesState): Promise<void> {
    if (seriesBusyId) return;
    setSeriesBusyId(item.id);
    setError("");
    try {
      const uid = auth().currentUser?.uid ?? me.uid;
      await transitionBookingSeries(item.pairId, item.id, next, me.side, uid);
      await refresh();
    } catch {
      setError(t("bookings.seriesUpdateError", "The repeat series could not be updated. Check your connection and try again."));
    } finally { setSeriesBusyId(""); }
  }

  function openRepeat(): void {
    if (!usual) return;
    const days = usual.weekdays.length ? usual.weekdays : [weekdayFor(usual.date)];
    nav.push("book", { uid: usual.carerUid, repeatFrom: { date: nextDateForDays(days), from: usual.from, to: usual.to, recurring: usual.recurring, weekdays: days } });
  }

  async function repeatUsual(): Promise<void> {
    if (!usual || me.side !== "family" || repeatBusy) return;
    const days = usual.weekdays.length ? usual.weekdays : [weekdayFor(usual.date)];
    const date = nextDateForDays(days);
    const estimate = estimateCost(usual.from, usual.to, usual.rate);
    if (estimate == null) { setRepeatError(t("bookings.repeatInvalid", "This past time cannot be repeated. Choose a different time.")); return; }
    setRepeatBusy(true);
    setRepeatMessage("");
    setRepeatError("");
    try {
      const carer = await loadProfile(usual.carerUid);
      if (!carer) throw new Error("carer-profile-missing");
      const checkDays = usual.recurring === "weekly" ? days : [weekdayFor(date)];
      if (checkAvailability(carer.card.availability, checkDays).length) throw new Error("availability-conflict");
      const overlaps = bookings.some((booking) => booking.carerUid === usual.carerUid
        && booking.date === date
        && (booking.state === "requested" || booking.state === "accepted")
        && booking.from < usual.to
        && usual.from < booking.to);
      if (overlaps) throw new Error("booking-conflict");
      await createBookingRequest({
        familyUid: me.uid,
        carerUid: usual.carerUid,
        profileComplete: isProfileComplete(me),
        date,
        from: usual.from,
        to: usual.to,
        rate: usual.rate,
        estimate,
        recurring: usual.recurring,
        weekdays: usual.recurring === "weekly" ? days : [],
        childIds: usual.childIds,
        shareAddress: usual.shareAddress,
      });
      await refresh();
      setRepeatMessage(t("bookings.repeatSent", "Repeat request sent. The carer still needs to accept."));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setRepeatError(reason === "availability-conflict"
        ? t("bookings.repeatUnavailable", "The carer has not listed availability for the repeat day. Choose a different time.")
        : reason === "booking-conflict"
          ? t("bookings.repeatConflict", "A request already overlaps this time. Choose a different time.")
          : reason === "profile-incomplete"
            ? t("bookings.repeatProfile", "Finish your family profile before repeating this booking.")
            : t("bookings.repeatError", "The repeat request could not be sent. Choose a different time or try again."));
    } finally { setRepeatBusy(false); }
  }

  function personName(booking: BookingRecord): string {
    const uid = me.side === "family" ? booking.carerUid : booking.familyUid;
    return names[uid] ?? t("bookings.person", "Care partner");
  }
  function seriesPersonName(item: BookingSeriesRecord): string {
    const uid = me.side === "family" ? item.carerUid : item.familyUid;
    return names[uid] ?? t("bookings.person", "Care partner");
  }

  function BookingCard({ booking, allowCancel = false }: { booking: BookingRecord; allowCancel?: boolean }) {
    return <article className="booking-card booking-summary">
      <div className="booking-between"><div><h3>{personName(booking)}</h3><p className="booking-meta">{dateLabel(booking.date)} · {booking.from}–{booking.to}</p></div><span className={`booking-status${booking.state === "accepted" ? " verified" : booking.state === "requested" ? " pending" : ""}`}>{statusText(booking.state)}</span></div>
      <div className="booking-row"><b>{moneyLabel(booking.rate)} {t("bookings.perHour", "/ hour")}</b><span>{booking.recurring === "weekly" ? t("bookings.estimatedEach", "Estimated per visit: {amount}", { amount: moneyLabel(booking.estimate) }) : t("bookings.estimatedTotal", "Estimated total: {amount}", { amount: moneyLabel(booking.estimate) })}</span></div>
      {booking.recurring === "weekly" && <p className="booking-meta">{t("bookings.weekly", "Weekly request: {days}", { days: booking.weekdays.map((day) => t(`day.${day.toLowerCase()}`, day)).join(", ") || t("bookings.daysNotSet", "days not set") })}</p>}
      {(booking.childIds?.length ?? 0) > 0 && <p className="booking-meta">{t("bookings.childrenCount", "Children selected: {count}", { count: booking.childIds?.length ?? 0 })}</p>}
      {booking.shareAddress && <p className="booking-meta">{t("bookings.addressChoice", "Address sharing may be arranged later. The exact address is not stored here.")}</p>}
      {booking.note && <p>{booking.note}</p>}
      {me.side === "family" && booking.state === "accepted" && <Button small onClick={() => nav.push("accepted", { bookingId: booking.id, pairId: booking.pairId })}>{t("bookings.openAccepted", "View accepted booking")}</Button>}
      {me.side === "carer" && booking.state === "accepted" && hasBookingEnded(booking, clock) && <Button small onClick={() => void changeState(booking, "completed")} disabled={busyId === booking.id}>{busyId === booking.id ? t("bookings.updating", "Updating…") : t("bookings.markCompleted", "Mark completed")}</Button>}
      {allowCancel && (booking.state === "requested" || booking.state === "accepted") && <div className="booking-section"><p className="booking-meta">{t("bookings.cancelPolicy", "Cancellation policy: {policy}", { policy: CANCEL_POLICY })}</p><Button small alt onClick={() => void changeState(booking, "cancelled")} disabled={busyId === booking.id}>{busyId === booking.id ? t("bookings.updating", "Updating…") : t("bookings.cancel", "Cancel")}</Button></div>}
      {booking.state === "accepted" && booking.date === today && <SafetyCheckin booking={booking} uid={me.uid} />}
      {me.side === "family" && booking.state === "completed" && <LeaveReview relId={booking.pairId} bookingId={booking.id} familyUid={booking.familyUid} carerUid={booking.carerUid} />}
    </article>;
  }

  function RequestCard({ booking }: { booking: BookingRecord }) {
    return <article className="booking-card booking-summary"><div className="booking-between"><div><h3>{personName(booking)}</h3><p className="booking-meta">{dateLabel(booking.date)} · {booking.from}–{booking.to}</p></div><span className="booking-status pending">{t("bookings.newRequest", "Request")}</span></div><div className="booking-row"><b>{moneyLabel(booking.rate)} {t("bookings.perHour", "/ hour")}</b><span>{t("bookings.estimatedTotal", "Estimated total: {amount}", { amount: moneyLabel(booking.estimate) })}</span></div>{(booking.childIds?.length ?? 0) > 0 && <p className="booking-meta">{t("bookings.childrenCount", "Children selected: {count}", { count: booking.childIds?.length ?? 0 })}</p>}{booking.shareAddress && <p className="booking-meta">{t("bookings.addressChoice", "Address sharing may be arranged later. The exact address is not stored here.")}</p>}{booking.note && <p>{booking.note}</p>}<div className="booking-actions"><Button small onClick={() => void changeState(booking, "accepted")} disabled={busyId === booking.id}>{t("bookings.accept", "Accept")}</Button><Button small alt onClick={() => void changeState(booking, "declined")} disabled={busyId === booking.id}>{t("bookings.decline", "Decline")}</Button></div></article>;
  }

  function SeriesCard({ item }: { item: BookingSeriesRecord }) {
    const amount = estimateCost(item.from, item.to, item.rate);
    const canDecide = me.side === "carer" && item.state === "requested";
    const canManage = item.state === "active" || item.state === "paused";
    const dateRange = item.endDate
      ? t("bookings.seriesDateRange", "{start} to {end}", { start: dateLabel(item.startDate), end: dateLabel(item.endDate) })
      : t("bookings.seriesStarts", "Starts {start}", { start: dateLabel(item.startDate) });
    return <article className="booking-card booking-summary">
      <div className="booking-between"><div><h3>{seriesPersonName(item)}</h3><p className="booking-meta">{dateRange} · {item.from}–{item.to}</p></div><span className={`booking-status${item.state === "active" ? " verified" : item.state === "requested" ? " pending" : ""}`}>{seriesStatusText(item.state)}</span></div>
      <p className="booking-meta">{t("bookings.seriesDays", "Every week: {days}", { days: item.weekdays.map((day) => t(`day.${day.toLowerCase()}`, day)).join(", ") })}</p>
      <div className="booking-row"><b>{moneyLabel(item.rate)} {t("bookings.perHour", "/ hour")}</b><span>{amount == null ? t("bookings.estimatedLabel", "Estimated") : t("bookings.seriesEstimate", "Estimated per visit: {amount}", { amount: moneyLabel(amount) })}</span></div>
      {canDecide && <div className="booking-actions"><Button small onClick={() => void changeSeriesState(item, "active")} disabled={seriesBusyId === item.id}>{t("bookings.acceptSeries", "Accept repeat")}</Button><Button small alt onClick={() => void changeSeriesState(item, "ended")} disabled={seriesBusyId === item.id}>{t("bookings.declineSeries", "Decline repeat")}</Button></div>}
      {canManage && <div className="booking-actions"><Button small onClick={() => void changeSeriesState(item, item.state === "active" ? "paused" : "active")} disabled={seriesBusyId === item.id}>{item.state === "active" ? t("bookings.pauseSeries", "Pause") : t("bookings.resumeSeries", "Resume")}</Button><Button small alt onClick={() => void changeSeriesState(item, "ended")} disabled={seriesBusyId === item.id}>{t("bookings.endSeries", "End series")}</Button></div>}
    </article>;
  }

  return <div className="booking-screen">
    <BackBar title={t("bookings.title", "Bookings")} onBack={nav.back} />
    <div className="scroll"><div className="booking-content">
      {loading && <div className="booking-list"><div className="sk" style={{ height: 120 }} /><div className="sk" style={{ height: 120 }} /></div>}
      {error && <p className="booking-error" role="alert">{error}</p>}
      {!loading && me.side === "family" && <>
        <header className="booking-section"><p className="booking-kicker">{t("bookings.familyKicker", "Your care, in one place")}</p><h1>{t("bookings.familyTitle", "Bookings")}</h1></header>
        {usual && <section className="booking-note"><div className="booking-between"><div><b>{t("bookings.usualTitle", "Book my usual carer")}</b><p>{t("bookings.usualBody", "Repeat a past time with {name}.", { name: names[usual.carerUid] ?? t("bookings.person", "Care partner") })}</p>{usualEstimate != null && <p className="booking-meta">{t("bookings.repeatDetails", "Next: {date} · {from}–{to} · {estimate}", { date: dateLabel(usualRepeatDate), from: usual.from, to: usual.to, estimate: usual.recurring === "weekly" ? t("bookings.repeatPerVisit", "{amount} per visit", { amount: moneyLabel(usualEstimate) }) : t("bookings.repeatTotal", "{amount} estimated total", { amount: moneyLabel(usualEstimate) }) })}</p>}</div><div className="booking-actions"><Button small onClick={() => void repeatUsual()} disabled={repeatBusy}>{repeatBusy ? t("bookings.repeatSending", "Sending…") : t("bookings.repeat", "Repeat")}</Button><Button small alt onClick={openRepeat}>{t("bookings.repeatEdit", "Choose a different time")}</Button></div></div><p className="booking-meta">{t("bookings.repeatAccept", "The carer still needs to accept. This does not create an accepted booking.")}</p>{repeatMessage && <p role="status">{repeatMessage}</p>}{repeatError && <p className="booking-error" role="alert">{repeatError}</p>}</section>}
        <section className="booking-section"><h2>{t("bookings.recurringTitle", "Recurring series")}</h2><div className="booking-list">{visibleSeries.map((item) => <SeriesCard key={`${item.pairId}-${item.id}`} item={item} />)}{!visibleSeries.length && <p className="booking-meta">{t("bookings.noRecurring", "No weekly requests yet.")}</p>}</div></section>
        <div className="booking-tabs" role="tablist" aria-label={t("bookings.listTabs", "Booking lists")}><button className={`chip${view === "upcoming" ? " on" : ""}`} role="tab" aria-selected={view === "upcoming"} onClick={() => setView("upcoming")}>{t("bookings.upcoming", "Upcoming")}</button><button className={`chip${view === "past" ? " on" : ""}`} role="tab" aria-selected={view === "past"} onClick={() => setView("past")}>{t("bookings.past", "Past")}</button></div>
        <div className="booking-list">{(view === "upcoming" ? upcoming : past).map((booking) => <BookingCard key={`${booking.pairId}-${booking.id}`} booking={booking} allowCancel={view === "upcoming"} />)}{(view === "upcoming" ? upcoming : past).length === 0 && <Empty mood="rest" title={view === "upcoming" ? t("bookings.noUpcoming", "No upcoming bookings") : t("bookings.noPast", "No past bookings")} body={t("bookings.familyEmpty", "Accepted and requested times will show here.")} />}</div>
      </>}
      {!loading && me.side === "carer" && <>
        <header className="booking-section"><p className="booking-kicker">{t("bookings.carerKicker", "Your care day")}</p><h1>{t("bookings.dashboard", "Dashboard")}</h1></header>
        <section className="booking-section"><div className="booking-between"><h2>{t("bookings.nextTitle", "Next booking")}</h2><span className="booking-status">{t("bookings.estimatedLabel", "Estimated")}</span></div>{nextBooking ? <BookingCard booking={nextBooking} /> : <div className="booking-note"><p className="booking-meta">{t("bookings.noNext", "No accepted upcoming booking yet.")}</p></div>}</section>
        {readyToComplete.length > 0 && <section className="booking-section"><h2>{t("bookings.readyComplete", "Ready to complete")}</h2><div className="booking-list">{readyToComplete.map((booking) => <BookingCard key={`${booking.pairId}-${booking.id}`} booking={booking} />)}</div></section>}
        <section className="booking-stat"><div className="booking-between"><span>{t("bookings.earnings", "Estimated earnings")}</span><span className="booking-status">{t("bookings.estimatedLabel", "Estimated")}</span></div><strong>{moneyLabel(earnings)}</strong><span className="booking-meta">{t("bookings.earningsNote", "Sum of completed booking estimates.")}</span></section>
        <section className="booking-section"><div className="booking-between"><h2>{t("bookings.earningsList", "Completed bookings")}</h2><span className="booking-status">{t("bookings.estimatedLabel", "Estimated")}</span></div><div className="booking-list">{completedBookings.map((booking) => <article className="booking-card booking-summary" key={`${booking.pairId}-${booking.id}`}><div className="booking-between"><div><h3>{personName(booking)}</h3><p className="booking-meta">{dateLabel(booking.date)} · {booking.from}–{booking.to}</p></div><span className="booking-status">{t("bookings.estimatedLabel", "Estimated")}</span></div><div className="booking-row"><span>{t("bookings.completed", "Completed")}</span><b>{t("bookings.estimatedEarning", "Estimated: {amount}", { amount: moneyLabel(booking.estimate) })}</b></div></article>)}{!completedBookings.length && <p className="booking-meta">{t("bookings.noCompletedEarnings", "Completed bookings will be listed here.")}</p>}</div></section>
        <section className="booking-section"><div className="booking-between"><h2>{t("bookings.requestsTitle", "Upcoming requests")}</h2><span className="booking-status">{requests.length + seriesRequests.length}</span></div><div className="booking-list">{requests.map((booking) => <RequestCard key={`${booking.pairId}-${booking.id}`} booking={booking} />)}{!requests.length && !seriesRequests.length && <Empty mood="rest" title={t("bookings.noRequests", "No new requests")} body={t("bookings.requestsEmpty", "New booking requests will show here.")} />}</div></section>
        <section className="booking-section"><h2>{t("bookings.recurringTitle", "Recurring series")}</h2><div className="booking-list">{visibleSeries.map((item) => <SeriesCard key={`${item.pairId}-${item.id}`} item={item} />)}{!visibleSeries.length && <p className="booking-meta">{t("bookings.noRecurring", "No weekly requests yet.")}</p>}</div></section>
        <section className="booking-list"><h2>{t("bookings.allTitle", "Upcoming bookings")}</h2>{upcoming.map((booking) => <BookingCard key={`all-${booking.pairId}-${booking.id}`} booking={booking} allowCancel />)}{!upcoming.length && !requests.length && !seriesRequests.length && <Empty mood="rest" title={t("bookings.noBookings", "No bookings yet")} />}</section>
      </>}
    </div></div>
  </div>;
}
