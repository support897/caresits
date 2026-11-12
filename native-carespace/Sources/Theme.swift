import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
}

/// CareSpace brand tokens — the Caresitters brand, whole match (Way B,
/// locked 12 Nov): pastel colours, pink is the queen (about 80 pink,
/// 20 soft helpers for fast signs and telling roles apart), NO dark
/// green ever. Source: the Caresitters BRAND-OF-RECORD.md.
/// `ink` is the pink family's reading shade: the brand record's own
/// rule says a colour that must do a reading job uses the nearest
/// family shade that still reads clearly — a deep rose, never green.
enum Brand {
    static let ink = Color(hex: 0x8A4258)
    static let cream = Color(hex: 0xFDF8F0)
    static let palePink = Color(hex: 0xFBEFF2)
    static let sage = Color(hex: 0xBFD8C0)
    static let blush = Color(hex: 0xF6CBD3)
    static let bunnyBlush = Color(hex: 0xF2C4CE)
    static let bunny = Color(hex: 0xF4A9BC)
    static func title(_ size: CGFloat) -> Font { .custom("Fraunces", size: size).weight(.semibold) }
    static func body(_ size: CGFloat = 17) -> Font { .custom("Atkinson Hyperlegible", size: size) }
}

/// THEME LAW (standing): every app offers light, dark, beige and a brand
/// colour theme. White (light) is the default. The pick survives restore —
/// it is saved on the user's profile as well as on the device.
enum AppTheme: String, CaseIterable, Identifiable {
    case light, dark, beige, brand
    var id: String { rawValue }
    var label: String {
        switch self {
        case .light: return "Light"
        case .dark: return "Dark"
        case .beige: return "Beige"
        case .brand: return "CareSpace"
        }
    }
    var bg: Color {
        switch self {
        case .light: return .white
        case .dark: return Color(hex: 0xDDE8DE)
        case .beige: return Color(hex: 0xF6EEDD)
        case .brand: return Brand.palePink
        }
    }
    var surface: Color {
        switch self {
        case .light: return Brand.cream
        case .dark: return Color(hex: 0xE6EEE6)
        case .beige: return Color(hex: 0xF0E4D3)
        case .brand: return .white
        }
    }
    var text: Color { Brand.ink }
    var muted: Color {
        switch self {
        case .dark: return Color(hex: 0xA9B8B1)
        default: return Color(hex: 0x9C7A86)
        }
    }
    var accent: Color { Brand.bunny }
    var field: Color {
        switch self {
        case .dark: return Color(hex: 0xC9D8CC)
        case .brand: return Color(hex: 0xF6E3E9)
        default: return Color(hex: 0xF6E9EC)
        }
    }
}

final class ThemeStore: ObservableObject {
    @Published var theme: AppTheme {
        didSet { UserDefaults.standard.set(theme.rawValue, forKey: "carespace.theme") }
    }
    init() {
        theme = AppTheme(rawValue: UserDefaults.standard.string(forKey: "carespace.theme") ?? "") ?? .light
    }
}

struct BigButton: View {
    let title: String
    var tint: Color = Brand.bunny
    var busy = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack { if busy { ProgressView().tint(Brand.ink) }; Text(title).font(.system(size: 18, weight: .semibold)) }
                .frame(maxWidth: .infinity, minHeight: 54)
                .background(tint).foregroundStyle(Brand.ink)
                .clipShape(RoundedRectangle(cornerRadius: 16))
        }.disabled(busy)
    }
}

struct Card<Content: View>: View {
    @EnvironmentObject var themeStore: ThemeStore
    @ViewBuilder var content: Content
    var body: some View {
        content.padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(themeStore.theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .shadow(color: .black.opacity(0.05), radius: 8, y: 3)
    }
}
