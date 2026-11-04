export type VisaPassportRules = { eligiblePassports: string[] };

export type VisaSource = {
  destination: string;
  officialUrl: string;
  programName: string;
  summary: string;
  lastChecked: string;
  checked: boolean;
  passportRules?: VisaPassportRules;
};

// Government pages checked on 2026-11-04. Summaries stay within the page text read.
// No passportRules are asserted: the exact eligible-passport rules were not verified per passport.
export const VISA_SOURCES: VisaSource[] = [
  {
    destination: "Australia",
    officialUrl: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-holiday-417",
    programName: "Working Holiday visa (subclass 417)",
    summary: "This is a general working-holiday route, not an au-pair-specific visa. The first stay is 12 months; applicants need an eligible passport, must be 18–30 (35 for some countries), and cannot bring dependent children. Work is allowed; check the official page for the current passport list and conditions.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "New Zealand",
    officialUrl: "https://www.immigration.govt.nz/work/working-holiday-visas/",
    programName: "Working holiday visas",
    summary: "Young people from recognised countries can work and travel, normally for up to 12 months. Scheme requirements differ; check the official page.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "United Kingdom",
    officialUrl: "https://www.gov.uk/au-pairs-employment-law/au-pairs",
    programName: "Au pair right-to-work guidance and Youth Mobility Scheme",
    summary: "The page lists UK or Irish nationals, some EU Settlement Scheme cases, and Youth Mobility Scheme visa holders; otherwise check the person's visa conditions. Visitor visas do not allow au pair hiring.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "Ireland",
    officialUrl: "https://www.irishimmigration.ie/coming-to-work-in-ireland/what-are-my-options-for-working-in-ireland/coming-to-work-for-more-than-90-days/",
    programName: "Working Holiday Authorisation Programme",
    summary: "The programme lets young people fund an extended holiday through temporary work; only certain nationalities may use it. The page does not list those nationalities.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "Germany",
    officialUrl: "https://www.make-it-in-germany.com/en/visa-recognition/apply-for-visa",
    programName: "General visa and residence-permit guidance",
    summary: "The official page says visa needs depend on nationality and purpose, and describes entry and residence permits. It does not describe an au pair pathway.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "France",
    officialUrl: "https://www.france-visas.gouv.fr/en/web/france-visas/jeune-au-pair",
    programName: "Young au pair long-stay visa",
    summary: "The page describes an au pair agreement, basic French or relevant education, and a one-year long-stay visa that may extend to two years. It gives an age range of 18 to 30.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "Netherlands",
    officialUrl: "https://ind.nl/en/residence-permits/au-pair-and-exchange/residence-permit-au-pair",
    programName: "Residence permit for au pair",
    summary: "Applicants must be 18–25 and apply through an au pair agency recognised by the IND. The permit allows light household tasks for up to 30 hours a week, lasts at most one year, and cannot be extended.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "Spain",
    officialUrl: "https://www.exteriores.gob.es/Consulados/washington/en/ServiciosConsulares/Paginas/Consular/Au-Pair-visa.aspx",
    programName: "Au pair / study visa guidance (Washington consular page)",
    summary: "This Washington consular page says au-pair study visas are no longer a distinct category under rules in force from 20 May 2025. It describes a possible student-visa route with at least 20 study hours a week, an age range of 17–30, and an au pair contract; check the relevant Spanish consulate for your case.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "Italy",
    officialUrl: "https://vistoperitalia.esteri.it/?lang=en_US",
    programName: "Visa for Italy (general guidance)",
    summary: "The official visa tool uses nationality, residence, purpose, and stay length. The page says its information is indicative and does not describe a distinct au pair pathway.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "Canada",
    officialUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/iec.html",
    programName: "International Experience Canada (IEC)",
    summary: "IEC is a work-and-travel route for partner countries. The page says ages are generally 18–35 (18–30 for some countries); 2026 pools are closed, but invited applicants can still submit an application. This is not an au-pair-specific route.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "United States",
    officialUrl: "https://j1visa.state.gov/programs/au-pair/",
    programName: "BridgeUSA J-1 Au Pair program",
    summary: "The State Department page describes program age, English, education, sponsor screening, childcare-hour, and study requirements. A designated program sponsor is part of the route.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "Denmark",
    officialUrl: "https://nyidanmark.dk/en-GB/You-want-to-apply/Au-pair/",
    programName: "Au pair residence permit",
    summary: "The official page describes a cultural-exchange residence permit, a signed agreement, age and host-family conditions, and a maximum two-year stay.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "Norway",
    officialUrl: "https://www.udi.no/en/want-to-renew/au-pair/",
    programName: "Au pair scheme (discontinued)",
    summary: "UDI says the scheme ended on 15 March 2024. Initial permits were limited to applications registered and appointments booked by that date; only some people with existing permits can renew within the two-year limit.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "Sweden",
    officialUrl: "https://www.migrationsverket.se/en/you-want-to-apply/work/temporary-work-in-sweden/au-pairs.html",
    programName: "Residence permit to work as an au pair",
    summary: "For applicants outside the EU/EEA, the page says applicants must be 18–29 when a decision is made, work no more than 25 hours a week, and study Swedish. The permit lasts at most one year and cannot be extended.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "Switzerland",
    officialUrl: "https://www.sem.admin.ch/sem/en/home/themen/arbeit/nicht-eu_efta-angehoerige/grundlagen_zur_arbeitsmarktzulassung.html",
    programName: "Au pair admission for third-country nationals",
    summary: "SEM describes au pairs from third countries aged 18 to 25, for up to 12 months, with placements arranged through a Swiss-recognised organisation.",
    lastChecked: "2026-11-04",
    checked: true,
  },
];

export function visaSourceFor(destination: string): VisaSource | undefined {
  const normalized = destination.trim().toLocaleLowerCase();
  return VISA_SOURCES.find((source) => source.destination.toLocaleLowerCase() === normalized);
}
