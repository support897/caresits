import SwiftUI
import FirebaseAuth
import FirebaseFirestore
import MessageUI

// ---------- contact blocking ----------
enum RdSafe {
    static let message = "Phone numbers, emails and other contact details can't be shared here. Use Schedule a call instead."
    static func hasContact(_ text: String) -> Bool {
        let s = text.lowercased()
        let pats = [#"[\w.+-]+\s*(@|\(at\)|\[at\])\s*[\w-]+"#, #"[\w-]+\s*(\(dot\)|\[dot\])\s*(com|net|org|co|au)"#, #"(https?://|www\.)\S+"#, #"\+?\(?\d[\d\s().\-]{6,}\d"#, #"(^|\s)@\w{3,}"#,
                    #"\b(whatsapp|whats app|telegram|wechat|snapchat|snap me|instagram|insta|facebook|messenger|viber|signal app|kik|gmail|hotmail|outlook|yahoo|icloud)\b"#,
                    #"\b(call|text|ring|sms|message|dm)\s+me\s+(on|at)\b"#]
        for p in pats { if s.range(of: p, options: .regularExpression) != nil { return true } }
        let words: Set<String> = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "oh"]
        var run = 0
        for w in s.split(whereSeparator: { !$0.isLetter }) { if words.contains(String(w)) { run += 1; if run >= 6 { return true } } else { run = 0 } }
        return false
    }
    /// Returns the message to show if any text holds contact details.
    static func problem(_ texts: [String]) -> String? {
        for t in texts where hasContact(t) { return message }
        return nil
    }
}

// ---------- calls without phone numbers ----------
enum RdCall {
    static func enc(_ t: Int) -> String { return String(String(t, radix: 16).map { Character(UnicodeScalar(UInt8(97 + ($0.hexDigitValue ?? 0)))) }) }
    static func dec(_ s: String) -> Int? {
        var v = 0
        for ch in s { guard let a = ch.asciiValue, a >= 97, a < 113 else { return nil }; v = v * 16 + Int(a - 97) }
        return v
    }
    static func room() -> String { return "Caresitters" + String((0..<14).map { _ in "abcdefghjkmnpqrstuvwxyz".randomElement() ?? "a" }) }
    static func url(_ room: String, phone: Bool) -> URL? {
        return URL(string: "https://meet.jit.si/" + room + (phone ? "#config.startWithVideoMuted=true&config.prejoinPageEnabled=false" : ""))
    }
}

/// Day chips and time chips instead of the stock pickers.
struct RdDayTime: View {
    @Binding var date: Date
    @State private var dayI = 0
    @State private var timeI = 20
    var body: some View {
        let cal = Calendar.current
        let days: [Date] = (0..<8).map { cal.date(byAdding: .day, value: $0, to: cal.startOfDay(for: Date())) ?? Date() }
        let f = DateFormatter()
        VStack(alignment: .leading, spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(0..<days.count, id: \.self) { i in
                        Button { dayI = i; apply(days) } label: { RdChip(text: i == 0 ? "Today" : (i == 1 ? "Tomorrow" : { f.dateFormat = "EEE d"; return f.string(from: days[i]) }()), on: dayI == i) }.buttonStyle(.plain)
                    }
                }.padding(.horizontal, 20)
            }
            RdFlow(spacing: 8) {
                ForEach(14..<44, id: \.self) { i in
                    if i % 2 == 0 || i >= 36 || i <= 22 {
                        Button { timeI = i; apply(days) } label: { RdChip(text: label(i), on: timeI == i) }.buttonStyle(.plain)
                    }
                }
            }.padding(.horizontal, 20)
        }.onAppear { sync(days) }
    }
    func label(_ i: Int) -> String { let h = i / 2, m = (i % 2) * 30; let hh = h % 12 == 0 ? 12 : h % 12; return String(hh) + ":" + (m == 0 ? "00" : "30") + (h < 12 ? "am" : "pm") }
    func apply(_ days: [Date]) { date = Calendar.current.date(bySettingHour: timeI / 2, minute: (timeI % 2) * 30, second: 0, of: days[dayI]) ?? date }
    func sync(_ days: [Date]) {
        let c = Calendar.current
        if let i = days.firstIndex(where: { c.isDate($0, inSameDayAndTimeAs: date) || c.isDate($0, inSameDayAs: date) }) { dayI = i }
        timeI = min(43, max(14, c.component(.hour, from: date) * 2 + (c.component(.minute, from: date) >= 30 ? 1 : 0)))
        apply(days)
    }
}
extension Calendar { func isDate(_ a: Date, inSameDayAndTimeAs b: Date) -> Bool { return false } }

// ---------- toast ----------
struct RdToast: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    var body: some View {
        let t = !st.err.isEmpty ? st.err : us.msg
        VStack {
            if !t.isEmpty {
                HStack(spacing: 10) {
                    RdIcon(name: "info", size: 20, color: .white)
                    Text(t).font(RdF.bold(14)).foregroundColor(.white).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                    Button { st.err = ""; us.msg = "" } label: { RdIcon(name: "x", size: 18, color: .white) }.buttonStyle(.plain)
                }.padding(14).background(RdC.ras).clipShape(RoundedRectangle(cornerRadius: 18)).padding(.horizontal, 12).padding(.top, 6)
                .task(id: t) { try? await Task.sleep(nanoseconds: 7_000_000_000); st.err = ""; us.msg = "" }
            }
            Spacer()
        }.allowsHitTesting(!t.isEmpty).animation(.easeOut(duration: 0.2), value: t)
    }
}

// ---------- chat with call scheduling ----------
struct RdLiveChat: View {
    @EnvironmentObject var st: RdStore
    @State private var msgs: [ChatMessage] = []
    @State private var text = ""
    @State private var reg: ListenerRegistration? = nil
    @State private var err = ""
    @State private var showCall = false
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: st.chatName, trailing: AnyView(Button { showCall = true } label: {
                HStack(spacing: 6) { RdIcon(name: "phone", size: 18, color: RdC.ink); Text("Schedule a call").font(RdF.bold(13)).foregroundColor(RdC.ink) }
                    .padding(.horizontal, 12).frame(height: 38).background(RdC.pale).clipShape(Capsule())
            }.buttonStyle(.plain)))
            ScrollView {
                LazyVStack(spacing: 8) {
                    Text("Phone numbers and emails are blocked here. Schedule a call or video interview instead.").font(RdF.body(12)).foregroundColor(RdC.mut).multilineTextAlignment(.center).padding(.horizontal, 20)
                    ForEach(msgs) { m in row(m) }
                }.padding(14)
            }.defaultScrollAnchor(.bottom)
            if !err.isEmpty { Text(err).font(RdF.body(13)).foregroundColor(RdC.ras).padding(.horizontal, 16) }
            HStack(spacing: 8) {
                TextField("Message", text: $text).font(RdF.body(16)).padding(.horizontal, 16).frame(height: 48).overlay(Capsule().stroke(RdC.line, lineWidth: 1))
                RdIconButton(icon: "send") { send() }
            }.padding(.horizontal, 12).padding(.vertical, 8)
        }
        .sheet(isPresented: $showCall) { RdCallSheet(rel: st.chatRel) }
        .onAppear { reg = Backend.listenMessages(st.chatRel) { msgs = $0 } }
        .onDisappear { reg?.remove(); reg = nil }
    }
    func send() {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, let u = RdLive.uid else { return }
        if let p = RdSafe.problem([t]) { err = p; return }
        err = ""; text = ""
        Task { try? await Backend.send(st.chatRel, from: u, text: t) }
    }
    @ViewBuilder func row(_ m: ChatMessage) -> some View {
        let mine = m.from == RdLive.uid
        if m.text.hasPrefix("CALLOK ") {
            Text("Call accepted").font(RdF.bold(12)).foregroundColor(RdC.okFg).frame(maxWidth: .infinity)
        } else if m.text.hasPrefix("CALL ") {
            let p = m.text.split(separator: " ").map(String.init)
            if p.count >= 4, let t = RdCall.dec(p[2]) {
                let when = Date(timeIntervalSince1970: Double(t))
                let phone = p[1] == "phone"
                let ok = msgs.contains { $0.text == "CALLOK " + p[3] }
                let f = DateFormatter()
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) { RdIcon(name: phone ? "phone" : "screen", size: 22); Text(phone ? "Phone call" : "Video interview").font(RdF.title(18)).foregroundColor(RdC.ink) }
                    Text({ f.dateFormat = "EEE d MMM, h:mma"; return f.string(from: when).lowercased() }()).font(RdF.bold(15)).foregroundColor(RdC.ras)
                    if ok {
                        if when.timeIntervalSinceNow < 900 { Link(destination: RdCall.url(p[3], phone: phone) ?? URL(fileURLWithPath: "/")) { Text("Join now").font(RdF.bold(16)).foregroundColor(RdC.ink).frame(maxWidth: .infinity, minHeight: 46).background(RdC.pink).clipShape(Capsule()) } }
                        else { Text("Accepted. The Join button opens 15 minutes before.").font(RdF.body(13)).foregroundColor(RdC.mut) }
                    } else if !mine {
                        RdCta(title: "Accept", small: true) { if let u = RdLive.uid { Task { try? await Backend.send(st.chatRel, from: u, text: "CALLOK " + p[3]) } } }
                    } else { Text("Waiting for an answer").font(RdF.body(13)).foregroundColor(RdC.mut) }
                }.padding(14).frame(maxWidth: .infinity, alignment: .leading).background(RdC.pale).clipShape(RoundedRectangle(cornerRadius: 22))
            }
        } else {
            HStack { if mine { Spacer(minLength: 50) }
                Text(m.text).font(RdF.body(16)).foregroundColor(RdC.ink).padding(.horizontal, 14).padding(.vertical, 9).background(mine ? RdC.blush : RdC.field).clipShape(RoundedRectangle(cornerRadius: 20))
                if !mine { Spacer(minLength: 50) } }
        }
    }
}

struct RdCallSheet: View {
    var rel: String
    @Environment(\.dismiss) var dismiss
    @State private var kind = ["Phone call"]
    @State private var when = Date().addingTimeInterval(86400)
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Schedule a call").font(RdF.title(24)).foregroundColor(RdC.ink).padding(.horizontal, 20).padding(.top, 20)
            Text("No phone numbers shared. You both join through the app link at the time.").font(RdF.body(14)).foregroundColor(RdC.mut).padding(.horizontal, 20)
            RdSelChips(items: ["Phone call", "Video interview"], multi: false, sel: $kind)
            RdDayTime(date: $when)
            Spacer()
            RdCta(title: "Send to them") {
                guard let u = RdLive.uid else { return }
                let t = Int(when.timeIntervalSince1970)
                let txt = "CALL " + (kind.first == "Phone call" ? "phone" : "video") + " " + RdCall.enc(t) + " " + RdCall.room()
                Task { try? await Backend.send(rel, from: u, text: txt); dismiss() }
            }.padding(.horizontal, 20).padding(.bottom, 16)
        }
    }
}

// ---------- hearts ----------
@MainActor
final class RdHeartStore: ObservableObject {
    static let shared = RdHeartStore()
    @Published var mine: Set<String> = []
    @Published var onMe: [String] = []
    func refresh() async {
        guard let u = RdLive.uid else { return }
        mine = await Backend.savedIds(u)
        if let snap = try? await Firestore.firestore().collection("profiles").document(u).collection("hearts").getDocuments() {
            let ids = snap.documents.map { $0.documentID }
            let old = UserDefaults.standard.integer(forKey: "rdHeartsSeen")
            if ids.count > old && old >= 0 && UserDefaults.standard.object(forKey: "rdHeartsSeen") != nil { RdLive.notify("Someone hearted you", "Open Messages to say hi.") }
            UserDefaults.standard.set(ids.count, forKey: "rdHeartsSeen")
            onMe = ids
        }
    }
    func toggle(_ other: String) async {
        guard let u = RdLive.uid else { return }
        let on = !mine.contains(other)
        if on { mine.insert(other) } else { mine.remove(other) }
        let ref = Firestore.firestore().collection("profiles").document(other).collection("hearts").document(u)
        if on { try? await ref.setData(["at": FieldValue.serverTimestamp()]) } else { try? await ref.delete() }
        await Backend.setSaved(u, other, on)
    }
}

struct RdHeartButton: View {
    var uid: String
    @ObservedObject var hs = RdHeartStore.shared
    var body: some View {
        let on = hs.mine.contains(uid)
        Button { Task { await hs.toggle(uid) } } label: {
            RdIcon(name: "heart", size: 24, color: on ? .white : RdC.ras).frame(width: 52, height: 52).background(on ? RdC.ras : Color.white).clipShape(Circle()).overlay(Circle().stroke(RdC.ras, lineWidth: 2))
        }.buttonStyle(.plain).task { if hs.mine.isEmpty { await hs.refresh() } }
    }
}

struct RdHeartsBanner: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var hs = RdHeartStore.shared
    var body: some View {
        Group {
            if !hs.onMe.isEmpty {
                Button { st.go("hearts") } label: {
                    HStack(spacing: 12) {
                        RdIcon(name: "heart", size: 26, color: RdC.ras)
                        VStack(alignment: .leading, spacing: 2) { Text(String(hs.onMe.count) + (hs.onMe.count == 1 ? " person hearted you" : " people hearted you")).font(RdF.bold(16)).foregroundColor(RdC.ink); Text("Tap to say hi").font(RdF.body(13)).foregroundColor(RdC.mut) }
                        Spacer()
                    }.padding(14).background(RdC.pale).clipShape(RoundedRectangle(cornerRadius: 22)).padding(.horizontal, 16).padding(.vertical, 4)
                }.buttonStyle(.plain)
            }
        }.task { await hs.refresh() }
    }
}

struct RdHearts: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var hs = RdHeartStore.shared
    @State private var rows: [Person] = []
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: "Hearted you")
            RdScroll {
                if rows.isEmpty { RdCard { RdMuted(text: "No hearts yet. A complete profile gets more.") } }
                ForEach(rows) { p in
                    HStack(spacing: 12) {
                        RdRemotePhoto(key: p.photoKey).frame(width: 56, height: 56).clipShape(Circle())
                        VStack(alignment: .leading, spacing: 2) { Text(p.name).font(RdF.bold(16)).foregroundColor(RdC.ink); RdMuted(text: p.postcode.isEmpty ? "" : "Postcode " + p.postcode) }
                        Spacer()
                        RdMsgButton { Task { if await RdLive.openChat(st, otherUid: p.id) { st.go("chat") } } }
                        RdHeartButton(uid: p.id)
                    }.padding(14).overlay(RoundedRectangle(cornerRadius: 26).stroke(RdC.line, lineWidth: 1)).padding(.horizontal, 14).padding(.bottom, 8)
                }
            }
        }.task { await hs.refresh(); let ps = await Backend.loadProfiles(hs.onMe); rows = hs.onMe.compactMap { ps[$0] } }
    }
}

// ---------- full live profile ----------
struct RdLivePersonView: View {
    @EnvironmentObject var st: RdStore
    @State private var reviews: [(Int, String, String)] = []
    @State private var verified = false
    var body: some View {
        if let x = st.viewing {
            let p = x.p
            let keys = ([p.photoKey] + p.gallery).filter { !$0.isEmpty }
            VStack(spacing: 0) {
                RdHeader(title: p.firstName)
                RdScroll {
                    TabView {
                        if keys.isEmpty { RdC.blush }
                        ForEach(keys, id: \.self) { k in RdRemotePhoto(key: k).frame(maxWidth: .infinity).frame(height: 360).clipped() }
                    }.tabViewStyle(.page).frame(height: 360).clipShape(RoundedRectangle(cornerRadius: 24)).padding(.horizontal, 12)
                    HStack(spacing: 12) {
                        RdRing(pct: x.score, size: 76, line: 8)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(x.label).font(RdF.bold(12)).foregroundColor(.white).padding(.horizontal, 12).padding(.vertical, 3).background(RdC.ras).clipShape(Capsule())
                            Text(p.name).font(RdF.title(26)).foregroundColor(RdC.ink)
                            if verified { RdChip(text: "Checked", icon: "shield", tone: 1) }
                        }
                        Spacer(minLength: 0)
                    }.padding(.horizontal, 20).padding(.top, 10)
                    RdFlow(spacing: 6) { ForEach(p.services, id: \.self) { RdPill(role: $0 == "au_pair" ? "aupair" : $0) } }.padding(.horizontal, 20).padding(.top, 6)
                    RdPlaceRibbon(text: (p.postcode.isEmpty ? "" : "Postcode " + p.postcode) + (x.km >= 0 ? ", " + Geo.label(x.km) + " away" : "")).padding(.horizontal, 16).padding(.top, 8)
                    if p.side == "carer" {
                        HStack(spacing: 8) {
                            RdChip(text: String(p.years) + (p.years == 1 ? " year" : " years") + " with children", icon: "cap")
                            if p.rate > 0 { RdChip(text: "$" + String(Int(p.rate)) + " an hour", icon: "rate") }
                        }.padding(.horizontal, 20).padding(.top, 8)
                    } else if !p.kids.isEmpty {
                        RdChip(text: "Children aged " + p.kids.map { String($0.age) }.joined(separator: ", "), icon: "child").padding(.horizontal, 20).padding(.top, 8)
                    }
                    if !p.about.isEmpty { RdSection(title: "About", text: p.about) }
                    if !x.why.isEmpty { RdLabel(title: "Why you match"); ForEach(Array(x.why.enumerated()), id: \.offset) { _, w in RdReason(text: w).padding(.horizontal, 20) } }
                    if !p.languages.isEmpty { RdSection(title: "Languages", items: p.languages) }
                    RdLabel(title: "Reviews", sub: reviews.isEmpty ? "No reviews yet." : nil)
                    ForEach(0..<reviews.count, id: \.self) { i in
                        RdCard { HStack { Text(String(repeating: "★", count: reviews[i].0)).foregroundColor(RdC.ras); Spacer(); Text(reviews[i].2).font(RdF.body(12)).foregroundColor(RdC.mut) }; RdMuted(text: reviews[i].1) }
                    }
                }
            }
            .overlay(alignment: .bottom) {
                RdBottomBar {
                    RdCta(title: st.isFamily ? "Book " + p.firstName : "Say yes", icon: "calendar") { st.bookWith = p.id; st.bookName = p.firstName; st.bookRate = p.rate; st.go("book") }
                    RdHeartButton(uid: p.id)
                    RdMsgButton { Task { if await RdLive.openChat(st, otherUid: p.id) { st.go("chat") } } }
                }
            }
            .task {
                verified = (await Backend.verifiedLevel(p.id)) != nil
                var out: [(Int, String, String)] = []
                for r in await Backend.reviewsFor(carer: p.id) { out.append((r.rating, r.text, "Booked through Caresitters")) }
                for r in await Backend.profileReviews(about: p.id) { out.append((r.rating, r.text, "Verified reviewer")) }
                reviews = out
            }
        } else { RdMuted(text: "Nobody selected.") }
    }
}

// ---------- profile meter ----------
extension RdLive {
    static func completeness(_ st: RdStore) -> (Int, String) {
        var items: [(Bool, String)] = [(!st.firstName.isEmpty, "Add your name"), (!st.photoKey.isEmpty, "Add a photo"), (!st.postcode.isEmpty, "Add your postcode"), (!st.about.isEmpty, "Write a short hello")]
        if st.isFamily { items.append((!st.kidsAges.isEmpty, "Add your children's ages")) } else { items.append((st.rate > 0, "Set your rate")) }
        let done = items.filter { $0.0 }.count
        return (done * 100 / items.count, items.first { !$0.0 }?.1 ?? "")
    }
}

struct RdMeter: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = RdLive.completeness(st)
        Group {
            if c.0 < 100 {
                Button { st.go("myprofile") } label: {
                    HStack(spacing: 14) {
                        RdRing(pct: c.0, size: 62, line: 7)
                        VStack(alignment: .leading, spacing: 2) { Text("Your profile is " + String(c.0) + " percent").font(RdF.bold(16)).foregroundColor(RdC.ink); Text("Next: " + c.1).font(RdF.body(14)).foregroundColor(RdC.ras) }
                        Spacer()
                    }.padding(14).background(RdC.pale).clipShape(RoundedRectangle(cornerRadius: 24)).padding(.horizontal, 16).padding(.vertical, 6)
                }.buttonStyle(.plain)
            }
        }
    }
}

// ---------- mascot guide ----------
@MainActor
final class RdGuide: ObservableObject {
    static let shared = RdGuide()
    @Published var step = -1
    @Published var tip = 0
    @Published var hint = ""
    var active: Bool { return step >= 0 }
    static var done: Bool { return UserDefaults.standard.bool(forKey: "rdTourDone") }
    func start() { step = 0; hint = "" }
    func finish() { step = -1; UserDefaults.standard.set(true, forKey: "rdTourDone") }
}

struct RdGuideView: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var g = RdGuide.shared
    @State private var hop = false
    struct Step { var title: String; var text: String; var screen: String; var wait: ((RdStore) -> Bool)?; var hint: String }
    func steps() -> [Step] {
        let fam = st.isFamily
        let home = fam ? "famhome" : "carhome"
        return [
            Step(title: "Hi, I am Bun", text: "I will show you around in one minute. You can skip any time.", screen: home, wait: nil, hint: ""),
            Step(title: "Make your profile", text: fam ? "Add a photo, your postcode and your children's ages. No names. I will wait." : "Add a photo, your postcode and your rate. I will wait.", screen: "myprofile", wait: { s in !s.postcode.isEmpty && (fam ? !s.kidsAges.isEmpty : s.rate > 0) }, hint: fam ? "Add a postcode and at least one child age, then tap Save." : "Add a postcode and your rate, then tap Save."),
            Step(title: fam ? "Find your carer" : "Find families", text: "Real people near you. Tap a card for the full profile. Tap the heart if you like someone.", screen: "deck", wait: nil, hint: ""),
            Step(title: "The map", text: "Tap World to see everyone. Pick who to show with the chips.", screen: "map", wait: nil, hint: ""),
            Step(title: "Urgent board", text: fam ? "Need someone fast? Post a job here. Carers near you can apply." : "Families post urgent jobs here. Tap Apply and you are in.", screen: fam ? "urgentmine" : "urgent", wait: nil, hint: ""),
            Step(title: "Bookings", text: "Your jobs and requests live here. Accept, cancel and review.", screen: "bookings", wait: nil, hint: ""),
            Step(title: "Messages", text: "Say hi here. Phone numbers and emails are blocked. Tap Schedule a call for a phone call or video interview.", screen: "inbox", wait: nil, hint: ""),
            Step(title: "You are ready", text: "Tap me any time for a tip. Menu has Take the tour if you want it again.", screen: home, wait: nil, hint: "")
        ]
    }
    func go(_ screen: String) {
        let home = st.isFamily ? "famhome" : "carhome"
        if screen == "myprofile" { st.stack = [home, "myprofile"] } else { st.root(screen) }
    }
    var body: some View {
        let all = steps()
        let i = g.step
        VStack {
            Spacer()
            if i >= 0 && i < all.count {
                let s = all[i]
                let ok = s.wait?(st) ?? true
                HStack(alignment: .bottom, spacing: 8) {
                    Button { g.tip += 1; withAnimation(.spring(response: 0.3, dampingFraction: 0.4)) { hop.toggle() }; g.hint = ["Tap Next when you are ready.", "You can skip me and use the menu.", "Hearts show on the other person's Messages tab."][g.tip % 3] } label: {
                        Image("bunny").resizable().scaledToFit().frame(width: 64, height: 64).offset(y: hop ? -10 : 0)
                    }.buttonStyle(.plain)
                    VStack(alignment: .leading, spacing: 8) {
                        HStack { Text(s.title).font(RdF.title(18)).foregroundColor(RdC.ink); Spacer(); Text(String(i + 1) + " of " + String(all.count)).font(RdF.body(12)).foregroundColor(RdC.mut) }
                        Text(s.text).font(RdF.body(14)).foregroundColor(RdC.ink).fixedSize(horizontal: false, vertical: true)
                        if !ok { Text(g.hint.isEmpty ? s.hint : g.hint).font(RdF.bold(12)).foregroundColor(RdC.ras) } else if s.wait != nil { Text("Nice. You did it.").font(RdF.bold(12)).foregroundColor(RdC.okFg) }
                        else if !g.hint.isEmpty { Text(g.hint).font(RdF.body(12)).foregroundColor(RdC.mut) }
                        HStack(spacing: 8) {
                            if i == 0 { Button("Skip tour") { g.finish() }.font(RdF.bold(14)).foregroundColor(RdC.mut) }
                            else { Button("Take me there") { go(s.screen) }.font(RdF.bold(14)).foregroundColor(RdC.ras) }
                            Spacer()
                            if i > 0 && i < all.count - 1 { Button("Skip tour") { g.finish() }.font(RdF.bold(13)).foregroundColor(RdC.mut) }
                            Button { 
                                if !ok { g.hint = s.hint; return }
                                g.hint = ""
                                if i + 1 >= all.count { g.finish() } else { g.step = i + 1; go(all[i + 1].screen) }
                            } label: { Text(i == 0 ? "Start" : (i == all.count - 1 ? "Done" : "Next")).font(RdF.bold(15)).foregroundColor(RdC.ink).padding(.horizontal, 18).frame(height: 40).background(ok ? RdC.pink : RdC.line).clipShape(Capsule()) }.buttonStyle(.plain)
                        }
                        if !ok { Button("Skip this step") { g.hint = ""; if i + 1 < all.count { g.step = i + 1; go(all[i + 1].screen) } }.font(RdF.body(12)).foregroundColor(RdC.mut) }
                    }
                }.padding(12).background(Color.white).overlay(RoundedRectangle(cornerRadius: 24).stroke(RdC.pink, lineWidth: 2)).clipShape(RoundedRectangle(cornerRadius: 24))
                .shadow(color: Color.black.opacity(0.12), radius: 12, y: 4).padding(.horizontal, 10).padding(.bottom, 70)
            }
        }
    }
}

// ---------- reviews: ask by link, review after a job ----------
struct RdReviewSheet: View {
    var booking: Booking
    @Environment(\.dismiss) var dismiss
    @State private var stars = 5
    @State private var text = ""
    @State private var err = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("How did it go?").font(RdF.title(24)).foregroundColor(RdC.ink).padding(.horizontal, 20).padding(.top, 20)
            HStack(spacing: 8) { ForEach(1...5, id: \.self) { i in Button { stars = i } label: { Text("★").font(.system(size: 36)).foregroundColor(i <= stars ? RdC.ras : RdC.line) }.buttonStyle(.plain) } }.padding(.horizontal, 20)
            RdInput(label: "A few words", text: $text)
            if !err.isEmpty { Text(err).font(RdF.body(13)).foregroundColor(RdC.ras).padding(.horizontal, 20) }
            Spacer()
            RdCta(title: "Post review") {
                if let p = RdSafe.problem([text]) { err = p; return }
                Task { do { try await Backend.addReview(booking, rating: stars, text: text); dismiss() } catch { err = error.localizedDescription } }
            }.padding(.horizontal, 20).padding(.bottom, 16)
        }
    }
}

@MainActor
enum RdReviewLink {
    static let base = "https://support897.github.io/caresits-review/review.html"
    /// Makes a one time token the rules know (refInvites) and returns the link.
    static func make() async -> URL? {
        guard let u = RdLive.uid else { return nil }
        let token = String((0..<20).map { _ in "abcdefghjkmnpqrstuvwxyz23456789".randomElement() ?? "a" })
        do { try await Firestore.firestore().collection("profiles").document(u).collection("refInvites").document(token).setData(["at": FieldValue.serverTimestamp()]) } catch { return nil }
        return URL(string: base + "?u=" + u + "&t=" + token)
    }
}

struct RdMailSheet: UIViewControllerRepresentable {
    let to: String; let subject: String; let html: String
    @Environment(\.dismiss) var dismiss
    func makeUIViewController(context: Context) -> MFMailComposeViewController {
        let v = MFMailComposeViewController()
        v.mailComposeDelegate = context.coordinator
        v.setToRecipients([to]); v.setSubject(subject); v.setMessageBody(html, isHTML: true)
        return v
    }
    func updateUIViewController(_ u: MFMailComposeViewController, context: Context) {}
    func makeCoordinator() -> Coord { Coord(self) }
    final class Coord: NSObject, MFMailComposeViewControllerDelegate {
        let p: RdMailSheet
        init(_ p: RdMailSheet) { self.p = p }
        func mailComposeController(_ c: MFMailComposeViewController, didFinishWith r: MFMailComposeResult, error: Error?) { p.dismiss() }
    }
}

struct RdAskReview: View {
    @EnvironmentObject var st: RdStore
    @State private var theirName = ""
    @State private var theirEmail = ""
    @State private var busy = false
    @State private var mail: Bool = false
    @State private var html = ""
    @State private var plain = ""
    @State private var shareURL: URL? = nil
    var valid: Bool { theirEmail.contains("@") && theirEmail.contains(".") }
    func page(_ url: URL) -> String {
        let me = st.firstName.isEmpty ? "a Caresitters member" : st.firstName
        let hi = theirName.isEmpty ? "Hi," : "Hi " + theirName + ","
        return "<div style=\"font-family:-apple-system,Helvetica,Arial,sans-serif;color:#2D2A35;max-width:480px;margin:0 auto\"><div style=\"text-align:center;padding:18px 0;border-bottom:3px solid #F4A9BC\"><span style=\"font-size:26px;font-weight:800;color:#C2345B\">Caresitters</span></div><p style=\"font-size:16px\">\(hi)</p><p style=\"font-size:16px;line-height:1.5\">\(me) uses Caresitters and would love a short review of their work with you. It takes one minute. You confirm your email so the review is marked verified.</p><p style=\"text-align:center;margin:26px 0\"><a href=\"\(url.absoluteString)\" style=\"background:#C2345B;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px;display:inline-block\">Write a review for \(me)</a></p><p style=\"font-size:13px;color:#777\">Or open this link: \(url.absoluteString)</p><p style=\"font-size:13px;color:#777\">Caresitters. Trusted care, verified reviews.</p></div>"
    }
    var body: some View {
        RdCard(title: "Ask for a review") {
            RdMuted(text: "Type who should write it. We make a branded email for you to send. They confirm their email and write a short review. It shows as verified.")
            RdInput(label: "Their first name", text: $theirName)
            RdInput(label: "Their email", text: $theirEmail)
            RdCta(title: busy ? "Making email" : "Send review request", small: true) {
                guard valid else { st.err = "Type their email first."; return }
                busy = true
                Task {
                    guard let url0 = await RdReviewLink.make() else { busy = false; st.err = "Could not make the link. Try again."; return }
                    var url = url0
                    if let c = URLComponents(url: url0, resolvingAgainstBaseURL: false) {
                        var cc = c; cc.queryItems = (c.queryItems ?? []) + [URLQueryItem(name: "n", value: st.firstName)]
                        url = cc.url ?? url0
                    }
                    html = page(url)
                    plain = "Hi, " + (st.firstName.isEmpty ? "I" : st.firstName) + " uses Caresitters and would love a short review of their work with you. One minute. You confirm your email so it counts as verified: " + url.absoluteString
                    shareURL = url
                    busy = false
                    if MFMailComposeViewController.canSendMail() { mail = true }
                    else if let m = "mailto:\(theirEmail)?subject=\("Review request from Caresitters".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")&body=\(plain.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")".description as String?, let mu = URL(string: m) { UIApplication.shared.open(mu) }
                }
            }
            if let u = shareURL {
                ShareLink(item: u, message: Text(plain)) { Text("Or share by message").font(RdF.body(14)).foregroundColor(RdC.ras) }
            }
        }
        .sheet(isPresented: $mail) { RdMailSheet(to: theirEmail, subject: "A review request from " + (st.firstName.isEmpty ? "a Caresitters member" : st.firstName) + " on Caresitters", html: html) }
    }
}
