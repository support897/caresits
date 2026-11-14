import Foundation
import SwiftUI
import UIKit
import ImageIO
import PhotosUI
import CoreTransferable
import UniformTypeIdentifiers
import FirebaseAuth
import FirebaseFirestore

enum AppError: LocalizedError {
    case msg(String)
    var errorDescription: String? { if case .msg(let m) = self { return m }; return nil }
}

enum Backend {
    static var db: Firestore { Firestore.firestore() }
    static func pairId(_ a: String, _ b: String) -> String { a < b ? "\(a)_\(b)" : "\(b)_\(a)" }

    // MARK: Profiles
    static func loadProfile(_ uid: String) async -> Person? {
        guard let s = try? await db.collection("profiles").document(uid).getDocument(), s.exists, let d = s.data() else { return nil }
        let p = Person(id: uid, data: d); cacheProfile(p); return p
    }
    /// Profiles already read in this run. Lists paint from these first.
    /// Every touch holds the lock: loadProfiles reads and writes this cache from parallel tasks,
    /// and an unguarded Dictionary write from two tasks at once corrupts the heap
    /// (crash of record 14 Nov 2026, Caresitters-2026-11-14-175326.ips, faulting in loadProfile).
    static var profileCache: [String: Person] = [:]
    private static let profileCacheLock = NSLock()
    static func cacheProfile(_ p: Person) { profileCacheLock.lock(); profileCache[p.id] = p; profileCacheLock.unlock() }
    static func cachedProfile(_ uid: String) -> Person? { profileCacheLock.lock(); defer { profileCacheLock.unlock() }; return profileCache[uid] }
    /// Many profiles at once (one trip each, all in parallel), so a list never waits on a chain.
    static func loadProfiles(_ ids: [String]) async -> [String: Person] {
        await withTaskGroup(of: (String, Person?).self) { g in
            for id in Set(ids) { g.addTask { if let c = cachedProfile(id) { return (id, c) }; return (id, await loadProfile(id)) } }
            var out: [String: Person] = [:]
            for await (id, p) in g { if let p { out[id] = p } }
            return out
        }
    }

    /// Merge a patch into the profile document. The card is merged one level deep.
    static func saveProfile(_ uid: String, side: String? = nil, name: String? = nil, postcode: String? = nil, photoKey: String? = nil, about: String? = nil, card: [String: Any] = [:], looking: [String: [String: Any]] = [:]) async throws {
        let ref = db.collection("profiles").document(uid)
        let cur = (try? await ref.getDocument().data()) ?? [:]
        var next: [String: Any] = [:]
        for k in ["side", "displayName", "postcode", "photoUrl", "about", "looking", "level", "learningPlan"] { if let v = cur[k] { next[k] = v } }
        // The rules need a looking map with musts and prefs on every profile write.
        if next["looking"] == nil { next["looking"] = ["musts": [String: Any](), "prefs": [String: Any]()] }
        if !looking.isEmpty {
            let cl = (next["looking"] as? [String: Any]) ?? [:]
            var m = (cl["musts"] as? [String: Any]) ?? [:], pr = (cl["prefs"] as? [String: Any]) ?? [:]
            for (k, v) in looking["musts"] ?? [:] { if v is FieldValue { m.removeValue(forKey: k) } else { m[k] = v } }
            for (k, v) in looking["prefs"] ?? [:] { if v is FieldValue { pr.removeValue(forKey: k) } else { pr[k] = v } }
            next["looking"] = ["musts": m, "prefs": pr]
        }
        if let side { next["side"] = side }
        if let name { next["displayName"] = name }
        if let postcode { next["postcode"] = postcode }
        if let photoKey { next["photoUrl"] = photoKey }
        if let about { next["about"] = String(about.prefix(300)) }
        var c = (cur["card"] as? [String: Any]) ?? [:]
        for (k, v) in card { if v is FieldValue { c.removeValue(forKey: k) } else { c[k] = v } }
        next["card"] = c
        next["updatedAt"] = FieldValue.serverTimestamp()
        try await ref.setData(next)
    }

    static func deleteAccount(_ uid: String) async throws {
        guard !uid.isEmpty else { return }
        try await db.collection("profiles").document(uid).delete()
        try await Auth.auth().currentUser?.delete()
    }

    // MARK: Discover
    /// One query per service (rules need side and careTypes). Results are merged and de-duplicated.
    static func discover(me: Person, services: [String]) async -> [Person] {
        let opposite = me.side == "family" ? "carer" : "family"
        var seen: [String: Person] = [:]
        for svc in services {
            let q = db.collection("profiles").whereField("side", isEqualTo: opposite).whereField("card.careTypes", arrayContains: svc).limit(to: 100)
            if let snap = try? await q.getDocuments() {
                for d in snap.documents where d.documentID != me.id { seen[d.documentID] = Person(id: d.documentID, data: d.data()) }
            }
        }
        return seen.values.sorted { $0.name < $1.name }
    }

    static func verifiedLevel(_ uid: String) async -> String? {
        guard let s = try? await db.collection("verified").document(uid).getDocument(), s.exists, let d = s.data() else { return nil }
        let status = (d["status"] as? String)?.lowercased() ?? ""
        if !status.isEmpty && status != "verified" { return nil }
        return status == "verified" ? "verified" : ((d["level"] as? String) ?? (d["checksLevel"] as? String))
    }

    static func reviewSummary(_ uid: String) async -> (avg: Double, count: Int)? {
        guard let s = try? await db.collection("reviewSummaries").document(uid).getDocument(), let d = s.data() else { return nil }
        let count = (d["count"] as? NSNumber)?.intValue ?? 0
        let avg = (d["average"] as? NSNumber)?.doubleValue ?? (d["avg"] as? NSNumber)?.doubleValue ?? 0
        return count > 0 ? (avg, count) : nil
    }

    // MARK: Saved
    static func savedIds(_ uid: String) async -> Set<String> {
        guard let snap = try? await db.collection("users").document(uid).collection("saved").getDocuments() else { return [] }
        return Set(snap.documents.map { $0.documentID })
    }
    static func setSaved(_ uid: String, _ other: String, _ on: Bool) async {
        let ref = db.collection("users").document(uid).collection("saved").document(other)
        if on { try? await ref.setData(["at": FieldValue.serverTimestamp()]) } else { try? await ref.delete() }
    }

    // MARK: Relationships and chat
    static func relationships(_ uid: String, side: String) async -> [Relationship] {
        let f = side == "family" ? "familyUid" : "carerUid"
        guard let snap = try? await db.collection("relationships").whereField(f, isEqualTo: uid).getDocuments() else { return [] }
        return snap.documents.map { Relationship(id: $0.documentID, familyUid: $0.data()["familyUid"] as? String ?? "", carerUid: $0.data()["carerUid"] as? String ?? "", state: $0.data()["state"] as? String ?? "") }
    }

    static let chatWindow = 40
    static func chatMessage(_ d: QueryDocumentSnapshot) -> ChatMessage {
        let x = d.data()
        return ChatMessage(id: d.documentID, from: x["from"] as? String ?? "", text: x["text"] as? String ?? "", at: (x["at"] as? Timestamp)?.dateValue() ?? Date(), kind: x["kind"] as? String ?? "text", mediaKey: x["mediaKey"] as? String ?? "")
    }
    /// Only the latest window of a chat is listened to (newest 40), so opening a long chat never waits on the whole history,
    /// and a new message delivers one row, not the whole set. Older rows come on request through `olderMessages`.
    /// The phone's own copy paints first when it has one.
    static func listenMessages(_ relId: String, _ cb: @escaping ([ChatMessage]) -> Void) -> ListenerRegistration {
        db.collection("relationships").document(relId).collection("messages").order(by: "at", descending: true).limit(to: chatWindow).addSnapshotListener { snap, _ in
            let rows = (snap?.documents ?? []).map(chatMessage).reversed() as [ChatMessage]
            cb(rows)
        }
    }
    /// The next older page, before the oldest row already shown.
    static func olderMessages(_ relId: String, before: Date) async -> [ChatMessage] {
        guard let snap = try? await db.collection("relationships").document(relId).collection("messages").order(by: "at", descending: true).start(after: [Timestamp(date: before)]).limit(to: chatWindow).getDocuments() else { return [] }
        return snap.documents.map(chatMessage).reversed()
    }
    /// Chat opens on the match. Makes sure the pair has a standing relationship (state contact) so the chat is open at once,
    /// with no booking needed first. The rules let either side create it with state contact once the other profile exists.
    /// A waiting booking request from an earlier build keeps its own state until the carer answers.
    static func openChat(me: Person, other: Person) async throws -> Relationship {
        let fam = me.side == "family" ? me.id : other.id, car = me.side == "family" ? other.id : me.id
        guard me.side != other.side, !fam.isEmpty, !car.isEmpty else { throw AppError.msg("Chat is between a family and a carer.") }
        let pid = pairId(fam, car)
        let ref = db.collection("relationships").document(pid)
        let snap = try? await ref.getDocument()
        if let d = snap?.data(), snap?.exists == true {
            let st = d["state"] as? String ?? ""
            if st == "contact" || st == "hired" { return Relationship(id: pid, familyUid: fam, carerUid: car, state: st) }
            if st == "pending", d["createdBy"] as? String != me.id {
                try await ref.updateData(["state": "contact", "contactBy": me.id])
                return Relationship(id: pid, familyUid: fam, carerUid: car, state: "contact")
            }
            if st == "pending" { throw AppError.msg("\(other.firstName) has your booking request. Messages open as soon as they reply.") }
            throw AppError.msg("This chat is closed.")
        }
        let iso = ISO8601DateFormatter().string(from: Date())
        try await ref.setData(["members": [fam, car].sorted(), "familyUid": fam, "carerUid": car, "state": "contact", "createdBy": me.id, "createdAt": iso, "createdDay": String(iso.prefix(10))])
        return Relationship(id: pid, familyUid: fam, carerUid: car, state: "contact")
    }
    static func send(_ relId: String, from: String, text: String) async throws {
        _ = try await db.collection("relationships").document(relId).collection("messages").addDocument(data: ["from": from, "kind": "text", "text": String(text.prefix(1000)), "at": FieldValue.serverTimestamp()])
    }

    /// Chat photo. Same strip route as the profile photo: Media.prepare removes every metadata block, then the
    /// stripped bytes go up through the file service and only the storage key goes into the message.
    static func sendPhoto(_ relId: String, from: String, raw: Data) async throws {
        let jpg = try Media.prepare(raw)
        let key = try await Media.uploadPreparedSafe(jpg, kind: "gallery")
        _ = try await db.collection("relationships").document(relId).collection("messages").addDocument(data: ["from": from, "kind": "photo", "text": "", "mediaKey": key, "mediaSize": jpg.count, "mimeType": "image/jpeg", "at": FieldValue.serverTimestamp()])
    }

    // MARK: Bookings
    static func bookings(_ uid: String, side: String) async -> [Booking] {
        let rels = await relationships(uid, side: side)
        let out: [Booking] = await withTaskGroup(of: [Booking].self) { g in
            for r in rels { g.addTask {
                guard let snap = try? await db.collection("relationships").document(r.id).collection("bookings").getDocuments() else { return [] }
                return snap.documents.map { d in
                    let x = d.data()
                    return Booking(id: d.documentID, pairId: r.id, familyUid: x["familyUid"] as? String ?? "", carerUid: x["carerUid"] as? String ?? "", date: x["date"] as? String ?? "", from: x["from"] as? String ?? "", to: x["to"] as? String ?? "", rate: (x["rate"] as? NSNumber)?.doubleValue ?? 0, estimate: (x["estimate"] as? NSNumber)?.doubleValue ?? 0, state: x["state"] as? String ?? "requested", note: x["note"] as? String ?? "", cancelledBy: x["cancelledBy"] as? String ?? "", cancelledAt: (x["cancelledAt"] as? Timestamp)?.dateValue(), pay: PayInfo(x["pay"] as? [String: Any]))
                }
            } }
            var all: [Booking] = []
            for await part in g { all += part }
            return all
        }
        return out.sorted { ($0.date + $0.from) < ($1.date + $1.from) }
    }

    static func hours(from: String, to: String) -> Double {
        func m(_ s: String) -> Double { let p = s.split(separator: ":").compactMap { Double($0) }; return p.count == 2 ? p[0] * 60 + p[1] : 0 }
        return max(0, (m(to) - m(from)) / 60)
    }
    /// The rules store the end of a booking as the wall time read as UTC, minus 8 hours (the earliest Australian offset).
    /// The same cutoff gates "Mark done", so the app never offers a step the server would refuse.
    static func endDate(_ date: String, _ to: String) -> Date? {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd HH:mm"; f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "UTC")
        return f.date(from: "\(date) \(to)").map { $0.addingTimeInterval(-8 * 3600) }
    }

    static func createBooking(familyUid: String, carerUid: String, date: String, from: String, to: String, rate: Double, note: String) async throws {
        guard let end = endDate(date, to), end > Date() else { throw AppError.msg("Pick a time in the future.") }
        guard hours(from: from, to: to) > 0 else { throw AppError.msg("The end time must be after the start.") }
        let pid = pairId(familyUid, carerUid)
        let relRef = db.collection("relationships").document(pid)
        let bookingRef = relRef.collection("bookings").document()
        var data: [String: Any] = [
            "familyUid": familyUid, "carerUid": carerUid, "date": date, "from": from, "to": to,
            "endAt": Timestamp(date: end), "rate": rate, "estimate": (rate * hours(from: from, to: to) * 100).rounded() / 100,
            "recurring": "none", "weekdays": [String](), "childIds": [String](), "shareAddress": false,
            "state": "requested", "createdBy": familyUid, "createdAt": FieldValue.serverTimestamp(),
        ]
        if !note.trimmingCharacters(in: .whitespaces).isEmpty { data["note"] = String(note.trimmingCharacters(in: .whitespaces).prefix(1000)) }
        let existing = try? await relRef.getDocument()
        let batch = db.batch()
        if existing?.exists != true {
            let now = Date(); let iso = ISO8601DateFormatter().string(from: now)
            batch.setData(["members": [familyUid, carerUid].sorted(), "familyUid": familyUid, "carerUid": carerUid, "state": "pending", "createdBy": familyUid, "createdAt": iso, "createdDay": String(iso.prefix(10))], forDocument: relRef)
        } else if let s = existing?.data()?["state"] as? String, s != "contact" && s != "hired" {
            throw AppError.msg("This booking is not available right now.")
        }
        batch.setData(data, forDocument: bookingRef)
        try await batch.commit()
    }

    static func transition(_ b: Booking, to: String, actorUid: String, actorIsCarer: Bool) async throws {
        let ref = db.collection("relationships").document(b.pairId).collection("bookings").document(b.id)
        let relRef = db.collection("relationships").document(b.pairId)
        var update: [String: Any] = ["state": to]
        if to != "cancelled" && to != "completed" { update["decidedAt"] = FieldValue.serverTimestamp() }
        if to == "cancelled" { update["cancelledBy"] = actorUid; update["cancelledAt"] = FieldValue.serverTimestamp() }
        let batch = db.batch()
        batch.updateData(update, forDocument: ref)
        if to == "accepted" && actorIsCarer {
            let rel = try await relRef.getDocument()
            if rel.data()?["state"] as? String == "pending" { batch.updateData(["state": "contact", "contactBy": actorUid], forDocument: relRef) }
        }
        try await batch.commit()
    }

    // MARK: Urgent board (jobs; the sealed v6 shape, no rules change)
    static func job(_ d: QueryDocumentSnapshot) -> UrgentJob {
        let x = d.data()
        let e2: (String) -> Double? = { k in (x[k] as? NSNumber).map { $0.doubleValue / 100 } }
        return UrgentJob(id: d.documentID, familyUid: x["familyUid"] as? String ?? "", when: (x["when"] as? Timestamp)?.dateValue() ?? .distantPast,
                         dayParts: x["dayParts"] as? [String] ?? [], postcode: x["postcode"] as? String ?? "", bands: x["bands"] as? [String] ?? [],
                         note: x["note"] as? String ?? "", state: x["state"] as? String ?? "open", carerUid: x["carerUid"] as? String ?? "",
                         lat: e2("latE2"), lng: e2("lngE2"))
    }
    static func createJob(familyUid: String, when: Date, dayParts: [String], postcode: String, bands: [String], note: String) async throws {
        var data: [String: Any] = ["familyUid": familyUid, "when": Timestamp(date: when), "dayParts": dayParts, "postcode": postcode, "bands": bands, "note": String(note.prefix(1000)), "state": "open", "createdAt": FieldValue.serverTimestamp()]
        if let c = await Geo.coord(postcode: postcode) { data["latE2"] = Int((c.latitude * 100).rounded()); data["lngE2"] = Int((c.longitude * 100).rounded()) }
        _ = try await db.collection("jobs").addDocument(data: data)
    }
    /// Open posts, soonest first. Expiry is read time: a post whose start has passed never shows.
    static func openJobs() async -> [UrgentJob] {
        guard let snap = try? await db.collection("jobs").whereField("state", isEqualTo: "open").limit(to: 100).getDocuments() else { return [] }
        return snap.documents.map { job($0) }.filter { $0.when > Date() }.sorted { $0.when < $1.when }
    }
    static func myJobs(_ familyUid: String) async -> [UrgentJob] {
        guard let snap = try? await db.collection("jobs").whereField("familyUid", isEqualTo: familyUid).limit(to: 100).getDocuments() else { return [] }
        return snap.documents.map { job($0) }.sorted { $0.when > $1.when }
    }
    /// The carers who said yes to one post (document ids are the carer uids).
    static func jobYeses(_ jobId: String) async -> [String] {
        guard let snap = try? await db.collection("jobs").document(jobId).collection("interest").getDocuments() else { return [] }
        return snap.documents.map { $0.documentID }
    }
    /// A yes writes interest on the post; the chat opens at once through openChat (chat first, then book).
    static func sayYes(job: UrgentJob, carerUid: String) async throws {
        try await db.collection("jobs").document(job.id).collection("interest").document(carerUid).setData(["note": "", "createdAt": FieldValue.serverTimestamp()])
    }
    static func pickCarer(job: UrgentJob, carerUid: String) async throws {
        try await db.collection("jobs").document(job.id).updateData(["state": "filled", "carerUid": carerUid])
    }
    static func closeJob(_ job: UrgentJob) async throws {
        try await db.collection("jobs").document(job.id).updateData(["state": "closed"])
    }
    /// For the plain line in the other yes chats: a filled post of this family where this carer said yes and was not picked.
    static func filledElsewhere(familyUid: String, carerUid: String) async -> Bool {
        guard !carerUid.isEmpty, let snap = try? await db.collection("jobs").whereField("familyUid", isEqualTo: familyUid).whereField("state", isEqualTo: "filled").limit(to: 20).getDocuments() else { return false }
        for d in snap.documents where (d.data()["carerUid"] as? String ?? "") != carerUid {
            let mine = try? await db.collection("jobs").document(d.documentID).collection("interest").document(carerUid).getDocument()
            if mine?.exists == true { return true }
        }
        return false
    }

    // MARK: Reviews
    static func addReview(_ b: Booking, rating: Int, text: String) async throws {
        let id = "\(b.pairId)_\(b.id)"
        try await db.collection("reviews").document(id).setData(["relId": b.pairId, "bookingId": b.id, "familyUid": b.familyUid, "carerUid": b.carerUid, "rating": rating, "text": String(text.prefix(600)), "at": FieldValue.serverTimestamp()])
    }
    static func hasReview(_ b: Booking) async -> Bool {
        (try? await db.collection("reviews").document("\(b.pairId)_\(b.id)").getDocument().exists) ?? false
    }
    static func reviewsFor(carer: String) async -> [(rating: Int, text: String)] {
        guard let snap = try? await db.collection("reviews").whereField("carerUid", isEqualTo: carer).limit(to: 20).getDocuments() else { return [] }
        return snap.documents.map { (($0.data()["rating"] as? NSNumber)?.intValue ?? 0, $0.data()["text"] as? String ?? "") }
    }

    /// A review left straight on a profile (Build 181, her words 13 Nov 22:13), by another person.
    /// Same reviews collection as the booking reviews; kind marks it apart. Real reviews only.
    static func addProfileReview(about: String, by: String, rating: Int, text: String) async throws {
        try await db.collection("reviews").document("\(by)_\(about)_profile").setData(["aboutUid": about, "byUid": by, "kind": "profile", "rating": rating, "text": String(text.prefix(600)), "at": FieldValue.serverTimestamp()])
    }
    static func profileReviews(about: String) async -> [(rating: Int, text: String, by: String)] {
        guard let snap = try? await db.collection("reviews").whereField("aboutUid", isEqualTo: about).limit(to: 20).getDocuments() else { return [] }
        var out: [(rating: Int, text: String, by: String)] = []
        for d in snap.documents {
            let byUid = d.data()["byUid"] as? String ?? ""
            let name = (await loadProfile(byUid))?.firstName ?? "Someone"
            out.append((_rating(d), d.data()["text"] as? String ?? "", name))
        }
        return out
    }
    static func _rating(_ d: QueryDocumentSnapshot) -> Int { (d.data()["rating"] as? NSNumber)?.intValue ?? 0 }

    // MARK: Push devices (Security design of record 17 Oct 2026: owner only docs, sealed keys only)
    static var deviceId: String {
        if let d = UserDefaults.standard.string(forKey: "caresits.deviceId") { return d }
        let d = UUID().uuidString; UserDefaults.standard.set(d, forKey: "caresits.deviceId"); return d
    }
    static func registerDevice(token: String) async {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        let ref = db.collection("profiles").document(uid).collection("devices").document(deviceId)
        let kinds: [String: Bool] = ["message": NotifyKind.on(.message), "reminder": NotifyKind.on(.reminder)]
        let exists = (try? await ref.getDocument().exists) ?? false
        if exists { try? await ref.updateData(["token": token, "active": true, "kinds": kinds, "lastSeenAt": FieldValue.serverTimestamp(), "updatedAt": FieldValue.serverTimestamp()]) }
        else { try? await ref.setData(["token": token, "platform": "ios", "active": true, "kinds": kinds, "createdAt": FieldValue.serverTimestamp(), "lastSeenAt": FieldValue.serverTimestamp(), "updatedAt": FieldValue.serverTimestamp()]) }
    }
    static func syncDeviceKinds() async {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        let kinds: [String: Bool] = ["message": NotifyKind.on(.message), "reminder": NotifyKind.on(.reminder)]
        try? await db.collection("profiles").document(uid).collection("devices").document(deviceId).updateData(["kinds": kinds, "updatedAt": FieldValue.serverTimestamp()])
    }
    static func deactivateDevice() async {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        try? await db.collection("profiles").document(uid).collection("devices").document(deviceId).updateData(["active": false, "updatedAt": FieldValue.serverTimestamp()])
    }

    // MARK: Resume
    static func loadResume(_ uid: String) async -> Resume? {
        guard let s = try? await db.collection("profiles").document(uid).collection("resume").document("main").getDocument(), let d = s.data() else { return nil }
        let a: (String) -> [String] = { (d[$0] as? [String]) ?? [] }
        return Resume(summary: d["summary"] as? String ?? "", jobs: a("jobs"), education: a("education"), skills: a("skills"), certificates: a("certificates"))
    }
    static func saveResume(_ uid: String, _ r: Resume) async throws {
        try await db.collection("profiles").document(uid).collection("resume").document("main").setData(["summary": String(r.summary.prefix(600)), "jobs": Array(r.jobs.prefix(8)), "education": Array(r.education.prefix(6)), "skills": Array(r.skills.prefix(20)), "certificates": Array(r.certificates.prefix(8)), "updatedAt": FieldValue.serverTimestamp()])
    }
}

// MARK: Photos (same private file service as the web app)
/// Fallback for photos (HEIC, Live, iCloud) that will not load as plain data.
struct PickedImage: Transferable {
    let data: Data
    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(importedContentType: .image) { d in PickedImage(data: d) }
    }
}
enum Media {
    /// Loads a picked photo. Tries raw data, then the image type. Says why in plain words if it cannot.
    static func load(_ item: PhotosPickerItem) async throws -> Data {
        if let d = try? await item.loadTransferable(type: Data.self), !d.isEmpty { return d }
        if let p = try? await item.loadTransferable(type: PickedImage.self), !p.data.isEmpty { return p.data }
        throw AppError.msg("This photo could not be opened. If it is in iCloud, wait for it to download, or pick another.")
    }
    /// Uploads with one automatic retry for network hiccups.
    static func uploadSafe(_ raw: Data, kind: String) async throws -> String {
        let jpg = try prepare(raw)
        return try await uploadPreparedSafe(jpg, kind: kind)
    }
    static func uploadPreparedSafe(_ jpg: Data, kind: String) async throws -> String {
        do { return try await uploadPrepared(jpg, kind: kind) }
        catch let e as AppError { throw e }
        catch { try? await Task.sleep(nanoseconds: 800_000_000); return try await uploadPrepared(jpg, kind: kind) }
    }
    /// The bytes the file service really serves for a stored photo (read back through a fresh link).
    static func servedBytes(_ key: String) async throws -> Data {
        guard let uid = Auth.auth().currentUser?.uid else { throw AppError.msg("Please sign in again.") }
        let link = try await call(["op": "get", "key": key, "ownerUid": uid])
        guard let s = link["url"] as? String, let u = URL(string: s) else { throw AppError.msg("No read link.") }
        return try await URLSession.shared.data(from: u).0
    }
    static let base = "https://caresits-files.placenciailse.workers.dev"
    static var cache: [String: URL] = [:]

    static func token() async throws -> String {
        guard let u = Auth.auth().currentUser else { throw AppError.msg("Please sign in again.") }
        return try await u.getIDToken()
    }
    static func call(_ body: [String: Any], path: String = "/v1/link") async throws -> [String: Any] {
        var req = URLRequest(url: URL(string: base + path)!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer " + (try await token()), forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200, let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw AppError.msg("The photo service said no (code \(code)). Please try again.")
        }
        return json
    }
    /// Shrinks to 1600px and re-encodes as JPEG, which also removes location and camera data.
    static func prepare(_ data: Data) throws -> Data {
        guard let img = UIImage(data: data) else { throw AppError.msg("That picture could not be opened.") }
        let longest = max(img.size.width, img.size.height)
        let scale = min(1, 1600 / longest)
        let size = CGSize(width: max(1, img.size.width * scale), height: max(1, img.size.height * scale))
        let fmt = UIGraphicsImageRendererFormat(); fmt.scale = 1; fmt.opaque = true; fmt.preferredRange = .standard
        let out = UIGraphicsImageRenderer(size: size, format: fmt).image { _ in img.draw(in: CGRect(origin: .zero, size: size)) }
        var q: CGFloat = 0.84
        while q > 0.2 {
            // The redraw drops the original camera data. The JPEG writer then adds its own Exif block, which the
            // file service refuses (422). So every metadata block is cut out here, then checked, before the upload.
            if let j = out.jpegData(compressionQuality: q) ?? reencode(out, q) {
                if let clean = stripMetadata(j) ?? reencode(out, q).flatMap({ stripMetadata($0) }), !hasMetadata(clean) {
                    if clean.count < 1_500_000 { return clean }
                } else { throw AppError.msg("Photo details could not be removed. Choose another photo.") }
            }
            q -= 0.15
        }
        throw AppError.msg("That picture is too big.")
    }
    /// Fallback writer (ImageIO) for the rare picture UIKit cannot encode.
    static func reencode(_ img: UIImage, _ q: CGFloat) -> Data? {
        guard let cg = img.cgImage else { return nil }
        let d = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(d, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, cg, [kCGImageDestinationLossyCompressionQuality: q] as CFDictionary)
        return CGImageDestinationFinalize(dest) ? d as Data : nil
    }
    /// THE STRIP: walks the JPEG marker by marker and drops every metadata block (APP1 to APP15: Exif, XMP, GPS carrier,
    /// colour profile, maker notes; and comments). The picture data is copied as is. nil if the bytes are not a clean JPEG.
    static func stripMetadata(_ j: Data) -> Data? {
        let b = [UInt8](j)
        guard b.count > 4, b[0] == 0xFF, b[1] == 0xD8 else { return nil }
        var out: [UInt8] = [0xFF, 0xD8]; var i = 2
        while i + 2 <= b.count {
            guard b[i] == 0xFF else { return nil }
            let m = b[i + 1]
            if m == 0xFF { i += 1; continue }
            if m == 0xDA { out.append(contentsOf: b[i...]); return Data(out) }       // start of scan: the rest is the picture
            if m == 0xD9 { out.append(contentsOf: [0xFF, 0xD9]); return Data(out) }
            if m == 0x01 || (0xD0...0xD7).contains(m) { out.append(contentsOf: [0xFF, m]); i += 2; continue }
            guard i + 4 <= b.count else { return nil }
            let len = Int(b[i + 2]) << 8 | Int(b[i + 3])
            guard len >= 2, i + 2 + len <= b.count else { return nil }
            if !((0xE1...0xEF).contains(m) || m == 0xFE) { out.append(contentsOf: b[i..<(i + 2 + len)]) }
            i += 2 + len
        }
        return nil
    }
    /// Names of metadata blocks still in a JPEG (empty means clean). Same rule the file service applies, and wider.
    static func metadataBlocks(_ j: Data) -> [String] {
        let b = [UInt8](j); var found: [String] = []; var i = 2
        guard b.count > 4, b[0] == 0xFF, b[1] == 0xD8 else { return ["not-a-jpeg"] }
        while i + 4 <= b.count, b[i] == 0xFF {
            let m = b[i + 1]
            if m == 0xDA || m == 0xD9 { break }
            if m == 0xFF { i += 1; continue }
            if m == 0x01 || (0xD0...0xD7).contains(m) { i += 2; continue }
            let len = Int(b[i + 2]) << 8 | Int(b[i + 3]); guard len >= 2 else { break }
            if (0xE1...0xEF).contains(m) || m == 0xFE {
                let tag = String(bytes: b[min(i + 4, b.count)..<min(i + 12, b.count)].filter { $0 >= 32 && $0 < 127 }, encoding: .ascii) ?? ""
                found.append(String(format: "FF%02X:", Int(m)) + tag)
            }
            i += 2 + len
        }
        return found
    }
    static func hasMetadata(_ j: Data) -> Bool { !metadataBlocks(j).isEmpty }
    static func randomId() -> String { String((0..<20).map { _ in "abcdef0123456789".randomElement()! }) }

    /// kind: "avatar" or "gallery". Returns the storage key to save on the profile.
    static func upload(_ raw: Data, kind: String) async throws -> String {
        guard let uid = Auth.auth().currentUser?.uid else { throw AppError.msg("Please sign in again.") }
        return try await uploadPrepared(try prepare(raw), kind: kind)
    }
    /// Takes bytes that already went through `prepare`. Refuses anything that still carries metadata.
    static func uploadPrepared(_ jpg: Data, kind: String) async throws -> String {
        guard let uid = Auth.auth().currentUser?.uid else { throw AppError.msg("Please sign in again.") }
        guard !hasMetadata(jpg) else { throw AppError.msg("Photo details could not be removed. Choose another photo.") }
        let id = randomId()
        let name = kind == "avatar" ? "avatar-\(id).jpg" : "photo-\(id).jpg"
        let key = kind == "avatar" ? "users/\(uid)/photos/\(name)" : "users/\(uid)/gallery/\(name)"
        let link = try await call(["class": "user-media", "name": name, "ownerUid": uid, "bytes": jpg.count, "contentType": "image/jpeg", "op": "put"])
        guard let urlStr = link["url"] as? String, let url = URL(string: urlStr) else { throw AppError.msg("The photo service gave no upload link.") }
        if let k = link["key"] as? String, k != key { throw AppError.msg("The photo service picked a different place to save.") }
        var put = URLRequest(url: url); put.httpMethod = "PUT"
        for (h, v) in (link["headers"] as? [String: String]) ?? ["content-type": "image/jpeg"] where h.lowercased() != "content-length" { put.setValue(v, forHTTPHeaderField: h) }
        let (_, resp) = try await URLSession.shared.upload(for: put, from: jpg)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else { throw AppError.msg("The photo could not be saved (code \(code)).") }
        // Ask the file service to confirm it stored the file. A hiccup here never throws the upload away.
        _ = try? await call(["class": "user-media", "name": name, "ownerUid": uid, "bytes": jpg.count, "contentType": "image/jpeg"], path: "/v1/confirm")
        return key
    }
    static func url(for key: String) async -> URL? {
        if key.isEmpty { return nil }
        if let c = cache[key] { return c }
        guard let uid = Auth.auth().currentUser?.uid, let link = try? await call(["op": "get", "key": key, "ownerUid": uid]), let s = link["url"] as? String, let u = URL(string: s) else { return nil }
        cache[key] = u
        return u
    }
}
