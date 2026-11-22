import SwiftUI
import FirebaseAuth
import FirebaseFirestore
import CoreLocation
import PhotosUI
import UserNotifications

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
    static func auPairMap(_ p: Person) -> [String: Any] { return (p.card["auPair"] as? [String: Any]) ?? [:] }
    static func country(_ p: Person) -> String { return ((p.card["auPairHost"] as? [String: Any])?["country"] as? String) ?? (auPairMap(p)["homeCountry"] as? String) ?? "Australia" }
    static func dests(_ p: Person) -> [String] { return (auPairMap(p)["destinations"] as? [String]) ?? [] }
    static func visaOf(_ p: Person) -> String { return (auPairMap(p)["visaNotes"] as? String) ?? "" }
    static func fromOf(_ p: Person) -> String { let h = (auPairMap(p)["homeCountry"] as? String) ?? ""; return h.isEmpty ? "abroad" : h }
    static func bands(_ ages: [Int]) -> [String] {
        var out: [String] = []
        for a in ages { let b = a < 1 ? "newborn" : (a < 2 ? "infant" : (a < 4 ? "toddler" : (a < 6 ? "preschool" : "school"))); if !out.contains(b) { out.append(b) } }
        return out
    }
    /// Card keys that the live rules allow. Radius is maxDistanceKm, country is auPairHost.country, au pair picks are the auPair map.
    static func cardFor(_ st: RdStore) -> [String: Any] {
        var card: [String: Any] = ["careTypes": [careType(st.pickedCare)], "maxDistanceKm": st.radius, "auPairHost": ["country": st.country]]
        if st.setupRole == "aupair" { card["auPair"] = ["homeCountry": st.home, "destinations": st.dests, "visaNotes": st.visa] as [String: Any]; card["auPairHost"] = ["country": st.home.isEmpty ? st.country : st.home] }
        if st.setupRole != "family" && st.setupRole != "aupair" && st.rate > 0 { card["rate"] = Double(st.rate) }
        if st.setupRole == "family" { card["kids"] = st.kidsAges.prefix(8).map { ["ageYears": $0] }; card["ageGroups"] = bands(st.kidsAges) }
        return card
    }
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
        var card = cardFor(st)
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
            st.country = RdLive.country(p)
            st.radius = (p.card["maxDistanceKm"] as? NSNumber)?.intValue ?? 15
            st.home = RdLive.fromOf(p) == "abroad" ? "" : RdLive.fromOf(p)
            st.dests = RdLive.dests(p)
            st.kidsAges = p.kids.map { $0.age }
            st.photoKey = p.photoKey; st.about = p.about; st.rate = Int(p.rate)
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

struct RdComment: Identifiable {
    var id: String; var uid: String; var name: String; var photoKey: String; var side: String; var role: String; var postcode: String; var text: String; var at: Date
}

extension RdLive {
    static func notify(_ title: String, _ body: String) {
        let c = UNUserNotificationCenter.current()
        c.requestAuthorization(options: [.alert, .sound]) { ok, _ in
            guard ok else { return }
            let n = UNMutableNotificationContent(); n.title = title; n.body = body; n.sound = .default
            c.add(UNNotificationRequest(identifier: UUID().uuidString, content: n, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)))
        }
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
    var seen: Set<String> = []
    @Published var comments: [RdComment] = []
    var commentReg: ListenerRegistration? = nil
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
                                imgs: (n["img"] as? [String]) ?? [], role: (n["role"] as? String) ?? "babysitter", tags: (n["tags"] as? [String]) ?? [], applied: yes, pct: 0, qa: [])
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
            var cnt = 0
            if let u = RdLive.uid {
                if j.familyUid == u { cnt = (await Backend.jobYeses(j.id)).count }
                else if let d = try? await Firestore.firestore().collection("jobs").document(j.id).collection("interest").document(u).getDocument(), d.exists { mineApplied.insert(j.id) }
            }
            out.append(make(j, fam: profs[j.familyUid], km: km, yes: cnt))
        }
        out.sort { ($0.km < 0 ? 999 : $0.km) < ($1.km < 0 ? 999 : $1.km) }
        applied = mineApplied
        let ids = Set(out.map { $0.id })
        if loaded { for u in out where !seen.contains(u.id) { RdLive.notify("New urgent job near " + u.pc, "$" + String(u.rate) + " an hour. " + u.left) } }
        seen = seen.union(ids)
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
        for m in out { jobs[m.id] = m.job }
    }

    func listenComments(_ jobId: String) {
        commentReg?.remove()
        commentReg = Firestore.firestore().collection("jobs").document(jobId).collection("comments").order(by: "at").addSnapshotListener { [weak self] snap, _ in
            let rows = (snap?.documents ?? []).map { d -> RdComment in
                let x = d.data()
                return RdComment(id: d.documentID, uid: x["uid"] as? String ?? "", name: x["name"] as? String ?? "Member", photoKey: x["photoKey"] as? String ?? "", side: x["side"] as? String ?? "carer",
                                 role: x["role"] as? String ?? "nanny", postcode: x["postcode"] as? String ?? "", text: x["text"] as? String ?? "", at: (x["at"] as? Timestamp)?.dateValue() ?? Date())
            }
            Task { @MainActor in self?.comments = rows }
        }
    }
    func stopComments() { commentReg?.remove(); commentReg = nil; comments = [] }

    /// Public comment under the post, with my profile. A carer who applied also gets the private message to the family.
    func comment(_ st: RdStore, job: UrgentJob, text: String) async -> Bool {
        guard let u = RdLive.uid, let me = await RdLive.me(st) else { msg = "Please sign in first."; return false }
        if let p = RdSafe.problem([text]) { msg = p; return false }
        let role = me.side == "family" ? "family" : (me.services.first == "au_pair" ? "aupair" : (me.services.first ?? "nanny"))
        var ok = true
        do {
            try await Firestore.firestore().collection("jobs").document(job.id).collection("comments").addDocument(data: ["uid": u, "name": me.name, "photoKey": me.photoKey, "side": me.side, "role": role, "postcode": me.postcode, "text": String(text.prefix(500)), "at": FieldValue.serverTimestamp()])
        } catch { msg = "The public comment could not post: " + error.localizedDescription; ok = false }
        if me.side == "carer" && applied.contains(job.id) {
            if await RdLive.openChat(st, otherUid: job.familyUid) { try? await Backend.send(st.chatRel, from: u, text: "About your urgent job: " + text) }
        }
        return ok
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

    func create(_ st: RdStore, when: Date, chip: String, hrs: Double, rate: Int, role: String, kids: String, desc: String, tags: [String], imgs: [String] = []) async -> Bool {
        guard let u = RdLive.uid else { msg = "Please sign in first."; return false }
        if let p = RdSafe.problem([desc, kids]) { msg = p; return false }
        let me = await RdLive.me(st)
        let n: [String: Any] = ["t": String(desc.prefix(300)), "r": rate, "h": hrs, "k": String(kids.prefix(60)), "role": role, "tags": Array(tags.prefix(3)), "fam": me?.name ?? st.firstName, "sub": me?.suburb ?? "", "img": Array(imgs.prefix(3))]
        let note = (try? String(data: JSONSerialization.data(withJSONObject: n), encoding: .utf8)) ?? desc
        do { try await Backend.createJob(familyUid: u, when: when, dayParts: [chip], postcode: st.postcode, bands: [String(rate)], note: note); msg = ""; return true }
        catch { msg = error.localizedDescription; return false }
    }
}

struct RdUrgentDetail: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    @State private var q = ""
    @State private var busy = false
    var body: some View {
        let u = us.post(us.selected)
        let job = us.jobs[u.id]
        let owner = job?.familyUid == RdLive.uid
        VStack(spacing: 0) {
            RdHeader(title: "Urgent job")
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    RdUrgentCard(u: u, mine: true, detail: true)
                    RdCard(title: "Where") { RdMuted(text: u.sub + " " + u.pc + (u.km >= 0 ? ". " + String(format: "%.1f", u.km) + " km from you." : "")) }
                    RdLabel(title: "Questions and answers", sub: "Everyone can see these, like on a public post.")
                    ForEach(us.comments) { c in
                        HStack(alignment: .top, spacing: 10) {
                            RdRemotePhoto(key: c.photoKey).frame(width: 44, height: 44).clipShape(Circle())
                            VStack(alignment: .leading, spacing: 3) {
                                HStack(spacing: 6) { Text(c.name).font(RdF.bold(15)).foregroundColor(RdC.ink); RdPill(role: c.role) }
                                Text("Postcode " + c.postcode).font(RdF.body(12)).foregroundColor(RdC.mut)
                                Text(c.text).font(RdF.body(15)).foregroundColor(RdC.ink).fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer(minLength: 0)
                        }.padding(12).background(RdC.field).clipShape(RoundedRectangle(cornerRadius: 20)).padding(.horizontal, 16).padding(.bottom, 8)
                    }
                    if us.comments.isEmpty { RdMuted(text: "No questions yet. Be the first.").padding(.horizontal, 20) }
                    RdInput(label: owner ? "Reply to everyone" : "Ask a question", text: $q)
                    if !owner { RdMuted(text: us.applied.contains(u.id) ? "You applied, so the family also gets it as a private message." : "Apply to also message the family privately.").padding(.horizontal, 20) }
                    if !us.msg.isEmpty { Text(us.msg).font(RdF.body(13)).foregroundColor(RdC.ras).padding(.horizontal, 20).padding(.top, 4) }
                    RdCta(title: busy ? "Sending" : (owner ? "Reply" : "Post question"), style: 1, small: true) {
                        guard !q.trimmingCharacters(in: .whitespaces).isEmpty, let j = job else { return }
                        busy = true
                        Task { if await us.comment(st, job: j, text: q) { q = "" }; busy = false }
                    }.padding(.horizontal, 20).padding(.top, 8)
                }.padding(.bottom, 20)
            }
            if !owner { RdBottomBar { RdCta(title: us.applied.contains(u.id) ? "Applied" : "Apply at $" + String(u.rate) + " an hour") { if !us.applied.contains(u.id) { st.go("urgentapply") } } } }
        }
        .onAppear { us.listenComments(u.id) }
        .onDisappear { us.stopComments() }
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
    @State private var picks: [PhotosPickerItem] = []
    @State private var imgKeys: [String] = []
    @State private var imgBusy = false
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
                RdSelChips(items: ["Now", "Tonight", "Tomorrow", "This weekend"], multi: false, sel: chipBinding)
                RdDayTime(date: $when)
                Stepper("Hours: " + String(hrs), value: $hrs, in: 1...12, step: 0.5).font(RdF.bold(16)).padding(.horizontal, 20)
                RdLabel(title: "What kind of carer?")
                RdSelChips(items: ["Nanny", "Babysitter"], multi: false, sel: roleBinding)
                RdLabel(title: "Children ages")
                RdInput(label: "For example Mia 4, Leo 7", text: $kids)
                RdLabel(title: "Pay per hour", sub: "About $" + String(Int(Double(rate) * hrs)) + " in total")
                HStack(spacing: 14) { RdIconButton(icon: "minus") { if rate > 20 { rate -= 1 } }; Text("$" + String(rate)).font(RdF.title(34)).foregroundColor(RdC.ras); RdIconButton(icon: "plus") { if rate < 120 { rate += 1 } } }.padding(.horizontal, 20)
                RdLabel(title: "What should they know?")
                RdInput(label: "Short description. No phone or email.", text: $desc)
                RdSelChips(items: ["Dinner is made", "Bedtime routine", "Pets at home", "Allergies"], multi: true, max: 3, sel: $tag)
                RdLabel(title: "Photos", sub: "Optional. Show your home, never your children.")
                HStack(spacing: 8) {
                    ForEach(imgKeys, id: \.self) { k in RdRemotePhoto(key: k).frame(width: 90, height: 90).clipShape(RoundedRectangle(cornerRadius: 16)) }
                    if imgKeys.count < 3 {
                        PhotosPicker(selection: $picks, maxSelectionCount: 3 - imgKeys.count, matching: .images) {
                            RoundedRectangle(cornerRadius: 16).stroke(RdC.pink, style: StrokeStyle(lineWidth: 2, dash: [6])).frame(width: 90, height: 90).overlay(RdIcon(name: imgBusy ? "loop" : "plus", size: 30, color: RdC.ras))
                        }
                    }
                    Spacer(minLength: 0)
                }.padding(.horizontal, 20)
                .onChange(of: picks) { _, items in
                    guard !items.isEmpty else { return }
                    imgBusy = true
                    Task {
                        for it in items { if imgKeys.count < 3, let d = try? await Media.load(it), let k = try? await Media.uploadSafe(d, kind: "gallery") { imgKeys.append(k) } }
                        picks = []; imgBusy = false
                    }
                }
                RdCard(tint: RdC.pale) { RdMuted(text: "Postcode " + st.postcode + ". Shown to carers within " + String(st.radius) + " km. Your street stays private.") }
                if !us.msg.isEmpty { Text(us.msg).font(RdF.body(13)).foregroundColor(RdC.ras).padding(.horizontal, 20) }
            }
            RdBottomBar { RdCta(title: busy ? "Posting" : "Post now", icon: "clock") {
                busy = true
                Task {
                    if await us.create(st, when: when, chip: chip, hrs: hrs, rate: rate, role: role.lowercased(), kids: kids, desc: desc, tags: tag, imgs: imgKeys) { st.go("urgentposted") }
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
                        RdMuted(text: String(m.applicants.count) + " applied. Tap to see questions and reply.")
                    }.onTapGesture { us.selected = m.id; st.go("urgentdetail") }
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
            RdBottomBar { RdCta(title: "Finish") { RdLive.saveSetup(st); st.root("carhome") } }
        }
    }
}

// ----- live deck -----
struct RdLivePerson: Identifiable {
    var p: Person
    var km: Double
    var rank: Int
    var score: Int = 0
    var why: [String] = []
    var coord: CLLocationCoordinate2D? = nil
    var id: String { p.id }
    var label: String { score >= 90 ? "Perfect Pair" : (score >= 80 ? "Great match" : "Good match") }
}

extension RdLive {
    /// Match score. Distance, shared care type, budget and language. Visa never counts.
    static func score(me: Person, p: Person, km: Double, radius: Int) -> (Int, [String]) {
        var s = 55
        var why: [String] = []
        let mine = Set(me.services), theirs = Set(p.services)
        if !mine.isDisjoint(with: theirs) { s += 15; why.append("You both want " + (mine.intersection(theirs).first ?? "").replacingOccurrences(of: "_", with: " ")) }
        if km >= 0 { s += Int(15 * max(0, 1 - km / Double(max(radius, 1)))); why.append("Only " + Geo.label(km) + " away, inside your " + String(radius) + " km") } else { s += 8 }
        if me.side == "family", p.rate > 0, me.budgetMax > 0 { if p.rate <= me.budgetMax { s += 10; why.append("Rate fits your budget") } }
        else if me.side == "carer", me.rate > 0, p.budgetMax > 0 { if me.rate <= p.budgetMax { s += 10; why.append("Their budget fits your rate") } }
        else { s += 5 }
        let lang = Set(me.languages).intersection(Set(p.languages))
        if let l = lang.first { s += 5; why.append("You both speak " + l) }
        return (min(99, s), why)
    }

    /// Real people inside my radius, country picks first for au pairs, then best score.
    static func people(_ st: RdStore, world: Bool = false, types: [String]? = nil) async -> [RdLivePerson] {
        guard let me = await me(st) else { return [] }
        var svc = me.services
        if me.side == "family" { svc = ["nanny", "babysitter", "au_pair"] }
        if svc.isEmpty { svc = [careType(st.pickedCare)] }
        if let t = types, !t.isEmpty { svc = t }
        let found = await Backend.discover(me: me, services: svc)
        let o = await origin(st)
        var out: [RdLivePerson] = []
        for p in found {
            let isAu = p.services.contains("au_pair")
            let dests = RdLive.dests(p)
            var km = -1.0
            var co: CLLocationCoordinate2D? = nil
            if world {
                let ctry = RdLive.country(p)
                co = await Geo.coord(postcode: p.postcode.count >= 4 ? p.postcode : ctry, country: ctry)
                if let o, let c = co { km = Geo.km(o, c) }
                let sc0 = score(me: me, p: p, km: km, radius: 20000)
                out.append(RdLivePerson(p: p, km: km, rank: 50, score: sc0.0, why: sc0.1, coord: co))
                continue
            }
            if !(isAu && me.side == "family") {
                let ctry = RdLive.country(p)
                co = await Geo.coord(postcode: p.postcode, country: ctry)
                if let o, let c = co { km = Geo.km(o, c) }
                if km > Double(st.radius) { continue }
            }
            if me.side == "family" && isAu {
                let visa = RdLive.visaOf(p)
                if st.visaOnly && visa != "Visa approved" && visa != "I live there already" { continue }
                if st.inCountryOnly && visa != "I live there already" { continue }
            }
            var rank = 50
            if isAu && me.side == "family" { rank = dests.firstIndex(of: st.country) ?? 9 }
            if me.side == "carer" && st.pickedCare == "aupair" {
                let c = RdLive.country(p)
                guard let idx = st.dests.firstIndex(of: c) else { continue }
                rank = idx
            }
            let sc = score(me: me, p: p, km: km, radius: st.radius)
            out.append(RdLivePerson(p: p, km: km, rank: rank, score: sc.0, why: sc.1, coord: co))
        }
        out.sort { $0.rank != $1.rank ? $0.rank < $1.rank : ($0.score != $1.score ? $0.score > $1.score : ($0.km < 0 ? 999 : $0.km) < ($1.km < 0 ? 999 : $1.km)) }
        return out
    }
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
        people = await RdLive.people(st)
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
        let dests = RdLive.dests(p)
        VStack(alignment: .leading, spacing: 8) {
            TabView {
                if keys.isEmpty { RdC.blush }
                ForEach(keys, id: \.self) { k in RdRemotePhoto(key: k).frame(maxWidth: .infinity).frame(height: 340).clipped() }
            }.tabViewStyle(.page).frame(height: 340).clipShape(RoundedRectangle(cornerRadius: 24))
            HStack(spacing: 12) {
                RdRing(pct: x.score, size: 70, line: 8)
                VStack(alignment: .leading, spacing: 3) {
                    Text(x.label).font(RdF.bold(12)).foregroundColor(.white).padding(.horizontal, 12).padding(.vertical, 3).background(RdC.ras).clipShape(Capsule())
                    Text(p.name).font(RdF.title(26)).foregroundColor(RdC.ink)
                }
                Spacer(minLength: 0)
            }
            HStack(spacing: 6) {
                if p.side == "family" { RdPill(role: "family") }
                else { RdPill(role: isAu ? "aupair" : (p.services.first ?? "nanny")) }
            }
            if isAu && x.rank == 0 { RdPlaceRibbon(text: "From " + (RdLive.fromOf(p)) + ". " + st.country + " is the first choice", icon: "globe") }
            else if isAu && !dests.isEmpty { RdPlaceRibbon(text: "From " + (RdLive.fromOf(p)) + ". Picked " + dests.joined(separator: ", "), icon: "globe") }
            else { RdPlaceRibbon(text: "Postcode " + p.postcode + (x.km >= 0 ? ", " + Geo.label(x.km) + " away" : "")) }
            if !p.headline.isEmpty { Text(p.headline).font(RdF.bold(16)).foregroundColor(RdC.ink) }
            if !p.about.isEmpty { Text(p.about).font(RdF.body(15)).foregroundColor(RdC.ink).fixedSize(horizontal: false, vertical: true) }
            RdFlow(spacing: 6) { ForEach(p.services, id: \.self) { RdChip(text: $0.replacingOccurrences(of: "_", with: " ").capitalized) } }
            ForEach(Array(x.why.prefix(3).enumerated()), id: \.offset) { _, w in RdReason(text: w) }
            HStack(spacing: 10) {
                RdCta(title: st.isFamily ? "Book " + p.firstName : "Say yes", icon: "calendar") { st.bookWith = p.id; st.bookName = p.firstName; st.bookRate = p.rate; st.go("book") }
                RdHeartButton(uid: p.id)
                RdMsgButton { Task { if await RdLive.openChat(st, otherUid: p.id) { st.go("chat") } } }
            }
        }.padding(14).background(Color.white).overlay(RoundedRectangle(cornerRadius: 28).stroke(RdC.line, lineWidth: 1)).padding(.horizontal, 12)
        .onTapGesture { st.viewing = x; st.go("person") }
    }
}

// ----- live chat and inbox -----
struct RdLiveInbox: View {
    @EnvironmentObject var st: RdStore
    @State private var rows: [(Relationship, Person)] = []
    @State private var loaded = false
    var body: some View {
        VStack(spacing: 0) {
            HStack { Text("Messages").font(RdF.title(26)).foregroundColor(RdC.ink); Spacer() }.padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 8)
            RdScroll {
                RdHeartsBanner()
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
