import { useCallback, useEffect, useMemo, useState } from "react";
import { CANCEL_POLICY, type Person, type ScreenProps, BackBar, Button, Empty, auth, loadProfile, t, useNav } from "@cc/core";
import { loadBookingsForUser, transitionBooking, type BookingRecord } from "../data/bookings";
import { SafetyCheckin } from "./booking/SafetyCheckin";
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

export default function Bookings({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const me = params.me;
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<ParentView>("upcoming");
  const [busyId, setBusyId] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    const rows = await loadBookingsForUser(me.uid, me.side);
    setBookings(rows);
    const otherUids = [...new Set(rows.map((row) => me.side === "family" ? row.carerUid : row.familyUid))];
    const profiles = await Promise.all(otherUids.map(async (uid) => [uid, await loadProfile(uid).catch(() => null)] as const));
    setNames(Object.fromEntries(profiles.map(([uid, profile]) => [uid, profile?.firstName ?? t("bookings.person", "Care partner")] )));
  }, [me.uid, me.side]);

  useEffect(() => {
    let live = true;
    void refresh().catch(() => { if (live) setError(t("bookings.loadError", "Bookings could not load. Check your connection and try again.")); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [refresh]);

  const today = localToday();
  const sorted = useMemo(() => [...bookings].sort((a, b) => `${a.date} ${a.from}`.localeCompare(`${b.date} ${b.from}`)), [bookings]);
  const past = useMemo(() => sorted.filter((booking) => booking.date < today || booking.state === "declined" || booking.state === "cancelled" || booking.state === "completed"), [sorted, today]);
  const upcoming = useMemo(() => sorted.filter((booking) => booking.date >= today && (booking.state === "requested" || booking.state === "accepted")), [sorted, today]);
  const requests = useMemo(() => sorted.filter((booking) => booking.state === "requested"), [sorted]);
  const nextBooking = useMemo(() => sorted.find((booking) => booking.state === "accepted" && booking.date >= today), [sorted, today]);
  const recurring = useMemo(() => sorted.filter((booking) => booking.recurring === "weekly" && (booking.state === "requested" || booking.state === "accepted")), [sorted]);
  const earnings = useMemo(() => sorted.filter((booking) => booking.state === "accepted" || booking.state === "completed").reduce((total, booking) => total + Number(booking.estimate || 0), 0), [sorted]);
  const usual = useMemo(() => [...sorted].reverse().find((booking) => booking.familyUid === me.uid && (booking.state === "completed" || (booking.state === "accepted" && booking.date < today))), [sorted, me.uid, today]);

  async function changeState(booking: BookingRecord, next: "accepted" | "declined" | "cancelled") {
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

  function openRepeat(): void {
    if (!usual) return;
    const days = usual.weekdays.length ? usual.weekdays : [weekdayFor(usual.date)];
    nav.push("book", { uid: usual.carerUid, repeatFrom: { date: nextDateForDays(days), from: usual.from, to: usual.to, recurring: usual.recurring, weekdays: days } });
  }

  function personName(booking: BookingRecord): string {
    const uid = me.side === "family" ? booking.carerUid : booking.familyUid;
    return names[uid] ?? t("bookings.person", "Care partner");
  }

  function BookingCard({ booking, allowCancel = false }: { booking: BookingRecord; allowCancel?: boolean }) {
    return <article className="booking-card booking-summary">
      <div className="booking-between"><div><h3>{personName(booking)}</h3><p className="booking-meta">{dateLabel(booking.date)} · {booking.from}–{booking.to}</p></div><span className={`booking-status${booking.state === "accepted" ? " verified" : booking.state === "requested" ? " pending" : ""}`}>{statusText(booking.state)}</span></div>
      <div className="booking-row"><b>{moneyLabel(booking.rate)} {t("bookings.perHour", "/ hour")}</b><span>{t("bookings.estimatedTotal", "Estimated total: {amount}", { amount: moneyLabel(booking.estimate) })}</span></div>
      {booking.recurring === "weekly" && <p className="booking-meta">{t("bookings.weekly", "Weekly request: {days}", { days: booking.weekdays.join(", ") || t("bookings.daysNotSet", "days not set") })}</p>}
      {booking.note && <p>{booking.note}</p>}
      {allowCancel && (booking.state === "requested" || booking.state === "accepted") && <div className="booking-section"><p className="booking-meta">{t("bookings.cancelPolicy", "Cancellation policy: {policy}", { policy: CANCEL_POLICY })}</p><Button small alt onClick={() => void changeState(booking, "cancelled")} disabled={busyId === booking.id}>{busyId === booking.id ? t("bookings.updating", "Updating…") : t("bookings.cancel", "Cancel")}</Button></div>}
      {booking.state === "accepted" && booking.date === today && <SafetyCheckin booking={booking} uid={me.uid} />}
    </article>;
  }

  function RequestCard({ booking }: { booking: BookingRecord }) {
    return <article className="booking-card booking-summary"><div className="booking-between"><div><h3>{personName(booking)}</h3><p className="booking-meta">{dateLabel(booking.date)} · {booking.from}–{booking.to}</p></div><span className="booking-status pending">{t("bookings.newRequest", "Request")}</span></div><div className="booking-row"><b>{moneyLabel(booking.rate)} {t("bookings.perHour", "/ hour")}</b><span>{t("bookings.estimatedTotal", "Estimated total: {amount}", { amount: moneyLabel(booking.estimate) })}</span></div>{booking.recurring === "weekly" && <p className="booking-meta">{t("bookings.weekly", "Weekly request: {days}", { days: booking.weekdays.join(", ") })}</p>}{booking.note && <p>{booking.note}</p>}<div className="booking-actions"><Button small onClick={() => void changeState(booking, "accepted")} disabled={busyId === booking.id}>{t("bookings.accept", "Accept")}</Button><Button small alt onClick={() => void changeState(booking, "declined")} disabled={busyId === booking.id}>{t("bookings.decline", "Decline")}</Button></div></article>;
  }

  return <div className="booking-screen">
    <BackBar title={t("bookings.title", "Bookings")} onBack={nav.back} />
    <div className="scroll"><div className="booking-content">
      {loading && <div className="booking-list"><div className="sk" style={{ height: 120 }} /><div className="sk" style={{ height: 120 }} /></div>}
      {error && <p className="booking-error" role="alert">{error}</p>}
      {!loading && me.side === "family" && <>
        <header className="booking-section"><p className="booking-kicker">{t("bookings.familyKicker", "Your care, in one place")}</p><h1>{t("bookings.familyTitle", "Bookings")}</h1></header>
        {usual && <section className="booking-note"><div className="booking-between"><div><b>{t("bookings.usualTitle", "Book my usual carer")}</b><p>{t("bookings.usualBody", "Repeat a past time with {name}.", { name: names[usual.carerUid] ?? t("bookings.person", "Care partner") })}</p></div><Button small onClick={openRepeat}>{t("bookings.repeat", "Repeat")}</Button></div></section>}
        <div className="booking-tabs" role="tablist" aria-label={t("bookings.listTabs", "Booking lists")}><button className={`chip${view === "upcoming" ? " on" : ""}`} role="tab" aria-selected={view === "upcoming"} onClick={() => setView("upcoming")}>{t("bookings.upcoming", "Upcoming")}</button><button className={`chip${view === "past" ? " on" : ""}`} role="tab" aria-selected={view === "past"} onClick={() => setView("past")}>{t("bookings.past", "Past")}</button></div>
        <div className="booking-list">{(view === "upcoming" ? upcoming : past).map((booking) => <BookingCard key={`${booking.pairId}-${booking.id}`} booking={booking} allowCancel={view === "upcoming"} />)}{(view === "upcoming" ? upcoming : past).length === 0 && <Empty mood="rest" title={view === "upcoming" ? t("bookings.noUpcoming", "No upcoming bookings") : t("bookings.noPast", "No past bookings")} body={t("bookings.familyEmpty", "Accepted and requested times will show here.")} />}</div>
      </>}
      {!loading && me.side === "carer" && <>
        <header className="booking-section"><p className="booking-kicker">{t("bookings.carerKicker", "Your care day")}</p><h1>{t("bookings.dashboard", "Dashboard")}</h1></header>
        <section className="booking-section"><div className="booking-between"><h2>{t("bookings.nextTitle", "Next booking")}</h2><span className="booking-status">{t("bookings.estimatedLabel", "Estimated")}</span></div>{nextBooking ? <BookingCard booking={nextBooking} /> : <div className="booking-note"><p className="booking-meta">{t("bookings.noNext", "No accepted upcoming booking yet.")}</p></div>}</section>
        <section className="booking-stat"><span>{t("bookings.earnings", "Estimated earnings")}</span><strong>{moneyLabel(earnings)}</strong><span className="booking-meta">{t("bookings.earningsNote", "Sum of accepted and completed booking estimates. Not a payment record.")}</span></section>
        <section className="booking-section"><div className="booking-between"><h2>{t("bookings.requestsTitle", "Upcoming requests")}</h2><span className="booking-status">{requests.length}</span></div><div className="booking-list">{requests.map((booking) => <RequestCard key={`${booking.pairId}-${booking.id}`} booking={booking} />)}{!requests.length && <Empty mood="rest" title={t("bookings.noRequests", "No new requests")} body={t("bookings.requestsEmpty", "New booking requests will show here.")} />}</div></section>
        <section className="booking-section"><h2>{t("bookings.recurringTitle", "Recurring series")}</h2><div className="booking-list">{recurring.map((booking) => <BookingCard key={`${booking.pairId}-${booking.id}`} booking={booking} allowCancel />)}{!recurring.length && <p className="booking-meta">{t("bookings.noRecurring", "No weekly requests yet.")}</p>}</div></section>
        <section className="booking-list"><h2>{t("bookings.allTitle", "All bookings")}</h2>{upcoming.map((booking) => <BookingCard key={`all-${booking.pairId}-${booking.id}`} booking={booking} allowCancel />)}{!upcoming.length && !requests.length && <Empty mood="rest" title={t("bookings.noBookings", "No bookings yet")} />}</section>
      </>}
    </div></div>
  </div>;
}
