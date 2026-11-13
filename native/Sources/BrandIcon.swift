import SwiftUI
import UIKit

/// Caresitters' own icon set. Drawn on a 24 grid with one rounded 2 point line, warm plum ink,
/// and a small bunny pink heart where an icon needs a spark. No emoji, no system symbols.
enum BI: String, CaseIterable {
    case home, nanny, moon, globe, bunny, rate, star, calendar, doc, lock, camera, plus, check, checkCircle, circle
    case pencil, chat, mail, clock, cross, banned, sparkle, sun, tray, search, shield, arrow, skip, heart, info, send
    case child, pin, undo, chevron, person, findCare, back, settings
    case wheel, firstAid, swim, bowl, book, paw, cat, leaf, ball, note

    /// line: stroked. fill: solid ink. accent: solid bunny pink.
    /// Commands (absolute): M L H V C Z, O cx cy r (circle), E cx cy rx ry (ellipse), Y cx cy size (heart).
    var spec: (line: String, fill: String, accent: String) {
        switch self {
        case .heart: return ("M12 21C5 15.5 3 11.5 3 8.5C3 5.5 5.3 3.5 7.8 3.5C9.7 3.5 11.2 4.6 12 6.2C12.8 4.6 14.3 3.5 16.2 3.5C18.7 3.5 21 5.5 21 8.5C21 11.5 19 15.5 12 21Z", "", "")
        case .home: return ("M3 11.2L12 3.6L21 11.2 M5.6 9.6V20.4H18.4V9.6", "", "Y 12 15 7")
        case .nanny: return ("O 12 7 3.2 M5 20.5C5 16 8 13 12 13C16 13 19 16 19 20.5", "", "Y 12 17 5")
        case .moon: return ("M19.8 14.6C18.7 15.1 17.5 15.4 16.2 15.4C11.7 15.4 8 11.7 8 7.2C8 5.9 8.3 4.7 8.8 3.6C5.4 4.8 3 8 3 11.8C3 16.6 6.9 20.5 11.7 20.5C15.4 20.5 18.6 18.1 19.8 14.6Z", "", "Y 17.2 6.6 4.4")
        case .globe: return ("O 12 12 9 M3 12H21 M12 3C8.6 6.6 8.6 17.4 12 21 M12 3C15.4 6.6 15.4 17.4 12 21", "", "")
        case .bunny: return ("E 8.9 6.2 2 4.2 E 15.1 6.2 2 4.2 E 12 15.2 6.6 5.6", "O 9.7 14.3 0.9 O 14.3 14.3 0.9", "Y 12 17.1 3.4")
        case .rate: return ("O 12 12 9 M14.9 9.2C14.4 8.3 13.4 7.8 12 7.8C10.4 7.8 9.3 8.6 9.3 9.8C9.3 12.5 14.8 11.2 14.8 14.2C14.8 15.4 13.5 16.2 12 16.2C10.5 16.2 9.4 15.6 9 14.6 M12 6V7.8 M12 16.2V18", "", "")
        case .star: return ("M12 3.6L14.5 9L20.4 9.7L16 13.7L17.2 19.6L12 16.7L6.8 19.6L8 13.7L3.6 9.7L9.5 9Z", "", "")
        case .calendar: return ("M4.5 6.5H19.5V20H4.5Z M4.5 11H19.5 M8.5 3.5V8 M15.5 3.5V8", "", "Y 12 15.4 4.4")
        case .doc: return ("M6.5 3H14.5L18.5 7V21H6.5Z M14.5 3V7H18.5 M9.5 12H15.5 M9.5 16H13.5", "", "")
        case .lock: return ("M5.5 10.5H18.5V20.5H5.5Z M8.5 10.5V7.6C8.5 5.5 10 4 12 4C14 4 15.5 5.5 15.5 7.6V10.5", "", "O 12 15.4 1.5")
        case .camera: return ("M3.5 8H8L9.5 5.5H14.5L16 8H20.5V19H3.5Z O 12 13.4 3.2", "", "")
        case .plus: return ("M12 5V19 M5 12H19", "", "")
        case .check: return ("M5 12.5L10 17.5L19 7", "", "")
        case .checkCircle: return ("O 12 12 9 M7.8 12.3L10.8 15.2L16.4 9.2", "", "")
        case .circle: return ("O 12 12 9", "", "")
        case .pencil: return ("M4 20L5 15.4L15.8 4.6C16.8 3.6 18.4 3.6 19.4 4.6C20.4 5.6 20.4 7.2 19.4 8.2L8.6 19Z M13.6 6.8L17.2 10.4", "", "")
        case .chat: return ("M4 5.5H20V16.5H12L7.5 20.5V16.5H4Z", "", "Y 12 11 5.2")
        case .mail: return ("M3.5 6H20.5V18H3.5Z M3.5 7L12 13.4L20.5 7", "", "")
        case .clock: return ("O 12 12 9 M12 7V12L15.4 14", "", "")
        case .cross: return ("M6 6L18 18 M18 6L6 18", "", "")
        case .banned: return ("O 12 12 9 M5.6 5.6L18.4 18.4", "", "")
        case .sparkle: return ("M12 3.5L13.9 9.1L19.5 11L13.9 12.9L12 18.5L10.1 12.9L4.5 11L10.1 9.1Z M19 17.5V21.5 M17 19.5H21", "", "")
        case .sun: return ("O 12 12 4.2 M12 3V5.2 M12 18.8V21 M3 12H5.2 M18.8 12H21 M5.6 5.6L7.2 7.2 M16.8 16.8L18.4 18.4 M5.6 18.4L7.2 16.8 M16.8 7.2L18.4 5.6", "", "")
        case .tray: return ("M3.5 13L6.5 5.5H17.5L20.5 13V19.5H3.5Z M3.5 13H8.5C8.5 14.7 10 16 12 16C14 16 15.5 14.7 15.5 13H20.5", "", "")
        case .search: return ("O 10.5 10.5 6.5 M15.4 15.4L20 20", "", "")
        case .shield: return ("M12 3L19.5 6V12C19.5 16.5 16.5 19.6 12 21C7.5 19.6 4.5 16.5 4.5 12V6Z M8.8 12L11 14.2L15.4 9.6", "", "")
        case .arrow: return ("M5 12H19 M13 6L19 12L13 18", "", "")
        case .back: return ("M19 12H5 M11 6L5 12L11 18", "", "")
        case .skip: return ("M5 6L12 12L5 18 M13 6L20 12L13 18", "", "")
        case .info: return ("O 12 12 9 M12 11V16.4", "O 12 7.9 1", "")
        case .send: return ("M3.5 11L20.5 3.5L13 20.5L11 13Z M11 13L20.5 3.5", "", "")
        case .child: return ("O 12 8 3 M7.6 20.5C7.6 16 9.4 14 12 14C14.6 14 16.4 16 16.4 20.5Z", "", "")
        case .pin: return ("M12 21C12 21 5.5 14.6 5.5 10C5.5 6.4 8.4 3.5 12 3.5C15.6 3.5 18.5 6.4 18.5 10C18.5 14.6 12 21 12 21Z", "", "O 12 10 2.3")
        case .undo: return ("M4 9H14C17.3 9 20 11.7 20 15C20 18.3 17.3 21 14 21H8 M8 5L4 9L8 13", "", "")
        case .chevron: return ("M9 5L16 12L9 19", "", "")
        case .person: return ("O 12 8 3.6 M5 20.5C5 16 8 13.6 12 13.6C16 13.6 19 16 19 20.5", "", "")
        case .settings: return ("M4 7H8.8 M15.2 7H20 O 12 7 3.2 M4 17H4.8 M11.2 17H20 O 8 17 3.2", "", "Y 12 7 2.4")
        case .wheel: return ("O 12 12 9 O 12 12 2.2 M12 14.2V21 M3.4 10.2L9.8 12 M20.6 10.2L14.2 12", "", "")
        case .firstAid: return ("M4 7.5H20V20H4Z M9 7.5V4.5H15V7.5", "", "M11 11V13.4H8.6V15.6H11V18H13V15.6H15.4V13.4H13V11Z")
        case .swim: return ("M3 16.5C5 15 7 15 9 16.5C11 18 13 18 15 16.5C17 15 19 15 21 16.5 M3 20.5C5 19 7 19 9 20.5C11 22 13 22 15 20.5 M6 12.5L11 9.5L15.5 11.5", "", "O 16.5 6.5 2")
        case .bowl: return ("M4 11H20C20 15.8 16.5 19 12 19C7.5 19 4 15.8 4 11Z M9 8C9 6.8 10 6.6 10 5.4 M14 8C14 6.8 15 6.6 15 5.4", "", "")
        case .book: return ("M6 3.5H18.5V20.5H6C5 20.5 4.5 19.7 4.5 19V5C4.5 4.2 5 3.5 6 3.5Z M8.5 8H15.5 M8.5 12H13", "", "")
        case .paw: return ("O 12 15.4 3.6", "", "O 6.5 10.5 1.8 O 17.5 10.5 1.8 O 9.4 6.6 1.8 O 14.6 6.6 1.8")
        case .cat: return ("M5 19V6.5L9.2 9.6C10.7 9.2 13.3 9.2 14.8 9.6L19 6.5V19C19 20.4 16 21 12 21C8 21 5 20.4 5 19Z", "", "O 9.5 14 1 O 14.5 14 1")
        case .leaf: return ("M5 19C5 10 10 5 20 4.5C20 14 15 19 5 19Z M5 19L13 11", "", "")
        case .ball: return ("O 12 12 9 M3.4 9.5C8 10.5 16 10.5 20.6 9.5 M3.4 14.5C8 13.5 16 13.5 20.6 14.5 M12 3V21", "", "")
        case .note: return ("M9 18V5.5L19 3.5V16", "", "O 6.8 18 2.2 O 16.8 16 2.2")
        case .findCare: return ("O 12 12 9.2", "", "Y 12 12.4 8.4")
        }
    }
}

/// Mini path reader for the commands above.
struct IconShape: Shape {
    let d: String
    func path(in rect: CGRect) -> Path {
        let k = rect.width / 24
        func pt(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: rect.minX + x * k, y: rect.minY + y * k) }
        var p = Path()
        let t = d.replacingOccurrences(of: ",", with: " ")
        var cmd: Character = "M"; var nums: [Double] = []
        var tokens: [(Character, [Double])] = []
        var cur = ""
        func flushNum() { if !cur.isEmpty, let v = Double(cur) { nums.append(v) }; cur = "" }
        for ch in t {
            if ch.isLetter { flushNum(); tokens.append((cmd, nums)); nums = []; cmd = ch }
            else if ch == " " { flushNum() }
            else if ch == "-" { flushNum(); cur = "-" }
            else { cur.append(ch) }
        }
        flushNum(); tokens.append((cmd, nums))
        var cp = CGPoint.zero
        for (c, n) in tokens {
            switch c {
            case "M" where n.count >= 2: cp = pt(n[0], n[1]); p.move(to: cp)
            case "L" where n.count >= 2: cp = pt(n[0], n[1]); p.addLine(to: cp)
            case "H" where n.count >= 1: cp = CGPoint(x: rect.minX + n[0] * k, y: cp.y); p.addLine(to: cp)
            case "V" where n.count >= 1: cp = CGPoint(x: cp.x, y: rect.minY + n[0] * k); p.addLine(to: cp)
            case "C" where n.count >= 6: cp = pt(n[4], n[5]); p.addCurve(to: cp, control1: pt(n[0], n[1]), control2: pt(n[2], n[3]))
            case "Z": p.closeSubpath()
            case "O" where n.count >= 3: p.addEllipse(in: CGRect(x: rect.minX + (n[0] - n[2]) * k, y: rect.minY + (n[1] - n[2]) * k, width: 2 * n[2] * k, height: 2 * n[2] * k))
            case "E" where n.count >= 4: p.addEllipse(in: CGRect(x: rect.minX + (n[0] - n[2]) * k, y: rect.minY + (n[1] - n[3]) * k, width: 2 * n[2] * k, height: 2 * n[3] * k))
            case "Y" where n.count >= 3:
                let s = n[2] / 18.0   // the heart is 18 wide in its own grid
                func h(_ x: Double, _ y: Double) -> CGPoint { pt(n[0] + (x - 12) * s, n[1] + (y - 12.25) * s) }
                p.move(to: h(12, 21))
                p.addCurve(to: h(3, 8.5), control1: h(5, 15.5), control2: h(3, 11.5))
                p.addCurve(to: h(7.8, 3.5), control1: h(3, 5.5), control2: h(5.3, 3.5))
                p.addCurve(to: h(12, 6.2), control1: h(9.7, 3.5), control2: h(11.2, 4.6))
                p.addCurve(to: h(16.2, 3.5), control1: h(12.8, 4.6), control2: h(14.3, 3.5))
                p.addCurve(to: h(21, 8.5), control1: h(18.7, 3.5), control2: h(21, 5.5))
                p.addCurve(to: h(12, 21), control1: h(21, 11.5), control2: h(19, 15.5))
                p.closeSubpath()
            default: break
            }
        }
        return p
    }
}

/// One Caresitters icon. `color` is the line, the pink spark stays pink unless `mono` is true.
struct BrandIcon: View {
    let kind: BI; var size: CGFloat = 22; var color: Color = Brand.ink; var solid = false; var mono = false
    var body: some View {
        let s = kind.spec
        ZStack {
            if solid { IconShape(d: s.line).fill(color) }
            IconShape(d: s.line).stroke(color, style: StrokeStyle(lineWidth: 2 * size / 24, lineCap: .round, lineJoin: .round))
            if !s.fill.isEmpty { IconShape(d: s.fill).fill(color) }
            if !s.accent.isEmpty { IconShape(d: s.accent).fill(mono ? color : Brand.bunny) }
        }.frame(width: size, height: size).accessibilityHidden(true)
    }
    /// A tab bar needs a real image. This draws the icon once as a template picture the tab bar can tint.
    @MainActor static func image(_ kind: BI, size: CGFloat = 26) -> Image {
        let r = ImageRenderer(content: BrandIcon(kind: kind, size: size, color: .black, mono: true))
        r.scale = UIScreen.main.scale
        if let ui = r.uiImage { return Image(uiImage: ui.withRenderingMode(.alwaysTemplate)) }
        return Image(systemName: "circle")
    }
}

/// Icon + words on one line. Replaces every "emoji + text" label.
struct IconLabel: View {
    let icon: BI; let text: String; var size: CGFloat = 16; var color: Color? = nil; var gap: CGFloat = 6
    var body: some View {
        HStack(spacing: gap) { BrandIcon(kind: icon, size: size, color: color ?? Brand.ink); Text(text) }
    }
}

/// Row of star icons for a rating (1 to 5).
struct Stars: View {
    let count: Int; var size: CGFloat = 14
    var body: some View { HStack(spacing: 2) { ForEach(0..<max(0, min(5, count)), id: \.self) { _ in BrandIcon(kind: .star, size: size, color: Brand.bunny, solid: true) } } }
}
