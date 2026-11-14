import SwiftUI

/// THE bunny — the one identical bunny of record, the locked art
/// (~/workspace/nanny-app/app2/bunny/, pixel-exact; md5s in the build log).
/// Never drawn in code, never a different drawing: her ruling, after the
/// drawn placeholder shipped in build 27 ("This is NOT my bunny").
/// Mood poses are the locked set: hello, point, celebrate, encourage,
/// oops, rest, think. A "turn the bunny down" calm setting stills the
/// gentle bob (brand of record); the art itself never changes.
struct BunnyView: View {
    enum Pose: String {
        case hello, point, celebrate, encourage, oops, rest, think
        var asset: String {
            switch self {
            case .hello: return "BunnyHello"
            case .point: return "BunnyPoint"
            case .celebrate: return "BunnyCelebrate"
            case .encourage: return "BunnyEncourage"
            case .oops: return "BunnyOops"
            case .rest: return "BunnyRest"
            case .think: return "BunnyThink"
            }
        }
    }

    var pose: Pose = .hello
    var size: CGFloat = 96
    @AppStorage("carespace.bunnyCalm") private var calmSetting = false
    @AppStorage("carespace.bunnyLessMovement") private var lessMovement = false
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @State private var up = false
    /// Still when the person asked for calm, asked for less movement, or
    /// the phone's own reduce-motion switch is on (item 5 + item 31).
    private var calm: Bool { calmSetting || lessMovement || systemReduceMotion }

    var body: some View {
        Image(pose.asset)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: size, height: size)
            .offset(y: calm ? 0 : (up ? -3 : 2))
            .animation(calm ? nil : .easeInOut(duration: 1.8).repeatForever(autoreverses: true), value: up)
            .onAppear { if !calm { up = true } }
            .accessibilityHidden(true)
    }
}
