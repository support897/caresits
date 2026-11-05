import { useEffect, useMemo, useState } from "react";
import { APP2, type Person, type ScreenProps, BackBar, Bunny, Button, Empty, auth, getPrivateMediaUrl, loadProfile, t, useNav } from "@cc/core";
import { loadVerifiedQualifications, mediaUrl, isPersonSaved, savePerson, type QualificationRecord } from "../data/bookings";
import { estimateCost, explainMatchAdapter } from "../lib/booking";
import { careSpaceUrls, openCareSpace } from "./booking/careSpaceLinks";
import { ReviewsList } from "./Reviews";
import { ResumeView } from "./ResumeView";
import "./booking/booking.css";

type Params = { uid: string; me?: Person };
type ViewState = { person: Person | null; checks: QualificationRecord[]; loading: boolean; error: string };
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

function checkLabel(status: QualificationRecord["status"]): string {
  return ({ submitted: t("person.checkSubmitted", "Submitted"), under_review: t("person.checkUnderReview", "Under review"), verified: t("person.checkVerified", "Verified"), expired: t("person.checkExpired", "Expired"), needs_renewal: t("person.checkRenewal", "Needs renewal") })[status];
}

function listText(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : typeof value === "string" && value.trim() ? [value.trim()] : [];
}
const recordValue = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const ageGroupLabels: Record<string, string> = {
  newborn: t("person.ageNewborn", "Newborn"), infant: t("person.ageInfant", "Infant"), toddler: t("person.ageToddler", "Toddler"), preschool: t("person.agePreschool", "Preschool"), school: t("person.ageSchool", "School age"),
};
const ageGroupLabel = (value: string): string => ageGroupLabels[value] ?? value;

function careTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    babysitter: t("person.careBabysitter", "Babysitting"),
    nanny: t("person.careNanny", "Nanny care"),
    au_pair: t("person.careAuPair", "Au pair"),
  };
  return labels[value] ?? value;
}

export default function PersonProfile({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const uid = params.uid;
  const careLinks = careSpaceUrls();
  const [view, setView] = useState<ViewState>({ person: null, checks: [], loading: true, error: "" });
  const [me, setMe] = useState<Person | null>(params.me ?? null);
  const [why, setWhy] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<Array<{ key: string; url: string | null }>>([]);
  const [primaryPhotoUrl, setPrimaryPhotoUrl] = useState<string | null>(null);
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
        setView({ person, checks, loading: false, error: "" });
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
  const galleryKeys = person ? listText(person.card.gallery).slice(0, 6) : [];
  const gallerySignature = galleryKeys.join("|");
  const mainPhotoIndex = typeof person?.card.mainPhotoIndex === "number" ? person.card.mainPhotoIndex : galleryKeys.length ? 0 : -1;
  const mainGalleryKey = mainPhotoIndex >= 0 ? galleryKeys[mainPhotoIndex] : undefined;
  const primaryPhotoKey = mainGalleryKey ?? (typeof person?.card.photoUrl === "string" ? person.card.photoUrl : typeof person?.photoUrl === "string" ? person.photoUrl : "");

  useEffect(() => {
    let live = true;
    setGalleryPhotos([]);
    setPrimaryPhotoUrl(null);
    void Promise.all(galleryKeys.map(async (key) => ({ key, url: await getPrivateMediaUrl(key) }))).then((photos) => { if (live) setGalleryPhotos(photos); });
    if (primaryPhotoKey.startsWith("http://") || primaryPhotoKey.startsWith("https://")) setPrimaryPhotoUrl(primaryPhotoKey);
    else if (primaryPhotoKey) void getPrivateMediaUrl(primaryPhotoKey).then((url) => { if (live) setPrimaryPhotoUrl(url); });
    return () => { live = false; };
  }, [uid, gallerySignature, primaryPhotoKey]);

  const mainGalleryUrl = mainGalleryKey ? galleryPhotos.find((photo) => photo.key === mainGalleryKey)?.url : null;
  const heroPhotoUrl = mainGalleryUrl ?? primaryPhotoUrl ?? (person?.photoUrl?.startsWith("http") ? person.photoUrl : null);
  const rateValue = person?.card.rate ?? person?.card.payFloor ?? person?.card.hourlyRate;
  const rate = Number(rateValue);
  const hasRate = rateValue !== null && rateValue !== undefined && rateValue !== "" && Number.isFinite(rate) && rate >= 0;
  const exampleCost = hasRate ? estimateCost("09:00", "12:00", rate) : null;
  const displayName = person?.firstName || person?.name || t("person.loadingName", "Carer profile");
  const availability = useMemo(() => person ? DAYS.map((day) => ({ day, value: availabilityFor(person, day) })) : [], [person]);
  const details: Array<{ label: string; value: string }> = [];
  if (person) {
    if (typeof person.card.suburb === "string" && person.card.suburb.trim()) details.push({ label: t("person.location", "Location"), value: person.card.suburb.trim() });
    const years = Number(person.card.experienceYears);
    if (Number.isFinite(years) && years >= 0) details.push({ label: t("person.experience", "Experience"), value: t(years === 1 ? "person.experienceOneYear" : "person.experienceYears", years === 1 ? "1 year" : "{count} years", { count: years }) });
    const languages = listText(person.card.languages);
    if (languages.length) details.push({ label: t("person.languages", "Languages"), value: languages.join(", ") });
    const careTypes = listText(person.card.careTypes).map(careTypeLabel);
    if (careTypes.length) details.push({ label: t("person.careTypes", "Care offered"), value: careTypes.join(", ") });
    const parentNames = listText(person.card.parentNames).slice(0, 4);
    if (parentNames.length) details.push({ label: t("person.parentNames", "Parent first names"), value: parentNames.join(", ") });
    const household = recordValue(person.card.householdPrefs);
    if (typeof household.pets === "boolean") details.push({ label: t("person.householdPets", "Pets"), value: household.pets ? t("person.petsAtHome", "Pets live in the home") : t("person.noPetsAtHome", "No pets in the home") });
    if (typeof household.smoking === "boolean") details.push({ label: t("person.householdSmoking", "Smoking"), value: household.smoking ? t("person.smokingAtHome", "Smoking in the home") : t("person.smokeFreeHome", "Smoke-free home") });
    const homeLanguages = listText(household.languagesAtHome);
    if (homeLanguages.length) details.push({ label: t("person.languagesAtHome", "Languages at home"), value: homeLanguages.join(", ") });
    if (typeof household.houseRules === "string" && household.houseRules.trim()) details.push({ label: t("person.houseRules", "House rules"), value: household.houseRules.trim() });
    const essentials = recordValue(person.card.essentials);
    if (typeof essentials.schedule === "string") details.push({ label: t("person.scheduleNeed", "Schedule"), value: essentials.schedule === "essential" ? t("person.essential", "Essential") : t("person.flexible", "Flexible") });
    if (typeof essentials.budget === "string") details.push({ label: t("person.budgetNeed", "Budget"), value: essentials.budget === "essential" ? t("person.essential", "Essential") : t("person.flexible", "Flexible") });
    if (typeof essentials.minAgeGroupsOk === "boolean") details.push({ label: t("person.ageGroupsNeed", "Age groups"), value: essentials.minAgeGroupsOk ? t("person.ageGroupsEssential", "Essential") : t("person.ageGroupsFlexible", "Flexible") });
    const ageGroups = listText(person.card.ageGroups).map(ageGroupLabel);
    if (ageGroups.length) details.push({ label: t("person.ageGroups", "Age groups accepted"), value: ageGroups.join(", ") });
    if (typeof person.card.idealFamily === "string" && person.card.idealFamily.trim()) details.push({ label: t("person.idealFamily", "Ideal family"), value: person.card.idealFamily.trim() });
  }
  const auPairRows: Array<{ label: string; value: string }> = [];
  const hostRows: Array<{ label: string; value: string }> = [];
  const hostDuties: string[] = [];
  const hostOtherHousework: string[] = [];
  if (person) {
    const pair = recordValue(person.card.auPair);
    const host = recordValue(person.card.auPairHost);
    const addTextRow = (rows: Array<{ label: string; value: string }>, label: string, value: unknown) => { if (typeof value === "string" && value.trim()) rows.push({ label, value: value.trim() }); };
    const addListRow = (rows: Array<{ label: string; value: string }>, label: string, value: unknown, map = (item: string) => item) => { const items = listText(value).map(map); if (items.length) rows.push({ label, value: items.join(", ") }); };
    const addBoolRow = (rows: Array<{ label: string; value: string }>, label: string, value: unknown) => { if (typeof value === "boolean") rows.push({ label, value: value ? t("person.yes", "Yes") : t("person.no", "No") }); };
    const addNumberRow = (rows: Array<{ label: string; value: string }>, label: string, value: unknown, unit: string) => { if (typeof value === "number" && Number.isFinite(value)) rows.push({ label, value: `${value} ${unit}` }); };
    addTextRow(auPairRows, t("person.auPairHomeCountry", "Home country"), pair.homeCountry);
    addTextRow(auPairRows, t("person.auPairArrival", "Preferred arrival"), pair.arrival);
    addNumberRow(auPairRows, t("person.auPairDuration", "Preferred stay"), pair.durationMonths, t("person.months", "months"));
    addListRow(auPairRows, t("person.auPairDestinations", "Countries of interest"), pair.destinations);
    addListRow(auPairRows, t("person.auPairLanguages", "Languages"), pair.languages);
    addListRow(auPairRows, t("person.auPairAges", "Preferred child age groups"), pair.ageGroups ?? pair.preferredAges, ageGroupLabel);
    addTextRow(auPairRows, t("person.auPairAccommodation", "Accommodation preference"), pair.accommodation);
    addTextRow(auPairRows, t("person.auPairPocketMoney", "Pocket money expectation"), pair.pocketMoneyExpectation);
    addListRow(auPairRows, t("person.auPairCulture", "Cultural interests"), pair.culturalInterests);
    addTextRow(auPairRows, t("person.auPairExpectations", "Ideal host family"), pair.expectations);
    addTextRow(auPairRows, t("person.auPairEnglish", "English level"), pair.english);
    addBoolRow(auPairRows, t("person.auPairInfant", "Infant-care experience"), pair.infant);
    addBoolRow(auPairRows, t("person.auPairDrives", "Can drive"), pair.drives);
    addBoolRow(auPairRows, t("person.auPairSwims", "Can swim"), pair.swim);
    addTextRow(auPairRows, t("person.auPairVisaNotes", "Visa notes, not an eligibility result"), pair.visaNotes);
    addTextRow(hostRows, t("person.hostCountry", "Host country"), host.country);
    addTextRow(hostRows, t("person.hostRoom", "Room offered"), host.room);
    addTextRow(hostRows, t("person.hostAccommodation", "Accommodation"), host.accommodation);
    addTextRow(hostRows, t("person.hostMeals", "Meals"), host.meals);
    addListRow(hostRows, t("person.hostDaysOff", "Usual days off"), host.daysOff);
    const hostLocation = recordValue(host.location);
    addTextRow(hostRows, t("person.hostLocation", "General location"), [hostLocation.suburb, hostLocation.city].filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(", "));
    addNumberRow(hostRows, t("person.hostDuration", "Intended stay"), host.durationMonths, t("person.months", "months"));
    addNumberRow(hostRows, t("person.hostPocketMoney", "Pocket money per week"), host.pocketMoneyPerWeek, t("person.audPerWeek", "A$ per week"));
    addNumberRow(hostRows, t("person.hostHours", "Care hours per week"), host.hoursPerWeek, t("person.hours", "hours"));
    addListRow(hostRows, t("person.hostLanguages", "Languages at home"), host.languages);
    addTextRow(hostRows, t("person.hostExpectations", "Family expectations"), host.expectations);
    addBoolRow(hostRows, t("person.hostVisaHelp", "Visa help offered"), host.visaHelp);
    addBoolRow(hostRows, t("person.hostVisaSupport", "Visa support offered"), host.visaSupport);
    addBoolRow(hostRows, t("person.hostInfantCare", "Infant care needed"), host.infantCareNeeded);
    hostDuties.push(...listText(host.childcareDuties));
    hostOtherHousework.push(...listText(host.otherHousework));
  }
  const verifiedCheck = view.checks.some((check) => check.status === "verified");

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
        <section className="booking-hero" aria-label={t("person.photoLabel", "Profile photo")}>{heroPhotoUrl ? <img src={heroPhotoUrl} alt={t("person.photoAlt", "Photo of {name}", { name: displayName })} /> : <div className="booking-hero-placeholder" aria-hidden="true">{person.firstName.slice(0, 1).toUpperCase()}</div>}<div className="booking-hero-shade" /><span className={`booking-status booking-hero-status${verifiedCheck ? " verified" : ""}`}>{verifiedCheck ? t("person.serverChecked", "Server checked") : t("person.noVerifiedChecks", "No verified checks")}</span><div className="booking-hero-copy"><h1>{displayName}</h1><p>{person.card.headline ? String(person.card.headline) : person.about ? String(person.about) : t("person.introMissing", "Introduction not shared yet.")}</p></div><div className="booking-hero-tools"><button className="booking-icon-button" onClick={() => void toggleSaved()} aria-pressed={saved} disabled={saving} aria-label={saved ? t("person.unsave", "Remove from Saved") : t("person.save", "Save profile")}>{saved ? `♥ ${t("person.saved", "Saved")}` : `♡ ${t("person.save", "Save")}`}</button></div></section>
        {galleryKeys.length > 0 && <section className="booking-card booking-section"><h2>{t("person.galleryTitle", "Profile photos")}</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>{galleryKeys.map((key, index) => { const url = galleryPhotos.find((photo) => photo.key === key)?.url; return <figure key={key} style={{ margin: 0, minWidth: 0 }}>
          {url ? <img src={url} alt={t("person.galleryPhotoAlt", "Profile photo {number}", { number: index + 1 })} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 18 }} /> : <div className="booking-note" role="status">{t("person.galleryUnavailable", "Photo preview is unavailable right now.")}</div>}
          {index === mainPhotoIndex && <figcaption className="booking-meta">{t("person.galleryMain", "Main photo")}</figcaption>}
        </figure>; })}</div></section>}
        {details.length > 0 && <section className="booking-card booking-section"><h2>{t("person.detailsTitle", "About {name}", { name: displayName })}</h2><dl className="booking-profile-details">{details.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="booking-meta">{t("person.locationPrivacy", "Only a general area is shown. Exact addresses stay private until a parent shares them.")}</p></section>}
        {auPairRows.length > 0 && <section className="booking-card booking-section"><h2>{t("person.auPairTitle", "Au pair profile")}</h2><dl className="booking-profile-details">{auPairRows.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="booking-meta">{t("person.auPairVisaCaution", "Visa notes do not confirm permission to work or join a program.")}</p></section>}
        {hostRows.length > 0 && <section className="booking-card booking-section"><h2>{t("person.hostTitle", "Host family offer")}</h2><dl className="booking-profile-details">{hostRows.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{hostDuties.length > 0 && <div><h3>{t("person.hostChildcareDuties", "Childcare duties")}</h3><ul style={{ margin: 0, paddingInlineStart: 22 }}>{hostDuties.map((duty, index) => <li key={`${index}-${duty}`}>{duty}</li>)}</ul></div>}{hostOtherHousework.length > 0 && <div><h3>{t("person.hostOtherHousework", "Other housework")}</h3><ul style={{ margin: 0, paddingInlineStart: 22 }}>{hostOtherHousework.map((task, index) => <li key={`${index}-${task}`}>{task}</li>)}</ul></div>}<p className="booking-meta">{t("person.hostDutiesCaution", "Childcare and unrelated housework are listed separately.")}</p></section>}
        {person.card.videoKey && <section className="booking-section booking-card"><h2>{t("person.videoTitle", "Video introduction")}</h2>{videoUrl ? <video className="booking-video" src={videoUrl} controls playsInline preload="metadata" aria-label={t("person.videoLabel", "Video introduction from {name}", { name: displayName })} /> : <p className="booking-note">{t("person.videoUnavailable", "Video not available yet")}</p>}</section>}
        <section className="booking-card booking-section"><h2>{t("person.whyTitle", "Why you match")}</h2>{why.length ? <ul style={{ margin: 0, paddingInlineStart: 22 }}>{why.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul> : <p className="booking-meta">{t("person.whyUnknown", "Not enough shared profile details yet.")}</p>}</section>
        <section className="booking-card booking-section"><div className="booking-between"><h2>{t("person.checksTitle", "Checks and dates")}</h2><span className="booking-status">{view.checks.some((check) => check.status === "verified") ? t("person.serverChecked", "Server checked") : t("person.noVerifiedChecks", "No verified checks")}</span></div>{view.checks.length ? <div className="booking-checklist">{view.checks.map((check) => <div className="booking-check" key={check.id}><div className="booking-between"><b>{check.label}</b><span className={`booking-status${check.status === "verified" ? " verified" : check.status === "submitted" || check.status === "under_review" ? " pending" : ""}`}>{checkLabel(check.status)}</span></div><p className="booking-meta">{check.checkedOn ? t("person.checkedOn", "Checked {date}", { date: check.checkedOn }) : t("person.noCheckDate", "Check date not recorded")}{check.verifiedBy ? ` · ${t("person.checkedBy", "checked by {name}", { name: check.verifiedBy })}` : ""}{check.expires ? ` · ${t("person.expires", "expires {date}", { date: check.expires })}` : ""}</p></div>)}</div> : <p className="booking-meta">{t("person.checksUnknown", "No check record was found. This profile is not shown as verified.")}</p>}</section>
        {person.side === "carer" && <ResumeView uid={person.uid} />}
        {person.side === "carer" && <ReviewsList carerUid={person.uid} viewerUid={me?.uid ?? auth().currentUser?.uid ?? ""} />}
        <section className="booking-card booking-section"><h2>{t("person.calendarTitle", "Availability")}</h2><div className="booking-day-grid" aria-label={t("person.calendarLabel", "Weekly availability calendar")}>{availability.map(({ day, value }) => <div className={`booking-day${value === true ? " available" : value === null ? " unknown" : ""}`} key={day}><span>{t(`day.${day.toLowerCase()}`, day)}</span><br /><span aria-label={value === true ? t("person.available", "Available") : value === false ? t("person.notListed", "Not listed") : t("person.notShared", "Not shared")}>{value === true ? "✓" : value === false ? "—" : "?"}</span></div>)}</div><p className="booking-meta">{t("person.calendarDisclaimer", "Shared days are not a promise. The carer still needs to accept a request.")}</p></section>
        <section className="booking-card booking-section"><h2>{t("person.rateTitle", "Rate and estimate")}</h2>{hasRate ? <><p><b>{money(rate)} {t("person.perHour", "per hour")}</b></p><p className="booking-meta">{exampleCost != null ? t("person.exampleCost", "Example: 3 hours would cost about {amount}.", { amount: money(exampleCost) }) : t("person.rateEstimate", "Choose a time to see your estimated cost.")}</p></> : <p className="booking-meta">{t("person.rateMissing", "Rate not listed. Message to ask before requesting a booking.")}</p>}</section>
        <section className="booking-note"><b>{t("person.manageTitle", "Already working together?")}</b><p>{t("person.manageBody", "Manage care updates in {app}.", { app: APP2 })}</p><button className="booking-quiet-link" onClick={() => openCareSpace()}>{t("person.openCareSpace", "Open {app}", { app: APP2 })}</button><div className="booking-links"><a className="booking-link" href={careLinks.universal}>{t("person.universalLink", "Open the web link")}</a><a className="booking-link" href={careLinks.custom}>{t("person.customLink", "Open with the app link")}</a><a className="booking-link" href={careLinks.appStore}>{t("person.appStoreFallback", "Find {app} in the App Store", { app: APP2 })}</a></div></section>
        {saveError && <p className="booking-error" role="alert">{saveError}</p>}
      </>}
    </div></div>
    {person && <div className="booking-bottom profile-bottom"><Button alt onClick={() => nav.push("chat", { uid: person.uid })}>{t("person.message", "Message")}</Button><Button onClick={() => nav.push("book", { uid: person.uid, rate: hasRate ? rate : undefined })} disabled={!hasRate}>{t("person.book", "Book")}</Button><Button alt onClick={() => nav.push("safety", { uid: person.uid })}>{t("person.reportBlock", "Report or block")}</Button></div>}
  </div>;
}
