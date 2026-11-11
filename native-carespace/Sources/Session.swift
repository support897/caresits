import SwiftUI
import FirebaseAuth
import FirebaseCore
import AuthenticationServices
import CryptoKit
import GoogleSignIn

enum AppError: Error { case msg(String) }

@MainActor
final class Session: ObservableObject {
    @Published var uid: String?
    @Published var myName: String = ""
    @Published var loading = true
    private var handle: AuthStateDidChangeListenerHandle?
    fileprivate var nonce = ""

    init() {
        handle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                guard let self else { return }
                self.uid = user?.uid
                if let u = user {
                    // The greeting name is the user's OWN saved name: profile doc first,
                    // then the auth profile. Never a default, never anyone else's name.
                    if let saved = await Backend.loadMyName(u.uid) { self.myName = saved }
                    else { self.myName = u.displayName ?? "" }
                } else { self.myName = "" }
                self.loading = false
            }
        }
    }

    var provider: String { Auth.auth().currentUser?.providerData.first?.providerID ?? "password" }
    var needsReauth: Bool {
        guard let d = Auth.auth().currentUser?.metadata.lastSignInDate else { return true }
        return Date().timeIntervalSince(d) > 240
    }
    func signOut() { try? Auth.auth().signOut() }

    /// SIGN UP — the only road that creates an account. Asks the user's name and
    /// saves it to their own profile (auth profile + profile doc) before returning.
    func signUpEmail(email: String, password: String, name: String) async throws {
        let clean = name.trimmingCharacters(in: .whitespaces)
        guard !clean.isEmpty else { throw AppError.msg("Please add your name.") }
        let r = try await Auth.auth().createUser(withEmail: email, password: password)
        let change = r.user.createProfileChangeRequest()
        change.displayName = clean
        try await change.commitChanges()
        try await Backend.saveMyName(r.user.uid, name: clean)
        myName = clean
    }

    /// SIGN IN — sign in only. NEVER creates an account (the old web fault dies here).
    func signInEmail(email: String, password: String) async throws {
        _ = try await Auth.auth().signIn(withEmail: email, password: password)
    }

    /// After a Google/Apple first sign-in, if no name is saved yet the app asks for
    /// it (NameAskView) and lands here. Provider names are shown, confirmed, editable.
    func saveMyName(_ name: String) async throws {
        let clean = name.trimmingCharacters(in: .whitespaces)
        guard !clean.isEmpty, let u = Auth.auth().currentUser else { throw AppError.msg("Please add your name.") }
        let change = u.createProfileChangeRequest()
        change.displayName = clean
        try await change.commitChanges()
        try await Backend.saveMyName(u.uid, name: clean)
        myName = clean
    }

    // Sign in with Apple
    func prepareApple(_ req: ASAuthorizationAppleIDRequest) {
        nonce = Self.randomNonce()
        req.requestedScopes = [.fullName, .email]
        req.nonce = Self.sha256(nonce)
    }
    func finishApple(_ result: Result<ASAuthorization, Error>) async throws {
        let auth = try result.get()
        guard let c = auth.credential as? ASAuthorizationAppleIDCredential, let tok = c.identityToken, let s = String(data: tok, encoding: .utf8) else { throw AppError.msg("Apple sign in did not finish.") }
        let cred = OAuthProvider.appleCredential(withIDToken: s, rawNonce: nonce, fullName: c.fullName)
        _ = try await Auth.auth().signIn(with: cred)
    }
    func google() async throws {
        guard let id = FirebaseApp.app()?.options.clientID else { throw AppError.msg("Google sign in is not set up.") }
        guard let vc = UIApplication.shared.connectedScenes.compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController }).first else { throw AppError.msg("Could not open Google.") }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: id)
        let r = try await GIDSignIn.sharedInstance.signIn(withPresenting: vc)
        guard let t = r.user.idToken?.tokenString else { throw AppError.msg("Google sign in did not finish.") }
        _ = try await Auth.auth().signIn(with: GoogleAuthProvider.credential(withIDToken: t, accessToken: r.user.accessToken.tokenString))
    }
    static func randomNonce(_ n: Int = 32) -> String {
        let cs = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        return String((0..<n).map { _ in cs.randomElement()! })
    }
    static func sha256(_ s: String) -> String { SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined() }
}
