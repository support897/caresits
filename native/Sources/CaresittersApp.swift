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
            root.environmentObject(session).tint(Brand.bunny)
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
    @ObservedObject private var theme = ThemeStore.shared
    /// The locked opening stands for a short beat at every cold launch, so it is seen even when sign in settles fast.
    @State private var openingDone = false
    var body: some View {
        content.id(theme.pick).preferredColorScheme(theme.pick.scheme).background(Brand.cream.ignoresSafeArea())
    }
    @ViewBuilder var content: some View {
        Group {
            if s.loading || !openingDone { SplashView().task { try? await Task.sleep(nanoseconds: 2_200_000_000); withAnimation(.easeOut(duration: 0.25)) { openingDone = true } } }
            else if s.uid == nil { WelcomeView() }
            else if s.needsOnboarding && !s.sideConfirmed { RolePickView() }
            else if s.needsOnboarding { OnboardingView() }
            else { RoleTabs() }
        }
    }
}

/// The opening screen: the one bunny, the wordmark in Fraunces and the tagline, on Pale Pink Ground. Same as the launch colour.
struct SplashView: View {
    var body: some View {
        ZStack {
            Brand.paleGround.ignoresSafeArea()
            SplashContent()
        }.accessibilityIdentifier("splash")
    }
}

/// The locked opening: bunny, name, tagline.
struct SplashContent: View {
    var body: some View {
        VStack(spacing: 14) {
            BunnyView(size: 150, mood: .hello)
            Text("Caresitters").font(Brand.title(40)).foregroundStyle(Brand.titleColor)
            Text("Find care. Share the day.").font(.title3).foregroundStyle(Brand.bunny.opacity(0.8))
        }
    }
}

