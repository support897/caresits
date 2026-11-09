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
            RootGate().environmentObject(session).tint(Brand.ink)
                .onOpenURL { GIDSignIn.sharedInstance.handle($0) }
        }
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
