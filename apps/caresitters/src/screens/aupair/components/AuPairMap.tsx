import { t } from "@cc/core";
import { AUPAIR_DESTINATIONS } from "../../../data/aupair";
import "./aupair.css";

type Props = { selected: string; onSelect: (country: string) => void };
const countryName = (code: string, english: string) => t(`aupair.country.${code.toLocaleLowerCase()}`, english);

export function AuPairMap({ selected, onSelect }: Props) {
  const selectedCountry = AUPAIR_DESTINATIONS.find((country) => selected === country.country);
  return <section className="ap-atlas" aria-labelledby="ap-atlas-title">
    <div className="ap-section-heading">
      <div>
        <p className="ap-kicker">{t("aupair.mapKicker", "A separate placement path")}</p>
        <h2 id="ap-atlas-title">{t("aupair.mapTitle", "Choose a country")}</h2>
      </div>
      <span className="ap-atlas-stamp" aria-hidden="true">{t("aupair.mapStamp", "WORLD")}</span>
    </div>
    <div className="ap-map" role="img" aria-label={t("aupair.mapAlt", "A simple map with au pair destination pins") }>
      <svg viewBox="0 0 1000 560" aria-hidden="true" focusable="false">
        <path className="ap-map-land" d="M72 115 118 72 175 83 209 112 253 118 264 158 236 184 216 224 178 231 161 267 130 250 118 215 89 205 69 167z" />
        <path className="ap-map-land" d="M257 275 291 293 310 338 298 381 316 426 297 482 275 458 267 414 245 379 240 333z" />
        <path className="ap-map-land" d="M429 118 454 99 483 103 500 124 489 145 466 151 447 141z" />
        <path className="ap-map-land" d="M460 164 504 152 536 170 548 206 535 244 518 274 505 330 481 353 460 325 455 286 438 250 443 211z" />
        <path className="ap-map-land" d="M506 116 556 91 621 98 657 77 722 93 772 116 822 145 844 182 807 211 766 198 739 223 705 212 675 244 638 228 615 197 580 194 555 169 524 172z" />
        <path className="ap-map-land" d="M786 325 819 307 855 317 872 346 858 375 823 382 794 365z" />
        <path className="ap-map-land" d="M897 422 920 410 942 421 949 443 929 458 903 451z" />
        <path className="ap-map-gridline" d="M80 280H920M500 45V515" />
      </svg>
      <div className="ap-map-pins">
        {selectedCountry ? <button
          className="ap-map-pin is-selected"
          key={selectedCountry.code}
          type="button"
          style={{ left: `${selectedCountry.x}%`, top: `${selectedCountry.y}%` }}
          onClick={() => onSelect(selectedCountry.country)}
          aria-label={t("aupair.selectCountry", "Select {country}", { country: countryName(selectedCountry.code, selectedCountry.country) })}
          aria-pressed="true"
          title={countryName(selectedCountry.code, selectedCountry.country)}
        >{selectedCountry.flag}</button> : <p className="ap-map-empty">{t("aupair.mapChooseFirst", "Choose a country below to add its pin to the map.")}</p>}
      </div>
    </div>
    <p className="ap-map-caption">{t("aupair.mapCaption", "Map is a simple guide. Choose a country on the map or in the list.")}</p>
    <div className="ap-country-grid" aria-label={t("aupair.destinations", "Au pair destinations")}>
      {AUPAIR_DESTINATIONS.map((country) => <button
        className={`ap-country-button${selected === country.country ? " is-selected" : ""}`}
        key={country.code}
        type="button"
        onClick={() => onSelect(country.country)}
        aria-pressed={selected === country.country}
      ><span className="ap-country-flag" aria-hidden="true">{country.flag}</span><span>{countryName(country.code, country.country)}</span><span className="ap-country-arrow flip" aria-hidden="true">›</span></button>)}
    </div>
  </section>;
}
