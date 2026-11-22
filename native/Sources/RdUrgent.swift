import SwiftUI

// Urgent board: families post, carers scroll and apply, family books right away.
// Also postcode and country helpers and the visa by country lines.

struct RdUrgentPostData: Identifiable {
    var id: String
    var fam: String, av: String, whenText: String, time: String, left: String
    var rate: Int, hrs: Double
    var sub: String, pc: String, km: Double
    var kids: String, body: String
    var imgs: [String], role: String, tags: [String]
    var applied: Int, pct: Int
    var qa: [(String, String, String)]
    var total: Int { return Int((Double(rate) * hrs).rounded()) }
}

final class RdUrgentStore: ObservableObject {
    static let shared = RdUrgentStore()
    @Published var selected: String = "u1"
    @Published var applied: Set<String> = []
    @Published var booked: Set<String> = []
    @Published var filter: String = "All"
    let posts: [RdUrgentPostData] = [
        RdUrgentPostData(id: "u1", fam: "The Reyes family", av: "f1", whenText: "Tonight", time: "Today 5:30pm to 9:30pm", left: "Needed in 2 hours", rate: 45, hrs: 4, sub: "Paddington", pc: "4064", km: 2.1, kids: "Mia 4, Leo 7", body: "Our usual sitter is sick. Dinner is made. Bath and bedtime at 7:30. Calm and kind please.", imgs: ["h1", "h2"], role: "babysitter", tags: ["Dog at home"], applied: 3, pct: 96, qa: [("Is there a cat or dog?", "One friendly dog, Bella.", "Anna")]),
        RdUrgentPostData(id: "u2", fam: "The Hartley family", av: "f2", whenText: "Tomorrow", time: "Mon 7:00am to 9:00am", left: "Needed by tomorrow", rate: 38, hrs: 2, sub: "Toowong", pc: "4066", km: 3.4, kids: "Ben 6, Ella 2", body: "School run and breakfast, one morning. We will leave a list.", imgs: [], role: "nanny", tags: ["Driving licence"], applied: 5, pct: 91, qa: []),
        RdUrgentPostData(id: "u3", fam: "The Chen family", av: "f3", whenText: "Today", time: "Today 3:00pm to 6:30pm", left: "Needed in 45 minutes", rate: 48, hrs: 3.5, sub: "Indooroopilly", pc: "4068", km: 5.8, kids: "Ivy 9 months", body: "Baby care while I attend an appointment. Must have infant first aid.", imgs: ["h3"], role: "nanny", tags: ["Infant first aid", "Blue Card"], applied: 1, pct: 88, qa: [("Do you have a car seat?", "Yes, it is installed.", "Chen family")]),
        RdUrgentPostData(id: "u4", fam: "The Moreno family", av: "f4", whenText: "This weekend", time: "Sat 6:00pm to 11:00pm", left: "Needed by Saturday", rate: 40, hrs: 5, sub: "Bulimba", pc: "4171", km: 7.2, kids: "Theo 5, Nora 8, Zoe 10", body: "Pizza night and a movie. Easy evening, three happy kids.", imgs: ["h4", "h1", "h2"], role: "babysitter", tags: [], applied: 7, pct: 85, qa: [])
    ]
    var visible: [RdUrgentPostData] {
        switch filter {
        case "Now", "Tonight": return posts.filter { $0.whenText == "Today" || $0.whenText == "Tonight" }
        case "Tomorrow": return posts.filter { $0.whenText == "Tomorrow" }
        case "Weekend": return posts.filter { $0.whenText == "This weekend" }
        case "Nanny": return posts.filter { $0.role == "nanny" }
        case "Babysitter": return posts.filter { $0.role == "babysitter" }
        case "Near me": return posts.filter { $0.km <= 4 }
        default: return posts
        }
    }
    func post(_ id: String) -> RdUrgentPostData { return posts.first { $0.id == id } ?? posts[0] }
}

struct RdWhenChip: View {
    var text: String
    var body: some View {
        let soon = text == "Today" || text == "Tonight"
        HStack(spacing: 6) {
            RdIcon(name: "clock", size: 15, color: soon ? .white : RdC.ink)
            Text(text).font(RdF.bold(13)).foregroundColor(soon ? .white : RdC.ink)
        }.padding(.horizontal, 12).padding(.vertical, 5).background(soon ? RdC.ras : RdC.sun).clipShape(Capsule())
    }
}

struct RdUrgentCard: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    var u: RdUrgentPostData
    var mine: Bool = false
    var detail: Bool = false
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                RdPhoto(key: u.av).frame(width: 46, height: 46).clipShape(Circle())
                VStack(alignment: .leading, spacing: 1) {
                    Text(u.fam).font(RdF.bold(16)).foregroundColor(RdC.ink)
                    Text(u.sub + " " + u.pc + " , " + String(u.km) + " km , posted 6 min ago").font(RdF.body(12)).foregroundColor(RdC.mut).lineLimit(1).minimumScaleFactor(0.8)
                }
                Spacer(minLength: 0)
                if !mine { RdRing(pct: u.pct, size: 52, line: 6) }
            }
            HStack(spacing: 8) { RdWhenChip(text: u.whenText); Text(u.left).font(RdF.bold(13)).foregroundColor(RdC.mut) }
            HStack(alignment: .firstTextBaseline) {
                Text("$" + String(u.rate) + " an hour").font(RdF.title(22)).foregroundColor(RdC.ras)
                Spacer()
                Text(u.time).font(RdF.body(12)).foregroundColor(RdC.mut)
            }
            Text("About $" + String(u.total) + " for " + String(u.hrs) + " hours. Children: " + u.kids).font(RdF.body(13)).foregroundColor(RdC.mut)
            Text(u.body).font(RdF.body(15)).foregroundColor(RdC.ink).fixedSize(horizontal: false, vertical: true)
            RdFlow(spacing: 6) {
                RdPill(role: u.role)
                ForEach(u.tags, id: \.self) { RdChip(text: $0) }
            }
            if !u.imgs.isEmpty {
                HStack(spacing: 6) { ForEach(u.imgs, id: \.self) { k in RdPhoto(key: k).frame(height: 104).clipShape(RoundedRectangle(cornerRadius: 16)) } }
            }
            if !mine && !detail {
                HStack(spacing: 8) {
                    RdCta(title: us.applied.contains(u.id) ? "Applied" : "Apply now", icon: "check", small: true) { us.selected = u.id; st.go(us.applied.contains(u.id) ? "urgentsent" : "urgentapply") }
                    Button { us.selected = u.id; st.go("urgentdetail") } label: {
                        HStack(spacing: 6) { RdIcon(name: "chat", size: 20); Text("Ask").font(RdF.bold(15)).foregroundColor(RdC.ink) }
                            .padding(.horizontal, 16).frame(height: 48).overlay(Capsule().stroke(RdC.line, lineWidth: 2))
                    }.buttonStyle(.plain)
                }
                Text(String(u.applied) + " carers applied. Fast replies win.").font(RdF.body(12)).foregroundColor(RdC.mut)
            }
        }
        .padding(14).background(Color.white)
        .overlay(RoundedRectangle(cornerRadius: 26).stroke(RdC.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 26))
        .padding(.horizontal, 14).padding(.bottom, 12)
        .onTapGesture { if !detail { us.selected = u.id; st.go("urgentdetail") } }
    }
}

struct RdUrgent: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 6) { Circle().fill(RdC.ras).frame(width: 9, height: 9); Text("Urgent board").font(RdF.title(26)).foregroundColor(RdC.ink) }
                    Text("Families near you need help now. Postcode 4060, 15 km").font(RdF.body(13)).foregroundColor(RdC.mut)
                }
                Spacer()
                RdIconButton(icon: "sliders") { st.go("filters") }
            }.padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 8)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(["All", "Now", "Tonight", "Tomorrow", "Weekend", "Nanny", "Babysitter", "Near me"], id: \.self) { f in
                        Button { us.filter = f } label: { RdChip(text: f, on: us.filter == f) }.buttonStyle(.plain)
                    }
                }.padding(.horizontal, 16)
            }.padding(.bottom, 10)
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 0) {
                    ForEach(us.visible) { u in RdUrgentCard(u: u) }
                    HStack(spacing: 8) { RdIcon(name: "loop", size: 20, color: RdC.mut); Text("Loading more jobs near you").font(RdF.bold(14)).foregroundColor(RdC.mut) }.padding(.vertical, 14)
                }.padding(.bottom, 20)
            }
        }
    }
}

struct RdUrgentDetail: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    var body: some View {
        let u = us.post(us.selected)
        VStack(spacing: 0) {
            RdHeader(title: "Urgent job")
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    RdUrgentCard(u: u, mine: true, detail: true)
                    HStack(spacing: 10) {
                        RdCard(title: "Where") { RdMuted(text: u.sub + " " + u.pc + ". " + String(u.km) + " km from you.") }
                        RdCard(title: "Why you fit") { RdMuted(text: String(u.pct) + " percent. Free tonight. Blue Card checked.") }
                    }
                    RdLabel(title: "Questions", sub: "Everyone can see the answers.")
                    ForEach(0..<u.qa.count, id: \.self) { i in
                        RdCard { RdReason(text: u.qa[i].0 + " " + u.fam + ": " + u.qa[i].1, bold: u.qa[i].2 + " asked") }
                    }
                    RdField(label: "Ask a question", value: "What time is bedtime?")
                    RdFlow(spacing: 8) { RdChip(text: "Is dinner made?"); RdChip(text: "Any allergies?"); RdChip(text: "Can I bring a friend?") }.padding(.horizontal, 20).padding(.top, 8)
                }.padding(.bottom, 20)
            }
            RdBottomBar { RdCta(title: "Apply at $" + String(u.rate) + " an hour") { st.go("urgentapply") } }
        }
    }
}

struct RdUrgentApply: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    var body: some View {
        let u = us.post(us.selected)
        VStack(spacing: 0) {
            RdHeader(title: "Apply")
            RdScroll {
                RdCard { HStack(spacing: 12) { RdPhoto(key: u.av).frame(width: 52, height: 52).clipShape(Circle()); VStack(alignment: .leading) { Text(u.fam).font(RdF.bold(16)).foregroundColor(RdC.ink); RdMuted(text: u.time + ", " + u.sub + " " + u.pc) } } }
                RdCard(title: "You will earn") {
                    Text("$" + String(u.total)).font(RdF.title(30)).foregroundColor(RdC.ras)
                    RdMuted(text: "$" + String(u.rate) + " an hour for " + String(u.hrs) + " hours. Paid after the shift. You keep 100 percent.")
                }
                RdLabel(title: "Add a short note")
                RdWrap(items: ["I am free and can come now", "I have infant first aid", "I know " + u.sub], on: ["I am free and can come now"])
                RdField(label: "Your note", value: "Hi, I am free tonight and can be there by 5:15.")
                RdCard(tint: RdC.pale) { RdMuted(text: "Book right away. If the family taps Book, it is yours. No waiting.") }
            }
            RdBottomBar { RdCta(title: "Send my application") { us.applied.insert(u.id); st.go("urgentsent") } }
        }
    }
}

struct RdUrgentSent: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 0) {
            Spacer()
            Image("bunny").resizable().scaledToFit().frame(width: 90)
            Text("Sent").font(RdF.title(30)).foregroundColor(RdC.ink).padding(.top, 10)
            Text("The family sees you first. Most reply in 5 minutes. We will ping you.").font(RdF.body(15)).foregroundColor(RdC.mut).multilineTextAlignment(.center).padding(.horizontal, 30).padding(.top, 4)
            Spacer()
            RdBottomBar { VStack(spacing: 10) { RdCta(title: "Back to the board") { st.root("urgent") }; RdCta(title: "Message the family", style: 1) { st.go("chat") } } }
        }
    }
}

struct RdUrgentPost: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: "Post an urgent job")
            RdScroll {
                RdMuted(text: "Takes one minute. Carers near you see it straight away.").padding(.horizontal, 20)
                RdLabel(title: "When do you need care?")
                RdWrap(items: ["Now", "Tonight", "Tomorrow", "This weekend", "Pick a day"], on: ["Tonight"])
                HStack(spacing: 10) { RdField(label: "From", value: "5:30 pm"); RdField(label: "To", value: "9:30 pm") }
                RdLabel(title: "What kind of carer?", sub: "Pick more than one if you like.")
                RdWrap(items: ["Nanny", "Babysitter", "Au pair already here"], on: ["Babysitter"])
                RdLabel(title: "Children ages")
                RdWrap(items: ["Baby", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12+"], on: ["4", "7"])
                RdLabel(title: "Pay per hour", sub: "Typical in Paddington: $38 to $48")
                HStack(spacing: 14) { RdIconButton(icon: "minus") { }; Text("$45").font(RdF.title(34)).foregroundColor(RdC.ras); RdIconButton(icon: "plus") { }; RdMuted(text: "4 hours, about $180") }.padding(.horizontal, 20)
                RdLabel(title: "What should they know?")
                RdField(label: "Short description", value: "Our usual sitter is sick. Dinner is made. Bath and bedtime at 7:30.")
                RdWrap(items: ["Dinner is made", "Bedtime routine", "Pets at home", "Allergies"], on: ["Dinner is made"])
                RdLabel(title: "Photos", sub: "Optional. Show your home, never your children.")
                HStack(spacing: 8) {
                    RdPhoto(key: "h1").frame(height: 90).clipShape(RoundedRectangle(cornerRadius: 16))
                    RoundedRectangle(cornerRadius: 16).stroke(RdC.pink, style: StrokeStyle(lineWidth: 2, dash: [6])).frame(height: 90).overlay(RdIcon(name: "plus", size: 30, color: RdC.ras))
                    Color.clear.frame(height: 90)
                }.padding(.horizontal, 20)
                RdCard(tint: RdC.pale) { RdMuted(text: "Postcode 4064, Paddington. Shown to carers within 15 km.") }
                RdCard(tint: RdC.pale) { RdMuted(text: "Only checked carers can apply. You pay 10 percent on top. The carer keeps 100 percent.") }
            }
            RdBottomBar { RdCta(title: "Post now", icon: "clock") { st.go("urgentposted") } }
        }
    }
}

struct RdUrgentPosted: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 0) {
            Spacer()
            Image("bunny").resizable().scaledToFit().frame(width: 90)
            Text("Posted").font(RdF.title(30)).foregroundColor(RdC.ink).padding(.top, 10)
            Text("38 carers near 4064 were told. First answers come in minutes.").font(RdF.body(15)).foregroundColor(RdC.mut).multilineTextAlignment(.center).padding(.horizontal, 30).padding(.top, 4)
            Spacer()
            RdBottomBar { RdCta(title: "See who applied") { st.root("urgentmine") } }
        }
    }
}

struct RdUrgentMine: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let ap: [(String, String, String, Int, String)] = [("n1", "Maya Okafor", "Nanny, 2.9 km", 97, "4060"), ("b1", "Lily Chen", "Babysitter, 1.8 km", 94, "4059"), ("n2", "Grace Mensah", "Nanny, 4.1 km", 90, "4066")]
        VStack(spacing: 0) {
            HStack {
                Text("My urgent jobs").font(RdF.title(26)).foregroundColor(RdC.ink)
                Spacer()
                RdIconButton(icon: "plus") { st.go("urgentpost") }
            }.padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 8)
            RdScroll {
                RdCard {
                    HStack { VStack(alignment: .leading) { Text("Tonight 5:30pm to 9:30pm").font(RdF.bold(16)).foregroundColor(RdC.ink); RdMuted(text: "$45 an hour, Paddington 4064, Mia 4, Leo 7") }; RdTag(text: "Open", fill: RdC.okBg, fg: RdC.okFg) }
                    RdMuted(text: "3 applied, 1 question")
                }
                ForEach(0..<ap.count, id: \.self) { i in
                    let a = ap[i]
                    VStack(spacing: 10) {
                        HStack(spacing: 12) {
                            RdPhoto(key: a.0).frame(width: 56, height: 56).clipShape(Circle())
                            VStack(alignment: .leading, spacing: 2) { Text(a.1).font(RdF.bold(16)).foregroundColor(RdC.ink); RdMuted(text: a.2 + ", " + a.4); RdChip(text: "Checked", icon: "shield") }
                            RdRing(pct: a.3, size: 56, line: 6)
                        }
                        HStack(spacing: 8) { RdCta(title: "Book right away", icon: "calendar", small: true) { st.go("urgentbooked") }; RdMsgButton { st.go("chat") } }
                    }.padding(14).overlay(RoundedRectangle(cornerRadius: 26).stroke(RdC.line, lineWidth: 1)).padding(.horizontal, 14).padding(.bottom, 10)
                }
                RdCard(title: "1 new question") { RdMuted(text: "Anna: Is there a cat or dog? Answer once, everyone sees it.") }
            }
        }
    }
}

struct RdUrgentBooked: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 0) {
            Spacer()
            RdPhoto(key: "n1").frame(width: 110, height: 110).clipShape(Circle())
            Text("Maya is booked").font(RdF.title(30)).foregroundColor(RdC.ink).padding(.top, 10)
            Text("Tonight 5:30pm to 9:30pm. $180 plus $18 fee. Held safely, paid after the shift. Other carers were told it is filled.").font(RdF.body(15)).foregroundColor(RdC.mut).multilineTextAlignment(.center).padding(.horizontal, 30).padding(.top, 4)
            Spacer()
            RdBottomBar { RdCta(title: "Message Maya") { st.go("chat") } }
        }
    }
}

/// Visa lines by country, from official pages checked 22 Nov 2026.
enum RdVisaBy {
    static let lines: [String: [String]] = [
        "Australia": ["Working Holiday 417 or Work and Holiday 462", "Ages 18 to 30, up to 35 for some countries", "Up to 12 months. No family sponsor needed"],
        "United Kingdom": ["Youth Mobility Scheme", "Ages 18 to 35 for Australia, Canada, New Zealand, South Korea", "Up to 2 years. Family does not sponsor"],
        "USA": ["J-1 Au Pair, needs a sponsor agency", "Ages 18 to 26", "12 months. Up to 45 hours a week"],
        "Germany": ["Au pair visa", "Ages 18 to 26", "6 to 12 months. Up to 30 hours a week"],
        "France": ["Young au pair long stay visa", "Ages 18 to 30", "1 year, up to 2 years. Up to 25 hours a week"],
        "Canada": ["IEC Working Holiday, no au pair visa", "Ages 18 to 35, 18 to 30 for some countries", "Up to 2 years. Open work permit"],
        "Ireland": ["No au pair visa confirmed", "Not confirmed", "Not confirmed"],
        "New Zealand": ["Work visa needed for au pair work", "Not confirmed", "Not confirmed"]
    ]
}

struct RdVisaRow: View {
    var n: Int
    var place: String
    var status: String
    var body: some View {
        let v = RdVisaBy.lines[place] ?? ["Not confirmed", "Not confirmed", "Not confirmed"]
        VStack(alignment: .leading, spacing: 4) {
            HStack { Text(String(n) + ". " + place).font(RdF.bold(16)).foregroundColor(RdC.ink); Spacer(); if n == 1 { RdTag(text: "First choice") } }
            Text(v[0] + "\n" + v[1] + "\n" + v[2]).font(RdF.body(13)).foregroundColor(RdC.mut).fixedSize(horizontal: false, vertical: true)
            RdTag(text: status, fill: status == "Check the rules" ? RdC.warnBg : RdC.okBg, fg: status == "Check the rules" ? RdC.warnFg : RdC.okFg)
        }.padding(14).background(n == 1 ? RdC.pale : Color.white)
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(n == 1 ? RdC.ras : RdC.line, lineWidth: 2)).clipShape(RoundedRectangle(cornerRadius: 22)).padding(.horizontal, 16).padding(.bottom, 10)
    }
}

struct RdVisaCheck: View {
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: "Your countries and visas")
            RdScroll {
                RdMuted(text: "Your picks decide which families you see first. Visa never changes your match score.").padding(.horizontal, 20).padding(.bottom, 10)
                RdVisaRow(n: 1, place: "Australia", status: "Visa approved")
                RdVisaRow(n: 2, place: "New Zealand", status: "Not applied yet")
                RdVisaRow(n: 3, place: "Ireland", status: "Check the rules")
                RdCard(tint: RdC.pale) { RdMuted(text: "Families can choose au pairs with an approved visa, or already living in the country. Official pages are listed under Safety and checks.") }
            }
        }
    }
}

/// A postcode field and the first choice banner used on the deck.
struct RdPlaceRibbon: View {
    var text: String
    var icon: String = "pin"
    var body: some View {
        HStack(spacing: 8) { RdIcon(name: icon, size: 18); Text(text).font(RdF.bold(13)).foregroundColor(RdC.ink).lineLimit(2).minimumScaleFactor(0.8) }
            .padding(.horizontal, 12).padding(.vertical, 8).frame(maxWidth: .infinity, alignment: .leading).background(RdC.pale).clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
enum RdPostcode {
    static let map: [String: String] = ["Ashgrove": "4060", "Paddington": "4064", "Kelvin Grove": "4059", "Indooroopilly": "4068", "Toowong": "4066", "St Lucia": "4067", "Bulimba": "4171", "Chermside": "4032"]
    static func of(_ suburb: String) -> String { return map[suburb] ?? "4000" }
}
