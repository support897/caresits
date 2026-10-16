// Caresitters — the LONGER questionnaire (expansion set).
// Built from QUESTIONNAIRE-EXPANSION-RESEARCH.md Part C,
// approved in full by the founder on 15 Oct 2026 (22:54):
// 52 family + 60 carer questions in 17 themes, word for word
// as approved. Paired questions share their number (F8 pairs
// C8) so the engine can compare the two sides directly.
// Feeds: strength true means the asker may set it as a must;
// profileOnly feeds the profile, never the score. The three
// approved gate changes ride the engine: group size (F32/C33
// with F46/C51), stay length (F16/C15), centre or school
// (F38 read against C42). Page shape: more pages, shorter
// each (the founder's default as stated by HQ).
export const EXPANSION = {
 "family": [
  {
   "id": "xfp1",
   "title": "How children are guided",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF1",
     "pair": "F1",
     "label": "When a child will not listen, what should the carer do first?",
     "optional": true,
     "feed": "approach",
     "gateNote": "Approach and routine (15)",
     "type": "select",
     "options": [
      "Talk calmly and explain",
      "Give a clear warning",
      "Time out to calm down",
      "Take away a toy or screen time",
      "Ask us first"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xF2",
     "pair": "F2",
     "label": "How do you feel about time out?",
     "optional": true,
     "feed": "approach",
     "gateNote": "Approach and routine (15)",
     "type": "select",
     "options": [
      "We use it",
      "We would rather not",
      "We have no set view"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xF3",
     "pair": "F3",
     "label": "Can the carer make small choices in the day, or must they follow your plan word for word?",
     "optional": true,
     "feed": "approach",
     "gateNote": "Approach and routine (15)",
     "type": "select",
     "options": [
      "Follow our plan closely",
      "Small choices are fine",
      "We trust their judgement"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    }
   ]
  },
  {
   "id": "xfp2",
   "title": "Screens, phones and photos of the children",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF4",
     "pair": "F4",
     "label": "How much screen time is right for your children?",
     "optional": true,
     "feed": "approach",
     "gateNote": "Approach and routine (15)",
     "type": "select",
     "options": [
      "None at all",
      "A little each day",
      "Weekends only",
      "We are relaxed about it"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xF5",
     "pair": "F5",
     "label": "May the carer use their phone while they are with the children?",
     "optional": true,
     "feed": "approach",
     "gateNote": "Approach and routine (15)",
     "type": "select",
     "options": [
      "Only for calls to us",
      "Quick checks are fine",
      "No phones at all"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    }
   ]
  },
  {
   "id": "xfp3",
   "title": "Food, allergies and treats",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF7",
     "pair": "F7",
     "label": "Who plans the meals and snacks?",
     "optional": true,
     "feed": "tasks",
     "gateNote": "Tasks (5)",
     "type": "select",
     "options": [
      "We plan them",
      "The carer plans them",
      "We plan together"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xF8",
     "pair": "F8",
     "label": "Are there foods your children must never have?",
     "optional": true,
     "feed": "tasks",
     "gateNote": "Tasks gate. A carer who cannot manage a food allergy is not a match. The detail also shows on the child profile for matched pairs. The typed companion was dropped under the founder's answer shape ruling (15 Oct 23:07): answers are picked, never typed, outside the two named write ins per side. The pick list grew to the standard allergens plus common foods under the founder's answer shape amendment (15 Oct 23:07); no text box.",
     "type": "chips",
     "options": [
      "Peanuts",
      "Tree nuts",
      "Dairy",
      "Eggs",
      "Gluten",
      "Soy",
      "Sesame",
      "Fish",
      "Shellfish",
      "Lupin",
      "Other foods",
      "None"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    }
   ]
  },
  {
   "id": "xfp4",
   "title": "Sleep and settling",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF11",
     "pair": "F11",
     "label": "How should your baby or toddler be put to sleep?",
     "optional": true,
     "feed": "approach",
     "gateNote": "Approach and routine (15)",
     "type": "select",
     "options": [
      "Follow our sleep plan",
      "Rock or hold till asleep",
      "Let them settle on their own",
      "We will show the carer what works"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xF12",
     "pair": "F12",
     "label": "Do your children nap in the day?",
     "optional": true,
     "feed": "approach",
     "gateNote": "Approach and routine (15)",
     "type": "select",
     "options": [
      "Yes, at set times",
      "Yes, when they are tired",
      "No naps"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    }
   ]
  },
  {
   "id": "xfp5",
   "title": "Talking, updates and sorting out small problems",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF13",
     "pair": "F13",
     "label": "How do you want to hear about the day?",
     "optional": true,
     "feed": "trust",
     "gateNote": "Trust and warmth (20)",
     "type": "select",
     "options": [
      "Photos and notes in the app",
      "Short messages in the day",
      "A chat at the end of the day",
      "Only tell us if something is wrong"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    }
   ]
  },
  {
   "id": "xfp6",
   "title": "How long the match should last",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF16",
     "pair": "F16",
     "label": "How long do you want this carer to stay with your family?",
     "optional": true,
     "feed": "schedule",
     "gateNote": "Schedule fit (20)",
     "type": "select",
     "options": [
      "A few weeks",
      "One school term",
      "About six months",
      "A year or more",
      "As long as it works for everyone"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    },
    {
     "id": "xF17",
     "pair": "F17",
     "label": "Do you need care in the school holidays too?",
     "optional": true,
     "feed": "schedule",
     "gateNote": "Schedule fit (20), and the schedule gate when set as a must",
     "type": "select",
     "options": [
      "Yes",
      "No",
      "Some days"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "quick"
    }
   ]
  },
  {
   "id": "xfp8",
   "title": "Safety skills in depth",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF21",
     "pair": "F21",
     "label": "Must your carer hold a first aid certificate for babies and children?",
     "optional": true,
     "feed": null,
     "gateNote": "Checks gate",
     "type": "select",
     "options": [
      "Must have",
      "I prefer",
      "Either way"
     ],
     "strengthPick": true,
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    }
   ]
  },
  {
   "id": "xfp10",
   "title": "Living in, for live in roles",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF25",
     "pair": "F25",
     "label": "May the carer have friends visit your home?",
     "optional": true,
     "feed": null,
     "gateNote": "Home facts gate",
     "type": "select",
     "options": [
      "Yes, any time",
      "Yes, if they ask first",
      "In the day only",
      "No guests"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    },
    {
     "id": "xF26",
     "pair": "F26",
     "label": "May a guest stay the night?",
     "optional": true,
     "feed": null,
     "gateNote": "Home facts gate",
     "type": "select",
     "options": [
      "Yes",
      "Only if we agree first",
      "No"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    },
    {
     "id": "xF27",
     "pair": "F27",
     "label": "Is there a time you want the carer home by on work nights?",
     "optional": true,
     "feed": null,
     "gateNote": "Home facts gate",
     "type": "select",
     "options": [
      "No set time",
      "By ten at night",
      "By midnight",
      "We will agree it together"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    }
   ]
  },
  {
   "id": "xfp11",
   "title": "The children, in more depth",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF32",
     "pair": "F32",
     "label": "How many children will the carer be with at one time, most days?",
     "optional": true,
     "feed": "experience",
     "gateNote": "Experience (20)",
     "type": "select",
     "options": [
      "One",
      "Two",
      "Three",
      "Four or more"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    },
    {
     "id": "xF33",
     "pair": "F33",
     "label": "Tell us about each child in a few words. What do they love? What is hard for them?",
     "optional": true,
     "feed": null,
     "gateNote": "None. Shown to matched pairs. It carries no child names, under the standing rule that cards hold no children details.",
     "type": "text",
     "profileOnly": true,
     "strength": false,
     "level": "optional"
    },
    {
     "id": "xF34",
     "pair": "F34",
     "label": "Does any child need help with any of these?",
     "optional": true,
     "feed": "tasks",
     "gateNote": "Tasks gate. This deepens the special needs line we already hold, by saying which need it is.",
     "type": "chips",
     "options": [
      "Speech",
      "Moving around",
      "Medicine each day",
      "Calm behaviour support",
      "Learning support",
      "Toilet training",
      "None of these"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    },
    {
     "id": "xF35",
     "pair": "F35",
     "label": "Will the carer need to give medicine to a child?",
     "optional": true,
     "feed": "tasks",
     "gateNote": "Tasks gate",
     "type": "select",
     "options": [
      "Yes, most days",
      "Now and then",
      "No"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    },
    {
     "id": "xF36",
     "pair": "F36",
     "label": "Do you have a pool, a spa, or a trampoline at home?",
     "optional": true,
     "feed": null,
     "gateNote": "None. It sits beside the swim pair in Theme 8 so families read them together.",
     "type": "chips",
     "options": [
      "Pool",
      "Spa",
      "Trampoline",
      "None of these"
     ],
     "profileOnly": true,
     "strength": false,
     "level": "optional"
    }
   ]
  },
  {
   "id": "xfp12",
   "title": "References and proof of experience",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF38",
     "pair": "F38",
     "label": "Would you love a carer who has worked in a childcare centre or a school?",
     "optional": true,
     "feed": "experience",
     "gateNote": "Experience (20) as points. As a must it would need the checks gate to carry a work setting proof, which is a small widening of that gate. Flagged so the founder sees it.",
     "type": "select",
     "options": [
      "Must have",
      "I prefer",
      "Either way"
     ],
     "strengthPick": true,
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    }
   ]
  },
  {
   "id": "xfp13",
   "title": "Language in more depth",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF39",
     "pair": "F39",
     "label": "How well must the carer speak your main home language?",
     "optional": true,
     "feed": "language",
     "gateNote": "Language gate",
     "type": "select",
     "options": [
      "Very well",
      "Well enough for daily life",
      "Basic is fine if they are learning"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    }
   ]
  },
  {
   "id": "xfp15",
   "title": "The shape of the work",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF43",
     "pair": "F43",
     "label": "Will the carer stay overnight with the children while you are away?",
     "optional": true,
     "feed": "tasks",
     "gateNote": "Tasks gate",
     "type": "select",
     "options": [
      "Yes",
      "Now and then",
      "No"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    }
   ]
  },
  {
   "id": "xfp16",
   "title": "Energy, traits and the human story",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF47",
     "pair": "F47",
     "label": "How active is your family life?",
     "optional": true,
     "feed": "trust",
     "gateNote": "Trust and warmth (20)",
     "type": "select",
     "options": [
      "Very active, lots of sport and trips out",
      "A mix",
      "Calm and home based"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xF49",
     "pair": "F49",
     "label": "What would make a carer feel at home in your house?",
     "optional": true,
     "feed": null,
     "gateNote": "None",
     "type": "text",
     "profileOnly": true,
     "strength": false,
     "level": "optional"
    }
   ]
  },
  {
   "id": "xfp17",
   "title": "Honesty facts, settling in, and pay clarity",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xF50",
     "pair": "F50",
     "label": "Do you have cameras in shared areas of your home?",
     "optional": true,
     "feed": null,
     "gateNote": "None. Shown early. A carer should never learn this on day one.",
     "type": "select",
     "options": [
      "Yes",
      "No"
     ],
     "profileOnly": true,
     "strength": false,
     "level": "optional"
    }
   ]
  }
 ],
 "carer": [
  {
   "id": "xcp1",
   "title": "How children are guided",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC1",
     "pair": "C1",
     "label": "When a child will not listen, what do you do first?",
     "optional": true,
     "feed": "approach",
     "gateNote": "Approach and routine (15)",
     "type": "select",
     "options": [
      "Talk calmly and explain",
      "Give a clear warning",
      "Time out to calm down",
      "Take away a toy or screen time",
      "Follow the family plan"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xC2",
     "pair": "C2",
     "label": "Are you happy to use time out if the family uses it?",
     "optional": true,
     "feed": "approach",
     "gateNote": "Approach and routine (15)",
     "type": "select",
     "options": [
      "Yes",
      "I would rather use other ways",
      "I will follow the family way"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xC3",
     "pair": "C3",
     "label": "Do you work best with a set plan, or do you like room to choose?",
     "optional": true,
     "feed": "approach",
     "gateNote": "Approach and routine (15)",
     "type": "select",
     "options": [
      "A set plan",
      "A plan with room to choose",
      "Lots of freedom"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    }
   ]
  },
  {
   "id": "xcp2",
   "title": "Screens, phones and photos of the children",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC4",
     "pair": "C4",
     "label": "How do you feel about screens for children?",
     "optional": true,
     "feed": "approach",
     "gateNote": "Approach and routine (15)",
     "type": "select",
     "options": [
      "Keep them off",
      "A little is fine",
      "I follow the family rules"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xC5",
     "pair": "C5",
     "label": "Are you happy to keep your phone away while you work?",
     "optional": true,
     "feed": "approach",
     "gateNote": "Approach and routine (15)",
     "type": "select",
     "options": [
      "Yes",
      "Mostly, with quick checks",
      "That would be hard"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    }
   ]
  },
  {
   "id": "xcp3",
   "title": "Food, allergies and treats",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC7",
     "pair": "C7",
     "label": "Are you happy to plan meals and snacks for the children?",
     "optional": true,
     "feed": "tasks",
     "gateNote": "Tasks (5)",
     "type": "select",
     "options": [
      "Yes",
      "If the family gives me a list",
      "I would rather not"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xC8",
     "pair": "C8",
     "label": "Have you cared for a child with a food allergy before?",
     "optional": true,
     "feed": "experience",
     "gateNote": "Experience (20)",
     "type": "select",
     "options": [
      "Yes, often",
      "Yes, once or twice",
      "Not yet"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xC10",
     "pair": "C10",
     "label": "What food do you not eat or not cook?",
     "optional": true,
     "feed": null,
     "gateNote": "Home facts gate when the carer sets it as a hard line of their own. Else profile colour.",
     "type": "select",
     "options": [
      "I eat and cook everything",
      "No meat",
      "No pork",
      "No beef",
      "I eat no animal foods at all",
      "Other, please tell us"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "quick"
    }
   ]
  },
  {
   "id": "xcp4",
   "title": "Sleep and settling",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC11",
     "pair": "C11",
     "label": "Are you happy to follow a family sleep plan, even if it is not your way?",
     "optional": true,
     "feed": "approach",
     "gateNote": "Approach and routine (15)",
     "type": "select",
     "options": [
      "Yes",
      "Parts of it would be hard for me",
      "I would want to talk it through first"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    }
   ]
  },
  {
   "id": "xcp5",
   "title": "Talking, updates and sorting out small problems",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC12",
     "pair": "C12",
     "label": "How do you like to keep parents up to date?",
     "optional": true,
     "feed": "trust",
     "gateNote": "Trust and warmth (20)",
     "type": "select",
     "options": [
      "Photos and notes in the app",
      "Short messages in the day",
      "A chat at the end of the day",
      "Only if something is wrong"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xC13",
     "pair": "C13",
     "label": "How fast do you reply to messages most days?",
     "optional": true,
     "feed": "trust",
     "gateNote": "Trust and warmth (20). The engine already uses usual reply speed as a tie break. This question gives that tie break real input.",
     "type": "select",
     "options": [
      "Within the hour",
      "The same day",
      "It can take longer"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xC14",
     "pair": "C14",
     "label": "If you feel unhappy about something at work, what do you do?",
     "optional": true,
     "feed": "trust",
     "gateNote": "Trust and warmth (20)",
     "type": "select",
     "options": [
      "Say it the same day",
      "Write it in a message first",
      "Wait and think first"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    }
   ]
  },
  {
   "id": "xcp6",
   "title": "How long the match should last",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC15",
     "pair": "C15",
     "label": "How long do you plan to stay in this job?",
     "optional": true,
     "feed": "schedule",
     "gateNote": "Schedule fit (20)",
     "type": "select",
     "options": [
      "A few weeks",
      "One school term",
      "About six months",
      "A year or more",
      "I hope to stay a long time"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    }
   ]
  },
  {
   "id": "xcp8",
   "title": "Safety skills in depth",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC22",
     "pair": "C22",
     "label": "Do you hold a first aid certificate for babies and children?",
     "optional": true,
     "feed": "trust",
     "gateNote": "Checks gate, and Trust and warmth (20) when no must is set",
     "type": "select",
     "options": [
      "Yes, and it is in date",
      "Yes, a general first aid certificate",
      "No, but I plan to get one",
      "No"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "quick"
    }
   ]
  },
  {
   "id": "xcp10",
   "title": "Living in, for live in roles",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC28",
     "pair": "C28",
     "label": "Are you happy to ask before friends visit the home you live and work in?",
     "optional": true,
     "feed": null,
     "gateNote": "Home facts gate",
     "type": "select",
     "options": [
      "Yes",
      "I would rather have free visiting",
      "I do not have guests"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    },
    {
     "id": "xC29",
     "pair": "C29",
     "label": "Would you like to have a guest stay the night now and then?",
     "optional": true,
     "feed": "trust",
     "gateNote": "Home facts gate when set as a hard line, else Trust and warmth (20)",
     "type": "select",
     "options": [
      "Yes",
      "No",
      "Not sure yet"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "quick"
    },
    {
     "id": "xC30",
     "pair": "C30",
     "label": "Are you fine with a set time to be home on nights before work?",
     "optional": true,
     "feed": "trust",
     "gateNote": "Home facts gate when set as a hard line, else Trust and warmth (20)",
     "type": "select",
     "options": [
      "Yes",
      "I would rather not",
      "It depends on the time"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "quick"
    },
    {
     "id": "xC32",
     "pair": "C32",
     "label": "Do you vape?",
     "optional": true,
     "feed": null,
     "gateNote": "Home facts gate",
     "type": "select",
     "options": [
      "No",
      "Yes, outside only",
      "Yes"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    }
   ]
  },
  {
   "id": "xcp11",
   "title": "The children, in more depth",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC33",
     "pair": "C33",
     "label": "What is the most children you are happy to care for at one time?",
     "optional": true,
     "feed": "experience",
     "gateNote": "Experience (20)",
     "type": "select",
     "options": [
      "One",
      "Two",
      "Three",
      "Four or more",
      "No set limit"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "full"
    },
    {
     "id": "xC38",
     "pair": "C38",
     "label": "Are you happy to give medicine when the parents have said yes in writing?",
     "optional": true,
     "feed": "tasks",
     "gateNote": "Tasks gate, and Tasks (5) when no must is set",
     "type": "select",
     "options": [
      "Yes",
      "Only simple medicine",
      "No"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "quick"
    },
    {
     "id": "xC39",
     "pair": "C39",
     "label": "Are you happy to work in a home with a pool?",
     "optional": true,
     "feed": null,
     "gateNote": "Home facts gate",
     "type": "select",
     "options": [
      "Yes",
      "No"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    }
   ]
  },
  {
   "id": "xcp12",
   "title": "References and proof of experience",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC42",
     "pair": "C42",
     "label": "Have you worked in any of these?",
     "optional": true,
     "feed": "experience",
     "gateNote": "Experience (20)",
     "type": "chips",
     "options": [
      "A childcare centre",
      "A school",
      "As a tutor",
      "As a sports coach",
      "None of these"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "full"
    }
   ]
  },
  {
   "id": "xcp13",
   "title": "Language in more depth",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC43",
     "pair": "C43",
     "label": "For each language you speak, how well do you speak it?",
     "optional": true,
     "feed": "language",
     "gateNote": "Language gate, and Language and culture (10). No new gate is needed. The gate gains levels, not a new shape.",
     "type": "select",
     "options": [
      "My first language",
      "Very well",
      "Well enough for daily life",
      "I am learning"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "quick"
    }
   ]
  },
  {
   "id": "xcp15",
   "title": "The shape of the work",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC48",
     "pair": "C48",
     "label": "Are you happy to stay overnight alone with the children?",
     "optional": true,
     "feed": "tasks",
     "gateNote": "Tasks gate, and Tasks (5) when no must is set",
     "type": "select",
     "options": [
      "Yes",
      "Now and then",
      "No"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "quick"
    },
    {
     "id": "xC51",
     "pair": "C51",
     "label": "Are you happy to care for children from two families at the same time?",
     "optional": true,
     "feed": "experience",
     "gateNote": "Experience (20). It joins the group size pair. The NEW GATE flag on C33 covers this pair too if it is ever made a hard line.",
     "type": "select",
     "options": [
      "Yes",
      "No"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "quick"
    }
   ]
  },
  {
   "id": "xcp16",
   "title": "Energy, traits and the human story",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC53",
     "pair": "C53",
     "label": "Pick the three words that fit you best with children.",
     "optional": true,
     "feed": "trust",
     "gateNote": "Trust and warmth (20)",
     "type": "chips",
     "maxPick": 3,
     "options": [
      "Calm",
      "Full of energy",
      "Funny",
      "Gentle",
      "Well organised",
      "Warm and cuddly",
      "Firm and clear",
      "Quiet"
     ],
     "profileOnly": false,
     "strength": false,
     "level": "better"
    },
    {
     "id": "xC54",
     "pair": "C54",
     "label": "Why do you love working with children?",
     "optional": true,
     "feed": null,
     "gateNote": "None",
     "type": "text",
     "profileOnly": true,
     "strength": false,
     "level": "optional"
    },
    {
     "id": "xC56",
     "pair": "C56",
     "label": "What are you best at, and what do you find hard?",
     "optional": true,
     "feed": "trust",
     "gateNote": "None. AuPairWorld asks for strengths and weaknesses in the carer's own words, and families in Part B say honest answers here build trust.",
     "type": "text",
     "profileOnly": true,
     "strength": false,
     "level": "optional"
    }
   ]
  },
  {
   "id": "xcp17",
   "title": "Honesty facts, settling in, and pay clarity",
   "bunny": "point-guide",
   "fields": [
    {
     "id": "xC57",
     "pair": "C57",
     "label": "Are you fine working in a home with cameras in shared areas?",
     "optional": true,
     "feed": null,
     "gateNote": "Home facts gate",
     "type": "select",
     "options": [
      "Yes",
      "I would want to talk about it",
      "No"
     ],
     "profileOnly": false,
     "strength": true,
     "level": "quick"
    }
   ]
  }
 ]
};
