// Caresitters Country Packs — the country layer as data (§11 + §12).
// Every check name, fee and register fact below comes from
// next-phase/COUNTRY-PACKS-REFRESH-2026-10-17.md (official sources,
// re-verified 17 Oct 2026) and PHASE1-RESEARCH.md §11.3 + §12
// (status checked Oct 2026). The source is cited per cell in the
// comments. Anything an official page did not state is carried in
// the pack's cnv list and never stated in the app as a fact.
//
// The badge rule (§11.1): "Register verified" may only be shown
// where a free official register exists. In the refresh, free
// official online validity checkers were confirmed for 7 of
// Australia's 8 jurisdictions (the ACT confirms by email instead)
// and for NO other country. So register is true at country level
// for Australia alone; everywhere else the strongest honest badge
// is "Document sighted".
//
// The US caution (§12.5): the au pair stipend figure is a formula
// whose room and board credit is litigated. The US pack carries
// caution: true and NO stipend figure anywhere. Never add one.

export const COUNTRIES = [
  {
    id: "AU", name: "Australia",
    // Refresh, Australia headline: all 8 jurisdictions confirmed.
    checkName: "Working With Children Check",
    register: true,
    costText: "Verifying a check a carer already holds is free in every state and territory. Getting one for paid work costs from $87 to $163, by state.",
    costVerified: true,
    checkUrl: "",
    aupairScheme: false,
    // §11.3 AU row (no scheme; 417/462 visas) + §12.1 AU warning.
    aupairNote: "Australia has no au pair scheme. People come on working holiday visas, and when the work is really a job, employee pay rules apply.",
    caution: false,
    cnv: ["ACT: whether any free public online checker exists for WWVP registration"],
    jurisdictions: [
      // Refresh NSW row: $112 paid / free volunteer; free status checker.
      { id: "NSW", name: "New South Wales", checkName: "Working With Children Check", register: true,
        costText: "$112 for paid work. Free for volunteers.",
        checkUrl: "https://www.service.nsw.gov.au/transaction/check-working-children-check-status",
        postcodes: [[2000, 2599], [2619, 2899], [2921, 2999]] },
      // Refresh ACT row: $163 per DI2026-85 (the consumer page still
      // shows last year's $157); validity confirmed by email only.
      { id: "ACT", name: "Australian Capital Territory", checkName: "Working with Vulnerable People registration", register: false,
        costText: "$163 for 2026 to 2027. Free for volunteers. Access Canberra confirms a check by email. No public online checker could be verified.",
        checkUrl: "https://www.accesscanberra.act.gov.au/business-and-work/working-with-vulnerable-people/wwvp-compliance-and-reporting",
        postcodes: [[2600, 2618], [2900, 2920]] },
      // Refresh VIC row: $139.20 employee, renewal $105.30, free volunteer.
      { id: "VIC", name: "Victoria", checkName: "Working With Children Check", register: true,
        costText: "$139.20 for paid work. Free for volunteers. Renewal costs $105.30.",
        checkUrl: "https://service.vic.gov.au/services/working-with-children-check-status-checker/home",
        postcodes: [[3000, 3999]] },
      // Refresh QLD row: $108.30 paid from 1 Jul 2026; free volunteer,
      // student and exemption cards; free validity checker.
      { id: "QLD", name: "Queensland", checkName: "Blue Card", register: true,
        costText: "$108.30 for paid work. Free for volunteers, students and exemption cards.",
        checkUrl: "https://www.qld.gov.au/jobs/blue-card/organisations/valid",
        postcodes: [[4000, 4999]] },
      // Refresh SA row: $145 employee / free volunteer / students $73.50.
      { id: "SA", name: "South Australia", checkName: "Working with Children Check", register: true,
        costText: "$145 for paid work. Free for volunteers. Tertiary students pay $73.50.",
        checkUrl: "https://www.sa.gov.au/topics/rights-and-law/rights-and-responsibilities/screening-checks/apply-for-a-screening-check/verify-an-existing-check",
        postcodes: [[5000, 5999]] },
      // Refresh WA row: $87 paid / $11 volunteer; free Card Validation.
      { id: "WA", name: "Western Australia", checkName: "Working With Children Check (WWC Card)", register: true,
        costText: "$87 for paid work. $11 for volunteers.",
        checkUrl: "https://workingwithchildren.wa.gov.au/card-validation",
        postcodes: [[6000, 6999]] },
      // Refresh TAS row: $137.20; volunteer only registration free
      // under a 2 year fee relief measure from 1 Jan 2026.
      { id: "TAS", name: "Tasmania", checkName: "Registration to Work with Vulnerable People", register: true,
        costText: "$137.20 for work. Volunteer only registration is free under a two year fee relief measure that began on 1 January 2026.",
        checkUrl: "https://www.cbos.tas.gov.au/topics/licensing-and-registration/work-with-vulnerable-people/check-the-status-of-application-or-registration",
        postcodes: [[7000, 7999]] },
      // Refresh NT row: $89 paid / $8 volunteer; free online check.
      { id: "NT", name: "Northern Territory", checkName: "Working with Children Clearance (Ochre Card)", register: true,
        costText: "$89 for paid work. $8 for volunteers.",
        checkUrl: "https://nt.gov.au/emergency/community-safety/apply-for-a-working-with-children-clearance",
        postcodes: [[800, 999]] },
    ],
  },
  {
    id: "US", name: "United States",
    // Refresh USA row: FBI summary US$18; hires run through state bureaus.
    checkName: "FBI Identity History Summary Check",
    register: false,
    costText: "US$18 per person to the FBI. State checks vary, and each state sets its own price.",
    costVerified: true,
    checkUrl: "https://www.fbi.gov/how-we-can-help-you/more-fbi-services-and-information/identity-history-summary-checks",
    // §11.3 USA row: J-1 Au Pair scheme, designated sponsor mandatory.
    aupairScheme: true,
    aupairNote: null,
    // §12.5: the stipend is litigated. No figure, ever.
    caution: true,
    cnv: ["Au pair sponsor and visa fee amounts"],
  },
  {
    id: "CA", name: "Canada",
    // Refresh Canada row: local police VSC; Toronto C$71.72 / C$26.72;
    // federal fingerprint fee C$25 when triggered.
    checkName: "Vulnerable Sector Check",
    register: false,
    costText: "The price varies by local police service. Toronto charges C$71.72 for paid work and C$26.72 for volunteers. Fingerprints, when needed, add a federal fee of C$25.",
    costVerified: true,
    checkUrl: "https://rcmp.ca/en/criminal-records/criminal-record-checks/vulnerable-sector-checks",
    // §11.3 Canada row: no au pair scheme (IEC Working Holiday instead).
    aupairScheme: false,
    aupairNote: null,
    caution: false,
    cnv: ["The top of the old C$81 range: the highest official figure found in the refresh was C$76"],
  },
  {
    id: "UK", name: "United Kingdom",
    // Refresh UK row: enhanced DBS £41 from 5 Oct 2026; volunteers
    // free; Update Service £15 a year; no public register.
    checkName: "Enhanced DBS check",
    register: false,
    costText: "£41 for paid work. Free for volunteers. The DBS Update Service costs £15 a year.",
    costVerified: true,
    checkUrl: "https://www.gov.uk/government/news/dbs-reduces-fees-for-checks-and-update-service-from-5-october-2026",
    // §11.3 UK row: no au pair scheme; NMW applies to au pairs.
    aupairScheme: false,
    aupairNote: "The United Kingdom has no au pair scheme, and minimum wage law applies to au pairs who live in. Pay here works as a wage.",
    caution: false,
    cnv: ["Whether a legal DBS duty exists for a direct private hire"],
  },
  {
    id: "IE", name: "Ireland",
    // Refresh Ireland row: free for childcare from 1 Feb 2025, via a
    // registered organisation only; no register.
    checkName: "Garda Vetting",
    register: false,
    costText: "Free for childcare roles since 1 February 2025. Only a registered organisation can apply. A person cannot apply for their own.",
    costVerified: true,
    checkUrl: "https://www.garda.ie/en/about-us/our-departments/office-of-corporate-communications/news-media/news-archive/vetting-process-information-16-3-22.html",
    // §11.3 Ireland row: no au pair visa, no employment permit for
    // private home domestic work.
    aupairScheme: false,
    aupairNote: null,
    caution: false,
    cnv: ["A standalone gov.ie page stating the 1 February 2025 fee change"],
  },
  {
    id: "DE", name: "Germany",
    // Refresh Germany row: Erweitertes Führungszeugnis, €13, no register.
    checkName: "Erweitertes Führungszeugnis (extended certificate of conduct)",
    register: false,
    costText: "€13.",
    costVerified: true,
    checkUrl: "https://www.fuehrungszeugnis.bund.de",
    // §11.3 + §12.5 Germany: scheme sets pocket money €280 a month;
    // the family adds €70 a month toward a language course.
    aupairScheme: true,
    aupairNote: "The scheme sets pocket money at €280 a month, and the family adds €70 a month toward a language course.",
    caution: false,
    cnv: ["Whether the extended certificate is mandatory for au pairs"],
  },
  {
    id: "FR", name: "France",
    // Refresh France row: Bulletin n°3, free in all cases.
    checkName: "Bulletin n°3 du casier judiciaire",
    register: false,
    costText: "Free.",
    costVerified: true,
    checkUrl: "https://www.service-public.gouv.fr/particuliers/vosdroits/F1420",
    // §11.3 France row: jeune au pair permit; pocket money min €320/mo.
    aupairScheme: true,
    aupairNote: "The scheme sets pocket money at a minimum of €320 a month.",
    caution: false,
    cnv: ["Whether a criminal certificate is mandatory for au pairs"],
  },
  {
    id: "NL", name: "Netherlands",
    // Refresh Netherlands row: VOG €33.85 online / €41.35 paper;
    // Free VOG scheme for volunteers with vulnerable people.
    checkName: "VOG (Verklaring Omtrent het Gedrag)",
    register: false,
    costText: "€33.85 online, or €41.35 on paper. Volunteers who work with vulnerable people are usually free under the Free VOG scheme.",
    costVerified: true,
    checkUrl: "https://sdg.government.nl/government-services-in-the-netherlands/applying-verklaring-omtrent-het-gedrag-vog-in-the-netherlands/municipality-enschede",
    // §11.3 Netherlands row: recognised sponsor agency mandatory;
    // pocket money capped €300 to €340 a month.
    aupairScheme: true,
    aupairNote: "A recognised agency must run the placement. Pocket money is capped between €300 and €340 a month.",
    caution: false,
    cnv: ["The statutory split of agency route fees"],
  },
  {
    id: "DK", name: "Denmark",
    // Refresh Denmark row: straffeattest free; child work variant
    // Børneattest is employer ordered with consent.
    checkName: "Straffeattest (Børneattest for child work)",
    register: false,
    costText: "Free.",
    costVerified: true,
    checkUrl: "https://politi.dk/en/certificate-of-criminal-record",
    // §11.3 Denmark row: scheme active; pocket money min DKK 5,250/mo (2026).
    aupairScheme: true,
    aupairNote: "The scheme sets pocket money at a minimum of DKK 5,250 a month (2026).",
    caution: false,
    cnv: ["A Børneattest specific fee"],
  },
  {
    id: "NO", name: "Norway",
    // Refresh Norway row: politiattest; the fee could not verify on
    // the official page. No figure is stated.
    checkName: "Politiattest (Barneomsorgsattest for child work)",
    register: false,
    costText: "Could not verify. Check the official source before relying on any figure.",
    costVerified: false,
    checkUrl: "https://www.politiet.no/english/police-certificate-of-conduct/apply-for-police-certificate-of-conduct-as-a-private-individual",
    // §11.3 Norway row: scheme ABOLISHED for non EEA from 15 Mar 2024.
    aupairScheme: false,
    aupairNote: "Norway closed its au pair scheme in 2024. There is no au pair route. A nanny here is an employee, paid a wage.",
    caution: false,
    cnv: ["The politiattest fee"],
  },
  {
    id: "SE", name: "Sweden",
    // Refresh Sweden row: domestic extracts free incl. child work;
    // extracts for use abroad SEK 255.
    checkName: "Utdrag ur belastningsregistret (record extract)",
    register: false,
    costText: "Free for extracts used in Sweden. An extract for use abroad costs SEK 255.",
    costVerified: true,
    checkUrl: "https://polisen.se/en/services-and-permits/police-record-extracts",
    // §11.3 Sweden row: permit scheme; pay at least 10 percent of
    // the price base amount a month (2026 figure could not verify,
    // so no figure is stated).
    aupairScheme: true,
    aupairNote: "Pay is at least 10 percent of the price base amount each month. The current figure could not verify, so check the official source.",
    caution: false,
    cnv: ["The 2026 price base amount figure", "Whether a criminal certificate is mandatory for au pairs"],
  },
  {
    id: "ES", name: "Spain",
    // Refresh Spain row: two certificates; Antecedentes Penales
    // €3.86; the sexual offences certificate fee could not verify.
    checkName: "Certificado de Delitos de Naturaleza Sexual and Certificado de Antecedentes Penales",
    register: false,
    costText: "The Antecedentes Penales certificate costs €3.86. The fee for the sexual offences certificate could not verify.",
    costVerified: true,
    checkUrl: "https://sede.mjusticia.gob.es/es/tramites/certificado-registro-central",
    // §11.3 Spain row: no au pair visa; student visa route; the
    // agreement states the pocket money (no statutory floor found).
    aupairScheme: false,
    aupairNote: "Spain has no au pair visa. Au pairs come on a student route, and the signed agreement states the pocket money.",
    caution: false,
    cnv: ["The sexual offences certificate fee"],
  },
  {
    id: "IT", name: "Italy",
    // Refresh Italy row: €19.92 standard; same day urgency adds €3.92.
    checkName: "Certificato del casellario giudiziale",
    register: false,
    costText: "€19.92. Same day urgency adds €3.92.",
    costVerified: true,
    checkUrl: "https://www.giustizia.it/giustizia/page/en/come_fare_per_certificato_casellario_giudiziale?tab=e",
    // §11.3 Italy row: no general au pair scheme.
    aupairScheme: false,
    aupairNote: null,
    caution: false,
    cnv: ["National hours and pocket money floors for au pairs", "Route fees"],
  },
  {
    id: "AT", name: "Austria",
    // Refresh Austria row: €26 paper / €18 electronic; the special
    // child and youth certificate €29.
    checkName: "Strafregisterbescheinigung (special child and youth version)",
    register: false,
    costText: "€26 on paper, or €18 online. The special child and youth certificate costs €29.",
    costVerified: true,
    checkUrl: "https://www.oesterreich.gv.at/en/themen/persoenliche_dokumente_und_bestaetigungen/strafregister/Seite.300020",
    // §11.3 Austria row: authorised agency + AMS notification;
    // a minimum pay scale applies (official current figure could
    // not verify, so no figure is stated).
    aupairScheme: true,
    aupairNote: "An authorised agency and an AMS notification run the placement. A minimum pay scale applies. Its current official figure could not verify, so check the official source.",
    caution: false,
    cnv: ["The current official au pair minimum pay figure", "Who pays the agency fee"],
  },
  {
    id: "BE", name: "Belgium",
    // Refresh Belgium row: free from central issuance; a commune
    // level fee for the 596.2 extract could not verify.
    checkName: "Extrait de casier judiciaire, modèle 596.2",
    register: false,
    costText: "Free from central issuance. A small fee at some communes could not verify.",
    costVerified: true,
    checkUrl: "https://www.uccle.be/en/node/104",
    // §11.3 + §12.5 Belgium: pocket money min €450 a month, paid
    // by bank transfer; a language course is mandatory.
    aupairScheme: true,
    aupairNote: "Pocket money is at least €450 a month, paid by bank transfer, and a language course is part of the placement.",
    caution: false,
    cnv: ["Whether any commune charges a fee for the 596.2 extract", "Permit fees, which vary by region"],
  },
  {
    id: "CH", name: "Switzerland",
    // Refresh Switzerland row: CHF 17 per extract, both kinds.
    checkName: "Extrait du casier judiciaire (criminal record extract)",
    register: false,
    costText: "CHF 17 per extract.",
    costVerified: true,
    checkUrl: "https://www.e-service.admin.ch/crex/cms/content/strafregister/privatauszug_en",
    // §11.3 Switzerland row: cantonal permits; pocket money follows
    // cantonal scales around CHF 500 to CHF 800 a month; a language
    // course of 120 hours a year is mandatory.
    aupairScheme: true,
    aupairNote: "Pocket money follows the canton scale, around CHF 500 to CHF 800 a month, and a language course of 120 hours a year is part of the placement.",
    caution: false,
    cnv: ["Agency fees", "SEM direct age limits"],
  },
  {
    id: "NZ", name: "New Zealand",
    // Refresh NZ row: Police vetting NZ$8.50+GST charged to the
    // agency; no fee at 20 or fewer requests a year; charity
    // waivers; individuals cannot request it; no public register.
    checkName: "Police vetting (Children's Act safety check)",
    register: false,
    costText: "NZ$8.50 plus GST per request, charged to the agency. There is no fee at 20 or fewer requests a year, and registered charities can be waived. A person cannot request vetting for themselves.",
    costVerified: true,
    checkUrl: "https://www.police.govt.nz/advice-services/businesses-and-organisations/nz-police-vetting-service/fees-charges-and-payments",
    // §11.3 NZ row: no au pair scheme (Working Holiday Visa instead).
    aupairScheme: false,
    aupairNote: null,
    caution: false,
    cnv: ["Whether the Children's Act safety check is a legal duty for a private home", "The Working Holiday Visa fee"],
  },
  {
    id: "JP", name: "Japan",
    // Refresh Japan row (CORRECTED): the police certificate exists
    // and is free, but only for submission to foreign government
    // institutions, never for a private employer.
    checkName: "Police Certificate (Keisatsu Shomei)",
    register: false,
    costText: "Free. It can only be issued for a foreign government, never for a private family, so a family cannot ask a carer for one.",
    costVerified: true,
    checkUrl: "https://www.la.us.emb-japan.go.jp/itpr_en/m02_03_07.htm",
    // §11.3 Japan row: no scheme; Working Holiday only.
    aupairScheme: false,
    aupairNote: null,
    caution: false,
    cnv: ["The reported new employer run child work check and its start date", "Whether a nanny licence exists", "Whether a medical exam is mandatory"],
  },
  {
    id: "HK", name: "Hong Kong",
    // Refresh Hong Kong row: SCRC is the child work check,
    // HK$145 new / HK$76 renewal; CNCC (visa and adoption only)
    // is now HK$340.
    checkName: "Sexual Conviction Record Check (SCRC)",
    register: false,
    costText: "The SCRC costs HK$145 new, or HK$76 to renew. The CNCC certificate, for visa and adoption use only, costs HK$340.",
    costVerified: true,
    checkUrl: "https://www.police.gov.hk/ppp_en/11_useful_info/scrc.html",
    // §11.3 Hong Kong row: Foreign Domestic Helper scheme on the
    // government standard contract; helpers are paid a salary, so
    // pay here is a wage, not pocket money.
    aupairScheme: false,
    aupairNote: null,
    caution: false,
    cnv: ["Whether a named criminal certificate product exists for the helper scheme", "Whether a pre employment medical exam is an immigration rule"],
  },
  {
    id: "AE", name: "United Arab Emirates",
    // Refresh UAE row: MOI clearance AED 50 inside / AED 100
    // outside the UAE; Dubai Police's own tariff could not verify.
    checkName: "Criminal Clearance Certificate (Ministry of Interior)",
    register: false,
    costText: "AED 50 for use inside the UAE. AED 100 for use outside.",
    costVerified: true,
    checkUrl: "https://u.ae/en/information-and-services/justice-safety-and-the-law/justice-eservices-and-updates",
    // §11.3 UAE row: no au pair scheme; Domestic Workers Law.
    aupairScheme: false,
    aupairNote: null,
    caution: false,
    cnv: ["Dubai Police's own clearance tariff", "Whether a UAE police clearance is required for incoming domestic workers", "An official total fee schedule"],
  },
  {
    id: "ZA", name: "South Africa",
    // Refresh South Africa row: SAPS clearance R190 per application.
    checkName: "SAPS Police Clearance Certificate",
    register: false,
    costText: "R190 per application.",
    costVerified: true,
    checkUrl: "https://www.saps.gov.za/services/applying_clearence_certificate.php",
    // §11.3 South Africa row: no scheme; general work visa only.
    aupairScheme: false,
    aupairNote: null,
    caution: false,
    cnv: ["Whether any state police clearance mandate exists for a local hire"],
  },
];

export const COUNTRY_NAMES = COUNTRIES.map((c) => c.name);

export const packById = (id) => COUNTRIES.find((c) => c.id === id) || null;
export const packByName = (name) => COUNTRIES.find((c) => c.name === name) || null;

// Australia: the check name, fee and register live at jurisdiction
// level. Postcode ranges are the standard published allocations
// (Australia Post state ranges; the ACT ranges sit inside the NSW
// span and are listed as their own ranges, so order never matters).
export function auJurisdiction(postcode) {
  const n = Number(String(postcode || "").replace(/\D/g, ""));
  if (!n) return null;
  const au = packById("AU");
  for (const j of au.jurisdictions) {
    if (j.postcodes.some(([lo, hi]) => n >= lo && n <= hi)) return j;
  }
  return null;
}

// Resolve the check facts a surface should speak for a pack: for
// Australia with a known postcode, the jurisdiction's own name,
// fee and register kind; otherwise the country level facts.
export function checkFor(pack, postcode) {
  if (!pack) return null;
  if (pack.id === "AU") {
    const j = auJurisdiction(postcode);
    if (j) return { name: j.checkName, costText: j.costText, checkUrl: j.checkUrl, register: j.register, place: j.name };
  }
  return { name: pack.checkName, costText: pack.costText, checkUrl: pack.checkUrl, register: pack.register, place: null };
}
