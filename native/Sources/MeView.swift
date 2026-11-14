import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import AuthenticationServices

struct MeView: View {
    @EnvironmentObject var s: Session
    @State private var pick: PhotosPickerItem?; @State private var galleryPick: [PhotosPickerItem] = []
    @State private var busy = false; @State private var err = ""; @State private var ok = ""
    @State private var showFamily = false
    @State private var showResume = false; @State private var showEdit = false
    @State private var rating: (avg: Double, count: Int)?; @State private var reviews: [(rating: Int, text: String)] = []
    var role: Role { s.role }
    var me: Person { s.me ?? Person(id: "", data: [:]) }

    var body: some View {
        if s.me == nil { Color.clear } else { content }
    }
    var content: some View {
        NavigationStack {
            ScrollView { VStack(spacing: 14) {
                Header(role: role, title: "Me", subtitle: role == .family ? "" : "Free for carers, always")
                PhotoProofBadge()
                PhotosPicker(selection: $pick, matching: .images) {
                    ZStack(alignment: .bottomTrailing) {
                        PhotoView(key: me.photoKey, size: 120, fallback: role.icon)
                        BrandIcon(kind: .camera, size: 20, color: role.tint).padding(8).background(Brand.card).clipShape(Circle()).overlay(Circle().stroke(Color.black.opacity(0.1), lineWidth: 1))
                        if busy { ProgressView() }
                    }
                }
                Text(me.name).font(Brand.title(26)).foregroundStyle(Brand.titleColor)
                if !ok.isEmpty { IconLabel(icon: .checkCircle, text: ok, size: 18, color: role.tint).foregroundStyle(role.tint).font(.custom("Atkinson Hyperlegible", size: 16, relativeTo: .callout)) }
                if !err.isEmpty { Text(err).foregroundStyle(Brand.ink).font(.custom("Atkinson Hyperlegible", size: 16, relativeTo: .callout)).multilineTextAlignment(.center) }

                NavigationLink { AskingView() } label: { row(.check, "What I am asking for", "Tick your picks") }.buttonStyle(.plain).padding(.horizontal, 20).accessibilityIdentifier("openAsking")
                NavigationLink { SettingsView() } label: { row(.settings, "Settings", "Look and bunny") }.buttonStyle(.plain).padding(.horizontal, 20).accessibilityIdentifier("openSettings")
                if me.side == "carer" && PayConfig.visible { GetPaidCard().padding(.horizontal, 20) }
                Card { VStack(alignment: .leading, spacing: 8) {
                    Text("My photos").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                    ScrollView(.horizontal, showsIndicators: false) { HStack {
                        ForEach(me.gallery, id: \.self) { k in PhotoView(key: k, size: 80, round: false) }
                        if me.gallery.count < 6 { PhotosPicker(selection: $galleryPick, maxSelectionCount: 6 - me.gallery.count, matching: .images) { ZStack { RoundedRectangle(cornerRadius: 16).fill(role.soft); BrandIcon(kind: .plus, size: 30, color: role.tint) }.frame(width: 80, height: 80) } }
                    } }
                } }.padding(.horizontal, 20)

                if me.side == "carer" {
                    Card { VStack(alignment: .leading, spacing: 8) {
                        IconLabel(icon: role.icon, text: "My \(role.name.lowercased()) profile", size: 20).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                        Text(me.headline.isEmpty ? "Add a headline" : me.headline)
                        IconLabel(icon: .check, text: me.completionText, size: 16, color: Brand.muted).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)).foregroundStyle(Brand.muted)
                        HStack(spacing: 12) { if me.rate > 0 { IconLabel(icon: .rate, text: "\(Int(me.rate))/h", size: 16, color: Brand.muted) }; if me.years > 0 { IconLabel(icon: .star, text: me.years == 1 ? "1 year" : "\(me.years) years", size: 16, color: Brand.muted) } }.font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)).foregroundStyle(Brand.muted)
                        if let r = rating { IconLabel(icon: .star, text: "\(String(format: "%.1f", r.avg)) from \(r.count) review\(r.count == 1 ? "" : "s")", size: 16, color: Brand.bunny).foregroundStyle(Brand.ink) }
                        else { Text("No reviews yet").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted) }
                        Button { showEdit = true } label: { IconLabel(icon: .pencil, text: "Edit") }
                    } }.padding(.horizontal, 20)
                    Button { showResume = true } label: { row(.doc, "My resume", "Add a file") }.buttonStyle(.plain).padding(.horizontal, 20)
                    ForEach(reviews.indices, id: \.self) { i in Card { HStack(spacing: 8) { Stars(count: reviews[i].rating); if !reviews[i].text.isEmpty { Text(reviews[i].text) } }.font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)) }.padding(.horizontal, 20) }
                } else {
                    Card { VStack(alignment: .leading, spacing: 6) {
                        IconLabel(icon: .home, text: "My family", size: 20).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                        if !me.postcode.isEmpty || !me.suburb.isEmpty { IconLabel(icon: .pin, text: [me.suburb, me.postcode].filter { !$0.isEmpty }.joined(separator: " "), size: 16) }
                        Text("Looking for: " + me.services.map { serviceLabels[$0] ?? $0 }.joined(separator: ", "))
                        if !me.kids.isEmpty { IconLabel(icon: .child, text: me.kids.map { "\($0.name) \($0.age)" }.joined(separator: ", "), size: 16) }
                        if me.budgetMax > 0 { IconLabel(icon: .rate, text: "Up to \(Int(me.budgetMax)) per hour", size: 16, color: Brand.muted).foregroundStyle(Brand.muted) }
                        Button { showFamily = true } label: { IconLabel(icon: .pencil, text: me.postcode.isEmpty && me.suburb.isEmpty ? "Finish my family details" : "Edit my family") }.accessibilityIdentifier("editFamily")
                    } }.padding(.horizontal, 20)
                }
                if me.side == "family" { FamilyRecordCard(me: me).padding(.horizontal, 20) }
                Card { VStack(alignment: .leading, spacing: 8) {
                    Text("Privacy").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                    IconLabel(icon: .lock, text: "Photos stay private until you connect", size: 14, color: Brand.muted).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
                    if s.role == .family { Text("Children's details are private.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted) }
                } }.padding(.horizontal, 20)
            }.padding(.bottom, 100) }
            .background(Brand.cream.ignoresSafeArea())
            .onChange(of: pick) { _, i in Task { await setAvatar(i) } }
            .onChange(of: galleryPick) { _, items in Task { await addGallery(items) } }
            .sheet(isPresented: $showResume) { ResumeEditor() }
            .sheet(isPresented: $showEdit) { ProfileEditor() }
            .sheet(isPresented: $showFamily) { FamilyEditor() }
            .onAppear { if s.goMyFamily { s.goMyFamily = false; showFamily = true } }
            .onChange(of: s.goMyFamily) { _, go in if go { s.goMyFamily = false; showFamily = true } }
            .task { if me.side == "carer" { rating = await Backend.reviewSummary(me.id); reviews = await Backend.reviewsFor(carer: me.id) } }
        }
    }
    func row(_ e: BI, _ t: String, _ sub: String) -> some View { Card { HStack { BrandIcon(kind: e, size: 34); VStack(alignment: .leading) { Text(t).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)).foregroundStyle(Brand.ink); Text(sub).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted) }; Spacer(); BrandIcon(kind: .chevron, size: 18, color: Brand.muted) } } }

    func setAvatar(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        busy = true; err = ""; ok = ""; defer { busy = false; pick = nil }
        do {
            let data = try await Media.load(item)
            let key = try await Media.uploadSafe(data, kind: "avatar")
            try await Backend.saveProfile(me.id, photoKey: key)
            await s.reload(); ok = "Photo saved"
        } catch { err = "Photo problem: " + error.localizedDescription }
    }
    func addGallery(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        busy = true; err = ""; ok = ""; defer { busy = false; galleryPick = [] }
        do {
            var keys = me.gallery
            var skipped = 0; var why = ""
            for it in items.prefix(6 - keys.count) {
                do { keys.append(try await Media.uploadSafe(try await Media.load(it), kind: "gallery")) }
                catch { skipped += 1; why = error.localizedDescription }
            }
            if keys.count > me.gallery.count { try await Backend.saveProfile(me.id, card: ["gallery": keys, "mainPhotoIndex": 0]); await s.reload() }
            if skipped > 0 { err = "\(skipped) photo(s) skipped. " + why } else { ok = "Photos saved" }
        } catch { err = "Photo problem: " + error.localizedDescription }
    }
}

struct ProfileEditor: View {
    @EnvironmentObject var s: Session; @Environment(\.dismiss) var dismiss
    @State private var headline = ""; @State private var intro = ""; @State private var years = 0; @State private var rate: Double = 30; @State private var err = ""; @State private var busy = false
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Text("Edit profile").font(Brand.title(26)).foregroundStyle(Brand.titleColor).padding(.top, 16)
            TextField("A few words about your care", text: $headline).padding(14).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
            TextEditor(text: $intro).frame(height: 120).padding(8).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
            Card { Stepper("Years of experience: \(years)", value: $years, in: 0...40) }
            Card { VStack(alignment: .leading) { Text("Rate: $\(Int(rate)) per hour"); Slider(value: $rate, in: 15...90, step: 1) } }
            if !err.isEmpty { Text(err).foregroundStyle(Brand.ink) }
            BigButton(title: "Save", tint: s.role.tint, busy: busy) { Task {
                busy = true; defer { busy = false }
                do { try await Backend.saveProfile((s.uid ?? ""), about: intro, card: ["headline": String(headline.prefix(80)), "experienceYears": years, "rate": rate]); await s.reload(); dismiss() } catch { err = "Could not save. Try again." }
            } }
        }.padding(20) }.background(Brand.cream.ignoresSafeArea())
        .onAppear { let m = s.meSafe; headline = m.headline; intro = m.about; years = m.years; rate = m.rate > 0 ? m.rate : 30 }
    }
}

struct ResumeEditor: View {
    @EnvironmentObject var s: Session; @Environment(\.dismiss) var dismiss
    @State private var r = Resume(); @State private var showFile = false; @State private var msg = ""; @State private var busy = false
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            BunnyView(size: 80, mood: .think).padding(.top, 16)
            Text("My resume").font(Brand.title(26)).foregroundStyle(Brand.titleColor)
            BigButton(title: "Choose a resume file", tint: s.role.tint, icon: .doc) { showFile = true }
            IconLabel(icon: .lock, text: "Read on your phone only", size: 14, color: Brand.muted).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
            if !msg.isEmpty { Text(msg).font(.custom("Atkinson Hyperlegible", size: 16, relativeTo: .callout)) }
            editor("About you", Binding(get: { r.summary }, set: { r.summary = $0 }))
            LinesEditor(title: "Work (one per line)", items: $r.jobs); LinesEditor(title: "Study (one per line)", items: $r.education); LinesEditor(title: "Skills (one per line)", items: $r.skills); LinesEditor(title: "Certificates you list (one per line)", items: $r.certificates)
            Text("Your own words. Not checked.").font(.custom("Atkinson Hyperlegible", size: 12, relativeTo: .caption)).foregroundStyle(Brand.muted)
            BigButton(title: "Save resume", tint: s.role.tint, busy: busy) { Task {
                busy = true; defer { busy = false }
                do { try await Backend.saveResume((s.uid ?? ""), r)
                    let y = ResumeParser.years(r)
                    var card: [String: Any] = [:]; if y > 0 { card["experienceYears"] = y }
                    if s.me?.headline.isEmpty == true { let h = ResumeParser.headline(r); if !h.isEmpty { card["headline"] = h } }
                    try? await Backend.saveProfile((s.uid ?? ""), about: s.me?.about.isEmpty == true ? String(r.summary.prefix(300)) : nil, card: card)
                    await s.reload(); dismiss() } catch { msg = "Could not save. Try again." }
            } }
        }.padding(20) }.background(Brand.cream.ignoresSafeArea())
        .fileImporter(isPresented: $showFile, allowedContentTypes: [.pdf, .plainText]) { res in
            do { let p = ResumeParser.parse(try ResumeParser.text(from: try res.get())); if p.isEmpty { throw AppError.msg("We found no work or skills in that file.") }; r = p; msg = "Done. Check it, then save." } catch { msg = error.localizedDescription }
        }
        .task { if let x = await Backend.loadResume((s.uid ?? "")) { r = x } }
    }
    func editor(_ t: String, _ b: Binding<String>) -> some View { VStack(alignment: .leading) { Text(t).font(.subheadline.bold()); TextEditor(text: b).frame(height: 90).padding(6).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12)) } }
}

struct LinesEditor: View {
    let title: String; @Binding var items: [String]
    @State private var text = ""; @State private var seeded = ""
    var body: some View {
        VStack(alignment: .leading) {
            Text(title).font(.subheadline.bold())
            TextEditor(text: $text).frame(height: 90).padding(6).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .onAppear { text = items.joined(separator: "\n"); seeded = text }
        .onChange(of: items) { _, new in let j = new.joined(separator: "\n"); if j != seeded && j != text { text = j; seeded = j } }
        .onChange(of: text) { _, t in items = t.split(separator: "\n").map { String($0) }.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }; seeded = items.joined(separator: "\n") }
    }
}

struct ReauthSheet: View {
    @EnvironmentObject var s: Session; @Environment(\.dismiss) var dismiss
    var onDone: () -> Void
    @State private var pw = ""; @State private var err = ""; @State private var busy = false
    var body: some View {
        VStack(spacing: 16) {
            BunnyView(size: 90).padding(.top, 20)
            Text("Is it really you?").font(Brand.title(26)).foregroundStyle(Brand.titleColor)
            Text("Sign in once more to delete.").multilineTextAlignment(.center).foregroundStyle(Brand.muted)
            if s.provider == "password" {
                SecureField("Your password", text: $pw).padding(14).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
                BigButton(title: "Confirm and delete", tint: Brand.rose, busy: busy) { run { try await s.reauth(password: pw) } }
            } else if s.provider == "google.com" {
                BigButton(title: "Continue with Google", tint: Brand.rose, busy: busy) { run { try await s.reauthGoogle() } }
            } else {
                SignInWithAppleButton(.continue) { s.prepareApple($0) } onCompletion: { r in run { try await s.reauthApple(r) } }.frame(height: 52)
            }
            if !err.isEmpty { Text(err).foregroundStyle(Brand.ink).font(.custom("Atkinson Hyperlegible", size: 16, relativeTo: .callout)) }
            Button("Cancel") { dismiss() }
            Spacer()
        }.padding(24).background(Brand.cream.ignoresSafeArea())
    }
    func run(_ f: @escaping () async throws -> Void) {
        Task { busy = true; err = ""; do { try await f(); dismiss(); onDone() } catch { err = "That did not work: " + error.localizedDescription }; busy = false }
    }
}

/// A family's own record, in plain facts: late cancels and no shows, counted from their own bookings.
/// A late cancel is one cancelled inside a day of the start. Cancelling earlier never counts here.
struct FamilyRecordCard: View {
    let me: Person
    @State private var late = 0; @State private var noShow = 0; @State private var loaded = false
    var body: some View {
        Card { VStack(alignment: .leading, spacing: 6) {
            IconLabel(icon: .calendar, text: "My record", size: 20).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
            if loaded {
                Text("Late cancels: \(late)")
                Text("No shows: \(noShow)")
                Text("Cancelling more than a day ahead is always free, and never counts here.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
            }
        } }
        .task {
            let bs = await Backend.bookings(me.id, side: "family")
            late = bs.filter { b in guard b.state == "cancelled", b.cancelledBy == me.id, let c = b.cancelledAt, let start = Backend.endDate(b.date, b.from) else { return false }; return c < start && start.timeIntervalSince(c) < 24 * 3600 }.count
            noShow = bs.filter { $0.state == "noshow" && $0.familyUid == me.id }.count
            loaded = true
        }
    }
}
