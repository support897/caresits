import SwiftUI

/// The bunny, drawn as layered SwiftUI shapes — pink, heart on belly.
/// Mood set of the brand: hello, point, celebrate, encourage, oops, rest, think.
/// v1 draws the hello body; the eye/blink layer and the remaining mood faces
/// land in the Phase 4 brand pass, checked against the web bunny of record.
/// A "turn the bunny down" calm setting stills the motion (brand of record).
struct BunnyView: View {
    var size: CGFloat = 96
    @AppStorage("carespace.bunnyCalm") private var calm = false
    @State private var up = false

    var body: some View {
        ZStack {
            // ears
            ear.offset(x: -size * 0.16).rotationEffect(.degrees(-8))
            ear.offset(x: size * 0.16).rotationEffect(.degrees(8))
            // head + body as one soft form
            Ellipse().fill(Brand.bunny).frame(width: size * 0.78, height: size * 0.72)
                .offset(y: size * 0.12)
            // inner ears
            Ellipse().fill(Brand.blush).frame(width: size * 0.10, height: size * 0.26)
                .offset(x: -size * 0.16, y: -size * 0.30).rotationEffect(.degrees(-8))
            Ellipse().fill(Brand.blush).frame(width: size * 0.10, height: size * 0.26)
                .offset(x: size * 0.16, y: -size * 0.30).rotationEffect(.degrees(8))
            // belly heart
            HeartShape().fill(Brand.cream)
                .frame(width: size * 0.26, height: size * 0.23)
                .offset(y: size * 0.22)
            // eyes + nose (hello mood)
            Circle().fill(Brand.ink).frame(width: size * 0.055, height: size * 0.055)
                .offset(x: -size * 0.13, y: size * 0.06)
            Circle().fill(Brand.ink).frame(width: size * 0.055, height: size * 0.055)
                .offset(x: size * 0.13, y: size * 0.06)
            Ellipse().fill(Brand.ink).frame(width: size * 0.07, height: size * 0.05)
                .offset(y: size * 0.15)
        }
        .frame(width: size, height: size)
        .offset(y: calm ? 0 : (up ? -3 : 2))
        .animation(calm ? nil : .easeInOut(duration: 1.8).repeatForever(autoreverses: true), value: up)
        .onAppear { if !calm { up = true } }
        .accessibilityHidden(true)
    }
    private var ear: some View {
        Ellipse().fill(Brand.bunny).frame(width: size * 0.20, height: size * 0.44)
            .offset(y: -size * 0.30)
    }
}
