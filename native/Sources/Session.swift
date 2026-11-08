import SwiftUI
import FirebaseAuth
import FirebaseCore
import AuthenticationServices
import CryptoKit
import GoogleSignIn

@MainActor
final class Session: ObservableObject {
    @Published var uid: String?
    @Published var me: Person?
    @Published var loading = true
    @Published var chosenSide: String = UserDefaults.standard.string(forKey: "caresits.side") ?? "family"
    private var handle: AuthStateDidChangeListenerHandle?
    fileprivate var nonce = ""

    init() {
        handle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                guard let self else { return }
                self.uid = user?.uid
                if let u = user?.uid { self.me = await Backend.loadProfile(u) } else { self.me = nil }
                self.loading = false
            }
        }
    }
    var meSafe: Person { me ?? Person(id: "", data: [:]) }
    var role: Role { me?.role ?? (chosenSide == "carer" ? .nanny : .family) }
    var needsOnboarding: Bool { uid != nil && (me == nil || me!.services.isEmpty) }
    func reload() async { if let u = uid { me = await Backend.loadProfile(u) } }
    @Published var sideConfirmed = false
    func chooseSide(_ s: String) { chosenSide = s; UserDefaults.standard.set(s, forKey: "caresits.side") }
    // Deleting an account needs a recent sign in. These helpers ask the person to confirm it is them.
    var provider: String { Auth.auth().currentUser?.providerData.first?.providerID ?? "password" }
    var needsReauth: Bool {
        guard let d = Auth.auth().currentUser?.metadata.lastSignInDate else { return true }
        return Date().timeIntervalSince(d) > 240
    }
    func reauth(password: String) async throws {
        guard let u = Auth.auth().currentUser, let e = u.email else { throw AppError.msg("Please sign out and sign in again.") }
        try await u.reauthenticate(with: EmailAuthProvider.credential(withEmail: e, password: password))
    }
    func reauthGoogle() async throws {
        guard let id = FirebaseApp.app()?.options.clientID, let vc = UIApplication.shared.connectedScenes.compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController }).first else { throw AppError.msg("Could not open Google.") }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: id)
        let r = try await GIDSignIn.sharedInstance.signIn(withPresenting: vc)
        guard let t = r.user.idToken?.tokenString else { throw AppError.msg("Google sign in did not finish.") }
        try await Auth.auth().currentUser?.reauthenticate(with: GoogleAuthProvider.credential(withIDToken: t, accessToken: r.user.accessToken.tokenString))
    }
    func reauthApple(_ result: Result<ASAuthorization, Error>) async throws {
        let auth = try result.get()
        guard let c = auth.credential as? ASAuthorizationAppleIDCredential, let tok = c.identityToken, let s = String(data: tok, encoding: .utf8) else { throw AppError.msg("Apple sign in did not finish.") }
        try await Auth.auth().currentUser?.reauthenticate(with: OAuthProvider.appleCredential(withIDToken: s, rawNonce: nonce, fullName: c.fullName))
    }
    func signOut() {
        sideConfirmed = false; try? Auth.auth().signOut(); me = nil }

    func email(_ email: String, _ pw: String, create: Bool) async throws {
        if create { _ = try await Auth.auth().createUser(withEmail: email, password: pw) }
        else { _ = try await Auth.auth().signIn(withEmail: email, password: pw) }
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
