import SwiftUI
import FirebaseAuth
import FirebaseFirestore
import CoreLocation

// Live parts of the redesign: real sign in is in RdScreensA, here are inputs, postcode lookup,
// the live urgent board, the live deck and live chat. All of it uses Backend.swift.

extension RdVisaBy {
    static let homeList = ["Germany", "France", "Italy", "Ireland", "Taiwan", "Japan", "Brazil", "Spain", "Australia", "United Kingdom", "USA", "Canada", "New Zealand"]
    static let destList = ["Australia", "New Zealand", "Ireland", "United Kingdom", "USA", "Canada", "Germany", "France"]
}

struct RdInput: View {
    var label: String
    @Binding var text: String
    var secure: Bool = false
    var keyboard: UIKeyboardType = .default
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(RdF.body(12)).foregroundColor(RdC.mut)
            Group {
                if secure { SecureField("", text: $text) } else { TextField("", text: $text).keyboardType(keyboard) }
            }.font(RdF.body(16)).foregroundColor(RdC.ink).textInputAutocapitalization(keyboard == .emailAddress || secure ? .never : .sentences).autocorrectionDisabled(keyboard == .emailAddress || secure)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 14).padding(.vertical, 12)
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(RdC.line, lineWidth: 1)).padding(.horizontal, 20).padding(.vertical, 4)
    }
}

struct RdSelChips: View {
    var items: [String]
    var multi: Bool
    var max: Int = 99
    @Binding var sel: [String]
    var body: some View {
        RdFlow(spacing: 8) {
            ForEach(items, id: \.self) { i in
                Button { toggle(i) } label: { RdChip(text: i, on: sel.contains(i)) }.buttonStyle(.plain)
            }
        }.padding(.horizontal, 20)
    }
    func toggle(_ i: String) {
        if !multi { sel = [i]; return }
        if let k = sel.firstIndex(of: i) { sel.remove(at: k) } else if sel.count < max { sel.append(i) }
    }
}

struct RdRemotePhoto: View {
    var key: String
    @State private var img: UIImage? = nil
    var body: some View {
        ZStack {
            if RdPhotos.image(key) != nil { RdPhoto(key: key) }
            else if let i = img { Image(uiImage: i).resizable().scaledToFill() }
            else { RdC.blush }
        }.clipped()
        .task(id: key) {
            if !key.isEmpty, RdPhotos.image(key) == nil, let d = try? await Media.servedBytes(key), let u = UIImage(data: d) { img = u }
        }
    }
}

@MainActor
enum RdLive {
    static var uid: String? { Auth.auth().currentUser?.uid }
    static var signedIn: Bool { Auth.auth().currentUser != nil }
    static func careType(_ r: String) -> String { return r == "aupair" ? "au_pair" : r }

    /// My profile, or a stand in built from the setup answers when nothing is saved yet.
    static func me(_ st: RdStore) async -> Person? {
        guard let u = uid else { return nil }
        if let p = await Backend.loadProfile(u) { return p }
        return Person(id: u, data: ["side": st.isFamily ? "family" : "carer", "displayName": st.firstName, "postcode": st.postcode, "card": ["careTypes": [careType(st.pickedCare)]]])
    }

    static func origin(_ st: RdStore) async -> CLLocationCoordinate2D? {
        if let o = st.origin { return o }
        let o = await Geo.coord(postcode: st.postcode, country: st.country)
        st.origin = o
        return o
    }

    /// Save the answers of setup step 1: postcode, radius, country, au pair countries and visa.
    static func saveSetup(_ st: RdStore) {
        guard let u = uid else { return }
        st.origin = nil
        let fam = st.setupRole == "family"
        var card: [String: Any] = ["careTypes": [careType(st.pickedCare)], "country": st.country, "radiusKm": st.radius]
        if st.setupRole == "aupair" { card["from"] = st.home; card["destinations"] = st.dests; card["visa"] = st.visa }
        if fam { card["visaOnly"] = st.visaOnly; card["inCountryOnly"] = st.inCountryOnly }
        Task {
            _ = await origin(st)
            do { try await Backend.saveProfile(u, side: fam ? "family" : "carer", name: st.firstName.isEmpty ? "Member" : st.firstName, postcode: st.postcode, card: card) }
            catch { st.err = "Could not save your profile: " + error.localizedDescription }
        }
    }

    /// A signed in person with a saved profile goes straight home.
    static func restore(_ st: RdStore) {
        guard signedIn, st.current == "splash" else { return }
        Task {
            guard let u = uid, let p = await Backend.loadProfile(u), !p.services.isEmpty else { return }
            st.isFamily = p.side == "family"
            st.pickedCare = p.side == "family" ? "nanny" : (p.services.first == "au_pair" ? "aupair" : (p.services.first ?? "nanny"))
            st.setupRole = st.isFamily ? "family" : st.pickedCare
            st.firstName = p.firstName
            st.postcode = p.postcode
            st.country = (p.card["country"] as? String) ?? "Australia"
            st.radius = (p.card["radiusKm"] as? NSNumber)?.intValue ?? 15
            st.home = (p.card["from"] as? String) ?? ""
            st.dests = (p.card["destinations"] as? [String]) ?? []
            st.viewKey = st.defaultViewKey()
            st.root(st.isFamily ? "famhome" : "carhome")
        }
    }

    static func openChat(_ st: RdStore, otherUid: String) async -> Bool {
        guard let m = await me(st), let o = await Backend.loadProfile(otherUid) else { st.err = "Could not open the chat."; return false }
        do {
            let r = try await Backend.openChat(me: m, other: o)
            st.chatRel = r.id; st.chatName = o.firstName
            return true
        } catch { st.err = error.localizedDescription; return false }
    }

    static func whenText(_ d: Date) -> String {
        let h = d.timeIntervalSinceNow / 3600
        let cal = Calendar.current
        if cal.isDateInToday(d) { return cal.component(.hour, from: d) >= 17 ? "Tonight" : "Today" }
        if cal.isDateInTomorrow(d) { return "Tomorrow" }
        let w = cal.component(.weekday, from: d)
        if (w == 7 || w == 1) && h < 24 * 7 { return "This weekend" }
        return "Later"
    }
    static func leftText(_ d: Date) -> String {
        let m = Int(d.timeIntervalSinceNow / 60)
        if m < 1 { return "Needed now" }
        if m < 60 { return "Needed in " + String(m) + " minutes" }
        if m < 24 * 60 { return "Needed in " + String(m / 60) + " hours" }
        let f = DateFormatter(); f.dateFormat = "EEE"
        return "Needed by " + f.string(from: d)
    }
    static func timeText(_ d: Date, hrs: Double) -> String {
        let a = DateFormatter(); a.dateFormat = "EEE h:mma"
        let b = DateFormatter(); b.dateFormat = "h:mma"
        return a.string(from: d).lowercased() + " to " + b.string(from: d.addingTimeInterval(hrs * 3600)).lowercased()
    }
}

struct RdMineJob: Identifiable {
    var id: String
    var job: UrgentJob
    var post: RdUrgentPostData
    var applicants: [Person]
}

@MainActor
final class RdUrgentStore: ObservableObject {
    static let shared = RdUrgentStore()
    @Published var posts: [RdUrgentPostData] = []
    @Published var mine: [RdMineJob] = []
    @Published var selected: String = ""
    @Published var applied: Set<String> = []
    @Published var loaded = false
    @Published var filter: String = "All"
    @Published var msg: String = ""
    @Published var bookedName: String = ""
    @Published var bookedTime: String = ""
    var jobs: [String: UrgentJob] = [:]
    static let empty = RdUrgentPostData(id: "", fam: "", av: "", whenText: "", time: "", left: "", rate: 0, hrs: 0, sub: "", pc: "", km: -1, kids: "", body: "", imgs: [], role: "babysitter", tags: [], applied: 0, pct: 0, qa: [])

    var visible: [RdUrgentPostData] {
        switch filter {
        case "Now", "Tonight": return posts.filter { $0.whenText == "Today" || $0.whenText == "Tonight" }
        case "Tomorrow": return posts.filter { $0.whenText == "Tomorrow" }
        case "Weekend": return posts.filter { $0.whenText == "This weekend" }
        case "Nanny": return posts.filter { $0.role == "nanny" }
        case "Babysitter": return posts.filter { $0.role == "babysitter" }
        case "Near me": return posts.filter { $0.km >= 0 && $0.km <= 4 }
        default: return posts
        }
    }
    func post(_ id: String) -> RdUrgentPostData { return posts.first { $0.id == id } ?? mine.first { $0.id == id }?.post ?? RdUrgentStore.empty }

    func make(_ j: UrgentJob, fam: Person?, km: Double, yes: Int) -> RdUrgentPostData {
        let n = (try? JSONSerialization.jsonObject(with: Data(j.note.utf8))) as? [String: Any] ?? ["t": j.note]
        let rate = (n["r"] as? NSNumber)?.intValue ?? Int(j.bands.first ?? "0") ?? 0
        let hrs = (n["h"] as? NSNumber)?.doubleValue ?? 3
        return RdUrgentPostData(id: j.id, fam: (n["fam"] as? String) ?? fam?.name ?? "A family", av: fam?.photoKey ?? "", whenText: RdLive.whenText(j.when), time: RdLive.timeText(j.when, hrs: hrs), left: RdLive.leftText(j.when),
                                rate: rate, hrs: hrs, sub: (n["sub"] as? String) ?? fam?.suburb ?? "", pc: j.postcode, km: km, kids: (n["k"] as? String) ?? "", body: (n["t"] as? String) ?? "",
                                imgs: [], role: (n["role"] as? String) ?? "babysitter", tags: (n["tags"] as? [String]) ?? [], applied: yes, pct: 0, qa: [])
    }

    func load(_ st: RdStore) async {
        let list = await Backend.openJobs()
        jobs = Dictionary(list.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let profs = await Backend.loadProfiles(Array(Set(list.map { $0.familyUid })))
        let o = await RdLive.origin(st)
        var out: [RdUrgentPostData] = []
        var mineApplied: Set<String> = applied
        for j in list {
            var km = -1.0
            if let o, let la = j.lat, let ln = j.lng { km = Geo.km(o, CLLocationCoordinate2D(latitude: la, longitude: ln)) }
            if km > Double(st.radius) { continue }
            let yes = await Backend.jobYeses(j.id)
            if let u = RdLive.uid, yes.contains(u) { mineApplied.insert(j.id) }
            out.append(make(j, fam: profs[j.familyUid], km: km, yes: yes.count))
        }
        out.sort { ($0.km < 0 ? 999 : $0.km) < ($1.km < 0 ? 999 : $1.km) }
        applied = mineApplied
        posts = out
        loaded = true
    }

    func loadMine(_ st: RdStore) async {
        guard let u = RdLive.uid else { return }
        let js = await Backend.myJobs(u)
        var out: [RdMineJob] = []
        for j in js where j.state != "closed" {
            let yes = await Backend.jobYeses(j.id)
            let ps = await Backend.loadProfiles(yes)
            out.append(RdMineJob(id: j.id, job: j, post: make(j, fam: nil, km: -1, yes: yes.count), applicants: yes.compactMap { ps[$0] }))
        }
        mine = out
    }

    func apply(_ id: String) async -> Bool {
        guard let j = jobs[id], let u = RdLive.uid else { msg = "Please sign in first."; return false }
        do { try await Backend.sayYes(job: j, carerUid: u); applied.insert(id); msg = ""; return true }
        catch { msg = error.localizedDescription; return false }
    }

    func book(_ m: RdMineJob, _ p: Person) async -> Bool {
        guard let u = RdLive.uid else { return false }
        do {
            try await Backend.pickCarer(job: m.job, carerUid: p.id)
            let d = DateFormatter(); d.dateFormat = "yyyy-MM-dd"
            let t = DateFormatter(); t.dateFormat = "HH:mm"
            try? await Backend.createBooking(familyUid: u, carerUid: p.id, date: d.string(from: m.job.when), from: t.string(from: m.job.when), to: t.string(from: m.job.when.addingTimeInterval(m.post.hrs * 3600)), rate: Double(m.post.rate), note: m.post.body)
            bookedName = p.firstName; bookedTime = m.post.time; msg = ""
            return true
        } catch { msg = error.localizedDescription; return false }
    }

    func create(_ st: RdStore, when: Date, chip: String, hrs: Double, rate: Int, role: String, kids: String, desc: String, tags: [String]) async -> Bool {
        guard let u = RdLive.uid else { msg = "Please sign in first."; return false }
        let me = await RdLive.me(st)
        let n: [String: Any] = ["t": String(desc.prefix(400)), "r": rate, "h": hrs, "k": String(kids.prefix(60)), "role": role, "tags": Array(tags.prefix(3)), "fam": me?.name ?? st.firstName, "sub": me?.suburb ?? ""]
        let note = (try? String(data: JSONSerialization.data(withJSONObject: n), encoding: .utf8)) ?? desc
        do { try await Backend.createJob(familyUid: u, when: when, dayParts: [chip], postcode: st.postcode, bands: [String(rate)], note: note); msg = ""; return true }
        catch { msg = error.localizedDescription; return false }
    }
}

struct RdUrgentDetail: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    @State private var q = ""
    @State private var sent = false
    var body: some View {
        let u = us.post(us.selected)
        VStack(spacing: 0) {
            RdHeader(title: "Urgent job")
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    RdUrgentCard(u: u, mine: true, detail: true)
                    RdCard(title: "Where") { RdMuted(text: u.sub + " " + u.pc + (u.km >= 0 ? ". " + String(format: "%.1f", u.km) + " km from you." : "")) }
                    RdLabel(title: "Ask the family", sub: "Your question goes to them as a message.")
                    RdInput(label: "Your question", text: $q)
                    RdFlow(spacing: 8) {
                        ForEach(["Is dinner made?", "Any allergies?", "What time is bedtime?"], id: \.self) { s in Button { q = s } label: { RdChip(text: s) }.buttonStyle(.plain) }
                    }.padding(.horizontal, 20).padding(.top, 8)
                    if sent { Text("Sent.").font(RdF.bold(14)).foregroundColor(RdC.okFg).padding(.top, 8) }
                    RdCta(title: "Send question", style: 1, small: true) {
                        guard !q.isEmpty, let j = us.jobs[u.id] else { return }
                        Task {
                            if await RdLive.openChat(st, otherUid: j.familyUid), let uid = RdLive.uid { try? await Backend.send(st.chatRel, from: uid, text: q); sent = true; q = "" }
                        }
                    }.padding(.horizontal, 20).padding(.top, 10)
                }.padding(.bottom, 20)
            }
            RdBottomBar { RdCta(title: us.applied.contains(u.id) ? "Applied" : "Apply at $" + String(u.rate) + " an hour") { if !us.applied.contains(u.id) { st.go("urgentapply") } } }
        }
    }
}

struct RdUrgentApply: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    @State private var busy = false
    var body: some View {
        let u = us.post(us.selected)
        VStack(spacing: 0) {
            RdHeader(title: "Apply")
            RdScroll {
                RdCard { HStack(spacing: 12) { RdRemotePhoto(key: u.av).frame(width: 52, height: 52).clipShape(Circle()); VStack(alignment: .leading) { Text(u.fam).font(RdF.bold(16)).foregroundColor(RdC.ink); RdMuted(text: u.time + ", " + u.sub + " " + u.pc) } } }
                RdCard(title: "You will earn") {
                    Text("$" + String(u.total)).font(RdF.title(30)).foregroundColor(RdC.ras)
                    RdMuted(text: "$" + String(u.rate) + " an hour for " + String(u.hrs) + " hours. You keep 100 percent.")
                }
                RdCard(tint: RdC.pale) { RdMuted(text: "The family sees you right away. If they tap Book, it is yours.") }
                if !us.msg.isEmpty { Text(us.msg).font(RdF.body(13)).foregroundColor(RdC.ras).padding(.horizontal, 20) }
            }
            RdBottomBar { RdCta(title: busy ? "Sending" : "Send my application") {
                busy = true
                Task { if await us.apply(u.id) { st.go("urgentsent") }; busy = false }
            } }
        }
    }
}

struct RdUrgentSent: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    var body: some View {
        VStack(spacing: 0) {
            Spacer()
            Image("bunny").resizable().scaledToFit().frame(width: 90)
            Text("Sent").font(RdF.title(30)).foregroundColor(RdC.ink).padding(.top, 10)
            Text("The family can see you now.").font(RdF.body(15)).foregroundColor(RdC.mut).multilineTextAlignment(.center).padding(.horizontal, 30).padding(.top, 4)
            Spacer()
            RdBottomBar { VStack(spacing: 10) {
                RdCta(title: "Back to the board") { st.root("urgent") }
                RdCta(title: "Message the family", style: 1) {
                    Task { if let j = us.jobs[us.selected], await RdLive.openChat(st, otherUid: j.familyUid) { st.go("chat") } }
                }
            } }
        }
    }
}

struct RdUrgentPost: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    @State private var chip = "Tonight"
    @State private var when = Date().addingTimeInterval(3600)
    @State private var hrs = 4.0
    @State private var rate = 45
    @State private var role = "Babysitter"
    @State private var kids = ""
    @State private var desc = ""
    @State private var tag: [String] = []
    @State private var busy = false
    var chipBinding: Binding<[String]> { Binding(get: { [chip] }, set: { v in chip = v.first ?? chip; setDate() }) }
    var roleBinding: Binding<[String]> { Binding(get: { [role] }, set: { role = $0.first ?? role }) }
    func setDate() {
        let c = Calendar.current
        let now = Date()
        switch chip {
        case "Now": when = now.addingTimeInterval(1800)
        case "Tonight": var d = c.date(bySettingHour: 17, minute: 30, second: 0, of: now) ?? now; if d < now { d = now.addingTimeInterval(3600) }; when = d
        case "Tomorrow": when = c.date(bySettingHour: 8, minute: 0, second: 0, of: now.addingTimeInterval(86400)) ?? now
        case "This weekend": when = c.nextDate(after: now, matching: DateComponents(hour: 18, weekday: 7), matchingPolicy: .nextTime) ?? now
        default: break
        }
    }
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: "Post an urgent job")
            RdScroll {
                RdMuted(text: "Takes one minute. Carers near you see it straight away.").padding(.horizontal, 20)
                RdLabel(title: "When do you need care?")
                RdSelChips(items: ["Now", "Tonight", "Tomorrow", "This weekend", "Pick a day"], multi: false, sel: chipBinding)
                DatePicker("Starts", selection: $when, in: Date()...).font(RdF.bold(16)).padding(.horizontal, 20).padding(.top, 8)
                Stepper("Hours: " + String(hrs), value: $hrs, in: 1...12, step: 0.5).font(RdF.bold(16)).padding(.horizontal, 20)
                RdLabel(title: "What kind of carer?")
                RdSelChips(items: ["Nanny", "Babysitter"], multi: false, sel: roleBinding)
                RdLabel(title: "Children ages")
                RdInput(label: "For example Mia 4, Leo 7", text: $kids)
                RdLabel(title: "Pay per hour", sub: "About $" + String(Int(Double(rate) * hrs)) + " in total")
                HStack(spacing: 14) { RdIconButton(icon: "minus") { if rate > 20 { rate -= 1 } }; Text("$" + String(rate)).font(RdF.title(34)).foregroundColor(RdC.ras); RdIconButton(icon: "plus") { if rate < 120 { rate += 1 } } }.padding(.horizontal, 20)
                RdLabel(title: "What should they know?")
                RdInput(label: "Short description", text: $desc)
                RdSelChips(items: ["Dinner is made", "Bedtime routine", "Pets at home", "Allergies"], multi: true, max: 3, sel: $tag)
                RdCard(tint: RdC.pale) { RdMuted(text: "Postcode " + st.postcode + ". Shown to carers within " + String(st.radius) + " km. Your street stays private.") }
                if !us.msg.isEmpty { Text(us.msg).font(RdF.body(13)).foregroundColor(RdC.ras).padding(.horizontal, 20) }
            }
            RdBottomBar { RdCta(title: busy ? "Posting" : "Post now", icon: "clock") {
                busy = true
                Task {
                    if await us.create(st, when: when, chip: chip, hrs: hrs, rate: rate, role: role.lowercased(), kids: kids, desc: desc, tags: tag) { st.go("urgentposted") }
                    busy = false
                }
            } }
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
            Text("Carers within " + String(st.radius) + " km of " + st.postcode + " can see it now.").font(RdF.body(15)).foregroundColor(RdC.mut).multilineTextAlignment(.center).padding(.horizontal, 30).padding(.top, 4)
            Spacer()
            RdBottomBar { RdCta(title: "See who applied") { st.root("urgentmine") } }
        }
    }
}

struct RdUrgentMine: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("My urgent jobs").font(RdF.title(26)).foregroundColor(RdC.ink)
                Spacer()
                RdIconButton(icon: "plus") { st.go("urgentpost") }
            }.padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 8)
            .task { while !Task.isCancelled { await us.loadMine(st); try? await Task.sleep(nanoseconds: 15_000_000_000) } }
            RdScroll {
                if us.mine.isEmpty { RdCard { RdMuted(text: "No urgent jobs yet. Tap the plus to post one.") } }
                ForEach(us.mine) { m in
                    RdCard {
                        HStack { VStack(alignment: .leading) { Text(m.post.time).font(RdF.bold(16)).foregroundColor(RdC.ink); RdMuted(text: "$" + String(m.post.rate) + " an hour, " + m.post.pc + ", " + m.post.kids) }
                            RdTag(text: m.job.state == "open" ? "Open" : "Booked", fill: RdC.okBg, fg: RdC.okFg) }
                        RdMuted(text: String(m.applicants.count) + " applied")
                    }
                    if m.job.state == "open" {
                        ForEach(m.applicants) { a in
                            VStack(spacing: 10) {
                                HStack(spacing: 12) {
                                    RdRemotePhoto(key: a.photoKey).frame(width: 56, height: 56).clipShape(Circle())
                                    VStack(alignment: .leading, spacing: 2) { Text(a.name).font(RdF.bold(16)).foregroundColor(RdC.ink); RdMuted(text: "Postcode " + a.postcode) }
                                }
                                HStack(spacing: 8) {
                                    RdCta(title: "Book right away", icon: "calendar", small: true) { Task { if await us.book(m, a) { st.go("urgentbooked") } } }
                                    RdMsgButton { Task { if await RdLive.openChat(st, otherUid: a.id) { st.go("chat") } } }
                                }
                            }.padding(14).overlay(RoundedRectangle(cornerRadius: 26).stroke(RdC.line, lineWidth: 1)).padding(.horizontal, 14).padding(.bottom, 10)
                        }
                    }
                }
                if !us.msg.isEmpty { Text(us.msg).font(RdF.body(13)).foregroundColor(RdC.ras).padding(.horizontal, 20) }
            }
        }
    }
}

struct RdUrgentBooked: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    var body: some View {
        VStack(spacing: 0) {
            Spacer()
            Image("bunny").resizable().scaledToFit().frame(width: 90)
            Text(us.bookedName + " is booked").font(RdF.title(30)).foregroundColor(RdC.ink).padding(.top, 10)
            Text(us.bookedTime + ". The other carers can see it is filled. Card payment is not switched on yet, so pay " + us.bookedName + " directly for now.").font(RdF.body(15)).foregroundColor(RdC.mut).multilineTextAlignment(.center).padding(.horizontal, 30).padding(.top, 4)
            Spacer()
            RdBottomBar { RdCta(title: "Back to my jobs") { st.root("urgentmine") } }
        }
    }
}

struct RdVisaCheck: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: "Your countries and visas")
            RdScroll {
                RdMuted(text: "Your picks decide which families you see first. Visa never changes your match score.").padding(.horizontal, 20).padding(.bottom, 10)
                if st.dests.isEmpty { RdCard { RdMuted(text: "You have not picked a country yet. Go back and pick up to 3.") } }
                ForEach(Array(st.dests.enumerated()), id: \.offset) { i, d in
                    RdVisaRow(n: i + 1, place: d, status: d == st.home ? "You live there" : (st.visa == "Visa approved" && i == 0 ? "Visa approved" : "Check the rules"))
                }
                RdCard(tint: RdC.pale) { RdMuted(text: "Families can choose au pairs with an approved visa, or already living in the country.") }
            }
            RdBottomBar { RdCta(title: "Continue") { st.go("sa") } }
        }
    }
}

// ----- live deck -----
struct RdLivePerson: Identifiable {
    var p: Person
    var km: Double
    var rank: Int
    var id: String { p.id }
}

struct RdLiveDeck: View {
    @EnvironmentObject var st: RdStore
    @State private var people: [RdLivePerson] = []
    @State private var loaded = false
    var body: some View {
        VStack(spacing: 0) {
            RdTopBar(on: "deck").padding(.horizontal, 12).padding(.top, 6)
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 12) {
                    ForEach(people) { x in RdLiveCard(x: x) }
                    if loaded && people.isEmpty {
                        Text("Nobody inside " + String(st.radius) + " km yet. New people show here as they join.").font(RdF.body(15)).foregroundColor(RdC.mut).multilineTextAlignment(.center).padding(30)
                    }
                    if !loaded { Text("Looking near " + st.postcode).font(RdF.bold(14)).foregroundColor(RdC.mut).padding(30) }
                }.padding(.top, 8).padding(.bottom, 20)
            }
        }.task { await load() }
    }
    func load() async {
        guard let me = await RdLive.me(st) else { loaded = true; return }
        var svc = me.services
        if me.side == "family" { svc = ["nanny", "babysitter", "au_pair"] }
        if svc.isEmpty { svc = [RdLive.careType(st.pickedCare)] }
        let found = await Backend.discover(me: me, services: svc)
        let o = await RdLive.origin(st)
        var out: [RdLivePerson] = []
        for p in found {
            let isAu = p.services.contains("au_pair")
            let dests = (p.card["destinations"] as? [String]) ?? []
            var km = -1.0
            if !(isAu && me.side == "family") {
                let ctry = (p.card["country"] as? String) ?? "Australia"
                if let o, let c = await Geo.coord(postcode: p.postcode, country: ctry) { km = Geo.km(o, c) }
                if km > Double(st.radius) { continue }
            }
            if me.side == "family" && isAu {
                let visa = (p.card["visa"] as? String) ?? ""
                if st.visaOnly && visa != "Visa approved" && visa != "I live there already" { continue }
                if st.inCountryOnly && visa != "I live there already" { continue }
            }
            var rank = 50
            if isAu && me.side == "family" { rank = dests.firstIndex(of: st.country) ?? 9 }
            if me.side == "carer" && st.pickedCare == "aupair" {
                let c = (p.card["country"] as? String) ?? "Australia"
                guard let idx = st.dests.firstIndex(of: c) else { continue }
                rank = idx
            }
            out.append(RdLivePerson(p: p, km: km, rank: rank))
        }
        out.sort { $0.rank != $1.rank ? $0.rank < $1.rank : ($0.km < 0 ? 999 : $0.km) < ($1.km < 0 ? 999 : $1.km) }
        people = out
        loaded = true
    }
}

struct RdLiveCard: View {
    @EnvironmentObject var st: RdStore
    var x: RdLivePerson
    var body: some View {
        let p = x.p
        let keys = ([p.photoKey] + p.gallery).filter { !$0.isEmpty }
        let isAu = p.services.contains("au_pair")
        let dests = (p.card["destinations"] as? [String]) ?? []
        VStack(alignment: .leading, spacing: 8) {
            TabView {
                if keys.isEmpty { RdC.blush }
                ForEach(keys, id: \.self) { k in RdRemotePhoto(key: k).frame(maxWidth: .infinity).frame(height: 340).clipped() }
            }.tabViewStyle(.page).frame(height: 340).clipShape(RoundedRectangle(cornerRadius: 24))
            Text(p.name).font(RdF.title(26)).foregroundColor(RdC.ink)
            HStack(spacing: 6) {
                if p.side == "family" { RdPill(role: "family") }
                else { RdPill(role: isAu ? "aupair" : (p.services.first ?? "nanny")) }
            }
            if isAu && x.rank == 0 { RdPlaceRibbon(text: "From " + ((p.card["from"] as? String) ?? "abroad") + ". " + st.country + " is the first choice", icon: "globe") }
            else if isAu && !dests.isEmpty { RdPlaceRibbon(text: "From " + ((p.card["from"] as? String) ?? "abroad") + ". Picked " + dests.joined(separator: ", "), icon: "globe") }
            else { RdPlaceRibbon(text: "Postcode " + p.postcode + (x.km >= 0 ? ", " + Geo.label(x.km) + " away" : "")) }
            if !p.headline.isEmpty { Text(p.headline).font(RdF.bold(16)).foregroundColor(RdC.ink) }
            if !p.about.isEmpty { Text(p.about).font(RdF.body(15)).foregroundColor(RdC.ink).fixedSize(horizontal: false, vertical: true) }
            RdFlow(spacing: 6) { ForEach(p.services, id: \.self) { RdChip(text: $0.replacingOccurrences(of: "_", with: " ").capitalized) } }
            RdCta(title: "Message and book", icon: "calendar") { Task { if await RdLive.openChat(st, otherUid: p.id) { st.go("chat") } } }
        }.padding(14).background(Color.white).overlay(RoundedRectangle(cornerRadius: 28).stroke(RdC.line, lineWidth: 1)).padding(.horizontal, 12)
    }
}

// ----- live chat and inbox -----
struct RdLiveChat: View {
    @EnvironmentObject var st: RdStore
    @State private var msgs: [ChatMessage] = []
    @State private var text = ""
    @State private var reg: ListenerRegistration? = nil
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: st.chatName)
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(msgs) { m in
                        let mine = m.from == RdLive.uid
                        HStack { if mine { Spacer(minLength: 50) }
                            Text(m.text).font(RdF.body(16)).foregroundColor(RdC.ink).padding(.horizontal, 14).padding(.vertical, 9).background(mine ? RdC.blush : RdC.field).clipShape(RoundedRectangle(cornerRadius: 20))
                            if !mine { Spacer(minLength: 50) } }
                    }
                }.padding(14)
            }.defaultScrollAnchor(.bottom)
            HStack(spacing: 8) {
                TextField("Message", text: $text).font(RdF.body(16)).padding(.horizontal, 16).frame(height: 48).overlay(Capsule().stroke(RdC.line, lineWidth: 1))
                RdIconButton(icon: "send") {
                    let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !t.isEmpty, let u = RdLive.uid else { return }
                    text = ""
                    Task { try? await Backend.send(st.chatRel, from: u, text: t) }
                }
            }.padding(.horizontal, 12).padding(.vertical, 8)
        }
        .onAppear { reg = Backend.listenMessages(st.chatRel) { msgs = $0 } }
        .onDisappear { reg?.remove(); reg = nil }
    }
}

struct RdLiveInbox: View {
    @EnvironmentObject var st: RdStore
    @State private var rows: [(Relationship, Person)] = []
    @State private var loaded = false
    var body: some View {
        VStack(spacing: 0) {
            HStack { Text("Messages").font(RdF.title(26)).foregroundColor(RdC.ink); Spacer() }.padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 8)
            RdScroll {
                if loaded && rows.isEmpty { RdCard { RdMuted(text: "No chats yet. Tap Message on someone you like.") } }
                ForEach(0..<rows.count, id: \.self) { i in
                    Button { st.chatRel = rows[i].0.id; st.chatName = rows[i].1.firstName; st.go("chat") } label: {
                        HStack(spacing: 12) {
                            RdRemotePhoto(key: rows[i].1.photoKey).frame(width: 52, height: 52).clipShape(Circle())
                            Text(rows[i].1.name).font(RdF.bold(17)).foregroundColor(RdC.ink)
                            Spacer()
                        }.padding(.horizontal, 20).padding(.vertical, 8)
                    }.buttonStyle(.plain)
                }
            }
        }.task {
            guard let u = RdLive.uid else { loaded = true; return }
            let side = st.isFamily ? "family" : "carer"
            let rels = await Backend.relationships(u, side: side)
            let ps = await Backend.loadProfiles(rels.map { $0.other(u) })
            rows = rels.compactMap { r in ps[r.other(u)].map { (r, $0) } }
            loaded = true
        }
    }
}
