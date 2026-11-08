import SwiftUI

struct DiscoverView: View {
    @EnvironmentObject var s: Session
    @State private var people: [Person] = []
    @State private var saved: Set<String> = []
    @State private var loaded = false
    @State private var filter = "all"
    @State private var onlySaved = false

    var role: Role { s.role }
    var services: [String] { s.me?.services ?? [] }
    var shown: [Person] {
        people.filter { (filter == "all" || $0.services.contains(filter)) && (!onlySaved || saved.contains($0.id)) }
    }
    var title: String { role == .family ? "Find care" : role.greeting }

    @State private var skipped: Set<String> = []
    @State private var detail: Person?
    @State private var drag: CGSize = .zero
    @State private var deckContact: (person: Person, mode: ContactMode)?
    var deck: [Person] { let base = shown.filter { !skipped.contains($0.id) }; guard let me = s.me else { return base }; return base.sorted { $0.match(with: me).percent > $1.match(with: me).percent } }

    var body: some View {
        NavigationStack {
            VStack(spacing: 10) {
                HStack {
                    Text(title).font(Brand.title(30)).foregroundStyle(Brand.ink)
                    Spacer()
                    Button { onlySaved.toggle(); skipped = [] } label: { Image(systemName: onlySaved ? "heart.fill" : "heart").font(.title2).foregroundStyle(Brand.bunny).padding(10).background(Brand.field).clipShape(Circle()) }.accessibilityLabel("Saved")
                }.padding(.horizontal, 20).padding(.top, 8)
                if role == .family && services.count > 1 {
                    ScrollView(.horizontal, showsIndicators: false) { HStack {
                        Button { filter = "all"; skipped = [] } label: { Chip(text: "All", on: filter == "all", tint: role.tint) }
                        ForEach(services, id: \.self) { sv in Button { filter = sv; skipped = [] } label: { Chip(text: (serviceLabels[sv] ?? sv) + "s", on: filter == sv, tint: role.tint) } }
                    }.padding(.horizontal, 20) }
                }
                ZStack {
                    if !loaded { ProgressView() }
                    else if deck.isEmpty {
                        VStack(spacing: 10) {
                            BunnyView(size: 80)
                            Text(onlySaved ? "No hearts yet" : "You saw everyone").font(.headline).foregroundStyle(Brand.muted)
                            if !skipped.isEmpty { Button { skipped = [] } label: { Label("See again", systemImage: "arrow.counterclockwise") }.buttonStyle(.bordered) }
                        }
                    }
                    ForEach(Array(deck.prefix(3).enumerated().reversed()), id: \.element.id) { i, p in
                        SwipeCard(person: p, tint: role.tint, top: i == 0, offset: i == 0 ? drag : .zero, depth: i, match: s.me.map { p.match(with: $0) })
                            .gesture(i == 0 ? DragGesture()
                                .onChanged { drag = $0.translation }
                                .onEnded { v in
                                    if abs(v.translation.width) > 110 { fling(p, like: v.translation.width > 0) }
                                    else { withAnimation(.spring()) { drag = .zero } }
                                } : nil)
                            .onTapGesture { if i == 0 { detail = p } }
                            .accessibilityIdentifier(i == 0 ? "topCard" : "card\(i)")
                    }
                }.padding(.horizontal, 20).frame(maxHeight: .infinity)
                HStack(spacing: 14) {
                    roundBtn("xmark", .gray, "Skip") { if let p = deck.first { fling(p, like: false) } }
                    roundBtn("bubble.left.fill", Brand.ink, "Message") { if let p = deck.first { deckContact = (p, .message) } }
                    if s.me?.side == "carer" { roundBtn("doc.text.fill", Brand.ink, "Send resume") { if let p = deck.first { deckContact = (p, .resume) } } }
                    roundBtn("info", Brand.ink, "Details") { detail = deck.first }
                    roundBtn("heart.fill", Brand.bunny, "Like") { if let p = deck.first { fling(p, like: true) } }
                }.padding(.bottom, 8)
            }
            .background(Brand.cream.ignoresSafeArea()).refreshable { await load() }.task { await load() }
            .sheet(isPresented: Binding(get: { deckContact != nil }, set: { if !$0 { deckContact = nil } })) { if let d = deckContact { ContactSheet(person: d.person, mode: d.mode) } }
            .navigationDestination(item: $detail) { p in PersonDetailView(person: p, saved: saved.contains(p.id)) { on in if on { saved.insert(p.id) } else { saved.remove(p.id) } } }
        }
    }
    func roundBtn(_ icon: String, _ c: Color, _ label: String, _ f: @escaping () -> Void) -> some View {
        Button(action: f) { Image(systemName: icon).font(.system(size: 22, weight: .bold)).foregroundStyle(c).frame(width: 56, height: 56).background(.white).clipShape(Circle()).shadow(color: .black.opacity(0.12), radius: 8, y: 3) }.accessibilityLabel(label)
    }
    func fling(_ p: Person, like: Bool) {
        withAnimation(.easeIn(duration: 0.22)) { drag = CGSize(width: like ? 700 : -700, height: 40) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.23) {
            if like, let me = s.me { saved.insert(p.id); Task { await Backend.setSaved(me.id, p.id, true) } }
            if !onlySaved || !like { skipped.insert(p.id) }
            drag = .zero
        }
    }
    func load() async {
        guard let me = s.me else { return }
        async let list = Backend.discover(me: me, services: me.services)
        async let sv = Backend.savedIds(me.id)
        people = await list; saved = await sv; loaded = true
    }
}

struct PersonRow: View {
    let person: Person; let saved: Bool; let tint: Color
    @State private var verified: String?
    @State private var rating: (avg: Double, count: Int)?
    var body: some View {
        Card {
            HStack(spacing: 14) {
                PhotoView(key: person.photoKey, size: 72, fallback: person.role.emoji)
                VStack(alignment: .leading, spacing: 4) {
                    HStack { Text(person.firstName).font(.title3.bold()).foregroundStyle(Brand.ink); if verified != nil { Text("✔️ Checked").font(.caption.bold()).padding(.horizontal, 6).padding(.vertical, 2).background(Brand.sage.opacity(0.5)).clipShape(Capsule()) } ; Spacer(); if saved { Text("❤️") } }
                    if person.side == "carer" {
                        if !person.headline.isEmpty { Text(person.headline).font(.subheadline).foregroundStyle(Brand.muted).lineLimit(2) }
                        HStack(spacing: 10) { Text(person.role.emoji + " " + person.role.name); if person.rate > 0 { Text("💲\(Int(person.rate))/h") }; if person.years > 0 { Text("⭐ \(person.years)y") } }.font(.footnote)
                        if let r = rating { Text("★ \(String(format: "%.1f", r.avg)) (\(r.count))").font(.footnote).foregroundStyle(.orange) }
                    } else {
                        Text(person.suburb.isEmpty ? "Family" : person.suburb).font(.subheadline).foregroundStyle(Brand.muted)
                        HStack(spacing: 10) { Text(person.services.map { serviceLabels[$0] ?? $0 }.joined(separator: " · ")); if person.budgetMax > 0 { Text("💲up to \(Int(person.budgetMax))/h") } }.font(.footnote)
                        if !person.kids.isEmpty { Text("👶 " + person.kids.map { "\($0.name.isEmpty ? "Child" : $0.name) \($0.age)" }.joined(separator: ", ")).font(.footnote) }
                    }
                    if !person.days.isEmpty { Text(person.days.joined(separator: " ")).font(.caption).foregroundStyle(tint) }
                }
            }
        }.task { if person.side == "carer" { verified = await Backend.verifiedLevel(person.id); rating = await Backend.reviewSummary(person.id) } }
    }
}

struct PersonDetailView: View {
    @EnvironmentObject var s: Session
    let person: Person; @State var saved: Bool; var onSave: (Bool) -> Void
    @State private var verified: String?; @State private var resume: Resume?
    @State private var reviews: [(rating: Int, text: String)] = []
    @State private var showBook = false
    @State private var contact: ContactMode?
    @State private var rating: (avg: Double, count: Int)?
    var role: Role { s.role }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                PhotoView(key: person.photoKey, size: 150, fallback: person.role.emoji).padding(.top, 10)
                Text(person.name).font(Brand.title(30)).foregroundStyle(Brand.ink)
                if person.side == "carer" {
                    if !person.headline.isEmpty { Text(person.headline).font(.title3).foregroundStyle(Brand.muted).multilineTextAlignment(.center) }
                    HStack { Chip(text: person.role.emoji + " " + person.role.name, on: true, tint: person.role.tint); if person.rate > 0 { Chip(text: "💲\(Int(person.rate))/h") }; if person.years > 0 { Chip(text: "⭐ \(person.years) yrs") } }
                }
                Card { VStack(alignment: .leading, spacing: 8) {
                    Text("Checks").font(.headline)
                    if let v = verified { Text("✔️ Checked: \(v.capitalized)") } else { Text("🔍 Not checked yet").font(.subheadline).foregroundStyle(Brand.muted) }
                } }
                if !person.about.isEmpty { Card { VStack(alignment: .leading) { Text("About").font(.headline); Text(person.about) } } }
                if !person.languages.isEmpty { Card { VStack(alignment: .leading) { Text("🗣️ Languages").font(.headline); Text(person.languages.joined(separator: ", ")) } } }
                if !person.days.isEmpty { Card { VStack(alignment: .leading) { Text("📅 Days").font(.headline); Text(person.days.joined(separator: " · ")) } } }
                if let r = resume, !r.isEmpty { Card { VStack(alignment: .leading, spacing: 6) {
                    Text("📄 Resume").font(.headline)
                    ForEach(r.jobs, id: \.self) { Text("• " + $0).font(.subheadline) }
                    if !r.skills.isEmpty { Text("Skills: " + r.skills.joined(separator: ", ")).font(.subheadline) }
                    if !r.certificates.isEmpty { Text("Certificates they list: " + r.certificates.joined(separator: "; ")).font(.subheadline) }
                    Text("Their own words. Not checked.").font(.caption).foregroundStyle(Brand.muted)
                } } }
                if person.side == "carer" { Card { VStack(alignment: .leading, spacing: 6) {
                    Text("⭐ Reviews").font(.headline)
                    if let r = rating { Text("\(String(format: "%.1f", r.avg)) out of 5 from \(r.count)").foregroundStyle(.orange) }
                    if reviews.isEmpty { Text("No reviews yet").font(.subheadline).foregroundStyle(Brand.muted) }
                    ForEach(reviews.indices, id: \.self) { i in Text(String(repeating: "★", count: reviews[i].rating) + (reviews[i].text.isEmpty ? "" : "  " + reviews[i].text)).font(.subheadline) }
                } } }
                if role == .family && person.side == "carer" { BigButton(title: "📅 Book \(person.firstName)", tint: role.tint) { showBook = true } }
                else if person.side == "family" { Text("Families book you. You say yes.").font(.footnote).foregroundStyle(Brand.muted) }
                HStack(spacing: 10) {
                    Button { contact = .message } label: { Label("Message", systemImage: "bubble.left.fill").font(.system(size: 17, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 48).background(Brand.field).foregroundStyle(Brand.ink).clipShape(RoundedRectangle(cornerRadius: 14)) }
                    if s.me?.side == "carer" && person.side == "family" { Button { contact = .resume } label: { Label("Send resume", systemImage: "doc.text.fill").font(.system(size: 17, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 48).background(Brand.field).foregroundStyle(Brand.ink).clipShape(RoundedRectangle(cornerRadius: 14)) } }
                }
            }.padding(20).padding(.bottom, 100)
        }
        .background(Brand.cream.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { saved.toggle(); onSave(saved); if let u = s.uid { Task { await Backend.setSaved(u, person.id, saved) } } } label: { Image(systemName: saved ? "heart.fill" : "heart").foregroundStyle(.pink) } } }
        .sheet(isPresented: $showBook) { BookSheet(carer: person) }
        .sheet(item: $contact) { ContactSheet(person: person, mode: $0) }
        .task {
            if person.side == "carer" { verified = await Backend.verifiedLevel(person.id); reviews = await Backend.reviewsFor(carer: person.id); rating = await Backend.reviewSummary(person.id); resume = await Backend.loadResume(person.id) }
        }
    }
}

struct BookSheet: View {
    @EnvironmentObject var s: Session
    @Environment(\.dismiss) var dismiss
    let carer: Person
    @State private var date = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    @State private var from = Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: Date())!
    @State private var to = Calendar.current.date(bySettingHour: 13, minute: 0, second: 0, of: Date())!
    @State private var note = ""; @State private var busy = false; @State private var err = ""; @State private var done = false
    var f: DateFormatter { let x = DateFormatter(); x.dateFormat = "HH:mm"; x.locale = Locale(identifier: "en_US_POSIX"); return x }
    var hours: Double { Backend.hours(from: f.string(from: from), to: f.string(from: to)) }
    var body: some View {
        NavigationStack {
            ScrollView { VStack(spacing: 14) {
                if done {
                    BunnyView(size: 120); Text("Request sent! 🎉").font(Brand.title(28))
                    Text("\(carer.firstName) will reply soon. Chat opens after a yes.").multilineTextAlignment(.center)
                    BigButton(title: "Done", tint: s.role.tint) { dismiss() }
                } else {
                    HStack { PhotoView(key: carer.photoKey, size: 56, fallback: carer.role.emoji); Text("Book \(carer.firstName)").font(Brand.title(24)); Spacer() }
                    Card { VStack(alignment: .leading) {
                        DatePicker("Day", selection: $date, in: Date()..., displayedComponents: .date)
                        DatePicker("From", selection: $from, displayedComponents: .hourAndMinute)
                        DatePicker("To", selection: $to, displayedComponents: .hourAndMinute)
                    } }
                    Card { VStack(alignment: .leading, spacing: 4) {
                        Text("💲 \(Int(carer.rate)) per hour × \(String(format: "%.1f", hours)) h").font(.subheadline)
                        Text("About $\(Int(carer.rate * hours))").font(.title2.bold())
                        Text("Free to cancel up to 24 hours before.").font(.caption).foregroundStyle(Brand.muted)
                    } }
                    TextField("Note (optional)", text: $note, axis: .vertical).lineLimit(3...5).padding(14).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
                    if !err.isEmpty { Text(err).foregroundStyle(.red) }
                    BigButton(title: "Send request", tint: s.role.tint, busy: busy) { Task { await send() } }
                }
            }.padding(20) }
            .background(Brand.cream.ignoresSafeArea()).toolbar { ToolbarItem(placement: .topBarLeading) { Button("Close") { dismiss() } } }
        }
    }
    func send() async {
        guard let uid = s.uid else { return }
        busy = true; err = ""; defer { busy = false }
        let day = Booking.fmt.string(from: date)
        do { try await Backend.createBooking(familyUid: uid, carerUid: carer.id, date: day, from: f.string(from: from), to: f.string(from: to), rate: carer.rate, note: note); done = true }
        catch { err = error.localizedDescription.contains("permission") ? "Please finish your profile first, then try again." : error.localizedDescription }
    }
}

struct SwipeCard: View {
    let person: Person; let tint: Color; let top: Bool; let offset: CGSize; let depth: Int; var match: MatchInfo? = nil
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            RoundedRectangle(cornerRadius: 28).fill(person.role == .family ? Brand.blush.opacity(0.4) : Brand.sage.opacity(0.35))
            PhotoView(key: person.photoKey, size: 260, round: false, fallback: person.role.emoji, fill: true).clipped().clipShape(RoundedRectangle(cornerRadius: 28))
            LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .center, endPoint: .bottom).clipShape(RoundedRectangle(cornerRadius: 28))
            VStack(alignment: .leading, spacing: 6) {
                Text(person.firstName).font(.system(size: 32, weight: .bold, design: .serif))
                HStack(spacing: 12) {
                    Label(person.role.name, systemImage: "figure.and.child.holdinghands")
                    if person.rate > 0 { Label("\(Int(person.rate))/h", systemImage: "dollarsign.circle") }
                    else if person.budgetMax > 0 { Label("\(Int(person.budgetMax))/h", systemImage: "dollarsign.circle") }
                    if !person.suburb.isEmpty { Label(person.suburb, systemImage: "mappin.circle") }
                }.font(.subheadline.weight(.semibold)).lineLimit(1)
                if let mt = match { HStack(spacing: 8) { ForEach(Array(mt.reasons.enumerated()), id: \.offset) { _, r in Label(r.text, systemImage: r.icon).font(.caption.weight(.semibold)).lineLimit(1).padding(.horizontal, 10).padding(.vertical, 5).background(.white.opacity(0.25)).clipShape(Capsule()) } } }
            }.foregroundStyle(.white).padding(20)
            if let mt = match { Text("\(mt.percent)%").font(.system(size: 17, weight: .heavy)).foregroundStyle(Brand.ink).padding(.horizontal, 12).padding(.vertical, 6).background(.white).clipShape(Capsule()).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(16).opacity(top && abs(offset.width) > 60 ? 0 : 1) }
            if top {
                Text("LIKE").font(.system(size: 34, weight: .heavy)).foregroundStyle(.green).padding(8).overlay(RoundedRectangle(cornerRadius: 10).stroke(.green, lineWidth: 4)).rotationEffect(.degrees(-14)).opacity(max(0, min(1, Double(offset.width) / 100))).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(26)
                Text("SKIP").font(.system(size: 34, weight: .heavy)).foregroundStyle(.red).padding(8).overlay(RoundedRectangle(cornerRadius: 10).stroke(.red, lineWidth: 4)).rotationEffect(.degrees(14)).opacity(max(0, min(1, Double(-offset.width) / 100))).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(26)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .shadow(color: .black.opacity(0.15), radius: 12, y: 6)
        .scaleEffect(1 - CGFloat(depth) * 0.05).offset(y: CGFloat(depth) * 14)
        .offset(x: offset.width, y: offset.height / 4).rotationEffect(.degrees(Double(offset.width) / 18))
    }
}
