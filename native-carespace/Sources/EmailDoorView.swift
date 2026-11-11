import SwiftUI

/// The email door — its OWN page (door law, new shape).
/// Sign up and sign in live here as two clear modes. Sign up asks the user's
/// name and saves it to their own profile. Sign in NEVER creates an account.
struct EmailDoorView: View {
    @EnvironmentObject var s: Session
    @State private var mode: Mode = .signUp
    @State private var name = ""
    @State private var email = ""
    @State private var pw = ""
    @State private var busy = false
    @State private var err = ""

    enum Mode { case signUp, signIn }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Picker("", selection: $mode) {
                    Text("Sign up").tag(Mode.signUp)
                    Text("Sign in").tag(Mode.signIn)
                }
                .pickerStyle(.segmented)
                .onChange(of: mode) { _ in err = "" }

                if mode == .signUp {
                    field("Your name", text: $name, content: .name)
                }
                field("Email", text: $email, content: .emailAddress)
                    .keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                SecureField("Password", text: $pw)
                    .padding(14).background(Color(hex: 0xF1EDE4))
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                BigButton(title: mode == .signUp ? "Create my account" : "Sign in", busy: busy) {
                    Task { await run() }
                }
                if !err.isEmpty {
                    Text(err).foregroundStyle(.red).font(.callout).multilineTextAlignment(.center)
                }
            }
            .padding(24)
        }
        .background(Color.white.ignoresSafeArea())
        .navigationTitle("Email")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func field(_ prompt: String, text: Binding<String>, content: UITextContentType) -> some View {
        TextField(prompt, text: text).textContentType(content)
            .padding(14).background(Color(hex: 0xF1EDE4))
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func run() async {
        busy = true; err = ""
        do {
            let e = email.trimmingCharacters(in: .whitespaces)
            if mode == .signUp {
                try await s.signUpEmail(email: e, password: pw, name: name)
            } else {
                try await s.signInEmail(email: e, password: pw)
            }
        } catch { err = DoorView.spoken(error) }
        busy = false
    }
}

/// Shown once, right after a Google/Apple first sign-in, when no name is saved
/// yet. The provider's name is pre-filled to confirm or change — never trusted
/// silently, never skipped.
struct NameAskView: View {
    @EnvironmentObject var s: Session
    @State private var name = ""
    @State private var busy = false
    @State private var err = ""

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            BunnyView(size: 110)
            Text("What is your name?").font(Brand.title(28)).foregroundStyle(Brand.ink)
            TextField("Your name", text: $name).textContentType(.name)
                .padding(14).background(Color(hex: 0xF1EDE4))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            BigButton(title: "Save my name", busy: busy) {
                Task {
                    busy = true; err = ""
                    do { try await s.saveMyName(name) } catch { err = DoorView.spoken(error) }
                    busy = false
                }
            }
            if !err.isEmpty { Text(err).foregroundStyle(.red).font(.callout) }
            Spacer()
        }
        .padding(24)
        .background(Color.white.ignoresSafeArea())
        .onAppear { if name.isEmpty { name = s.myName } }
    }
}
