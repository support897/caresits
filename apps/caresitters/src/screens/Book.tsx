import { useEffect, useMemo, useState } from "react";
import { type Person, type ScreenProps, BackBar, Bunny, Button, Empty, auth, loadProfile, t, useNav } from "@cc/core";
import { CANCEL_POLICY } from "@cc/core";
import { createBookingRequest } from "../data/bookings";
import { checkAvailability, estimateCost, isProfileComplete } from "../lib/booking";
import { moneyLabel } from "./booking/format";
import "./booking/booking.css";

type RepeatSeed = { date?: string; from?: string; to?: string; recurring?: "none" | "weekly"; weekdays?: string[] };
type Params = { uid: string; rate?: number; repeatFrom?: RepeatSeed };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function localDay(offset = 1): string { const date = new Date(); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function weekdayFor(date: string): string { const value = new Date(`${date}T12:00:00`).getDay(); return DAYS[(value + 6) % 7] ?? "Mon"; }

export default function Book({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const [carer, setCarer] = useState<Person | null>(null);
  const [family, setFamily] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const initialDate = params.repeatFrom?.date ?? localDay();
  const [date, setDate] = useState(initialDate);
  const [from, setFrom] = useState(params.repeatFrom?.from ?? "16:00");
  const [to, setTo] = useState(params.repeatFrom?.to ?? "19:00");
  const [repeat, setRepeat] = useState(params.repeatFrom?.recurring === "weekly");
  const [weekdays, setWeekdays] = useState<string[]>(params.repeatFrom?.weekdays?.length ? params.repeatFrom.weekdays : [weekdayFor(initialDate)]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    async function load() {
      const uid = auth().currentUser?.uid;
      const [carerProfile, familyProfile] = await Promise.all([
        loadProfile(params.uid).catch(() => null),
        uid ? loadProfile(uid).catch(() => null) : Promise.resolve(null),
      ]);
      if (!live) return;
      setCarer(carerProfile);
      setFamily(familyProfile);
      setLoading(false);
    }
    void load();
    return () => { live = false; };
  }, [params.uid]);

  const rateValue = params.rate ?? carer?.card.rate ?? carer?.card.payFloor ?? carer?.card.hourlyRate;
  const rate = Number(rateValue);
  const validRate = Number.isFinite(rate) && rate >= 0;
  const estimate = validRate ? estimateCost(from, to, rate) : null;
  const availability = carer?.card.availability as Record<string, unknown> | string[] | null | undefined;
  const clashes = useMemo(() => repeat ? checkAvailability(availability, weekdays) : [], [repeat, availability, weekdays]);
  const scheduleKnown = Array.isArray(availability) ? availability.length > 0 : Boolean(availability && Object.keys(availability).length > 0);
  const familyComplete = family?.side === "family" && isProfileComplete(family);

  function toggleDay(day: string) {
    setWeekdays((current) => current.includes(day) ? current.filter((item) => item !== day) : DAYS.filter((item) => current.includes(item) || item === day));
  }

  async function sendRequest() {
    if (!carer || !family || !date || estimate == null || sending || sent || clashes.length) return;
    if (family.side !== "family") { setMessage(t("book.familyRole", "Switch to a family profile to send a booking request.")); return; }
    setSending(true);
    setMessage("");
    try {
      await createBookingRequest({
        familyUid: family.uid,
        carerUid: carer.uid,
        profileComplete: familyComplete,
        date,
        from,
        to,
        rate,
        estimate,
        recurring: repeat ? "weekly" : "none",
        weekdays: repeat ? weekdays : [],
        note,
      });
      setSent(true);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setMessage(reason === "profile-incomplete" ? t("book.completeProfile", "Finish your family profile before sending this request.") : t("book.sendError", "The request could not be sent. Check your connection and try again."));
    } finally { setSending(false); }
  }

  return <div className="booking-screen">
    <BackBar title={t("book.title", "Book a time")} onBack={nav.back} />
    <div className="scroll"><div className="booking-content">
      {loading && <div className="sk" style={{ height: 160 }} />}
      {!loading && !carer && <Empty mood="oops" title={t("book.carerMissing", "Carer profile not available")} body={t("book.carerMissingBody", "Go back and choose another profile.")} />}
      {carer && !sent && <>
        {family && family.side !== "family" && <p className="booking-error" role="alert">{t("book.familyRole", "Switch to a family profile to send a booking request.")}</p>}
        {!loading && !family && <p className="booking-error" role="alert">{t("book.signInRequired", "Sign in with a family profile to send a request.")}</p>}
        <header className="booking-section"><p className="booking-kicker">{t("book.requestFor", "Booking request for {name}", { name: carer.firstName })}</p><h1>{t("book.chooseTime", "Choose a time")}</h1><p className="booking-meta">{t("book.tapPath", "Choose date and time, then send.")}</p></header>
        <section className="booking-card booking-form" aria-label={t("book.details", "Booking details")}>
          <label>{t("book.date", "Date")}<input type="date" min={localDay(0)} value={date} onChange={(event) => { setDate(event.target.value); if (!repeat) setWeekdays([weekdayFor(event.target.value)]); }} /></label>
          <div className="booking-time-grid"><label>{t("book.from", "From")}<input type="time" step="900" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>{t("book.to", "To")}<input type="time" step="900" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
          {validRate ? <div className="booking-cost"><div className="booking-between"><span>{t("book.rate", "Rate")}</span><b>{moneyLabel(rate)} {t("book.hour", "/ hour")}</b></div><div className="booking-between"><span>{t("book.estimate", "Estimated cost")}</span><b>{estimate == null ? t("book.checkTime", "Check the time") : moneyLabel(estimate)}</b></div><p className="booking-meta">{t("book.estimateNote", "Estimate for one visit only. The carer needs to accept this request before it becomes active.")}</p></div> : <p className="booking-error">{t("book.rateMissing", "This carer has not listed a rate. Message them before booking.")}</p>}
          <label>{t("book.noteLabel", "Note (optional)")}<textarea maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("book.notePlaceholder", "Share a short note about this visit.")} /></label>
        </section>
        <label className="booking-repeat"><input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} /><span><b>{t("book.repeatWeekly", "Repeat weekly")}</b><br /><span className="booking-meta">{t("book.repeatInfo", "Choose the days. We check the shared availability before sending.")}</span></span></label>
        {repeat && <section className="booking-card booking-section"><h2>{t("book.weekdays", "Days each week")}</h2><div className="booking-weekdays">{DAYS.map((day) => <button key={day} type="button" aria-pressed={weekdays.includes(day)} onClick={() => toggleDay(day)}>{t(`day.${day.toLowerCase()}`, day)}</button>)}</div>{!weekdays.length && <p className="booking-error">{t("book.chooseDay", "Choose at least one day.")}</p>}{clashes.length > 0 ? <p className="booking-error" role="alert">{t("book.availabilityClash", "Not listed as available: {days}.", { days: clashes.join(", ") })}</p> : <p className="booking-meta">{scheduleKnown ? t("book.availabilityClear", "No listed conflicts for these days. The carer still needs to accept.") : t("book.availabilityUnknown", "No weekly schedule is shared yet. The carer will need to check these days.")}</p>}</section>}
        {carer.card.instantBook === true && <div className="booking-note">{familyComplete ? t("book.instantEligible", "This carer allows instant booking for eligible families. Your profile may qualify, but this request is still sent as requested; only the server can accept it.") : t("book.instantNeedsProfile", "This carer allows instant booking for eligible families. A completed family profile is needed; this request still needs carer acceptance.")}</div>}
        <div className="booking-note"><b>{t("book.cancellationTitle", "Cancellation policy")}</b><p>{t("book.cancellationPolicy", CANCEL_POLICY)}</p></div>
        {message && <p className="booking-error" role="alert">{message}</p>}
      </>}
      {sent && <section className="booking-card booking-empty"><Bunny mood="rest" size={100} /><h2>{t("book.requestSentTitle", "Request sent")}</h2><p>{t("book.requestSentBody", "Your request is waiting for the carer to accept.")}</p><Button onClick={nav.back}>{t("book.backToProfile", "Back to profile")}</Button></section>}
    </div></div>
    {carer && !sent && <div className="booking-bottom single"><p className="booking-policy-line">{t("book.cancellationPolicy", CANCEL_POLICY)}</p><Button onClick={() => void sendRequest()} disabled={!family || !validRate || estimate == null || !date || (repeat && (!weekdays.length || clashes.length > 0)) || sending}>{sending ? t("book.sending", "Sending request…") : t("book.send", "Send request")}</Button></div>}
  </div>;
}
