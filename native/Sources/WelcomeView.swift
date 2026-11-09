import SwiftUI
import AuthenticationServices

struct WelcomeView: View {
    @EnvironmentObject var s: Session
    @State private var email = ""; @State private var pw = ""
    @State private var creating = true
    @State private var busy = false; @State private var err = ""
    @State private var showEmail = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                LogoView(size: 120).padding(.top, 60)
                Text("Caresitters").font(Brand.title(38)).foregroundStyle(Brand.ink)
                Text("Care, close to home").font(.title3).foregroundStyle(Brand.muted)
                if showEmail {
                    Card {
                        VStack(spacing: 12) {
                            TextField("Email", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled().padding(14) .background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
                            SecureField("Password (6+ letters)", text: $pw).padding(14) .background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
                            BigButton(title: creating ? "Create my account" : "Sign in", busy: busy) { Task { await run { try await s.email(email.trimmingCharacters(in: .whitespaces), pw, create: creating) } } }
                            Button(creating ? "I already have an account" : "I am new here") { creating.toggle() }.font(.subheadline)
                        }
                    }
                }
                VStack(spacing: 10) {
                    SignInWithAppleButton(.continue) { s.prepareApple($0) } onCompletion: { r in Task { await run { try await s.finishApple(r) } } }
                        .signInWithAppleButtonStyle(.black).frame(height: 52).clipShape(RoundedRectangle(cornerRadius: 16))
                    Button { Task { await run { try await s.google() } } } label: {
                        HStack { Text("G").font(.system(size: 20, weight: .bold)).foregroundStyle(.red); Text("Continue with Google").font(.system(size: 18, weight: .semibold)) }
                            .frame(maxWidth: .infinity, minHeight: 52).background(.white).foregroundStyle(.black).overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.4))).clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                    Button { withAnimation { showEmail.toggle() } } label: { HStack(spacing: 8) { BrandIcon(kind: .mail, size: 22); Text("Use email") }.font(.system(size: 18, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 52).background(Brand.sage.opacity(0.4)).foregroundStyle(Brand.ink).clipShape(RoundedRectangle(cornerRadius: 16)) }
                }
                if !err.isEmpty { Text(err).foregroundStyle(.red).font(.callout).multilineTextAlignment(.center) }
            }.padding(20)
        }.background(Brand.cream.ignoresSafeArea())
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
            Text("Who are you?").font(Brand.title(32)).foregroundStyle(Brand.ink)
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
