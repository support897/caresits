import SwiftUI
import AuthenticationServices

/// The door: the first page has only Apple, Google and ONE small email button. Email is on its own page.
struct WelcomeView: View {
    @EnvironmentObject var s: Session
    @State private var busy = false; @State private var err = ""
    @State private var showEmail = false

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            LogoView(size: 130)
            Text("Caresitters").font(Brand.title(38)).foregroundStyle(Brand.titleColor)
            Spacer()
            VStack(spacing: 10) {
                SignInWithAppleButton(.continue) { s.prepareApple($0) } onCompletion: { r in Task { await run { try await s.finishApple(r) } } }
                    .signInWithAppleButtonStyle(.black).frame(height: 52).clipShape(RoundedRectangle(cornerRadius: 16))
                Button { Task { await run { try await s.google() } } } label: {
                    HStack { Text("G").font(.system(size: 20, weight: .bold)).foregroundStyle(Brand.ink); Text("Continue with Google").font(.system(size: 18, weight: .semibold)) }
                        .frame(maxWidth: .infinity, minHeight: 52).background(Brand.card).foregroundStyle(Brand.ink).overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.muted.opacity(0.4))).clipShape(RoundedRectangle(cornerRadius: 16))
                }
                Button { showEmail = true } label: { HStack(spacing: 6) { BrandIcon(kind: .mail, size: 16); Text("Use email") }.font(.system(size: 15, weight: .semibold)).padding(.horizontal, 16).padding(.vertical, 8).background(Brand.blush.opacity(0.6)).foregroundStyle(Brand.ink).clipShape(Capsule()) }.padding(.top, 4)
            }
            if !err.isEmpty { Text(err).foregroundStyle(Brand.ink).font(.callout).multilineTextAlignment(.center) }
        }.padding(20).padding(.bottom, 20).background(Brand.cream.ignoresSafeArea())
        .fullScreenCover(isPresented: $showEmail) { EmailPage() }
    }
    func run(_ f: () async throws -> Void) async {
        busy = true; err = ""
        do { try await f() } catch { let e = (error as NSError); if e.domain == ASAuthorizationError.errorDomain, e.code == ASAuthorizationError.canceled.rawValue { } else if e.code == -5 { } else { err = error.localizedDescription } }
        busy = false
    }
}

struct RolePickView: View {
    @EnvironmentObject var s: Session
    var body: some View {
        VStack(spacing: 22) {
            Spacer()
            BunnyView(size: 90, mood: .hello)
            Text("Who are you?").font(Brand.title(32)).foregroundStyle(Brand.titleColor)
            pick(.home, "I need care", "family")
            pick(.nanny, "I give care", "carer")
            Spacer()
        }.padding(24).frame(maxWidth: .infinity).background(Brand.cream.ignoresSafeArea())
    }
    func pick(_ e: BI, _ t: String, _ side: String) -> some View {
        Button { s.chooseSide(side); s.sideConfirmed = true } label: {
            HStack(spacing: 14) { BrandIcon(kind: e, size: 44); Text(t).font(.system(size: 22, weight: .semibold)); Spacer(); BrandIcon(kind: .chevron, size: 22) }
                .padding(22).frame(maxWidth: .infinity).background(Brand.blush.opacity(0.5)).foregroundStyle(Brand.ink)
                .clipShape(RoundedRectangle(cornerRadius: 22))
        }.accessibilityLabel(t)
    }
}

/// Email on its own page. Swipe from the left edge, or tap Back, to return to the door.
struct EmailPage: View {
    @EnvironmentObject var s: Session
    @Environment(\.dismiss) var dismiss
    @State private var email = ""; @State private var pw = ""
    @State private var creating = true; @State private var busy = false; @State private var err = ""
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            HStack { Button { dismiss() } label: { IconLabel(icon: .back, text: "Back", size: 18) }.accessibilityIdentifier("emailBack"); Spacer() }.padding(.top, 8)
            LogoView(size: 90).padding(.top, 10)
            TextField("Email", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled().padding(14).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
            SecureField("Password (6+ letters)", text: $pw).padding(14).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
            BigButton(title: creating ? "Create my account" : "Sign in", busy: busy) { Task { await go() } }
            Button(creating ? "I already have an account" : "I am new here") { creating.toggle() }.font(.subheadline)
            if !err.isEmpty { Text(err).foregroundStyle(Brand.ink).font(.callout).multilineTextAlignment(.center) }
        }.padding(20) }
        .background(Brand.cream.ignoresSafeArea()).backSwipe { dismiss() }
    }
    func go() async {
        busy = true; err = ""
        do { try await s.email(email.trimmingCharacters(in: .whitespaces), pw, create: creating) } catch { err = error.localizedDescription }
        busy = false
    }
}
