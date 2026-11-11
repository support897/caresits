import SwiftUI
import FirebaseCore
import GoogleSignIn

@main
struct CareSpaceApp: App {
    @StateObject private var session: Session
    @StateObject private var themeStore = ThemeStore()
    init() {
        FirebaseApp.configure()
        _session = StateObject(wrappedValue: Session())
    }
    var body: some Scene {
        WindowGroup {
            RootGate()
                .environmentObject(session)
                .environmentObject(themeStore)
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

/// Five tabs, each with its own navigation stack. SWIPE LAW (Ilse, 11 Nov):
/// the system edge-swipe stays ON in every stack — sliding back always
/// returns to the previous page, like a website. Never disable the
/// interactive pop gesture anywhere in this app.
struct MainTabs: View {
    @EnvironmentObject var themeStore: ThemeStore
    var body: some View {
        TabView {
            TabShell(title: "Chats", icon: "chat") { ChatsHome() }
                .tabItem { Label("Chats", systemImage: "message.fill") }
            TabShell(title: "Calendar", icon: "cal") { CalendarHome() }
                .tabItem { Label("Calendar", systemImage: "calendar") }
            TabShell(title: "Care", icon: "care") { CareHome() }
                .tabItem { Label("Care", systemImage: "heart.fill") }
            TabShell(title: "Activities", icon: "sun") { ActivitiesHome() }
                .tabItem { Label("Activities", systemImage: "sun.max.fill") }
            TabShell(title: "Profile", icon: "user") { ProfileHome() }
                .tabItem { Label("Profile", systemImage: "person.fill") }
        }
        .background(themeStore.theme.bg)
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

// Phase 2 fills these shells with the real care-day screens.
struct ChatsHome: View { var body: some View { Placeholder(text: "Your spaces and chats live here.") } }
struct CalendarHome: View { var body: some View { Placeholder(text: "The care calendar lives here.") } }
struct CareHome: View { var body: some View { Placeholder(text: "Each child's care day lives here.") } }
struct ActivitiesHome: View { var body: some View { Placeholder(text: "Activities, recipes and shopping live here.") } }
struct ProfileHome: View { var body: some View { Placeholder(text: "Your profile, theme and settings live here.") } }

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
