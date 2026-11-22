import SwiftUI
import CoreLocation
import UIKit

// Caresitters redesign: palette, fonts, icons, shared components and the little router.
// Colours and wording follow the approved pink design. No emoji, no dashes in copy, Australian spelling.

enum RdC {
    static let ink = Color(hex: 0x2D2A35)
    static let pink = Color(hex: 0xF4A9BC)
    static let blush = Color(hex: 0xF6CBD3)
    static let ras = Color(hex: 0xC2345B)
    static let sky = Color(hex: 0xB9D6EC)
    static let sun = Color(hex: 0xF6D67C)
    static let por = Color(hex: 0xFDF8F0)
    static let pale = Color(hex: 0xFBEFF2)
    static let lav = Color(hex: 0xCFC3E8)
    static let mut = Color(hex: 0x6B6672)
    static let line = Color(hex: 0xEDE4E8)
    static let field = Color(hex: 0xF6F1F3)
    static let okBg = Color(hex: 0xE6F4EA)
    static let okFg = Color(hex: 0x1E6B3A)
    static let warnBg = Color(hex: 0xFFF3D1)
    static let warnFg = Color(hex: 0x8A5B00)
    static func role(_ r: String) -> Color {
        switch r {
        case "nanny": return blush
        case "babysitter": return sun
        case "aupair": return sky
        default: return lav
        }
    }
}

enum RdF {
    static func title(_ s: CGFloat) -> Font { return Font.custom("Fraunces-Black", size: s) }
    static func body(_ s: CGFloat = 17) -> Font { return Font.custom("Atkinson Hyperlegible", size: s) }
    static func bold(_ s: CGFloat = 17) -> Font { return Font.custom("Atkinson Hyperlegible", size: s).bold() }
}

// ----- icons -----
enum RdIcons {
    static let labelIcon: [String: String] = [
        "First aid": "firstAid", "CPR": "cpr", "Driving licence": "licence", "Cooking": "pot", "Homework help": "book", "Swimming": "swim",
        "Calm": "calm", "Gentle": "gentle", "Firm": "firm", "Playful": "balloon", "Outdoorsy": "tree", "Musical": "note",
        "Montessori": "blocks", "Flexible": "bend", "Strict": "ruler", "Own room": "bed", "Own bathroom": "bath", "Full board": "plate",
        "Use of car": "car", "Phone plan": "phone", "Language course help": "school", "Completion bonus": "gift", "Two days off a week": "weekend",
        "Dancing": "dance", "Music": "note", "Arts and craft": "pencil", "Outdoor play": "tree", "Reading": "book", "Sport": "ball", "Gardening": "leaf",
        "Animals": "paw", "Story time": "book", "Screen free": "screen", "Waldorf": "leaf", "Play based": "balloon", "Reggio": "pencil",
        "Funny": "sparkle", "Patient": "hourglass", "Energetic": "sun", "Organised": "doc", "Own car": "car", "School runs": "bus", "Meal prep": "plate",
        "Light housework": "home", "Special needs": "heart", "Twins": "group", "Sleep routines": "moon", "Potty training": "bowl", "Pets are fine": "paw",
        "Non smoker": "banned", "Newborns": "child", "Toddlers": "child", "Ages 3 to 5": "child", "Ages 6 to 12": "child", "Teens": "child",
        "Board games": "blocks", "Baking": "pot", "Yoga": "calm", "Nature walks": "leaf", "Science": "sparkle", "Creative": "pencil",
        "Affectionate": "heart", "Bedtime": "moon", "Language through play": "globe", "Pet care": "cat"
    ]
    static func forLabel(_ l: String) -> String { return labelIcon[l] ?? "heart" }
    static func map(_ n: String) -> BI {
        switch n {
        case "x": return .cross
        case "video": return .screen
        case "image": return .camera
        default: return BI(rawValue: n) ?? .heart
        }
    }
}

struct RdMenuGlyph: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        for f in [0.30, 0.5, 0.70] {
            p.move(to: CGPoint(x: r.minX + r.width * 0.17, y: r.minY + r.height * f))
            p.addLine(to: CGPoint(x: r.minX + r.width * 0.83, y: r.minY + r.height * f))
        }
        return p
    }
}
struct RdSlidersGlyph: View {
    var size: CGFloat = 22
    var color: Color = RdC.ink
    var body: some View {
        ZStack {
            Path { p in
                p.move(to: CGPoint(x: size * 0.17, y: size * 0.33)); p.addLine(to: CGPoint(x: size * 0.83, y: size * 0.33))
                p.move(to: CGPoint(x: size * 0.17, y: size * 0.67)); p.addLine(to: CGPoint(x: size * 0.83, y: size * 0.67))
            }.stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
            Circle().fill(Color.white).overlay(Circle().stroke(color, lineWidth: 2)).frame(width: size * 0.22, height: size * 0.22).position(x: size * 0.38, y: size * 0.33)
            Circle().fill(Color.white).overlay(Circle().stroke(color, lineWidth: 2)).frame(width: size * 0.22, height: size * 0.22).position(x: size * 0.62, y: size * 0.67)
        }.frame(width: size, height: size)
    }
}

struct RdIcon: View {
    var name: String
    var size: CGFloat = 22
    var color: Color = RdC.ink
    var body: some View {
        if name == "menu" {
            RdMenuGlyph().stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round)).frame(width: size, height: size)
        } else if name == "sliders" {
            RdSlidersGlyph(size: size, color: color)
        } else {
            BrandIcon(kind: RdIcons.map(name), size: size, color: color)
        }
    }
}

// ----- small pieces -----
struct RdRing: View {
    var pct: Int
    var size: CGFloat = 64
    var line: CGFloat = 7
    var body: some View {
        ZStack {
            Circle().stroke(RdC.blush, lineWidth: line)
            Circle().trim(from: 0, to: CGFloat(pct) / 100).stroke(RdC.ras, style: StrokeStyle(lineWidth: line, lineCap: .round)).rotationEffect(.degrees(-90))
            Text(String(pct)).font(RdF.title(size * 0.3)).foregroundColor(RdC.ink)
        }.frame(width: size - line, height: size - line).padding(line / 2)
    }
}

struct RdPill: View {
    var role: String
    var body: some View {
        HStack(spacing: 5) {
            RdIcon(name: RdPill.icon(role), size: 14)
            Text(RdPill.name(role)).font(RdF.bold(13)).lineLimit(1).fixedSize()
        }.padding(.horizontal, 12).padding(.vertical, 5).background(RdC.role(role)).clipShape(Capsule()).foregroundColor(RdC.ink)
    }
    static func icon(_ r: String) -> String {
        switch r { case "nanny": return "nanny"; case "babysitter": return "moon"; case "aupair": return "globe"; default: return "home" }
    }
    static func name(_ r: String) -> String {
        switch r { case "nanny": return "Nanny"; case "babysitter": return "Babysitter"; case "aupair": return "Au pair"; default: return "Family" }
    }
}

struct RdTag: View {
    var text: String
    var fill: Color = RdC.pale
    var fg: Color = RdC.ras
    var body: some View { Text(text).font(RdF.bold(13)).foregroundColor(fg).padding(.horizontal, 12).padding(.vertical, 3).background(fill).clipShape(Capsule()) }
}

struct RdChip: View {
    var text: String
    var icon: String? = nil
    var on: Bool = false
    var tone: Int = 0 // 0 normal, 1 visa ready, 2 visa in progress, 3 muted
    var body: some View {
        HStack(spacing: 6) {
            if let i = icon { RdIcon(name: i, size: 16, color: fg) }
            Text(text).font(RdF.bold(14)).foregroundColor(fg).lineLimit(1)
        }.padding(.horizontal, 13).padding(.vertical, 7).background(bgc).clipShape(Capsule()).overlay(Capsule().stroke(edge, lineWidth: 1)).fixedSize()
    }
    var fg: Color { if on { return .white }; switch tone { case 1: return RdC.okFg; case 2: return RdC.warnFg; case 3: return Color(hex: 0x5B5663); default: return RdC.ink } }
    var bgc: Color { if on { return RdC.ink }; switch tone { case 1: return RdC.okBg; case 2: return RdC.warnBg; case 3: return Color(hex: 0xF1EEF3); default: return .white } }
    var edge: Color { if on { return RdC.ink }; switch tone { case 1: return Color(hex: 0xBFE3CB); case 2: return Color(hex: 0xF3DFA0); default: return RdC.line } }
}

/// A chip that toggles itself on tap.
struct RdToggleChip: View {
    var text: String
    var icon: String? = nil
    @State var on: Bool
    var body: some View { Button { on.toggle() } label: { RdChip(text: text, icon: icon, on: on) }.buttonStyle(.plain) }
}

/// A tick card that toggles itself on tap.
struct RdTick: View {
    var label: String
    @State var on: Bool
    var body: some View {
        Button { on.toggle() } label: {
            VStack(spacing: 4) {
                RdIcon(name: RdIcons.forLabel(label), size: 28)
                Text(label).font(RdF.bold(14)).multilineTextAlignment(.center).foregroundColor(RdC.ink).lineLimit(2).minimumScaleFactor(0.8)
            }.frame(maxWidth: .infinity, minHeight: 78).padding(.horizontal, 4).padding(.vertical, 6)
            .background(on ? RdC.pale : Color.white)
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(on ? RdC.ras : RdC.line, lineWidth: 2)).clipShape(RoundedRectangle(cornerRadius: 22))
        }.buttonStyle(.plain)
    }
}

struct RdTickGrid: View {
    var items: [String]
    var on: [String]
    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
            ForEach(items, id: \.self) { RdTick(label: $0, on: on.contains($0)) }
        }.padding(.horizontal, 20)
    }
}

struct RdWrap: View {
    var items: [String]
    var on: [String] = []
    var body: some View {
        RdFlow(spacing: 8) { ForEach(items, id: \.self) { RdToggleChip(text: $0, on: on.contains($0)) } }.padding(.horizontal, 20)
    }
}

/// A pick one row of chips.
struct RdPick: View {
    var items: [String]
    @State var sel: Int
    var stretch: Bool = true
    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<items.count, id: \.self) { i in
                Button { sel = i } label: {
                    Text(items[i]).font(RdF.bold(14)).foregroundColor(sel == i ? .white : RdC.ink).lineLimit(1).minimumScaleFactor(0.8)
                        .frame(maxWidth: stretch ? .infinity : nil).padding(.horizontal, 12).padding(.vertical, 8)
                        .background(sel == i ? RdC.ink : Color.white).clipShape(Capsule()).overlay(Capsule().stroke(sel == i ? RdC.ink : RdC.line, lineWidth: 1))
                }.buttonStyle(.plain)
            }
        }
    }
}

/// A simple left to right wrapping layout.
struct RdFlow: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? 340
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for s in subviews {
            let sz = s.sizeThatFits(.unspecified)
            if x + sz.width > maxW && x > 0 { x = 0; y += rowH + spacing; rowH = 0 }
            x += sz.width + spacing; rowH = max(rowH, sz.height)
        }
        return CGSize(width: maxW, height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for s in subviews {
            let sz = s.sizeThatFits(.unspecified)
            if x + sz.width > bounds.maxX && x > bounds.minX { x = bounds.minX; y += rowH + spacing; rowH = 0 }
            s.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(sz))
            x += sz.width + spacing; rowH = max(rowH, sz.height)
        }
    }
}

struct RdCta: View {
    var title: String
    var icon: String? = nil
    var style: Int = 0 // 0 pink, 1 outline, 2 dark
    var small: Bool = false
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if let i = icon { RdIcon(name: i, size: small ? 20 : 24, color: fg) }
                Text(title).font(RdF.bold(small ? 14 : 20)).foregroundColor(fg).lineLimit(1).minimumScaleFactor(0.7)
            }.frame(maxWidth: .infinity, minHeight: small ? 48 : 60).background(bgc).clipShape(Capsule())
            .overlay(Capsule().stroke(style == 1 ? RdC.ink : Color.clear, lineWidth: 2))
            .shadow(color: style == 0 && !small ? RdC.ras.opacity(0.22) : Color.clear, radius: 12, y: 8)
        }.buttonStyle(.plain)
    }
    var fg: Color { return style == 2 ? .white : RdC.ink }
    var bgc: Color { switch style { case 1: return .white; case 2: return RdC.ink; default: return RdC.pink } }
}

struct RdMsgButton: View {
    var action: () -> Void
    var size: CGFloat = 60
    var body: some View {
        Button(action: action) {
            RdIcon(name: "chat", size: 26).frame(width: size, height: size).background(Color.white).clipShape(Circle()).overlay(Circle().stroke(RdC.ink, lineWidth: 2))
        }.buttonStyle(.plain).accessibilityLabel("Message")
    }
}

struct RdIconButton: View {
    var icon: String
    var glass: Bool = false
    var size: CGFloat = 44
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            RdIcon(name: icon, size: 22).frame(width: size, height: size)
                .background(glass ? Color.white.opacity(0.8) : Color.white).clipShape(Circle()).overlay(Circle().stroke(glass ? Color.white.opacity(0.6) : RdC.line, lineWidth: 1))
        }.buttonStyle(.plain)
    }
}

struct RdHeader: View {
    var title: String
    var back: Bool = true
    var trailing: AnyView? = nil
    @EnvironmentObject var st: RdStore
    var body: some View {
        HStack(spacing: 10) {
            if back { RdIconButton(icon: "back") { st.back() } }
            Text(title).font(RdF.title(22)).foregroundColor(RdC.ink).lineLimit(1).minimumScaleFactor(0.7).frame(maxWidth: .infinity, alignment: .leading)
            if let t = trailing { t }
        }.padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 10)
    }
}

struct RdCard<Content: View>: View {
    var title: String? = nil
    var tint: Color = Color.white
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let t = title { Text(t).font(RdF.title(18)).foregroundColor(RdC.ink) }
            content()
        }.frame(maxWidth: .infinity, alignment: .leading).padding(16).background(tint)
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(RdC.line, lineWidth: 1)).clipShape(RoundedRectangle(cornerRadius: 24)).padding(.horizontal, 20).padding(.vertical, 5)
    }
}

struct RdReason: View {
    var text: String
    var gap: Bool = false
    var bold: String? = nil
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack { Circle().fill(gap ? RdC.sun : RdC.pink); RdIcon(name: gap ? "info" : "check", size: 14) }.frame(width: 24, height: 24).padding(.top, 1)
            VStack(alignment: .leading, spacing: 2) {
                if let b = bold { Text(b).font(RdF.bold(16)).foregroundColor(RdC.ink) }
                Text(text).font(RdF.body(bold == nil ? 16 : 14)).foregroundColor(bold == nil ? RdC.ink : RdC.mut).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }.padding(.vertical, 4)
    }
}

struct RdField: View {
    var label: String
    var value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(RdF.body(12)).foregroundColor(RdC.mut)
            Text(value).font(RdF.body(16)).foregroundColor(RdC.ink)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 14).padding(.vertical, 12)
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(RdC.line, lineWidth: 1)).padding(.horizontal, 20).padding(.vertical, 4)
    }
}

struct RdBottomBar<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(spacing: 0) {
            Rectangle().fill(RdC.line).frame(height: 1)
            HStack(spacing: 12) { content() }.padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 10)
        }.background(Color.white)
    }
}

struct RdLabel: View {
    var title: String
    var sub: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(RdF.bold(17)).foregroundColor(RdC.ink)
            if let s = sub { Text(s).font(RdF.body(14)).foregroundColor(RdC.mut) }
        }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 20).padding(.top, 16).padding(.bottom, 8)
    }
}

struct RdMuted: View {
    var text: String
    var body: some View { Text(text).font(RdF.body(14)).foregroundColor(RdC.mut).frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true) }
}

struct RdBarRow: View {
    var left: String
    var value: String
    var boldLine: Bool = false
    var body: some View {
        HStack {
            Text(left).font(boldLine ? RdF.bold(15) : RdF.body(15)).foregroundColor(RdC.ink)
            Spacer()
            Text(value).font(RdF.bold(16)).foregroundColor(RdC.ink)
        }.padding(.vertical, 3)
    }
}

struct RdSwitch: View {
    var label: String
    @State var on: Bool
    var body: some View {
        Toggle(isOn: $on) { Text(label).font(RdF.body(17)).foregroundColor(RdC.ink) }.tint(RdC.pink).padding(.vertical, 6)
    }
}

// ----- the little router -----
final class RdStore: ObservableObject {
    @Published var stack: [String] = ["splash"]
    @Published var viewKey: String = "v1"
    @Published var setupRole: String = "nanny"
    @Published var isFamily: Bool = true
    @Published var tab: Int = 0
    @Published var pickedCare: String = "nanny"
    @Published var firstName: String = ""
    @Published var kidsAges: [Int] = []
    @Published var email: String = ""
    @Published var password: String = ""
    @Published var country: String = "Australia"
    @Published var postcode: String = ""
    @Published var radius: Int = 15
    @Published var home: String = ""
    @Published var dests: [String] = []
    @Published var visa: String = "I have not applied yet"
    @Published var visaOnly: Bool = false
    @Published var inCountryOnly: Bool = false
    @Published var err: String = ""
    @Published var chatRel: String = ""
    @Published var chatName: String = ""
    @Published var bookWith: String = ""
    @Published var bookName: String = ""
    @Published var bookRate: Double = 0
    @Published var origin: CLLocationCoordinate2D? = nil
    func defaultViewKey() -> String {
        if isFamily { return pickedCare == "aupair" ? "v3" : (pickedCare == "babysitter" ? "v2" : "v1") }
        return pickedCare == "aupair" ? "v5" : "v4"
    }
    var current: String { return stack.last ?? "splash" }
    func go(_ id: String) { if id != current { stack.append(id) } }
    func back() { if stack.count > 1 { stack.removeLast() } }
    func root(_ id: String) { stack = [id] }
    func ctx() -> RdCtx { return RdCtx(viewKey) }
}

struct RdView {
    var title: String
    var note: String
    var fam: String
    var car: String
    var asFamily: Bool
}

struct RdCtx {
    static let views: [String: RdView] = [
        "v1": RdView(title: "Nanny view", note: "A family looks at a nanny", fam: "reyes", car: "maya", asFamily: true),
        "v2": RdView(title: "Babysitter view", note: "A family looks at a babysitter", fam: "reyesb", car: "lily", asFamily: true),
        "v3": RdView(title: "Au pair view", note: "A family looks at an au pair", fam: "hartley", car: "anna", asFamily: true),
        "v4": RdView(title: "Family looking for a nanny", note: "A nanny looks at a family", fam: "reyes", car: "maya", asFamily: false),
        "v5": RdView(title: "Family looking for an au pair", note: "An au pair looks at a family", fam: "hartley", car: "anna", asFamily: false)
    ]
    var key: String
    var fam: RdFamily
    var car: RdCarer
    var m: RdResult
    var fm: Bool
    var role: String
    var au: Bool
    var photos: [String]
    var caps: [String]
    var reasons: [String]
    var name: String
    var first: String
    var headline: String
    var bio: String
    init(_ key: String) {
        self.key = key
        let v = RdCtx.views[key] ?? RdCtx.views["v1"]!
        fam = RdData.family(id: v.fam)
        car = RdData.carer(id: v.car)
        m = RdMatch.score(fam, car)
        fm = v.asFamily
        role = car.role
        au = car.role == "aupair"
        photos = fm ? car.photos : fam.photos
        caps = fm ? car.captions : fam.captions
        let raw = fm ? m.reasons : m.reasonsCarer
        reasons = raw.map { $0.replacingOccurrences(of: "cpr", with: "CPR") }
        name = fm ? car.name : fam.name
        first = fm ? (car.name.split(separator: " ").first.map(String.init) ?? car.name) : fam.name.replacingOccurrences(of: "The ", with: "")
        headline = fm ? car.headline : fam.headline
        bio = fm ? car.bio : fam.bio
    }
    var subline: String {
        if fm {
            let town: String = car.city.split(separator: " ").first.map(String.init) ?? ""
            let place: String = au ? car.suburb : car.suburb + ", " + town
            return place + " · " + String(car.years) + " years"
        }
        let town: String = fam.city.split(separator: " ").first.map(String.init) ?? ""
        return fam.suburb + ", " + town + " · " + fam.kids
    }
    var mainTitle: String { return fm ? "Book " + first : "Say yes to " + first }
    var mainIcon: String { return fm ? "calendar" : "check" }
    var pillRoles: [String] { return fm ? [car.role] + car.also : [fam.kind] + fam.also }
}

struct RdPills: View {
    var roles: [String]
    var body: some View { HStack(spacing: 6) { ForEach(roles, id: \.self) { RdPill(role: $0) } } }
}

struct RdVisaChip: View {
    var visa: RdVisa
    var body: some View {
        if visa.state == "ready" { RdChip(text: visa.type.isEmpty ? visa.text : "Visa ready", icon: "globe", tone: 1) }
        else if visa.state == "inprogress" { RdChip(text: "Visa in progress", icon: "globe", tone: 2) }
        else { RdChip(text: "Visa not applied", icon: "globe", tone: 3) }
    }
}
