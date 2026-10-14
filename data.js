/* Nanny App data. Country packs from PHASE1 RESEARCH section 11. Roles from section 12.
   Plain words only in anything a person reads. No safety promise is made anywhere. */
"use strict";

var COUNTRIES = [
  { code: "AU", name: "Australia", flag: "🇦🇺", scheme: "No au pair visa. Au pairs use a Working Holiday visa (417 or 462).",
    mandatory: ["State Working With Children Check or Blue Card for sole charge care (platform rule; checking a number is free on the official register)", "Right to work checked on VEVO", "If the carer is an employee: pay at or above the National Minimum Wage, $26.44 an hour from 1 July 2026"],
    optional: ["Police check (one point in time only)", "First aid course HLTAID012", "References that the family has phoned"],
    payNote: "Nannies are usually employees. Calling pay pocket money does not change that. Check the free Fair Work Pay and Conditions Tool for your case." },
  { code: "US", name: "United States", flag: "🇺🇸", scheme: "Au pairs come only through the J-1 Au Pair program with a named sponsor. There is no direct hire au pair route.",
    mandatory: ["Placement through a designated J-1 sponsor", "Sponsor background check, 3 references and training before placement", "J-1 health insurance for the whole stay", "Private bedroom, room and board", "At most 45 hours a week and 10 hours a day"],
    optional: ["Child CPR and first aid certificate", "INA nanny credential", "Newborn care training"],
    payNote: "The weekly stipend is worked out from the federal minimum wage. State rules can be higher. The sponsor confirms the right figure." },
  { code: "CA", name: "Canada", flag: "🇨🇦", scheme: "No au pair program. Most au pairs use the IEC Working Holiday open work permit.",
    mandatory: ["Valid work permit, checked by the family", "Health insurance for the whole stay (IEC rule)", "From abroad: police certificate and immigration medical exam when IRCC asks"],
    optional: ["Vulnerable Sector Check (the top trust paper in Canada)", "Standard First Aid with CPR C", "Early childhood education certificate"],
    payNote: "Provincial minimum wage applies. The parent is an employer and deducts tax, CPP and EI." },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", scheme: "No au pair visa. Carers must be UK or Irish citizens, hold settled or pre settled status, or hold a Youth Mobility visa.",
    mandatory: ["Employer right to work check", "National Minimum Wage applies to au pairs too (the live in family worker exemption ended on 1 April 2024)", "Employers liability insurance", "Accommodation counted toward minimum wage is capped at £11.10 a day"],
    optional: ["Voluntary Ofsted registration (lets parents pay with Tax Free Childcare)", "12 hour paediatric first aid", "Enhanced DBS on the Update Service"],
    payNote: "A DBS check is not a legal must for a direct private hire. It is market standard. Enhanced DBS costs £41 and is free for volunteers." },
  { code: "IE", name: "Ireland", flag: "🇮🇪", scheme: "No au pair visa and no work permit for private home domestic work. EEA and UK citizens move freely. Others use a student or Working Holiday permission.",
    mandatory: ["If employed (the usual reality): National Minimum Wage, €14.15 an hour for age 20 plus from 1 January 2026", "A family paying €40 a week or more registers as an employer with Revenue"],
    optional: ["Garda vetting through an agency or organisation (free for the childcare sector)", "QQI Level 5 in Early Learning and Care", "Paediatric first aid"],
    payNote: "Garda vetting cannot be asked for by a person on their own. Only a registered organisation can send it in. It is free for childcare." },
  { code: "DE", name: "Germany", flag: "🇩🇪", scheme: "Formal au pair permit. An agency is recommended, not a must.",
    mandatory: ["Age 18 to 26, German level A1, German speaking host family", "Written au pair contract", "At most 30 hours a week", "Pocket money €280 a month plus €70 a month toward a language course", "Host family insures the au pair for sickness, pregnancy and accidents"],
    optional: ["Police certificate from home country", "Child first aid course", "Driving licence"],
    payNote: "Pocket money is fixed. It is paid in holidays and illness too." },
  { code: "FR", name: "France", flag: "🇫🇷", scheme: "Formal jeune au pair permit. An agency is not a must.",
    mandatory: ["Signed au pair agreement before entry", "Age 18 to 30", "At most 25 hours a week", "Pocket money at least €320 a month", "Social security set up by the host family, who bears the cost"],
    optional: ["PSC1 first aid", "CAP Petite Enfance", "Driving licence"],
    payNote: "Time to attend French classes must be built into the week." },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", scheme: "Formal au pair permit. Placement must go through an IND recognised sponsor agency.",
    mandatory: ["IND recognised sponsor agency (a family cannot sponsor on its own)", "Age 18 to 24, at most 1 year", "At most 30 hours a week and 8 hours a day", "Signed daily schedule for all 7 days", "Pocket money is capped at €300 to €340 a month"],
    optional: ["VOG certificate of good conduct", "Child first aid", "References"],
    payNote: "The au pair may never be asked to pay more than €34 in preparation costs." },
  { code: "DK", name: "Denmark", flag: "🇩🇰", scheme: "Formal au pair permit through SIRI. The scheme is live in 2026.",
    mandatory: ["Binding au pair contract, part of the permit application", "Age 18 to under 30", "18 to 30 hours a week", "Pocket money at least DKK 5,250 a month (2026)", "Host family documents 3 insurances and pays a one off DKK 20,900 language contribution"],
    optional: ["First aid", "Driving licence", "References"],
    payNote: "Pocket money is paid into the au pair's Danish bank account, also during illness." },
  { code: "NO", name: "Norway", flag: "🇳🇴", scheme: "The au pair scheme closed for new non EEA au pairs on 15 March 2024. There is no au pair route.",
    mandatory: ["A nanny is an employee under normal Norwegian work rules"],
    optional: ["First aid", "References"],
    payNote: "Do not plan an au pair stay in Norway. It is not a legal route any more." },
  { code: "SE", name: "Sweden", flag: "🇸🇪", scheme: "Formal au pair permit. The family sponsors. No agency is needed.",
    mandatory: ["Age 18 to under 30, at most 1 year, cannot be extended", "Signed agreement with the host family", "At most 25 hours a week of work; work plus Swedish study at most 40 hours", "Host accident insurance plus full health insurance for the au pair"],
    optional: ["First aid", "Driving licence", "Swedish course proof"],
    payNote: "Pay is at least 10 percent of the price base amount per month before tax." },
  { code: "ES", name: "Spain", flag: "🇪🇸", scheme: "No au pair visa. Non EU au pairs use a student visa with a Spanish course at a recognised school.",
    mandatory: ["Signed au pair agreement, at most 1 year, at most 5 hours a day", "Criminal record certificate", "Medical certificate for stays over 6 months", "Full health insurance for the whole stay"],
    optional: ["First aid", "Childcare qualification", "References"],
    payNote: "Pocket money is written in the agreement. There is no set legal floor." },
  { code: "IT", name: "Italy", flag: "🇮🇹", scheme: "No general au pair scheme. Entry sits inside youth exchange and working holiday agreements.",
    mandatory: ["The written agreement for the route used", "Household registers a domestic worker with INPS"],
    optional: ["Criminal record certificate from home country", "Medical certificate", "First aid"],
    payNote: "Hours and pocket money come from the agreement. There is no national au pair floor." },
  { code: "AT", name: "Austria", flag: "🇦🇹", scheme: "Formal au pair scheme. For non EU au pairs an authorised agency and an AMS notice are needed before the permit.",
    mandatory: ["Age 18 to 28, basic German shown by a certificate", "Written contract, at most 18 hours a week", "Social insurance registration (ASVG)", "Health cover shown if no agreement between the two countries covers it"],
    optional: ["Police certificate", "First aid", "Childcare experience"],
    payNote: "Pay follows the au pair minimum wage scale. The family pays half the German course fees in the model contract." },
  { code: "BE", name: "Belgium", flag: "🇧🇪", scheme: "Formal au pair scheme through a regional work permit. The family can sponsor. No agency is a must.",
    mandatory: ["Age 18 to under 26, standard au pair contract", "At most 20 hours a week and 4 hours a day", "Pocket money at least €450 a month, paid by bank transfer", "Language course at a recognised school, with attendance certificates", "Good conduct certificates for every adult in the host home, a medical certificate for the au pair, and host paid medical and repatriation insurance"],
    optional: ["First aid", "References", "Driving licence"],
    payNote: "Belgium checks the host side too. Every adult in the home gives a good conduct certificate." },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", scheme: "Formal cantonal au pair permits. Third country nationals must be placed through a SECO recognised agency.",
    mandatory: ["At most 30 hours a week", "Language course of 120 hours a year, in a language of the canton that is not the au pair's own", "Swiss health and accident insurance"],
    optional: ["First aid", "Childcare diploma", "Driving licence"],
    payNote: "Pocket money is set by canton, commonly CHF 500 to 800 a month before deductions. Health premiums are a real monthly cost." },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", scheme: "No au pair visa. Au pairs use a country Working Holiday visa.",
    mandatory: ["Working Holiday conditions for your passport country", "Full medical insurance for the whole stay", "Good character and health; Immigration NZ may ask for police certificates or a medical"],
    optional: ["Children's worker safety check through an agency (includes Police vetting)", "Paediatric first aid", "Full driver licence"],
    payNote: "Police vetting can only be sent in by an approved agency. A carer cannot order it on their own." },
  { code: "JP", name: "Japan", flag: "🇯🇵", scheme: "No au pair program. Working Holiday only, and work must stay a side part of the stay.",
    mandatory: ["Working Holiday eligibility for your passport country", "Good health and character"],
    optional: ["Japanese language skill (the biggest plus here)", "Childcare experience and references", "First aid"],
    payNote: "There is no Japan childcare check to add. Language and references carry the trust here." },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰", scheme: "Foreign Domestic Helper scheme. The government Standard Employment Contract (ID 407) is the only contract the scheme accepts.",
    mandatory: ["FDH visa tied to the named employer", "Work and live only at the address in the contract, only for that employer", "Pay at or above the Minimum Allowable Wage (HK$5,100 a month for contracts signed from 30 September 2025)", "Food given, or a food allowance of HK$1,236 a month", "Employer pays for medical treatment and the trip home at the end"],
    optional: ["Infant experience", "First aid", "Languages"],
    payNote: "The employer household must show income of at least HK$15,000 a month for each helper." },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", scheme: "No au pair scheme. Domestic Workers Law. Hiring goes through MOHRE channels or direct sponsorship.",
    mandatory: ["Medical fitness exam for the work contract and residence", "MOHRE work permit, residence visa and Emirates ID", "Employer gives housing, pays on time, and covers medical treatment or insurance"],
    optional: ["Tadbeer agency vetting and training", "First aid", "Driving licence"],
    payNote: "Costs sit with the employer or sponsor. There is no single official fee list for the whole hire." },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", scheme: "No au pair visa. Foreign carers need a general work visa, which is hard to get for domestic work.",
    mandatory: ["For a visa hire: police clearance, medical certificate and TB report", "Household employer duties: written contract, national minimum wage (R30.23 an hour from 1 March 2026), UIF if the carer works over 24 hours a month"],
    optional: ["SAPS police clearance (agency standard, not law for local hires)", "Phoned references", "First aid and driver licence"],
    payNote: "For a local hire there is no state police clearance rule. Agencies still ask for one. The app labels it as an agency standard, not law." }
];

var ROLES = [
  { id: "babysitter", name: "Babysitter", icon: "", line: "Occasional care. Evenings and one off days.", liveIn: "out" },
  { id: "nanny", name: "Nanny", icon: "", line: "Professional childcare as a job. Paid a wage.", liveIn: "either" },
  { id: "aupair", name: "Au Pair", icon: "", line: "Lives with the family. Childcare plus language and culture swap. Paid pocket money.", liveIn: "in" },
  { id: "demipair", name: "Demi Pair", icon: "", line: "Part time au pair. Study comes first. Pocket money can be none.", liveIn: "in" },
  { id: "mothershelp", name: "Mother's Help / Family Assistant", icon: "", line: "Junior help beside a parent, or a senior who runs the home.", liveIn: "either" },
  { id: "newborn", name: "Newborn and Overnight", icon: "", line: "First weeks help. Nights, or blocks of 24 hours.", liveIn: "either" },
  { id: "governess", name: "Governess / Tutor Nanny", icon: "", line: "Teaching first. Lessons, languages and school work.", liveIn: "either" },
  { id: "childminder", name: "Childminder / Family Day Care", icon: "", line: "Care in the carer's own home. A registered service.", liveIn: "own" }
];

var STYLE_DIMS = [
  { id: "discipline", name: "Discipline", low: "Gentle guidance", high: "Firm boundaries" },
  { id: "structure", name: "Day structure", low: "Child led and free", high: "Planned routine" },
  { id: "screen", name: "Screen time", low: "Almost none", high: "Daily shows and games are fine" },
  { id: "outdoors", name: "Outdoors", low: "Mostly inside", high: "Outside every day, big adventures" },
  { id: "food", name: "Food", low: "Simple and flexible", high: "Set meals, healthy rules" },
  { id: "learning", name: "Learning", low: "Play first", high: "Reading and school work focus" },
  { id: "sleep", name: "Sleep help", low: "Cuddle to sleep", high: "Teach self settling" },
  { id: "energy", name: "Home energy", low: "Calm and quiet", high: "Lively and social" }
];

var ACTIVITY_ICONS = ["Craft", "Sport", "Music", "Reading", "Outdoors", "Cooking", "Water play", "Animals", "Puzzles", "Bikes"];

var LOG_TILES = [
  { id: "arrival", name: "Arrival", icon: "", kind: "basic" },
  { id: "meal", name: "Meal", icon: "", kind: "basic" },
  { id: "drink", name: "Drink", icon: "", kind: "basic" },
  { id: "nap", name: "Nap", icon: "", kind: "timer" },
  { id: "nappy", name: "Nappy / Toilet", icon: "", kind: "basic" },
  { id: "mood", name: "Mood", icon: "", kind: "mood" },
  { id: "activity", name: "Activity", icon: "", kind: "basic" },
  { id: "outing", name: "Outing", icon: "", kind: "basic" },
  { id: "medicine", name: "Medicine", icon: "", kind: "safety" },
  { id: "incident", name: "Incident", icon: "", kind: "safety" },
  { id: "health", name: "Health", icon: "", kind: "safety" },
  { id: "photo", name: "Photo moment", icon: "", kind: "story" },
  { id: "milestone", name: "Milestone", icon: "", kind: "story" },
  { id: "note", name: "Note to parents", icon: "", kind: "story" }
];

var CHILD_THEMES = [
  { id: "flowers", name: "Flowers", icon: "", color: "#C9718A" },
  { id: "fairies", name: "Fairies", icon: "", color: "#8B76B8" },
  { id: "space", name: "Space", icon: "", color: "#5B87B8" },
  { id: "dino", name: "Dinosaurs", icon: "", color: "#5F8F6E" },
  { id: "ocean", name: "Ocean", icon: "", color: "#3E7C8C" },
  { id: "plain", name: "Plain", icon: "", color: "#8A8A8A" }
];

var SEED_CAREGIVERS = [
  { id: "cg1", demo: true, name: "Sofia", role: "aupair", country: "AU", suburb: "Paddington, Brisbane", radiusKm: 10, startMonth: "2026-11", months: 6, days: [true, true, true, true, true, false, false], liveIn: "in", ages: ["1 to 3", "3 to 5"], languages: ["Spanish", "English"], payKind: "pocket", pay: 300, payPeriod: "week", checks: { wwcc: "verified", police: "sighted", firstAid: "HLTAID012", refs: 2 }, experienceHrs: 250, tier: "Experienced", activities: ["Craft", "Music", "Reading"], style: { discipline: 1, structure: 2, screen: 1, outdoors: 3, food: 2, learning: 2, sleep: 1, energy: 2 }, blurb: "I love songs, stories and slow mornings. I cared for two toddlers in Madrid." },
  { id: "cg2", demo: true, name: "Mia", role: "nanny", country: "AU", suburb: "New Farm, Brisbane", radiusKm: 8, startMonth: "2026-10", months: 24, days: [true, true, true, true, true, false, false], liveIn: "out", ages: ["0 to 1", "1 to 3"], languages: ["English"], payKind: "hourly", pay: 38, payPeriod: "hour", checks: { wwcc: "verified", police: "sighted", firstAid: "HLTAID012", refs: 3 }, experienceHrs: 2400, tier: "Qualified", activities: ["Outdoors", "Puzzles", "Water play"], style: { discipline: 2, structure: 3, screen: 1, outdoors: 4, food: 3, learning: 3, sleep: 2, energy: 3 }, blurb: "Qualified early childhood educator. Sole charge babies are my strength." },
  { id: "cg3", demo: true, name: "Lena", role: "aupair", country: "DE", suburb: "Munich", radiusKm: 12, startMonth: "2026-11", months: 12, days: [true, true, true, true, true, false, false], liveIn: "in", ages: ["3 to 5", "5 to 12"], languages: ["German", "English"], payKind: "pocket", pay: 280, payPeriod: "month", checks: { wwcc: "self", police: "sighted", firstAid: "First aid", refs: 2 }, experienceHrs: 180, tier: "Entry", activities: ["Sport", "Outdoors", "Bikes"], style: { discipline: 2, structure: 2, screen: 2, outdoors: 4, food: 2, learning: 2, sleep: 2, energy: 4 }, blurb: "Sporty and cheerful. I coach a kids football team at home." },
  { id: "cg4", demo: true, name: "Ava", role: "nanny", country: "GB", suburb: "Richmond, London", radiusKm: 6, startMonth: "2026-10", months: 12, days: [true, true, true, true, false, false, false], liveIn: "either", ages: ["1 to 3", "3 to 5", "5 to 12"], languages: ["English", "French"], payKind: "hourly", pay: 19, payPeriod: "hour", checks: { wwcc: "self", police: "sighted", firstAid: "Paediatric first aid", refs: 4 }, experienceHrs: 3200, tier: "Qualified", activities: ["Reading", "Cooking", "Craft"], style: { discipline: 2, structure: 3, screen: 1, outdoors: 3, food: 4, learning: 4, sleep: 2, energy: 2 }, blurb: "Nanny of 6 years. I plan calm days with lots of books and baking." },
  { id: "cg5", demo: true, name: "Chloe", role: "babysitter", country: "AU", suburb: "Bulimba, Brisbane", radiusKm: 5, startMonth: "2026-10", months: 3, days: [false, false, false, false, true, true, true], liveIn: "out", ages: ["3 to 5", "5 to 12"], languages: ["English"], payKind: "hourly", pay: 32, payPeriod: "hour", checks: { wwcc: "verified", police: "none", firstAid: "First aid", refs: 1 }, experienceHrs: 300, tier: "Experienced", activities: ["Craft", "Music", "Puzzles"], style: { discipline: 1, structure: 1, screen: 2, outdoors: 2, food: 1, learning: 1, sleep: 1, energy: 3 }, blurb: "Weekend babysitter. Craft tables and dance parties are my thing." },
  { id: "cg6", demo: true, name: "Yuki", role: "demipair", country: "JP", suburb: "Kyoto", radiusKm: 7, startMonth: "2026-12", months: 6, days: [true, false, true, false, true, false, false], liveIn: "in", ages: ["3 to 5"], languages: ["Japanese", "English"], payKind: "pocket", pay: 0, payPeriod: "week", checks: { wwcc: "self", police: "none", firstAid: "None yet", refs: 1 }, experienceHrs: 90, tier: "Entry", activities: ["Craft", "Music", "Reading"], style: { discipline: 1, structure: 1, screen: 1, outdoors: 2, food: 2, learning: 3, sleep: 1, energy: 1 }, blurb: "Demi pair and language student. Gentle, patient, and I love origami." }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { COUNTRIES: COUNTRIES, ROLES: ROLES, STYLE_DIMS: STYLE_DIMS, ACTIVITY_ICONS: ACTIVITY_ICONS, LOG_TILES: LOG_TILES, CHILD_THEMES: CHILD_THEMES, SEED_CAREGIVERS: SEED_CAREGIVERS };
}
