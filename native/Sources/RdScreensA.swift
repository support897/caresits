import SwiftUI
import AuthenticationServices

// Onboarding and setup screens. Same words and order as the approved mockup.

struct RdScroll<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View { ScrollView(showsIndicators: false) { VStack(spacing: 0) { content() }.padding(.bottom, 24) } }
}

struct RdBigTitle: View {
    var text: String
    var sub: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(text).font(RdF.title(32)).foregroundColor(RdC.ink).fixedSize(horizontal: false, vertical: true)
            if let s = sub { Text(s).font(RdF.body(16)).foregroundColor(RdC.mut) }
        }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 20).padding(.top, 20).padding(.bottom, 12)
    }
}

struct RdBigChoice: View {
    var icon: String
    var title: String
    var sub: String
    var fill: Color
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                RdIcon(name: icon, size: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(RdF.title(24)).foregroundColor(RdC.ink)
                    Text(sub).font(RdF.body(15)).foregroundColor(RdC.ink).multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
            }.padding(20).background(fill).clipShape(RoundedRectangle(cornerRadius: 28)).overlay(RoundedRectangle(cornerRadius: 28).stroke(RdC.ink, lineWidth: 2))
        }.buttonStyle(.plain).padding(.horizontal, 20).padding(.vertical, 6)
    }
}

struct RdSplash: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            BunnyView(size: 130, mood: .hello)
            Text("Caresitters").font(RdF.title(44)).foregroundColor(RdC.pink)
            Text("Find care. Share the day.").font(RdF.body(18)).foregroundColor(RdC.mut)
            Spacer()
            RdCta(title: "Start") { st.go("role") }.padding(.horizontal, 20).padding(.bottom, 30)
        }
    }
}

struct RdRole: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            RdBigTitle(text: "Who are you?", sub: "Pick one. You can switch later.")
            RdBigChoice(icon: "home", title: "Family", sub: "I want care for my children", fill: RdC.lav) { st.isFamily = true; st.go("door") }
            RdBigChoice(icon: "nanny", title: "Carer", sub: "Nanny, babysitter or au pair", fill: RdC.blush) { st.isFamily = false; st.go("door") }
            Spacer()
        }
    }
}

struct RdDoor: View {
    @EnvironmentObject var st: RdStore
    @EnvironmentObject var session: Session
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            RdBigTitle(text: "Hi, what is your name?")
            RdInput(label: "First name", text: $st.firstName)
            Spacer().frame(height: 18)
            RdCta(title: "Continue with Google", style: 1) {
                Task { do { try await session.google(); st.err = ""; st.go("caretype") } catch { st.err = error.localizedDescription } }
            }.padding(.horizontal, 20).padding(.bottom, 12)
            SignInWithAppleButton(.continue, onRequest: { session.prepareApple($0) }, onCompletion: { r in
                Task { do { try await session.finishApple(r); st.err = ""; st.go("caretype") } catch { st.err = error.localizedDescription } }
            }).signInWithAppleButtonStyle(.black).frame(height: 60).clipShape(Capsule()).padding(.horizontal, 20)
            if !st.err.isEmpty { Text(st.err).font(RdF.body(13)).foregroundColor(RdC.ras).padding(.horizontal, 20).padding(.top, 10) }
            Button { st.go("email") } label: { Text("Use email").font(RdF.bold(15)).foregroundColor(RdC.mut).frame(maxWidth: .infinity).padding(.top, 18) }.buttonStyle(.plain)
            Spacer()
        }
    }
}

struct RdEmail: View {
    @EnvironmentObject var st: RdStore
    @EnvironmentObject var session: Session
    @State private var creating = true
    @State private var busy = false
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: creating ? "Create account" : "Sign in")
            RdInput(label: "Email", text: $st.email, keyboard: .emailAddress)
            RdInput(label: "Password", text: $st.password, secure: true)
            if !st.err.isEmpty { Text(st.err).font(RdF.body(13)).foregroundColor(RdC.ras).padding(.horizontal, 20).padding(.top, 8) }
            Button { creating.toggle() } label: { Text(creating ? "I already have an account" : "Make a new account").font(RdF.bold(15)).foregroundColor(RdC.mut).padding(.top, 14) }.buttonStyle(.plain)
            Spacer()
            RdBottomBar { RdCta(title: busy ? "One moment" : "Continue") {
                busy = true
                Task {
                    do { try await session.email(st.email.trimmingCharacters(in: .whitespaces), st.password, create: creating); st.err = ""; busy = false; st.go("caretype") }
                    catch { st.err = error.localizedDescription; busy = false }
                }
            } }
        }
    }
}

struct RdCareOpt: View {
    @EnvironmentObject var st: RdStore
    var role: String
    var sub: String
    var body: some View {
        Button {
            st.setupRole = role
            if st.isFamily { st.setupRole = "family" }
            st.pickedCare = role
            st.go("sw")
        } label: {
            HStack(spacing: 14) {
                RdIcon(name: RdPill.icon(role), size: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(RdPill.name(role)).font(RdF.title(22)).foregroundColor(RdC.ink)
                    Text(sub).font(RdF.body(15)).foregroundColor(RdC.mut)
                }
                Spacer()
                RdIcon(name: "chevron", size: 20)
            }.padding(16).background(RdC.role(role).opacity(0.5)).clipShape(RoundedRectangle(cornerRadius: 24)).overlay(RoundedRectangle(cornerRadius: 24).stroke(RdC.ink, lineWidth: 2))
        }.buttonStyle(.plain).padding(.horizontal, 20).padding(.vertical, 5)
    }
}

struct RdCareType: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            RdHeader(title: st.isFamily ? "What care fits?" : "What do you do?")
            RdMuted(text: st.isFamily ? "Pick one or more. You can change this any time." : "Pick one or more. You can change this any time.").padding(.horizontal, 20).padding(.bottom, 8)
            RdCareOpt(role: "nanny", sub: "Regular care at home")
            RdCareOpt(role: "babysitter", sub: "Evenings and weekends")
            RdCareOpt(role: "aupair", sub: "Live in help, from home or abroad")
            RdMuted(text: st.isFamily ? "Families can look for more than one." : "Carers can offer more than one.").padding(.horizontal, 20).padding(.top, 8)
            Spacer()
        }
    }
}

struct RdStepFrame<Content: View>: View {
    @EnvironmentObject var st: RdStore
    var title: String
    var step: Int
    var next: String
    var nextLabel: String = "Next"
    var onNext: (() -> Void)? = nil
    var finish: Bool = false
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: title, trailing: AnyView(Button { RdLive.saveSetup(st); st.root(st.isFamily ? "famhome" : "carhome") } label: { Text("Skip for now").font(RdF.bold(14)).foregroundColor(RdC.ras) }.buttonStyle(.plain)))
            HStack(spacing: 4) { ForEach(0..<6, id: \.self) { i in Capsule().fill(i < step ? RdC.pink : RdC.line).frame(height: 5) } }.padding(.horizontal, 20).padding(.bottom, 4)
            RdScroll { content() }
            RdBottomBar { RdCta(title: nextLabel) { onNext?(); if finish { st.root(st.isFamily ? "famhome" : "carhome") } else { st.go(next) } } }
        }
    }
}

struct RdSetupWho: View {
    @EnvironmentObject var st: RdStore
    var radiusBinding: Binding<[String]> { Binding(get: { [String(st.radius) + " km"] }, set: { v in st.radius = Int((v.first ?? "15 km").split(separator: " ").first ?? "15") ?? 15 }) }
    var homeBinding: Binding<[String]> { Binding(get: { st.home.isEmpty ? [] : [st.home] }, set: { st.home = $0.first ?? "" }) }
    var countryBinding: Binding<[String]> { Binding(get: { [st.country] }, set: { st.country = $0.first ?? "Australia" }) }
    var visaBinding: Binding<[String]> { Binding(get: { [st.visa] }, set: { st.visa = $0.first ?? st.visa }) }
    func status(_ d: String) -> String {
        if d == st.home { return "You live there" }
        let l = (RdVisaBy.lines[d] ?? ["Not confirmed"])[0]
        return (l.contains("Not confirmed") || l.contains("No au pair") || l.contains("no au pair")) ? "Check the rules" : "You can apply from " + (st.home.isEmpty ? "home" : st.home)
    }
    var body: some View {
        let r = st.setupRole
        RdStepFrame(title: "About you", step: 6, next: r == "aupair" ? "visacheck" : "sa", nextLabel: r == "aupair" ? "Next" : "Finish", onNext: { RdLive.saveSetup(st) }, finish: r != "aupair") {
            if r == "aupair" {
                RdLabel(title: "Which country are you from?", sub: "Pick from the list. Families can find you by country.")
                RdSelChips(items: RdVisaBy.homeList, multi: false, sel: homeBinding)
                RdLabel(title: "Where do you want to go?", sub: "Pick up to 3. The first one you tap is your first choice.")
                RdSelChips(items: RdVisaBy.destList, multi: true, max: 3, sel: $st.dests)
                ForEach(Array(st.dests.enumerated()), id: \.offset) { i, d in RdVisaRow(n: i + 1, place: d, status: status(d)) }
                RdLabel(title: "Your visa for your first choice")
                RdSelChips(items: ["I live there already", "Visa approved", "Visa in progress", "I have not applied yet"], multi: false, sel: visaBinding)
            } else {
                let fam = r == "family"
                RdLabel(title: "Which country?")
                RdSelChips(items: RdVisaBy.destList, multi: false, sel: countryBinding)
                RdLabel(title: "Your postcode", sub: fam ? "We show you carers inside your distance. Carers see your postcode, not your street." : "Families see your postcode and how far you are. Never your street.")
                RdInput(label: "Postcode", text: $st.postcode, keyboard: .numbersAndPunctuation)
                RdLabel(title: fam ? "How far should carers be?" : "How far can you travel?", sub: "We only show people inside this circle.")
                RdSelChips(items: ["5 km", "10 km", "15 km", "25 km"], multi: false, sel: radiusBinding)
                if fam {
                    RdLabel(title: "Your children", sub: "How many and how old. No names.")
                    RdKidsEditor(ages: $st.kidsAges)
                    RdLabel(title: "Au pairs", sub: "Only matters if you look for an au pair.")
                    Toggle("Visa ready only", isOn: $st.visaOnly).font(RdF.bold(16)).padding(.horizontal, 20)
                    Toggle("Already living in my country", isOn: $st.inCountryOnly).font(RdF.bold(16)).padding(.horizontal, 20).padding(.top, 6)
                }
            }
        }
    }
}

struct RdSetupAbout: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let r = st.setupRole
        RdStepFrame(title: r == "family" ? "Your home" : "Your details", step: 2, next: "ss", onNext: { RdLive.saveSetup(st) }) {
            if r == "family" {
                RdLabel(title: "Your children", sub: "How many and how old. No names.")
                RdKidsEditor(ages: $st.kidsAges)
                RdLabel(title: "At home")
                RdTickGrid(items: ["Pets are fine", "Non smoker", "Own room", "Own bathroom"], on: ["Pets are fine", "Non smoker"])
                RdLabel(title: "Languages at home")
                RdWrap(items: ["English", "Spanish", "German", "Mandarin", "Italian", "French", "Japanese", "Arabic"], on: ["English", "Spanish"])
            } else {
                RdField(label: "Age", value: "34")
                RdField(label: "Years with children", value: "9")
                RdLabel(title: "Languages you speak")
                RdWrap(items: ["English", "Spanish", "German", "Mandarin", "Italian", "French", "Japanese", "Arabic"], on: ["English", "Spanish"])
                RdLabel(title: "Ages you like")
                RdTickGrid(items: ["Newborns", "Toddlers", "Ages 3 to 5", "Ages 6 to 12", "Teens"], on: ["Toddlers", "Ages 3 to 5"])
                RdLabel(title: "Your own life")
                RdTickGrid(items: ["Pets are fine", "Non smoker", "Own car"], on: ["Pets are fine", "Non smoker"])
            }
        }
    }
}

struct RdSetupStyle: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let fam = st.setupRole == "family"
        RdStepFrame(title: "Your style", step: 3, next: "sk") {
            RdLabel(title: fam ? "What style do you like?" : "How do you care?", sub: "Tap all that fit.")
            RdTickGrid(items: ["Montessori", "Waldorf", "Play based", "Reggio", "Flexible", "Strict"], on: ["Montessori"])
            RdLabel(title: fam ? "What are your children like?" : "What are you like?")
            RdTickGrid(items: ["Calm", "Gentle", "Firm", "Playful", "Outdoorsy", "Musical", "Funny", "Patient", "Energetic"], on: ["Calm", "Gentle", "Outdoorsy"])
            RdLabel(title: fam ? "What do they love?" : "What do you love doing?")
            RdTickGrid(items: ["Dancing", "Music", "Arts and craft", "Outdoor play", "Reading", "Sport", "Gardening", "Animals", "Baking"], on: ["Outdoor play", "Reading"])
        }
    }
}

struct RdSetupSkills: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let fam = st.setupRole == "family"
        RdStepFrame(title: fam ? "What you need" : "Your skills", step: 4, next: "sd") {
            if fam {
                RdLabel(title: "Must have", sub: "Tap once for nice to have. Tap again for must have.")
                RdTickGrid(items: ["First aid", "CPR", "Driving licence", "Own car", "Homework help", "School runs", "Meal prep", "Light housework"], on: ["First aid", "Driving licence"])
                RdLabel(title: "Safety checks", sub: "We show the right check for your place.")
                RdWrap(items: ["Blue Card (Queensland)", "Police certificate (au pair)", "Photo ID checked"], on: ["Blue Card (Queensland)"])
            } else {
                RdLabel(title: "What can you do?", sub: "Tap all that fit.")
                RdTickGrid(items: ["First aid", "CPR", "Driving licence", "Own car", "Homework help", "School runs", "Meal prep", "Light housework", "Swimming", "Special needs", "Twins", "Sleep routines"], on: ["First aid", "CPR", "Driving licence", "Cooking"])
                RdLabel(title: "Your checks", sub: "Uploaded is not checked. Verified means a real check with a date.")
                RdWrap(items: ["Blue Card", "Photo ID", "First aid certificate", "Police certificate"], on: ["Blue Card"])
            }
        }
    }
}

struct RdSetupDesc: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let fam = st.setupRole == "family"
        let starters: [String] = fam ? ["We are a busy, warm family", "We love weekends outside", "We want someone calm and kind"] : ["I love slow mornings and park days", "I follow a gentle routine", "I stay calm when things get busy"]
        let draft: String = fam ? "We are two working parents with two children, 3 and 6. We speak English and Spanish at home, and we love the outdoors and cooking together. We would love a calm, kind carer who follows a Montessori feel." : "I am a 34 year old nanny with nine years of experience. I follow a Montessori approach, love cooking and the outdoors, and keep routines gentle. I speak English and Spanish."
        RdStepFrame(title: "A few words", step: 5, next: "sm") {
            RdLabel(title: "One line about you", sub: "Short is best. Families read this first.")
            RdField(label: "Headline", value: fam ? "Looking for a nanny, Mon Wed Fri." : "Calm, curious and organised.")
            RdLabel(title: "Need a start?", sub: "Tap a line to begin.")
            RdWrap(items: starters)
            RdLabel(title: "Your description", sub: "We wrote a draft from your ticks. Change it any way you like.")
            RdCard { Text(draft).font(RdF.body(16)).foregroundColor(RdC.ink).fixedSize(horizontal: false, vertical: true) }
        }
    }
}

let rdSlots: [String] = ["Early 6 to 9", "Morning 9 to 12", "Afternoon 12 to 3", "After school 3 to 6", "Evening 6 to 10"]

struct RdSlotCell: View {
    @State var on: Bool
    var strong: Bool = false
    var dashed: Bool = false
    var body: some View {
        Button { on.toggle() } label: {
            RoundedRectangle(cornerRadius: 10).fill(on ? (strong ? RdC.ras : RdC.pink) : RdC.field).frame(height: 34)
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(dashed && !on ? RdC.sun : Color.clear, style: StrokeStyle(lineWidth: 1.5, dash: [4])))
        }.buttonStyle(.plain)
    }
}

/// The weekly calendar: days across, time slots down. Tap a block to switch it on.
struct RdCalendar: View {
    var days: [String]
    var from: Double
    var to: Double
    var strong: Bool = false
    var freeDays: [String] = []
    var freeFrom: Double = 0
    var freeTo: Double = 0
    var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 4) {
                Text("").frame(width: 78)
                ForEach(RdData.weekdays, id: \.self) { d in Text(d).font(RdF.bold(12)).foregroundColor(RdC.mut).frame(maxWidth: .infinity) }
            }
            ForEach(0..<rdSlots.count, id: \.self) { i in
                HStack(spacing: 4) {
                    Text(rdSlots[i]).font(RdF.body(11)).foregroundColor(RdC.mut).frame(width: 78, alignment: .leading).lineLimit(2)
                    ForEach(RdData.weekdays, id: \.self) { d in RdSlotCell(on: RdCalendar.slotOn(d, i, days, from, to), strong: strong, dashed: RdCalendar.slotOn(d, i, freeDays, freeFrom, freeTo)) }
                }
            }
        }.padding(.horizontal, 20)
    }
    static func slotOn(_ d: String, _ i: Int, _ days: [String], _ from: Double, _ to: Double) -> Bool {
        if !days.contains(d) { return false }
        let ranges: [(Double, Double)] = [(6, 9), (9, 12), (12, 15), (15, 18), (18, 22)]
        let r = ranges[i]
        return from < r.1 && to > r.0
    }
}

struct RdSetupWhen: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let fam = st.setupRole == "family"
        RdStepFrame(title: "When", step: 6, next: "photoup", nextLabel: "Next") {
            RdLabel(title: fam ? "When do you need care" : "When are you free", sub: fam ? "Tap the times. We only show people who are free." : "Tap the times you can work.")
            RdCalendar(days: fam ? ["Mon", "Wed", "Fri"] : ["Mon", "Tue", "Wed", "Thu", "Fri"], from: fam ? 7.5 : 7, to: fam ? 17.5 : 18)
            HStack(spacing: 14) {
                HStack(spacing: 6) { RoundedRectangle(cornerRadius: 4).fill(RdC.pink).frame(width: 14, height: 14); Text(fam ? "Needed" : "Free").font(RdF.body(13)).foregroundColor(RdC.mut) }
                HStack(spacing: 6) { RoundedRectangle(cornerRadius: 4).fill(RdC.field).frame(width: 14, height: 14); Text("Not needed").font(RdF.body(13)).foregroundColor(RdC.mut) }
            }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 20).padding(.top, 8)
            RdLabel(title: "What matters most to you?", sub: "Slide up what matters. We find your best pair.")
            VStack(spacing: 6) {
                RdBarRow(left: "Days and hours", value: "25")
                RdBarRow(left: "Style and approach", value: "20")
                RdBarRow(left: "Skills", value: "20")
                RdBarRow(left: "Language", value: "15")
                RdBarRow(left: "Place", value: "10")
                RdBarRow(left: "Activities", value: "10")
            }.padding(.horizontal, 20)
        }
    }
}

struct RdPhotoUp: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let keys: [String] = st.isFamily ? ["f1", "f2"] : ["n1", "n2"]
        VStack(spacing: 0) {
            RdHeader(title: "Add your photos")
            RdScroll {
                HStack(spacing: 8) {
                    RdPhoto(key: keys[0]).frame(height: 190).clipShape(RoundedRectangle(cornerRadius: 22))
                    VStack(spacing: 8) {
                        RdPhoto(key: keys[1]).frame(height: 91).clipShape(RoundedRectangle(cornerRadius: 22))
                        ZStack { RoundedRectangle(cornerRadius: 22).strokeBorder(RdC.pink, style: StrokeStyle(lineWidth: 2, dash: [6])); RdIcon(name: "plus", size: 28) }.frame(height: 91)
                    }
                }.padding(.horizontal, 20).padding(.top, 8)
                RdCard(tint: RdC.pale) {
                    Text(st.isFamily ? "Show your home, not your children." : "Show your smile and what you love doing.").font(RdF.bold(16)).foregroundColor(RdC.ink)
                    Text("Children faces are never shown.").font(RdF.body(14)).foregroundColor(RdC.mut)
                }
            }
            RdBottomBar { RdCta(title: "Find my pair") { st.go("finding") } }
        }
    }
}

struct RdFinding: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("Finding your perfect pair").font(RdF.title(30)).multilineTextAlignment(.center).foregroundColor(RdC.ink)
            Text("Checking days, hours, language, checks and style.").font(RdF.body(16)).foregroundColor(RdC.mut).multilineTextAlignment(.center)
            RdRing(pct: 97, size: 120, line: 10)
            Spacer()
            RdCta(title: "See my best match") {
                st.viewKey = st.defaultViewKey()
                st.tab = 0
                st.root(st.isFamily ? "famhome" : "carhome")
            }.padding(.horizontal, 20).padding(.bottom, 30)
        }.padding(.horizontal, 20)
    }
}
