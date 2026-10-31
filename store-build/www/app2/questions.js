// Caresitters questionnaire journeys — the LOCKED design (amendment 3).
// Family: 5 pages, 23 questions (7 + 3 + 1 + 1 + 11).
// Carer: 5 pages, 21 questions (6 + 6 + 1 + 2 + 6). Two over the
// design's printed 19, both from her approved field set: the
// carer's routine style (the approach score needs it) and the
// carer's culture and faith offer (research field 19: offered,
// never extracted; shown, never ranked). Flagged to HQ.
// Optional questions carry her honesty note. Strength choices on
// the looking for page: Must have / I prefer / Either way.

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const PARTS = ["morning", "midday", "afternoon", "evening", "night"];
export const BANDS = ["0-1", "1-3", "3-5", "5-12", "12+"];
export const EXPERIENCE_YEAR_CHOICES = ["", "0", "1", "2", "3", "4", "5", "6", "7", "10", "15", "20"];
export function experienceComplete(value) {
  // One age group is enough (a new carer, or an au pair, has not cared for every age).
  return BANDS.some((band) => value && value[band] !== "" && value[band] != null);
}
export const ACTIVITIES = ["Arts and crafts", "Going to the park", "Library", "Reading and storytime", "Music", "Swimming", "Cooking together", "Sports and active play", "Games and puzzles", "Nature time", "Homework help", "Pretend play"];
export const TRAITS = ["Warm", "Patient", "Playful", "Calm", "Energetic", "Organised", "Gentle", "Funny", "Reliable", "Creative"];
export const LANGS = ["English", "Spanish", "Mandarin", "Arabic", "Hindi", "Tagalog", "Italian", "Greek", "Vietnamese", "French"];
export const TASKS = ["School runs", "Cooking", "Light cleaning", "Laundry", "Homework help", "Bath time", "Bedtime", "Errands"];
export const AGES = Array.from({ length: 70 }, (_, i) => String(16 + i));
export const PAY_AMOUNTS = ["18", "20", "22", "25", "28", "30", "32", "35", "38", "40", "45", "50", "55", "60", "70", "80", "100"];
export const DISTANCES = ["2", "5", "10", "15", "20", "25", "40", "60", "100"];
export const NATIONALITIES = ["Australian", "Filipino", "Colombian", "Brazilian", "German", "French", "British", "Irish", "Spanish", "Italian", "Dutch", "Polish", "Japanese", "Korean", "Chinese", "Indian", "Indonesian", "Thai", "Vietnamese", "South African", "New Zealander", "Canadian", "American", "Another background"];
export const CULTURE_OFFERS = ["Our food", "Our language", "Our songs and stories", "Our festivals", "Our faith practices", "Cooking together", "Homework in our language"];
export const ROLES = ["Babysitter", "Nanny", "Au pair", "Mother's help", "Newborn and overnight", "Governess", "Childminder"];

export const FAMILY_PAGES = [
  { title: "Your family", bunny: "point-guide", fields: [
    { id: "role", label: "What kind of carer are you looking for?", type: "select", options: ROLES, required: true },
    { id: "postcode", label: "Your postcode", type: "text", required: true },
    { id: "childrenBands", label: "Your children's ages", type: "chips", options: BANDS, required: true },
    { id: "languages", label: "Languages in your home", type: "chips", options: LANGS, required: true },
    { id: "culture", label: "Faith or culture practices in your home", type: "text", optional: true },
    { id: "pets", label: "Do you have pets?", type: "yesno", required: true },
    { id: "smokerHousehold", label: "Does anyone smoke at home?", type: "yesno", required: true },
  ]},
  { title: "Your week", bunny: "point-guide", fields: [
    { id: "scheduleNeed", label: "When do you need care?", type: "grid", required: true },
    { id: "startWhen", label: "When would you like to start?", type: "select", options: ["As soon as possible", "In the next few weeks", "I am flexible"], required: true },
    { id: "payOffered", label: "Pay you offer, per hour in Australian dollars", type: "select", options: PAY_AMOUNTS, required: true },
  ]},
  { title: "Activities with kids", bunny: "encourage", fields: [
    { id: "activities", label: "What do your kids love doing?", type: "chips", options: ACTIVITIES, optional: true },
  ]},
  { title: "Personality", bunny: "encourage", fields: [
    { id: "personality", label: "Traits you hope for in your carer", type: "chips", options: TRAITS, optional: true },
  ]},
  { title: "The carer you are looking for", bunny: "point-guide", fields: [
    { id: "ageBand", label: "Carer's age", type: "band", strength: true },
    { id: "nationality", label: "Nationality", type: "select", options: NATIONALITIES, strength: true, optional: true },
    { id: "mustLanguages", label: "Languages they speak", type: "chips", options: LANGS, strength: true },
    { id: "nonSmoker", label: "Non smoker", type: "yesno", strength: true },
    { id: "experienceChecks", label: "Experience and checks", type: "expchecks", strength: true },
    { id: "drivesCar", label: "Driving", type: "select", options: ["Drives, own car", "Drives, our car", "No driving needed"], strength: true },
    { id: "cookingTasks", label: "Cooking and household tasks", type: "chips", options: TASKS, strength: true },
    { id: "routineStyle", label: "Routine style in your home", type: "select", options: ["Steady rhythm", "Go with the flow", "Busy and active", "Calm and quiet"], optional: true },
    { id: "specialNeeds", label: "Special needs experience", type: "yesno", strength: true },
    { id: "petsOk", label: "Happy around your pets", type: "yesno", strength: true },
    { id: "maxDistanceKm", label: "Furthest distance, in km", type: "select", options: DISTANCES, required: true },
  ]},
];

export const CARER_PAGES = [
  { title: "About you", bunny: "point-guide", fields: [
    { id: "displayName", label: "Your name, as families will see it", type: "text", required: true },
    { id: "postcode", label: "Your postcode", type: "text", required: true },
    { id: "age", label: "Your age", type: "select", options: AGES, required: true },
    { id: "nationality", label: "Your nationality", type: "select", options: NATIONALITIES, required: true },
    { id: "languages", label: "Languages you speak", type: "chips", options: LANGS, required: true },
    { id: "cultureOffer", label: "Faith or culture you bring, or happily support", type: "chips", options: CULTURE_OFFERS, optional: true },
  ]},
  { title: "Your experience and week", bunny: "point-guide", fields: [
    { id: "experience", label: "Years of experience, per child age", type: "experience", required: true },
    { id: "checksLevel", label: "Your checks", type: "select", options: ["Register verified", "Document sighted", "Getting them now"], required: true },
    { id: "availability", label: "When are you free?", type: "grid", required: true },
    { id: "drivesCar", label: "Driving", type: "select", options: ["I drive, my own car", "I drive, family car is fine", "I do not drive"], required: true },
    { id: "smoker", label: "Do you smoke?", type: "yesno", required: true },
    { id: "payFloor", label: "Lowest pay per hour you accept, in Australian dollars", type: "select", options: PAY_AMOUNTS, required: true },
  ]},
  { title: "Activities with kids", bunny: "encourage", fields: [
    { id: "activities", label: "Activities you love doing with kids", type: "chips", options: ACTIVITIES, optional: true },
  ]},
  { title: "Personality", bunny: "encourage", fields: [
    { id: "personality", label: "Your top traits", type: "chips", options: TRAITS, optional: true },
    { id: "routineStyle", label: "How do you run a day with kids?", type: "select", options: ["Steady rhythm", "Go with the flow", "Busy and active", "Calm and quiet"], optional: true },
  ]},
  { title: "Work you love", bunny: "point-guide", fields: [
    { id: "agesAccepted", label: "Children's ages you take", type: "chips", options: BANDS, required: true },
    { id: "agesPreferred", label: "Ages you love most", type: "chips", options: BANDS, optional: true },
    { id: "homeFacts", label: "Homes that suit you", type: "homefacts", required: true },
    { id: "tasks", label: "Tasks you happily do", type: "chips", options: TASKS, optional: true },
    { id: "tasksRefused", label: "Tasks you never do", type: "chips", options: TASKS, optional: true },
    { id: "maxDistanceKm", label: "Furthest you will travel, in km", type: "select", options: DISTANCES, required: true },
  ]},
];
