import SwiftUI

// MARK: Items 10 + 18 — Activities for real, and the engine.
// The design of record is ITEM18-ENGINE-DESIGN.md at this desk
// (her 18 Oct engine ruling): the catalogue's 141 activities are
// the seed and the quality benchmark; the layer of record is a
// deterministic engine composing those human-reviewed blocks by
// the child's age band, loves, the family's goals and learning
// styles. No AI at run time, nothing invented. The day's picks
// stand READY AHEAD: composed once, stored on the day's plan
// record, the same on every phone in the space.

struct CatalogueMaterial: Codable, Equatable { let name: String; let buy: Bool }
struct CatalogueActivity: Codable, Identifiable, Equatable {
    let id: String; let title: String
    let bandLo: Int; let bandHi: Int
    let goal: String; let styles: [String]
    let materials: [CatalogueMaterial]; let steps: String
    let minutes: Int; let free: Bool; let place: String
    let loves: [String]; let warning: String
}

enum Catalogue {
    static let all: [CatalogueActivity] = {
        guard let url = Bundle.main.url(forResource: "ActivitiesCatalogue", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(CatalogueFile.self, from: data) else { return [] }
        return decoded.activities
    }()
    private struct CatalogueFile: Codable { let count: Int; let activities: [CatalogueActivity] }
    /// Her 8 learning styles of record, in her words.
    static let stylesOfRecord = ["Montessori", "Waldorf", "Reggio Emilia", "Play Based",
                                 "Nature and Forest", "HighScope", "Charlotte Mason",
                                 "Simple Fun Arts and Crafts"]
    /// The catalogue's shorter tags name the same styles.
    static func styleMatches(_ catalogueTag: String, _ familyPick: String) -> Bool {
        let t = catalogueTag.lowercased(), f = familyPick.lowercased()
        if t == f { return true }
        if f.hasPrefix("nature") && t == "nature" { return true }
        if f.hasPrefix("reggio") && t == "reggio" { return true }
        if f.hasPrefix("play") && t.hasPrefix("play") { return true }
        if f.hasPrefix("simple fun") && t == "simple fun" { return true }
        return false
    }
    static func band(forAgeYears age: Double) -> (Int, Int) {
        switch age {
        case ..<2: return (0, 1)
        case ..<4: return (2, 3)
        case ..<6: return (4, 5)
        case ..<9: return (6, 8)
        default: return (9, 12)
        }
    }
}

enum ActivityEngine {
    struct Pick { let activity: CatalogueActivity; let why: String; let allergyFlag: String? }
    /// Compose a child's day. Deterministic: the same child, day
    /// and recent set always give the same picks.
    static func compose(child: ChildProfile, allergyNames: [String], recentIds: [String], count: Int = 3) -> [Pick] {
        let band = Catalogue.band(forAgeYears: child.ageYears)
        let loves = child.interests
        let goals = child.learningGoals
        let styles = child.learningStyles
        let language = child.learningLanguage
        let wantsLanguage = !language.isEmpty && language != "en"
        var scored: [(Int, CatalogueActivity, String)] = []
        for a in Catalogue.all where a.bandLo == band.0 && a.bandHi == band.1 {
            if recentIds.contains(a.id) { continue }
            var score = 0
            var why: [String] = []
            let loveHits = a.loves.filter { lv in loves.contains { $0.lowercased().contains(lv.lowercased()) || lv.lowercased().contains($0.lowercased()) } }
            if !loveHits.isEmpty { score += 3 * loveHits.count; why.append("loves \(loveHits.joined(separator: ", "))") }
            if goals.contains(where: { a.goal.lowercased().contains($0.lowercased()) || $0.lowercased().contains(a.goal.lowercased()) }) {
                score += 2; why.append("a family goal")
            }
            let styleHits = a.styles.filter { tag in styles.contains { Catalogue.styleMatches(tag, $0) } }
            if !styleHits.isEmpty { score += 2; why.append("the family's way of learning") }
            if wantsLanguage && a.goal.lowercased().contains("another language") { score += 3; why.append("learning words in the family's language") }
            scored.append((score, a, why.isEmpty ? "right for this age" : why.joined(separator: " · ")))
        }
        scored.sort { $0.0 != $1.0 ? $0.0 > $1.0 : $0.1.title < $1.1.title }
        return scored.prefix(count).map { (_, a, why) in
            let text = ([a.title, a.steps] + a.materials.map(\.name)).joined(separator: " ")
            let result = AllergyChecker.check(text, allergies: allergyNames)
            let flag: String?
            switch result.status {
            case .contains: flag = "Names an allergy on this child's list. \(result.reasons.first ?? "")"
            case .mayContain: flag = "May touch an allergy on this child's list. \(result.reasons.first ?? "")"
            case .unknownIngredient: flag = "An ingredient here is not known. Check before you start."
            case .noMatchFound: flag = nil
            }
            return Pick(activity: a, why: why, allergyFlag: flag)
        }
    }
}

// MARK: - The Activities tab

struct ActivitiesHome: View {
    @EnvironmentObject var ctx: CareContext
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @State private var spaceId: String?
    @State private var childId: String?
    @State private var query = ""
    var spaces: [SpaceSummary] { ctx.spaces }
    var space: SpaceSummary? { spaces.first(where: { $0.id == spaceId }) ?? spaces.first }
    var children: [ChildProfile] { space.map { ctx.children[$0.id] ?? [] } ?? [] }
    var child: ChildProfile? { children.first(where: { $0.id == childId }) ?? children.first }
    var body: some View {
        Screen {
            Heading(text: "Activities")
            if spaces.isEmpty {
                EmptyState(title: "No care space yet", detail: "Activities stand ready here once you are in a care space.")
            } else if children.isEmpty {
                EmptyState(title: "No children yet", detail: "Add a child on the Care tab and the day's activities stand ready here, made for them by name.")
            } else {
                if spaces.count > 1 {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack { ForEach(spaces) { sp in PillButton(title: sp.name, on: space?.id == sp.id) { spaceId = sp.id } } }
                    }
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack { ForEach(children) { c in PillButton(title: c.name, on: child?.id == c.id) { childId = c.id } } }
                }
                if let sp = space, let c = child {
                    DayPlanView(space: sp, child: c)
                    Heading(text: "Browse the catalogue")
                    CareField(title: "Search activities", text: $query)
                    let band = Catalogue.band(forAgeYears: c.ageYears)
                    let list = Catalogue.all.filter { $0.bandLo == band.0 && $0.bandHi == band.1 && (query.isEmpty || $0.title.lowercased().contains(query.lowercased())) }
                    BodyText(text: "\(list.count) activities for ages \(band.0) to \(band.1)", muted: true)
                    ForEach(list) { a in ActivityCard(space: sp, child: c, activity: a, why: nil) }
                }
            }
        }
        .navigationTitle("Activities")
        .task { if !ctx.loaded, let u = s.uid { await ctx.load(uid: u) } }
    }
}

struct DayPlanView: View {
    let space: SpaceSummary
    let child: ChildProfile
    @EnvironmentObject var ctx: CareContext
    @State private var plan: DayPlan?
    @State private var note: String?
    var picks: [ActivityEngine.Pick] {
        guard let plan else { return [] }
        return plan.activityIds.compactMap { id in
            Catalogue.all.first(where: { $0.id == id }).map { a in
                ActivityEngine.Pick(activity: a, why: plan.why[id] ?? "right for this age", allergyFlag: nil)
            }
        }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Heading(text: "Ready for today")
            if let plan, !picks.isEmpty {
                BodyText(text: "Made for \(child.name) before the day starts.", muted: true)
                ForEach(picks, id: \.activity.id) { p in ActivityCard(space: space, child: child, activity: p.activity, why: p.why) }
            } else {
                BodyText(text: "Nothing stands ready yet for \(child.name).", muted: true)
                BigButton(title: "Make today's plan for \(child.name)") { Task { await compose() } }
            }
            if let note { BodyText(text: note, muted: true) }
        }
        .task(id: child.id + CareTime.dayKey()) { await listen() }
    }
    func listen() async {
        plan = await CareRepo.dayPlan(spaceId: space.id, dayKey: CareTime.dayKey(), childId: child.id)
    }
    func compose() async {
        let picks = ActivityEngine.compose(child: child, allergyNames: ctx.allergyNames[child.id] ?? [], recentIds: [])
        var why: [String: String] = [:]
        for p in picks { why[p.activity.id] = p.why }
        let ok = await CareRepo.saveDayPlan(spaceId: space.id, dayKey: CareTime.dayKey(),
                                            childId: child.id, activityIds: picks.map(\.activity.id), why: why)
        note = SaveText.result(ok)
        // Buy-flagged materials roll into the shopping list (item 30).
        for p in picks {
            for m in p.activity.materials where m.buy {
                _ = await CareRepo.addShopping(spaceId: space.id, item: ShoppingItem(
                    name: m.name, childId: child.id, source: p.activity.title,
                    buyByName: "", due: "", bought: false, reimbursed: false))
            }
        }
    }
}

struct ActivityCard: View {
    let space: SpaceSummary
    let child: ChildProfile
    let activity: CatalogueActivity
    let why: String?
    @EnvironmentObject var ctx: CareContext
    @EnvironmentObject var s: Session
    @State private var note: String?
    var allergyFlag: String? {
        let names = ctx.allergyNames[child.id] ?? []
        guard !names.isEmpty else { return nil }
        let text = ([activity.title, activity.steps] + activity.materials.map(\.name)).joined(separator: " ")
        let result = AllergyChecker.check(text, allergies: names)
        switch result.status {
        case .contains: return "Allergy: names an allergy on \(child.name)'s list. Do not serve or use it. \(result.reasons.first ?? "")"
        case .mayContain: return "Allergy: may touch an allergy on \(child.name)'s list. Check first. \(result.reasons.first ?? "")"
        case .unknownIngredient: return "Allergy: an ingredient here is not known. Check before you start."
        case .noMatchFound: return nil
        }
    }
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Text(activity.title).font(Brand.body(19).weight(.semibold))
                HStack(spacing: 6) {
                    Pill(title: "\(activity.minutes) min", on: false)
                    Pill(title: activity.place, on: false)
                    if activity.free { Pill(title: "Free", on: false) }
                }
                if let why { Text("Picked because: \(why)").font(Brand.body(14)) }
                Text(activity.steps).font(Brand.body(15))
                if !activity.styles.isEmpty {
                    Text(activity.styles.joined(separator: " · ")).font(Brand.body(13))
                }
                if !activity.materials.isEmpty {
                    Text("You need: " + activity.materials.map { $0.name + ($0.buy ? " (to buy)" : "") }.joined(separator: ", "))
                        .font(Brand.body(14))
                }
                if !activity.warning.isEmpty {
                    Notice(text: activity.warning, warn: true)
                }
                if let flag = allergyFlag {
                    Notice(text: flag, warn: true)
                }
                BigButton(title: "We did this") {
                    Task {
                        do {
                            let ok = try await CareRepo.addItem(spaceId: space.id, kind: .activity, text: activity.title, childId: child.id, by: s.uid ?? "")
                            note = SaveText.result(ok)
                        } catch { note = "Could not save. Please try again." }
                    }
                }
                if let note { BodyText(text: note, muted: true) }
            }
        }
    }
}
