import SwiftUI

// MARK: Today timeline, children list inside a space, and the daily report.

struct TodayView: View {
    @ObservedObject var model: SpaceModel
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @State private var childId: String? = nil
    @State private var kind: TimelineKind = .note
    @State private var text = ""
    @State private var note = ""

    static let quickKinds: [TimelineKind] = [.arrival, .drink, .nap, .activity, .mood, .pickup, .note]
    var child: ChildProfile? { model.children.first { $0.id == childId } }
    var shownItems: [TimelineItem] { CareTimeline.items(model.items, forChild: childId) }
    var nextUp: CalendarEvent? {
        let mine = model.events.filter { childId == nil || $0.childId == nil || $0.childId == childId }
        return CareCalendar.nextUp(CareCalendar.expand(mine, from: Date(), to: Date()))
    }

    var body: some View {
        Screen {
            if model.children.count > 0 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        Button { childId = nil } label: { Pill(title: "Everyone", on: childId == nil) }.buttonStyle(.plain)
                        ForEach(model.children) { c in Button { childId = c.id } label: { Pill(title: c.name, on: childId == c.id) }.buttonStyle(.plain) }
                    }
                }
            }
            allergyBanner
            if let e = nextUp {
                Card { HStack(spacing: 12) { CareIcon(name: e.kind.icon, size: 28)
                    VStack(alignment: .leading, spacing: 2) { Text("Next up").font(Brand.body(15)).foregroundStyle(th.theme.muted)
                        Text("\(e.title), \(CareTime.clock(e.start))").font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text) } } }
            }
            if !model.alerts.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Team alerts").font(Brand.title(20)).foregroundStyle(th.theme.text)
                    ForEach(model.alerts.prefix(3)) { a in Notice(text: "\(a.summary) \(a.at.shortDay)", warn: true) }
                }
            }
            HStack { Heading(text: "Today"); Spacer()
                NavigationLink { DailyReportView(model: model) } label: { Pill(title: "Daily report", icon: "report", on: false) }.buttonStyle(.plain) }
            if shownItems.isEmpty { EmptyState(title: "Nothing logged yet today", detail: "Add the first update below.") }
            ForEach(shownItems) { item in TimelineRow(model: model, item: item) }
            if CareAccess.canPost(model.space.role) { composer } else { BodyText(text: "You can read the day and ask questions. Posting is for carers and admins.", muted: true) }
            // Item 20: the photo ask lives here, on the day page —
            // one home. The carer answers it with the photo itself.
            if let c = child {
                BigButton(title: "Ask for a photo of \(c.name)") {
                    guard let uid = s.uid else { return }
                    Task {
                        if let ok = try? await CareRepo.addItem(spaceId: model.space.id, kind: .photo, text: "A photo of \(c.name), please", childId: c.id, by: uid), ok {
                            note = "Asked. \(c.name)'s carer gets a ping."
                        }
                    }
                }
            }
            Heading(text: "This care space")
            RowLink(icon: "cal", title: "Roster", subtitle: "The team's week") { RosterView(model: model) }
            RowLink(icon: "clock", title: "Timesheet", subtitle: "Worked hours this week") { TimesheetView(model: model) }
            RowLink(icon: "meal", title: "Shopping", subtitle: "What to buy, who buys, what is done") { ShoppingView(model: model) }
            RowLink(icon: "bell", title: "Reminders", subtitle: "Coming up and waiting") { RemindersView(model: model) }
            RowLink(icon: "phone", title: "Emergency", subtitle: "Contacts and allergy alerts, big") { EmergencyView(model: model) }
            RowLink(icon: "shield", title: "Checks", subtitle: "Each team member's checks") { ChecksView(model: model) }
            RowLink(icon: "trash", title: "Recently deleted", subtitle: "Deleted day entries rest 30 days") { DeletedView(model: model) }
        }
        .task(id: model.children.count) { if childId == nil, model.children.count == 1 { childId = model.children.first?.id } }
    }

    @ViewBuilder var allergyBanner: some View {
        let ids = childId.map { [$0] } ?? model.children.map { $0.id }
        let names = ids.flatMap { model.allergyNames[$0] ?? [] }
        if !names.isEmpty {
            Notice(text: "Allergy alert. Allergies: \(Array(Set(names)).sorted().joined(separator: ", ")). Check labels and ask the parent before serving.", warn: true)
        }
    }

    var composer: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Add an update").font(Brand.title(20)).foregroundStyle(th.theme.text)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack { ForEach(Self.quickKinds, id: \.self) { k in Button { kind = k } label: { Pill(title: k.label, icon: k.icon, on: kind == k) }.buttonStyle(.plain) } }
            }
            BodyText(text: "Meals go in the daily report, so the allergy check runs first.", muted: true)
            CareField(title: childId == nil ? "What happened (for everyone)" : "What happened for \(child?.name ?? "this child")", text: $text, lines: 2, voice: true)
            if !note.isEmpty { Notice(text: note) }
            BigButton(title: "Add to today") {
                guard let uid = s.uid, !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                let t = text; text = ""
                Task { do { let ok = try await CareRepo.addItem(spaceId: model.space.id, kind: kind, text: t, childId: childId, by: uid); note = SaveText.result(ok) }
                    catch { note = error.localizedDescription } }
            }
        }
    }
}

struct TimelineRow: View {
    @ObservedObject var model: SpaceModel
    let item: TimelineItem
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @State private var asking = false
    @State private var draft = ""
    @State private var answerIndex: Int? = nil
    var childName: String { model.children.first { $0.id == item.childId }?.name ?? "" }
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top, spacing: 12) {
                    CareIcon(name: item.kind.icon, size: 28)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(item.kind.label)  \(CareTime.clock(item.at))").font(Brand.body(15)).foregroundStyle(th.theme.muted)
                        if item.text.isEmpty == false { Text(item.text).font(Brand.body()).foregroundStyle(th.theme.text) }
                        if !item.photoKey.isEmpty {
                            if CareAccess.canSeePhotos(model.space.role, model.space.perms) { SpacePhoto(key: item.photoKey, height: 200).padding(.top, 6) }
                            else { Text("A photo was shared. Ask a family admin to open photos for you.").font(Brand.body(15)).foregroundStyle(th.theme.muted) }
                        }
                        let who = [childName, model.name(of: item.by, me: s.myName)].filter { !$0.isEmpty }.joined(separator: ", ")
                        if !who.isEmpty { Text(who).font(Brand.body(14)).foregroundStyle(th.theme.muted) }
                    }
                }
                ForEach(Array(item.asks.enumerated()), id: \.offset) { i, a in
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Question: \(a.text)").font(Brand.body(16)).foregroundStyle(th.theme.text)
                        if let ans = a.answerText { Text("Answer: \(ans)").font(Brand.body(16)).foregroundStyle(Brand.ink).padding(8).background(Brand.sky.opacity(0.5)).clipShape(RoundedRectangle(cornerRadius: 10)) }
                        else if CareAccess.canPost(model.space.role) {
                            if answerIndex == i {
                                CareField(title: "Your answer", text: $draft)
                                BigButton(title: "Send answer") { sendAnswer(i) }
                            } else { Button("Answer") { answerIndex = i; draft = "" }.font(Brand.body(16).weight(.semibold)).frame(minHeight: 44) }
                        } else { Text("Waiting for an answer").font(Brand.body(14)).foregroundStyle(th.theme.muted) }
                    }
                }
                // Item 20: a photo ask is answered with the photo.
                if item.kind == .photo, item.asks.contains(where: { !$0.answered }), CareAccess.canPost(model.space.role), CareAccess.canSeePhotos(model.space.role, model.space.perms) {
                    PhotoAddButton(spaceId: model.space.id, title: "Send the photo", onKey: { key in
                        Task { _ = await CareRepo.answerPhotoAsk(spaceId: model.space.id, item: item, photoKey: key) }
                    }, onError: { _ in })
                }
                HStack(spacing: 16) {
                    if asking {
                    } else if item.by == s.uid || model.space.role == .admin {
                        Button("Delete") { Task { _ = await CareRepo.deleteItemToBin(spaceId: model.space.id, item: item) } }
                            .font(Brand.body(15)).foregroundStyle(th.theme.muted).frame(minHeight: 44)
                    }
                }
                if asking {
                    CareField(title: "Your question", text: $draft)
                    BigButton(title: "Send question") { sendAsk() }
                } else {
                    Button("Ask a question") { asking = true; draft = "" }.font(Brand.body(16).weight(.semibold)).frame(minHeight: 44)
                }
            }
        }
    }
    func sendAsk() {
        guard let uid = s.uid, !draft.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        let updated = CareTimeline.attach(item, ask: TimelineAsk(by: uid, text: String(draft.prefix(300)), at: CareTime.iso(Date())))
        asking = false
        Task { _ = try? await CareRepo.saveAsks(spaceId: model.space.id, item: updated) }
    }
    func sendAnswer(_ i: Int) {
        guard !draft.trimmingCharacters(in: .whitespaces).isEmpty, let updated = CareTimeline.answer(item, index: i, text: String(draft.prefix(300))) else { return }
        answerIndex = nil
        Task { _ = try? await CareRepo.saveAsks(spaceId: model.space.id, item: updated) }
    }
}

struct SpaceChildrenView: View {
    @ObservedObject var model: SpaceModel
    @EnvironmentObject var th: ThemeStore
    var body: some View {
        Screen {
            if model.children.isEmpty { EmptyState(title: "No children yet", detail: CareAccess.canEditChildDetails(model.space.role) ? "Add a child to start their profile." : "A family admin can add a child.") }
            ForEach(model.children) { c in
                RowLink(icon: "care", title: c.name, subtitle: c.ageYears > 0 ? "Age \(c.ageText)" : "") { ChildView(space: model.space, child: c) }
            }
            RowLink(icon: "photo", title: "Photos", subtitle: "Private memories for this care space") { GalleryView(space: model.space) }
            if CareAccess.canEditChildDetails(model.space.role) {
                RowLink(icon: "plus", title: "Add a child") { AddChildView(space: model.space) }
            }
        }
    }
}

// MARK: Daily report. Meals are checked against allergies before they can be logged.

struct DailyReportView: View {
    @ObservedObject var model: SpaceModel
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @State private var childId: String? = nil
    @State private var quickKind: TimelineKind = .drink
    @State private var quickText = ""
    @State private var ingredients = ""
    @State private var result: AllergyCheck? = nil
    @State private var checkedText = ""
    @State private var confirmed = false
    @State private var note = ""
    @State private var noteText = ""

    var child: ChildProfile? { model.children.first { $0.id == childId } }
    var canPost: Bool { CareAccess.canPost(model.space.role) }
    /// nil means the allergy list could not be read, so food logging stays blocked.
    var allergies: [String]? { childId.flatMap { model.allergyNames[$0] } }
    var todays: [TimelineItem] { CareTimeline.items(model.items, forChild: childId) }

    var body: some View {
        Screen {
            Heading(text: "Daily report")
            BodyText(text: "Log the day for one child. Everything you add shows on Today for the family.", muted: true)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack { ForEach(model.children) { c in Button { childId = c.id; result = nil; confirmed = false } label: { Pill(title: c.name, on: childId == c.id) }.buttonStyle(.plain) } }
            }
            if model.children.isEmpty { Notice(text: "Add a child first.") }
            if !canPost { Notice(text: "Family viewers can read the report but not add to it.") }
            if canPost, child != nil {
                quickLog
                mealLog
                noteLog
                photoLog
            }
            if !note.isEmpty { Notice(text: note) }
            Heading(text: "So far today")
            if todays.isEmpty { BodyText(text: "Nothing logged yet.", muted: true) }
            ForEach(todays) { i in
                Card { HStack(alignment: .top, spacing: 12) { CareIcon(name: i.kind.icon, size: 26)
                    VStack(alignment: .leading) { Text("\(i.kind.label)  \(CareTime.clock(i.at))").font(Brand.body(15)).foregroundStyle(th.theme.muted)
                        if !i.text.isEmpty { Text(i.text).font(Brand.body()).foregroundStyle(th.theme.text) }
                        if !i.photoKey.isEmpty, CareAccess.canSeePhotos(model.space.role, model.space.perms) { SpacePhoto(key: i.photoKey, height: 160) } } } }
            }
        }
        .navigationTitle("Daily report").navigationBarTitleDisplayMode(.inline)
        .task { if childId == nil, model.children.count == 1 { childId = model.children.first?.id } }
    }

    var quickLog: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Quick log").font(Brand.title(20)).foregroundStyle(th.theme.text)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack { ForEach([TimelineKind.arrival, .drink, .nap, .activity, .mood, .pickup], id: \.self) { k in Button { quickKind = k } label: { Pill(title: k.label, icon: k.icon, on: quickKind == k) }.buttonStyle(.plain) } }
            }
            CareField(title: "Short note (optional)", text: $quickText)
            BigButton(title: "Log \(quickKind.label.lowercased())") { post(quickKind, quickText.isEmpty ? quickKind.label : quickText); quickText = "" }
        }
    }

    var mealLog: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Log a meal").font(Brand.title(20)).foregroundStyle(th.theme.text)
            if let list = allergies {
                if !list.isEmpty { Notice(text: "Allergies for \(child?.name ?? "this child"): \(list.joined(separator: ", ")).", warn: true) }
                CareField(title: "Ingredients (separate with commas)", text: $ingredients, lines: 2)
                BigButton(title: "Check ingredients", tint: Brand.ink.opacity(0.85)) {
                    result = AllergyChecker.check(ingredients, allergies: list); checkedText = ingredients; confirmed = false
                }
                if let r = result { AllergyResultView(result: r) }
                if result != nil {
                    Button { confirmed.toggle() } label: {
                        HStack(spacing: 12) {
                            ZStack { RoundedRectangle(cornerRadius: 6).stroke(Brand.ink, lineWidth: 2).frame(width: 28, height: 28)
                                if confirmed { CareIcon(name: "check", size: 20, fill: false) } }
                            Text("Check ingredients and parent's notes first").font(Brand.body()).foregroundStyle(th.theme.text).multilineTextAlignment(.leading)
                        }.frame(minHeight: 44)
                    }.buttonStyle(.plain).accessibilityAddTraits(confirmed ? .isSelected : [])
                    let stale = checkedText != ingredients
                    if stale { BodyText(text: "The ingredients changed. Check them again.", muted: true) }
                    BigButton(title: "Log meal") { if confirmed && !stale { post(.meal, ingredients); ingredients = ""; result = nil; confirmed = false } }
                        .opacity(confirmed && !stale ? 1 : 0.4)
                }
            } else {
                Notice(text: "Ask a parent before logging food. The allergy list could not be read for you.", warn: true)
            }
        }
    }

    var noteLog: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Add a note").font(Brand.title(20)).foregroundStyle(th.theme.text)
            CareField(title: "Note for the family", text: $noteText, lines: 2)
            BigButton(title: "Add note") { if !noteText.trimmingCharacters(in: .whitespaces).isEmpty { post(.note, noteText); noteText = "" } }
        }
    }

    var photoLog: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Add a photo").font(Brand.title(20)).foregroundStyle(th.theme.text)
            if CareAccess.canSeePhotos(model.space.role, model.space.perms) {
                BodyText(text: "The photo stays in this private care space. It shows on Today for people who can see photos.", muted: true)
                PhotoAddButton(spaceId: model.space.id, onKey: { post(.photo, "Photo added to today's report.", photoKey: $0) }, onError: { note = $0 })
            } else {
                BodyText(text: "Only a parent or a member with photo access can add a photo.", muted: true)
            }
        }
    }

    func post(_ k: TimelineKind, _ t: String, photoKey: String? = nil) {
        guard let uid = s.uid else { return }
        Task { do { let ok = try await CareRepo.addItem(spaceId: model.space.id, kind: k, text: t, childId: childId, by: uid, photoKey: photoKey); note = SaveText.result(ok) }
            catch { note = error.localizedDescription } }
    }
}

struct AllergyResultView: View {
    let result: AllergyCheck
    var title: String {
        switch result.status {
        case .contains: return "A listed allergy may match these ingredients."
        case .mayContain: return "Possible cross-contamination. Ask the parent before serving."
        case .unknownIngredient: return "Unknown ingredient. Check the full label with the parent."
        case .noMatchFound: return "No ingredient match was found."
        }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(Brand.body().weight(.bold))
            ForEach(Array(result.reasons.filter { !$0.hasPrefix("No match found is not") }.enumerated()), id: \.offset) { _, r in Text(r).font(Brand.body(16)) }
            ForEach(Array(result.crossContamination.enumerated()), id: \.offset) { _, r in Text(r).font(Brand.body(16)) }
            Text(AllergyChecker.safetyCopy).font(Brand.body(16).weight(.bold))
        }
        .foregroundStyle(Brand.ink).padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(result.status == .noMatchFound ? Brand.sky.opacity(0.55) : Brand.blush)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
