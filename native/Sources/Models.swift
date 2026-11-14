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
    var looking: [String: Any] = [:]
    var nationality: String { (card["nationality"] as? String) ?? "" }
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
        looking = (data["looking"] as? [String: Any]) ?? [:]
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
    var cancelledBy = ""          // set by the server when it records who cancelled; the app only reads it
    var pay: PayInfo? = nil       // set by the payment service once it is live; the app only reads it
    var dateValue: Date { Booking.fmt.date(from: date) ?? .distantPast }
    static let fmt: DateFormatter = { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_AU"); return f }()
    var stateLabel: String {
        switch state { case "requested": return "Waiting"; case "accepted": return "Confirmed"; case "declined": return "Declined"; case "cancelled": return "Cancelled"; case "completed": return "Done"; default: return state.capitalized }
    }
    var stateIcon: BI {
        switch state { case "requested": return .clock; case "accepted": return .checkCircle; case "declined": return .banned; case "cancelled": return .cross; case "completed": return .sparkle; default: return .circle }
    }
}

/// What the payment service says about one booking. Read only here. No number is ever worked out or assumed in the app.
struct PayInfo {
    var state: String            // held, released, refunded, partRefunded, disputed
    var amount: Double?; var refunded: Double?; var appFee: Double?; var processingFee: Double?
    var autoReleaseAt: String; var releasedAt: String
    init?(_ d: [String: Any]?) {
        guard let d, let s = d["state"] as? String else { return nil }
        state = s
        func n(_ k: String) -> Double? { (d[k] as? NSNumber)?.doubleValue }
        amount = n("amount"); refunded = n("refunded"); appFee = n("appFee"); processingFee = n("processingFee")
        autoReleaseAt = d["autoReleaseAt"] as? String ?? ""; releasedAt = d["releasedAt"] as? String ?? ""
    }
}

/// Finished of booked, as the server counts it. Absent means the carer is new: nothing is invented.
struct Completion {
    let finished: Int; let booked: Int
    var text: String { "Finished \(finished) of \(booked) bookings" }
}
extension Person {
    var completion: Completion? {
        guard let m = card["completion"] as? [String: Any], let b = (m["booked"] as? NSNumber)?.intValue, b > 0 else { return nil }
        return Completion(finished: (m["finished"] as? NSNumber)?.intValue ?? 0, booked: b)
    }
    /// The words shown on a carer's profile and deck card.
    var completionText: String { side == "carer" ? (completion?.text ?? "New here") : "" }
}

struct ChatMessage: Identifiable { let id: String; var from: String; var text: String; var at: Date; var kind = "text"; var mediaKey = "" }

struct Resume {
    var summary = ""; var jobs: [String] = []; var education: [String] = []; var skills: [String] = []; var certificates: [String] = []
    var isEmpty: Bool { summary.isEmpty && jobs.isEmpty && education.isEmpty && skills.isEmpty && certificates.isEmpty }
}
extension Person: Hashable { static func == (a: Person, b: Person) -> Bool { a.id == b.id }; func hash(into h: inout Hasher) { h.combine(id) } }

/// Simple, honest match: care types, days and budget only. It never says anyone is safe.
/// A missing answer is never counted as a good sign: it adds nothing, and it caps the score at 85.
struct MatchInfo { let percent: Int; let reasons: [(icon: BI, text: String)] }
extension Person {
    func match(with me: Person) -> MatchInfo {
        let fam = me.side == "family" ? me : self, car = me.side == "family" ? self : me
        var got = 0.0, total = 0.0, unknown = false
        var r: [(BI, String)] = []
        if fam.services.isEmpty { unknown = true } else {
            let sv = Set(fam.services).intersection(car.services)
            total += 40; got += 40 * Double(sv.count) / Double(fam.services.count)
            if !sv.isEmpty { r.append((.nanny, "Care type: " + sv.map { serviceLabels[$0] ?? $0 }.sorted().joined(separator: ", "))) }
        }
        if fam.days.isEmpty || car.days.isEmpty { unknown = true } else {
            let dy = Set(fam.days).intersection(car.days)
            total += 30; got += 30 * min(1, Double(dy.count) / Double(max(1, min(fam.days.count, car.days.count))))
            if !dy.isEmpty { r.append((.calendar, "Shared days: " + allDays.filter { dy.contains($0) }.prefix(4).joined(separator: " "))) }
        }
        if fam.budgetMax <= 0 || car.rate <= 0 { unknown = true } else {
            total += 30
            if car.rate <= fam.budgetMax { got += 30; r.append((.rate, "Rate fits the budget")) } else { r.append((.rate, "Rate is above the budget")) }
        }
        var pct = total > 0 ? Int((got / total * 100).rounded()) : 0
        if unknown { pct = min(pct, 85); r.append((.info, "Some answers are missing")) }
        return MatchInfo(percent: min(100, pct), reasons: r)
    }
}
