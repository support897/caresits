import Foundation

// MARK: Roles and permissions (ported from the web app's data/children.ts, data/medical.ts, lib/permissions.ts)

enum CareRole: String, CaseIterable {
    case admin, regular, limited, viewer
    static func from(_ raw: Any?) -> CareRole { (raw as? String).flatMap { CareRole(rawValue: $0) } ?? .viewer }
    /// A role word, never a person's name. Used only where a member has no saved name.
    var label: String {
        switch self {
        case .admin: return "Family admin"
        case .regular: return "Carer"
        case .limited: return "Limited carer"
        case .viewer: return "Family viewer"
        }
    }
}

struct CarePerms: Equatable {
    var allergies = false
    var medication = false
    var photos = false
    var calendar = true
    var privateMessages = true

    static let all = CarePerms(allergies: true, medication: true, photos: true, calendar: true, privateMessages: true)

    /// Medical access is closed unless the member record opens it. Calendar and chat stay open unless a member record closes them.
    static func from(_ raw: Any?, role: CareRole) -> CarePerms {
        if role == .admin { return .all }
        var p = CarePerms()
        if let list = raw as? [Any] {
            let set = Set(list.map { "\($0)" })
            if set.contains("all") { return .all }
            p.allergies = set.contains("allergies"); p.medication = set.contains("medication"); p.photos = set.contains("photos")
            p.calendar = set.contains("calendar"); p.privateMessages = set.contains("privateMessages")
        } else if let d = raw as? [String: Any] {
            if let v = d["allergies"] as? Bool { p.allergies = v }
            if let v = d["medication"] as? Bool { p.medication = v }
            if let v = d["photos"] as? Bool { p.photos = v }
            if let v = d["calendar"] as? Bool { p.calendar = v }
            if let v = d["privateMessages"] as? Bool { p.privateMessages = v }
        }
        return p
    }
}

enum CareAccess {
    static func canPost(_ role: CareRole) -> Bool { role != .viewer }
    static func canSeeChat(_ role: CareRole, _ perms: CarePerms) -> Bool { role == .admin || (role != .viewer && perms.privateMessages) }
    static func canReadAllergies(_ role: CareRole, _ perms: CarePerms) -> Bool { role == .admin || perms.allergies }
    static func canReadMedication(_ role: CareRole, _ perms: CarePerms) -> Bool { role == .admin || perms.medication }
    static func canReadEmergency(_ role: CareRole, _ perms: CarePerms) -> Bool { role == .admin }
    static func canReadMedical(_ role: CareRole, _ perms: CarePerms) -> Bool {
        canReadAllergies(role, perms) || canReadMedication(role, perms) || canReadEmergency(role, perms)
    }
    static func canWriteMedical(_ role: CareRole) -> Bool { role == .admin }
    static func canEditNotes(_ role: CareRole) -> Bool { role == .admin || role == .regular }
    static func canEditChildDetails(_ role: CareRole) -> Bool { role == .admin }
    static func canManageTimeOff(_ role: CareRole) -> Bool { role == .admin }
}

// MARK: Spaces

struct SpaceSummary: Identifiable, Equatable {
    let id: String
    var name: String
    var ownerUid: String
    var role: CareRole
    var perms: CarePerms
    var colorIndex: Int
    static func colorIndex(for id: String) -> Int { id.unicodeScalars.reduce(0) { $0 + Int($1.value) } % 4 }
}

struct TeamMember: Identifiable, Equatable {
    let id: String
    var role: CareRole
    var active: Bool
    /// The member's own saved name, or empty. Never a stand in name.
    var name: String
    var shownName: String { name.isEmpty ? role.label : name }
}

// MARK: Children

enum ChildSection: String, CaseIterable, Identifiable {
    case health, meals, sleep, mood, learning
    var id: String { rawValue }
    var title: String {
        switch self {
        case .health: return "Health and safety"
        case .meals: return "Meals"
        case .sleep: return "Sleep and routine"
        case .mood: return "Mood"
        case .learning: return "Learning"
        }
    }
    var hint: String {
        switch self {
        case .health: return "General care notes only. Allergies, medicine and emergency details stay in Medical."
        case .meals: return "Food preferences, meal plans, ingredients and water notes."
        case .sleep: return "Rest times, wake up notes and bedtime routines."
        case .mood: return "Comfort, energy and changes to share with the family."
        case .learning: return "Interests, learning goals and favourite activities."
        }
    }
    var icon: String {
        switch self {
        case .health: return "shield"
        case .meals: return "meal"
        case .sleep: return "nap"
        case .mood: return "mood"
        case .learning: return "activity"
        }
    }
}

struct ChildNap: Equatable, Identifiable {
    let id = UUID()
    var from: String
    var to: String
    static func == (a: ChildNap, b: ChildNap) -> Bool { a.from == b.from && a.to == b.to }
}

struct ChildMilestone: Equatable {
    var title: String
    var at: Date
    var note: String
}

struct ChildProfile: Identifiable, Equatable {
    var id: String
    var name: String
    var ageYears: Double
    var interests: [String] = []
    var notes: [ChildSection: String] = [:]
    var memories: [String] = []
    var foodPreferences: [String] = []
    var learningGoals: [String] = []
    var milestones: [ChildMilestone] = []
    var wake = ""
    var bed = ""
    var naps: [ChildNap] = []
    var ageText: String { ageYears == ageYears.rounded() ? "\(Int(ageYears))" : String(format: "%.1f", ageYears) }
}

enum CareText {
    /// Splits "a, b" or lines into a clean list: trimmed, no repeats, capped.
    static func list(_ value: String, maxItems: Int, maxLength: Int) -> [String] {
        var seen = Set<String>(); var out: [String] = []
        for raw in value.split(whereSeparator: { $0 == "," || $0 == "\n" }) {
            let item = String(String(raw).trimmingCharacters(in: .whitespaces).prefix(maxLength))
            let key = item.lowercased()
            if item.isEmpty || seen.contains(key) || out.count >= maxItems { continue }
            seen.insert(key); out.append(item)
        }
        return out
    }
    static func isTime(_ v: String) -> Bool {
        v.range(of: "^([01][0-9]|2[0-3]):[0-5][0-9]$", options: .regularExpression) != nil
    }
}

// MARK: Medical. Three separate records. Never one combined document.

struct AllergyRecord: Equatable, Identifiable { let id = UUID(); var name = ""; var severity = ""; var notes = ""
    static func == (a: AllergyRecord, b: AllergyRecord) -> Bool { a.name == b.name && a.severity == b.severity && a.notes == b.notes } }
struct MedicationRecord: Equatable, Identifiable { let id = UUID(); var name = ""; var dose = ""; var times = ""; var notes = ""
    static func == (a: MedicationRecord, b: MedicationRecord) -> Bool { a.name == b.name && a.dose == b.dose && a.times == b.times && a.notes == b.notes } }
struct EmergencyContact: Equatable, Identifiable { let id = UUID(); var name = ""; var phone = ""; var relationship = ""
    static func == (a: EmergencyContact, b: EmergencyContact) -> Bool { a.name == b.name && a.phone == b.phone && a.relationship == b.relationship } }
struct EmergencyRecord: Equatable { var contacts: [EmergencyContact] = []; var doctor = ""; var notes = "" }

enum MedicalSection: String, CaseIterable, Identifiable {
    case allergies, medication, emergency
    var id: String { rawValue }
    var title: String { switch self { case .allergies: return "Allergies"; case .medication: return "Medication"; case .emergency: return "Emergency details" } }
    var alertWord: String { switch self { case .allergies: return "allergy"; case .medication: return "medication"; case .emergency: return "emergency" } }
    var icon: String { switch self { case .allergies: return "shield"; case .medication: return "pills"; case .emergency: return "phone" } }
}

struct CareAlert: Identifiable, Equatable {
    let id: String
    var summary: String
    var childId: String
    var section: String
    var at: Date
}

// MARK: Day story (Today timeline and the daily report share one collection, as on the web)

enum TimelineKind: String, CaseIterable {
    case arrival, meal, drink, nap, activity, mood, photo, pickup, note
    var label: String { rawValue.capitalized }
    var icon: String {
        switch self {
        case .arrival: return "arrive"
        case .meal: return "meal"
        case .drink: return "drink"
        case .nap: return "nap"
        case .activity: return "activity"
        case .mood: return "mood"
        case .photo: return "photo"
        case .pickup: return "pickup"
        case .note: return "note"
        }
    }
}

struct TimelineAsk: Equatable {
    var by: String
    var text: String
    var at: String
    var answeredAt: String?
    var answerText: String?
    var answered: Bool { answeredAt != nil }
}

struct TimelineItem: Identifiable, Equatable {
    var id: String
    var day: String
    var kind: TimelineKind
    var at: Date
    var text: String
    var childId: String?
    var by: String?
    var mood: String?
    var asks: [TimelineAsk] = []
}

enum CareTime {
    static let isoOut: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    static let isoPlain: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f }()
    static func iso(_ d: Date) -> String { isoOut.string(from: d) }
    static func parse(_ s: String) -> Date? { isoOut.date(from: s) ?? isoPlain.date(from: s) }
    static func dayKey(_ d: Date = Date()) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
    static func clock(_ d: Date) -> String { d.formatted(date: .omitted, time: .shortened) }
}

enum CareTimeline {
    /// Items for one child, plus items not tied to any child, oldest first.
    static func items(_ all: [TimelineItem], forChild childId: String?) -> [TimelineItem] {
        all.filter { $0.childId == nil || $0.childId == "" || $0.childId == childId || childId == nil }.sorted { $0.at < $1.at }
    }
    static func attach(_ item: TimelineItem, ask: TimelineAsk) -> TimelineItem { var n = item; n.asks.append(ask); return n }
    static func answer(_ item: TimelineItem, index: Int, text: String) -> TimelineItem? {
        guard item.asks.indices.contains(index) else { return nil }
        var n = item
        n.asks[index].answeredAt = CareTime.iso(Date()); n.asks[index].answerText = text
        return n
    }
}

// MARK: Chats

struct SpaceMessage: Identifiable, Equatable {
    var id: String
    var from: String
    var text: String
    var at: Date
    var queued = false
}

// MARK: Calendar

enum CalendarKind: String, CaseIterable, Identifiable {
    case booking, shift, school, activity, pickup, timeoff
    var id: String { rawValue }
    var label: String { self == .timeoff ? "Time off" : rawValue.capitalized }
    var icon: String {
        switch self {
        case .booking: return "cal"
        case .shift: return "clock"
        case .school: return "activity"
        case .activity: return "sun"
        case .pickup: return "pickup"
        case .timeoff: return "nap"
        }
    }
}

enum EventState: String { case active, requested, approved, declined, swap }

struct CalendarEvent: Identifiable, Equatable {
    var id: String
    var spaceId: String
    var spaceName = ""
    var title: String
    var kind: CalendarKind
    var start: Date
    var end: Date
    var ownerUid: String
    var childId: String?
    var state: EventState
}

enum CareCalendar {
    static func events(_ all: [CalendarEvent], on day: Date) -> [CalendarEvent] {
        all.filter { Calendar.current.isDate($0.start, inSameDayAs: day) }.sorted { $0.start < $1.start }
    }
    /// Cells for a month grid: leading blanks, then each day.
    static func cells(for month: Date) -> [Date?] {
        let cal = Calendar.current
        guard let first = cal.date(from: cal.dateComponents([.year, .month], from: month)),
              let range = cal.range(of: .day, in: .month, for: first) else { return [] }
        let lead = cal.component(.weekday, from: first) - 1
        var out: [Date?] = Array(repeating: nil, count: lead)
        for d in range { out.append(cal.date(byAdding: .day, value: d - 1, to: first)) }
        return out
    }
    /// The next event that has not started yet, today or later today.
    static func nextUp(_ all: [CalendarEvent], now: Date = Date()) -> CalendarEvent? {
        events(all, on: now).first { $0.start >= now && $0.state != .declined && $0.kind != .timeoff }
    }
    static func period(day: Date, startTime: Date, endTime: Date) -> (Date, Date) {
        let cal = Calendar.current
        func merge(_ t: Date) -> Date {
            let a = cal.dateComponents([.year, .month, .day], from: day); let b = cal.dateComponents([.hour, .minute], from: t)
            return cal.date(from: DateComponents(year: a.year, month: a.month, day: a.day, hour: b.hour, minute: b.minute)) ?? day
        }
        return (merge(startTime), merge(endTime))
    }
}
