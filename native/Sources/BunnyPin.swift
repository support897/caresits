import SwiftUI

/// The map pin of record: a classic teardrop in deep raspberry (#C2345B) with a thin white outline, two upright light pink
/// ears (#F3ABBD), a small white heart in the upper centre, no letter. The selected pin wears a thin ring in the same deep
/// pink around its lower half.
struct PinDrop: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        let cx = r.midX, rad = r.width / 2, cy = r.minY + rad
        p.addArc(center: CGPoint(x: cx, y: cy), radius: rad, startAngle: .degrees(150), endAngle: .degrees(30), clockwise: false)
        p.addQuadCurve(to: CGPoint(x: cx, y: r.maxY), control: CGPoint(x: cx + rad * 0.55, y: cy + rad * 1.25))
        p.addQuadCurve(to: CGPoint(x: cx - rad * cos(.pi / 6), y: cy + rad * 0.5), control: CGPoint(x: cx - rad * 0.55, y: cy + rad * 1.25))
        p.closeSubpath()
        return p
    }
}
struct BunnyPin: View {
    var selected = false
    static let raspberry = Color(hex: 0xC2345B), ear = Color(hex: 0xF3ABBD)
    /// The tip of the pin sits 26 points above the bottom of this view (the room below holds the selected ring), so a map anchors on tipAnchor.
    static let height: CGFloat = 86, tipAnchor = UnitPoint(x: 0.5, y: 62.0 / 86.0)
    var body: some View {
        ZStack(alignment: .top) {
            if selected {
                // Her selected pin: a white disc with a thin raspberry ring, centred on the tip, behind the pin.
                Circle().fill(.white).overlay(Circle().stroke(Self.raspberry, lineWidth: 2.5)).frame(width: 40, height: 40).offset(y: 42)
            }
            HStack(spacing: 10) {
                Ellipse().fill(Self.ear).frame(width: 12, height: 28).rotationEffect(.degrees(-8))
                Ellipse().fill(Self.ear).frame(width: 12, height: 28).rotationEffect(.degrees(8))
            }.offset(y: 0)
            PinDrop().fill(Self.raspberry).overlay(PinDrop().stroke(.white, lineWidth: 2)).frame(width: 34, height: 44).offset(y: 18)
            BrandIcon(kind: .heart, size: 13, color: .white, solid: true).offset(y: 28)
        }.frame(width: 50, height: Self.height, alignment: .top)
    }
}
