import SwiftUI
import FirebaseCore
import GoogleSignIn

@main
struct CaresittersApp: App {
    @StateObject private var session: Session
    init() {
        FirebaseApp.configure()
        _session = StateObject(wrappedValue: Session())
    }
    var body: some Scene {
        WindowGroup {
            root.environmentObject(session).tint(Brand.ink).preferredColorScheme(.light)
                .onOpenURL { GIDSignIn.sharedInstance.handle($0) }
        }
    }
    @ViewBuilder var root: some View {
        #if DEBUG
        if ProcessInfo.processInfo.environment["CS_ICONS"] == "1" { IconGallery() } else if ProcessInfo.processInfo.environment["CS_CHATPROOF"] == "1" { ChatProofGate() } else { RootGate() }
        #else
        RootGate()
        #endif
    }
}

struct RootGate: View {
    @EnvironmentObject var s: Session
    var body: some View {
        Group {
            if s.loading { ZStack { Brand.cream.ignoresSafeArea(); BunnyView(size: 120) } }
            else if s.uid == nil { WelcomeView() }
            else if s.needsOnboarding && !s.sideConfirmed { RolePickView() }
            else if s.needsOnboarding { OnboardingView() }
            else { RoleTabs() }
        }
    }
}
