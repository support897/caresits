import Foundation
import FirebaseFirestore

let allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
let serviceLabels: [String: String] = ["nanny": "Nanny", "babysitter": "Babysitter", "au_pair": "Au pair"]

struct Person: Identifiable {
    let id: String
    var side: String
    var name: String
    var postcode: String
    var photoKey: String
    var about: String
    var card: [String: Any]
    var firstName: String { name.split(separator: " ").first.map(String.init) ?? name }
    var services: [String] { (card["careTypes"] as? [String]) ?? [] }
    var headline: String { (card["headline"] as? String) ?? "" }
    var suburb: String { (card["suburb"] as? String) ?? "" }
    var rate: Double { (card["rate"] as? NSNumber)?.doubleValue ?? 0 }
    var budgetMax: Double { (card["budgetMax"] as? NSNumber)?.doubleValue ?? 0 }
    var years: Int { (card["experienceYears"] as? NSNumber)?.intValue ?? 0 }
    var languages: [String] { (card["languages"] as? [String]) ?? [] }
    var gallery: [String] { (card["gallery"] as? [String]) ?? [] }
    var kids: [(name: String, age: Int)] {
        ((card["kids"] as? [[String: Any]]) ?? []).map { ($0["name"] as? String ?? "", ($0["ageYears"] as? NSNumber)?.intValue ?? 0) }
    }
    var days: [String] {
        let m = (card["availability"] as? [String: Any]) ?? (card["scheduleNeed"] as? [String: Any]) ?? [:]
        return allDays.filter { m[$0] != nil }
    }
    var role: Role {
        if side == "family" { return .family }
        switch services.first { case "babysitter": return .babysitter; case "au_pair": return .auPair; default: return .nanny }
    }
    init(id: String, data: [String: Any]) {
        self.id = id
        side = (data["side"] as? String) == "carer" ? "carer" : "family"
        name = (data["displayName"] as? String) ?? "Member"
        postcode = (data["postcode"] as? String) ?? ""
        photoKey = (data["photoUrl"] as? String) ?? ""
        about = (data["about"] as? String) ?? ""
        card = (data["card"] as? [String: Any]) ?? [:]
    }
}

struct Relationship: Identifiable {
    let id: String
    var familyUid: String
    var carerUid: String
    var state: String
    func other(_ me: String) -> String { me == familyUid ? carerUid : familyUid }
}

struct Booking: Identifiable {
    let id: String
    var pairId: String
    var familyUid: String
    var carerUid: String
    var date: String      // yyyy-MM-dd
    var from: String
    var to: String
    var rate: Double
    var estimate: Double
    var state: String
    var note: String
    var dateValue: Date { Booking.fmt.date(from: date) ?? .distantPast }
    static let fmt: DateFormatter = { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_AU"); return f }()
    var stateLabel: String {
        switch state { case "requested": return "Waiting"; case "accepted": return "Confirmed"; case "declined": return "Declined"; case "cancelled": return "Cancelled"; case "completed": return "Done"; default: return state.capitalized }
    }
    var stateIcon: BI {
        switch state { case "requested": return .clock; case "accepted": return .checkCircle; case "declined": return .banned; case "cancelled": return .cross; case "completed": return .sparkle; default: return .circle }
    }
}

struct ChatMessage: Identifiable { let id: String; var from: String; var text: String; var at: Date; var kind = "text"; var mediaKey = "" }

struct Resume {
    var summary = ""; var jobs: [String] = []; var education: [String] = []; var skills: [String] = []; var certificates: [String] = []
    var isEmpty: Bool { summary.isEmpty && jobs.isEmpty && education.isEmpty && skills.isEmpty && certificates.isEmpty }
}
extension Person: Hashable { static func == (a: Person, b: Person) -> Bool { a.id == b.id }; func hash(into h: inout Hasher) { h.combine(id) } }

/// Simple, honest match: care types, days and budget only. It never says anyone is safe.
struct MatchInfo { let percent: Int; let reasons: [(icon: BI, text: String)] }
extension Person {
    func match(with me: Person) -> MatchInfo {
        let fam = me.side == "family" ? me : self, car = me.side == "family" ? self : me
        let sv = Set(fam.services).intersection(car.services)
        let dy = Set(fam.days).intersection(car.days)
        let svScore = fam.services.isEmpty ? 0.5 : Double(sv.count) / Double(fam.services.count)
        let dyScore = fam.days.isEmpty || car.days.isEmpty ? 0.5 : min(1, Double(dy.count) / Double(max(1, min(fam.days.count, car.days.count))))
        let budgetOK = fam.budgetMax <= 0 || car.rate <= 0 || car.rate <= fam.budgetMax
        let pct = Int((40 * svScore + 30 * dyScore + (budgetOK ? 30 : 8)).rounded())
        var r: [(BI, String)] = []
        if !sv.isEmpty { r.append((.nanny, sv.map { serviceLabels[$0] ?? $0 }.sorted().joined(separator: ", "))) }
        if !dy.isEmpty { r.append((.calendar, dy.sorted().prefix(4).joined(separator: " "))) }
        if budgetOK && car.rate > 0 { r.append((.rate, "Fits budget")) }
        return MatchInfo(percent: min(100, pct), reasons: r)
    }
}
