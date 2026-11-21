import SwiftUI

// Discover, profile, booking, trial and chat screens.

struct RdTopBar: View {
    @EnvironmentObject var st: RdStore
    var on: String // deck, map, list
    var dark: Bool = false
    var body: some View {
        HStack(spacing: 8) {
            RdIconButton(icon: "menu", glass: true) { st.go("menu") }
            HStack(spacing: 2) {
                seg("Deck", "deck")
                seg("Map", st.ctx().au && st.ctx().fm ? "worldmap" : "map")
                seg("List", "list")
            }.padding(3).background(Color.white.opacity(0.85)).clipShape(Capsule())
            RdIconButton(icon: "sliders", glass: true) { st.go("filters") }
        }.padding(.horizontal, 16).padding(.top, 4)
    }
    func seg(_ t: String, _ id: String) -> some View {
        let isOn: Bool = (t.lowercased() == on)
        return Button { if !isOn { st.root(id) } } label: {
            Text(t).font(RdF.bold(14)).foregroundColor(isOn ? .white : RdC.ink).frame(maxWidth: .infinity).padding(.vertical, 8).background(isOn ? RdC.ink : Color.clear).clipShape(Capsule())
        }.buttonStyle(.plain)
    }
}

struct RdDeck: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        ZStack(alignment: .bottom) {
            RdPhoto(key: c.photos[0]).ignoresSafeArea()
            LinearGradient(colors: [Color.clear, Color.black.opacity(0.35)], startPoint: .center, endPoint: .bottom).ignoresSafeArea()
            VStack(spacing: 8) {
                HStack(spacing: 4) { ForEach(0..<c.photos.count, id: \.self) { i in Capsule().fill(i == 0 ? Color.white : Color.white.opacity(0.5)).frame(height: 3) } }.padding(.horizontal, 16)
                RdTopBar(on: "deck")
                HStack { Spacer(); Text("Sample").font(RdF.bold(11)).foregroundColor(.white).padding(.horizontal, 10).padding(.vertical, 3).background(Color.black.opacity(0.45)).clipShape(Capsule()) }.padding(.horizontal, 20)
                Spacer()
            }
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    RdRing(pct: c.m.pct, size: 76, line: 8)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(c.m.label).font(RdF.bold(12)).foregroundColor(.white).padding(.horizontal, 12).padding(.vertical, 3).background(RdC.ras).clipShape(Capsule())
                        Text(c.name).font(RdF.title(26)).foregroundColor(RdC.ink).lineLimit(1).minimumScaleFactor(0.7)
                        Text(c.subline).font(RdF.body(13)).foregroundColor(RdC.mut).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    Spacer(minLength: 0)
                }
                HStack(spacing: 6) { RdPills(roles: c.pillRoles) }
                HStack(spacing: 6) {
                    if c.fm && !c.au { RdChip(text: "Blue Card", icon: "shield") }
                    if c.au && c.fm { RdVisaChip(visa: c.car.visa) }
                }
                ForEach(Array(c.reasons.prefix(2).enumerated()), id: \.offset) { _, r in RdReason(text: r) }
                Button { st.go("why") } label: { Text("See why " + String(c.m.pct) + " percent").font(RdF.bold(13)).foregroundColor(RdC.ras) }.buttonStyle(.plain)
                HStack(spacing: 10) {
                    RdIconButton(icon: "x", size: 52) { st.root(st.isFamily ? "famhome" : "carhome") }
                    RdCta(title: c.mainTitle, icon: c.mainIcon) { st.go("book") }
                    RdMsgButton(action: { st.go("chat") }, size: 52)
                }.padding(.top, 4)
            }.padding(14).background(Color.white.opacity(0.94)).clipShape(RoundedRectangle(cornerRadius: 28)).padding(.horizontal, 12).padding(.bottom, 12)
                .onTapGesture { st.go("profile") }
        }
    }
}

struct RdSection: View {
    var title: String
    var items: [String] = []
    var text: String? = nil
    var on: Bool = true
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(RdF.title(19)).foregroundColor(RdC.ink)
            if let t = text { Text(t).font(RdF.body(16)).foregroundColor(RdC.ink).fixedSize(horizontal: false, vertical: true) }
            if !items.isEmpty { RdFlow(spacing: 8) { ForEach(items, id: \.self) { RdChip(text: $0, icon: RdIcons.forLabel($0)) } } }
        }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 20).padding(.vertical, 10)
    }
}

struct RdBentoTile: View {
    var key: String
    var cap: String
    var h: CGFloat
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            RdPhoto(key: key).frame(height: h).clipShape(RoundedRectangle(cornerRadius: 22))
            Text(cap).font(RdF.bold(12)).foregroundColor(RdC.ink).lineLimit(2).padding(.horizontal, 10).padding(.vertical, 4).background(Color.white.opacity(0.9)).clipShape(Capsule()).padding(8)
        }
    }
}

struct RdBento: View {
    var photos: [String]
    var caps: [String]
    func cap(_ i: Int) -> String { return i < caps.count ? caps[i] : "" }
    var body: some View {
        VStack(spacing: 6) {
            RdBentoTile(key: photos[0], cap: cap(0), h: 230)
            if photos.count > 2 {
                HStack(spacing: 6) {
                    RdBentoTile(key: photos[1], cap: cap(1), h: 120)
                    RdBentoTile(key: photos[2], cap: cap(2), h: 120)
                }
            } else if photos.count > 1 {
                RdBentoTile(key: photos[1], cap: cap(1), h: 120)
            }
            if photos.count > 3 { RdBentoTile(key: photos[3], cap: cap(3), h: 150) }
        }
    }
}

struct RdProfile: View {
    @EnvironmentObject var st: RdStore
    static func checkLine(_ ck: RdCheck) -> String {
        if ck.statusText.isEmpty { return ck.name + " · Verified " + ck.date }
        return ck.name + " · " + ck.statusText
    }
    static func certLine(_ k: RdCert) -> String {
        if k.status == "expired" { return k.name + " · Expired " + k.date }
        return k.name + " · Sighted " + k.date
    }
    var body: some View {
        let c = st.ctx()
        ZStack(alignment: .bottom) {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    RdBento(photos: c.photos, caps: c.caps).padding(.horizontal, 16).padding(.top, 56).onTapGesture { st.go("photos") }
                    HStack(spacing: 12) {
                        RdRing(pct: c.m.pct, size: 84, line: 9)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(c.m.label).font(RdF.bold(14)).foregroundColor(RdC.ras)
                            Text(c.name).font(RdF.title(26)).foregroundColor(RdC.ink)
                            Text(c.subline).font(RdF.body(14)).foregroundColor(RdC.mut)
                        }
                        Spacer(minLength: 0)
                    }.padding(.horizontal, 20).padding(.vertical, 14)
                    HStack(spacing: 6) {
                        RdPills(roles: c.pillRoles)
                        if c.au && c.fm { RdVisaChip(visa: c.car.visa) }
                        Spacer(minLength: 0)
                    }.padding(.horizontal, 20)
                    Text(c.headline).font(RdF.bold(18)).foregroundColor(RdC.ink).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 20).padding(.top, 12)
                    RdSection(title: c.fm ? "About " + c.first : "About the family", text: c.bio)
                    RdCard(title: "Why you match", tint: RdC.pale) {
                        ForEach(Array(c.reasons.enumerated()), id: \.offset) { _, r in RdReason(text: r) }
                        ForEach(Array(c.m.gaps.enumerated()), id: \.offset) { _, g in RdReason(text: g, gap: true) }
                        Button { st.go("why") } label: { Text("See the full score").font(RdF.bold(15)).foregroundColor(RdC.ras) }.buttonStyle(.plain)
                    }
                    if c.fm { carerBody(c) } else { familyBody(c) }
                    RdSection(title: "Reviews", text: "No reviews yet. Real reviews appear here after a booking or a verified link.")
                    if c.fm && c.role == "nanny" {
                        Button { st.go("resumeview") } label: {
                            HStack { RdIcon(name: "doc", size: 22); Text("See resume").font(RdF.bold(16)).foregroundColor(RdC.ink); Spacer(); RdIcon(name: "chevron", size: 18) }
                                .padding(14).overlay(RoundedRectangle(cornerRadius: 20).stroke(RdC.line, lineWidth: 1))
                        }.buttonStyle(.plain).padding(.horizontal, 20).padding(.vertical, 6)
                    }
                    Spacer().frame(height: 110)
                }
            }
            VStack { HStack { RdIconButton(icon: "back", glass: true) { st.back() }; Spacer() }.padding(.horizontal, 16).padding(.top, 4); Spacer() }
            RdBottomBar {
                RdCta(title: c.mainTitle, icon: c.mainIcon) { st.go("book") }
                RdMsgButton { st.go("chat") }
            }
        }
    }
    @ViewBuilder func carerBody(_ c: RdCtx) -> some View {
        let car = c.car
        RdSection(title: "Checks")
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(car.checks.enumerated()), id: \.offset) { _, k in
                let ck = k.check
                let ok: Bool = ck.status == "verified"
                HStack(spacing: 8) {
                    RdIcon(name: ok ? "shield" : "clock", size: 20)
                    Text(RdProfile.checkLine(ck)).font(RdF.body(15)).foregroundColor(RdC.ink)
                    Spacer(minLength: 0)
                }
            }
            ForEach(Array(car.certs.enumerated()), id: \.offset) { _, k in
                HStack(spacing: 8) {
                    RdIcon(name: k.status == "expired" ? "info" : "doc", size: 20)
                    Text(RdProfile.certLine(k)).font(RdF.body(15)).foregroundColor(RdC.ink)
                    Spacer(minLength: 0)
                }
            }
        }.padding(.horizontal, 20)
        RdSection(title: "Skills", items: car.skills)
        RdSection(title: "Style", items: car.traits + (car.approach.isEmpty ? [] : [car.approach]))
        RdSection(title: "Loves doing", items: car.activities)
        RdSection(title: "Languages", items: car.languages)
        if c.au { RdSection(title: "Visa", text: car.visa.text + (car.visa.arrives.isEmpty ? "" : ". " + car.visa.arrives)) }
        RdSection(title: "When " + c.first + " is free")
        if c.au {
            RdMuted(text: car.visa.rule).padding(.horizontal, 20)
        } else {
            RdCalendar(days: car.availDays, from: car.availFrom, to: car.availTo)
        }
        RdSection(title: "Pay", text: car.payText)
    }
    @ViewBuilder func familyBody(_ c: RdCtx) -> some View {
        let f = c.fam
        RdSection(title: "The children", text: f.kids + (f.pets ? ". " + f.petText : ""))
        RdSection(title: "What they want", items: f.wantsTasks + f.wantsSkills + f.wantsTraits)
        if !f.offersHome.isEmpty { RdSection(title: "Home extras", items: f.offersHome) }
        RdSection(title: "Languages at home", items: f.homeLanguages)
        RdSection(title: "When they need care")
        if f.needDays.isEmpty { RdMuted(text: f.start + ". " + f.stay).padding(.horizontal, 20) } else { RdCalendar(days: f.needDays, from: f.needFrom, to: f.needTo) }
        RdSection(title: "They offer", text: f.payText)
    }
}

struct RdPhotosView: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        ZStack(alignment: .bottom) {
            Color(hex: 0x111111).ignoresSafeArea()
            TabView {
                ForEach(Array(c.photos.enumerated()), id: \.offset) { i, k in
                    VStack(spacing: 8) {
                        RdPhoto(key: k, contentMode: .fit).frame(maxHeight: 560).clipShape(RoundedRectangle(cornerRadius: 20))
                        Text(i < c.caps.count ? c.caps[i] : c.name).font(RdF.body(15)).foregroundColor(.white)
                    }.padding(.horizontal, 12)
                }
            }.tabViewStyle(.page)
            VStack { HStack { RdIconButton(icon: "x", glass: true) { st.back() }; Spacer() }.padding(16); Spacer() }
            RdCta(title: c.mainTitle, icon: c.mainIcon) { st.go("book") }.padding(.horizontal, 16).padding(.bottom, 24)
        }
    }
}

struct RdWhy: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        let m = c.m
        let scoredLine: String = "You scored " + String(m.forFamily) + ". " + c.first + " scored " + String(m.forCarer) + ". We use the average of both."
        VStack(spacing: 0) {
            RdHeader(title: "Why you match")
            RdScroll {
                VStack(spacing: 8) {
                    RdRing(pct: m.pct, size: 130, line: 12)
                    Text(m.label).font(RdF.title(24)).foregroundColor(RdC.ink)
                    Text(scoredLine).font(RdF.body(14)).foregroundColor(RdC.mut).multilineTextAlignment(.center).padding(.horizontal, 30)
                }.padding(.vertical, 10)
                RdCard(title: "How the score is made") {
                    ForEach(Array(m.buckets.enumerated()), id: \.offset) { _, b in
                        let v: Double = Double(b.family + b.carer) / 200.0
                        VStack(alignment: .leading, spacing: 4) {
                            HStack { Text(c.au && b.key == "availability" ? "Start, stay and hours" : b.label).font(RdF.body(15)).foregroundColor(RdC.ink); Spacer(); Text(String(Int((v * 100).rounded())) + "%").font(RdF.bold(15)).foregroundColor(RdC.ink) }
                            GeometryReader { g in ZStack(alignment: .leading) { Capsule().fill(RdC.blush); Capsule().fill(RdC.ras).frame(width: g.size.width * CGFloat(v)) } }.frame(height: 8)
                        }.padding(.vertical, 3)
                    }
                }
                RdCard(title: "Reasons", tint: RdC.pale) {
                    ForEach(Array(c.reasons.enumerated()), id: \.offset) { _, r in RdReason(text: r) }
                    ForEach(Array(m.gaps.enumerated()), id: \.offset) { _, g in RdReason(text: g, gap: true) }
                }
                RdMuted(text: "Money never adds points. Must haves are always kept. Visa never changes the score.").padding(.horizontal, 24).padding(.top, 8)
            }
            RdBottomBar { RdCta(title: c.mainTitle, icon: c.mainIcon) { st.go("book") }; RdMsgButton { st.go("chat") } }
        }
    }
}

struct RdBook: View {
    @EnvironmentObject var st: RdStore
    static func timeLine(_ f: RdFamily) -> String {
        let a: String = RdMatch.hourText(f.needFrom)
        let b: String = RdMatch.hourText(f.needTo)
        return a + " to " + b + ", starting next week"
    }
    var body: some View {
        let c = st.ctx()
        let f = c.fam
        VStack(spacing: 0) {
            RdHeader(title: c.fm ? "Book " + c.first : "Say yes to " + c.first)
            RdScroll {
                HStack(spacing: 12) {
                    RdPhoto(key: c.photos[0]).frame(width: 56, height: 56).clipShape(Circle())
                    VStack(alignment: .leading, spacing: 1) { Text(c.name).font(RdF.bold(17)).foregroundColor(RdC.ink); Text(String(c.m.pct) + " percent, " + c.m.label).font(RdF.body(14)).foregroundColor(RdC.mut) }
                    Spacer()
                    RdRing(pct: c.m.pct, size: 46, line: 6)
                }.padding(.horizontal, 20).padding(.vertical, 8)
                if c.au {
                    RdPick(items: ["3 months", "6 months", "Longer"], sel: 1).padding(.horizontal, 20)
                    RdCard(title: "The plan") {
                        RdBarRow(left: "Start", value: c.fm ? c.car.visa.arrives : f.start)
                        RdMuted(text: "Stay up to 6 months. " + c.car.visa.rule + ".")
                        RdBarRow(left: "Weekly", value: "25 hours, two days off")
                        RdBarRow(left: "Pay", value: f.payText)
                    }
                    RdSection(title: "Home extras", items: Array(f.offersHome.prefix(5)))
                } else {
                    RdPick(items: ["One time", "Every week", "Permanent"], sel: 1).padding(.horizontal, 20)
                    RdMuted(text: "Permanent means ongoing, with a notice period. You can change it later.").padding(.horizontal, 20).padding(.top, 6)
                    RdCard(title: "Your times") {
                        RdCalendar(days: f.needDays, from: f.needFrom, to: f.needTo, strong: true, freeDays: c.car.availDays, freeFrom: c.car.availFrom, freeTo: c.car.availTo).padding(.horizontal, -20)
                        HStack(spacing: 10) {
                            HStack(spacing: 4) { RoundedRectangle(cornerRadius: 3).fill(RdC.ras).frame(width: 12, height: 12); Text("Booked and free").font(RdF.body(11)).foregroundColor(RdC.mut) }
                            HStack(spacing: 4) { RoundedRectangle(cornerRadius: 3).fill(RdC.blush).frame(width: 12, height: 12); Text("Booked").font(RdF.body(11)).foregroundColor(RdC.mut) }
                            HStack(spacing: 4) { RoundedRectangle(cornerRadius: 3).strokeBorder(RdC.sun, style: StrokeStyle(lineWidth: 1.5, dash: [3])).frame(width: 12, height: 12); Text("Free, not booked").font(RdF.body(11)).foregroundColor(RdC.mut) }
                        }.padding(.top, 4)
                        Text(RdBook.timeLine(f)).font(RdF.bold(15)).foregroundColor(RdC.ink).padding(.top, 6)
                    }
                    RdCard(title: "Cost per week") {
                        let hrs: Double = (f.needTo - f.needFrom) * Double(f.needDays.count)
                        let sub: Double = hrs * f.payOffer
                        let fee: Double = (sub * 0.10).rounded()
                        RdBarRow(left: RdMatch.numText(hrs) + " hours at $" + RdMatch.numText(f.payOffer), value: "$" + RdMatch.numText(sub), boldLine: true)
                        RdBarRow(left: "Service fee 10 percent", value: "$" + RdMatch.numText(fee), boldLine: true)
                        RdBarRow(left: "Family pays", value: "$" + RdMatch.numText(sub + fee), boldLine: true)
                        RdMuted(text: c.first + " gets 100 percent. The fee is paid by the family on top.")
                    }
                }
                RdMuted(text: "You pay nothing until " + c.first + " says yes.").padding(.horizontal, 24).padding(.top, 6)
            }
            RdBottomBar {
                VStack(spacing: 8) {
                    RdCta(title: c.fm ? "Send booking request" : "Send my yes") { st.go("sent") }
                    HStack(spacing: 8) {
                        RdCta(title: "Try a paid trial day first", style: 1, small: true) { st.go("trial") }
                        RdCta(title: "Meet and greet first", style: 1, small: true) { st.go("chat") }
                    }
                }
            }
        }
    }
}

struct RdTrial: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        VStack(spacing: 0) {
            RdHeader(title: "Trial first")
            RdScroll {
                if c.au {
                    RdCard(title: c.first + " is not here yet") {
                        Text((c.fm ? c.car.visa.arrives : "Start " + c.fam.start) + ".").font(RdF.body(16)).foregroundColor(RdC.ink)
                        RdMuted(text: "Start with a free video call now. A paid trial weekend opens after arrival.")
                    }
                    RdCard(title: "Paid trial weekend", tint: RdC.pale) { RdMuted(text: "Rules for au pair work depend on the visa. We show the visa limit before you book. Confirm the rule for your visa first.") }
                } else {
                    RdLabel(title: "Pick a day", sub: "A short paid day to see if it feels right.")
                    RdFlow(spacing: 8) { ForEach(["Mon 23", "Tue 24", "Wed 25", "Thu 26", "Fri 27"], id: \.self) { RdToggleChip(text: $0, on: $0 == "Wed 25") } }.padding(.horizontal, 20)
                    RdCard(title: "The trial day") {
                        RdBarRow(left: "4 hours at $42", value: "$168.00")
                        RdBarRow(left: "Service fee, 10 percent", value: "$16.80")
                        RdBarRow(left: "You pay", value: "$184.80", boldLine: true)
                        RdMuted(text: c.first + " is paid only after the day happens. If it does not happen, you get it back.")
                    }
                }
            }
            RdBottomBar {
                if c.au { RdCta(title: "Plan a video call", icon: "video") { st.go("chat") } }
                else { RdCta(title: "Book the trial day", icon: "calendar") { st.go("trialdone") } }
            }
        }
    }
}

struct RdTrialDone: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        VStack(spacing: 0) {
            RdHeader(title: "How was the day?")
            RdScroll {
                RdMuted(text: "Payment of $168 goes to " + (c.fm ? c.first : "the carer") + " now. Only after a real trial.").padding(.horizontal, 20)
                HStack(spacing: 10) {
                    opt("Great", "Make it weekly or permanent", "check")
                    opt("Ok", "Talk first, then decide", "chat")
                    opt("Bad", "Not a fit. No hard feelings", "x")
                }.padding(.horizontal, 20).padding(.top, 10)
                RdLabel(title: "Keep it going")
                RdPick(items: ["Every week", "Permanent"], sel: 0).padding(.horizontal, 20)
                RdMuted(text: "Permanent means ongoing care. Either side can end it with notice.").padding(.horizontal, 20).padding(.top, 8)
            }
            RdBottomBar { RdCta(title: "Continue", icon: "check") { st.go("sent") } }
        }
    }
    func opt(_ t: String, _ s: String, _ i: String) -> some View {
        VStack(spacing: 6) {
            RdIcon(name: i, size: 28)
            Text(t).font(RdF.bold(17)).foregroundColor(RdC.ink)
            Text(s).font(RdF.body(12)).foregroundColor(RdC.mut).multilineTextAlignment(.center)
        }.frame(maxWidth: .infinity, minHeight: 120).padding(8).background(RdC.pale).clipShape(RoundedRectangle(cornerRadius: 22))
    }
}

struct RdSent: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        VStack(spacing: 14) {
            Spacer()
            ZStack { Circle().fill(RdC.pink); RdIcon(name: "check", size: 44) }.frame(width: 90, height: 90)
            Text(c.fm ? "Request sent" : "Your yes is sent").font(RdF.title(30)).foregroundColor(RdC.ink)
            Text(c.first + " usually answers within an hour. You can chat while you wait.").font(RdF.body(16)).foregroundColor(RdC.mut).multilineTextAlignment(.center).padding(.horizontal, 30)
            Spacer()
            RdCta(title: "Message " + c.first, icon: "chat") { st.go("chat") }.padding(.horizontal, 20)
            RdCta(title: "Show me when " + c.first + " accepts", style: 1) { st.go("confirmed") }.padding(.horizontal, 20).padding(.bottom, 24)
        }
    }
}

struct RdConfirmed: View {
    @EnvironmentObject var st: RdStore
    static func startText(_ c: RdCtx) -> String {
        let f: RdFamily = c.fam
        if f.needDays.isEmpty {
            let when: String = c.fm ? c.car.visa.arrives : f.start
            return "Starts " + when
        }
        let a: String = RdMatch.daysText(f.needDays)
        let b: String = RdMatch.hourText(f.needFrom)
        let e: String = RdMatch.hourText(f.needTo)
        return a + ", " + b + " to " + e
    }
    var body: some View {
        let c = st.ctx()
        let f = c.fam
        let startLine: String = RdConfirmed.startText(c)
        let saidYes: String = c.first + " said yes. " + (c.fm ? "Your booking is set." : "The booking is set.")
        VStack(spacing: 14) {
            Spacer()
            BunnyView(size: 120, mood: .celebrate)
            Text("It is a match").font(RdF.title(32)).foregroundColor(RdC.ink)
            Text(saidYes).font(RdF.body(17)).foregroundColor(RdC.ink)
            RdCard(tint: RdC.pale) {
                Text(startLine).font(RdF.bold(16)).foregroundColor(RdC.ink)
                Text("Starting next week").font(RdF.body(14)).foregroundColor(RdC.mut)
            }
            Spacer()
            RdCta(title: "Say hello", icon: "chat") { st.go("chat") }.padding(.horizontal, 20).padding(.bottom, 24)
        }
    }
}

struct RdBubble: View {
    var text: String
    var mine: Bool
    var photo: String
    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if mine { Spacer(minLength: 40) } else { RdPhoto(key: photo).frame(width: 30, height: 30).clipShape(Circle()) }
            Text(text).font(RdF.body(16)).foregroundColor(RdC.ink).padding(.horizontal, 14).padding(.vertical, 10)
                .background(mine ? RdC.blush : RdC.field).clipShape(RoundedRectangle(cornerRadius: 20))
            if !mine { Spacer(minLength: 40) }
        }.padding(.horizontal, 16).padding(.vertical, 3)
    }
}

struct RdChat: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        let k = c.photos[0]
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                RdIconButton(icon: "back") { st.back() }
                RdPhoto(key: k).frame(width: 40, height: 40).clipShape(Circle())
                VStack(alignment: .leading, spacing: 0) { Text(c.name).font(RdF.bold(16)).foregroundColor(RdC.ink).lineLimit(1); Text(String(c.m.pct) + " percent match").font(RdF.body(12)).foregroundColor(RdC.mut) }
                Spacer()
                Button { st.go("book") } label: { Text(c.fm ? "Book" : "Say yes").font(RdF.bold(14)).foregroundColor(RdC.ink).padding(.horizontal, 16).padding(.vertical, 8).background(RdC.pink).clipShape(Capsule()) }.buttonStyle(.plain)
            }.padding(.horizontal, 16).padding(.bottom, 8)
            RdScroll {
                HStack(spacing: 8) { RdIcon(name: "chat", size: 20); Text("Chat is free and open now. No booking needed. Ask anything first.").font(RdF.body(13)).foregroundColor(RdC.ink) }
                    .padding(12).background(RdC.pale).clipShape(RoundedRectangle(cornerRadius: 18)).padding(.horizontal, 16).padding(.vertical, 8)
                RdBubble(text: c.fm ? "Hello! Thanks for finding me. I would love to hear more about the children." : "Hello! We read your profile and loved it.", mine: false, photo: k)
                RdBubble(text: c.fm ? "Hi " + c.first + "! We would love to meet you. Is Wednesday a good time for a quick hello?" : "Hi " + c.first + "! Thank you for saying yes to us.", mine: true, photo: k)
                RdBubble(text: "Wednesday works. See you then.", mine: false, photo: k)
            }
            HStack(spacing: 10) {
                Text("Write a message").font(RdF.body(16)).foregroundColor(RdC.mut).padding(.horizontal, 16).frame(maxWidth: .infinity, minHeight: 46, alignment: .leading).background(RdC.field).clipShape(Capsule())
                RdIconButton(icon: "send") { }
            }.padding(.horizontal, 16).padding(.vertical, 10)
        }
    }
}

struct RdListRow: View {
    var photo: String
    var name: String
    var sub: String
    var pct: Int
    var nearly: Bool
    var role: String
    var body: some View {
        HStack(spacing: 12) {
            RdPhoto(key: photo).frame(width: 64, height: 64).clipShape(RoundedRectangle(cornerRadius: 18))
            VStack(alignment: .leading, spacing: 3) {
                Text(name).font(RdF.bold(17)).foregroundColor(RdC.ink)
                Text(sub).font(RdF.body(13)).foregroundColor(RdC.mut).lineLimit(2)
                RdPill(role: role)
            }
            Spacer(minLength: 0)
            RdRing(pct: pct, size: 54, line: 6)
        }.padding(12).background(Color.white).overlay(RoundedRectangle(cornerRadius: 22).stroke(RdC.line, lineWidth: 1)).opacity(nearly ? 0.8 : 1).padding(.horizontal, 16).padding(.vertical, 4)
    }
}

struct RdList: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        VStack(spacing: 0) {
            RdTopBar(on: "list")
            RdScroll {
                if c.fm {
                    let pool: [RdCarer] = RdData.carers.filter { $0.role == c.role }
                    let rk = RdMatch.rank(c.fam, pool)
                    ForEach(Array(rk.matches.enumerated()), id: \.offset) { _, x in
                        RdListRow(photo: x.carer.photos[0], name: x.carer.name, sub: x.m.reasons.first ?? "", pct: x.m.pct, nearly: false, role: x.carer.role).onTapGesture { st.go("profile") }
                    }
                    if !rk.nearly.isEmpty { RdLabel(title: "Nearly there", sub: "Close, with one thing missing.") }
                    ForEach(Array(rk.nearly.enumerated()), id: \.offset) { _, x in
                        RdListRow(photo: x.carer.photos[0], name: x.carer.name, sub: x.m.unmet.map { $0.label + ": " + $0.detail }.joined(separator: ". "), pct: x.m.pct, nearly: true, role: x.carer.role).onTapGesture { st.go("profile") }
                    }
                } else {
                    let pool: [RdFamily] = RdData.families.filter { $0.kind == c.fam.kind }.sorted { RdMatch.score($0, c.car).pct > RdMatch.score($1, c.car).pct }
                    ForEach(Array(pool.enumerated()), id: \.offset) { _, f in
                        let m = RdMatch.score(f, c.car)
                        RdListRow(photo: f.photos[0], name: f.name, sub: f.kids + " · " + f.payText, pct: m.pct, nearly: !m.passes, role: f.kind).onTapGesture { st.go("profile") }
                    }
                }
            }
        }
    }
}

struct RdFilters: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        VStack(spacing: 0) {
            RdHeader(title: "What matters")
            RdScroll {
                RdLabel(title: "Must haves")
                RdWrap(items: c.au ? ["Police certificate", "Working with children check", "First aid"] : ["Blue Card", "First aid", "Driving licence"], on: c.au ? ["Police certificate"] : ["Blue Card", "First aid"])
                if c.au {
                    RdLabel(title: "Visa and place")
                    RdWrap(items: ["Visa ready only", "Already in Australia"], on: ["Visa ready only"])
                }
                RdLabel(title: "How far")
                RdWrap(items: ["Up to 5 km", "Up to 12 km", "Up to 25 km"], on: ["Up to 12 km"])
                RdLabel(title: "Language at home")
                RdWrap(items: ["Spanish", "German", "Mandarin", "Japanese"], on: [c.au ? "German" : "Spanish"])
            }
            RdBottomBar { RdCta(title: "Show my matches") { st.back() } }
        }
    }
}
