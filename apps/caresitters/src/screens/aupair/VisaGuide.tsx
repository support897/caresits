import { BackBar, Button, Empty, auth, t, useNav, type ScreenProps } from "@cc/core";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@cc/core";
import { destinationByName } from "../../data/aupair";
import { assessVisa } from "../../lib/visa";
import { visaSourceFor } from "../../lib/visaSources";
import "./components/aupair.css";

type Params = { destination: string; passport?: string };

export default function VisaGuide({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const destination = params.destination ?? "";
  const [passport, setPassport] = useState(params.passport ?? "");
  const [passportLoading, setPassportLoading] = useState(params.passport === undefined);
  const country = destinationByName(destination);
  const source = visaSourceFor(destination);
  const assessment = assessVisa(destination, passport);
  const sourceKey = destination.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ".");
  const destinationLabel = country ? t(`aupair.country.${country.code.toLocaleLowerCase()}`, country.country) : destination;
  const programName = source ? t(`aupair.visaProgram.${sourceKey}`, source.programName) : "";
  const sourceSummary = source ? t(`aupair.visaSummary.${sourceKey}`, source.summary) : "";

  useEffect(() => {
    let live = true;
    if (params.passport !== undefined) {
      setPassport(params.passport);
      setPassportLoading(false);
      return () => { live = false; };
    }
    const uid = auth().currentUser?.uid;
    if (!uid) {
      setPassportLoading(false);
      return () => { live = false; };
    }
    void getDoc(doc(db, "users", uid, "prefs", "main")).then((snapshot) => {
      if (live) setPassport(String(snapshot.data()?.passport ?? ""));
    }).catch(() => {
      if (live) setPassport("");
    }).finally(() => {
      if (live) setPassportLoading(false);
    });
    return () => { live = false; };
  }, [params.passport]);

  const passportStatus = assessment.status === "eligible" ? "Guidance available" : "Unknown";
  const statusText = assessment.status === "eligible"
    ? t("aupair.visaExplicitPassport", "The official page lists this passport for the checked pathway. Only the government decides the application.")
    : t("aupair.visaUnknown", "Unknown for your passport - check the official site");
  const lastChecked = source?.checked ? source.lastChecked : t("aupair.notChecked", "Not checked yet");

  return <div className="aupair-screen">
    <BackBar title={t("aupair.visaGuide", "Visa guide")} onBack={nav.back} />
    {!source ? <div className="aupair-scroll"><Empty mood="think" title={t("aupair.destinationUnavailable", "Choose a listed destination")} body={t("aupair.destinationUnavailableBody", "Official guidance is available for the countries on the map.")} /></div> : <div className="aupair-scroll"><div className="ap-content">
      <header className="ap-intro">
        <p className="ap-kicker">{t("aupair.officialGuidance", "Official government information")}</p>
        <h1>{country?.flag ? `${country.flag} ` : ""}{destinationLabel}</h1>
        <p>{programName}</p>
      </header>

      <section className="ap-section-card" aria-labelledby="ap-visa-status-title">
        <div className="ap-between"><h2 id="ap-visa-status-title" className="ap-section-title">{t("aupair.statusTitle", "Visa status")}</h2><span className={`ap-status-chip${assessment.status === "eligible" ? " is-guidance" : " is-unknown"}`}>{t(`aupair.visaChip.${passportStatus === "Unknown" ? "unknown" : "guidance"}`, passportStatus)}</span></div>
        <p><strong>{t("aupair.passportLabel", "Country of passport")}:</strong> {passport || t("aupair.passportNotSelected", "Not selected")}</p>
        {passportLoading && <p role="status">{t("aupair.passportLoading", "Checking your saved passport country…")}</p>}
        <p>{statusText}</p>
        <p>{source.checked ? sourceSummary : t("aupair.notCheckedSummary", "Not checked yet - open the official site")}</p>
        {source.checked ? <p className="ap-form-help">{t("aupair.passportRulesNotListed", "This app has not checked a rule for your passport and circumstances. Confirm directly with the government.")}</p> : null}
      </section>

      <section className="ap-section-card">
        <h2 className="ap-section-title">{t("aupair.nextSteps", "What to check")}</h2>
        <ul>
          <li>{t("aupair.checkPassport", "Check the rules for your passport and current situation.")}</li>
          <li>{t("aupair.checkWorkPermission", "Check whether the route permits this kind of childcare work.")}</li>
          <li>{t("aupair.checkHostAgreement", "Read the official conditions and any placement agreement before making plans.")}</li>
        </ul>
        <a className="btn" href={source.officialUrl} target="_blank" rel="noreferrer">{t("aupair.openOfficial", "Open official government page")}</a>
        <p>{t("aupair.lastChecked", "Last checked {date}", { date: lastChecked })}</p>
        <p>{t("aupair.guidanceDisclaimer", "This is guidance, not advice. Only the government decides.")}</p>
      </section>
      <Button alt onClick={nav.back}>{t("aupair.backToCountries", "Back to countries")}</Button>
    </div></div>}
  </div>;
}
