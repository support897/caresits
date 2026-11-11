import SwiftUI
import FirebaseCore
import GoogleSignIn

@main
struct CareSpaceApp: App {
    @StateObject private var session: Session
    @StateObject private var themeStore = ThemeStore()
    @StateObject private var careContext = CareContext()
    init() {
        FirebaseApp.configure()
        _session = StateObject(wrappedValue: Session())
    }
    var body: some Scene {
        WindowGroup {
            RootGate()
                .environmentObject(session)
                .environmentObject(themeStore)
                .environmentObject(careContext)
                .tint(Brand.ink)
                .onOpenURL { GIDSignIn.sharedInstance.handle($0) }
        }
    }
}

struct RootGate: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var themeStore: ThemeStore
    var body: some View {
        Group {
            if s.loading {
                ZStack { themeStore.theme.bg.ignoresSafeArea(); BunnyView(size: 120) }
            } else if s.uid == nil {
                DoorView()
            } else if s.myName.isEmpty {
                NameAskView()
            } else {
                MainTabs()
            }
        }
        .task {
            // A restored account brings its saved theme back with it.
            if let uid = s.uid, let saved = await Backend.loadMyTheme(uid),
               let t = AppTheme(rawValue: saved), t != themeStore.theme {
                themeStore.theme = t
            }
        }
    }
}

/// Five tabs, each with its own navigation stack. SWIPE LAW:
/// the system edge-swipe stays ON in every stack - sliding back always
/// returns to the previous page, like a website. Never disable the
/// interactive pop gesture anywhere in this app.
struct MainTabs: View {
    @EnvironmentObject var themeStore: ThemeStore
    var body: some View {
        TabView {
            TabShell(title: "Chats", icon: "chat") { ChatsHome() }
                .tabItem { Label { Text("Chats") } icon: { CareTabIcon.image("chat") } }
            TabShell(title: "Calendar", icon: "cal") { CalendarHome() }
                .tabItem { Label { Text("Calendar") } icon: { CareTabIcon.image("cal") } }
            TabShell(title: "Care", icon: "care") { CareHome() }
                .tabItem { Label { Text("Care") } icon: { CareTabIcon.image("care") } }
            TabShell(title: "Activities", icon: "sun") { ActivitiesHome() }
                .tabItem { Label { Text("Activities") } icon: { CareTabIcon.image("sun") } }
            TabShell(title: "Profile", icon: "user") { ProfileHome() }
                .tabItem { Label { Text("Profile") } icon: { CareTabIcon.image("user") } }
        }
        .background(themeStore.theme.bg)
        .preferredColorScheme(themeStore.theme == .dark ? .dark : .light)
    }
}

struct TabShell<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder var content: Content
    var body: some View {
        NavigationStack {
            content
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.large)
        }
    }
}

// Chats, Calendar, Care and Profile are real screens now (Care*Screens.swift). Activities arrives in Phase 3.
struct ActivitiesHome: View { var body: some View { Placeholder(text: "Activities, recipes and shopping live here.") } }

struct Placeholder: View {
    let text: String
    @EnvironmentObject var themeStore: ThemeStore
    var body: some View {
        VStack(spacing: 14) {
            BunnyView(size: 90)
            Text(text).font(Brand.body()).foregroundStyle(themeStore.theme.muted)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(themeStore.theme.bg.ignoresSafeArea())
    }
}
