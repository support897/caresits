// Caresitters own currency price display (inventory line 18).
// DISPLAY ONLY. Buying stays inert behind the Paid Apps lock
// (Ilse's Paid Apps agreement + tax and banking + Finance's
// product IDs live in both stores). The Join buttons keep doing
// exactly what they have always done: they record plan interest
// and nothing more. This module only decides which price words
// a viewer sees.
//
// Source of record: ~/workspace/app-growth/GLOBAL-PRICING.md
// §2 (the six bands and their factors) + §3 (the schedule
// schedule), approved and locked by Ilse on the payment page,
// 15 Oct 2026. The A$ anchors are hers and never change here:
// Finding A$14.95 a month, Family Plus A$24.95 a month,
// Search Pass A$49 once. Each band is priced by one anchor
// economy (§3): A in USD, B in EUR, C in JPY, D in BRL,
// E in PHP, F in INR. A viewer sees their band's anchor
// currency price, with the A$ worth beside it (her page rule:
// a band price is worth the AU anchor × the band factor).
import { packById, packByName } from "./countries.js";

export const ANCHORS = { finding: 14.95, plus: 24.95, pass: 49 };
export const ANCHOR_DISPLAY = { finding: "A$14.95", plus: "A$24.95", pass: "A$49" };

// The §3 schedule, verbatim, one row per band.
export const BANDS = {
  A: { factor: 1.00, currency: "USD", display: { finding: "$9.99", plus: "$16.99", pass: "$31.99" } },
  B: { factor: 0.90, currency: "EUR", display: { finding: "€7.99", plus: "€12.99", pass: "€24.99" } },
  C: { factor: 0.75, currency: "JPY", display: { finding: "¥1,100", plus: "¥1,900", pass: "¥3,600" } },
  D: { factor: 0.60, currency: "BRL", display: { finding: "R$31.90", plus: "R$52.90", pass: "R$103.90" } },
  E: { factor: 0.45, currency: "PHP", display: { finding: "₱249", plus: "₱419", pass: "₱829" } },
  F: { factor: 0.35, currency: "INR", display: { finding: "₹299", plus: "₹499", pass: "₹999" } },
};

// Band membership, one source per country. Levels are World
// Bank PPP price levels, Australia = 100, 2024 series, from
// GLOBAL-PPP-RESEARCH.md §1; the band ranges are GLOBAL-PRICING
// §2 (A 95 to 115, B 80 to 95, C 58 to 72, D 43 to 57,
// E 32 to 42, F under 30).
export const COUNTRY_BAND = {
  AU: "A", // §2 anchor economy: Australia, price level 100
  US: "A", // price level 110.9, in the A range; §2 anchor economy
  NZ: "A", // price level 98.2, in the A range; §2 anchor economy
  UK: "B", // price level 94.1, in the B range; §2 anchor economy
  CA: "B", // price level 93.2, in the B range; §2 anchor economy
  DE: "B", // price level 84.1 (Germany, euro area); §2 anchor economy "Germany/euro core"
  FR: "B", // §2 Band B anchor economy "Germany/euro core" (84.1)
  NL: "B", // §2 Band B anchor economy "Germany/euro core" (84.1)
  AT: "B", // §2 Band B anchor economy "Germany/euro core" (84.1)
  BE: "B", // §2 Band B anchor economy "Germany/euro core" (84.1)
  JP: "C", // price level 69.2, in the C range; §2 anchor economy
  ES: "C", // price level 67.5, in the C range; §2 anchor economy
  ZA: "D", // price level 44.9, in the D range; §2 anchor economy
  BR: "D", // price level 51.1, in the D range; §2 anchor economy
  PL: "D", // price level 54.3, in the D range; §2 anchor economy
  TR: "E", // price level 39.1, in the E range; §2 anchor economy
  PH: "E", // price level 37.4, in the E range; §2 anchor economy
  ID: "E", // price level 33.2, in the E range; §2 anchor economy
  IN: "F", // price level 27.1, under 30; §2 anchor economy
  MX: "F", // Ilse's word, 15 Oct 2026 (§2): Band F, over its 60.1 price level
  // The remaining country packs (IE, IT, DK, NO, SE, CH, HK, AE)
  // have no sourced band: the PPP table covers 16 countries and
  // none of them is in it. They default to the A$ anchors below.
};

// The band anchor economies that are not country packs still
// answer to their English names as well as their ids.
const NAME_TO_ID = {
  Brazil: "BR", Poland: "PL", "Türkiye": "TR", Turkey: "TR",
  Philippines: "PH", Indonesia: "ID", India: "IN", Mexico: "MX",
};

// Accepts a pack id ("DE"), a pack name ("Germany"), or null.
// Returns the band letter, or null when no band is sourced.
export function countryToBand(country) {
  if (!country) return null;
  const pack = packById(country) || packByName(country);
  const id = pack ? pack.id : (NAME_TO_ID[country] || String(country).toUpperCase());
  return COUNTRY_BAND[id] || null;
}

// Round half up to two decimals, the way Finance's own worked
// examples round (GLOBAL-PRICING §2: A$6.99 × 0.35 ≈ A$2.45).
const round2 = (x) => Math.round((x + 1e-9) * 100) / 100;

// priceFor("finding", "Germany") →
//   { display: "€7.99", worth: "A$13.46", band: "B", currency: "EUR" }
// Australia, an unsourced country, and an unknown country all
// show the A$ anchor itself, with no worth line: the price IS
// in Australian dollars there.
export function priceFor(plan, country) {
  const anchor = ANCHORS[plan];
  if (anchor == null) return null;
  const pack = packById(country || "") || packByName(country || "");
  const isAU = pack ? pack.id === "AU" : String(country || "").toUpperCase() === "AU";
  const band = countryToBand(country);
  if (isAU || !band) {
    return { display: ANCHOR_DISPLAY[plan], worth: null, band: isAU ? "A" : null, currency: "AUD" };
  }
  const b = BANDS[band];
  return {
    display: b.display[plan],
    worth: "A$" + round2(anchor * b.factor).toFixed(2),
    band,
    currency: b.currency,
  };
}

// Swap the A$ anchor figure inside a composed sentence for the
// viewer's own band price, with the worth phrase tucked beside
// it: "Finding is €7.99 (worth A$13.46) a month, and you can
// stop any time." For Australia and unsourced countries the
// sentence stands exactly as written, so the gate passed copy
// reads word for word. worthPhrase is the caller's localised
// "worth {worth}" line, or null to show the price alone.
export function localiseSentence(sentence, plan, country, worthPhrase) {
  const p = priceFor(plan, country);
  if (!p || !p.worth || !sentence.includes(ANCHOR_DISPLAY[plan])) return sentence;
  const swap = worthPhrase ? `${p.display} (${worthPhrase})` : p.display;
  return sentence.replace(ANCHOR_DISPLAY[plan], swap);
}
