import SwiftUI
import UIKit

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
}

/// The four themes of record: Light, Dark, Beige, Brand colour. White (Light) is the default.
enum ThemePick: String, CaseIterable, Identifiable {
    case light, dark, beige, brand
    var id: String { rawValue }
    var label: String { switch self { case .light: return "Light"; case .dark: return "Dark"; case .beige: return "Beige"; case .brand: return "Brand colour" } }
    var scheme: ColorScheme { self == .dark ? .dark : .light }
}

/// The pick is kept on the phone at once and saved on the account, so a fresh install brings it back.
final class ThemeStore: ObservableObject {
    static let shared = ThemeStore()
    @Published var pick: ThemePick { didSet { UserDefaults.standard.set(pick.rawValue, forKey: "caresits.theme") } }
    init() { pick = ThemePick(rawValue: UserDefaults.standard.string(forKey: "caresits.theme") ?? "") ?? .light }
}

/// Colours, WAY B: pink is the queen (about 80 percent). A few soft pastel helpers do two jobs only: fast signs and role signs. No dark green, ever.
/// Grounds and text change with the theme; the three pinks do not.
enum Brand {
    static var pick: ThemePick { ThemeStore.shared.pick }
    // The three pinks of record
    static let bunny = Color(hex: 0xF4A9BC)       // Bunny Pink
    static let blush = Color(hex: 0xF6CBD3)       // Blush Pink
    static let bunnyBlush = Color(hex: 0xF2C4CE)  // Bunny Blush
    static let paleGround = Color(hex: 0xFBEFF2)  // Pale Pink Ground (opening screen)
    static let porcelain = Color(hex: 0xFDF8F0)   // Warm Porcelain
    static let rose = Color(hex: 0xF2B8B5)        // Soft Rose (errors, pastel)
    // WAY B helpers, named at the desk against the brand sheet (the sheet names only the four colours above;
    // these helpers are named here in the open). ONLY two jobs: fast signs and telling the roles apart. Never leads, never fills.
    static let helperTeal = Color(hex: 0x9CC5B5)  // Morning Teal  : nanny
    static let helperApricot = Color(hex: 0xF2B880) // Apricot     : family
    static let helperLavender = Color(hex: 0xCFC3E8) // Lavender Haze : babysitter
    static let helperSky = Color(hex: 0xB9D6EC)   // Powder Blue   : au pair
    static let signBooked = Color(hex: 0xBFD8C0)  // Soft Sage     : booked
    static let signMessage = Color(hex: 0xF6D67C) // Butter Glow   : new message, chat
    /// Text colour: the brand sheet's own body text colour, measured off the sheet (#2D2A35).
    /// Muted is derived from it on the same hue. The dark pair is the desk's named dark-ground match.
    static var ink: Color { pick == .dark ? Color(hex: 0xF5EDEF) : Color(hex: 0x2D2A35) }
    static var muted: Color { pick == .dark ? Color(hex: 0xBBA9B0) : Color(hex: 0x6E6978) }
    /// The ground of every screen.
    static var cream: Color { switch pick { case .light: return Color(hex: 0xFFFFFF); case .dark: return Color(hex: 0x1E1719); case .beige: return Color(hex: 0xF5EDE0); case .brand: return Color(hex: 0xFBEFF2) } }
    /// Cards and sheets that sit on the ground.
    static var card: Color { switch pick { case .light: return Color(hex: 0xFFFFFF); case .dark: return Color(hex: 0x2B2327); case .beige: return Color(hex: 0xFBF6EC); case .brand: return Color(hex: 0xFFFFFF) } }
    /// Input fields and quiet chips.
    static var field: Color { switch pick { case .light: return Color(hex: 0xF8F2F4); case .dark: return Color(hex: 0x3A2F34); case .beige: return Color(hex: 0xEBE0CE); case .brand: return Color(hex: 0xF6CBD3).opacity(0.45) } }
    static var line: Color { pick == .dark ? Color.white.opacity(0.14) : Color.black.opacity(0.08) }
    /// Titles are Fraunces Black in Bunny Pink. Body text is Atkinson Hyperlegible.
    static var titleColor: Color { bunny }
    static func title(_ size: CGFloat) -> Font { .custom("Fraunces-Black", size: size) }
    /// Body font of record: Atkinson Hyperlegible (the brand sheet), bundled in Resources.
    static let body = Font.custom("Atkinson Hyperlegible", size: 17)
}

/// The four different apps inside one app. Everything role specific hangs off this.
enum Role: String, CaseIterable, Identifiable {
    case family, nanny, babysitter, auPair
    var id: String { rawValue }
    var service: String? { switch self { case .family: return nil; case .nanny: return "nanny"; case .babysitter: return "babysitter"; case .auPair: return "au_pair" } }
    var icon: BI { switch self { case .family: return .home; case .nanny: return .nanny; case .babysitter: return .moon; case .auPair: return .globe } }
    var name: String { switch self { case .family: return "Family"; case .nanny: return "Nanny"; case .babysitter: return "Babysitter"; case .auPair: return "Au pair" } }
    /// Every role wears the brand pink; the icon tells the roles apart.
    var tint: Color { Brand.bunny }
    var soft: Color { Brand.field }
    /// Way B: the soft helper that tells this role apart. Used only on role signs, never on buttons or titles.
    var sign: Color { switch self { case .family: return Brand.helperApricot; case .nanny: return Brand.helperTeal; case .babysitter: return Brand.helperLavender; case .auPair: return Brand.helperSky } }
    var greeting: String {
        switch self {
        case .family: return "Find care. Share the day."
        case .nanny: return "Families who need a nanny"
        case .babysitter: return "Sitting jobs near you"
        case .auPair: return "Host families for you"
        }
    }
    /// Plural word used for the people a user of this role works with.
    var otherPlural: String { switch self { case .family: return "carers"; case .nanny, .babysitter: return "families"; case .auPair: return "host families" } }
}

struct BigButton: View {
    let title: String; var tint: Color = Brand.bunny; var busy = false; var icon: BI? = nil; let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) { if busy { ProgressView().tint(Color(hex: 0x2D2A35)) }; if let icon { BrandIcon(kind: icon, size: 20, color: Color(hex: 0x2D2A35), mono: true) }; Text(title).font(.custom("Atkinson Hyperlegible", size: 18).weight(.semibold)) }
                .frame(maxWidth: .infinity, minHeight: 52).background(tint).foregroundStyle(Color(hex: 0x2D2A35)).clipShape(RoundedRectangle(cornerRadius: 16))
        }.disabled(busy)
    }
}

struct Chip: View {
    let text: String; var on = false; var tint: Color = Brand.bunny; var icon: BI? = nil
    var body: some View {
        HStack(spacing: 6) { if let icon { BrandIcon(kind: icon, size: 16, color: on ? Color(hex: 0x2D2A35) : Brand.ink, mono: on) }; Text(text) }.font(.custom("Atkinson Hyperlegible", size: 16).weight(.medium)).padding(.horizontal, 14).padding(.vertical, 9)
            .background(on ? tint : Brand.card).foregroundStyle(on ? Color(hex: 0x2D2A35) : Brand.ink)
            .overlay(Capsule().stroke(Brand.bunny.opacity(0.7), lineWidth: 1.5)).clipShape(Capsule())
    }
}

struct Card<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View { content.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(Brand.card).clipShape(RoundedRectangle(cornerRadius: 20)).overlay(RoundedRectangle(cornerRadius: 20).stroke(Brand.line, lineWidth: 1)) }
}

/// The in-app logo: the vector master logo-of-record.svg, exported to the asset. Transparent, never boxed.
struct LogoView: View { var size: CGFloat = 120; var body: some View { Image("logo").resizable().scaledToFit().frame(width: size, height: size).accessibilityLabel("Caresitters") } }

/// The wordmark: Fraunces Black in Bunny Pink.
struct Wordmark: View { var size: CGFloat = 40; var body: some View { Text("Caresitters").font(Brand.title(size)).foregroundStyle(Brand.bunny) } }

/// Slide in from the left edge to go back, like a website. Used on every screen that is not the deck.
struct BackSwipe: ViewModifier {
    let action: () -> Void
    func body(content: Content) -> some View {
        content.overlay(alignment: .leading) {
            Color.clear.frame(width: 22).contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 24).onEnded { v in if v.translation.width > 70 && abs(v.translation.height) < 80 { action() } })
        }
    }
}
extension View { func backSwipe(_ action: @escaping () -> Void) -> some View { modifier(BackSwipe(action: action)) } }
