import Foundation
import FirebaseFirestore

// MARK: Data layer for the care-day screens. Same Firestore paths as the web app, so one account works in both.
// Nothing here ever deletes user data. Only an explicit delete by the user would, and Phase 2 has none.

struct CareError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// Once-only flag for continuations (a write result and a timeout race each other).
final class OnceBox: @unchecked Sendable {
    private let lock = NSLock(); private var done = false
    func take() -> Bool { lock.lock(); defer { lock.unlock() }; if done { return false }; done = true; return true }
}

enum CareRepo {
    static var db: Firestore { Backend.db }
    static func space(_ id: String) -> DocumentReference { db.collection("careSpaces").document(id) }

    // MARK: small parsers
    static func date(_ any: Any?) -> Date? {
        if let t = any as? Timestamp { return t.dateValue() }
        if let s = any as? String { return CareTime.parse(s) }
        return nil
    }
    static func strings(_ any: Any?) -> [String] { (any as? [Any])?.compactMap { $0 as? String } ?? [] }

    /// Runs a write. Returns true when the server confirmed within `wait` seconds.
    /// False means the write is saved on this phone and will sync later. Errors throw.
    static func commit(wait: Double = 3, _ write: (@escaping (Error?) -> Void) -> Void) async throws -> Bool {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Bool, Error>) in
            let box = OnceBox()
            write { err in
                if box.take() { if let err = err { cont.resume(throwing: err) } else { cont.resume(returning: true) } }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + wait) { if box.take() { cont.resume(returning: false) } }
        }
    }

    // MARK: spaces
    static func loadSpaces(uid: String) async -> [SpaceSummary] {
        var found: [String: SpaceSummary] = [:]
        func consider(_ id: String) async {
            guard found[id] == nil,
                  let sp = try? await space(id).getDocument(), sp.exists,
                  let mem = try? await space(id).collection("members").document(uid).getDocument(), mem.exists,
                  let m = mem.data(), (m["status"] as? String ?? "active") == "active" else { return }
            let role = CareRole.from(m["role"])
            found[id] = SpaceSummary(id: id, name: sp.data()?["name"] as? String ?? "", ownerUid: sp.data()?["ownerUid"] as? String ?? "",
                                     role: role, perms: CarePerms.from(m["perms"], role: role), colorIndex: SpaceSummary.colorIndex(for: id))
        }
        if let snap = try? await db.collection("users").document(uid).collection("spaces").getDocuments() {
            for d in snap.documents { await consider(d.documentID) }
        }
        if let owned = try? await db.collection("careSpaces").whereField("ownerUid", isEqualTo: uid).getDocuments() {
            for d in owned.documents { await consider(d.documentID) }
        }
        await consider(uid)
        return found.values.sorted { $0.name.lowercased() < $1.name.lowercased() }
    }

    /// New space. The owner's saved name is used as is. An empty saved name stops here, with no stand in name.
    static func createSpace(uid: String, myName: String, spaceName: String) async throws {
        let mine = myName.trimmingCharacters(in: .whitespaces)
        let title = spaceName.trimmingCharacters(in: .whitespaces)
        guard !mine.isEmpty else { throw CareError(message: "Add your name in Profile first.") }
        guard !title.isEmpty else { throw CareError(message: "Give the space a name.") }
        let now = CareTime.iso(Date())
        let batch = db.batch()
        batch.setData(["ownerUid": uid, "name": title, "createdAt": now], forDocument: space(uid), merge: true)
        batch.setData(["role": "admin", "status": "active", "displayName": mine, "joinedAt": now, "invitedBy": uid,
                       "perms": ["allergies": true, "medication": true, "photos": true, "calendar": true, "privateMessages": true]],
                      forDocument: space(uid).collection("members").document(uid), merge: true)
        batch.setData(["spaceId": uid, "name": title, "joinedAt": now], forDocument: db.collection("users").document(uid).collection("spaces").document(uid), merge: true)
        _ = try await commit(wait: 8) { done in batch.commit(completion: done) }
    }

    static func members(spaceId: String) async -> [TeamMember] {
        guard let snap = try? await space(spaceId).collection("members").getDocuments() else { return [] }
        return snap.documents.map { d in
            let m = d.data()
            let role = CareRole.from(m["role"])
            return TeamMember(id: d.documentID, role: role, active: (m["status"] as? String ?? "active") == "active",
                              name: (m["displayName"] as? String) ?? "", perms: CarePerms.from(m["perms"], role: role))
        }
    }

    /// Item 9: a parent admin sets a member's role and permissions in
    /// the app. An invite can never make an admin, and neither can
    /// this — admins are made by the space owner only, outside here.
    @discardableResult
    static func setMemberAccess(spaceId: String, memberUid: String, role: CareRole, perms: CarePerms) async throws -> Bool {
        guard role != .admin else { throw CareError(message: "Access changes cannot make someone an admin.") }
        let ref = space(spaceId).collection("members").document(memberUid)
        return try await commit { done in
            ref.setData(["role": role.rawValue, "perms": CareInvite.permsData(CareInvite.effective(role, perms))], merge: true, completion: done)
        }
    }

    // MARK: children
    static func parseChild(_ d: DocumentSnapshot) -> ChildProfile? {
        guard let m = d.data(), let name = m["name"] as? String else { return nil }
        var c = ChildProfile(id: d.documentID, name: name, ageYears: (m["ageYears"] as? NSNumber)?.doubleValue ?? 0)
        c.interests = strings(m["interests"])
        let sec = m["sections"] as? [String: Any] ?? [:]
        for s in ChildSection.allCases { c.notes[s] = (sec[s.rawValue] as? [String: Any])?["notes"] as? String ?? "" }
        c.memories = strings(sec["memories"])
        c.foodPreferences = strings(m["foodPreferences"]); c.learningGoals = strings(m["learningGoals"])
        c.learningStyles = strings(m["learningStyles"]); c.learningLanguage = m["learningLanguage"] as? String ?? ""
        c.milestones = (m["milestones"] as? [[String: Any]] ?? []).compactMap { x in
            guard let t = x["title"] as? String else { return nil }
            return ChildMilestone(title: t, at: date(x["at"]) ?? Date(), note: x["note"] as? String ?? "", photoKey: x["photoKey"] as? String ?? "")
        }
        let r = m["routine"] as? [String: Any] ?? [:]
        c.wake = r["wake"] as? String ?? ""; c.bed = r["bed"] as? String ?? ""
        c.naps = (r["naps"] as? [[String: Any]] ?? []).map { ChildNap(from: $0["from"] as? String ?? "", to: $0["to"] as? String ?? "") }
        return c
    }

    static func children(spaceId: String) async -> [ChildProfile] {
        guard let snap = try? await space(spaceId).collection("children").getDocuments() else { return [] }
        return snap.documents.compactMap(parseChild).sorted { $0.name.lowercased() < $1.name.lowercased() }
    }

    static func childData(_ c: ChildProfile) -> [String: Any] {
        var sections: [String: Any] = [:]
        for s in ChildSection.allCases { sections[s.rawValue] = ["notes": String((c.notes[s] ?? "").prefix(2000))] }
        sections["memories"] = c.memories
        return [
            "name": c.name, "ageYears": c.ageYears, "interests": c.interests, "sections": sections,
            "foodPreferences": c.foodPreferences, "learningGoals": c.learningGoals, "learningStyles": c.learningStyles, "learningLanguage": c.learningLanguage,
            "milestones": c.milestones.map { m -> [String: Any] in var x: [String: Any] = ["title": m.title, "at": CareTime.iso(m.at), "note": m.note]; if !m.photoKey.isEmpty { x["photoKey"] = m.photoKey }; return x },
            "routine": ["wake": c.wake, "bed": c.bed, "naps": c.naps.map { ["from": $0.from, "to": $0.to] }]
        ]
    }

    @discardableResult
    static func saveChild(spaceId: String, child: ChildProfile, by uid: String) async throws -> Bool {
        var data = childData(child)
        data["updatedBy"] = uid; data["updatedAt"] = CareTime.iso(Date())
        let ref = space(spaceId).collection("children").document(child.id.isEmpty ? UUID().uuidString : child.id)
        return try await commit { done in ref.setData(data, merge: true, completion: done) }
    }

    // MARK: medical. Three separate records, one alert per save.
    static func medicalRef(_ spaceId: String, _ childId: String, _ section: MedicalSection) -> DocumentReference {
        space(spaceId).collection("medical").document(childId).collection(section.rawValue).document("main")
    }

    static func loadAllergies(spaceId: String, childId: String) async -> [AllergyRecord]? {
        guard let d = try? await medicalRef(spaceId, childId, .allergies).getDocument() else { return nil }
        return (d.data()?["items"] as? [[String: Any]] ?? []).map { AllergyRecord(name: $0["name"] as? String ?? "", severity: $0["severity"] as? String ?? "", notes: $0["notes"] as? String ?? "") }
    }
    static func loadMedication(spaceId: String, childId: String) async -> [MedicationRecord]? {
        guard let d = try? await medicalRef(spaceId, childId, .medication).getDocument() else { return nil }
        return (d.data()?["items"] as? [[String: Any]] ?? []).map { MedicationRecord(name: $0["name"] as? String ?? "", dose: $0["dose"] as? String ?? "", times: $0["times"] as? String ?? "", notes: $0["notes"] as? String ?? "") }
    }
    static func loadEmergency(spaceId: String, childId: String) async -> EmergencyRecord? {
        guard let d = try? await medicalRef(spaceId, childId, .emergency).getDocument() else { return nil }
        let m = d.data() ?? [:]
        return EmergencyRecord(contacts: (m["contacts"] as? [[String: Any]] ?? []).map { EmergencyContact(name: $0["name"] as? String ?? "", phone: $0["phone"] as? String ?? "", relationship: $0["relationship"] as? String ?? "") },
                               doctor: m["doctor"] as? String ?? "", notes: m["notes"] as? String ?? "")
    }

    /// Saves ONE medical section and its team alert together. Waits for the server. False = could not confirm yet.
    static func saveMedical(spaceId: String, child: ChildProfile, section: MedicalSection, payload: [String: Any], by uid: String) async throws -> Bool {
        let alertRef = space(spaceId).collection("alerts").document()
        let now = CareTime.iso(Date())
        var data = payload
        data["updatedBy"] = uid; data["updatedAt"] = now; data["alertId"] = alertRef.documentID
        let alert: [String: Any] = ["kind": "medical-change", "by": uid, "at": now,
                                    "summary": "Updated \(section.alertWord) details for \(child.name).",
                                    "childId": child.id, "section": section.rawValue, "recordId": "main"]
        let batch = db.batch()
        batch.setData(data, forDocument: medicalRef(spaceId, child.id, section), merge: false)
        batch.setData(alert, forDocument: alertRef)
        return try await commit(wait: 8) { done in batch.commit(completion: done) }
    }
    static func allergyPayload(_ items: [AllergyRecord]) -> [String: Any] {
        ["items": items.filter { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty }.map { ["name": $0.name, "severity": $0.severity, "notes": $0.notes] }]
    }
    static func medicationPayload(_ items: [MedicationRecord]) -> [String: Any] {
        ["items": items.filter { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty }.map { ["name": $0.name, "dose": $0.dose, "times": $0.times, "notes": $0.notes] }]
    }
    static func emergencyPayload(_ r: EmergencyRecord) -> [String: Any] {
        ["contacts": r.contacts.filter { !$0.name.isEmpty || !$0.phone.isEmpty }.map { ["name": $0.name, "phone": $0.phone, "relationship": $0.relationship] },
         "doctor": r.doctor, "notes": r.notes]
    }

    static func loadAlerts(spaceId: String) async -> [CareAlert] {
        guard let snap = try? await space(spaceId).collection("alerts").getDocuments() else { return [] }
        let cutoff = Date().addingTimeInterval(-7 * 86400)
        return snap.documents.compactMap { d -> CareAlert? in
            let m = d.data()
            guard (m["kind"] as? String) == "medical-change", let at = date(m["at"]), at > cutoff else { return nil }
            return CareAlert(id: d.documentID, summary: m["summary"] as? String ?? "", childId: m["childId"] as? String ?? "", section: m["section"] as? String ?? "", at: at)
        }.sorted { $0.at > $1.at }
    }

    // MARK: day story (Today timeline + daily report)
    static func parseItem(_ d: DocumentSnapshot) -> TimelineItem? {
        guard let m = d.data(), let kind = TimelineKind(rawValue: m["kind"] as? String ?? ""), let at = date(m["at"]) else { return nil }
        let asks = (m["asks"] as? [[String: Any]] ?? []).map {
            TimelineAsk(by: $0["by"] as? String ?? "", text: $0["text"] as? String ?? "", at: $0["at"] as? String ?? "",
                        answeredAt: $0["answeredAt"] as? String, answerText: $0["answerText"] as? String)
        }
        return TimelineItem(id: d.documentID, day: m["day"] as? String ?? "", kind: kind, at: at, text: m["text"] as? String ?? "",
                            childId: m["childId"] as? String, by: m["by"] as? String, mood: m["mood"] as? String, asks: asks, photoKey: m["photoKey"] as? String ?? "")
    }

    static func listenDay(spaceId: String, day: String, onChange: @escaping ([TimelineItem]) -> Void) -> ListenerRegistration {
        space(spaceId).collection("dayStory").whereField("day", isEqualTo: day).addSnapshotListener { snap, _ in
            guard let snap = snap else { return }
            onChange(snap.documents.compactMap(parseItem).sorted { $0.at < $1.at })
        }
    }

    @discardableResult
    static func addItem(spaceId: String, kind: TimelineKind, text: String, childId: String?, by uid: String, mood: String? = nil, photoKey: String? = nil) async throws -> Bool {
        var data: [String: Any] = ["day": CareTime.dayKey(), "kind": kind.rawValue, "at": CareTime.iso(Date()), "text": String(text.prefix(500)), "by": uid, "asks": []]
        if let c = childId, !c.isEmpty { data["childId"] = c }
        if let m = mood { data["mood"] = m }
        if let p = photoKey, !p.isEmpty { data["photoKey"] = p }
        let ref = space(spaceId).collection("dayStory").document()
        return try await commit { done in ref.setData(data, completion: done) }
    }

    static func saveAsks(spaceId: String, item: TimelineItem) async throws -> Bool {
        let asks = item.asks.map { a -> [String: Any] in
            var x: [String: Any] = ["by": a.by, "text": a.text, "at": a.at]
            if let t = a.answeredAt { x["answeredAt"] = t }
            if let t = a.answerText { x["answerText"] = t }
            return x
        }
        let ref = space(spaceId).collection("dayStory").document(item.id)
        return try await commit { done in ref.setData(["asks": asks], merge: true, completion: done) }
    }

    // MARK: chat
    static func listenMessages(spaceId: String, onChange: @escaping ([SpaceMessage]) -> Void) -> ListenerRegistration {
        space(spaceId).collection("messages").order(by: "at", descending: true).limit(to: 200).addSnapshotListener { snap, _ in
            guard let snap = snap else { return }
            let list = snap.documents.compactMap { d -> SpaceMessage? in
                let m = d.data()
                guard let text = m["text"] as? String, let at = date(m["at"]) else { return nil }
                return SpaceMessage(id: d.documentID, from: m["from"] as? String ?? "", text: text, at: at, queued: d.metadata.hasPendingWrites)
            }
            onChange(list.reversed())
        }
    }

    @discardableResult
    static func sendMessage(spaceId: String, text: String, from uid: String) async throws -> Bool {
        let clean = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(1000))
        guard !clean.isEmpty else { return true }
        let ref = space(spaceId).collection("messages").document()
        return try await commit { done in ref.setData(["from": uid, "text": clean, "at": CareTime.iso(Date()), "kind": "text"], completion: done) }
    }

    // Unread is kept on this phone, per user and per space.
    static func lastRead(uid: String, spaceId: String) -> Date {
        Date(timeIntervalSince1970: UserDefaults.standard.double(forKey: "carespace.read.\(uid).\(spaceId)"))
    }
    static func markRead(uid: String, spaceId: String) {
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "carespace.read.\(uid).\(spaceId)")
    }
    static func lastMessage(spaceId: String) async -> SpaceMessage? {
        guard let snap = try? await space(spaceId).collection("messages").order(by: "at", descending: true).limit(to: 1).getDocuments(),
              let d = snap.documents.first, let at = date(d.data()["at"]) else { return nil }
        return SpaceMessage(id: d.documentID, from: d.data()["from"] as? String ?? "", text: d.data()["text"] as? String ?? "", at: at)
    }

    // MARK: calendar
    static func events(space s: SpaceSummary) async -> [CalendarEvent] {
        guard let snap = try? await space(s.id).collection("calendar").getDocuments() else { return [] }
        return snap.documents.compactMap { d in
            let m = d.data()
            guard let kind = CalendarKind(rawValue: m["kind"] as? String ?? ""), let st = date(m["start"]), let en = date(m["end"]) else { return nil }
            return CalendarEvent(id: d.documentID, spaceId: s.id, spaceName: s.name, title: m["title"] as? String ?? kind.label, kind: kind, start: st, end: en,
                                 ownerUid: m["ownerUid"] as? String ?? "", childId: m["childId"] as? String,
                                 state: EventState(rawValue: m["state"] as? String ?? "active") ?? .active,
                                 recurring: parseRecurrence(m["recurring"]))
        }
    }

    static func parseRecurrence(_ any: Any?) -> CalendarRecurrence? {
        guard let r = any as? [String: Any], let until = r["until"] as? String else { return nil }
        let days = strings(r["weekdays"]).filter { CalendarRecurrence.names.contains($0) }
        return days.isEmpty ? nil : CalendarRecurrence(weekdays: days, until: until)
    }

    @discardableResult
    static func addEvent(spaceId: String, title: String, kind: CalendarKind, start: Date, end: Date, childId: String?, by uid: String, role: CareRole, recurring: CalendarRecurrence? = nil) async throws -> Bool {
        guard end > start else { throw CareError(message: "The end must be after the start.") }
        var data: [String: Any] = ["title": String(title.prefix(120)), "kind": kind.rawValue, "start": CareTime.iso(start), "end": CareTime.iso(end), "ownerUid": uid,
                                   "state": kind == .timeoff && role != .admin ? "requested" : "active"]
        if let c = childId, !c.isEmpty { data["childId"] = c }
        if let r = recurring {
            guard kind == .shift else { throw CareError(message: "Only shifts can repeat.") }
            guard CalendarRecurrence.valid(r, startDay: CareTime.dayKey(start)) else { throw CareError(message: "Choose at least one day, and an end date on or after the first shift.") }
            data["recurring"] = ["weekdays": r.weekdays, "until": r.until]
        }
        let ref = space(spaceId).collection("calendar").document()
        return try await commit { done in ref.setData(data, completion: done) }
    }

    /// Edits one saved event. For a repeating event the change covers the whole series. Nothing is deleted:
    /// ending a series only moves its last day earlier.
    static func updateEvent(spaceId: String, event: CalendarEvent) async throws -> Bool {
        guard event.end > event.start else { throw CareError(message: "The end must be after the start.") }
        var data: [String: Any] = ["title": String(event.title.prefix(120)), "kind": event.kind.rawValue,
                                   "start": CareTime.iso(event.start), "end": CareTime.iso(event.end)]
        if let r = event.recurring {
            guard CalendarRecurrence.valid(r, startDay: CareTime.dayKey(event.start)) else { throw CareError(message: "Choose at least one day, and an end date on or after the first shift.") }
            data["recurring"] = ["weekdays": r.weekdays, "until": r.until]
        }
        let ref = space(spaceId).collection("calendar").document(event.baseId)
        return try await commit { done in ref.setData(data, merge: true, completion: done) }
    }

    static func decide(spaceId: String, eventId: String, approve: Bool) async throws -> Bool {
        let ref = space(spaceId).collection("calendar").document(eventId)
        return try await commit { done in ref.setData(["state": approve ? "approved" : "declined"], merge: true, completion: done) }
    }
}

// MARK: Shared state for the tabs

@MainActor
final class CareContext: ObservableObject {
    @Published var spaces: [SpaceSummary] = []
    @Published var loaded = false
    @Published var events: [CalendarEvent] = []
    @Published var children: [String: [ChildProfile]] = [:]
    @Published var lastMessage: [String: SpaceMessage] = [:]
    @Published var allergyNames: [String: [String]] = [:]

    func load(uid: String) async {
        let list = await CareRepo.loadSpaces(uid: uid)
        spaces = list
        var ev: [CalendarEvent] = []; var ch: [String: [ChildProfile]] = [:]; var lm: [String: SpaceMessage] = [:]; var al: [String: [String]] = [:]
        for s in list {
            ev += await CareRepo.events(space: s)
            let kids = await CareRepo.children(spaceId: s.id)
            ch[s.id] = kids
            if CareAccess.canSeeChat(s.role, s.perms), let m = await CareRepo.lastMessage(spaceId: s.id) { lm[s.id] = m }
            if CareAccess.canReadAllergies(s.role, s.perms) {
                for k in kids { if let a = await CareRepo.loadAllergies(spaceId: s.id, childId: k.id) { al[k.id] = a.map { $0.name }.filter { !$0.isEmpty } } }
            }
        }
        events = ev; children = ch; lastMessage = lm; allergyNames = al
        loaded = true
    }
    func space(_ id: String) -> SpaceSummary? { spaces.first { $0.id == id } }
}

extension CareRepo {
    static func child(spaceId: String, id: String) async -> ChildProfile? {
        guard let d = try? await space(spaceId).collection("children").document(id).getDocument(), d.exists else { return nil }
        return parseChild(d)
    }
}

/// What every screen in a space needs, loaded once and kept live (Today and chat listen for changes).
@MainActor
final class SpaceModel: ObservableObject {
    let space: SpaceSummary
    let uid: String
    @Published var children: [ChildProfile] = []
    @Published var members: [TeamMember] = []
    @Published var alerts: [CareAlert] = []
    @Published var items: [TimelineItem] = []
    @Published var messages: [SpaceMessage] = []
    @Published var events: [CalendarEvent] = []
    /// Allergy names per child. A child is missing from this map when the viewer may not read allergies, or the read failed.
    @Published var allergyNames: [String: [String]] = [:]
    private var listeners: [ListenerRegistration] = []

    init(space: SpaceSummary, uid: String) { self.space = space; self.uid = uid }

    func load() async {
        async let c = CareRepo.children(spaceId: space.id)
        async let m = CareRepo.members(spaceId: space.id)
        async let a = CareRepo.loadAlerts(spaceId: space.id)
        async let e = CareRepo.events(space: space)
        children = await c; members = await m; alerts = await a; events = await e
        await loadAllergies()
    }

    func loadAllergies() async {
        var map: [String: [String]] = [:]
        if CareAccess.canReadAllergies(space.role, space.perms) {
            for ch in children {
                if let list = await CareRepo.loadAllergies(spaceId: space.id, childId: ch.id) {
                    map[ch.id] = list.map { $0.name }.filter { !$0.isEmpty }
                }
            }
        }
        allergyNames = map
    }

    func listen() {
        stop()
        listeners.append(CareRepo.listenDay(spaceId: space.id, day: CareTime.dayKey()) { [weak self] list in
            Task { @MainActor in self?.items = list }
        })
        if CareAccess.canSeeChat(space.role, space.perms) {
            listeners.append(CareRepo.listenMessages(spaceId: space.id) { [weak self] list in
                Task { @MainActor in self?.messages = list }
            })
        }
    }
    func stop() { listeners.forEach { $0.remove() }; listeners = [] }

    func name(of uid: String?, me: String) -> String {
        guard let uid = uid, !uid.isEmpty else { return "" }
        if uid == self.uid { return me }
        return members.first { $0.id == uid }?.shownName ?? CareRole.regular.label
    }
}


// MARK: - Item 18: the day's plan (composed once, stored, same on
// every phone) and item 30: shopping (the brief's own fields).

struct DayPlan: Equatable {
    var childId: String
    var activityIds: [String]
    var why: [String: String]
}

struct ShoppingItem: Identifiable, Equatable {
    var id: String = ""
    var name: String
    var childId: String?
    var source: String
    var buyByName: String
    var due: String
    var bought: Bool
    var reimbursed: Bool
}

extension CareRepo {
    static func dayPlan(spaceId: String, dayKey: String, childId: String) async -> DayPlan? {
        guard let snap = try? await space(spaceId).collection("dayPlans").document(dayKey).getDocument(),
              let m = snap.data() else { return nil }
        let byChild = m["byChild"] as? [String: Any] ?? [:]
        guard let mine = byChild[childId] as? [String: Any] else { return nil }
        return DayPlan(childId: childId,
                       activityIds: mine["activityIds"] as? [String] ?? [],
                       why: mine["why"] as? [String: String] ?? [:])
    }

    @discardableResult
    static func saveDayPlan(spaceId: String, dayKey: String, childId: String, activityIds: [String], why: [String: String]) async -> Bool {
        let ref = space(spaceId).collection("dayPlans").document(dayKey)
        let data: [String: Any] = ["byChild": [childId: ["activityIds": activityIds, "why": why]],
                                   "updatedAt": FieldValue.serverTimestamp()]
        return (try? await commit { done in ref.setData(data, merge: true, completion: done) }) ?? false
    }

    static func shopping(spaceId: String) async -> [ShoppingItem] {
        guard let snap = try? await space(spaceId).collection("shopping")
            .order(by: "at", descending: false).getDocuments() else { return [] }
        return snap.documents.map { d in
            let m = d.data()
            return ShoppingItem(id: d.documentID, name: m["name"] as? String ?? "",
                                childId: m["childId"] as? String, source: m["source"] as? String ?? "",
                                buyByName: m["buyByName"] as? String ?? "", due: m["due"] as? String ?? "",
                                bought: m["bought"] as? Bool ?? false, reimbursed: m["reimbursed"] as? Bool ?? false)
        }
    }

    @discardableResult
    static func addShopping(spaceId: String, item: ShoppingItem) async -> Bool {
        let ref = space(spaceId).collection("shopping").document()
        var data: [String: Any] = ["name": item.name, "source": item.source,
            "buyByName": item.buyByName, "due": item.due, "bought": item.bought,
            "reimbursed": item.reimbursed, "at": FieldValue.serverTimestamp()]
        if let c = item.childId { data["childId"] = c }
        return (try? await commit { done in ref.setData(data, completion: done) }) ?? false
    }

    @discardableResult
    static func updateShopping(spaceId: String, item: ShoppingItem) async -> Bool {
        let ref = space(spaceId).collection("shopping").document(item.id)
        return (try? await commit { done in ref.setData(["bought": item.bought, "reimbursed": item.reimbursed], merge: true, completion: done) }) ?? false
    }
}


// MARK: - Item 29: the recently-deleted bin (day items).

struct DeletedEntry: Identifiable, Equatable {
    var id: String
    var kind: String
    var text: String
    var day: String
    var childId: String?
    var deletedAt: Date
    var payload: [String: Any]
    static func == (a: DeletedEntry, b: DeletedEntry) -> Bool { a.id == b.id }
}

extension CareRepo {
    /// Move a day item into the bin, then remove it from the day.
    /// Nothing is lost: the whole record rides in the payload.
    @discardableResult
    static func deleteItemToBin(spaceId: String, item: TimelineItem) async -> Bool {
        var payload: [String: Any] = ["kind": item.kind.rawValue, "text": item.text, "day": item.day,
                                      "at": CareTime.iso(item.at), "photoKey": item.photoKey]
        if let c = item.childId { payload["childId"] = c }
        if let b = item.by { payload["by"] = b }
        if let m = item.mood { payload["mood"] = m }
        let bin = space(spaceId).collection("deleted").document(item.id)
        let okBin = (try? await commit { done in bin.setData(["payload": payload, "deletedAt": FieldValue.serverTimestamp(),
                                                              "kind": item.kind.rawValue, "text": item.text], completion: done) }) ?? false
        guard okBin else { return false }
        let ref = space(spaceId).collection("dayStory").document(item.id)
        return (try? await commit { done in ref.delete(completion: done) }) ?? false
    }

    static func deletedEntries(spaceId: String) async -> [DeletedEntry] {
        guard let snap = try? await space(spaceId).collection("deleted")
            .order(by: "deletedAt", descending: true).getDocuments() else { return [] }
        let cutoff = Date().addingTimeInterval(-30 * 24 * 3600)
        return snap.documents.compactMap { d in
            let m = d.data()
            let at = (m["deletedAt"] as? Timestamp)?.dateValue() ?? Date.distantPast
            guard at >= cutoff else { return nil }
            let payload = m["payload"] as? [String: Any] ?? [:]
            return DeletedEntry(id: d.documentID, kind: m["kind"] as? String ?? "",
                                text: m["text"] as? String ?? "", day: payload["day"] as? String ?? "",
                                childId: payload["childId"] as? String, deletedAt: at, payload: payload)
        }
    }

    @discardableResult
    static func restoreDeleted(spaceId: String, entry: DeletedEntry) async -> Bool {
        var data = entry.payload
        data["restoredAt"] = FieldValue.serverTimestamp()
        let ref = space(spaceId).collection("dayStory").document(entry.id)
        let ok = (try? await commit { done in ref.setData(data, completion: done) }) ?? false
        if ok { _ = await purgeDeleted(spaceId: spaceId, entry: entry) }
        return ok
    }

    @discardableResult
    static func purgeDeleted(spaceId: String, entry: DeletedEntry) async -> Bool {
        let ref = space(spaceId).collection("deleted").document(entry.id)
        return (try? await commit { done in ref.delete(completion: done) }) ?? false
    }
}


// MARK: - Item 20: a photo ask answered with the photo itself.

extension CareRepo {
    @discardableResult
    static func answerPhotoAsk(spaceId: String, item: TimelineItem, photoKey: String) async -> Bool {
        var asks = item.asks
        for i in asks.indices where !asks[i].answered {
            asks[i].answeredAt = CareTime.iso(Date())
            asks[i].answerText = "Photo sent"
        }
        let data: [String: Any] = ["photoKey": photoKey,
                                   "asks": asks.map { ["by": $0.by, "text": $0.text, "at": $0.at,
                                                       "answeredAt": $0.answeredAt as Any, "answerText": $0.answerText as Any] }]
        let ref = space(spaceId).collection("dayStory").document(item.id)
        return (try? await commit { done in ref.setData(data, merge: true, completion: done) }) ?? false
    }
}
