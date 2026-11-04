import { useEffect, useMemo, useState } from "react";
import { APP2, type Person, type ScreenProps, BackBar, Bunny, Button, Empty, auth, loadProfile, t, useNav } from "@cc/core";
import { loadVerifiedQualifications, mediaUrl, isPersonSaved, savePerson, type QualificationRecord } from "../data/bookings";
import { estimateCost, explainMatchAdapter } from "../lib/booking";
import { careSpaceUrls, openCareSpace } from "./booking/careSpaceLinks";
import "./booking/booking.css";

type Review = { name: string; text: string; rating?: number; date?: string };
type Params = { uid: string; me?: Person };
type ViewState = { person: Person | null; checks: QualificationRecord[]; reviews: Review[]; loading: boolean; error: string };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const money = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(value);

function availabilityFor(person: Person, day: string): boolean | null {
  const availability = person.card.availability;
  if (!availability || typeof availability !== "object") return null;
  if (Array.isArray(availability)) return availability.length ? availability.some((item) => String(item).slice(0, 3).toLowerCase() === day.toLowerCase()) : null;
  const values = availability as Record<string, unknown>;
  const entry = Object.entries(values).find(([key]) => key.slice(0, 3).toLowerCase() === day.toLowerCase())?.[1];
  if (entry === undefined) return Object.keys(values).length ? false : null;
  if (typeof entry === "object" && entry !== null && "available" in entry) return Boolean((entry as { available?: unknown }).available);
  if (Array.isArray(entry)) return entry.length > 0;
  return Boolean(entry);
}

function profileReviews(person: Person): Review[] {
  const raw = person.raw.reviews ?? person.card.reviews;
  const rows = Array.isArray(raw) ? raw : [];
  return rows.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")).slice(0, 5).map((item) => {
    const rawRating = item.rating ?? item.stars;
    const rating = rawRating == null || rawRating === "" ? NaN : Number(rawRating);
    return {
      name: String(item.reviewerName ?? item.name ?? t("person.reviewParent", "A parent")),
      text: String(item.text ?? item.comment ?? item.body ?? ""),
      ...(Number.isFinite(rating) && rating >= 1 && rating <= 5 ? { rating } : {}),
      ...(typeof item.date === "string" ? { date: item.date } : typeof item.createdAt === "string" ? { date: item.createdAt.slice(0, 10) } : {}),
    };
  }).filter((review) => review.text || review.rating != null);
}

function checkLabel(status: QualificationRecord["status"]): string {
  return ({ submitted: t("person.checkSubmitted", "Submitted"), under_review: t("person.checkUnderReview", "Under review"), verified: t("person.checkVerified", "Verified"), expired: t("person.checkExpired", "Expired"), needs_renewal: t("person.checkRenewal", "Needs renewal") })[status];
}

export default function PersonProfile({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const uid = params.uid;
  const careLinks = careSpaceUrls();
  const [view, setView] = useState<ViewState>({ person: null, checks: [], reviews: [], loading: true, error: "" });
  const [me, setMe] = useState<Person | null>(params.me ?? null);
  const [why, setWhy] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let live = true;
    setView((current) => ({ ...current, loading: true, error: "" }));
    setWhy([]);
    setVideoUrl(null);
    async function load() {
      try {
        const person = await loadProfile(uid);
        const checks = await loadVerifiedQualifications(uid).catch(() => []);
        if (!live) return;
        setView({ person, checks, reviews: person ? profileReviews(person) : [], loading: false, error: "" });
        if (!person) return;
        const signedInUid = auth().currentUser?.uid;
        const own = params.me ?? (signedInUid ? await loadProfile(signedInUid).catch(() => null) : null);
        if (!live) return;
        setMe(own);
        if (signedInUid && signedInUid !== uid) setSaved(await isPersonSaved(signedInUid, uid).catch(() => false));
        if (person.card.videoKey) setVideoUrl(await mediaUrl(String(person.card.videoKey)));
        if (own) {
          let reasons: string[] = [];
          try {
            const core = await import("@cc/core") as unknown as { explain?: (viewer: Person, other: Person) => unknown };
            if (typeof core.explain === "function") {
              const result = await core.explain(own, person);
              reasons = Array.isArray(result) ? result.map(String) : typeof result === "string" ? [result] : result && typeof result === "object" && "reasons" in result && Array.isArray((result as { reasons?: unknown[] }).reasons) ? (result as { reasons: unknown[] }).reasons.map(String) : [];
            }
          } catch { /* Use the clearly marked adapter below until the core export is available. */ }
          if (!reasons.length && own.side !== person.side) {
            const family = own.side === "family" ? own : person;
            const carer = own.side === "carer" ? own : person;
            reasons = explainMatchAdapter(family, carer);
          }
          if (live) setWhy(reasons);
        }
      } catch {
        if (live) setView((current) => ({ ...current, loading: false, error: t("person.loadError", "This profile could not load. Try again.") }));
      }
    }
    void load();
    return () => { live = false; };
  }, [uid, params.me]);

  const person = view.person;
  const rateValue = person?.card.rate ?? person?.card.payFloor ?? person?.card.hourlyRate;
  const rate = Number(rateValue);
  const hasRate = rateValue !== null && rateValue !== undefined && rateValue !== "" && Number.isFinite(rate) && rate >= 0;
  const exampleCost = hasRate ? estimateCost("09:00", "12:00", rate) : null;
  const displayName = person?.name ?? t("person.loadingName", "Carer profile");
  const availability = useMemo(() => person ? DAYS.map((day) => ({ day, value: availabilityFor(person, day) })) : [], [person]);

  async function toggleSaved() {
    const currentUid = auth().currentUser?.uid;
    if (!currentUid || !person || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await savePerson(currentUid, person.uid, !saved);
      setSaved(!saved);
    } catch {
      setSaveError(t("person.saveError", "Could not update Saved. Try again."));
    } finally { setSaving(false); }
  }

  return <div className="booking-screen">
    <BackBar title={t("person.title", "Profile")} onBack={nav.back} />
    <div className="scroll"><div className="booking-content">
      {view.loading && <div className="booking-list" aria-label={t("person.loading", "Loading profile")}><div className="sk" style={{ height: 320 }} /><div className="sk" style={{ height: 120 }} /></div>}
      {!view.loading && !person && <Empty mood="oops" title={t("person.notFound", "Profile not available")} body={view.error || t("person.notFoundBody", "This person may have removed their profile.")} />}
      {person && <>
        <section className="booking-hero" aria-label={t("person.photoLabel", "Profile photo")}>{person.photoUrl ? <img src={person.photoUrl} alt={t("person.photoAlt", "Photo of {name}", { name: displayName })} /> : <div className="booking-hero-placeholder" aria-hidden="true">{person.firstName.slice(0, 1).toUpperCase()}</div>}<div className="booking-hero-shade" /><div className="booking-hero-copy"><h1>{displayName}</h1><p>{person.card.headline ? String(person.card.headline) : person.about ? String(person.about) : t("person.introMissing", "Introduction not shared yet.")}</p></div><div className="booking-hero-tools"><button className="booking-icon-button" onClick={() => void toggleSaved()} aria-pressed={saved} disabled={saving} aria-label={saved ? t("person.unsave", "Remove from Saved") : t("person.save", "Save profile")}>{saved ? `♥ ${t("person.saved", "Saved")}` : `♡ ${t("person.save", "Save")}`}</button></div></section>
        {person.card.videoKey && <section className="booking-section booking-card"><h2>{t("person.videoTitle", "Video introduction")}</h2>{videoUrl ? <video className="booking-video" src={videoUrl} controls playsInline preload="metadata" aria-label={t("person.videoLabel", "Video introduction from {name}", { name: displayName })} /> : <p className="booking-note">{t("person.videoUnavailable", "Video not available yet")}</p>}</section>}
        <section className="booking-card booking-section"><h2>{t("person.whyTitle", "Why you match")}</h2>{why.length ? <ul style={{ margin: 0, paddingInlineStart: 22 }}>{why.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul> : <p className="booking-meta">{t("person.whyUnknown", "Not enough shared profile details yet.")}</p>}</section>
        <section className="booking-card booking-section"><div className="booking-between"><h2>{t("person.checksTitle", "Checks and dates")}</h2><span className="booking-status">{view.checks.some((check) => check.status === "verified") ? t("person.serverChecked", "Server checked") : t("person.noVerifiedChecks", "No verified checks")}</span></div>{view.checks.length ? <div className="booking-checklist">{view.checks.map((check) => <div className="booking-check" key={check.id}><div className="booking-between"><b>{check.label}</b><span className={`booking-status${check.status === "verified" ? " verified" : check.status === "submitted" || check.status === "under_review" ? " pending" : ""}`}>{checkLabel(check.status)}</span></div><p className="booking-meta">{check.checkedOn ? t("person.checkedOn", "Checked {date}", { date: check.checkedOn }) : t("person.noCheckDate", "Check date not recorded")}{check.verifiedBy ? ` · ${t("person.checkedBy", "checked by {name}", { name: check.verifiedBy })}` : ""}{check.expires ? ` · ${t("person.expires", "expires {date}", { date: check.expires })}` : ""}</p></div>)}</div> : <p className="booking-meta">{t("person.checksUnknown", "No check record was found. This profile is not shown as verified.")}</p>}</section>
        <section className="booking-card booking-section"><h2>{t("person.reviewsTitle", "Reviews")}</h2>{view.reviews.length ? view.reviews.map((review, index) => <article className="booking-review" key={`${review.name}-${index}`}><div className="booking-between"><b>{review.name}</b>{review.rating != null && <span aria-label={t("person.rating", "Rating {rating} out of 5", { rating: review.rating })}>★ {review.rating}/5</span>}</div>{review.date && <p className="booking-meta">{review.date}</p>}{review.text && <p>{review.text}</p>}</article>) : <p className="booking-meta">{t("person.noReviews", "No reviews shared yet.")}</p>}</section>
        <section className="booking-card booking-section"><h2>{t("person.calendarTitle", "Availability")}</h2><div className="booking-day-grid" aria-label={t("person.calendarLabel", "Weekly availability calendar")}>{availability.map(({ day, value }) => <div className={`booking-day${value === true ? " available" : value === null ? " unknown" : ""}`} key={day}><span>{t(`day.${day.toLowerCase()}`, day)}</span><br /><span aria-label={value === true ? t("person.available", "Available") : value === false ? t("person.notListed", "Not listed") : t("person.notShared", "Not shared")}>{value === true ? "✓" : value === false ? "—" : "?"}</span></div>)}</div><p className="booking-meta">{t("person.calendarDisclaimer", "Shared days are not a promise. The carer still needs to accept a request.")}</p></section>
        <section className="booking-card booking-section"><h2>{t("person.rateTitle", "Rate and estimate")}</h2>{hasRate ? <><p><b>{money(rate)} {t("person.perHour", "per hour")}</b></p><p className="booking-meta">{exampleCost != null ? t("person.exampleCost", "Example: 3 hours would cost about {amount}.", { amount: money(exampleCost) }) : t("person.rateEstimate", "Choose a time to see your estimated cost.")}</p></> : <p className="booking-meta">{t("person.rateMissing", "Rate not listed. Message to ask before requesting a booking.")}</p>}</section>
        <section className="booking-note"><b>{t("person.manageTitle", "Already working together?")}</b><p>{t("person.manageBody", "Manage care updates in {app}.", { app: APP2 })}</p><button className="booking-quiet-link" onClick={() => openCareSpace()}>{t("person.openCareSpace", "Open {app}", { app: APP2 })}</button><p className="booking-meta"><a href={careLinks.universal}>{t("person.universalLink", "Open the web link")}</a> · <a href={careLinks.custom}>{t("person.customLink", "Open with the app link")}</a> · <a href={careLinks.appStore}>{t("person.appStoreFallback", "Find {app} in the App Store", { app: APP2 })}</a></p></section>
        {saveError && <p className="booking-error" role="alert">{saveError}</p>}
      </>}
    </div></div>
    {person && <div className="booking-bottom profile-bottom"><Button alt onClick={() => nav.push("chat", { uid: person.uid })}>{t("person.message", "Message")}</Button><Button onClick={() => nav.push("book", { uid: person.uid, rate: hasRate ? rate : undefined })} disabled={!hasRate}>{t("person.book", "Book")}</Button><Button alt onClick={() => nav.push("safety", { uid: person.uid })}>{t("person.reportBlock", "Report or block")}</Button></div>}
  </div>;
}
