import SwiftUI

// MARK: Profile: identity only — account, name, Care Team, sign out.
// SETTINGS LAW (her word, 13 Nov 14:11): every setting lives in
// Settings, never here. Theme and the bunny rows moved to Settings
// in build 29 (item 5); a setting found on this page is Not pass.

struct ProfileHome: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
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
            // Her word, main chat 2026-11-14 15:19 ("push my ai
            // kindness brand to top"): the kindness item stands
            // FIRST, at the very top of the menu, above everything
            // else. Later word wins over the pack's low placement.
            RowLink(icon: "care", title: "Join the AI kindness revolution", subtitle: "CareSpace stays free, kept free by kind humans") { KindnessView() }
            RowLink(icon: "user", title: "Your name", subtitle: "Shown in greetings and to your team") { EditNameView() }
            RowLink(icon: "people", title: "Care Team", subtitle: "The people in your care spaces") { CareTeamView() }
            RowLink(icon: "gear", title: "Settings", subtitle: "Theme, the bunny, language, notifications, permissions, privacy") { SettingsView() }
            RowLink(icon: "sun", title: "Bunny tour", subtitle: "The bunny shows you around, one tab at a time") { BunnyTourView() }
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
    @State private var open = false
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                // Her word (13 Nov phone test): "for theme should be
                // collapsable" — the section folds away and opens like
                // the other collapsible areas; closed it shows the pick.
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) { open.toggle() }
                } label: {
                    HStack(spacing: 8) {
                        Text("Theme").font(Brand.title(22)).foregroundStyle(th.theme.text)
                        Spacer()
                        Text(th.theme.label).font(Brand.body(16)).foregroundStyle(th.theme.muted)
                        CareIcon(name: "chev", size: 20, fill: false)
                            .rotationEffect(.degrees(open ? 180 : 0))
                    }
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Theme")
                .accessibilityValue(th.theme.label)
                .accessibilityHint(open ? "Closes the theme choices" : "Opens the theme choices")
                if open {
                BodyText(text: "Pick the look you like. Change it any time. It is saved for you.", muted: true)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(AppTheme.allCases) { t in
                        Button { pick(t) } label: {
                            VStack(spacing: 8) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 14).fill(t.bg).frame(height: 64)
                                    RoundedRectangle(cornerRadius: 14).stroke(th.theme == t ? Brand.ink : Color.gray.opacity(0.4), lineWidth: th.theme == t ? 3 : 1).frame(height: 64)
                                    HStack(spacing: 6) { Circle().fill(t.accent).frame(width: 18, height: 18); Circle().fill(Brand.sky).frame(width: 18, height: 18); Circle().fill(Brand.blush).frame(width: 18, height: 18) }
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
