import SwiftUI
import FirebaseAuth
import FirebaseCore
import AuthenticationServices
import CryptoKit
import GoogleSignIn

enum AppError: Error { case msg(String) }

/// Thrown when the user leaves a provider sign-in before it completes —
/// a cancel or a walk-back. The door swallows it silently: a cancel is
/// not an error and never paints a red line (F-CS27-2).
struct SignInCancelled: Error {}

@MainActor
final class Session: ObservableObject {
    @Published var uid: String?
    @Published var myName: String = ""
    /// Item 16: who this person is — "family" or "carer", the same
    /// word Caresitters uses on the shared profile. Empty = the
    /// question has not been answered yet; the app asks it, it
    /// never guesses it and never defaults anyone to family.
    @Published var mySide: String = ""
    @Published var loading = true
    private var handle: AuthStateDidChangeListenerHandle?
    fileprivate var nonce = ""
    /// The uid the standing myName belongs to (F-CS27-1).
    private var nameUid: String?
    /// Generation of the latest auth event; stale listener passes drop (F-CS27-1).
    private var authGen = 0

    init() {
        handle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                guard let self else { return }
                self.authGen += 1
                let gen = self.authGen
                Trace.log("listener.fire", "gen=\(gen) user=\(user != nil) nameLen=\(self.myName.count)")
                self.uid = user?.uid
                if let u = user {
                    // The greeting name is the user's OWN saved name: profile doc first,
                    // then the auth profile. Never a default, never anyone else's name.
                    let saved = await Backend.loadMyName(u.uid)
                    let side = await Backend.loadMySide(u.uid)
                    if let side, self.authGen == gen { self.mySide = side }
                    // A newer auth event owns the state now — this pass is stale
                    // and must not write (F-CS27-1: its empty fallback landing
                    // after signUpEmail's save is what sent new users to NameAsk).
                    Trace.log("listener.loaded", "gen=\(gen) saved=\(saved != nil) cur=\(self.authGen)")
                    guard self.authGen == gen, self.uid == u.uid else { Trace.log("listener.stale", "gen=\(gen)"); return }
                    if let saved {
                        self.myName = saved
                        self.nameUid = u.uid
                    } else if self.nameUid == u.uid && !self.myName.isEmpty {
                        // A name saved this session for THIS account (the sign-up
                        // form's) already stands — never erase it with the empty
                        // fallback from a snapshot taken before the save.
                    } else {
                        self.myName = u.displayName ?? ""
                        self.nameUid = u.uid
                    }
                } else { self.myName = ""; self.nameUid = nil; self.mySide = "" }
                self.loading = false
                Trace.log("listener.done", "gen=\(gen) nameLen=\(self.myName.count) uidSet=\(self.uid != nil)")
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
    func signUpEmail(email: String, password: String, name: String, side: String) async throws {
        let clean = name.trimmingCharacters(in: .whitespaces)
        guard !clean.isEmpty else { throw AppError.msg("Please add your name.") }
        guard side == "family" || side == "carer" else { throw AppError.msg("Please tell us who you are: family or carer.") }
        Trace.log("signUp.call", "nameLen=\(clean.count)")
        let r = try await Auth.auth().createUser(withEmail: email, password: password)
        Trace.log("signUp.created", "uid=\(r.user.uid.prefix(6))")
        // ITEM 1 FIX (the list's own words): the session owns the
        // name locally from the moment createUser returns — set
        // BEFORE any save that can throw or stall, so a denied or
        // slow profile write can never send a brand-new user to
        // the name ask with an empty field. Item 16's side is
        // owned the same moment. The profile saves ride after,
        // best-effort: the name still lands on the profile when
        // the write is allowed, and the landing never waits on it.
        myName = clean
        nameUid = r.user.uid
        mySide = side
        let change = r.user.createProfileChangeRequest()
        change.displayName = clean
        try? await change.commitChanges()
        try? await Backend.saveMyName(r.user.uid, name: clean)
        try? await Backend.saveMySide(r.user.uid, side: side)
        Trace.log("signUp.return", "myNameLen=\(myName.count)")
    }

    /// SIGN IN — sign in only. NEVER creates an account (the old web fault dies here).
    /// F-CS27-3: the vendor call is raced against a hard time limit and the
    /// landing is taken from THIS credential — a returned sign-in always lands
    /// inside in session, and a stuck call surfaces a truthful line instead of
    /// sitting dead and silent on the form.
    func signInEmail(email: String, password: String) async throws {
        Trace.log("signIn.call", "emailLen=\(email.count) pwLen=\(password.count)")
        let r: AuthDataResult
        do {
            r = try await Self.withTimeout(seconds: 20,
                timeoutError: AppError.msg("Sign in is taking too long. Check your connection and try again.")) {
                try await Auth.auth().signIn(withEmail: email, password: password)
            }
        } catch { Trace.log("signIn.THROW", "\((error as NSError).domain) \((error as NSError).code) \(error.localizedDescription)"); throw error }
        Trace.log("signIn.returned", "uid=\(r.user.uid.prefix(6))")
        let saved = try? await Self.withTimeout(seconds: 10,
            timeoutError: AppError.msg("Sign in is taking too long. Check your connection and try again.")) {
            await Backend.loadMyName(r.user.uid)
        }
        if let saved {
            myName = saved
            nameUid = r.user.uid
        } else if nameUid != r.user.uid {
            myName = r.user.displayName ?? ""
            nameUid = r.user.uid
        }
        uid = r.user.uid
        loading = false
        Trace.log("signIn.landed", "uidSet=true nameLen=\(myName.count)")
    }

    /// Item 16: save the who-are-you answer (NameAsk for provider
    /// first sign-ins, the one-time WhoAreYou step for older
    /// accounts). The session owns it locally at once.
    func saveMySide(_ side: String) async throws {
        guard side == "family" || side == "carer", let u = Auth.auth().currentUser else { throw AppError.msg("Please tell us who you are: family or carer.") }
        mySide = side
        try await Backend.saveMySide(u.uid, side: side)
    }

    /// After a Google/Apple first sign-in, if no name is saved yet the app asks for
    /// it (NameAskView) and lands here. Provider names are shown, confirmed, editable.
    func saveMyName(_ name: String) async throws {
        let clean = name.trimmingCharacters(in: .whitespaces)
        guard !clean.isEmpty, let u = Auth.auth().currentUser else { throw AppError.msg("Please add your name.") }
        // ITEM 1 FIX (same shape as sign-up): the session owns the
        // name locally first; the saves ride after, best-effort, so
        // the ask can never come back empty inside the session.
        myName = clean
        nameUid = u.uid
        let change = u.createProfileChangeRequest()
        change.displayName = clean
        try? await change.commitChanges()
        try? await Backend.saveMyName(u.uid, name: clean)
    }

    // Sign in with Apple
    func prepareApple(_ req: ASAuthorizationAppleIDRequest) {
        nonce = Self.randomNonce()
        req.requestedScopes = [.fullName, .email]
        req.nonce = Self.sha256(nonce)
    }
    func finishApple(_ result: Result<ASAuthorization, Error>) async throws {
        let auth: ASAuthorization
        do { auth = try result.get() }
        // The Apple sheet never produced a credential: the user cancelled,
        // dismissed it, or walked back from the account alert. All of those
        // are a quiet return to the door, never a red line (F-CS27-2).
        catch { throw SignInCancelled() }
        guard let c = auth.credential as? ASAuthorizationAppleIDCredential, let tok = c.identityToken, let s = String(data: tok, encoding: .utf8) else { throw AppError.msg("Apple sign in did not finish.") }
        let cred = OAuthProvider.appleCredential(withIDToken: s, rawNonce: nonce, fullName: c.fullName)
        _ = try await Self.withTimeout(seconds: 20,
            timeoutError: AppError.msg("Sign in is taking too long. Check your connection and try again.")) {
            try await Auth.auth().signIn(with: cred)
        }
    }
    func google() async throws {
        guard let id = FirebaseApp.app()?.options.clientID else { throw AppError.msg("Google sign in is not set up.") }
        guard let vc = UIApplication.shared.connectedScenes.compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController }).first else { throw AppError.msg("Could not open Google.") }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: id)
        let r = try await GIDSignIn.sharedInstance.signIn(withPresenting: vc)
        guard let t = r.user.idToken?.tokenString else { throw AppError.msg("Google sign in did not finish.") }
        _ = try await Self.withTimeout(seconds: 20,
            timeoutError: AppError.msg("Sign in is taking too long. Check your connection and try again.")) {
            try await Auth.auth().signIn(with: GoogleAuthProvider.credential(withIDToken: t, accessToken: r.user.accessToken.tokenString))
        }
    }

    /// True when an error is really the user leaving a provider flow —
    /// a cancel is not an error (F-CS27-2).
    static func isCancel(_ e: Error) -> Bool {
        if e is SignInCancelled { return true }
        if let a = e as? ASAuthorizationError, a.code == .canceled { return true }
        let n = e as NSError
        // Google SDK cancel: GIDSignInError, code -5 (canceled).
        if n.domain == "com.google.GIDSignIn" && n.code == -5 { return true }
        return false
    }

    /// Runs `op` against a hard time limit; on timeout the caller gets the
    /// timeout error, so no sign-in path can sit dead and silent (F-CS27-3).
    static func withTimeout<T>(seconds: Double, timeoutError: Error, _ op: @escaping () async throws -> T) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask { try await op() }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                throw timeoutError
            }
            guard let v = try await group.next() else { throw timeoutError }
            group.cancelAll()
            return v
        }
    }
    static func randomNonce(_ n: Int = 32) -> String {
        let cs = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        return String((0..<n).map { _ in cs.randomElement()! })
    }
    static func sha256(_ s: String) -> String { SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined() }
}
