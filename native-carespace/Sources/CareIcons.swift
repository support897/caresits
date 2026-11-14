import SwiftUI

// MARK: Drawn icons for CareSpace. No SF Symbols and no stock glyphs. Each icon is a short path on a 24 by 24 grid.
// Commands: M L H V C Z (absolute) and "O cx cy r" for a circle. Soft sky body, ink line, one bunny pink dot.

struct CareIconShape: Shape {
    let path: String
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let s = min(rect.width, rect.height) / 24
        let ox = rect.minX + (rect.width - 24 * s) / 2, oy = rect.minY + (rect.height - 24 * s) / 2
        func pt(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: ox + x * s, y: oy + y * s) }
        let tokens = path.split(whereSeparator: { $0 == " " || $0 == "," }).map(String.init)
        var i = 0; var cur = (0.0, 0.0)
        func num() -> Double { defer { i += 1 }; return Double(tokens[i]) ?? 0 }
        while i < tokens.count {
            let c = tokens[i]; i += 1
            switch c {
            case "M": let x = num(), y = num(); p.move(to: pt(x, y)); cur = (x, y)
            case "L": let x = num(), y = num(); p.addLine(to: pt(x, y)); cur = (x, y)
            case "H": let x = num(); p.addLine(to: pt(x, cur.1)); cur.0 = x
            case "V": let y = num(); p.addLine(to: pt(cur.0, y)); cur.1 = y
            case "C":
                let a = num(), b = num(), c1 = num(), d = num(), x = num(), y = num()
                p.addCurve(to: pt(x, y), control1: pt(a, b), control2: pt(c1, d)); cur = (x, y)
            case "Z": p.closeSubpath()
            case "O":
                let x = num(), y = num(), r = num()
                p.addEllipse(in: CGRect(x: ox + (x - r) * s, y: oy + (y - r) * s, width: 2 * r * s, height: 2 * r * s))
            default: break
            }
        }
        return p
    }
}

enum CareGlyphs {
    /// line: the ink strokes. body: closed shapes that get a soft fill. dot: one small accent circle (cx, cy).
    static let table: [String: (line: String, body: String, dot: (Double, Double)?)] = [
        "chat": ("M 5 5 H 19 C 20 5 21 6 21 7 V 14 C 21 15 20 16 19 16 H 11 L 6 20 V 16 H 5 C 4 16 3 15 3 14 V 7 C 3 6 4 5 5 5 Z", "M 5 5 H 19 C 20 5 21 6 21 7 V 14 C 21 15 20 16 19 16 H 11 L 6 20 V 16 H 5 C 4 16 3 15 3 14 V 7 C 3 6 4 5 5 5 Z", (8.5, 10.5)),
        "cal": ("M 4 6 H 20 V 20 H 4 Z M 4 10 H 20 M 8 3 V 7 M 16 3 V 7", "M 4 6 H 20 V 20 H 4 Z", (12, 15)),
        "care": ("M 12 20 C 4 14 3 10 3 8 C 3 5 5 4 7 4 C 9 4 11 5 12 7 C 13 5 15 4 17 4 C 19 4 21 5 21 8 C 21 10 20 14 12 20 Z", "M 12 20 C 4 14 3 10 3 8 C 3 5 5 4 7 4 C 9 4 11 5 12 7 C 13 5 15 4 17 4 C 19 4 21 5 21 8 C 21 10 20 14 12 20 Z", nil),
        "sun": ("M 12 3 V 5 M 12 19 V 21 M 3 12 H 5 M 19 12 H 21 M 5.6 5.6 L 7 7 M 17 17 L 18.4 18.4 M 5.6 18.4 L 7 17 M 17 7 L 18.4 5.6 M 16 12 C 16 14.2 14.2 16 12 16 C 9.8 16 8 14.2 8 12 C 8 9.8 9.8 8 12 8 C 14.2 8 16 9.8 16 12 Z", "M 16 12 C 16 14.2 14.2 16 12 16 C 9.8 16 8 14.2 8 12 C 8 9.8 9.8 8 12 8 C 14.2 8 16 9.8 16 12 Z", nil),
        "user": ("M 20 20 C 20 16 16 14 12 14 C 8 14 4 16 4 20 M 16 8 C 16 10.2 14.2 12 12 12 C 9.8 12 8 10.2 8 8 C 8 5.8 9.8 4 12 4 C 14.2 4 16 5.8 16 8 Z", "M 16 8 C 16 10.2 14.2 12 12 12 C 9.8 12 8 10.2 8 8 C 8 5.8 9.8 4 12 4 C 14.2 4 16 5.8 16 8 Z", nil),
        "plus": ("M 12 5 V 19 M 5 12 H 19", "", nil),
        "check": ("M 5 12.5 L 10 17.5 L 19 7", "", nil),
        "chev": ("M 6 9.5 L 12 15.5 L 18 9.5", "", nil),
        "chevron.left": ("M 15 5 L 8 12 L 15 19", "", nil),
        "chevron.right": ("M 9 5 L 16 12 L 9 19", "", nil),
        "xmark": ("M 6 6 L 18 18 M 18 6 L 6 18", "", nil),
        "clock": ("M 21 12 C 21 16.97 16.97 21 12 21 C 7.03 21 3 16.97 3 12 C 3 7.03 7.03 3 12 3 C 16.97 3 21 7.03 21 12 Z M 12 7 V 12 L 15.5 14", "M 21 12 C 21 16.97 16.97 21 12 21 C 7.03 21 3 16.97 3 12 C 3 7.03 7.03 3 12 3 C 16.97 3 21 7.03 21 12 Z", nil),
        "meal": ("M 3 12 H 21 C 21 17 17 20 12 20 C 7 20 3 17 3 12 Z M 8 4 C 7 6 9 7 8 9 M 13 4 C 12 6 14 7 13 9", "M 3 12 H 21 C 21 17 17 20 12 20 C 7 20 3 17 3 12 Z", nil),
        "drink": ("M 6 4 H 18 L 16.5 20 H 7.5 Z M 6.6 10 H 17.4", "M 6.6 10 H 17.4 L 16.5 20 H 7.5 Z", nil),
        "nap": ("M 19 14.5 C 17.8 15.2 16.4 15.5 15 15.5 C 10.6 15.5 7.5 12.4 7.5 8 C 7.5 6.6 7.8 5.2 8.5 4 C 5.5 5 3.5 8 3.5 11.5 C 3.5 16 7 19.5 11.5 19.5 C 15 19.5 18 17.5 19 14.5 Z", "M 19 14.5 C 17.8 15.2 16.4 15.5 15 15.5 C 10.6 15.5 7.5 12.4 7.5 8 C 7.5 6.6 7.8 5.2 8.5 4 C 5.5 5 3.5 8 3.5 11.5 C 3.5 16 7 19.5 11.5 19.5 C 15 19.5 18 17.5 19 14.5 Z", (18, 6)),
        "activity": ("M 4 18 L 9 8 L 13 14 L 16 10 L 20 18 Z", "M 4 18 L 9 8 L 13 14 L 16 10 L 20 18 Z", (17, 5)),
        "mood": ("M 21 12 C 21 16.97 16.97 21 12 21 C 7.03 21 3 16.97 3 12 C 3 7.03 7.03 3 12 3 C 16.97 3 21 7.03 21 12 Z M 8 14 C 9 16.5 15 16.5 16 14 M 15 9.5 V 10.5", "M 21 12 C 21 16.97 16.97 21 12 21 C 7.03 21 3 16.97 3 12 C 3 7.03 7.03 3 12 3 C 16.97 3 21 7.03 21 12 Z", (9, 10)),
        "photo": ("M 3 7 H 8 L 10 5 H 14 L 16 7 H 21 V 19 H 3 Z M 15.5 13 C 15.5 14.9 13.9 16.5 12 16.5 C 10.1 16.5 8.5 14.9 8.5 13 C 8.5 11.1 10.1 9.5 12 9.5 C 13.9 9.5 15.5 11.1 15.5 13 Z", "M 3 7 H 8 L 10 5 H 14 L 16 7 H 21 V 19 H 3 Z", nil),
        "arrive": ("M 4 20 V 11 L 12 4 L 20 11 V 20 Z M 10 20 V 14 H 14 V 20", "M 4 20 V 11 L 12 4 L 20 11 V 20 Z", nil),
        "pickup": ("M 3 12 H 17 M 12 6 L 18 12 L 12 18 M 21 5 V 19", "", nil),
        "note": ("M 5 3 H 15 L 19 7 V 21 H 5 Z M 9 12 H 15 M 9 16 H 15", "M 5 3 H 15 L 19 7 V 21 H 5 Z", nil),
        "bell": ("M 6 17 V 11 C 6 7.5 8.5 5 12 5 C 15.5 5 18 7.5 18 11 V 17 L 20 19 H 4 Z M 10 21 H 14", "M 6 17 V 11 C 6 7.5 8.5 5 12 5 C 15.5 5 18 7.5 18 11 V 17 L 20 19 H 4 Z", nil),
        "shield": ("M 12 3 L 20 6 V 12 C 20 16.5 16.5 19.5 12 21 C 7.5 19.5 4 16.5 4 12 V 6 Z M 12 9 V 14 M 9.5 11.5 H 14.5", "M 12 3 L 20 6 V 12 C 20 16.5 16.5 19.5 12 21 C 7.5 19.5 4 16.5 4 12 V 6 Z", nil),
        "pills": ("M 4 14 L 14 4 C 16 2.5 19 3.5 20 5.5 C 21 7.5 20.5 9.5 19 11 L 9 21 C 7 22.5 4 21.5 3 19.5 C 2 17.5 2.5 15.5 4 14 Z M 8.5 8.5 L 15.5 15.5", "M 4 14 L 14 4 C 16 2.5 19 3.5 20 5.5 C 21 7.5 20.5 9.5 19 11 L 9 21 C 7 22.5 4 21.5 3 19.5 C 2 17.5 2.5 15.5 4 14 Z", nil),
        "phone": ("M 6 3 H 10 L 11.5 8 L 9 9.5 C 10 12 12 14 14.5 15 L 16 12.5 L 21 14 V 18 C 21 19.5 20 21 18 21 C 10 20.5 3.5 14 3 6 C 3 4.5 4.5 3 6 3 Z", "M 6 3 H 10 L 11.5 8 L 9 9.5 C 10 12 12 14 14.5 15 L 16 12.5 L 21 14 V 18 C 21 19.5 20 21 18 21 C 10 20.5 3.5 14 3 6 C 3 4.5 4.5 3 6 3 Z", nil),
        "people": ("M 10 8 C 10 9.7 8.7 11 7 11 C 5.3 11 4 9.7 4 8 C 4 6.3 5.3 5 7 5 C 8.7 5 10 6.3 10 8 Z M 2 19 C 2 16 4.5 14 7 14 C 9.5 14 12 16 12 19 M 20 8 C 20 9.7 18.7 11 17 11 C 15.3 11 14 9.7 14 8 C 14 6.3 15.3 5 17 5 C 18.7 5 20 6.3 20 8 Z M 14.5 14.3 C 15.3 14.1 16.2 14 17 14 C 19.5 14 22 16 22 19", "M 10 8 C 10 9.7 8.7 11 7 11 C 5.3 11 4 9.7 4 8 C 4 6.3 5.3 5 7 5 C 8.7 5 10 6.3 10 8 Z", nil),
        "send": ("M 3 11 L 21 4 L 15 21 L 11.5 13.5 Z M 11.5 13.5 L 21 4", "M 3 11 L 21 4 L 15 21 L 11.5 13.5 Z", nil),
        "report": ("M 6 5 H 18 V 21 H 6 Z M 9 3 H 15 V 7 H 9 Z M 9 12 H 15 M 9 16 H 13", "M 6 5 H 18 V 21 H 6 Z", nil),
        "lock": ("M 5 11 H 19 V 21 H 5 Z M 8 11 V 8 C 8 5.8 9.8 4 12 4 C 14.2 4 16 5.8 16 8 V 11", "M 5 11 H 19 V 21 H 5 Z", (12, 16)),
        "search": ("M 17 10.5 C 17 14.1 14.1 17 10.5 17 C 6.9 17 4 14.1 4 10.5 C 4 6.9 6.9 4 10.5 4 C 14.1 4 17 6.9 17 10.5 Z M 15.5 15.5 L 20 20", "", nil),
        "trash": ("M 4 7 H 20 M 9 7 V 4 H 15 V 7 M 6 7 L 7 21 H 17 L 18 7", "", nil),
        "repeat": ("M 4 12 C 4 8 7 6 11 6 H 18 M 15 3 L 18 6 L 15 9 M 20 12 C 20 16 17 18 13 18 H 6 M 9 21 L 6 18 L 9 15", "", nil),
        "key": ("M 11 12 C 11 14.2 9.2 16 7 16 C 4.8 16 3 14.2 3 12 C 3 9.8 4.8 8 7 8 C 9.2 8 11 9.8 11 12 Z M 11 12 H 21 M 18 12 V 15 M 15 12 V 14.5", "M 11 12 C 11 14.2 9.2 16 7 16 C 4.8 16 3 14.2 3 12 C 3 9.8 4.8 8 7 8 C 9.2 8 11 9.8 11 12 Z", (7, 12)),
        "link": ("M 10 14 L 14 10 M 8 11 L 6 13 C 4.5 14.5 4.5 17 6 18 C 7.5 19.5 10 19.5 11 18 L 13 16 M 16 13 L 18 11 C 19.5 9.5 19.5 7 18 6 C 16.5 4.5 14 4.5 13 6 L 11 8", "", nil),
        "copy": ("M 8 8 H 20 V 21 H 8 Z M 4 16 V 3 H 16", "M 8 8 H 20 V 21 H 8 Z", nil),
        "edit": ("M 4 20 L 5 15 L 16 4 L 20 8 L 9 19 Z M 14 6 L 18 10", "M 4 20 L 5 15 L 16 4 L 20 8 L 9 19 Z", nil),
        "gear": ("M 12 2.8 V 5.6 M 12 18.4 V 21.2 M 2.8 12 H 5.6 M 18.4 12 H 21.2 M 5.5 5.5 L 7.5 7.5 M 16.5 16.5 L 18.5 18.5 M 18.5 5.5 L 16.5 7.5 M 7.5 16.5 L 5.5 18.5 O 12 12 6.4 O 12 12 2.8", "O 12 12 6.4", nil),
        "mic": ("M 12 3 C 10 3 9 4.2 9 5.5 V 11 C 9 12.7 10.3 14 12 14 C 13.7 14 15 12.7 15 11 V 5.5 C 15 4.2 14 3 12 3 Z M 6 11 C 6 14.9 8.7 17.5 12 17.5 C 15.3 17.5 18 14.9 18 11 M 12 17.5 V 21 M 8.5 21 H 15.5", "M 12 3 C 10 3 9 4.2 9 5.5 V 11 C 9 12.7 10.3 14 12 14 C 13.7 14 15 12.7 15 11 V 5.5 C 15 4.2 14 3 12 3 Z", nil)
    ]
}

/// One drawn icon. `size` is the box. `tint` is the ink line. The soft body fill uses the sky helper colour.
struct CareIcon: View {
    let name: String
    var size: CGFloat = 24
    var tint: Color = Brand.ink
    var fill: Bool = true
    var body: some View {
        let g = CareGlyphs.table[name]
        ZStack {
            if fill, let g = g, !g.body.isEmpty {
                CareIconShape(path: g.body).fill(Brand.sky.opacity(0.45))
            }
            if let g = g {
                CareIconShape(path: g.line).stroke(tint, style: StrokeStyle(lineWidth: max(1.4, size / 14), lineCap: .round, lineJoin: .round))
                if let d = g.dot {
                    Circle().fill(Brand.bunny).frame(width: size * 0.16, height: size * 0.16)
                        .position(x: d.0 / 24 * size, y: d.1 / 24 * size)
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Tab bar icon: drawn once to a template image, so the tab bar tints it. No SF Symbols.
enum CareTabIcon {
    @MainActor static func image(_ name: String) -> Image {
        let v = ZStack {
            if let g = CareGlyphs.table[name] {
                CareIconShape(path: g.line).stroke(Color.black, style: StrokeStyle(lineWidth: 1.8, lineCap: .round, lineJoin: .round))
            }
        }.frame(width: 26, height: 26)
        let r = ImageRenderer(content: v)
        r.scale = UIScreen.main.scale
        if let ui = r.uiImage { return Image(uiImage: ui.withRenderingMode(.alwaysTemplate)) }
        return Image(uiImage: UIImage())
    }
}
