import SwiftUI
import FirebaseCore
import FirebaseFirestore
import GoogleSignIn

@main
struct CareSpaceApp: App {
    @UIApplicationDelegateAdaptor(PushDelegate.self) private var pushDelegate
    @StateObject private var session: Session
    @StateObject private var themeStore = ThemeStore()
    @StateObject private var careContext = CareContext()
    init() {
        // App Check stands before configure (item 11): the backend's
        // guarded calls (account delete, push) check it.
        PushSetup.installAppCheck()
        FirebaseApp.configure()
        // Item 12 (offline queue) stands from the first moment,
        // before any read or write can happen.
        OfflineSetup.install()
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

/// Item 12 — OFFLINE QUEUE. Firestore's persistent cache is switched
/// on EXPLICITLY here, at startup, before any read or write: writes
/// made offline are kept on the phone in the order they were made and
/// land on the server in that order when the connection returns,
/// nothing dropped. It never rides on an SDK default nobody chose.
enum OfflineSetup {
    static func install() {
        let settings = FirestoreSettings()
        settings.cacheSettings = PersistentCacheSettings(sizeBytes: FirestoreCacheSizeUnlimited)
        Firestore.firestore().settings = settings
    }
}

struct RootGate: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var themeStore: ThemeStore
    var body: some View {
        Group {
            if s.loading {
                // Item 3: the launch frame carries the CareSpaceMark
                // centred on the brand ground from the first frame —
                // the same mark the system launch screen shows
                // (UILaunchScreen: LaunchBackground + CareSpaceMark),
                // so no frame is ever a blank white window.
                ZStack { themeStore.theme.bg.ignoresSafeArea(); LogoMark(size: 120) }
            } else if s.uid == nil {
                DoorView()
            } else if s.myName.isEmpty {
                NameAskView()
            } else if s.mySide.isEmpty {
                // Item 16: an account that never answered who you
                // are is asked once — never defaulted to family.
                WhoAreYouView()
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
            // Item 11: if notifications already stand allowed, keep
            // this phone's push token fresh on the profile.
            if s.uid != nil { await PushSetup.refreshIfAllowed() }
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

// Chats, Calendar, Care and Profile are real screens (Care*Screens.swift).
// Activities is real in Activities.swift (items 10 + 18).

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
