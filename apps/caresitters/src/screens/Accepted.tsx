import { useEffect, useState } from "react";
import { type ScreenProps, BackBar, Bunny, Button, Empty, auth, t, useNav } from "@cc/core";
import { loadBookingById, type BookingRecord } from "../data/bookings";
import "./booking/booking.css";

type Params = { bookingId: string; pairId?: string };
export default function Accepted({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    const uid = auth().currentUser?.uid;
    if (!uid || !params.bookingId) { setLoading(false); setError(true); return () => { live = false; }; }
    void loadBookingById(uid, params.bookingId, params.pairId).then((value) => {
      if (live) { setBooking(value); setLoading(false); }
    }).catch(() => { if (live) { setError(true); setLoading(false); } });
    return () => { live = false; };
  }, [params.bookingId, params.pairId]);

  const accepted = booking?.state === "accepted";
  return <div className="booking-screen">
    <BackBar title={t("accepted.title", "Booking update")} onBack={nav.back} />
    <div className="scroll"><div className="booking-content">
      {loading && <div className="sk" style={{ height: 220 }} />}
      {!loading && error && <Empty mood="oops" title={t("accepted.loadError", "Booking could not load")} body={t("accepted.loadErrorBody", "Open your Bookings list and try again.")} />}
      {!loading && !error && accepted && <section className="booking-card booking-empty"><Bunny mood="celebrate" size={128} /><h1>{t("accepted.connected", "You're connected")}</h1><p>{t("accepted.acceptedBody", "The carer accepted this booking request.")}</p><Button onClick={() => nav.push("handoff", { bookingId: booking.id, pairId: booking.pairId, familyUid: booking.familyUid, carerUid: booking.carerUid })}>{t("accepted.setup", "Set up your care space")}</Button><button className="booking-quiet-link" onClick={nav.back}>{t("accepted.skip", "Not now")}</button></section>}
      {!loading && !error && booking && booking.state === "requested" && <section className="booking-card booking-empty"><Bunny mood="rest" size={104} /><h2>{t("accepted.requestSent", "Request sent")}</h2><p>{t("accepted.waiting", "The carer still needs to accept this request.")}</p><Button alt onClick={nav.back}>{t("accepted.back", "Back to bookings")}</Button></section>}
      {!loading && !error && booking && booking.state !== "accepted" && booking.state !== "requested" && <section className="booking-card booking-empty"><Bunny mood="think" size={100} /><h2>{t("accepted.noLongerAvailable", "This booking is not active")}</h2><p>{t("accepted.state", "Current status: {state}", { state: booking.state })}</p><Button alt onClick={nav.back}>{t("accepted.back", "Back to bookings")}</Button></section>}
      {!loading && !error && !booking && <Empty mood="rest" title={t("accepted.notFound", "Booking not found")} body={t("accepted.notFoundBody", "This booking is not available in your account.")} />}
    </div></div>
  </div>;
}
