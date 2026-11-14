import SwiftUI
import CoreLocation

/// The urgent board (Build 181 item 4, spec URGENT-BOARD-SPEC-2026-11-12).
/// The Browse | Urgent switch lives on the deck screen; this file is the Urgent side.
/// Family: post in one short screen, watch the yes list, pick a carer, the post fills.
/// Carer: posts as swipe cards, soonest first; swipe right says yes and opens the chat at once (chat first).
/// Expiry is read time: a post whose start has passed never shows to carers.
enum UrgentFmt {
    static func whenText(_ d: Date) -> String {
        let cal = Calendar.current
        let t = DateFormatter(); t.dateFormat = "h:mm a"; t.locale = Locale(identifier: "en_AU")
        if cal.isDateInToday(d) { return "Today, " + t.string(from: d) }
        if cal.isDateInTomorrow(d) { return "Tomorrow, " + t.string(from: d) }
        let f = DateFormatter(); f.dateFormat = "EEE d MMM"; f.locale = Locale(identifier: "en_AU")
        return f.string(from: d) + ", " + t.string(from: d)
    }
}

struct UrgentBoardView: View {
    @EnvironmentObject var s: Session
    var body: some View {
        if s.me?.side == "family" { UrgentFamilyView() } else { UrgentCarerView() }
    }
}

// MARK: Family side

struct UrgentFamilyView: View {
    @EnvironmentObject var s: Session
    @State private var jobs: [UrgentJob] = []
    @State private var loaded = false
    @State private var showForm = false
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            BigButton(title: "Post an urgent need", tint: Brand.bunny, icon: .clock) { showForm = true }.accessibilityIdentifier("postUrgent")
            if !loaded { ProgressView().padding(20) }
            else if jobs.isEmpty { EmptyHint(icon: .clock, text: "No urgent posts yet") }
            ForEach(jobs) { j in UrgentPostRow(job: j) { Task { await load() } } }
        }.padding(.horizontal, 20).padding(.bottom, 20) }
        .sheet(isPresented: $showForm) { UrgentPostForm { showForm = false; Task { await load() } } }
        .task { await load() }
    }
    func load() async { guard let uid = s.uid else { return }; jobs = await Backend.myJobs(uid); loaded = true }
}

struct UrgentPostRow: View {
    @EnvironmentObject var s: Session
    let job: UrgentJob
    var onChange: () -> Void = {}
    @State private var yeses: [Person] = []
    @State private var checks: [String: String] = [:]
    @State private var dist: [String: String] = [:]
    @State private var pickedPerson: Person?
    @State private var chatWith: Person?
    @State private var busy = false
    var stateLabel: String {
        if job.state == "filled" { return "Filled" }
        if job.state == "closed" { return "Closed" }
        return job.ended ? "Ended" : "Open"
    }
    var body: some View {
        Card { VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                ZStack { Circle().fill(Brand.bunny).frame(width: 34, height: 34); BrandIcon(kind: .clock, size: 19, color: Color(hex: 0x2D2A35), mono: true) }
                VStack(alignment: .leading, spacing: 1) {
                    Text(UrgentFmt.whenText(job.when)).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)).foregroundStyle(Brand.ink)
                    Text(job.dayParts.joined(separator: " · ")).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
                }
                Spacer()
                Text(stateLabel).font(.footnote.weight(.bold)).padding(.horizontal, 10).padding(.vertical, 4)
                    .background(job.state == "open" && !job.ended ? Brand.bunny : Brand.field).foregroundStyle(Color(hex: 0x2D2A35)).clipShape(Capsule())
            }
            if !job.note.isEmpty { Text(job.note).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)) }
            if !job.bands.isEmpty { IconLabel(icon: .child, text: "Kids: " + job.bands.map(bandLabel).joined(separator: ", "), size: 15) }
            if job.state == "filled" {
                HStack(spacing: 8) { BrandIcon(kind: .checkCircle, size: 18, color: Brand.ink); Text("Filled by \(pickedPerson?.firstName ?? "your pick")").font(.subheadline.weight(.semibold)) }
            } else if job.state == "open" && !job.ended {
                if yeses.isEmpty { Text("No one has said yes yet").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted) }
                ForEach(yeses) { p in
                    HStack(spacing: 10) {
                        PhotoView(key: p.photoKey, size: 44, fallback: p.role.icon)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(p.firstName).font(.subheadline.weight(.semibold))
                            Text(checks[p.id] ?? "").font(.custom("Atkinson Hyperlegible", size: 12, relativeTo: .caption)).foregroundStyle(Brand.muted)
                            if let d = dist[p.id] { Text(d).font(.custom("Atkinson Hyperlegible", size: 12, relativeTo: .caption)).foregroundStyle(Brand.muted) }
                        }
                        Spacer()
                        Button("Chat") { chatWith = p }.font(.subheadline.weight(.semibold)).foregroundStyle(Brand.ink)
                            .padding(.horizontal, 12).padding(.vertical, 8).background(Brand.field).clipShape(Capsule()).accessibilityIdentifier("yesChat-\(p.id)")
                        Button("Pick this carer") { Task { await pick(p) } }.font(.subheadline.weight(.bold)).foregroundStyle(Color(hex: 0x2D2A35))
                            .padding(.horizontal, 12).padding(.vertical, 8).background(Brand.bunny).clipShape(Capsule()).accessibilityIdentifier("pickCarer-\(p.id)")
                    }
                }
                Button("Close this post") { Task { await close() } }.font(.footnote.weight(.semibold)).foregroundStyle(Brand.muted).accessibilityIdentifier("closePost")
            }
        } }
        .sheet(item: $chatWith) { p in ContactSheet(person: p, mode: .message) }
        .task { await loadYeses() }
    }
    func loadYeses() async {
        if job.state == "filled" { pickedPerson = await Backend.loadProfile(job.carerUid) }
        guard job.state == "open", !job.ended else { return }
        let ids = await Backend.jobYeses(job.id)
        let people = await Backend.loadProfiles(ids)
        yeses = ids.compactMap { people[$0] }
        let mine = await Geo.coord(postcode: job.postcode)
        for p in yeses {
            if let v = await Backend.verifiedLevel(p.id) { checks[p.id] = "Checked: \(v.capitalized)" } else { checks[p.id] = "Not checked yet" }
            if let mine, let theirs = await Geo.coord(postcode: p.postcode) { dist[p.id] = Geo.label(Geo.km(mine, theirs)) }
        }
    }
    func pick(_ p: Person) async {
        guard !busy else { return }; busy = true; defer { busy = false }
        try? await Backend.pickCarer(job: job, carerUid: p.id)
        onChange()
    }
    func close() async {
        try? await Backend.closeJob(job)
        onChange()
    }
}

struct UrgentPostForm: View {
    @EnvironmentObject var s: Session
    @Environment(\.dismiss) var dismiss
    var onPosted: () -> Void = {}
    @State private var day = Date()
    @State private var start = Date()
    @State private var parts: Set<String> = []
    @State private var postcode = ""
    @State private var bandsOn: Set<String> = []
    @State private var note = ""
    @State private var busy = false; @State private var err = ""
    let partNames = ["Morning", "Afternoon", "Evening", "Night"]
    var when: Date {
        let cal = Calendar.current
        let d = cal.dateComponents([.year, .month, .day], from: day)
        let t = cal.dateComponents([.hour, .minute], from: start)
        var c = DateComponents(); c.year = d.year; c.month = d.month; c.day = d.day; c.hour = t.hour; c.minute = t.minute
        return cal.date(from: c) ?? day
    }
    var body: some View {
        NavigationStack {
            ScrollView { VStack(spacing: 14) {
                Text("Post an urgent need").font(Brand.title(26)).foregroundStyle(Brand.titleColor)
                Card { VStack(alignment: .leading, spacing: 10) {
                    DatePicker("Day", selection: $day, in: Date()..., displayedComponents: .date).accessibilityIdentifier("jobDay")
                    DatePicker("Starts at", selection: $start, displayedComponents: .hourAndMinute).accessibilityIdentifier("jobStart")
                    HStack(spacing: 8) {
                        Button("Today") { day = Date() }.font(.subheadline.weight(.semibold))
                        Button("Tonight") { day = Date(); parts = ["Evening"]; var c = DateComponents(); c.hour = 18; c.minute = 0; start = Calendar.current.date(from: c) ?? start }.font(.subheadline.weight(.semibold))
                        Button("Tomorrow") { day = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? day }.font(.subheadline.weight(.semibold))
                    }
                } }
                Card { VStack(alignment: .leading, spacing: 8) {
                    Text("How long").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                    HStack(spacing: 8) { ForEach(partNames, id: \.self) { p in
                        Button { if parts.contains(p) { parts.remove(p) } else { parts.insert(p) } } label: { Chip(text: p, on: parts.contains(p)) }.accessibilityIdentifier("part-\(p)").accessibilityValue(parts.contains(p) ? "ticked" : "not ticked")
                    } }
                } }
                Card { VStack(alignment: .leading, spacing: 8) {
                    Text("Where").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                    TextField("Postcode", text: $postcode).keyboardType(.numberPad).padding(12).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("jobPostcode")
                    if let me = s.me, !me.kids.isEmpty {
                        IconLabel(icon: .child, text: me.kids.map { "\($0.name.isEmpty ? "Child" : $0.name) \($0.age)" }.joined(separator: ", "), size: 15)
                    }
                    Text("Age bands").font(.subheadline.bold())
                    HStack(spacing: 8) { ForEach(ageBands, id: \.key) { b in
                        Button { if bandsOn.contains(b.key) { bandsOn.remove(b.key) } else { bandsOn.insert(b.key) } } label: { Chip(text: b.label, on: bandsOn.contains(b.key)) }.accessibilityIdentifier("band-\(b.key)").accessibilityValue(bandsOn.contains(b.key) ? "ticked" : "not ticked")
                    } }
                } }
                TextField("Note, in your words (pay too, if you like)", text: $note, axis: .vertical).lineLimit(3...5).padding(14).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("jobNote")
                if !err.isEmpty { Text(err).foregroundStyle(Brand.ink).font(.custom("Atkinson Hyperlegible", size: 16, relativeTo: .callout)) }
                BigButton(title: "Post it", tint: Brand.bunny, busy: busy) { Task { await post() } }.accessibilityIdentifier("postJob")
            }.padding(20) }
            .background(Brand.cream.ignoresSafeArea())
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Close") { dismiss() } } }
            .onAppear {
                if postcode.isEmpty { postcode = s.me?.postcode ?? "" }
                if bandsOn.isEmpty, let me = s.me { bandsOn = Set(me.kids.map { bandKey(forAge: $0.age) }) }
            }
        }
    }
    func post() async {
        guard let uid = s.uid else { return }
        if parts.isEmpty { err = "Pick how long: morning, afternoon, evening or night."; return }
        if bandsOn.isEmpty { err = "Tick at least one age band."; return }
        busy = true; err = ""; defer { busy = false }
        do {
            try await Backend.createJob(familyUid: uid, when: when, dayParts: partNames.filter { parts.contains($0) }, postcode: postcode.trimmingCharacters(in: .whitespaces), bands: ageBands.map { $0.key }.filter { bandsOn.contains($0) }, note: note)
            onPosted(); dismiss()
        } catch { err = "Could not post. Check your connection and try again." }
    }
}

// MARK: Carer side

struct UrgentCarerView: View {
    @EnvironmentObject var s: Session
    @AppStorage("caresits.urgentOn") private var urgentOn = true
    @AppStorage("caresits.urgentRadiusKm") private var urgentRadius = 25
    @State private var jobs: [UrgentJob] = []
    @State private var families: [String: Person] = [:]
    @State private var loaded = false
    @State private var acted: Set<String> = []
    @State private var drag: CGSize = .zero
    @State private var myCoord: CLLocationCoordinate2D?
    @State private var coords: [String: CLLocationCoordinate2D] = [:]
    @State private var chat: UrgentChat?
    @State private var err = ""
    struct UrgentChat: Identifiable { let rel: Relationship; let other: Person; var id: String { rel.id } }
    func km(_ j: UrgentJob) -> Double? {
        guard let a = myCoord else { return nil }
        if let la = j.lat, let ln = j.lng { return Geo.km(a, CLLocationCoordinate2D(latitude: la, longitude: ln)) }
        guard let b = coords[j.postcode.trimmingCharacters(in: .whitespaces)] else { return nil }
        return Geo.km(a, b)
    }
    /// Only posts inside the chosen distance show; a post whose place is unknown is kept, like the deck.
    var deck: [UrgentJob] {
        jobs.filter { j in !acted.contains(j.id) && (urgentRadius == 0 || (km(j).map { $0 <= Double(urgentRadius) } ?? true)) }
    }
    var body: some View {
        VStack(spacing: 10) {
            if !urgentOn {
                EmptyHint(icon: .clock, text: "Urgent posts are off. Turn them on in Settings.")
            } else if !loaded {
                ProgressView().frame(maxHeight: .infinity)
            } else if deck.isEmpty {
                VStack(spacing: 10) {
                    BunnyView(size: 80, mood: .rest)
                    Text("No urgent posts near you").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)).foregroundStyle(Brand.muted)
                }.frame(maxHeight: .infinity)
            } else {
                ZStack {
                    ForEach(Array(deck.prefix(2).enumerated().reversed()), id: \.element.id) { i, j in
                        UrgentJobCard(job: j, family: families[j.familyUid], distance: km(j))
                            .clipShape(RoundedRectangle(cornerRadius: 28)).contentShape(RoundedRectangle(cornerRadius: 28))
                            .gesture(i == 0 ? DragGesture(minimumDistance: 16)
                                .onChanged { drag = $0.translation }
                                .onEnded { v in
                                    if abs(v.translation.width) > 110 { fling(j, yes: v.translation.width > 0) }
                                    else { withAnimation(.spring()) { drag = .zero } }
                                } : nil)
                            .offset(x: i == 0 ? drag.width : 0, y: i == 0 ? drag.height / 4 : CGFloat(i) * 12)
                            .scaleEffect(1 - CGFloat(i) * 0.05)
                            .accessibilityIdentifier(i == 0 ? "urgentCard" : "urgentCard\(i)")
                    }
                }.padding(.horizontal, 20).frame(maxHeight: .infinity)
                HStack(spacing: 18) {
                    Button { if let j = deck.first { fling(j, yes: false) } } label: { BrandIcon(kind: .cross, size: 26, color: Brand.muted).frame(width: 56, height: 56).background(Brand.card).clipShape(Circle()).overlay(Circle().stroke(Color.black.opacity(0.1), lineWidth: 1)) }
                        .accessibilityLabel("Pass").accessibilityIdentifier("urgentPass")
                    Button { if let j = deck.first { fling(j, yes: true) } } label: { BrandIcon(kind: .check, size: 26, color: Color(hex: 0x2D2A35), solid: true).frame(width: 56, height: 56).background(Brand.bunny).clipShape(Circle()).overlay(Circle().stroke(Color.black.opacity(0.1), lineWidth: 1)) }
                        .accessibilityLabel("I can do this").accessibilityIdentifier("urgentYes")
                }.padding(.bottom, 8)
            }
            if !err.isEmpty { Text(err).font(.custom("Atkinson Hyperlegible", size: 12, relativeTo: .caption)).foregroundStyle(Brand.ink).padding(.horizontal, 20) }
        }
        .sheet(item: $chat) { c in
            NavigationStack { ChatView(rel: c.rel, other: c.other).toolbar { ToolbarItem(placement: .topBarLeading) { Button("Close") { chat = nil } } } }
        }
        .task { await load() }
    }
    func actedKey() -> String { "caresits.urgentActed.\(s.uid ?? "")" }
    func load() async {
        guard let me = s.me else { return }
        acted = Set(UserDefaults.standard.stringArray(forKey: actedKey()) ?? [])
        jobs = await Backend.openJobs()
        families = await Backend.loadProfiles(jobs.map { $0.familyUid })
        myCoord = await Geo.coord(postcode: me.postcode)
        var found: [String: CLLocationCoordinate2D] = [:]
        for pc in Set(jobs.map { $0.postcode.trimmingCharacters(in: .whitespaces) }) where !pc.isEmpty {
            if let c = await Geo.coord(postcode: pc) { found[pc] = c }
        }
        coords = found
        loaded = true
    }
    func fling(_ j: UrgentJob, yes: Bool) {
        withAnimation(.easeIn(duration: 0.22)) { drag = CGSize(width: yes ? 700 : -700, height: 40) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.23) {
            drag = .zero
            acted.insert(j.id)
            UserDefaults.standard.set(Array(acted), forKey: actedKey())
            if yes { Task { await sayYes(j) } }
        }
    }
    /// Swipe right: interest is written on the post AND the chat opens at once.
    func sayYes(_ j: UrgentJob) async {
        guard let me = s.me, let fam = families[j.familyUid] else { return }
        do {
            try await Backend.sayYes(job: j, carerUid: me.id)
            let rel = try await Backend.openChat(me: me, other: fam)
            chat = UrgentChat(rel: rel, other: fam)
        } catch { err = "That did not work: " + error.localizedDescription }
    }
}

struct UrgentJobCard: View {
    let job: UrgentJob
    let family: Person?
    var distance: Double? = nil
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            RoundedRectangle(cornerRadius: 28).fill(Brand.field)
            PhotoView(key: family?.photoKey ?? "", size: 260, round: false, fallback: .home, fill: true).clipped().clipShape(RoundedRectangle(cornerRadius: 28))
            LinearGradient(colors: [.clear, .black.opacity(0.8)], startPoint: .center, endPoint: .bottom).clipShape(RoundedRectangle(cornerRadius: 28))
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    ZStack { Circle().fill(Brand.bunny).frame(width: 30, height: 30); BrandIcon(kind: .clock, size: 17, color: Color(hex: 0x2D2A35), mono: true) }
                    Text(UrgentFmt.whenText(job.when)).font(.custom("Atkinson Hyperlegible", size: 16).weight(.bold))
                    Text(job.dayParts.joined(separator: " · ")).font(.subheadline.weight(.semibold))
                }
                Text(family?.firstName ?? "Family").font(Brand.title(30))
                HStack(spacing: 12) {
                    if let d = distance { IconLabel(icon: .pin, text: Geo.label(d), size: 15, color: .white) }
                    else if let sub = family?.suburb, !sub.isEmpty { IconLabel(icon: .pin, text: sub, size: 15, color: .white) }
                    if let f = family, !f.kids.isEmpty { IconLabel(icon: .child, text: "\(f.kids.count) kid\(f.kids.count == 1 ? "" : "s")", size: 15, color: .white) }
                }.font(.subheadline.weight(.semibold)).lineLimit(1)
                if !job.bands.isEmpty { Text("Ages: " + job.bands.map(bandLabel).joined(separator: ", ")).font(.footnote.weight(.semibold)) }
                if !job.note.isEmpty { Text(job.note).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)).lineLimit(3) }
            }.foregroundStyle(.white).padding(20)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
    }
}
