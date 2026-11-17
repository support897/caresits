import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
}

/// CareSpace tokens follow the cured HTML (md5 75a4823c) and fences.
/// Ink carries reading text. Sky and Sun are helper colours only.
/// HQ ruling: functional body text has a 17 pt minimum.
enum Brand {
    static let ink = Color(hex: 0x2D2A35)
    static let cream = Color(hex: 0xFDF8F0)
    static let palePink = Color(hex: 0xFBEFF2)
    /// Helper colours are a BIT of blue and yellow shades only — her words,
    /// 13 Nov phone test ("Pastel colors we said, PINK, and shades of blue
    /// and yellow but a bit only"). The green sage is out of the palette.
    static let sky = Color(hex: 0xB9D6EC)
    static let sun = Color(hex: 0xF6D67C)
    static let blush = Color(hex: 0xF6CBD3)
    static let bunnyBlush = Color(hex: 0xF2C4CE)
    static let bunny = Color(hex: 0xF4A9BC)
    static func title(_ size: CGFloat) -> Font { .custom("Fraunces", size: size).weight(.semibold) }
    static func body(_ size: CGFloat = 17) -> Font { .custom("Atkinson Hyperlegible", size: max(17, size)) }
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
        // "dark is black, not green" — her words, 13 Nov phone test.
        // The old pale "night porcelain" greens are dead.
        case .dark: return .black
        case .beige: return Color(hex: 0xF6EEDD)
        case .brand: return Brand.palePink
        }
    }
    var surface: Color {
        switch self {
        case .light: return Brand.cream
        case .dark: return Color(hex: 0x1D1A1C)
        case .beige: return Color(hex: 0xF0E4D3)
        case .brand: return .white
        }
    }
    var text: Color {
        switch self {
        case .dark: return Brand.cream
        default: return Brand.ink
        }
    }
    var muted: Color {
        switch self {
        case .dark: return Color(hex: 0xB9A7AF)
        default: return Color(hex: 0x9C7A86)
        }
    }
    var accent: Color { Brand.bunny }
    var field: Color {
        switch self {
        case .dark: return Color(hex: 0x2B272A)
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
