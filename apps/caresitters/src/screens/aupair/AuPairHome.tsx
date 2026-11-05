import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { BackBar, Button, Empty, loadPeople, t, useNav, type Person, type ScreenProps, db } from "@cc/core";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { AuPairCandidateCard } from "./components/AuPairCandidateCard";
import { AuPairMap } from "./components/AuPairMap";
import { AUPAIR_DESTINATIONS, PASSPORT_COUNTRIES, matchesPlacementDestination, targetSide, type PlacementMode } from "../../data/aupair";
import { visaChipLabel, visaSourceFor } from "../../lib/visa";
import "./components/aupair.css";

type Params = { me: Person; people?: Person[]; passport?: string; destination?: string };
const countryName = (code: string, english: string) => t(`aupair.country.${code.toLocaleLowerCase()}`, english);

export default function AuPairHome({ params }: ScreenProps<Params>) {
  const { me, people: examplePeople, passport: examplePassport } = params;
  const nav = useNav();
  const [people, setPeople] = useState<Person[]>(examplePeople ?? []);
  const [loading, setLoading] = useState(!examplePeople);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState<PlacementMode>(me.side === "family" ? "aupair" : "host");
  const [destination, setDestination] = useState(params.destination ?? "");
  const [passport, setPassport] = useState(examplePassport ?? "");
  const [passportSaving, setPassportSaving] = useState(false);
  const [passportError, setPassportError] = useState(false);

  useEffect(() => {
    let live = true;
    if (examplePeople) {
      setPeople(examplePeople);
      setLoading(false);
      return () => { live = false; };
    }
    setLoading(true);
    setLoadError(false);
    const otherSide: Person = { ...me, side: me.side === "family" ? "carer" : "family" };
    void Promise.all([loadPeople(me), loadPeople(otherSide)]).then(([opposite, same]) => {
      if (!live) return;
      const unique = new Map<string, Person>();
      [...opposite, ...same].forEach((person) => unique.set(person.uid, person));
      setPeople([...unique.values()]);
      setLoading(false);
    }).catch(() => {
      if (!live) return;
      setLoadError(true);
      setLoading(false);
    });
    return () => { live = false; };
  }, [examplePeople, me, reload]);

  useEffect(() => {
    let live = true;
    if (examplePassport !== undefined) {
      setPassport(examplePassport);
      return () => { live = false; };
    }
    void getDoc(doc(db, "users", me.uid, "prefs", "main")).then((snapshot) => {
      if (live) setPassport(String(snapshot.data()?.passport ?? ""));
    }).catch(() => {
      if (live) setPassport("");
    });
    return () => { live = false; };
  }, [examplePassport, me.uid]);

  const target = targetSide(mode);
  const candidates = useMemo(() => people
    .filter((person) => person.uid !== me.uid && person.side === target && person.card.auPair?.on === true)
    .filter((person) => matchesPlacementDestination(person, mode, destination))
    .sort((a, b) => a.name.localeCompare(b.name)), [people, me.uid, target, mode, destination]);
  const selectedDestination = AUPAIR_DESTINATIONS.find((country) => country.country === destination);
  const source = visaSourceFor(destination);
  const currentVisaStatus = visaChipLabel(source, passport);
  const targetLabel = mode === "host" ? t("aupair.hostFamilies", "Host families") : t("aupair.auPairs", "Au pairs");

  async function savePassport(value: string) {
    setPassport(value);
    setPassportError(false);
    setPassportSaving(true);
    try {
      await setDoc(doc(db, "users", me.uid, "prefs", "main"), { passport: value }, { merge: true });
    } catch {
      setPassportError(true);
    } finally {
      setPassportSaving(false);
    }
  }

  const profileFor = (person: Person) => nav.push("aupair-profile", { uid: person.uid, mode, me, destination, passport });
  const openMyProfile = () => nav.push("aupair-profile", { uid: me.uid, mode: me.side === "family" ? "host" : "aupair", me, editing: true });
  const countrySelect = (event: ChangeEvent<HTMLSelectElement>) => { void savePassport(event.target.value); };

  return <div className="aupair-screen">
    <BackBar title={t("aupair.title", "Au pair world")} onBack={nav.back} />
    <div className="aupair-scroll"><div className="ap-content">
      <header className="ap-intro">
        <h1>{t("aupair.headline", "A place to find a family abroad")}</h1>
        <p>{t("aupair.intro", "Live-in care. Separate from hourly care.")}</p>
        <div className="ap-saved-actions"><Button small alt onClick={openMyProfile}>{t("aupair.editMyProfile", "My placement profile")}</Button></div>
      </header>

      <div className="ap-mode-toggle" role="group" aria-label={t("aupair.listMode", "Choose which profiles to browse")}>
        <button type="button" aria-pressed={mode === "host"} onClick={() => setMode("host")}>{t("aupair.hostFamilies", "Host families")}</button>
        <button type="button" aria-pressed={mode === "aupair"} onClick={() => setMode("aupair")}>{t("aupair.auPairs", "Au pairs")}</button>
      </div>

      <AuPairMap selected={destination} onSelect={setDestination} />

      <section className="ap-controls" aria-label={t("aupair.passportSettings", "Passport settings")}>
        <label htmlFor="ap-passport">{t("aupair.passportLabel", "Country of passport")}
          <select id="ap-passport" value={passport} onChange={countrySelect}>
            <option value="">{t("aupair.passportChoose", "Choose your passport country")}</option>
            {PASSPORT_COUNTRIES.map((country) => <option value={country.name} key={country.code}>{countryName(country.code, country.name)}</option>)}
          </select>
        </label>
        {passportSaving && <p className="ap-form-help" role="status">{t("aupair.passportSaving", "Saving passport country…")}</p>}
        {passportError && <p className="ap-error" role="alert">{t("aupair.passportSaveError", "Passport country could not be saved. Try again.")}</p>}
        <p className="ap-form-help">{t("aupair.passportPrivacy", "Private. Used only to show the right guide.")}</p>
      </section>

      {selectedDestination && <section className="ap-selected-place" aria-label={t("aupair.selectedDestination", "Selected destination")}>
        <span className="ap-place-flag" aria-hidden="true">{selectedDestination.flag}</span>
        <strong>{countryName(selectedDestination.code, selectedDestination.country)}</strong>
        <span className={`ap-status-chip${currentVisaStatus === "Unknown" ? " is-unknown" : " is-guidance"}`}>{t(`aupair.visaChip.${currentVisaStatus === "Unknown" ? "unknown" : "guidance"}`, currentVisaStatus)}</span>
        <button type="button" className="ap-place-action" onClick={() => nav.push("aupair-visa", { destination, passport })}>{t("aupair.openVisa", "Visa guidance")}</button>
      </section>}

      <section className="ap-list" aria-labelledby="ap-list-title">
        <div className="ap-list-heading"><h2 id="ap-list-title">{targetLabel}</h2><span>{t("aupair.profileCount", "{count} listed", { count: candidates.length })}</span></div>
        {loading && <div className="card" role="status">{t("aupair.loading", "Loading placement profiles…")}</div>}
        {!loading && loadError && <Empty mood="oops" title={t("aupair.loadError", "Profiles could not load")} body={t("aupair.loadErrorBody", "Check your connection and try again.")} action={<Button small onClick={() => setReload((value) => value + 1)}>{t("aupair.retry", "Try again")}</Button>} />}
        {!loading && !loadError && !candidates.length && <Empty mood="rest" title={mode === "host" ? t("aupair.noHosts", "No host families match this view yet") : t("aupair.noAuPairs", "No au pairs match this view yet")} body={destination ? t("aupair.noCountryMatches", "Try another country, or add your own placement profile.") : t("aupair.noMatches", "Choose a country or add a placement profile to get started.")} action={<Button small alt onClick={openMyProfile}>{t("aupair.addProfile", "Add my profile")}</Button>} />}
        {!loading && !loadError && candidates.map((person) => <AuPairCandidateCard
          key={person.uid}
          person={person}
          me={me}
          mode={mode}
          destination={destination}
          passport={passport}
          onOpen={() => profileFor(person)}
        />)}
      </section>
      <p className="ap-note">{t("aupair.visaNotMatch", "Visa is separate from match. Only the government decides.")}</p>
    </div></div>
  </div>;
}
