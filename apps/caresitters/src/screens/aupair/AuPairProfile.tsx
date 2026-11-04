import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Avatar, BackBar, Button, Empty, auth, loadProfile, saveProfile, t, useNav, type Person, type ScreenProps } from "@cc/core";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@cc/core";
import { AUPAIR_DESTINATIONS, CHILDCARE_DUTIES, OTHER_HOUSEWORK, PASSPORT_COUNTRIES, destinationByName, packAuPairArrival, parseAuPairArrival, personLanguages, placementCompatibility, placementCompatibilityFacts, type PlacementMode } from "../../data/aupair";
import { hasHighHouseworkShare, houseworkShare, visaChipLabel, visaSourceFor } from "../../lib/visa";
import "./components/aupair.css";

type Params = { uid: string; mode: string; me?: Person; person?: Person; editing?: boolean; destination?: string; passport?: string };
type HostForm = { on: boolean; country: string; room: string; pocketMoneyPerWeek: string; hoursPerWeek: string; childcareDuties: string[]; otherHousework: string[]; languages: string; visaHelp: boolean; infantCareNeeded: boolean };
type AuPairForm = { on: boolean; homeCountry: string; english: string; infant: boolean; drives: boolean; swim: boolean; month: string; destinations: string[] };

const asString = (value: unknown) => typeof value === "string" ? value : "";
const asList = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
const countryName = (code: string, english: string) => t(`aupair.country.${code.toLocaleLowerCase()}`, english);
const dutyName = (item: string) => t(`aupair.duty.${item.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ".")}`, item);
const parseNumber = (value: string) => { const number = Number(value); return value.trim() && Number.isFinite(number) ? number : null; };
const hostData = (person: Person | null | undefined) => person?.card?.auPairHost ?? {};
const pairData = (person: Person | null | undefined) => person?.card?.auPair ?? {};
const currencyFor = (country: string) => {
  const code = destinationByName(country)?.code ?? "";
  return ({ AU: "AUD", NZ: "NZD", UK: "GBP", IE: "EUR", DE: "EUR", FR: "EUR", NL: "EUR", ES: "EUR", IT: "EUR", CA: "CAD", US: "USD", DK: "DKK", NO: "NOK", SE: "SEK", CH: "CHF" } as Record<string, string>)[code] ?? "";
};
const joinedLanguages = (value: unknown) => Array.isArray(value) ? value.join(", ") : asString(value);
const makeHostForm = (person: Person): HostForm => {
  const data = hostData(person);
  return {
    on: pairData(person).on === true,
    country: asString(data.country),
    room: asString(data.room),
    pocketMoneyPerWeek: data.pocketMoneyPerWeek == null ? "" : String(data.pocketMoneyPerWeek),
    hoursPerWeek: data.hoursPerWeek == null ? "" : String(data.hoursPerWeek),
    childcareDuties: asList(data.childcareDuties),
    otherHousework: asList(data.otherHousework),
    languages: joinedLanguages(data.languages),
    visaHelp: data.visaHelp === true,
    infantCareNeeded: data.infantCareNeeded === true,
  };
};
const makeAuPairForm = (person: Person): AuPairForm => {
  const data = pairData(person);
  const arrival = parseAuPairArrival(data.arrival);
  return {
    on: data.on === true,
    homeCountry: asString(data.homeCountry),
    english: asString(data.english),
    infant: data.infant === true,
    drives: data.drives === true,
    swim: data.swim === true,
    month: arrival.month,
    destinations: arrival.destinations,
  };
};
const resolveMode = (value: string): PlacementMode => value === "host" || value === "family" ? "host" : "aupair";

export default function AuPairProfile({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const { uid } = params;
  const mode = resolveMode(params.mode);
  const [person, setPerson] = useState<Person | null>(params.person ?? null);
  const [viewer, setViewer] = useState<Person | null>(params.me ?? null);
  const [loading, setLoading] = useState(!params.person);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [hostForm, setHostForm] = useState<HostForm>({ on: false, country: "", room: "", pocketMoneyPerWeek: "", hoursPerWeek: "", childcareDuties: [], otherHousework: [], languages: "", visaHelp: false, infantCareNeeded: false });
  const [auPairForm, setAuPairForm] = useState<AuPairForm>({ on: false, homeCountry: "", english: "", infant: false, drives: false, swim: false, month: "", destinations: [] });
  const [passport, setPassport] = useState(params.passport ?? "");

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(!params.person);
      setError(false);
      try {
        const loaded = params.person ?? await loadProfile(uid);
        if (!live) return;
        setPerson(loaded);
        const currentUid = auth().currentUser?.uid;
        let me = params.me ?? null;
        if (!me && currentUid) me = await loadProfile(currentUid).catch(() => null);
        if (!live) return;
        setViewer(me);
        const owner = currentUid === uid;
        setEditing(Boolean(params.editing && owner));
        if (me && params.passport === undefined && currentUid) {
          const savedPrefs = await getDoc(doc(db, "users", currentUid, "prefs", "main")).catch(() => null);
          if (live) setPassport(String(savedPrefs?.data()?.passport ?? ""));
        }
        setLoading(false);
      } catch {
        if (live) { setError(true); setLoading(false); }
      }
    }
    void load();
    return () => { live = false; };
  }, [uid, params.me, params.person, params.editing, params.passport]);

  useEffect(() => {
    if (loading || !person || error) return;
    const screens = document.querySelectorAll<HTMLElement>(".aupair-screen");
    const current = screens[screens.length - 1];
    current?.querySelector<HTMLButtonElement>('button[aria-label="Back"]')?.focus();
  }, [loading, person, error]);

  useEffect(() => {
    if (!person) return;
    setHostForm(makeHostForm(person));
    setAuPairForm(makeAuPairForm(person));
  }, [person]);

  const isOwner = Boolean(auth().currentUser?.uid === uid);
  const title = mode === "host" ? t("aupair.hostProfile", "Host family profile") : t("aupair.auPairProfile", "Au pair profile");
  const viewCountryRaw = mode === "host" ? asString(hostData(person).country) : asString(pairData(person).homeCountry);
  const viewCountryCode = destinationByName(viewCountryRaw)?.code;
  const viewCountry = viewCountryCode ? countryName(viewCountryCode, destinationByName(viewCountryRaw)?.country ?? viewCountryRaw) : viewCountryRaw;
  const visaDestination = mode === "host" ? (asString(hostData(person).country) || params.destination || "") : (params.destination || "");
  const source = visaSourceFor(visaDestination);
  const sourceKey = visaDestination.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ".");
  const sourceSummary = source ? t(`aupair.visaSummary.${sourceKey}`, source.summary) : "";
  const destinationCountry = destinationByName(visaDestination);
  const visaDestinationLabel = destinationCountry ? countryName(destinationCountry.code, destinationCountry.country) : visaDestination;
  const visaLabel = visaChipLabel(source, passport);
  const compatibility = viewer && person && viewer.uid !== person.uid ? placementCompatibility(viewer, person) : null;
  const compatibilityFacts = viewer && person && viewer.uid !== person.uid ? placementCompatibilityFacts(viewer, person) : [];
  const languages = useMemo(() => person ? personLanguages(person) : [], [person]);
  const dutiesShare = houseworkShare(hostForm.childcareDuties, hostForm.otherHousework);
  const highHousework = hasHighHouseworkShare(hostForm.childcareDuties, hostForm.otherHousework);
  const viewHostDuties = asList(hostData(person).childcareDuties);
  const viewOtherHousework = asList(hostData(person).otherHousework);
  const viewHouseworkShare = houseworkShare(viewHostDuties, viewOtherHousework);
  const viewHouseworkHigh = hasHighHouseworkShare(viewHostDuties, viewOtherHousework);

  function toggleDuty(group: "childcareDuties" | "otherHousework", item: string) {
    if (group === "childcareDuties") {
      setHostForm((current) => ({ ...current, childcareDuties: current.childcareDuties.includes(item) ? current.childcareDuties.filter((duty) => duty !== item) : [...current.childcareDuties, item] }));
    } else {
      setHostForm((current) => ({ ...current, otherHousework: current.otherHousework.includes(item) ? current.otherHousework.filter((duty) => duty !== item) : [...current.otherHousework, item] }));
    }
  }

  function toggleDestination(code: string) {
    setAuPairForm((current) => ({ ...current, destinations: current.destinations.includes(code) ? current.destinations.filter((item) => item !== code) : [...current.destinations, code] }));
  }

  async function save() {
    if (!person || !isOwner || saving) return;
    setSaving(true);
    setSaved(false);
    setSaveError(false);
    try {
      if (mode === "host") {
        const oldPair = pairData(person);
        const allowedPair = {
          on: hostForm.on,
          arrival: asString(oldPair.arrival),
          homeCountry: asString(oldPair.homeCountry),
          english: asString(oldPair.english),
          infant: oldPair.infant === true,
          drives: oldPair.drives === true,
          swim: oldPair.swim === true,
        };
        const nextHost = {
          ...hostData(person),
          country: hostForm.country,
          room: hostForm.room.trim(),
          pocketMoneyPerWeek: parseNumber(hostForm.pocketMoneyPerWeek),
          hoursPerWeek: parseNumber(hostForm.hoursPerWeek),
          childcareDuties: hostForm.childcareDuties,
          otherHousework: hostForm.otherHousework,
          languages: hostForm.languages.split(/[,;]+/).map((language) => language.trim()).filter(Boolean),
          visaHelp: hostForm.visaHelp,
          infantCareNeeded: hostForm.infantCareNeeded,
        };
        await saveProfile(uid, { card: { auPair: allowedPair, auPairHost: nextHost } });
        setPerson({ ...person, card: { ...person.card, auPair: allowedPair, auPairHost: nextHost } });
      } else {
        const allowedPair = {
          on: auPairForm.on,
          arrival: packAuPairArrival({ month: auPairForm.month, destinations: auPairForm.destinations }),
          homeCountry: auPairForm.homeCountry,
          english: auPairForm.english,
          infant: auPairForm.infant,
          drives: auPairForm.drives,
          swim: auPairForm.swim,
        };
        await saveProfile(uid, { card: { auPair: allowedPair } });
        setPerson({ ...person, card: { ...person.card, auPair: allowedPair } });
      }
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  function renderDutyList(titleText: string, items: readonly string[], selected: string[], group: "childcareDuties" | "otherHousework", help: string) {
    return <fieldset className="ap-duty-group" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="ap-section-title">{titleText}</legend>
      <p>{help}</p>
      <div className="ap-duty-list">{items.map((item) => <label className="ap-duty" key={item}><input type="checkbox" checked={selected.includes(item)} onChange={() => toggleDuty(group, item)} /><span>{dutyName(item)}</span></label>)}</div>
    </fieldset>;
  }

  if (loading) return <div className="aupair-screen"><BackBar title={title} onBack={nav.back} /><div className="aupair-scroll"><div className="ap-content"><div className="card" role="status">{t("aupair.profileLoading", "Loading placement profile…")}</div></div></div></div>;
  if (!person || error) return <div className="aupair-screen"><BackBar title={title} onBack={nav.back} /><div className="aupair-scroll"><Empty mood="oops" title={t("aupair.profileMissing", "Profile not available")} body={t("aupair.profileMissingBody", "This placement profile could not load.")} /></div></div>;

  return <div className="aupair-screen">
    <BackBar title={title} onBack={nav.back} right={isOwner && !editing ? <button className="chip" onClick={() => setEditing(true)}>{t("aupair.edit", "Edit")}</button> : undefined} />
    <div className="aupair-scroll"><div className="ap-content">
      <header className="ap-profile-hero">
        <div className="ap-profile-avatar">{person.photoUrl ? <img src={person.photoUrl} alt={t("aupair.profilePhotoAlt", "Profile photo of {name}", { name: person.name })} /> : <Avatar name={person.firstName} size={70} />}</div>
        <div><h1>{person.name}</h1><p>{asString(person.card.headline) || asString(person.about) || (mode === "host" ? t("aupair.hostIntro", "A family opening their home to an au pair") : t("aupair.auPairIntro", "An au pair looking for a host family"))}</p></div>
      </header>

      {editing && isOwner ? <section className="ap-section-card">
        <div className="ap-between"><h2 className="ap-section-title">{t("aupair.editPlacement", "Edit placement profile")}</h2><span className="ap-status-chip">{t("aupair.privateEdit", "Only you can edit")}</span></div>
        {mode === "host" ? <div className="ap-form">
          <label className="ap-check-row"><input type="checkbox" checked={hostForm.on} onChange={(event: ChangeEvent<HTMLInputElement>) => setHostForm((value) => ({ ...value, on: event.target.checked }))} /><span>{t("aupair.listProfile", "Show this host family in au pair search")}</span></label>
          <label>{t("aupair.hostCountry", "Host country")}
            <select value={hostForm.country} onChange={(event) => setHostForm((value) => ({ ...value, country: event.target.value }))}>
              <option value="">{t("aupair.chooseHostCountry", "Choose a country")}</option>
              {AUPAIR_DESTINATIONS.map((country) => <option value={country.country} key={country.code}>{countryName(country.code, country.country)}</option>)}
            </select>
          </label>
          <label>{t("aupair.room", "Room offered")}
            <input value={hostForm.room} onChange={(event) => setHostForm((value) => ({ ...value, room: event.target.value }))} placeholder={t("aupair.roomExample", "For example, a private bedroom")} />
          </label>
          <div className="ap-form-grid">
            <label>{t("aupair.pocketMoney", "Pocket money per week")}
              <input type="number" min="0" inputMode="decimal" value={hostForm.pocketMoneyPerWeek} onChange={(event) => setHostForm((value) => ({ ...value, pocketMoneyPerWeek: event.target.value }))} />
            </label>
            <label>{t("aupair.hoursPerWeek", "Hours per week")}
              <input type="number" min="0" inputMode="numeric" value={hostForm.hoursPerWeek} onChange={(event) => setHostForm((value) => ({ ...value, hoursPerWeek: event.target.value }))} />
            </label>
          </div>
          <p className="ap-form-help">{t("aupair.localCurrency", "Pocket money is shown in the destination's local currency ({currency}).", { currency: currencyFor(hostForm.country) || t("aupair.currencySetByHost", "set by host") })}</p>
          {renderDutyList(t("aupair.childcareDuties", "Childcare duties"), CHILDCARE_DUTIES, hostForm.childcareDuties, "childcareDuties", t("aupair.childcareHelp", "Care for children, such as play, school runs, children's meals, and their rooms or laundry."))}
          <div className="ap-duty-boundary" role="separator" aria-label={t("aupair.dutiesBoundary", "Line between childcare and unrelated housework")}>{t("aupair.boundaryLabel", "Clear boundary")}</div>
          {renderDutyList(t("aupair.otherHousework", "Other housework"), OTHER_HOUSEWORK, hostForm.otherHousework, "otherHousework", t("aupair.houseworkHelp", "These tasks are not childcare duties. Keep the placement focused on children and cultural exchange."))}
          <p className="ap-form-help">{t("aupair.houseworkShare", "Unrelated housework share: {share}% of listed duties.", { share: Math.round(dutiesShare * 100) })}</p>
          {highHousework && <div className="ap-duty-warning" role="alert"><strong>{t("aupair.houseworkWarningTitle", "Housework share is high")}</strong>{t("aupair.houseworkWarning", "Unrelated housework is half or more of listed duties. Keep expectations focused on childcare; this is not a legal test.")}</div>}
          <label>{t("aupair.languages", "Languages spoken at home")}
            <input value={hostForm.languages} onChange={(event) => setHostForm((value) => ({ ...value, languages: event.target.value }))} placeholder={t("aupair.languagesExample", "For example, English and Spanish")} />
          </label>
          <label className="ap-check-row"><input type="checkbox" checked={hostForm.visaHelp} onChange={(event: ChangeEvent<HTMLInputElement>) => setHostForm((value) => ({ ...value, visaHelp: event.target.checked }))} /><span>{t("aupair.visaHelpOffered", "I can offer practical help with visa steps")}</span></label>
          <label className="ap-check-row"><input type="checkbox" checked={hostForm.infantCareNeeded} onChange={(event: ChangeEvent<HTMLInputElement>) => setHostForm((value) => ({ ...value, infantCareNeeded: event.target.checked }))} /><span>{t("aupair.infantCareNeeded", "The placement includes care for a child under 2")}</span></label>
        </div> : <div className="ap-form">
          <label className="ap-check-row"><input type="checkbox" checked={auPairForm.on} onChange={(event: ChangeEvent<HTMLInputElement>) => setAuPairForm((value) => ({ ...value, on: event.target.checked }))} /><span>{t("aupair.listProfile", "Show this au pair profile in search")}</span></label>
          <label>{t("aupair.homeCountry", "Home country")}
            <select value={auPairForm.homeCountry} onChange={(event) => setAuPairForm((value) => ({ ...value, homeCountry: event.target.value }))}>
              <option value="">{t("aupair.chooseHomeCountry", "Choose a country")}</option>
              {PASSPORT_COUNTRIES.map((country) => <option value={country.name} key={country.code}>{countryName(country.code, country.name)}</option>)}
            </select>
          </label>
          <label>{t("aupair.englishLevel", "English level")}
            <select value={auPairForm.english} onChange={(event) => setAuPairForm((value) => ({ ...value, english: event.target.value }))}>
              <option value="">{t("aupair.chooseEnglish", "Choose a level")}</option>
              {["Basic", "Good", "Fluent"].map((level) => <option value={level} key={level}>{level}</option>)}
            </select>
          </label>
          <fieldset className="ap-duty-group" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="ap-section-title">{t("aupair.experienceAndSkills", "Experience and skills")}</legend>
            <div className="ap-check-grid">
              <label className="ap-check-row"><input type="checkbox" checked={auPairForm.infant} onChange={(event: ChangeEvent<HTMLInputElement>) => setAuPairForm((value) => ({ ...value, infant: event.target.checked }))} /><span>{t("aupair.infantExperience", "Infant experience")}</span></label>
              <label className="ap-check-row"><input type="checkbox" checked={auPairForm.drives} onChange={(event: ChangeEvent<HTMLInputElement>) => setAuPairForm((value) => ({ ...value, drives: event.target.checked }))} /><span>{t("aupair.drives", "I drive")}</span></label>
              <label className="ap-check-row"><input type="checkbox" checked={auPairForm.swim} onChange={(event: ChangeEvent<HTMLInputElement>) => setAuPairForm((value) => ({ ...value, swim: event.target.checked }))} /><span>{t("aupair.swims", "I can swim")}</span></label>
            </div>
          </fieldset>
          <label>{t("aupair.arrivalMonth", "Earliest arrival")}
            <input type="month" value={auPairForm.month} onChange={(event) => setAuPairForm((value) => ({ ...value, month: event.target.value }))} />
          </label>
          <fieldset className="ap-duty-group" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="ap-section-title">{t("aupair.preferredDestinations", "Countries I want to live in")}</legend>
            <div className="ap-check-grid">{AUPAIR_DESTINATIONS.map((country) => <label className="ap-check-row" key={country.code}><input type="checkbox" checked={auPairForm.destinations.includes(country.code)} onChange={() => toggleDestination(country.code)} /><span>{country.flag} {countryName(country.code, country.country)}</span></label>)}</div>
          </fieldset>
        </div>}
        {saveError && <p className="ap-error" role="alert">{t("aupair.saveError", "Changes could not be saved. Try again.")}</p>}
        {saved && <p className="ap-save-note" role="status">{t("aupair.saved", "Profile saved")}</p>}
        <div className="ap-saved-actions"><Button onClick={() => void save()} disabled={saving}>{saving ? t("aupair.saving", "Saving…") : t("aupair.save", "Save profile")}</Button><Button alt onClick={() => setEditing(false)}>{t("aupair.cancelEdit", "Cancel")}</Button></div>
      </section> : mode === "host" ? <>
        <section className="ap-section-card">
          <h2 className="ap-section-title">{t("aupair.hostOffer", "What the family offers")}</h2>
          <dl className="ap-facts">
            {viewCountry && <div className="ap-fact"><dt>{t("aupair.country", "Country")}</dt><dd>{viewCountry}</dd></div>}
            <div className="ap-fact"><dt>{t("aupair.room", "Room")}</dt><dd>{asString(hostData(person).room) || t("aupair.notShared", "Not shared")}</dd></div>
            <div className="ap-fact"><dt>{t("aupair.pocketMoney", "Pocket money per week")}</dt><dd>{hostData(person).pocketMoneyPerWeek != null ? `${hostData(person).pocketMoneyPerWeek} ${currencyFor(viewCountryRaw)}` : t("aupair.notShared", "Not shared")}</dd></div>
            <div className="ap-fact"><dt>{t("aupair.hoursPerWeek", "Hours per week")}</dt><dd>{hostData(person).hoursPerWeek ?? t("aupair.notShared", "Not shared")}</dd></div>
            <div className="ap-fact"><dt>{t("aupair.languages", "Languages")}</dt><dd>{joinedLanguages(hostData(person).languages) || languages.join(", ") || t("aupair.notShared", "Not shared")}</dd></div>
            <div className="ap-fact"><dt>{t("aupair.visaHelp", "Visa help offered")}</dt><dd>{hostData(person).visaHelp === true ? t("aupair.yes", "Yes") : t("aupair.notShared", "Not shared")}</dd></div>
          </dl>
        </section>
        <section className="ap-section-card">
          <div className="ap-duty-group"><h2>{t("aupair.childcareDuties", "Childcare duties")}</h2><p>{t("aupair.childcareHelp", "Care for children, such as play, school runs, children's meals, and their rooms or laundry.")}</p>
            {viewHostDuties.length ? <ul>{viewHostDuties.map((duty) => <li key={duty}>{dutyName(duty)}</li>)}</ul> : <p>{t("aupair.notShared", "Not shared")}</p>}
          </div>
          <div className="ap-duty-boundary" role="separator" aria-label={t("aupair.dutiesBoundary", "Line between childcare and unrelated housework")}>{t("aupair.boundaryLabel", "Clear boundary")}</div>
          <div className="ap-duty-group"><h2>{t("aupair.otherHousework", "Other housework")}</h2><p>{t("aupair.houseworkHelp", "These tasks are not childcare duties. Keep the placement focused on children and cultural exchange.")}</p>
            {viewOtherHousework.length ? <ul>{viewOtherHousework.map((duty) => <li key={duty}>{dutyName(duty)}</li>)}</ul> : <p>{t("aupair.notShared", "Not shared")}</p>}
            <p className="ap-form-help">{t("aupair.houseworkShare", "Unrelated housework share: {share}% of listed duties.", { share: Math.round(viewHouseworkShare * 100) })}</p>
            {viewHouseworkHigh && <div className="ap-duty-warning" role="alert"><strong>{t("aupair.houseworkWarningTitle", "Housework share is high")}</strong>{t("aupair.houseworkWarning", "Unrelated housework is half or more of listed duties. Keep expectations focused on childcare; this is not a legal test.")}</div>}
          </div>
        </section>
        <section className="ap-visa-note"><h2>{t("aupair.visaSupportTitle", "Visa support")}</h2><p>{hostData(person).visaHelp === true ? t("aupair.visaSupportYes", "This family says it can offer practical help. This does not decide visa permission.") : t("aupair.visaSupportNo", "This family has not listed visa help.")}</p></section>
      </> : <>
        <section className="ap-section-card">
          <h2 className="ap-section-title">{t("aupair.auPairDetails", "About this au pair")}</h2>
          <dl className="ap-facts">
            <div className="ap-fact"><dt>{t("aupair.homeCountry", "Home country")}</dt><dd>{asString(pairData(person).homeCountry) || t("aupair.notShared", "Not shared")}</dd></div>
            <div className="ap-fact"><dt>{t("aupair.englishLevel", "English level")}</dt><dd>{asString(pairData(person).english) || t("aupair.notShared", "Not shared")}</dd></div>
            <div className="ap-fact"><dt>{t("aupair.infantExperience", "Infant experience")}</dt><dd>{typeof pairData(person).infant === "boolean" ? pairData(person).infant ? t("aupair.yes", "Yes") : t("aupair.no", "No") : t("aupair.notShared", "Not shared")}</dd></div>
            <div className="ap-fact"><dt>{t("aupair.drives", "Drives")}</dt><dd>{typeof pairData(person).drives === "boolean" ? pairData(person).drives ? t("aupair.yes", "Yes") : t("aupair.no", "No") : t("aupair.notShared", "Not shared")}</dd></div>
            <div className="ap-fact"><dt>{t("aupair.swims", "Can swim")}</dt><dd>{typeof pairData(person).swim === "boolean" ? pairData(person).swim ? t("aupair.yes", "Yes") : t("aupair.no", "No") : t("aupair.notShared", "Not shared")}</dd></div>
            <div className="ap-fact"><dt>{t("aupair.languages", "Languages")}</dt><dd>{languages.join(", ") || t("aupair.notShared", "Not shared")}</dd></div>
          </dl>
        </section>
        {(() => {
          const arrival = parseAuPairArrival(pairData(person).arrival);
          const destinations = arrival.destinations.map((code) => { const country = AUPAIR_DESTINATIONS.find((item) => item.code === code); return country ? countryName(country.code, country.country) : ""; }).filter(Boolean);
          return (arrival.month || destinations.length > 0) ? <section className="ap-section-card"><h2 className="ap-section-title">{t("aupair.placementPreferences", "Placement preferences")}</h2>{arrival.month && <p>{t("aupair.arrivalFrom", "Earliest arrival: {month}", { month: arrival.month })}</p>}{destinations.length > 0 && <p>{t("aupair.preferredDestinations", "Countries I want to live in")}: {destinations.join(", ")}</p>}</section> : null;
        })()}
      </>}

      {viewer && person && viewer.uid !== person.uid && <section className="ap-section-card" aria-labelledby="ap-compatibility-title">
        <div className="ap-status-row">
          {compatibility !== null && <span className="ap-status-chip ap-compatibility">{t("aupair.compatibilityPercent", "Compatibility · {score}%", { score: compatibility })}</span>}
          <span className={`ap-status-chip${visaLabel === "Unknown" ? " is-unknown" : " is-guidance"}`}>{t(`aupair.visaChip.${visaLabel === "Unknown" ? "unknown" : "guidance"}`, visaLabel)}</span>
        </div>
        <h2 id="ap-compatibility-title" className="ap-section-title">{t("aupair.profileMatchReasons", "Why this compatibility view")}</h2>
        <div className="ap-match-reasons">
          {compatibilityFacts.length ? compatibilityFacts.map((fact) => {
            const label = fact.id === "destination" ? t("aupair.factDestination", "Destination") : fact.id === "languages" ? t("aupair.factLanguages", "Languages") : t("aupair.factInfant", "Infant care");
            return <span key={fact.id} className={`ap-match-reason${fact.matches ? " is-match" : " is-mismatch"}`}><b>{label}:</b> {fact.matches ? t("aupair.factMatches", "matches stated details") : t("aupair.factDoesNotMatch", "does not match stated details")}</span>;
          }) : <p className="ap-form-help">{t("aupair.compatibilityNoDetails", "More shared details are needed to compare this placement. Visa status is not a match signal.")}</p>}
        </div>
        <p className="ap-form-help">{t("aupair.visaNotMatch", "Visa status is separate from compatibility. Only the government decides permission to enter or work.")}</p>
      </section>}
      {visaDestination && <section className="ap-visa-note"><h2>{t("aupair.visaGuideTitle", "Visa guidance for {country}", { country: visaDestinationLabel })}</h2><p>{source ? sourceSummary : t("aupair.noVisaSource", "No official page has been checked for this destination yet.")}</p><p>{passport ? t("aupair.visaUnknown", "Unknown for your passport - check the official site") : t("aupair.visaChoosePassport", "Choose your passport country to see the right official guidance.")}</p><Button alt onClick={() => nav.push("aupair-visa", { destination: visaDestination, passport })}>{t("aupair.openVisa", "Open visa guide")}</Button></section>}
    </div></div>
  </div>;
}
