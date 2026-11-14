import Foundation
import FirebaseFirestore
import FirebaseFunctions

/// CareSpace data layer — same Firebase project as Caresitters (caresits-812a0).
/// CareSpace data lives under careSpaces/{spaceId}; a user's own profile lives
/// at profiles/{uid} (shared with Caresitters, one account for both apps).
enum Backend {
    static var db: Firestore { Firestore.firestore() }

    static func loadMyName(_ uid: String) async -> String? {
        do {
            let s = try await db.collection("profiles").document(uid).getDocument()
            Trace.log("backend.loadName", "exists=\(s.exists) hasName=\((s.data()?["displayName"] as? String)?.isEmpty == false) keys=\((s.data() ?? [:]).keys.sorted())")
            guard s.exists else { return nil }
            // The shared profile's name key of record is displayName
            // (the key Caresitters writes and the rules allow); the
            // legacy "name" key is read only as a fallback.
            if let n = s.data()?["displayName"] as? String, !n.isEmpty { return n }
            if let n = s.data()?["name"] as? String, !n.isEmpty { return n }
            return nil
        } catch { let e = error as NSError; Trace.log("backend.loadName.THROW", "\(e.domain) \(e.code) \(e.localizedDescription)"); return nil }
    }
    /// THE profile write for name + side (items 1 + 16 + 17).
    /// RULES-PROVEN TWICE by instrumented drives (2026-11-15):
    /// the shared profiles/{uid} rules (a) allow only Caresitters'
    /// own keys — a payload carrying a "name" key is denied whole —
    /// and (b) read the RESULTING document and require its card
    /// and looking maps to stand (unguarded clauses:
    /// card.keys(), looking.musts.keys(), looking.prefs.keys()),
    /// so a minimal create on a fresh account is denied too
    /// (saveName.THROW, Firestore error 7, both times). A create
    /// therefore carries the empty shape maps; an update on an
    /// existing doc rides merge and keeps the shape it finds.
    /// displayName is the allowed name key of record — the same
    /// key Caresitters reads: one profile, one name.
    static func ensureProfileBasics(_ uid: String, name: String?, side: String?) async throws {
        Trace.log("backend.ensureBasics.call", "uid=\(uid.prefix(6)) nameLen=\(name?.count ?? -1) side=\(side ?? "-")")
        do {
            let ref = db.collection("profiles").document(uid)
            let snap = try? await ref.getDocument()
            var data: [String: Any] = ["updatedAt": FieldValue.serverTimestamp()]
            if let name { data["displayName"] = name }
            if let side { data["side"] = side }
            if let snap, !snap.exists {
                data["card"] = [String: Any]()
                data["looking"] = ["musts": [String: Any](), "prefs": [String: Any]()]
            }
            try await ref.setData(data, merge: true)
            Trace.log("backend.ensureBasics.ok")
        } catch {
            let e = error as NSError
            Trace.log("backend.ensureBasics.THROW", "\(e.domain) \(e.code) \(e.localizedDescription)")
            throw error
        }
    }
    /// Theme pick is saved too, so it survives a restore or a new phone.
    /// Build 29 (items 5 + 8): the theme's home is the user's own prefs
    /// (users/{uid}/prefs/main) — the shared profiles doc's rules allow
    /// only Caresitters' own keys, which is the standing cause lead for
    /// the theme-save note that never cleared. The profile write stays
    /// as a best-effort mirror; the prefs write is the one that counts.
    static func saveMyTheme(_ uid: String, theme: String) async throws {
        Trace.log("backend.saveTheme.call", theme)
        do {
            try await savePref(uid, "theme", theme)
            Trace.log("backend.saveTheme.ok")
        } catch {
            let e = error as NSError
            Trace.log("backend.saveTheme.THROW", "\(e.domain) \(e.code) \(e.localizedDescription)")
            throw error
        }
        try? await db.collection("profiles").document(uid).setData(["theme": theme], merge: true)
    }
    static func loadMyTheme(_ uid: String) async -> String? {
        if let t = await loadPrefs(uid)["theme"] as? String, !t.isEmpty { return t }
        guard let s = try? await db.collection("profiles").document(uid).getDocument(),
              s.exists else { return nil }
        return s.data()?["theme"] as? String
    }

    // MARK: prefs — the user's own settings home (users/{uid}/prefs/main).
    // The build 29 backend read (BUILD-NOTE-29-02, item 17): CareSpace
    // settings live here, never on the shared profiles doc — Caresitters'
    // saveProfile overwrites that doc whole, and its rules allow only
    // Caresitters' own keys.
    static func prefsRef(_ uid: String) -> DocumentReference {
        db.collection("users").document(uid).collection("prefs").document("main")
    }
    static func savePref(_ uid: String, _ key: String, _ value: Any) async throws {
        try await prefsRef(uid).setData([key: value, "updatedAt": FieldValue.serverTimestamp()], merge: true)
    }
    static func loadPrefs(_ uid: String) async -> [String: Any] {
        guard let s = try? await prefsRef(uid).getDocument(), s.exists else { return [:] }
        return s.data() ?? [:]
    }

    /// Item 13: account delete runs on the backend callable
    /// (deleteMyAccount, App Check enforced) — it removes the whole
    /// footprint server side: auth user, profile, spaces membership,
    /// device tokens, search index entries and the entitlement
    /// record. The app never half deletes from the client.
    static func deleteMyAccount() async throws {
        // The callable's own contract (its source, read at this
        // desk): the call must carry confirmed: true, it runs
        // under App Check, and it deletes the auth user last.
        let fn = Functions.functions().httpsCallable("deleteMyAccount")
        _ = try await fn.call(["confirmed": true])
    }
}


// MARK: - Item 16 + 17: the shared profile (the same profile doc
// Caresitters reads: profiles/{uid}) and Caresitters ties.
// "side" and "displayName" stand inside the rules file's allowed
// keys for profiles/{uid}; CareSpace's own settings live under
// users/{uid}/prefs (the 29-02 backend read).

extension Backend {
    static func loadMySide(_ uid: String) async -> String? {
        guard let s = try? await db.collection("profiles").document(uid).getDocument(),
              let v = s.data()?["side"] as? String, v == "family" || v == "carer" else { return nil }
        return v
    }
    // saveMySide stood here once; its write folds into
    // ensureProfileBasics above (the one profile write).
    /// Another person's shown name from the shared profile —
    /// displayName first, then the name key, never a default.
    static func loadProfileName(_ uid: String) async -> String {
        guard let s = try? await db.collection("profiles").document(uid).getDocument(),
              let m = s.data() else { return "" }
        if let d = m["displayName"] as? String, !d.isEmpty { return d }
        return m["name"] as? String ?? ""
    }
    /// Item 17: Caresitters ties. A relationship whose members
    /// hold this uid and whose state is not ended means the two
    /// people stand already connected; CareSpace shows them, it
    /// never asks either side to connect again.
    static func loadRelationships(_ uid: String) async -> [(otherUid: String, state: String)] {
        guard let snap = try? await db.collection("relationships")
            .whereField("members", arrayContains: uid).getDocuments() else { return [] }
        return snap.documents.compactMap { d in
            let m = d.data()
            let state = m["state"] as? String ?? ""
            guard state != "ended" else { return nil }
            let members = m["members"] as? [String] ?? []
            guard let other = members.first(where: { $0 != uid }) else { return nil }
            return (otherUid: other, state: state)
        }
    }
}


// MARK: - Item 34: checks as the shared profile record holds them.

struct ProfileCheck: Identifiable, Equatable {
    let id: String
    var name: String
    var status: String   // the record's own word; "verified" stands only where the record says so
    var date: String
}

extension Backend {
    static func loadChecks(_ uid: String) async -> [ProfileCheck] {
        guard let s = try? await db.collection("profiles").document(uid).getDocument(),
              let raw = s.data()?["checks"] as? [[String: Any]] else { return [] }
        return raw.enumerated().map { i, m in
            ProfileCheck(id: "\(i)", name: m["name"] as? String ?? "",
                         status: m["status"] as? String ?? "", date: m["date"] as? String ?? "")
        }
    }
}
