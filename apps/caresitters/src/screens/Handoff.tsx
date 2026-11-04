import { useEffect, useState } from "react";
import { APP2, type Person, type ScreenProps, BackBar, Bunny, Button, Empty, auth, loadProfile, t, useNav } from "@cc/core";
import { createCareSpaceInvite, loadBookingById, type BookingRecord } from "../data/bookings";
import { careSpaceUrls, openCareSpace } from "./booking/careSpaceLinks";
import "./booking/booking.css";

type Params = { bookingId?: string; pairId?: string; familyUid?: string; carerUid?: string };
export default function Handoff({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const uid = auth().currentUser?.uid;
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [family, setFamily] = useState<Person | null>(null);
  const [spaceId, setSpaceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    async function load() {
      if (!uid || !params.bookingId) { setLoading(false); setError(t("handoff.bookingMissing", "Booking details are missing.")); return; }
      try {
        const record = await loadBookingById(uid, params.bookingId, params.pairId);
        const familyProfile = record ? await loadProfile(record.familyUid).catch(() => null) : null;
        if (!live) return;
        setBooking(record);
        setFamily(familyProfile);
        if (!record || record.state !== "accepted") setError(t("handoff.acceptedOnly", "Care space setup is available after the carer accepts the booking."));
      } catch {
        if (live) setError(t("handoff.loadError", "Booking could not load. Return to Bookings and try again."));
      } finally { if (live) setLoading(false); }
    }
    void load();
    return () => { live = false; };
  }, [uid, params.bookingId, params.pairId]);

  const familyOwner = Boolean(uid && booking?.familyUid === uid);
  const links = careSpaceUrls(spaceId || booking?.familyUid);

  async function invite() {
    if (!booking || !familyOwner || booking.state !== "accepted" || saving) return;
    setSaving(true);
    setError("");
    try {
      const id = await createCareSpaceInvite({ familyUid: booking.familyUid, familyName: family?.name ?? t("handoff.family", "Family"), carerUid: booking.carerUid, bookingId: booking.id });
      setSpaceId(id);
    } catch {
      setError(t("handoff.inviteError", "The invitation could not be saved. Try again when you are online."));
    } finally { setSaving(false); }
  }

  return <div className="booking-screen">
    <BackBar title={t("handoff.title", "Set up your care space")} onBack={nav.back} />
    <div className="scroll"><div className="booking-content">
      {loading && <div className="sk" style={{ height: 200 }} />}
      {!loading && (!booking || booking.state !== "accepted") && <Empty mood="rest" title={t("handoff.notReady", "Not ready yet")} body={error || t("handoff.notReadyBody", "Only an accepted booking can start this hand-off.")} />}
      {!loading && booking?.state === "accepted" && !spaceId && <>
        <section className="booking-card booking-empty"><Bunny mood="point" size={112} /><h1>{t("handoff.intro", "Bring care details together")}</h1><p>{t("handoff.body", "Invite the family and carer to share daily care updates in {app}.", { app: APP2 })}</p></section>
        {familyOwner ? <Button onClick={() => void invite()} disabled={saving}>{saving ? t("handoff.saving", "Sending invite…") : t("handoff.invite", "Create care space and invite the carer")}</Button> : <section className="booking-note"><b>{t("handoff.ownerTitle", "The family starts this space")}</b><p>{t("handoff.ownerBody", "Only the family owner can create the space and invite the carer.")}</p><Button alt onClick={() => nav.push("chat", { uid: booking.familyUid })}>{t("handoff.askFamily", "Message the family")}</Button></section>}
      </>}
      {!loading && spaceId && <section className="booking-card booking-empty"><Bunny mood="encourage" size={108} /><h1>{t("handoff.invited", "Invite sent")}</h1><p>{t("handoff.invitedBody", "The family space is ready. The carer can join after accepting the invite.")}</p><Button onClick={() => openCareSpace(spaceId)}>{t("handoff.openApp", "Open {app}", { app: APP2 })}</Button><div className="booking-links"><a className="booking-link" href={links.universal}>{t("handoff.universalLink", "Open the web link")}</a><a className="booking-link" href={links.custom}>{t("handoff.customLink", "Open with the app link")}</a><a className="booking-link" href={links.appStore}>{t("handoff.appStore", "Find {app} in the App Store", { app: APP2 })}</a></div></section>}
      {error && booking?.state === "accepted" && <p className="booking-error" role="alert">{error}</p>}
      <button className="booking-quiet-link" onClick={nav.back}>{t("handoff.skip", "Skip for now")}</button>
    </div></div>
  </div>;
}
