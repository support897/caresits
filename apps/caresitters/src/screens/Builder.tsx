import { useEffect, useMemo, useState } from "react";
import { auth, Button, Chip, loadProfile, Ring, saveProfile, t, useNav, type Person, type ScreenProps } from "@cc/core";
import { extractPrefs, suggestIntro, type ExtractedPrefs } from "../lib/aiAssist";
import { buildProfilePatch, CARER_STEP_KEYS, clearOnboardingDraft, createOnboardingDraft, FAMILY_STEP_KEYS, loadOnboardingDraft, loadOnboardingSide, progressPercent, saveOnboardingDraft, type OnboardingDraft, type OnboardingSide } from "../data/onboarding";
import { ChoiceCards, type Choice } from "./builder/ChoiceCards";
import { PhotoStep } from "./builder/PhotoStep";
import { VideoStep } from "./builder/VideoStep";
import { QualificationsStep } from "./builder/QualificationsStep";
import "./builder/builder.css";

type BuilderParams = { onDone?: () => void; edit?: boolean; side?: OnboardingSide };
type Loose = Record<string, unknown>;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CARE_TYPES: Choice[] = [
  { value: "babysitter", label: "Babysitter", detail: "Occasional or short-term care" },
  { value: "nanny", label: "Nanny", detail: "Regular care at home" },
  { value: "au_pair", label: "Au pair", detail: "Live-in cultural exchange" },
];
const STYLE = ["Montessori", "gentle parenting", "calm routines", "child-led play", "structured routines"];
const ACTIVITIES = ["outdoor play", "reading", "arts and crafts", "cooking", "music", "nature walks", "park visits"];
const LANGUAGES = ["English", "Spanish", "Mandarin", "Cantonese", "Hindi", "Vietnamese", "Arabic"];
const AMOUNTS = [20, 25, 30, 35, 40, 45, 50, 60];
const DISTANCES = [2, 5, 10, 20, 30, 50];
const YEARS = [0, 1, 2, 3, 5, 8, 10, 15];
const dayChoices = (): Choice[] => DAYS.map((day) => ({ value: day, label: t(`onb.day.${day.toLowerCase()}`, day) }));
const careChoices = () => CARE_TYPES.map((choice) => ({ ...choice, label: t(`onb.care.${choice.value}`, choice.label), detail: t(`onb.care.${choice.value}.detail`, choice.detail ?? "") }));
const asRecord = (value: unknown): Loose => value !== null && typeof value === "object" ? value as Loose : {};
const asString = (value: unknown): string => typeof value === "string" ? value : "";
const asList = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const timeFor = (schedule: unknown, side: OnboardingSide, kind: "from" | "to"): string => {
  const map = asRecord(schedule);
  for (const value of Object.values(map)) {
    const row = asRecord(value);
    const candidate = row[kind] ?? row[kind === "from" ? "start" : "end"];
    if (typeof candidate === "string") return candidate;
  }
  return side === "family" ? "" : "";
};
function daysFrom(value: unknown): string[] {
  const map = asRecord(value);
  return DAYS.filter((day) => {
    const entry = map[day];
    return entry === true || (entry !== null && typeof entry === "object" && Object.keys(asRecord(entry)).length > 0);
  });
}
function profileDraft(profile: Person, side: OnboardingSide): OnboardingDraft {
  const card = asRecord(profile.card);
  const alternative = asRecord(card.alsoSide);
  const source = side === profile.side ? card : alternative;
  const children = Array.isArray(source.kids) ? source.kids.map((item) => {
    const child = asRecord(item);
    return { name: asString(child.name).split(/\s+/)[0] ?? "", ageYears: child.ageYears == null ? "" : String(child.ageYears) };
  }) : [];
  const sourceSchedule = side === "family" ? source.scheduleNeed : source.availability;
  const careTypes = asList(source.careTypes);
  return {
    ...createOnboardingDraft(),
    displayName: profile.name,
    postcode: profile.postcode ?? "",
    suburb: asString(source.suburb) || (side === profile.side ? "" : asString(alternative.suburb)),
    kids: children.length ? children : [{ name: "", ageYears: "" }],
    familyCareTypes: side === "family" ? careTypes : [],
    carerCareTypes: side === "carer" ? careTypes : [],
    familyDays: side === "family" ? daysFrom(sourceSchedule) : [],
    familyFrom: side === "family" ? timeFor(sourceSchedule, side, "from") : "",
    familyTo: side === "family" ? timeFor(sourceSchedule, side, "to") : "",
    budgetMax: Number(source.budgetMax) || 30,
    distanceKm: Number(source.maxDistanceKm) || 10,
    style: asList(source.style),
    activities: asList(source.activities),
    familyLanguages: side === "family" ? asList(source.languages) : [],
    photoKey: asString(side === profile.side ? profile.photoUrl : source.photoUrl),
    headline: asString(source.headline),
    intro: asString(source.about) || (side === profile.side ? profile.about ?? "" : ""),
    videoKey: asString(source.videoKey),
    languages: side === "carer" ? asList(source.languages) : [],
    experienceYears: source.experienceYears == null ? "" : String(source.experienceYears),
    rate: Number(source.rate) || 30,
    carerDays: side === "carer" ? daysFrom(sourceSchedule) : [],
    carerFrom: side === "carer" ? timeFor(sourceSchedule, side, "from") : "",
    carerTo: side === "carer" ? timeFor(sourceSchedule, side, "to") : "",
  };
}
function initialSide(requested?: OnboardingSide): OnboardingSide {
  if (requested) return requested;
  try { return localStorage.getItem("caresits-side") === "carer" ? "carer" : "family"; } catch { return "family"; }
}

export default function Builder({ params }: ScreenProps) {
  const { onDone, edit = false, side: requestedSide } = params as BuilderParams;
  const nav = useNav();
  const [uid, setUid] = useState(() => auth().currentUser?.uid ?? "");
  const [profile, setProfile] = useState<Person | null>(null);
  const [side, setSide] = useState<OnboardingSide>(() => initialSide(requestedSide));
  const [draft, setDraft] = useState<OnboardingDraft>(() => createOnboardingDraft());
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [introSuggestion, setIntroSuggestion] = useState("");
  const [prefSuggestion, setPrefSuggestion] = useState<ExtractedPrefs | null>(null);
  const steps = side === "family" ? FAMILY_STEP_KEYS : CARER_STEP_KEYS;
  const progress = progressPercent(step, steps.length);
  const stepName = steps[step] ?? steps[0];
  const isSecondary = Boolean(profile && side !== profile.side);

  useEffect(() => {
    let live = true;
    const user = auth().currentUser;
    if (!user) { setError(t("onb.signinRequired", "Sign in to save your profile.")); setReady(true); return; }
    setUid(user.uid);
    void loadProfile(user.uid).then((loaded) => {
      if (!live) return;
      setProfile(loaded);
      const chosenSide = edit && loaded ? loadOnboardingSide(user.uid) ?? loaded.side : initialSide(requestedSide);
      setSide(chosenSide);
      const saved = loadOnboardingDraft(user.uid, chosenSide);
      setDraft(saved?.draft ?? (loaded ? profileDraft(loaded, chosenSide) : createOnboardingDraft()));
      setStep(Math.min(saved?.stepIndex ?? 0, (chosenSide === "family" ? FAMILY_STEP_KEYS.length : CARER_STEP_KEYS.length) - 1));
      setReady(true);
    }).catch(() => { if (live) { setError(t("onb.loadError", "Could not load your profile. Try again.")); setReady(true); } });
    return () => { live = false; };
  }, [edit, requestedSide]);

  useEffect(() => {
    if (uid && ready) saveOnboardingDraft(uid, side, draft, step);
  }, [uid, side, draft, step, ready]);

  const update = (patch: Partial<OnboardingDraft>) => { setError(""); setDraft((current) => ({ ...current, ...patch })); };
  const title = useMemo(() => {
    const key = `onb.step.${side}.${stepName}`;
    const labels: Record<string, string> = {
      family: "Your family", children: "Children", "care-type": "Care type", schedule: "Your schedule", budget: "Your budget", distance: "How far to look", values: "What matters to you?",
      photo: "Your photo", headline: "Your headline", intro: "A short introduction", video: "Video introduction", languages: "Languages", experience: "Childcare years", qualifications: "Qualifications", rate: "Your hourly rate", availability: "When you are free", "care-types": "Care you offer",
    };
    return t(key, labels[stepName] ?? "Your profile");
  }, [side, stepName]);

  function validate(): string {
    if (side === "family" && stepName === "family" && (!draft.displayName.trim() || (!draft.postcode.trim() && !draft.suburb.trim()))) return t("onb.family.required", "Add your name and a postcode or suburb to continue.");
    if (side === "family" && stepName === "children" && draft.kids.some((kid) => kid.name.trim() && (!kid.ageYears || !Number.isFinite(Number(kid.ageYears))))) return t("onb.child.required", "Add an age for each child, or remove that child.");
    if (side === "family" && stepName === "care-type" && !draft.familyCareTypes.length) return t("onb.care.required", "Choose at least one care type.");
    if (side === "carer" && stepName === "headline" && !draft.headline.trim()) return t("onb.headline.required", "Add a short headline to continue.");
    if (side === "carer" && stepName === "care-types" && !draft.carerCareTypes.length) return t("onb.carerCare.required", "Choose at least one kind of care.");
    return "";
  }

  async function persist(): Promise<void> {
    if (!uid) throw new Error(t("onb.signinRequired", "Sign in to save your profile."));
    const patch = buildProfilePatch(side, draft, profile?.side);
    await saveProfile(uid, patch);
    setProfile((current) => current ?? ({ uid, side, name: draft.displayName.trim() || "Member", firstName: draft.displayName.trim().split(/\s+/)[0] || "Member", postcode: draft.postcode.trim(), photoUrl: draft.photoKey || undefined, about: draft.intro.slice(0, 300), card: patch.card, looking: {}, raw: {} } as Person));
  }

  async function advance() {
    const issue = validate();
    if (issue) { setError(issue); return; }
    setError(""); setBusy(true);
    try {
      // The first step stays on this device. After step two, a partial cloud profile is safe to save.
      if (profile || step >= 1 || step === steps.length - 1) await persist();
      if (step < steps.length - 1) setStep((current) => current + 1);
      else {
        clearOnboardingDraft(uid, side);
        if (onDone) onDone(); else nav.back();
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("onb.saveError", "Could not save this step. Try again.")); }
    finally { setBusy(false); }
  }

  function goBack() { if (step > 0) setStep((current) => current - 1); else if (edit) nav.back(); }
  function switchRole() {
    if (!profile || !uid) return;
    saveOnboardingDraft(uid, side, draft, step);
    const nextSide: OnboardingSide = side === "family" ? "carer" : "family";
    const saved = loadOnboardingDraft(uid, nextSide);
    setSide(nextSide);
    setDraft(saved?.draft ?? profileDraft(profile, nextSide));
    setStep(saved?.stepIndex ?? 0);
    setError("");
  }

  function toggleList(key: "style" | "activities" | "familyLanguages" | "languages", item: string) {
    const current = draft[key];
    update({ [key]: current.includes(item) ? current.filter((value) => value !== item) : [...current, item] } as Partial<OnboardingDraft>);
  }
  function requestIntroSuggestion() {
    const suggestion = suggestIntro({ languages: draft.languages, experienceYears: draft.experienceYears, careTypes: draft.carerCareTypes, style: draft.style });
    setError(suggestion ? "" : t("onb.ai.noFacts", "Add languages, years, care types, or care style before making a suggestion."));
    setIntroSuggestion(suggestion);
  }
  function renderIntroSuggestion() {
    if (!introSuggestion) return null;
    return <div className="onb-prompt"><p className="onb-suggest-label">{t("onb.ai.suggested", "Suggested - edit before saving")}</p><textarea className="field" maxLength={300} value={introSuggestion} onChange={(event) => setIntroSuggestion(event.target.value)} aria-label={t("onb.ai.editSuggestion", "Edit suggested introduction before saving")} /><div className="row"><Button type="button" alt small onClick={() => setIntroSuggestion("")}>{t("onb.ai.discard", "Discard")}</Button><Button type="button" small onClick={() => { update({ intro: introSuggestion.slice(0, 300) }); setIntroSuggestion(""); }}>{t("onb.ai.confirm", "Confirm")}</Button></div></div>;
  }

  function renderStep() {
    if (side === "family") {
      switch (stepName) {
        case "family": return <div className="onb-field-stack">
          <label className="onb-label" htmlFor="onb-family-name">{t("onb.family.name", "Your name")}</label>
          <input id="onb-family-name" className="field" autoComplete="name" maxLength={80} value={draft.displayName} onChange={(event) => update({ displayName: event.target.value })} placeholder={t("onb.family.namePlaceholder", "First name or family name")} />
          <div className="onb-row"><label className="onb-field-stack"><span className="onb-label">{t("onb.family.suburb", "Suburb")}</span><input className="field" autoComplete="address-level2" maxLength={80} value={draft.suburb} onChange={(event) => update({ suburb: event.target.value })} placeholder={t("onb.family.suburbPlaceholder", "For example, New Farm")} /></label><label className="onb-field-stack"><span className="onb-label">{t("onb.family.postcode", "Postcode")}</span><input className="field" inputMode="numeric" autoComplete="postal-code" maxLength={10} value={draft.postcode} onChange={(event) => update({ postcode: event.target.value })} placeholder={t("onb.family.postcodePlaceholder", "4005")} /></label></div>
          <p className="onb-privacy">{t("onb.family.privacy", "Exact address and child photos stay private until the parent shares.")}</p>
        </div>;
        case "children": return <div className="onb-field-stack">
          <p className="muted onb-note">{t("onb.children.help", "Use a first name or nickname. Add only the age. You can add or remove children any time.")}</p>
          <p className="onb-privacy">{t("onb.family.privacy", "Exact address and child photos stay private until the parent shares.")}</p>
          {draft.kids.map((kid, index) => <div className="onb-kid" key={index}>
            <input className="field" aria-label={t("onb.children.nameLabel", "Child first name or nickname")} maxLength={40} value={kid.name} onChange={(event) => update({ kids: draft.kids.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row) })} placeholder={t("onb.children.name", "First name or nickname")} />
            <input className="field" aria-label={t("onb.children.ageLabel", "Child age in years")} type="number" min="0" max="18" step="0.5" value={kid.ageYears} onChange={(event) => update({ kids: draft.kids.map((row, rowIndex) => rowIndex === index ? { ...row, ageYears: event.target.value } : row) })} placeholder={t("onb.children.age", "Age")} />
            <button className="onb-remove" type="button" aria-label={t("onb.children.remove", "Remove child")} onClick={() => update({ kids: draft.kids.filter((_, rowIndex) => rowIndex !== index) })}>−</button>
          </div>)}
          <Button type="button" alt onClick={() => update({ kids: [...draft.kids, { name: "", ageYears: "" }] })}>{t("onb.children.add", "Add a child")}</Button>
        </div>;
        case "care-type": return <ChoiceCards items={careChoices()} value={draft.familyCareTypes} onChange={(familyCareTypes) => update({ familyCareTypes })} multiple />;
        case "schedule": return <div className="onb-field-stack"><p className="muted onb-note">{t("onb.schedule.help", "Choose the days and a usual time window.")}</p><ChoiceCards items={dayChoices()} value={draft.familyDays} onChange={(familyDays) => update({ familyDays })} multiple /><div className="onb-row"><label className="onb-field-stack"><span className="onb-label">{t("onb.schedule.from", "From")}</span><input className="field" type="time" value={draft.familyFrom} onChange={(event) => update({ familyFrom: event.target.value })} /></label><label className="onb-field-stack"><span className="onb-label">{t("onb.schedule.to", "To")}</span><input className="field" type="time" value={draft.familyTo} onChange={(event) => update({ familyTo: event.target.value })} /></label></div></div>;
        case "budget": return <ChoiceCards items={AMOUNTS.map((amount) => ({ value: String(amount), label: t("onb.budget.amount", "A${amount}/hour", { amount }) }))} value={[String(draft.budgetMax)]} onChange={(items) => { if (items[0]) update({ budgetMax: Number(items[0]) }); }} />;
        case "distance": return <ChoiceCards items={DISTANCES.map((distance) => ({ value: String(distance), label: t("onb.distance.km", "{distance} km", { distance }) }))} value={[String(draft.distanceKm)]} onChange={(items) => { if (items[0]) update({ distanceKm: Number(items[0]) }); }} />;
        case "values": return <div className="onb-field-stack">
          <div><p className="onb-label">{t("onb.values.style", "Care style")}</p><div className="onb-chip-row">{STYLE.map((value) => <Chip key={value} on={draft.style.includes(value)} aria-pressed={draft.style.includes(value)} onClick={() => toggleList("style", value)}>{t(`onb.style.${value.toLowerCase().replaceAll(" ", "-")}`, value)}</Chip>)}</div></div>
          <div><p className="onb-label">{t("onb.values.activities", "Activities")}</p><div className="onb-chip-row">{ACTIVITIES.map((value) => <Chip key={value} on={draft.activities.includes(value)} aria-pressed={draft.activities.includes(value)} onClick={() => toggleList("activities", value)}>{t(`onb.activity.${value.toLowerCase().replaceAll(" ", "-")}`, value)}</Chip>)}</div></div>
          <div><p className="onb-label">{t("onb.values.languages", "Languages you would like")}</p><div className="onb-chip-row">{LANGUAGES.map((value) => <Chip key={value} on={draft.familyLanguages.includes(value)} aria-pressed={draft.familyLanguages.includes(value)} onClick={() => toggleList("familyLanguages", value)}>{t(`onb.language.${value.toLowerCase()}`, value)}</Chip>)}</div></div>
          <label className="onb-field-stack"><span className="onb-label">{t("onb.values.freeText", "Or write what matters to you")}</span><textarea className="field" maxLength={400} value={draft.freeText} onChange={(event) => update({ freeText: event.target.value })} placeholder={t("onb.values.placeholder", "For example, outdoor play and Spanish-speaking care")} /></label>
          <Button type="button" alt onClick={() => setPrefSuggestion(extractPrefs(draft.freeText))}>{t("onb.ai.suggestPrefs", "Suggest preferences")}</Button>
          {prefSuggestion && <div className="onb-prompt"><p className="onb-suggest-label">{t("onb.ai.suggested", "Suggested - edit before saving")}</p>
            {prefSuggestion.matchedPhrases.length ? <><p className="onb-note">{t("onb.ai.matched", "Words found in your note:")}</p><div className="onb-chip-row">{prefSuggestion.matchedPhrases.map((phrase) => <span className="onb-matched" key={phrase}>{phrase}</span>)}</div></> : <p className="onb-note">{t("onb.ai.noPrefs", "No listed preferences found in that note.")}</p>}
            <div className="row"><Button type="button" alt small onClick={() => setPrefSuggestion(null)}>{t("onb.ai.discard", "Discard")}</Button><Button type="button" small disabled={!prefSuggestion.matchedPhrases.length} onClick={() => { update({ style: [...new Set([...draft.style, ...(prefSuggestion.prefs.style ?? [])])], activities: [...new Set([...draft.activities, ...(prefSuggestion.prefs.activities ?? [])])], familyLanguages: [...new Set([...draft.familyLanguages, ...(prefSuggestion.prefs.languages ?? [])])] }); setPrefSuggestion(null); }}>{t("onb.ai.confirm", "Confirm")}</Button></div>
          </div>}
        </div>;
      }
    }

    switch (stepName) {
      case "photo": return <PhotoStep uid={uid} photoKey={draft.photoKey} onSaved={(photoKey) => update({ photoKey })} />;
      case "headline": return <div className="onb-field-stack"><label className="onb-label" htmlFor="onb-headline">{t("onb.headline.label", "A few words about your care")}</label><input id="onb-headline" className="field" maxLength={80} value={draft.headline} onChange={(event) => update({ headline: event.target.value })} placeholder={t("onb.headline.placeholder", "For example, Calm after-school care")} /><p className="muted onb-note">{t("onb.headline.count", "{count}/80 characters", { count: draft.headline.length })}</p></div>;
      case "intro": return <div className="onb-field-stack"><label className="onb-label" htmlFor="onb-intro">{t("onb.intro.label", "Tell families about your care")}</label><textarea id="onb-intro" className="field" maxLength={300} value={draft.intro} onChange={(event) => update({ intro: event.target.value })} placeholder={t("onb.intro.placeholder", "Write in your own words, or try a suggestion.")} /><p className="muted onb-note">{t("onb.intro.count", "{count}/300 characters", { count: draft.intro.length })}</p><Button type="button" alt onClick={requestIntroSuggestion}>{t("onb.ai.suggestIntro", "Suggest an introduction")}</Button>{renderIntroSuggestion()}</div>;
      case "video": return <VideoStep uid={uid} videoKey={draft.videoKey} onSaved={(videoKey) => update({ videoKey: videoKey ?? "" })} />;
      case "languages": return <div className="onb-field-stack"><p className="muted onb-note">{t("onb.languages.help", "Choose the languages you can use with families.")}</p><ChoiceCards items={LANGUAGES.map((language) => ({ value: language, label: t(`onb.language.${language.toLowerCase()}`, language) }))} value={draft.languages} onChange={(languages) => update({ languages })} multiple /></div>;
      case "experience": return <div className="onb-field-stack"><p className="muted onb-note">{t("onb.experience.help", "Choose the number of years you have entered for childcare.")}</p><ChoiceCards items={YEARS.map((years) => ({ value: String(years), label: t("onb.experience.years", "{years} years", { years }) }))} value={draft.experienceYears ? [draft.experienceYears] : []} onChange={(items) => update({ experienceYears: items[0] ?? "" })} /></div>;
      case "qualifications": return <QualificationsStep uid={uid} />;
      case "rate": return <ChoiceCards items={AMOUNTS.map((amount) => ({ value: String(amount), label: t("onb.rate.amount", "A${amount}/hour", { amount }) }))} value={[String(draft.rate)]} onChange={(items) => { if (items[0]) update({ rate: Number(items[0]) }); }} />;
      case "availability": return <div className="onb-field-stack"><p className="muted onb-note">{t("onb.availability.help", "Choose the days and your usual time window.")}</p><ChoiceCards items={dayChoices()} value={draft.carerDays} onChange={(carerDays) => update({ carerDays })} multiple /><div className="onb-row"><label className="onb-field-stack"><span className="onb-label">{t("onb.schedule.from", "From")}</span><input className="field" type="time" value={draft.carerFrom} onChange={(event) => update({ carerFrom: event.target.value })} /></label><label className="onb-field-stack"><span className="onb-label">{t("onb.schedule.to", "To")}</span><input className="field" type="time" value={draft.carerTo} onChange={(event) => update({ carerTo: event.target.value })} /></label></div></div>;
      case "care-types": return <div className="onb-field-stack"><ChoiceCards items={careChoices()} value={draft.carerCareTypes} onChange={(carerCareTypes) => update({ carerCareTypes })} multiple /><Button type="button" alt onClick={requestIntroSuggestion}>{t("onb.ai.suggestIntro", "Suggest an introduction")}</Button>{renderIntroSuggestion()}</div>;
      default: return null;
    }
  }

  if (!ready) return <div className="onb-screen"><div className="scroll"><p>{t("onb.loading", "Getting your profile ready…")}</p></div></div>;
  const alternateLabel = isSecondary
    ? t("onb.also.return", "Return to your {side} profile", { side: profile?.side === "family" ? t("onb.side.family", "family") : t("onb.side.carer", "carer") })
    : side === "family" ? t("onb.also.carer", "Also set up as a carer") : t("onb.also.family", "Also set up as a family");
  const currentStep = step + 1;
  return <main className="onb-screen">
    <div className="onb-scroll">
      <header className="onb-top">
        {step > 0 ? <button type="button" className="chip" onClick={goBack}>{t("onb.back", "Back")}</button> : edit ? <button type="button" className="chip" onClick={() => nav.back()}>{t("onb.cancel", "Cancel")}</button> : <span aria-hidden="true" />}
        <div className="onb-progress"><span className="onb-kicker">{t("onb.step.count", "Step {current} of {total}", { current: currentStep, total: steps.length })}</span><Ring pct={progress} label={t("onb.progress.label", "Profile setup progress")} /></div>
      </header>
      {profile && <button type="button" className="chip" onClick={switchRole}>{alternateLabel}</button>}
      <section className="onb-heading"><p className="onb-kicker">{t(`onb.side.${side}`, side === "family" ? "Family profile" : "Carer profile")}</p><h1>{title}</h1></section>
      <div className="onb-content">{renderStep()}</div>
      {error && <p role="alert" className="onb-error">{error}</p>}
      <div className="onb-actions">
        {step > 0 ? <Button type="button" alt onClick={goBack}>{t("onb.back", "Back")}</Button> : edit ? <Button type="button" alt onClick={() => nav.back()}>{t("onb.cancel", "Cancel")}</Button> : <span />}
        <Button type="button" disabled={busy} onClick={() => void advance()}>{busy ? t("onb.saving", "Saving…") : step === steps.length - 1 ? t("onb.finish", "Finish profile") : t("onb.next", "Save and continue")}</Button>
      </div>
    </div>
  </main>;
}
