import Foundation
import FirebaseFirestore

/// Build 181 item 2, the asking. The coded first aid pick lives as a per-answer document under profiles/{uid}/answers/{code}.
/// Keys are only bucket, v, s, feed (the sealed v6 rules fence). Codes are F1 to F52 and C1 to C60. Never an answers key on the profile card.
enum AnswerStore {
    static var col: (String) -> CollectionReference = { Backend.db.collection("profiles").document($0).collection("answers") }

    /// The exact document body for one answer. v is a string (120), bool, number or list (10); strength s is must, pref or either.
    static func body(v: Any, strength: String?, feed: String) -> [String: Any] {
        var d: [String: Any] = ["v": v, "bucket": strength == "must" ? "musts" : "prefs"]
        if let strength { d["s"] = strength }
        if !feed.isEmpty { d["feed"] = feed }
        return d
    }
    static func write(_ uid: String, code: String, v: Any, strength: String?, feed: String) async throws {
        try await col(uid).document(code).setData(body(v: v, strength: strength, feed: feed))
    }
    static func remove(_ uid: String, code: String) async { try? await col(uid).document(code).delete() }
    static func loadAll(_ uid: String) async -> [String: [String: Any]] {
        guard let snap = try? await col(uid).getDocuments() else { return [:] }
        var out: [String: [String: Any]] = [:]
        for d in snap.documents { out[d.documentID] = d.data() }
        return out
    }
    // DEVICE ONLY picks (CPR, Education, the au pair living picks): no sealed home, excluded from scoring until a rules amendment is sealed.
    static func localKey(_ uid: String) -> String { "caresits.qlocal.\(uid)" }
    static func loadLocal(_ uid: String) -> [String: Any] { (UserDefaults.standard.dictionary(forKey: localKey(uid))) ?? [:] }
    static func saveLocal(_ uid: String, _ d: [String: Any]) { UserDefaults.standard.set(d, forKey: localKey(uid)) }
}
