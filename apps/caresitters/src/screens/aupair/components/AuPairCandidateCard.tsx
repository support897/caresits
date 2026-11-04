import { Avatar, t, type Person } from "@cc/core";
import { destinationByName, placementCompatibility, type PlacementMode } from "../../../data/aupair";
import { visaChipLabel, visaSourceFor } from "../../../lib/visa";
import "./aupair.css";

type Props = {
  person: Person;
  me: Person;
  mode: PlacementMode;
  destination: string;
  passport: string;
  onOpen: () => void;
};

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : "";
const hostData = (person: Person) => person.card.auPairHost ?? {};
const auPairData = (person: Person) => person.card.auPair ?? {};
const CURRENCY: Record<string, string> = { AU: "AUD", NZ: "NZD", UK: "GBP", IE: "EUR", DE: "EUR", FR: "EUR", NL: "EUR", ES: "EUR", IT: "EUR", CA: "CAD", US: "USD", DK: "DKK", NO: "NOK", SE: "SEK", CH: "CHF" };

export function AuPairCandidateCard({ person, me, mode, destination, passport, onOpen }: Props) {
  const compatibility = placementCompatibility(me, person);
  const source = visaSourceFor(destination);
  const visaStatus = visaChipLabel(source, passport);
  const host = mode === "host" ? hostData(person) : null;
  const auPair = mode === "aupair" ? auPairData(person) : null;
  const languageValue = host ? host.languages : person.card.languages ?? person.raw.languages;
  const languages = Array.isArray(languageValue) ? languageValue.join(", ") : text(languageValue);
  const country = mode === "host" ? text(host?.country) || destination : text(auPair?.homeCountry);
  const hours = Number(host?.hoursPerWeek);
  const money = Number(host?.pocketMoneyPerWeek);
  const currency = CURRENCY[String(host?.countryCode ?? "").toUpperCase()] ?? CURRENCY[destinationByName(String(host?.country ?? destination))?.code ?? ""] ?? "";

  return <article className="ap-candidate card">
    <button type="button" className="ap-candidate-heading" onClick={onOpen} aria-label={t("aupair.openProfile", "Open {name}'s profile", { name: person.name })}>
      <Avatar name={person.firstName} url={person.photoUrl} size={58} />
      <span className="ap-candidate-title"><b>{person.name}</b><span>{country || t("aupair.countryNotShared", "Country not shared")}</span></span>
      <span className="ap-candidate-chevron" aria-hidden="true">›</span>
    </button>
    <div className="ap-status-row" aria-label={t("aupair.matchAndVisa", "Compatibility and visa status are separate")}>
      <span className="ap-status-chip ap-compatibility">{compatibility === null
        ? t("aupair.compatibilityIncomplete", "Compatibility · more details needed")
        : t("aupair.compatibilityPercent", "Compatibility · {score}%", { score: compatibility })}</span>
      <span className={`ap-status-chip${visaStatus === "Unknown" ? " is-unknown" : " is-guidance"}`}>{t(`aupair.visaChip.${visaStatus === "Unknown" ? "unknown" : "guidance"}`, visaStatus)}</span>
    </div>
    {mode === "host" && host && <div className="ap-candidate-facts">
      {text(host.room) && <span>{t("aupair.roomFact", "Room: {room}", { room: text(host.room) })}</span>}
      {Number.isFinite(money) && money > 0 && <span>{t("aupair.pocketFact", "Pocket money: {amount} {currency} per week", { amount: money, currency })}</span>}
      {Number.isFinite(hours) && hours > 0 && <span>{t("aupair.hoursFact", "{hours} hours per week", { hours })}</span>}
      {languages && <span>{t("aupair.languagesFact", "Languages: {languages}", { languages })}</span>}
    </div>}
    {mode === "aupair" && auPair && <div className="ap-candidate-facts">
      {text(auPair.english) && <span>{t("aupair.englishFact", "English: {level}", { level: text(auPair.english) })}</span>}
      {typeof auPair.infant === "boolean" && <span>{auPair.infant ? t("aupair.infantYes", "Infant experience") : t("aupair.infantNo", "No infant experience listed")}</span>}
      {typeof auPair.drives === "boolean" && <span>{auPair.drives ? t("aupair.drivesYes", "Drives") : t("aupair.drivesNo", "Does not drive")}</span>}
      {typeof auPair.swim === "boolean" && <span>{auPair.swim ? t("aupair.swimsYes", "Can swim") : t("aupair.swimsNo", "Swimming not listed")}</span>}
    </div>}
    <button type="button" className="ap-card-link" onClick={onOpen}>{t("aupair.viewProfile", "View profile")}</button>
  </article>;
}
