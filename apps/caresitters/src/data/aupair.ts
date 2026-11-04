import type { Person } from "@cc/core";

export type PlacementMode = "host" | "aupair";
export type PassportCountry = { code: string; name: string };
export type AuPairDestination = { code: string; country: string; flag: string; x: number; y: number };

export const AUPAIR_DESTINATIONS: AuPairDestination[] = [
  { code: "AU", country: "Australia", flag: "🇦🇺", x: 92, y: 65 },
  { code: "NZ", country: "New Zealand", flag: "🇳🇿", x: 91, y: 89 },
  { code: "CA", country: "Canada", flag: "🇨🇦", x: 18, y: 22 },
  { code: "US", country: "United States", flag: "🇺🇸", x: 18, y: 48 },
  { code: "IE", country: "Ireland", flag: "🇮🇪", x: 35, y: 42 },
  { code: "UK", country: "United Kingdom", flag: "🇬🇧", x: 50, y: 42 },
  { code: "NO", country: "Norway", flag: "🇳🇴", x: 50, y: 15 },
  { code: "SE", country: "Sweden", flag: "🇸🇪", x: 80, y: 15 },
  { code: "DK", country: "Denmark", flag: "🇩🇰", x: 65, y: 15 },
  { code: "NL", country: "Netherlands", flag: "🇳🇱", x: 80, y: 37 },
  { code: "DE", country: "Germany", flag: "🇩🇪", x: 65, y: 42 },
  { code: "FR", country: "France", flag: "🇫🇷", x: 65, y: 72 },
  { code: "CH", country: "Switzerland", flag: "🇨🇭", x: 35, y: 72 },
  { code: "ES", country: "Spain", flag: "🇪🇸", x: 50, y: 72 },
  { code: "IT", country: "Italy", flag: "🇮🇹", x: 80, y: 48 },
];

// Country names and ISO codes adapted from npm world-countries (mledoze/countries), ODbL-1.0.
export const PASSPORT_COUNTRIES: PassportCountry[] = [
  { code: "AF", name: "Afghanistan" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" },
  { code: "BR", name: "Brazil" },
  { code: "BN", name: "Brunei" },
  { code: "BG", name: "Bulgaria" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "KH", name: "Cambodia" },
  { code: "CM", name: "Cameroon" },
  { code: "CA", name: "Canada" },
  { code: "CV", name: "Cape Verde" },
  { code: "CF", name: "Central African Republic" },
  { code: "TD", name: "Chad" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoros" },
  { code: "CR", name: "Costa Rica" },
  { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czechia" },
  { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "CD", name: "DR Congo" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estonia" },
  { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "Ethiopia" },
  { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" },
  { code: "GR", name: "Greece" },
  { code: "GD", name: "Grenada" },
  { code: "GT", name: "Guatemala" },
  { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" },
  { code: "HN", name: "Honduras" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "CI", name: "Ivory Coast" },
  { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan" },
  { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" },
  { code: "XK", name: "Kosovo" },
  { code: "KW", name: "Kuwait" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Laos" },
  { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MR", name: "Mauritania" },
  { code: "MU", name: "Mauritius" },
  { code: "MX", name: "Mexico" },
  { code: "FM", name: "Micronesia" },
  { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" },
  { code: "ME", name: "Montenegro" },
  { code: "MA", name: "Morocco" },
  { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" },
  { code: "NA", name: "Namibia" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NI", name: "Nicaragua" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "KP", name: "North Korea" },
  { code: "MK", name: "North Macedonia" },
  { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "CG", name: "Republic of the Congo" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "RW", name: "Rwanda" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "LC", name: "Saint Lucia" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbia" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SO", name: "Somalia" },
  { code: "ZA", name: "South Africa" },
  { code: "KR", name: "South Korea" },
  { code: "SS", name: "South Sudan" },
  { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "SY", name: "Syria" },
  { code: "ST", name: "São Tomé and Príncipe" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TZ", name: "Tanzania" },
  { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TG", name: "Togo" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisia" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TV", name: "Tuvalu" },
  { code: "TR", name: "Türkiye" },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VU", name: "Vanuatu" },
  { code: "VA", name: "Vatican City" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Vietnam" },
  { code: "YE", name: "Yemen" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" }
];

export const CHILDCARE_DUTIES = [
  "Supervise and play with children",
  "School or activity runs",
  "Prepare children's meals",
  "Bath and bedtime routine",
  "Homework and reading help",
  "Tidy children's rooms",
  "Children's laundry",
] as const;

export const OTHER_HOUSEWORK = [
  "Clean rooms not used by children",
  "Laundry for adults",
  "Cook meals for the whole household",
  "Garden or pet care",
  "Whole-home cleaning",
] as const;

export type AuPairArrival = { month: string; destinations: string[] };

export function parseAuPairArrival(value: unknown): AuPairArrival {
  const parts = String(value ?? "").split(";");
  const first = parts[0] ?? "";
  const month = /^\d{4}-\d{2}$/.test(first) ? first : "";
  const destinations = parts.slice(1).flatMap((part) => {
    const [key, raw = ""] = part.split("=");
    return key === "d" ? raw.split(",").map((code) => code.trim().toUpperCase()).filter(Boolean) : [];
  });
  return { month, destinations: [...new Set(destinations)] };
}

export function packAuPairArrival(value: AuPairArrival): string {
  const month = /^\d{4}-\d{2}$/.test(value.month) ? value.month : "";
  const knownCodes = new Set(AUPAIR_DESTINATIONS.map((country) => country.code));
  const destinations = [...new Set(value.destinations.map((code) => code.toUpperCase()).filter((code) => knownCodes.has(code)))];
  return [month, "t=aupair", ...(destinations.length ? [`d=${destinations.join(",")}`] : [])].join(";");
}

export function destinationByName(name: string): AuPairDestination | undefined {
  const normalized = name.trim().toLocaleLowerCase();
  return AUPAIR_DESTINATIONS.find((country) => country.country.toLocaleLowerCase() === normalized || country.code.toLocaleLowerCase() === normalized);
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((value) => value.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;]+/).map((value) => value.trim()).filter(Boolean);
  return [];
}

export function personLanguages(person: Person): string[] {
  const hostLanguages = person.card.auPairHost?.languages;
  const profileLanguages = person.card.languages ?? person.raw.languages;
  return [...new Set([...asStringList(profileLanguages), ...asStringList(hostLanguages)].map((language) => language.toLocaleLowerCase()))];
}

function personCountry(person: Person): string {
  const hostCountry = person.card.auPairHost?.country;
  return String(hostCountry ?? person.card.country ?? person.raw.country ?? "").trim();
}

export function matchesPlacementDestination(person: Person, mode: PlacementMode, destination: string): boolean {
  if (!destination.trim()) return true;
  const wanted = destinationByName(destination);
  if (!wanted) return false;
  if (mode === "host") {
    const country = destinationByName(personCountry(person));
    return Boolean(country && country.code === wanted.code);
  }
  const preferred = parseAuPairArrival(person.card.auPair?.arrival).destinations;
  return preferred.includes(wanted.code);
}

export type PlacementCompatibilityFact = { id: "destination" | "languages" | "infant"; matches: boolean };
export function placementCompatibilityFacts(viewer: Person, candidate: Person): PlacementCompatibilityFact[] {
  const host = viewer.side === "family" ? viewer : candidate.side === "family" ? candidate : null;
  const auPair = viewer.side === "carer" ? viewer : candidate.side === "carer" ? candidate : null;
  if (!host || !auPair || host.side === auPair.side) return [];
  const facts: PlacementCompatibilityFact[] = [];
  const hostCode = destinationByName(personCountry(host))?.code;
  const desired = parseAuPairArrival(auPair.card.auPair?.arrival).destinations;
  if (hostCode && desired.length) facts.push({ id: "destination", matches: desired.includes(hostCode) });

  const hostLanguages = personLanguages(host);
  const auPairLanguages = personLanguages(auPair);
  if (hostLanguages.length && auPairLanguages.length) facts.push({ id: "languages", matches: hostLanguages.some((language) => auPairLanguages.includes(language)) });

  const hostChildren = Array.isArray(host.card.kids) ? host.card.kids : [];
  const infantNeed = host.card.auPairHost?.infantCareNeeded === true || hostChildren.some((child: unknown) => {
    if (!child || typeof child !== "object") return false;
    const age = Number((child as { ageYears?: unknown }).ageYears);
    return Number.isFinite(age) && age < 2;
  });
  const infantFact = auPair.card.auPair?.infant;
  if (infantNeed && typeof infantFact === "boolean") facts.push({ id: "infant", matches: infantFact });
  return facts;
}

/** Returns a score only when at least three shared, non-visa facts can be compared. */
export function placementCompatibility(viewer: Person, candidate: Person): number | null {
  const facts = placementCompatibilityFacts(viewer, candidate);
  return facts.length >= 3 ? Math.round((facts.filter((fact) => fact.matches).length / facts.length) * 100) : null;
}

export function targetSide(mode: PlacementMode): "family" | "carer" {
  return mode === "host" ? "family" : "carer";
}
