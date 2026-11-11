import Foundation
import FirebaseFirestore

/// CareSpace data layer — same Firebase project as Caresitters (caresits-812a0).
/// CareSpace data lives under careSpaces/{spaceId}; a user's own profile lives
/// at profiles/{uid} (shared with Caresitters, one account for both apps).
enum Backend {
    static var db: Firestore { Firestore.firestore() }

    static func loadMyName(_ uid: String) async -> String? {
        guard let s = try? await db.collection("profiles").document(uid).getDocument(),
              s.exists, let n = s.data()?["name"] as? String, !n.isEmpty else { return nil }
        return n
    }
    static func saveMyName(_ uid: String, name: String) async throws {
        try await db.collection("profiles").document(uid).setData([
            "name": name,
            "displayName": name,
            "updatedAt": FieldValue.serverTimestamp()
        ], merge: true)
    }
    /// Theme pick is saved on the profile too, so it survives a restore or a new phone.
    static func saveMyTheme(_ uid: String, theme: String) async throws {
        try await db.collection("profiles").document(uid).setData(["theme": theme], merge: true)
    }
    static func loadMyTheme(_ uid: String) async -> String? {
        guard let s = try? await db.collection("profiles").document(uid).getDocument(),
              s.exists else { return nil }
        return s.data()?["theme"] as? String
    }
}
