import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
}

/// CareSpace brand tokens — identical family to Caresitters (brand of record).
/// Source: BRAND-OF-RECORD.md. These hex values are the brand; do not drift them.
enum Brand {
    static let ink = Color(hex: 0x1E4D44)
    static let cream = Color(hex: 0xFDF8F0)
    static let sage = Color(hex: 0x9CC5B5)
    static let blush = Color(hex: 0xF6CBD3)
    static let bunny = Color(hex: 0xF4A9BC)
    static func title(_ size: CGFloat) -> Font { .custom("Newsreader", size: size).weight(.semibold) }
    static func body(_ size: CGFloat = 17) -> Font { .custom("Atkinson Hyperlegible", size: size) }
}

/// THEME LAW (Ilse, 11 Nov): every app offers light, dark, beige and a brand
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
        case .dark: return Color(hex: 0x14201D)
        case .beige: return Color(hex: 0xF3EAD9)
        case .brand: return Brand.cream
        }
    }
    var surface: Color {
        switch self {
        case .light: return Color(hex: 0xF7F4EE)
        case .dark: return Color(hex: 0x1E2B27)
        case .beige: return Color(hex: 0xEFE3CC)
        case .brand: return .white
        }
    }
    var text: Color {
        switch self {
        case .light, .beige, .brand: return Brand.ink
        case .dark: return Color(hex: 0xF2EFE9)
        }
    }
    var muted: Color {
        switch self {
        case .dark: return Color(hex: 0xA9B8B2)
        default: return Color(hex: 0x5B6B66)
        }
    }
    var accent: Color {
        switch self {
        case .brand: return Brand.bunny
        default: return Brand.ink
        }
    }
    var field: Color {
        switch self {
        case .dark: return Color(hex: 0x26332E)
        default: return Color(hex: 0xF1EDE4)
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
    var tint: Color = Brand.ink
    var busy = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack { if busy { ProgressView().tint(.white) }; Text(title).font(.system(size: 18, weight: .semibold)) }
                .frame(maxWidth: .infinity, minHeight: 54)
                .background(tint).foregroundStyle(.white)
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
