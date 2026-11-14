import SwiftUI

/// Settings area (Build 181 item 1, her settings law): every setting-shaped control lives here, never in Me.
/// Shape (her words, 13 Nov 22:13): the entry is the settings row on Me; theme, log out, delete account
/// and the rest stand inside Settings.
struct SettingsView: View {
    @EnvironmentObject var s: Session
    @AppStorage("caresits.bunnyDown") private var bunnyDown = false
    @AppStorage("caresits.urgentOn") private var urgentOn = true
    @AppStorage("caresits.urgentRadiusKm") private var urgentRadius = 25
    @AppStorage("caresits.notify.message") private var nMessage = true
    @AppStorage("caresits.notify.reminder") private var nReminder = true
    @AppStorage("caresits.notify.bookingRequest") private var nBookingRequest = true
    @AppStorage("caresits.notify.bookingConfirmed") private var nBookingConfirmed = true
    @AppStorage("caresits.notify.bookingCancelled") private var nBookingCancelled = true
    @AppStorage("caresits.notify.urgentAnswer") private var nUrgentAnswer = true
    @ObservedObject private var themeStore = ThemeStore.shared
    @State private var confirmDelete = false; @State private var showReauth = false
    @State private var deleting = false; @State private var deleteSlow = false; @State private var err = ""
    var role: Role { s.role }
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Header(role: role, title: "Settings", subtitle: "")
            Card { VStack(alignment: .leading, spacing: 8) {
                Text("Look").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                HStack(spacing: 8) { ForEach(ThemePick.allCases, id: \.self) { p in
                    Button { ThemeStore.shared.pick = p; if let uid = s.uid { Task { try? await Backend.saveProfile(uid, card: ["theme": p.rawValue]) } } } label: {
                        Text(p.label).font(.footnote.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 8)
                            .background(themeStore.pick == p ? Brand.bunny : Brand.field)
                            .foregroundStyle(themeStore.pick == p ? Color(hex: 0x2D2A35) : Brand.ink).clipShape(Capsule())
                    }.accessibilityIdentifier("theme-\(p.rawValue)")
                } }
            } }.padding(.horizontal, 20)
            Card { VStack(alignment: .leading, spacing: 8) {
                Text("Bunny").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                Toggle("Turn the bunny down", isOn: $bunnyDown).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)).tint(role.tint)
            } }.padding(.horizontal, 20)
            if s.me?.side == "carer" {
                Card { VStack(alignment: .leading, spacing: 8) {
                    Text("Urgent posts").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                    Toggle("Show me urgent posts", isOn: $urgentOn).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)).tint(role.tint).accessibilityIdentifier("urgentToggle")
                    HStack {
                        Text("Distance for urgent posts").font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline))
                        Spacer()
                        Menu {
                            ForEach([10, 25, 50, 0], id: \.self) { k in Button(k == 0 ? "Any distance" : "\(k) km") { urgentRadius = k } }
                        } label: { Text(urgentRadius == 0 ? "Any" : "\(urgentRadius) km").font(.subheadline.weight(.semibold)).foregroundStyle(Brand.ink).padding(.horizontal, 12).padding(.vertical, 8).background(Brand.field).clipShape(Capsule()) }
                    }
                } }.padding(.horizontal, 20)
            }
            Card { VStack(alignment: .leading, spacing: 10) {
                Text("Notifications").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                Toggle("New message", isOn: $nMessage).onChange(of: nMessage) { _ in Task { await Backend.syncDeviceKinds() } }
                Toggle("A message waiting a day", isOn: $nReminder).onChange(of: nReminder) { _ in Task { await Backend.syncDeviceKinds() } }
                Toggle("New booking request", isOn: $nBookingRequest)
                Toggle("Booking confirmed", isOn: $nBookingConfirmed)
                Toggle("Booking cancelled", isOn: $nBookingCancelled)
                Toggle("An answer on the urgent board", isOn: $nUrgentAnswer)
                Text("Only the essentials. One gentle nudge when a message has waited a day, never a stream.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
            } }.padding(.horizontal, 20)
            Card { VStack(alignment: .leading, spacing: 10) {
                Text("Account").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                Button("Sign out") { s.signOut() }.font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                Button("Delete my account", role: .destructive) { confirmDelete = true }.font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote))
                if !err.isEmpty { Text(err).font(.custom("Atkinson Hyperlegible", size: 16, relativeTo: .callout)) }
            } }.padding(.horizontal, 20)
        }.padding(.bottom, 100) }
        .background(Brand.cream.ignoresSafeArea())
        .accessibilityIdentifier("settingsScreen")
        .overlay {
            if deleting {
                VStack(spacing: 14) {
                    BunnyView(size: 96, mood: .rest)
                    HStack(spacing: 10) { ProgressView(); Text("Deleting your account").font(.custom("Atkinson Hyperlegible", size: 20).weight(.semibold)).foregroundStyle(Brand.ink) }
                    if deleteSlow { Text("This is taking longer than usual. Please keep the app open.").multilineTextAlignment(.center).foregroundStyle(Brand.muted).padding(.horizontal, 40).accessibilityIdentifier("deleteSlow") }
                }.frame(maxWidth: .infinity, maxHeight: .infinity).background(Brand.cream.opacity(0.96).ignoresSafeArea()).accessibilityIdentifier("deleteBusy")
            }
        }
        .sheet(isPresented: $showReauth) { ReauthSheet { Task { await doDelete() } } }
        .confirmationDialog("Delete your account and profile? This cannot be undone.", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete everything", role: .destructive) { if s.needsReauth { showReauth = true } else { Task { await doDelete() } } }
        }
    }
    /// Delete shows a busy screen while it works, a calm line if it runs past 10 seconds, and stops with a plain
    /// message after 60 seconds so the person is never left staring at a spinner. (Moved from Me with the button.)
    func doDelete() async {
        deleting = true; deleteSlow = false; err = ""
        let uid = s.uid ?? ""
        var limit: UInt64 = 60; var lag: UInt64 = 0
        #if DEBUG
        // Test only: simulate a slow network in the debug build.
        let env = ProcessInfo.processInfo.environment
        if let v = env["CS_DELETE_TIMEOUT"], let n = UInt64(v) { limit = n }
        if let v = env["CS_DELETE_DELAY"], let n = UInt64(v) { lag = n }
        #endif
        let slowTimer = Task { try? await Task.sleep(nanoseconds: 10_000_000_000); if !Task.isCancelled { deleteSlow = true } }
        defer { slowTimer.cancel() }
        do {
            try await withThrowingTaskGroup(of: Void.self) { g in
                g.addTask { if lag > 0 { try await Task.sleep(nanoseconds: lag * 1_000_000_000) }; try await Backend.deleteAccount(uid) }
                g.addTask { try await Task.sleep(nanoseconds: limit * 1_000_000_000); throw AppError.msg("timeout") }
                _ = try await g.next(); g.cancelAll()
            }
            deleting = false; s.signOut()
        } catch {
            deleting = false; deleteSlow = false
            err = error.localizedDescription.contains("timeout") ? "Still not done. Check your connection and try again. Your profile may already be gone, and trying again is safe." : "Could not delete: " + error.localizedDescription
        }
    }
}
