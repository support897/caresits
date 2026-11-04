// USAGE: <Discover2 me={me} people={people} rels={rels} prefs={prefs} setPrefs={setPrefs} radius={radius} setRadius={setRadius} saved={saved} onToggleSave={toggleSave} onOpenPerson={openPerson} />
import React, { useMemo, useState } from "react";
import { Bunny } from "./bunny.jsx";
import * as D from "./data.js";
import { PRIORITIES, cyclePriority, daysOf } from "../../www/app2/fit.js";
import { t } from "./tr.js";
import "./discover2.css";

const DAY_NAMES = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const firstName = (person) => String(person?.firstName || person?.card?.firstName || person?.name || person?.displayName || t("discover.person", "Person")).trim().split(/\s+/)[0];
const sourceRecords = (person) => {
  const raw = person?.raw || person || {};
  const card = person?.card || {};
  const entries = [raw.checks, raw.documents, card.checks, card.documents, person?.checks].flatMap((value) => Array.isArray(value) ? value : value && typeof value === "object" ? [value] : []);
  if (raw.checkedOn || raw.verifiedBy) entries.push(raw);
  if (card.checkedOn || card.verifiedBy) entries.push(card);
  return entries;
};
const isCurrentVerifiedCheck = (record) => {
  if (!record || !(record.checkedOn || record.verifiedBy)) return false;
  const status = String(record.status || record.state || "").trim().toLowerCase();
  if (status && status !== "verified") return false;
  const expires = record.expires ? Date.parse(record.expires) : NaN;
  return !Number.isFinite(expires) || expires >= Date.now();
};
const verifiedChecks = (person) => {
  const seen = new Set();
  return sourceRecords(person).filter(isCurrentVerifiedCheck).filter((record) => {
    const label = String(record.label || record.name || record.kind || t("discover.verifiedCheck", "Verified check")).trim().toLowerCase();
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
};
const dateValue = (value) => {
  if (value && typeof value.toDate === "function") return value.toDate().getTime();
  if (value && Number.isFinite(value.seconds)) return value.seconds * 1000;
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
};
const profileDate = (person, keys) => {
  const raw = person?.raw || person || {};
  const card = person?.card || {};
  for (const key of keys) {
    const value = raw[key] || card[key] || person?.[key];
    const parsed = dateValue(value);
    if (parsed != null) return parsed;
  }
  return null;
};
const displayRate = (person) => {
  const card = person?.card || {};
  const raw = person?.raw || {};
  const amount = Number(card.payFloor ?? card.rate ?? card.hourlyRate ?? card.payOffered ?? raw.payFloor ?? raw.rate);
  return Number.isFinite(amount) && amount > 0 ? t("discover.hourlyRate", `$${amount}/hr`) : t("discover.notStated", "Not stated");
};
const displayRating = (person) => {
  const card = person?.card || {};
  const raw = person?.raw || {};
  const rating = Number(person?.rating ?? person?.avgStars ?? card.rating ?? card.avgStars ?? raw.rating ?? raw.avgStars);
  return Number.isFinite(rating) && rating > 0 ? `${rating.toFixed(1)} / 5` : t("discover.notStated", "Not stated");
};
const displayDistance = (person) => person?.km == null ? t("discover.notStated", "Not stated") : person.km < 1 ? t("discover.underOneKm", "Under 1 km") : `${Math.round(person.km)} ${t("discover.km", "km")}`;
const displayAvailability = (person) => {
  const card = person?.card || {};
  const days = daysOf(card.availability || card.scheduleNeed);
  return days.length ? days.map((day) => t(`discover.day.${day.toLowerCase()}`, DAY_NAMES[day] || day)).join(", ") : t("discover.notStated", "Not stated");
};
const withinRadius = (person, radius) => !radius || person.km == null || person.km <= radius;
const isNewVerified = (person, now) => {
  const created = profileDate(person, ["createdAt", "joinedAt", "createdOn"]);
  return verifiedChecks(person).some((record) => {
    const checked = dateValue(record.checkedOn) ?? created;
    return checked != null && checked <= now && now - checked <= 30 * 864e5;
  });
};
const activityTime = (person) => {
  const raw = person?.raw || person || {};
  return dateValue(raw.updatedAt || raw.lastActive);
};
const savedId = (entry) => typeof entry === "string" ? entry : entry?.uid || entry?.id;

function EmptySection({ message }) {
  return <div className="d2-empty"><Bunny mood="encourage" size={56} /><p>{message}</p></div>;
}

function PersonCard({ person, saved, onToggleSave, onOpenPerson }) {
  const checks = verifiedChecks(person);
  const name = firstName(person);
  const card = person?.card || {};
  const checkLabels = checks.map((check) => check.label || check.name || check.kind || t("discover.verifiedCheck", "Verified check"));
  const days = displayAvailability(person);
  return <article className="d2-card">
    <button className="d2-open" type="button" onClick={() => onOpenPerson?.(person)} aria-label={t("discover.openPerson", `Open ${name}'s profile`)}>
      <div className="d2-photo">{person?.photoUrl ? <img src={person.photoUrl} alt="" loading="lazy" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}</div>
      <div className="d2-card-body">
        <div className="d2-name-row"><h3>{name}</h3><span className="d2-distance">{displayDistance(person)}</span></div>
        <dl className="d2-facts">
          <div><dt>{t("discover.rate", "Rate")}</dt><dd>{displayRate(person)}</dd></div>
          <div><dt>{t("discover.rating", "Rating")}</dt><dd>{displayRating(person)}</dd></div>
        </dl>
        <div className="d2-badges" aria-label={t("discover.checks", "Checks")}>
          {checkLabels.length ? checkLabels.map((label, index) => <span className="d2-badge verified" key={`${label}-${index}`}>{label}</span>) : <span className="d2-badge unknown">{t("discover.checksNotStated", "Checks not stated")}</span>}
        </div>
        <p className="d2-availability"><strong>{t("discover.availability", "Availability")}</strong> {days}</p>
      </div>
    </button>
    <button className={`d2-save${saved ? " is-saved" : ""}`} type="button" aria-pressed={saved} aria-label={saved ? t("discover.removeSaved", `Remove ${name} from saved`) : t("discover.save", `Save ${name}`)} onClick={(event) => { event.stopPropagation(); onToggleSave?.(person); }}>{saved ? t("discover.saved", "Saved") : t("discover.saveShort", "Save")}</button>
  </article>;
}

function MatchPrefs({ me, prefs, setPrefs }) {
  const [open, setOpen] = useState(false);
  const priorities = PRIORITIES[me?.side === "carer" ? "carer" : "family"] || [];
  return <div className="d2-preferences">
    <button type="button" className="d2-filter-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? t("discover.closePreferences", "Close match preferences") : t("discover.matchPreferences", "Match preferences")}</button>
    {open && <div className="d2-pref-list">{priorities.map((item) => {
      const level = prefs?.levels?.[item.id];
      return <button type="button" key={item.id} className={`d2-pref${level ? ` level-${level}` : ""}`} onClick={() => setPrefs?.({ ...prefs, levels: cyclePriority(prefs?.levels || {}, item.id) })}>{t(`discover.priority.${item.id}`, item.label)}{level ? ` · ${t(`discover.level.${level}`, level)}` : ""}</button>;
    })}</div>}
  </div>;
}

export function Discover2({ me, people = [], rels = [], prefs = {}, setPrefs, radius = 25, setRadius, saved = [], onToggleSave, onOpenPerson }) {
  const ranked = useMemo(() => D.rank(me, people, prefs, radius).filter((person) => withinRadius(person, radius)), [me, people, prefs, radius]);
  const now = Date.now();
  const savedIds = useMemo(() => new Set((Array.isArray(saved) ? saved : []).map(savedId)), [saved]);
  const knownActivity = ranked.some((person) => activityTime(person) != null);
  const sections = [
    { id: "best", title: t("discover.bestMatches", "Best matches"), people: ranked, empty: t("discover.emptyBest", "New profiles will show here when they match your needs.") },
    { id: "week", title: t("discover.availableWeek", "Available this week"), people: ranked.filter((person) => daysOf(person.card?.availability).length > 0), empty: t("discover.emptyWeek", "No one has shared availability this week.") },
    { id: "new", title: t("discover.newVerified", "New verified"), people: ranked.filter((person) => isNewVerified(person, now)), empty: t("discover.emptyNewVerified", "New checked profiles will show here after a real check.") },
    ...(knownActivity ? [{ id: "active", title: t("discover.recentlyActive", "Recently active"), people: ranked.filter((person) => { const at = activityTime(person); return at != null && at <= now && now - at <= 14 * 864e5; }).sort((a, b) => activityTime(b) - activityTime(a)), empty: t("discover.emptyActive", "No one was active in the last 14 days.") }] : []),
    { id: "saved", title: t("discover.saved", "Saved"), people: ranked.filter((person) => savedIds.has(person.uid)), empty: t("discover.emptySaved", "Save a profile to see it here.") },
  ];
  const radiusOptions = [5, 10, 15, 25, 50, 100, 200, 0];
  return <main className="d2-page">
    <header className="d2-header">
      <div><p className="d2-kicker">{t("discover.eyebrow", "Find a good fit")}</p><h1>{t("discover.title", "Discover")}</h1></div>
      <label className="d2-radius"><span>{t("discover.distance", "Distance")}</span><select value={radius || 0} aria-label={t("discover.distance", "Distance")} onChange={(event) => setRadius?.(Number(event.target.value))}>{radiusOptions.map((value) => <option key={value} value={value}>{value ? `${value} ${t("discover.km", "km")}` : t("discover.anywhere", "Anywhere")}</option>)}</select></label>
    </header>
    <MatchPrefs me={me} prefs={prefs} setPrefs={setPrefs} />
    {sections.map((section) => <section className="d2-section" key={section.id} aria-labelledby={`d2-${section.id}`}>
      <div className="d2-section-head"><h2 id={`d2-${section.id}`}>{section.title}</h2><span>{section.people.length}</span></div>
      {section.people.length ? <div className="d2-row" role="list">{section.people.map((person) => <div role="listitem" key={person.uid}><PersonCard person={person} saved={savedIds.has(person.uid)} onToggleSave={onToggleSave} onOpenPerson={onOpenPerson} /></div>)}</div> : <EmptySection message={section.empty} />}
    </section>)}
  </main>;
}
