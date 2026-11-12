import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct OnboardingView: View {
    @EnvironmentObject var s: Session
    @State private var step = 0
    @State private var side = "family"
    @State private var service = "nanny"          // carer role
    @State private var name = ""; @State private var postcode = ""; @State private var suburb = ""
    @State private var photoKey = ""; @State private var photoPreview: UIImage?; @State private var pick: PhotosPickerItem?
    // family
    @State private var wants: Set<String> = ["nanny"]
    @State private var kids: [(name: String, age: Int)] = [("", 3)]
    @State private var days: Set<String> = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    @State private var from = "08:00"; @State private var to = "17:00"
    @State private var budget: Double = 35; @State private var km: Double = 10
    // carer
    @State private var headline = ""; @State private var intro = ""; @State private var years = 1; @State private var rate: Double = 30
    @State private var langs: Set<String> = ["English"]
    @State private var resume: Resume?; @State private var showFile = false; @State private var resumeMsg = ""
    @State private var busy = false; @State private var err = ""
    @State private var skippedFamily = false; @State private var showFamilySheet = false

    var role: Role { side == "family" ? .family : (service == "babysitter" ? .babysitter : service == "au_pair" ? .auPair : .nanny) }
    var steps: [String] { side == "family" ? ["you", "care", "kids", "when"] : ["you", "kind", "resume", "about", "when"] }
    var current: String { steps[min(step, steps.count - 1)] }

    var body: some View {
        VStack(spacing: 0) {
            ProgressView(value: Double(step + 1), total: Double(steps.count)).tint(role.tint).padding([.horizontal, .top], 20)
            ScrollView {
                VStack(spacing: 16) {
                    BunnyView(size: 84, mood: bunnyMood)
                    Text(title).font(Brand.title(28)).foregroundStyle(Brand.titleColor).multilineTextAlignment(.center).accessibilityIdentifier("onbTitle").onTapGesture { UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil) }
                    if skippedFamily && current != "you" && (name.trimmingCharacters(in: .whitespaces).isEmpty || (postcode.isEmpty && suburb.isEmpty)) { FamilySkippedNotice { showFamilySheet = true } }
                    content
                    if !err.isEmpty { Text(err).foregroundStyle(Brand.ink).font(.callout) }
                }.padding(20)
            }.scrollDismissesKeyboard(.interactively)
            HStack(spacing: 12) {
                if step > 0 { Button("Back") { step -= 1 }.font(.headline).frame(width: 90, height: 52) }
                if current == "resume" { Button("Skip") { step += 1 }.font(.headline).frame(width: 100, height: 52) }
                if current == "you" && side == "family" { Button("Skip for now") { err = ""; skippedFamily = true; withAnimation { step += 1 } }.font(.headline).frame(width: 130, height: 52).accessibilityIdentifier("skipFamily") }
                BigButton(title: step == steps.count - 1 ? "Finish" : "Next", tint: role.tint, busy: busy, icon: step == steps.count - 1 ? .sparkle : nil) { Task { await next() } }
            }.padding(20).background(.ultraThinMaterial)
        }
        .background(Brand.cream.ignoresSafeArea())
        .onAppear { side = s.chosenSide; if let n = s.me?.name, name.isEmpty { name = n } }
        .fileImporter(isPresented: $showFile, allowedContentTypes: [.pdf, .plainText]) { r in readResume(r) }
        .onChange(of: pick) { _, item in Task { await choosePhoto(item) } }
        .sheet(isPresented: $showFamilySheet) {
            ScrollView { VStack(spacing: 16) {
                Text("My family").font(Brand.title(28)).foregroundStyle(Brand.titleColor).padding(.top, 24)
                FamilyDetailsFields(name: $name, postcode: $postcode, suburb: $suburb)
                BigButton(title: "Done", tint: role.tint) { showFamilySheet = false }
            }.padding(20) }.background(Brand.cream.ignoresSafeArea())
        }
    }

    var bunnyMood: BunnyMood {
        switch current { case "you": return .hello; case "care", "kind": return .think; case "resume": return .point; case "kids", "about": return .encourage; default: return .celebrate }
    }

    var title: String {
        switch current {
        case "you": return side == "family" ? "Tell us about your family" : "Let's make your profile"
        case "care": return "What care do you need?"
        case "kids": return "Your children"
        case "kind": return "What do you do?"
        case "resume": return "Have a resume?"
        case "about": return role == .auPair ? "About you and your stay" : role == .babysitter ? "Your sitting style" : "Your care"
        default: return side == "family" ? "When do you need care?" : "When are you free?"
        }
    }

    @ViewBuilder var content: some View {
        switch current {
        case "you":
            PhotosPicker(selection: $pick, matching: .images) {
                ZStack {
                    Circle().fill(role.soft).frame(width: 130, height: 130)
                    if let p = photoPreview { Image(uiImage: p).resizable().scaledToFill().frame(width: 130, height: 130).clipShape(Circle()) }
                    else { VStack(spacing: 4) { BrandIcon(kind: .camera, size: 38, color: role.tint); Text("Add photo").font(.footnote).foregroundStyle(Brand.ink) } }
                    if busy && photoPreview != nil && photoKey.isEmpty { ProgressView() }
                }
            }
            FamilyDetailsFields(name: $name, postcode: $postcode, suburb: $suburb)
            Text("Your exact address is never shown.").font(.footnote).foregroundStyle(Brand.muted)
        case "care":
            ForEach(["nanny", "babysitter", "au_pair"], id: \.self) { svc in
                Button { if wants.contains(svc) { if wants.count > 1 { wants.remove(svc) } } else { wants.insert(svc) } } label: {
                    HStack { BrandIcon(kind: icon(svc), size: 36); Text(serviceLabels[svc] ?? svc).font(.title3.weight(.semibold)); Spacer(); BrandIcon(kind: wants.contains(svc) ? .checkCircle : .circle, size: 28, color: Brand.ink) }
                        .padding(16).background(wants.contains(svc) ? Brand.blush.opacity(0.5) : .white).foregroundStyle(Brand.ink).clipShape(RoundedRectangle(cornerRadius: 18))
                }
            }
        case "kids":
            ForEach(kids.indices, id: \.self) { i in
                Card { HStack {
                    TextField("Name or nickname", text: Binding(get: { kids[i].name }, set: { kids[i].name = $0 })).textContentType(.givenName)
                    Stepper("\(kids[i].age) y", value: Binding(get: { kids[i].age }, set: { kids[i].age = $0 }), in: 0...17).fixedSize()
                } }
            }
            Button { if kids.count < 8 { kids.append(("", 3)) } } label: { IconLabel(icon: .plus, text: "Add a child") }.font(.headline)
            Text("Children's details stay private.").font(.footnote).foregroundStyle(Brand.muted)
        case "kind":
            ForEach([Role.nanny, .babysitter, .auPair], id: \.self) { r in
                Button { service = r.service ?? "nanny" } label: {
                    HStack { BrandIcon(kind: r.icon, size: 36, color: r.tint); VStack(alignment: .leading) { Text(r.name).font(.title3.weight(.semibold)); Text(r.greeting).font(.footnote) }; Spacer(); BrandIcon(kind: service == r.service ? .checkCircle : .circle, size: 28, color: r.tint) }
                        .padding(16).background(service == r.service ? r.soft : .white).foregroundStyle(r.tint).clipShape(RoundedRectangle(cornerRadius: 18))
                }
            }
            Text("Your own app, made for you.").font(.footnote).foregroundStyle(Brand.muted).multilineTextAlignment(.center)
        case "resume":
            Text("We fill in your profile for you.").foregroundStyle(Brand.muted)
            BigButton(title: resume == nil ? "Add resume" : "Resume read", tint: role.tint, icon: resume == nil ? .doc : .checkCircle) { showFile = true }
            if !resumeMsg.isEmpty { Text(resumeMsg).font(.callout).multilineTextAlignment(.center) }
            IconLabel(icon: .lock, text: "Read on your phone only", size: 14, color: Brand.muted).font(.footnote).foregroundStyle(Brand.muted)
        case "about":
            field("A few words about your care", $headline)
            VStack(alignment: .leading) { Text("About you").font(.subheadline); TextEditor(text: $intro).frame(height: 110).padding(8).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12)); Text("\(intro.count)/300").font(.caption).foregroundStyle(Brand.muted) }
            Card { Stepper("Years of experience: \(years)", value: $years, in: 0...40) }
            Card { VStack(alignment: .leading) { Text("Your rate: $\(Int(rate)) per hour"); Slider(value: $rate, in: 15...90, step: 1).tint(role.tint) } }
            FlowChips(items: ["English", "Spanish", "Mandarin", "Cantonese", "Vietnamese", "Hindi", "Arabic", "French", "German"], selected: $langs, tint: role.tint)
        default:
            FlowChips(items: allDays, selected: $days, tint: role.tint)
            HStack { timeField("From", $from); timeField("To", $to) }
            if side == "family" {
                Card { VStack(alignment: .leading) { Text("Budget: up to $\(Int(budget)) per hour"); Slider(value: $budget, in: 15...90, step: 1).tint(role.tint) } }
                Card { VStack(alignment: .leading) { Text("Distance: \(Int(km)) km"); Slider(value: $km, in: 2...50, step: 1).tint(role.tint) } }
            }
        }
    }

    func icon(_ svc: String) -> BI { svc == "nanny" ? .nanny : svc == "babysitter" ? .moon : .globe }
    func field(_ t: String, _ b: Binding<String>, content: UITextContentType? = nil, keyboard: UIKeyboardType = .default) -> some View {
        TextField(t, text: b).textContentType(content).keyboardType(keyboard).padding(14).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
    }
    func timeField(_ t: String, _ b: Binding<String>) -> some View {
        let times = stride(from: 5, through: 23, by: 1).flatMap { h in ["00", "30"].map { String(format: "%02d:%@", h, $0) } }
        return Picker(t, selection: b) { ForEach(times, id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu).padding(6).background(Brand.card).clipShape(RoundedRectangle(cornerRadius: 12))
    }

    func choosePhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        err = ""; busy = true; photoKey = ""
        defer { busy = false }
        do {
            let data = try await Media.load(item)
            let prepared = try Media.prepare(data)          // small, clean copy: this is what we show and what we upload
            photoPreview = UIImage(data: prepared)
            photoKey = try await Media.uploadPreparedSafe(prepared, kind: "avatar")
        } catch { err = "Photo problem: " + error.localizedDescription }
    }

    func readResume(_ r: Result<URL, Error>) {
        do {
            let url = try r.get()
            let parsed = ResumeParser.parse(try ResumeParser.text(from: url))
            if parsed.isEmpty { throw AppError.msg("We found no work or skills in that file.") }
            resume = parsed
            if headline.isEmpty { headline = ResumeParser.headline(parsed) }
            if intro.isEmpty { intro = String(parsed.summary.prefix(300)) }
            let y = ResumeParser.years(parsed); if y > 0 { years = y }
            resumeMsg = "Done! We filled in your profile. Check the next step."
        } catch { resumeMsg = error.localizedDescription + " You can skip this." }
    }

    func validate() -> String? {
        if current == "you" && !(skippedFamily && side == "family") && (name.trimmingCharacters(in: .whitespaces).isEmpty || (postcode.isEmpty && suburb.isEmpty)) { return "Add your name and a postcode or suburb." }
        if current == "about" && headline.trimmingCharacters(in: .whitespaces).isEmpty { return "Add a few words about your care." }
        if current == "when" && days.isEmpty { return "Pick at least one day." }
        return nil
    }

    func next() async {
        err = ""
        if let e = validate() { err = e; return }
        if step < steps.count - 1 { withAnimation { step += 1 }; return }
        guard let uid = s.uid else { return }
        busy = true; defer { busy = false }
        let sched: [String: Any] = Dictionary(uniqueKeysWithValues: days.map { ($0, ["from": from, "to": to] as [String: Any]) })
        var card: [String: Any] = ["suburb": suburb]
        if side == "family" {
            card["careTypes"] = ["nanny", "babysitter", "au_pair"].filter { wants.contains($0) }
            card["kids"] = kids.filter { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty }.map { ["name": String($0.name.split(separator: " ").first ?? ""), "ageYears": $0.age] as [String: Any] }
            card["scheduleNeed"] = sched; card["budgetMax"] = budget; card["maxDistanceKm"] = km
        } else {
            card["careTypes"] = [service]; card["headline"] = String(headline.prefix(80)); card["languages"] = Array(langs)
            card["experienceYears"] = years; card["rate"] = rate; card["availability"] = sched; card["maxDistanceKm"] = km
        }
        do {
            try await Backend.saveProfile(uid, side: side, name: name.trimmingCharacters(in: .whitespaces).isEmpty ? "A family" : name.trimmingCharacters(in: .whitespaces), postcode: postcode, photoKey: photoKey.isEmpty ? nil : photoKey, about: side == "family" ? "" : intro, card: card)
            if let r = resume { try? await Backend.saveResume(uid, r) }
            await s.reload()
        } catch { err = "Could not save: " + error.localizedDescription }
    }
}

struct FlowChips: View {
    let items: [String]; @Binding var selected: Set<String>; var tint: Color = Brand.ink
    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 84), spacing: 8)], spacing: 8) {
            ForEach(items, id: \.self) { i in
                Button { if selected.contains(i) { selected.remove(i) } else { selected.insert(i) } } label: { Chip(text: i, on: selected.contains(i), tint: tint) }
            }
        }
    }
}
