import SwiftUI

/// Settings area (Build 181 item 1, her settings law): every setting-shaped control lives here, never in Me.
struct SettingsView: View {
    @EnvironmentObject var s: Session
    @AppStorage("caresits.bunnyDown") private var bunnyDown = false
    @ObservedObject private var themeStore = ThemeStore.shared
    var role: Role { s.role }
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Header(role: role, title: "Settings", subtitle: "")
            Card { VStack(alignment: .leading, spacing: 8) {
                Text("Look").font(.headline)
                HStack(spacing: 8) { ForEach(ThemePick.allCases, id: \.self) { p in
                    Button { ThemeStore.shared.pick = p; if let uid = s.uid { Task { try? await Backend.saveProfile(uid, card: ["theme": p.rawValue]) } } } label: {
                        Text(p.label).font(.footnote.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 8)
                            .background(themeStore.pick == p ? Brand.bunny : Brand.field)
                            .foregroundStyle(themeStore.pick == p ? Color(hex: 0x3A2E33) : Brand.ink).clipShape(Capsule())
                    }.accessibilityIdentifier("theme-\(p.rawValue)")
                } }
            } }.padding(.horizontal, 20)
            Card { VStack(alignment: .leading, spacing: 8) {
                Text("Bunny").font(.headline)
                Toggle("Turn the bunny down", isOn: $bunnyDown).font(.subheadline).tint(role.tint)
            } }.padding(.horizontal, 20)
        }.padding(.bottom, 100) }
        .background(Brand.cream.ignoresSafeArea())
        .accessibilityIdentifier("settingsScreen")
    }
}
