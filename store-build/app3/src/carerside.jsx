// USAGE: <FamiliesForCarer me={me} people={families} prefs={prefs} radius={radius} onOpenPerson={openPerson} />.
import React, { useMemo } from "react";
import { Bunny } from "./bunny.jsx";
import { briefBreakdown } from "./match6.js";
import { scoreFit, scheduleScore, daysOf } from "../../www/app2/fit.js";
import { kmBetween } from "../../www/app2/browse.js";
import { t } from "./tr.js";
import "./carerside.css";

const norm = (value) => String(value ?? "").trim().toLowerCase();
const asList = (value) => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
const firstName = (person) => String(person?.firstName || person?.card?.firstName || person?.name || person?.displayName || t("carer.person", "Family")).trim().split(/\s+/)[0];
const number = (value) => {
  if (value == null || value === "") return null;
  const found = String(value).match(/-?\d+(?:\.\d+)?/);
  if (!found) return null;
  const parsed = Number(found[0]);
  return Number.isFinite(parsed) ? parsed : null;
};
const weekday = (value) => daysOf(value);
const dateLabel = (list) => list.length ? list.join(", ") : t("carer.notStated", "Not stated");

function familyForScoring(family) {
  const card = family?.card || {};
  const offer = number(card.maxBudget ?? card.budgetMax ?? card.payMax ?? card.payOffered);
  return { ...family, side: "family", card: { ...card, payOffered: offer ?? card.payOffered } };
}

function verifiedCheckRecords(profile, now = Date.now()) {
  const raw = profile?.raw || profile || {};
  const card = profile?.card || {};
  const records = [raw.checks, raw.documents, card.checks, card.documents, profile?.checks].flatMap((value) => Array.isArray(value) ? value : value && typeof value === "object" ? [value] : []);
  if (raw.checkedOn || raw.verifiedBy) records.push(raw);
  if (card.checkedOn || card.verifiedBy) records.push(card);
  return records.filter((record) => {
    if (!record || !(record.checkedOn || record.verifiedBy)) return false;
    const status = norm(record.status || record.state);
    if (status && status !== "verified") return false;
    const expires = record.expires ? Date.parse(record.expires) : NaN;
    return !Number.isFinite(expires) || expires >= now;
  }).map((record) => ({ ...record, label: record.label || record.name || record.kind || t("carer.verifiedCheck", "Verified check") }));
}

function scheduleStatus(carer, family) {
  const viewer = { side: "carer", card: carer?.card || {} };
  const other = { side: "family", card: family?.card || {} };
  const fit = scheduleScore(viewer, other);
  if (!fit.need.length) return { status: "unknown", text: t("carer.scheduleNotStated", "Not stated: family dates and times.") };
  if (!fit.can.length) return { status: "unknown", text: t("carer.availabilityNotStated", "Not stated: your availability.") };
  if (fit.s !== 1) return { status: "unmet", text: t("carer.scheduleUnmet", `Unmet: your availability covers ${fit.both.length} of ${fit.need.length} requested days.`) };
  const needMap = family?.card?.scheduleNeed || {};
  const canMap = carer?.card?.availability || {};
  const gaps = [];
  for (const day of fit.need) {
    const needed = needMap[day] ?? needMap[day.toLowerCase()];
    const available = canMap[day] ?? canMap[day.toLowerCase()];
    if (Array.isArray(needed) && Array.isArray(available)) {
      const have = new Set(available.map(norm));
      if (needed.some((slot) => !have.has(norm(slot)))) gaps.push(day);
    } else if (needed && typeof needed === "object" && available && typeof available === "object" && !Array.isArray(needed) && !Array.isArray(available)) {
      if (Object.entries(needed).some(([slot, value]) => Boolean(value) && !available[slot])) gaps.push(day);
    }
  }
  return gaps.length ? { status: "unmet", text: t("carer.timeUnmet", `Unmet: requested times are not listed for ${gaps.join(", ")}.`) } : { status: "met", text: t("carer.scheduleMet", `Your availability covers ${fit.need.join(", ")}.`) };
}

function ageStatus(carer, family) {
  const children = asList(family?.card?.childrenBands).map(norm).filter(Boolean);
  const accepted = asList(carer?.card?.agesAccepted).map(norm).filter(Boolean);
  if (!children.length || !accepted.length) return { status: "unknown", text: t("carer.agesNotStated", "Not stated: child ages or ages you accept.") };
  if (accepted.some((age) => ["all", "all ages", "any", "any age"].includes(age))) return { status: "met", text: t("carer.agesMet", "Your accepted ages include these children.") };
  const missed = children.filter((age) => !accepted.includes(age));
  return missed.length ? { status: "unmet", text: t("carer.agesUnmet", `Unmet: you do not list ${missed.join(", ")}.`) } : { status: "met", text: t("carer.agesMet", "Your accepted ages include these children.") };
}

function checksStatus(carer, family, now) {
  const card = family?.card || {};
  const requirements = asList(card.requiredChecks ?? card.checksRequired ?? family?.requiredChecks ?? family?.checksRequired).map((item) => typeof item === "string" ? item : item?.label || item?.name || item?.kind || "").filter(Boolean);
  if (!requirements.length) return { status: "unknown", text: t("carer.checksNotStated", "Not stated: checks the family requires.") };
  const verified = verifiedCheckRecords(carer, now);
  const labels = verified.map((record) => norm(record.label || record.name || record.kind));
  const generic = verified.some((record) => !(record.label || record.name || record.kind));
  const missing = requirements.filter((required) => {
    const wanted = norm(required);
    if (!wanted || wanted === "background check" || wanted === "required check") return !verified.length;
    return !labels.some((label) => label.includes(wanted) || wanted.includes(label)) && !generic;
  });
  return missing.length ? { status: "unmet", text: t("carer.checksUnmet", `Unmet: verified ${missing.join(", ")} not stated.`) } : { status: "met", text: t("carer.checksMet", `Your verified checks meet the family's stated needs.`) };
}

function budgetStatus(carer, family) {
  const card = family?.card || {};
  const max = number(card.maxBudget ?? card.budgetMax ?? card.payMax ?? card.payOffered ?? family?.maxBudget ?? family?.budgetMax);
  const rate = number(carer?.card?.payFloor ?? carer?.card?.minimumRate ?? carer?.card?.rate ?? carer?.card?.hourlyRate);
  if (max == null) return { status: "unknown", text: t("carer.budgetNotStated", "Not stated: family's maximum budget.") };
  if (rate == null) return { status: "unknown", text: t("carer.rateNotStated", "Not stated: your minimum rate.") };
  return rate <= max ? { status: "met", text: t("carer.budgetMet", `Your $${rate}/hr rate is within the $${max}/hr maximum.`) } : { status: "unmet", text: t("carer.budgetUnmet", `Unmet: your $${rate}/hr minimum is above the $${max}/hr maximum.`) };
}

export function evaluateFamilyEssentials(carer, family, now = Date.now()) {
  return [
    { id: "date-time", label: t("carer.dateTime", "Date and time"), ...scheduleStatus(carer, family) },
    { id: "checks", label: t("carer.requiredChecks", "Required checks"), ...checksStatus(carer, family, now) },
    { id: "ages", label: t("carer.ages", "Accepted ages"), ...ageStatus(carer, family) },
    { id: "budget", label: t("carer.maxBudget", "Maximum budget"), ...budgetStatus(carer, family) },
  ];
}

function whySentences(carer, family, km, radius, breakdown, fit) {
  const sentences = [];
  const rows = Object.fromEntries(breakdown.rows.map((row) => [row.id, row]));
  const schedule = scheduleScore({ side: "carer", card: carer?.card || {} }, { side: "family", card: family?.card || {} });
  const budget = rows.budget?.s;
  const distance = rows.location?.s;
  const style = rows.personality?.s;
  sentences.push(budget == null ? t("carer.whyBudgetUnknown", "Pay: Not stated.") : budget >= 0.8 ? t("carer.whyBudgetFit", "Your rate fits the family's offer.") : t("carer.whyBudgetGap", "The family's offer may be below your rate."));
  sentences.push(schedule.s == null ? t("carer.whyScheduleUnknown", "Schedule: Not stated.") : schedule.s === 1 ? t("carer.whyScheduleFit", `Your days cover ${schedule.need.join(", ")}.`) : t("carer.whyScheduleGap", `Your days cover ${schedule.both.join(", ")} of ${schedule.need.length} requested days.`));
  sentences.push(distance == null || km == null ? t("carer.whyLocationUnknown", "Distance: Not stated.") : radius === 0 ? t("carer.whyLocationAny", `Family is ${km} km away.`) : km <= (radius || 25) ? t("carer.whyLocationFit", `Family is ${km} km away, within your area.`) : t("carer.whyLocationGap", `Family is ${km} km away, outside your area.`));
  sentences.push(style == null ? t("carer.whyStyleUnknown", "Care style: Not stated.") : style > 0 ? t("carer.whyStyleFit", "Your care styles have shared points.") : t("carer.whyStyleGap", "Your listed care styles do not overlap."));
  if (rows.experience?.s != null) sentences.push(t("carer.whyExperience", "Experience is listed on both profiles."));
  else sentences.push(t("carer.whyExperienceUnknown", "Experience: Not stated."));
  if (rows.activities?.s != null) sentences.push(t("carer.whyActivities", "Some listed activities overlap."));
  else sentences.push(t("carer.whyActivitiesUnknown", "Activities: Not stated."));
  if (fit?.reasons?.length) sentences.push(...fit.reasons.slice(0, 2).map((reason) => t("carer.why.scoreReason", reason.text.endsWith(".") ? reason.text : `${reason.text}.`)));
  return [...new Set(sentences)];
}

function FamilyCard({ carer, family, prefs, radius, onOpenPerson }) {
  const km = family?.km ?? kmBetween(carer?.card, family?.card);
  const viewer = { ...carer, side: "carer", card: carer?.card || {} };
  const other = familyForScoring(family);
  const fit = scoreFit({ viewer, other, prefs, radiusKm: radius || 25, km });
  const breakdown = briefBreakdown({ viewer, other, km, radius });
  const pct = breakdown.pct ?? fit.pct;
  const essentials = evaluateFamilyEssentials(carer, family);
  const openItems = essentials.filter((item) => item.status !== "met");
  const name = firstName(family);
  const rate = number(family?.card?.maxBudget ?? family?.card?.budgetMax ?? family?.card?.payMax ?? family?.card?.payOffered);
  const days = weekday(family?.card?.scheduleNeed);
  const why = whySentences(carer, family, km, radius, breakdown, fit);
  return <article className="cs-family-card">
    <div className="cs-card-top">
      <button className="cs-person" type="button" onClick={() => onOpenPerson?.(family)}>
        <span className="cs-avatar">{family?.photoUrl ? <img src={family.photoUrl} alt="" loading="lazy" /> : name.slice(0, 1).toUpperCase()}</span>
        <span className="cs-person-copy"><strong>{name}</strong><span>{km == null ? t("carer.distanceUnknown", "Distance: Not stated") : t("carer.distanceValue", `${km} ${t("carer.km", "km")}`)}</span></span>
      </button>
      <span className="cs-score" aria-label={t("carer.matchScore", `${pct}% match`)}>{pct}%</span>
    </div>
    <div className="cs-family-facts"><p><strong>{t("carer.maxBudget", "Maximum budget")}:</strong> {rate == null ? t("carer.notStated", "Not stated") : t("carer.hourlyRate", `$${rate}/${t("carer.hour", "hr")}`)}</p><p><strong>{t("carer.schedule", "Schedule")}:</strong> {dateLabel(days)}</p></div>
    <h3>{t("carer.whyTitle", "Why this match")}</h3>
    <ul className="cs-why">{why.map((sentence, index) => <li key={`${index}-${sentence}`}>{sentence}</li>)}</ul>
    <div className="cs-essentials"><h3>{t("carer.unmetTitle", "Unmet essentials")}</h3>{openItems.length ? <ul>{openItems.map((item) => <li key={item.id}><strong>{item.status === "unmet" ? t("carer.unmet", "Unmet") : t("carer.notStated", "Not stated")} — {item.label}:</strong> {item.text.replace(/^(Unmet: |Not stated: )/, "")}</li>)}</ul> : <p>{t("carer.noUnmet", "No unmet essentials stated.")}</p>}</div>
  </article>;
}

export function FamiliesForCarer({ me, people = [], prefs = {}, radius = 25, onOpenPerson }) {
  const families = useMemo(() => people.map((family) => {
    const km = family?.km ?? kmBetween(me?.card, family?.card);
    const other = familyForScoring(family);
    const viewer = { ...me, side: "carer", card: me?.card || {} };
    const fit = scoreFit({ viewer, other, prefs, radiusKm: radius || 25, km });
    const breakdown = briefBreakdown({ viewer, other, km, radius });
    return { family, km, pct: breakdown.pct ?? fit.pct };
  }).sort((a, b) => b.pct - a.pct).map(({ family, km }) => ({ ...family, km })), [me, people, prefs, radius]);
  return <main className="cs-families">
    <header className="cs-heading"><p>{t("carer.eyebrow", "Work that fits")}</p><h1>{t("carer.familiesTitle", "Families for you")}</h1><span>{t("carer.freeMessage", "Carers never pay.")}</span></header>
    {families.length ? <div className="cs-list">{families.map((family) => <FamilyCard key={family.uid} carer={me} family={family} prefs={prefs} radius={radius} onOpenPerson={onOpenPerson} />)}</div> : <div className="cs-empty"><Bunny mood="encourage" size={72} /><p>{t("carer.emptyFamilies", "Families will show here when their needs are shared.")}</p></div>}
  </main>;
}
