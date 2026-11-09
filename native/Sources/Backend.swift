import Foundation
import SwiftUI
import UIKit
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
        return Person(id: uid, data: d)
    }

    /// Merge a patch into the profile document. The card is merged one level deep.
    static func saveProfile(_ uid: String, side: String? = nil, name: String? = nil, postcode: String? = nil, photoKey: String? = nil, about: String? = nil, card: [String: Any] = [:]) async throws {
        let ref = db.collection("profiles").document(uid)
        let cur = (try? await ref.getDocument().data()) ?? [:]
        var next: [String: Any] = [:]
        for k in ["side", "displayName", "postcode", "photoUrl", "about", "looking", "level", "learningPlan"] { if let v = cur[k] { next[k] = v } }
        // The rules need a looking map with musts and prefs on every profile write.
        if next["looking"] == nil { next["looking"] = ["musts": [String: Any](), "prefs": [String: Any]()] }
        if let side { next["side"] = side }
        if let name { next["displayName"] = name }
        if let postcode { next["postcode"] = postcode }
        if let photoKey { next["photoUrl"] = photoKey }
        if let about { next["about"] = String(about.prefix(300)) }
        var c = (cur["card"] as? [String: Any]) ?? [:]
        for (k, v) in card { c[k] = v }
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

    static func listenMessages(_ relId: String, _ cb: @escaping ([ChatMessage]) -> Void) -> ListenerRegistration {
        db.collection("relationships").document(relId).collection("messages").order(by: "at").addSnapshotListener { snap, _ in
            let rows = (snap?.documents ?? []).map { d -> ChatMessage in
                let x = d.data()
                return ChatMessage(id: d.documentID, from: x["from"] as? String ?? "", text: x["text"] as? String ?? "", at: (x["at"] as? Timestamp)?.dateValue() ?? Date())
            }
            cb(rows)
        }
    }
    static func send(_ relId: String, from: String, text: String) async throws {
        _ = try await db.collection("relationships").document(relId).collection("messages").addDocument(data: ["from": from, "kind": "text", "text": String(text.prefix(1000)), "at": FieldValue.serverTimestamp()])
    }

    // MARK: Bookings
    static func bookings(_ uid: String, side: String) async -> [Booking] {
        var out: [Booking] = []
        for r in await relationships(uid, side: side) {
            guard let snap = try? await db.collection("relationships").document(r.id).collection("bookings").getDocuments() else { continue }
            for d in snap.documents {
                let x = d.data()
                out.append(Booking(id: d.documentID, pairId: r.id, familyUid: x["familyUid"] as? String ?? "", carerUid: x["carerUid"] as? String ?? "", date: x["date"] as? String ?? "", from: x["from"] as? String ?? "", to: x["to"] as? String ?? "", rate: (x["rate"] as? NSNumber)?.doubleValue ?? 0, estimate: (x["estimate"] as? NSNumber)?.doubleValue ?? 0, state: x["state"] as? String ?? "requested", note: x["note"] as? String ?? ""))
            }
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
        let batch = db.batch()
        batch.updateData(update, forDocument: ref)
        if to == "accepted" && actorIsCarer {
            let rel = try await relRef.getDocument()
            if rel.data()?["state"] as? String == "pending" { batch.updateData(["state": "contact", "contactBy": actorUid], forDocument: relRef) }
        }
        try await batch.commit()
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
        do { return try await upload(raw, kind: kind) }
        catch let e as AppError { throw e }
        catch { try? await Task.sleep(nanoseconds: 800_000_000); return try await upload(raw, kind: kind) }
    }
    static let base = "https://caresits-files.placenciailse.workers.dev"
    static var cache: [String: URL] = [:]

    static func token() async throws -> String {
        guard let u = Auth.auth().currentUser else { throw AppError.msg("Please sign in again.") }
        return try await u.getIDToken()
    }
    static func call(_ body: [String: Any]) async throws -> [String: Any] {
        var req = URLRequest(url: URL(string: base + "/v1/link")!)
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
        let fmt = UIGraphicsImageRendererFormat(); fmt.scale = 1; fmt.opaque = true
        let out = UIGraphicsImageRenderer(size: size, format: fmt).image { _ in img.draw(in: CGRect(origin: .zero, size: size)) }
        var q: CGFloat = 0.84
        while q > 0.2 { if let j = out.jpegData(compressionQuality: q), j.count < 1_500_000 { return j }; q -= 0.15 }
        throw AppError.msg("That picture is too big.")
    }
    static func randomId() -> String { String((0..<20).map { _ in "abcdef0123456789".randomElement()! }) }

    /// kind: "avatar" or "gallery". Returns the storage key to save on the profile.
    static func upload(_ raw: Data, kind: String) async throws -> String {
        guard let uid = Auth.auth().currentUser?.uid else { throw AppError.msg("Please sign in again.") }
        let jpg = try prepare(raw)
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
