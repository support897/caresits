// USAGE: import WWCC_CHECKS to show the official child-safety check for a selected Australian state or territory.
import { t } from "./tr.js";

export const WWCC_CHECKS = [
  { state: t("wwcc.state.act", "Australian Capital Territory"), name: t("wwcc.name.act", "Working with Vulnerable People (WWVP) registration"), officialUrl: "https://www.accesscanberra.act.gov.au/business-and-work/working-with-vulnerable-people/working-with-vulnerable-people-scheme", lastChecked: "2026-11-04" },
  { state: t("wwcc.state.nsw", "New South Wales"), name: t("wwcc.name.nsw", "Working with Children Check (WWCC)"), officialUrl: "https://ocg.nsw.gov.au/working-children-check/applicant", lastChecked: "2026-11-04" },
  { state: t("wwcc.state.nt", "Northern Territory"), name: t("wwcc.name.nt", "Working with Children Clearance (WWCC; Ochre Card)"), officialUrl: "https://nt.gov.au/emergency/child-safety/working-with-children-clearance/wwcc-before-you-apply", lastChecked: "2026-11-04" },
  { state: t("wwcc.state.qld", "Queensland"), name: t("wwcc.name.qld", "Blue Card (Queensland's Working with Children Check)"), officialUrl: "https://www.qld.gov.au/jobs/blue-card-services", lastChecked: "2026-11-04" },
  { state: t("wwcc.state.sa", "South Australia"), name: t("wwcc.name.sa", "Working with Children Check (WWCC)"), officialUrl: "https://www.sa.gov.au/topics/rights-and-law/rights-and-responsibilities/screening-checks/screening-wwcc/for-individuals/apply-for-a-check", lastChecked: "2026-11-04" },
  { state: t("wwcc.state.tas", "Tasmania"), name: t("wwcc.name.tas", "Registration to Work with Vulnerable People (RWVP)"), officialUrl: "https://www.justice.tas.gov.au/rwvp", lastChecked: "2026-11-04" },
  { state: t("wwcc.state.vic", "Victoria"), name: t("wwcc.name.vic", "Working with Children Check (WWC Check)"), officialUrl: "https://www.vic.gov.au/working-with-children-check", lastChecked: "2026-11-04" },
  { state: t("wwcc.state.wa", "Western Australia"), name: t("wwcc.name.wa", "Working with Children (WWC) Check"), officialUrl: "https://www.wa.gov.au/organisation/department-of-communities/working-children-check", lastChecked: "2026-11-04" },
];

export default WWCC_CHECKS;
