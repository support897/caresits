import SwiftUI

// MARK: Profile: name, theme, bunny calm, sign out.

struct ProfileHome: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @AppStorage("carespace.bunnyCalm") private var bunnyCalm = false
    @State private var confirmOut = false
    var body: some View {
        Screen {
            HStack(spacing: 14) {
                BunnyView(size: 72)
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.myName).font(Brand.title(26)).foregroundStyle(th.theme.text)
                    BodyText(text: "Signed in with \(s.provider == "password" ? "email" : s.provider.replacingOccurrences(of: ".com", with: ""))", muted: true)
                }
            }
            RowLink(icon: "user", title: "Your name", subtitle: "Shown in greetings and to your team") { EditNameView() }
            ThemePicker()
            Card {
                Toggle(isOn: $bunnyCalm) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Calm bunny").font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text)
                        Text("Less movement on screens with the bunny.").font(Brand.body(15)).foregroundStyle(th.theme.muted)
                    }
                }.tint(Brand.ink).frame(minHeight: 44)
            }
            BigButton(title: "Sign out", tint: Brand.ink.opacity(0.85)) { confirmOut = true }
        }
        .navigationTitle("Profile")
        .confirmationDialog("Sign out of CareSpace?", isPresented: $confirmOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { s.signOut() }
            Button("Stay signed in", role: .cancel) {}
        } message: { Text("Your care spaces and notes stay safe. Nothing is deleted.") }
    }
}

struct ThemePicker: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @State private var note = ""
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                Text("Theme").font(Brand.title(22)).foregroundStyle(th.theme.text)
                BodyText(text: "Pick the look you like. Change it any time. It is saved for you.", muted: true)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(AppTheme.allCases) { t in
                        Button { pick(t) } label: {
                            VStack(spacing: 8) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 14).fill(t.bg).frame(height: 64)
                                    RoundedRectangle(cornerRadius: 14).stroke(th.theme == t ? Brand.ink : Color.gray.opacity(0.4), lineWidth: th.theme == t ? 3 : 1).frame(height: 64)
                                    HStack(spacing: 6) { Circle().fill(t.accent).frame(width: 18, height: 18); Circle().fill(Brand.sage).frame(width: 18, height: 18); Circle().fill(Brand.blush).frame(width: 18, height: 18) }
                                }
                                HStack(spacing: 4) { if th.theme == t { CareIcon(name: "check", size: 18, fill: false) }; Text(t.label).font(Brand.body(16)).foregroundStyle(th.theme.text) }
                            }
                        }.buttonStyle(.plain).accessibilityLabel(t.label).accessibilityAddTraits(th.theme == t ? .isSelected : [])
                    }
                }
                if !note.isEmpty { Notice(text: note) }
            }
        }
    }
    func pick(_ t: AppTheme) {
        th.theme = t
        guard let uid = s.uid else { return }
        Task { do { try await Backend.saveMyTheme(uid, theme: t.rawValue); note = "" } catch { note = "Saved on this phone. It could not reach your profile yet." } }
    }
}

struct EditNameView: View {
    @EnvironmentObject var s: Session
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var error = ""
    @State private var busy = false
    var body: some View {
        Screen {
            Heading(text: "Your name")
            CareField(title: "Name", text: $name)
            if !error.isEmpty { Notice(text: error, warn: true) }
            BigButton(title: "Save name", busy: busy) {
                let n = name.trimmingCharacters(in: .whitespaces)
                guard !n.isEmpty else { error = "Add a name."; return }
                busy = true
                Task { do { try await s.saveMyName(n); dismiss() } catch { self.error = error.localizedDescription }; busy = false }
            }
        }
        .navigationTitle("Name").navigationBarTitleDisplayMode(.inline)
        .onAppear { name = s.myName }
    }
}
