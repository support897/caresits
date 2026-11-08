import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import AuthenticationServices

struct MeView: View {
    @EnvironmentObject var s: Session
    @State private var pick: PhotosPickerItem?; @State private var galleryPick: [PhotosPickerItem] = []
    @State private var busy = false; @State private var err = ""; @State private var ok = ""
    @State private var showResume = false; @State private var showEdit = false; @State private var confirmDelete = false; @State private var showReauth = false
    @State private var rating: (avg: Double, count: Int)?; @State private var reviews: [(rating: Int, text: String)] = []
    var role: Role { s.role }
    var me: Person { s.me ?? Person(id: "", data: [:]) }

    var body: some View {
        if s.me == nil { Color.clear } else { content }
    }
    var content: some View {
        NavigationStack {
            ScrollView { VStack(spacing: 14) {
                Header(role: role, title: "Me", subtitle: "\(role.name) · \(role == .family ? "Family" : "Free for carers, always")")
                PhotosPicker(selection: $pick, matching: .images) {
                    ZStack(alignment: .bottomTrailing) {
                        PhotoView(key: me.photoKey, size: 120, fallback: role.emoji)
                        Text("📷").padding(8).background(.white).clipShape(Circle()).shadow(radius: 2)
                        if busy { ProgressView() }
                    }
                }
                Text(me.name).font(Brand.title(26)).foregroundStyle(Brand.ink)
                if !ok.isEmpty { Text(ok).foregroundStyle(role.tint).font(.callout) }
                if !err.isEmpty { Text(err).foregroundStyle(.red).font(.callout).multilineTextAlignment(.center) }

                Card { VStack(alignment: .leading, spacing: 8) {
                    Text("My photos").font(.headline)
                    ScrollView(.horizontal, showsIndicators: false) { HStack {
                        ForEach(me.gallery, id: \.self) { k in PhotoView(key: k, size: 80, round: false) }
                        if me.gallery.count < 6 { PhotosPicker(selection: $galleryPick, maxSelectionCount: 6 - me.gallery.count, matching: .images) { ZStack { RoundedRectangle(cornerRadius: 16).fill(role.soft); Text("➕").font(.title) }.frame(width: 80, height: 80) } }
                    } }
                } }.padding(.horizontal, 20)

                if me.side == "carer" {
                    Card { VStack(alignment: .leading, spacing: 8) {
                        Text("\(role.emoji) My \(role.name.lowercased()) profile").font(.headline)
                        Text(me.headline.isEmpty ? "Add a headline" : me.headline)
                        Text("💲\(Int(me.rate))/h  ·  ⭐ \(me.years) years").font(.subheadline).foregroundStyle(Brand.muted)
                        if let r = rating { Text("★ \(String(format: "%.1f", r.avg)) from \(r.count) review\(r.count == 1 ? "" : "s")").foregroundStyle(.orange) }
                        else { Text("No reviews yet").font(.footnote).foregroundStyle(Brand.muted) }
                        Button("✏️ Edit") { showEdit = true }
                    } }.padding(.horizontal, 20)
                    Button { showResume = true } label: { row("📄", "My resume", "Add a file. We fill your profile.") }.buttonStyle(.plain).padding(.horizontal, 20)
                    ForEach(reviews.indices, id: \.self) { i in Card { Text(String(repeating: "★", count: reviews[i].rating) + (reviews[i].text.isEmpty ? "" : "  " + reviews[i].text)).font(.subheadline) }.padding(.horizontal, 20) }
                } else {
                    Card { VStack(alignment: .leading, spacing: 6) {
                        Text("🏡 My family").font(.headline)
                        Text("Looking for: " + me.services.map { serviceLabels[$0] ?? $0 }.joined(separator: ", "))
                        if !me.kids.isEmpty { Text("👶 " + me.kids.map { "\($0.name) \($0.age)" }.joined(separator: ", ")) }
                        if me.budgetMax > 0 { Text("💲 Up to \(Int(me.budgetMax)) per hour").foregroundStyle(Brand.muted) }
                        Text("Children's details are private.").font(.caption).foregroundStyle(Brand.muted)
                    } }.padding(.horizontal, 20)
                }
                Card { VStack(alignment: .leading, spacing: 8) {
                    Text("Safety and privacy").font(.headline)
                    Text("🔒 Photos are private until you connect.").font(.footnote).foregroundStyle(Brand.muted)
                } }.padding(.horizontal, 20)
                Button("Sign out") { s.signOut() }.font(.headline).padding(.top, 8)
                Button("Delete my account", role: .destructive) { confirmDelete = true }.font(.footnote)
            }.padding(.bottom, 40) }
            .background(Brand.cream.ignoresSafeArea())
            .onChange(of: pick) { _, i in Task { await setAvatar(i) } }
            .onChange(of: galleryPick) { _, items in Task { await addGallery(items) } }
            .sheet(isPresented: $showReauth) { ReauthSheet { Task { await doDelete() } } }
            .sheet(isPresented: $showResume) { ResumeEditor() }
            .sheet(isPresented: $showEdit) { ProfileEditor() }
            .confirmationDialog("Delete your account and profile? This cannot be undone.", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete everything", role: .destructive) { if s.needsReauth { showReauth = true } else { Task { await doDelete() } } }
            }
            .task { if me.side == "carer" { rating = await Backend.reviewSummary(me.id); reviews = await Backend.reviewsFor(carer: me.id) } }
        }
    }
    func row(_ e: String, _ t: String, _ sub: String) -> some View { Card { HStack { Text(e).font(.title); VStack(alignment: .leading) { Text(t).font(.headline).foregroundStyle(Brand.ink); Text(sub).font(.footnote).foregroundStyle(Brand.muted) }; Spacer(); Image(systemName: "chevron.right") } } }

    func doDelete() async {
        do { try await Backend.deleteAccount((s.uid ?? "")); s.signOut() } catch { err = "Could not delete: " + error.localizedDescription }
    }
    func setAvatar(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        busy = true; err = ""; ok = ""; defer { busy = false; pick = nil }
        do {
            let data = try await Media.load(item)
            let key = try await Media.uploadSafe(data, kind: "avatar")
            try await Backend.saveProfile(me.id, photoKey: key)
            await s.reload(); ok = "Photo saved ✅"
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
            if skipped > 0 { err = "\(skipped) photo(s) skipped. " + why } else { ok = "Photos saved ✅" }
        } catch { err = "Photo problem: " + error.localizedDescription }
    }
}

struct ProfileEditor: View {
    @EnvironmentObject var s: Session; @Environment(\.dismiss) var dismiss
    @State private var headline = ""; @State private var intro = ""; @State private var years = 0; @State private var rate: Double = 30; @State private var err = ""; @State private var busy = false
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Text("Edit profile").font(Brand.title(26)).padding(.top, 16)
            TextField("A few words about your care", text: $headline).padding(14).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
            TextEditor(text: $intro).frame(height: 120).padding(8).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
            Card { Stepper("Years of experience: \(years)", value: $years, in: 0...40) }
            Card { VStack(alignment: .leading) { Text("Rate: $\(Int(rate)) per hour"); Slider(value: $rate, in: 15...90, step: 1) } }
            if !err.isEmpty { Text(err).foregroundStyle(.red) }
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
            BunnyView(size: 80).padding(.top, 16)
            Text("My resume").font(Brand.title(26))
            BigButton(title: "📄 Choose a resume file", tint: s.role.tint) { showFile = true }
            Text("🔒 Read on your phone only").font(.footnote).foregroundStyle(Brand.muted)
            if !msg.isEmpty { Text(msg).font(.callout) }
            editor("About you", Binding(get: { r.summary }, set: { r.summary = $0 }))
            LinesEditor(title: "Work (one per line)", items: $r.jobs); LinesEditor(title: "Study (one per line)", items: $r.education); LinesEditor(title: "Skills (one per line)", items: $r.skills); LinesEditor(title: "Certificates you list (one per line)", items: $r.certificates)
            Text("Your own words. Not checked.").font(.caption).foregroundStyle(Brand.muted)
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
            Text("Is it really you?").font(Brand.title(26))
            Text("Sign in once more to delete.").multilineTextAlignment(.center).foregroundStyle(Brand.muted)
            if s.provider == "password" {
                SecureField("Your password", text: $pw).padding(14).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
                BigButton(title: "Confirm and delete", tint: .red, busy: busy) { run { try await s.reauth(password: pw) } }
            } else if s.provider == "google.com" {
                BigButton(title: "Continue with Google", tint: .red, busy: busy) { run { try await s.reauthGoogle() } }
            } else {
                SignInWithAppleButton(.continue) { s.prepareApple($0) } onCompletion: { r in run { try await s.reauthApple(r) } }.frame(height: 52)
            }
            if !err.isEmpty { Text(err).foregroundStyle(.red).font(.callout) }
            Button("Cancel") { dismiss() }
            Spacer()
        }.padding(24).background(Brand.cream.ignoresSafeArea())
    }
    func run(_ f: @escaping () async throws -> Void) {
        Task { busy = true; err = ""; do { try await f(); dismiss(); onDone() } catch { err = "That did not work: " + error.localizedDescription }; busy = false }
    }
}
