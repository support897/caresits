import Foundation

// Sample people for the redesign. Every person, family, home and photo here is made up for design only.
enum RdData {
    static let weekdays: [String] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    static func bc(_ date: String) -> RdKeyedCheck { return RdKeyedCheck(key: "bluecard", check: RdCheck(name: "Blue Card", status: "verified", date: date)) }

    static func carer(_ id: String, _ role: String, _ name: String, _ f: (inout RdCarer) -> Void) -> RdCarer {
        var c = RdCarer(id, role, name)
        f(&c)
        return c
    }
    static func fam(_ id: String, _ kind: String, _ name: String, _ f: (inout RdFamily) -> Void) -> RdFamily {
        var x = RdFamily(id, kind, name)
        f(&x)
        return x
    }

    static let carers: [RdCarer] = [
        carer("maya", "nanny", "Maya Okafor") { c in
            c.also = ["babysitter"]; c.age = 34; c.nat = "Australian"; c.suburb = "Ashgrove"; c.city = "Brisbane QLD"; c.lat = -27.443; c.lng = 152.985
            c.photos = ["n1", "n2", "n3", "n4"]; c.captions = ["Maya", "Cooking in a family kitchen", "Story time corner", "Park days"]
            c.years = 9; c.payFloor = 38; c.payText = "$38 an hour"
            c.headline = "Calm, curious and organised. Nine years with families."
            c.bio = "I love slow mornings, messy cooking and long park days. I follow a Montessori approach at home and keep routines gentle. I lived in Madrid for three years and still speak Spanish with the children I care for."
            c.checks = [bc("14 Aug 2026"), RdKeyedCheck(key: "id", check: RdCheck(name: "Photo ID", status: "verified", date: "14 Aug 2026"))]
            c.certs = [RdCert(name: "First aid", status: "sighted", date: "2 Mar 2026"), RdCert(name: "CPR", status: "sighted", date: "2 Mar 2026")]
            c.skills = ["First aid", "CPR", "Driving licence", "Cooking", "Homework help"]
            c.languages = ["English", "Spanish"]; c.traits = ["Calm", "Gentle", "Outdoorsy"]; c.approach = "Montessori"
            c.activities = ["Outdoor play", "Cooking", "Music", "Reading"]
            c.availDays = ["Mon", "Tue", "Wed", "Thu", "Fri"]; c.availFrom = 7; c.availTo = 18; c.maxKm = 15
            c.wantsTraits = ["Calm", "Playful"]; c.wantsApproach = "Montessori"
            c.willing = ["Cooking", "Homework help", "First aid", "CPR", "Swimming"]
            c.visa = RdVisa(state: "ready", text: "Australian citizen")
        },
        carer("katie", "nanny", "Katie Moore") { c in
            c.age = 29; c.nat = "Australian"; c.suburb = "Kelvin Grove"; c.city = "Brisbane QLD"; c.lat = -27.449; c.lng = 153.015
            c.photos = ["xn_TL"]; c.years = 5; c.payFloor = 36
            c.checks = [bc("2 Jul 2026")]; c.certs = [RdCert(name: "First aid", status: "sighted", date: "11 May 2026")]
            c.skills = ["First aid", "Driving licence", "Cooking", "Swimming"]; c.languages = ["English"]; c.traits = ["Playful", "Gentle"]; c.approach = "Flexible"
            c.activities = ["Outdoor play", "Arts and craft", "Swimming"]
            c.availDays = ["Mon", "Tue", "Wed", "Thu", "Fri"]; c.availFrom = 7.5; c.availTo = 17.5; c.maxKm = 12
            c.wantsTraits = ["Playful"]; c.wantsApproach = "Flexible"; c.willing = ["Cooking", "First aid", "Swimming"]
            c.visa = RdVisa(state: "ready", text: "Australian citizen")
        },
        carer("grace", "nanny", "Grace Mensah") { c in
            c.age = 38; c.nat = "Ghanaian"; c.suburb = "Indooroopilly"; c.city = "Brisbane QLD"; c.lat = -27.50; c.lng = 152.973
            c.photos = ["xn_TR"]; c.years = 12; c.payFloor = 40
            c.checks = [bc("9 Jan 2026")]; c.certs = [RdCert(name: "First aid", status: "sighted", date: "20 Feb 2026")]
            c.skills = ["First aid", "CPR", "Driving licence", "Homework help"]; c.languages = ["English", "Twi"]; c.traits = ["Firm", "Calm"]; c.approach = "Strict"
            c.activities = ["Reading", "Music"]
            c.availDays = ["Mon", "Wed"]; c.availFrom = 7; c.availTo = 18; c.maxKm = 12
            c.wantsTraits = ["Calm"]; c.wantsApproach = "Strict"; c.willing = ["Homework help", "First aid", "CPR"]
            c.visa = RdVisa(state: "ready", text: "Australian citizen")
        },
        carer("hana", "nanny", "Hana Ito") { c in
            c.age = 33; c.nat = "Japanese"; c.suburb = "Toowong"; c.city = "Brisbane QLD"; c.lat = -27.485; c.lng = 152.987
            c.photos = ["xn_BL"]; c.years = 7; c.payFloor = 37
            c.checks = [bc("5 Mar 2026")]; c.certs = [RdCert(name: "First aid", status: "sighted", date: "5 Mar 2026")]
            c.skills = ["First aid", "Cooking", "Homework help"]; c.languages = ["English", "Japanese"]; c.traits = ["Calm", "Playful"]; c.approach = "Montessori"
            c.activities = ["Cooking", "Music", "Outdoor play"]
            c.availDays = ["Mon", "Tue", "Wed", "Thu", "Fri"]; c.availFrom = 7; c.availTo = 18; c.maxKm = 12
            c.wantsTraits = ["Calm", "Playful"]; c.wantsApproach = "Montessori"; c.willing = ["Cooking", "Homework help", "First aid"]
            c.visa = RdVisa(state: "ready", text: "Permanent resident")
        },
        carer("lily", "babysitter", "Lily Chen") { c in
            c.age = 22; c.nat = "Australian"; c.suburb = "Toowong"; c.city = "Brisbane QLD"; c.lat = -27.485; c.lng = 152.987
            c.photos = ["b1", "b2", "b3", "b4"]; c.captions = ["Lily", "Craft table, ready for Friday", "Park and scooter days", "Study corner, quiet after bedtime"]
            c.years = 3; c.payFloor = 28; c.payText = "$28 an hour"
            c.headline = "Education student. Playful evenings, quiet bedtimes."
            c.bio = "I study primary teaching and love evening shifts. I bring craft, music and a calm bedtime routine. I speak English and Mandarin."
            c.checks = [bc("3 Sep 2026"), RdKeyedCheck(key: "id", check: RdCheck(name: "Photo ID", status: "verified", date: "3 Sep 2026"))]
            c.certs = [RdCert(name: "First aid", status: "sighted", date: "18 Jun 2026"), RdCert(name: "CPR", status: "sighted", date: "18 Jun 2026")]
            c.skills = ["First aid", "CPR", "Homework help", "Swimming"]; c.languages = ["English", "Mandarin"]; c.traits = ["Playful", "Musical", "Gentle"]; c.approach = "Flexible"
            c.activities = ["Story time", "Music", "Arts and craft"]
            c.availDays = ["Fri", "Sat", "Sun"]; c.availFrom = 16; c.availTo = 24; c.maxKm = 12
            c.wantsTraits = ["Playful"]; c.wantsApproach = "Flexible"; c.willing = ["Homework help", "First aid"]
            c.visa = RdVisa(state: "ready", text: "Australian citizen")
        },
        carer("ella", "babysitter", "Ella Brooks") { c in
            c.age = 21; c.nat = "Australian"; c.suburb = "Paddington"; c.city = "Brisbane QLD"; c.lat = -27.461; c.lng = 153.0
            c.photos = ["xb_TL"]; c.years = 2; c.payFloor = 27
            c.checks = [bc("1 Jun 2026")]; c.certs = [RdCert(name: "First aid", status: "sighted", date: "2 Jun 2026")]
            c.skills = ["First aid", "Swimming"]; c.languages = ["English"]; c.traits = ["Playful"]; c.approach = "Flexible"; c.activities = ["Arts and craft", "Story time"]
            c.availDays = ["Fri", "Sat"]; c.availFrom = 17; c.availTo = 23; c.maxKm = 10
            c.wantsTraits = ["Playful"]; c.willing = ["First aid"]
            c.visa = RdVisa(state: "ready", text: "Australian citizen")
        },
        carer("kai", "babysitter", "Kai Tanaka") { c in
            c.age = 22; c.nat = "Japanese"; c.suburb = "St Lucia"; c.city = "Brisbane QLD"; c.lat = -27.497; c.lng = 153.0
            c.photos = ["xb_TR"]; c.years = 2; c.payFloor = 26
            c.checks = [bc("9 Apr 2026")]; c.certs = [RdCert(name: "First aid", status: "expired", date: "10 Mar 2025")]
            c.skills = ["First aid", "Swimming"]; c.languages = ["English", "Japanese"]; c.traits = ["Playful", "Musical"]; c.approach = "Flexible"; c.activities = ["Music", "Story time"]
            c.petsOk = false; c.availDays = ["Fri", "Sat", "Sun"]; c.availFrom = 17; c.availTo = 24; c.maxKm = 10; c.noPets = true
            c.wantsTraits = ["Playful"]; c.willing = ["First aid"]
            c.visa = RdVisa(state: "ready", text: "Australian citizen")
        },
        carer("anna", "aupair", "Anna Keller") { c in
            c.age = 23; c.nat = "German"; c.suburb = "Munich, Germany"; c.city = "Arrives Melbourne VIC"; c.lat = -37.82; c.lng = 145.0
            c.from = "Germany"; c.fromLon = 11.58; c.fromLat = 48.14
            c.photos = ["a1", "a2", "a3", "a4"]; c.captions = ["Anna", "Coast walks on her days off", "Baking, her favourite thing to do with children", "Passport and plans"]
            c.years = 3; c.payFloor = 250; c.payText = "$250 a week"
            c.headline = "Playful, musical, three years of childcare in Munich."
            c.bio = "I look after two children in Munich after school. I love music, swimming and baking. I want to live with a warm family in Melbourne and learn Australian life. German is my first language, so your children can hear it too."
            c.checks = [RdKeyedCheck(key: "police", check: RdCheck(name: "Police certificate from Germany", status: "verified", date: "10 Oct 2026")),
                        RdKeyedCheck(key: "wwcc_vic", check: RdCheck(name: "Victorian Working with Children Check", status: "pending", statusText: "Applied 20 Nov 2026, pending")),
                        RdKeyedCheck(key: "id", check: RdCheck(name: "Passport", status: "verified", date: "12 Nov 2026"))]
            c.certs = [RdCert(name: "First aid", status: "sighted", date: "14 Mar 2026")]
            c.skills = ["First aid", "Cooking", "Swimming", "Driving licence"]; c.languages = ["German", "English", "French"]; c.traits = ["Playful", "Musical", "Gentle"]; c.approach = "Flexible"
            c.activities = ["Music", "Outdoor play", "Reading"]
            c.arriveFrom = 10; c.arriveTo = 30; c.maxMonths = 6; c.maxHours = 30
            c.wantsHome = ["Own room", "Own bathroom", "Full board", "Use of car"]; c.ownRoom = true
            c.wantsTraits = ["Playful", "Musical"]; c.wantsApproach = "Flexible"; c.willing = ["Cooking", "First aid", "Swimming"]
            c.visa = RdVisa(state: "ready", type: "Working Holiday 417", text: "Visa approved, grant letter sighted 12 Nov 2026", arrives: "Arrives 11 Jan 2027", rule: "Working holiday rule: 6 months with one family")
        },
        carer("mei", "aupair", "Mei Lin") { c in
            c.age = 22; c.nat = "Taiwanese"; c.suburb = "Box Hill"; c.city = "Already in Melbourne VIC"; c.lat = -37.819; c.lng = 145.12
            c.from = "Taiwan"; c.fromLon = 121.56; c.fromLat = 25.04
            c.photos = ["xa_TR"]; c.years = 2; c.payFloor = 250
            c.checks = [RdKeyedCheck(key: "police", check: RdCheck(name: "Police certificate from Taiwan", status: "verified", date: "2 Aug 2026")),
                        RdKeyedCheck(key: "wwcc_vic", check: RdCheck(name: "Victorian Working with Children Check", status: "verified", date: "30 Sep 2026"))]
            c.certs = [RdCert(name: "First aid", status: "sighted", date: "4 Aug 2026")]
            c.skills = ["First aid", "Cooking"]; c.languages = ["Mandarin", "English"]; c.traits = ["Calm", "Gentle"]; c.approach = "Montessori"; c.activities = ["Reading", "Arts and craft"]
            c.arriveFrom = 0; c.arriveTo = 60; c.maxMonths = 6; c.maxHours = 30
            c.wantsHome = ["Own room", "Full board"]; c.wantsTraits = ["Calm"]; c.willing = ["Cooking", "First aid"]
            c.visa = RdVisa(state: "ready", type: "Work and Holiday 462", text: "Already in Melbourne, visa granted", arrives: "Here now", rule: "Working holiday rule: 6 months with one family")
        },
        carer("clara", "aupair", "Clara Doyle") { c in
            c.age = 24; c.nat = "Irish"; c.suburb = "Dublin, Ireland"; c.city = "Not yet in Australia"; c.lat = -37.82; c.lng = 145.0
            c.from = "Ireland"; c.fromLon = -6.26; c.fromLat = 53.35
            c.photos = ["xa_BR"]; c.years = 4; c.payFloor = 260
            c.checks = [RdKeyedCheck(key: "police", check: RdCheck(name: "Police certificate from Ireland", status: "verified", date: "1 Oct 2026"))]
            c.certs = [RdCert(name: "First aid", status: "sighted", date: "1 Sep 2026")]
            c.skills = ["First aid", "Swimming", "Driving licence"]; c.languages = ["English"]; c.traits = ["Playful", "Musical"]; c.approach = "Flexible"; c.activities = ["Music", "Swimming", "Outdoor play"]
            c.arriveFrom = 40; c.arriveTo = 90; c.maxMonths = 6; c.maxHours = 30
            c.wantsHome = ["Own room", "Use of car"]; c.wantsTraits = ["Playful"]; c.willing = ["First aid", "Swimming"]
            c.visa = RdVisa(state: "needed", type: "Working Holiday 417", text: "Not applied yet. Usually takes a few weeks", arrives: "Arrival after visa", rule: "Working holiday rule: 6 months with one family")
        },
        carer("luca", "aupair", "Luca Rossi") { c in
            c.age = 24; c.nat = "Italian"; c.suburb = "Rome, Italy"; c.city = "Not yet in Australia"; c.lat = -37.82; c.lng = 145.0
            c.from = "Italy"; c.fromLon = 12.5; c.fromLat = 41.9
            c.photos = ["xa_BL"]; c.years = 2; c.payFloor = 250
            c.checks = [RdKeyedCheck(key: "police", check: RdCheck(name: "Police certificate from Italy", status: "verified", date: "5 Oct 2026"))]
            c.certs = [RdCert(name: "First aid", status: "sighted", date: "3 Jul 2026")]
            c.skills = ["First aid", "Cooking"]; c.languages = ["Italian", "English"]; c.traits = ["Playful"]; c.approach = "Flexible"; c.activities = ["Cooking", "Outdoor play"]
            c.arriveFrom = 25; c.arriveTo = 70; c.maxMonths = 6; c.maxHours = 30
            c.wantsHome = ["Own room", "Full board"]; c.wantsTraits = ["Playful"]; c.willing = ["Cooking", "First aid"]
            c.visa = RdVisa(state: "inprogress", type: "Working Holiday 417", text: "Applied 2 Nov 2026, waiting for the decision", arrives: "Arrival after visa", rule: "Working holiday rule: 6 months with one family")
        }
    ]

    static let families: [RdFamily] = [
        fam("reyes", "nanny", "The Reyes family") { f in
            f.also = ["babysitter"]; f.suburb = "Paddington"; f.city = "Brisbane QLD"; f.lat = -27.460; f.lng = 153.007
            f.photos = ["f1", "f2", "f3", "f4"]; f.captions = ["Sofia and Daniel", "Our living room", "The back garden", "Breakfast, 7:30am"]
            f.kids = "Two children, ages 3 and 6"; f.pets = true; f.petText = "One friendly dog"
            f.headline = "Looking for a nanny, Mon Wed Fri."
            f.bio = "We are two working parents who love slow weekends and a calm, kind home. We speak English and Spanish at home. We want someone who loves the outdoors, cooks with the children and follows a gentle, Montessori feel."
            f.needDays = ["Mon", "Wed", "Fri"]; f.needFrom = 7.5; f.needTo = 17.5; f.radiusKm = 12
            f.wantsLanguages = ["Spanish"]; f.wantsTasks = ["Cooking", "Homework help"]; f.wantsSkills = ["First aid", "CPR"]; f.wantsTraits = ["Calm", "Playful"]
            f.wantsApproach = "Montessori"; f.wantsActivities = ["Outdoor play", "Cooking", "Music"]
            f.mustCheck = "bluecard"; f.mustSkills = ["First aid", "Driving licence"]; f.mustPetsOk = true
            f.payOffer = 42; f.payUnit = "hour"; f.payText = "$42 an hour"
            f.homeLanguages = ["English", "Spanish"]; f.climate = ["Calm", "Playful"]; f.start = "From 11 Jan 2027"
        },
        fam("reyesb", "babysitter", "The Reyes family") { f in
            f.suburb = "Paddington"; f.city = "Brisbane QLD"; f.lat = -27.460; f.lng = 153.007
            f.photos = ["f1", "f2", "f3", "f4"]; f.captions = ["Sofia and Daniel", "Our living room", "The back garden", "Breakfast, 7:30am"]
            f.kids = "Two children, ages 3 and 6"; f.pets = false
            f.headline = "Looking for a babysitter, Fri and Sat evenings."
            f.bio = "We are two working parents who love slow weekends and a calm, kind home. We need a babysitter for Friday and Saturday evenings."
            f.needDays = ["Fri", "Sat"]; f.needFrom = 18; f.needTo = 23; f.radiusKm = 10
            f.wantsSkills = ["First aid"]; f.wantsTraits = ["Calm", "Playful"]; f.wantsActivities = ["Story time", "Arts and craft"]
            f.mustCheck = "bluecard"; f.mustSkills = ["First aid"]; f.mustPetsOk = true
            f.payOffer = 32; f.payUnit = "hour"; f.payText = "$32 an hour"
            f.homeLanguages = ["English", "Spanish"]; f.climate = ["Calm", "Playful"]
        },
        fam("nguyen", "nanny", "The Nguyen family") { f in
            f.suburb = "Chermside"; f.city = "Brisbane QLD"; f.lat = -27.386; f.lng = 153.032; f.photos = ["xfn_TL"]
            f.kids = "One child, age 2"; f.headline = "Looking for a nanny, Mon to Thu."
            f.needDays = ["Mon", "Tue", "Wed", "Thu"]; f.needFrom = 8; f.needTo = 16; f.radiusKm = 15
            f.wantsTasks = ["Cooking"]; f.wantsSkills = ["First aid"]; f.wantsTraits = ["Calm", "Gentle"]; f.wantsApproach = "Flexible"; f.wantsActivities = ["Reading", "Music"]
            f.mustCheck = "bluecard"; f.mustSkills = ["First aid"]; f.payOffer = 40; f.payText = "$40 an hour"
            f.homeLanguages = ["English", "Vietnamese"]; f.climate = ["Calm", "Gentle"]
        },
        fam("harris", "nanny", "The Harris family") { f in
            f.suburb = "Bulimba"; f.city = "Brisbane QLD"; f.lat = -27.452; f.lng = 153.058; f.photos = ["xfn_TR"]
            f.kids = "Three children, ages 2 to 9"; f.pets = true; f.headline = "Looking for a nanny, Tue Thu."
            f.needDays = ["Tue", "Thu"]; f.needFrom = 8; f.needTo = 18; f.radiusKm = 15
            f.wantsTasks = ["Homework help", "Cooking"]; f.wantsSkills = ["First aid", "CPR"]; f.wantsTraits = ["Playful"]; f.wantsActivities = ["Outdoor play", "Swimming"]
            f.mustCheck = "bluecard"; f.mustSkills = ["First aid", "Driving licence"]; f.payOffer = 45; f.payText = "$45 an hour"
            f.homeLanguages = ["English"]; f.climate = ["Playful"]
        },
        fam("hartley", "aupair", "The Hartley family") { f in
            f.suburb = "Hawthorn"; f.city = "Melbourne VIC"; f.lat = -37.822; f.lng = 145.035
            f.photos = ["h1", "h2", "h3", "h4"]; f.captions = ["Mei and Tom Hartley", "Your own room", "Your own bathroom", "Our home in Hawthorn"]
            f.kids = "Two children, ages 4 and 7"; f.headline = "Looking for an au pair, from January."
            f.bio = "We are a busy, warm family in Hawthorn. We would love an au pair who is playful, musical and happy to speak some German with the children. You get your own room and bathroom, full board, use of our car and two days off every week."
            f.startFrom = 0; f.startTo = 45; f.months = 9; f.hours = 25; f.startText = "in January"
            f.wantsLanguages = ["German"]; f.wantsTasks = ["Cooking"]; f.wantsSkills = ["First aid", "Swimming"]; f.wantsTraits = ["Playful", "Musical"]
            f.wantsApproach = "Flexible"; f.wantsActivities = ["Music", "Outdoor play", "Swimming"]
            f.mustCheck = "police"; f.mustSkills = ["First aid"]; f.payOffer = 300; f.payUnit = "week"; f.payText = "$300 a week for 25 hours"
            f.homeLanguages = ["English", "German"]; f.climate = ["Playful", "Musical"]
            f.offersHome = ["Own room", "Own bathroom", "Full board", "Use of car", "Phone plan", "Language course help", "Completion bonus", "Two days off a week"]
            f.start = "January or early February 2027"; f.stay = "9 months, 6 months is fine"
        },
        fam("brandt", "aupair", "The Brandt family") { f in
            f.suburb = "Brighton"; f.city = "Melbourne VIC"; f.lat = -37.91; f.lng = 145.0; f.photos = ["xfa_TL"]
            f.kids = "One child, age 5"; f.headline = "Looking for an au pair, February."
            f.startFrom = 20; f.startTo = 60; f.months = 6; f.hours = 30; f.startText = "in February"
            f.wantsTasks = ["Cooking"]; f.wantsSkills = ["First aid"]; f.wantsTraits = ["Calm"]; f.wantsApproach = "Montessori"; f.wantsActivities = ["Reading", "Arts and craft"]
            f.mustCheck = "police"; f.mustSkills = ["First aid"]; f.payOffer = 280; f.payUnit = "week"; f.payText = "$280 a week for 30 hours"
            f.homeLanguages = ["English"]; f.climate = ["Calm"]; f.offersHome = ["Own room", "Full board", "Phone plan"]
        },
        fam("okoye", "aupair", "The Okoye family") { f in
            f.suburb = "Camberwell"; f.city = "Melbourne VIC"; f.lat = -37.825; f.lng = 145.07; f.photos = ["xfa_TR"]
            f.kids = "Two children, ages 3 and 8"; f.headline = "Looking for an au pair, January."
            f.startFrom = 0; f.startTo = 40; f.months = 6; f.hours = 25; f.startText = "in January"
            f.wantsTasks = ["Cooking"]; f.wantsSkills = ["First aid", "Swimming"]; f.wantsTraits = ["Playful"]; f.wantsApproach = "Flexible"; f.wantsActivities = ["Outdoor play", "Music"]
            f.mustCheck = "police"; f.mustSkills = ["First aid"]; f.payOffer = 260; f.payUnit = "week"; f.payText = "$260 a week for 25 hours"
            f.homeLanguages = ["English"]; f.climate = ["Playful"]; f.offersHome = ["Own room", "Own bathroom", "Full board", "Use of car"]
        }
    ]

    static func carer(id: String) -> RdCarer { return carers.first(where: { $0.id == id }) ?? carers[0] }
    static func family(id: String) -> RdFamily { return families.first(where: { $0.id == id }) ?? families[0] }
}
