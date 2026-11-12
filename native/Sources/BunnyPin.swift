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
    var body: some View {
        ZStack(alignment: .top) {
            HStack(spacing: 8) {
                Capsule().fill(Self.ear).frame(width: 8, height: 18).overlay(Capsule().stroke(.white, lineWidth: 1))
                Capsule().fill(Self.ear).frame(width: 8, height: 18).overlay(Capsule().stroke(.white, lineWidth: 1))
            }.offset(y: -10)
            PinDrop().fill(Self.raspberry).overlay(PinDrop().stroke(.white, lineWidth: 1.5)).frame(width: 32, height: 42).offset(y: 6)
            BrandIcon(kind: .heart, size: 12, color: .white, solid: true).offset(y: 15)
            if selected {
                PinDrop().trim(from: 0.3, to: 0.95).stroke(Self.raspberry, lineWidth: 1.5).frame(width: 40, height: 52).offset(y: 1)
            }
        }.frame(width: 44, height: 62)
    }
}
