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
    summary: "For an extended holiday with work; applicants need a passport from an eligible country or jurisdiction. Check the official page for the current passport list and conditions.",
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
    summary: "The permit is for a temporary exchange through an au pair agency recognised by the IND. The page describes age and host-family conditions and a maximum one-year permit.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "Spain",
    officialUrl: "https://www.exteriores.gob.es/Consulados/washington/en/ServiciosConsulares/Paginas/Consular/Au-Pair-visa.aspx",
    programName: "Au pair / study visa guidance (Washington consular page)",
    summary: "This consular page says au-pair visas are no longer a distinct study-visa category under its cited rules; an applicant may seek a study visa if they meet study requirements and provide an au pair contract.",
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
    summary: "IEC is for work and travel by youth from partner countries; age ranges vary by country. The official page says the 2026 pools are closed, though invited applicants can still apply.",
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
    summary: "UDI says the au pair scheme ended on 15 March 2024. Only people with qualifying existing applications or permits may have the limited application or renewal options described on the page.",
    lastChecked: "2026-11-04",
    checked: true,
  },
  {
    destination: "Sweden",
    officialUrl: "https://www.migrationsverket.se/en/you-want-to-apply/work/temporary-work-in-sweden/au-pairs.html",
    programName: "Residence permit to work as an au pair",
    summary: "The Migration Agency describes an au pair residence permit with age, written-agreement, work-and-study limits, and a maximum one-year stay that cannot be extended.",
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
