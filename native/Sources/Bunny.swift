import SwiftUI

/// The seven moods from the brief of record. Ilse's drawing stays exactly as it is; the mood changes how it moves
/// and which small brand icon sits by it.
enum BunnyMood: String, CaseIterable { case hello, point, celebrate, encourage, oops, rest, think }

/// The mascot. It breathes and shifts its weight, looks around, hops when tapped, leans toward a finger,
/// tilts its head when nothing happens for a while, and moves in its own way for each mood.
/// Reduced motion, or "Turn the bunny down" in Me, gives a still bunny. It pauses when off screen and never blocks a tap.
struct BunnyView: View {
    var size: CGFloat = 96
    var mood: BunnyMood = .hello
    @AppStorage("caresits.bunnyDown") private var down = false
    @Environment(\.accessibilityReduceMotion) private var reduce
    @Environment(\.scenePhase) private var phase
    @State private var breathe = false
    @State private var hop: CGFloat = 0
    @State private var squash: CGFloat = 1
    @State private var tilt: Double = 0
    @State private var lean: CGFloat = 0
    @State private var puffKey = 0
    @State private var puffGo = false
    @State private var lastTouch = Date()
    var calm: Bool { reduce || down }

    var body: some View {
        Image("bunny").resizable().scaledToFit().frame(width: size, height: size)
            .scaleEffect(x: 1 + (1 - squash) * 0.6, y: squash, anchor: .bottom)
            .scaleEffect(calm ? 1 : (breathe ? 1.03 : 1), anchor: .bottom)
            .rotationEffect(.degrees(tilt), anchor: .bottom)
            .offset(x: lean, y: hop)
            .overlay(alignment: .topTrailing) { badge.offset(x: size * 0.05, y: -size * 0.01) }
            .overlay(alignment: .top) {
                if puffKey > 0 { BrandIcon(kind: .heart, size: size * 0.24, color: Brand.bunny, solid: true).offset(y: puffGo ? -size * 0.45 : -size * 0.1).opacity(puffGo ? 0 : 1) }
            }
            .contentShape(Rectangle())
            .simultaneousGesture(DragGesture(minimumDistance: 0)
                .onChanged { v in
                    lastTouch = Date()
                    guard !calm else { return }
                    let dx = max(-1, min(1, (v.location.x - size / 2) / (size / 2)))
                    withAnimation(.easeOut(duration: 0.18)) { lean = dx * 5; tilt = Double(dx) * 6 }
                }
                .onEnded { v in
                    lastTouch = Date()
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) { lean = 0; tilt = 0 }
                    if abs(v.translation.width) < 12 && abs(v.translation.height) < 12 { Task { await tapped() } }
                })
            .accessibilityHidden(true)
            .task(id: "\(calm)-\(mood.rawValue)-\(phase == .active)") { await run() }
            .onAppear { if !calm { withAnimation(.easeInOut(duration: 1.9).repeatForever(autoreverses: true)) { breathe = true } } }
            .onChange(of: calm) { _, c in if c { breathe = false; hop = 0; tilt = 0; lean = 0; squash = 1 } else { withAnimation(.easeInOut(duration: 1.9).repeatForever(autoreverses: true)) { breathe = true } } }
    }

    @ViewBuilder var badge: some View {
        switch mood {
        case .celebrate: BrandIcon(kind: .sparkle, size: size * 0.28, color: Brand.bunny)
        case .encourage: BrandIcon(kind: .heart, size: size * 0.26, color: Brand.bunny, solid: true)
        case .oops: BrandIcon(kind: .cross, size: size * 0.2, color: Brand.muted)
        case .rest: BrandIcon(kind: .moon, size: size * 0.26, color: Brand.sage)
        case .think: BrandIcon(kind: .search, size: size * 0.26, color: Brand.ink)
        case .point: BrandIcon(kind: .arrow, size: size * 0.26, color: Brand.ink)
        case .hello: EmptyView()
        }
    }

    func spring(_ r: Double = 0.28, _ d: Double = 0.55, _ f: () -> Void) { withAnimation(.spring(response: r, dampingFraction: d)) { f() } }
    func pause(_ s: Double) async { try? await Task.sleep(nanoseconds: UInt64(s * 1_000_000_000)) }

    func jump(_ h: CGFloat = 14) async {
        spring(0.12, 0.9) { squash = 0.9 }; await pause(0.12)
        spring(0.3, 0.5) { squash = 1.06; hop = -h }; await pause(0.3)
        spring(0.3, 0.6) { hop = 0; squash = 0.94 }; await pause(0.2)
        spring(0.3, 0.6) { squash = 1 }
    }
    func puff() { puffKey += 1; puffGo = false; DispatchQueue.main.async { withAnimation(.easeOut(duration: 0.9)) { puffGo = true } } }
    func tapped() async {
        if calm { puff(); return }
        puff(); await jump(16)
    }
    func look() async {
        spring(0.4, 0.7) { lean = -5; tilt = -5 }; await pause(0.8)
        spring(0.4, 0.7) { lean = 5; tilt = 5 }; await pause(0.8)
        spring(0.4, 0.7) { lean = 0; tilt = 0 }
    }
    func wiggle() async { for a in [7.0, -7.0, 5.0, -5.0, 0.0] { spring(0.1, 0.5) { tilt = a }; await pause(0.1) } }
    func headTilt() async { spring(0.5, 0.7) { tilt = 9; lean = 3 }; await pause(1.4); spring(0.5, 0.7) { tilt = 0; lean = 0 } }

    /// The idle and mood loop. It stops by itself when the bunny leaves the screen (the task is cancelled).
    func run() async {
        guard !calm, phase == .active else { return }
        await pause(0.4)
        switch mood {
        case .hello:
            for a in [10.0, -10.0, 8.0, -8.0, 0.0] { spring(0.25, 0.5) { tilt = a }; await pause(0.25) }
        case .celebrate:
            for _ in 0..<2 { guard !Task.isCancelled else { return }; puff(); await jump(20) }
        case .encourage:
            puff(); spring(0.3, 0.5) { squash = 0.93 }; await pause(0.25); spring(0.3, 0.5) { squash = 1 }
        case .oops:
            for a in [-7.0, 7.0, -5.0, 5.0, -3.0] { spring(0.1, 0.4) { tilt = a }; await pause(0.1) }
            spring(0.6, 0.8) { tilt = -4; squash = 0.96 }
        case .rest: spring(1.2, 0.9) { squash = 0.95 }
        case .think: spring(0.5, 0.7) { tilt = 8; lean = 3 }
        case .point: spring(0.4, 0.5) { lean = 6; tilt = 5 }; await pause(0.5); spring(0.4, 0.5) { lean = 3 }
        }
        // Then a small random thing every 3 to 5 seconds, forever, while it is on screen.
        while !Task.isCancelled {
            await pause(Double.random(in: 3...5))
            guard !Task.isCancelled else { return }
            if mood == .rest { continue }
            if Date().timeIntervalSince(lastTouch) > 9 && Int.random(in: 0..<3) == 0 { await headTilt(); continue }
            switch Int.random(in: 0..<4) {
            case 0: await look()
            case 1: await wiggle()
            case 2: await jump(7)
            default: spring(0.5, 0.6) { squash = 0.96 }; await pause(0.5); spring(0.5, 0.6) { squash = 1 }
            }
        }
    }
}

/// Mood preview used by the pictures test.
struct BunnyMoodsRow: View {
    var body: some View { HStack(spacing: 4) { ForEach(BunnyMood.allCases, id: \.self) { m in VStack { BunnyView(size: 44, mood: m); Text(m.rawValue).font(.system(size: 9)) } } } }
}
