import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
}
enum Brand {
    static let ink = Color(hex: 0x1E4D44)
    static let cream = Color.white
    static let field = Color(hex: 0xF3F6F4)
    static let sage = Color(hex: 0x9CC5B5)
    static let blush = Color(hex: 0xF6CBD3)
    static let bunny = Color(hex: 0xF4A9BC)
    static let muted = Color(hex: 0x5B6B66)
    static func title(_ size: CGFloat) -> Font { .system(size: size, weight: .bold, design: .serif) }
    static let body = Font.system(size: 17, design: .default)
}

/// The four different apps inside one app. Everything role specific hangs off this.
enum Role: String, CaseIterable, Identifiable {
    case family, nanny, babysitter, auPair
    var id: String { rawValue }
    var service: String? { switch self { case .family: return nil; case .nanny: return "nanny"; case .babysitter: return "babysitter"; case .auPair: return "au_pair" } }
    var emoji: String { switch self { case .family: return "🏡"; case .nanny: return "🧸"; case .babysitter: return "🌙"; case .auPair: return "🌍" } }
    var name: String { switch self { case .family: return "Family"; case .nanny: return "Nanny"; case .babysitter: return "Babysitter"; case .auPair: return "Au pair" } }
    var tint: Color { switch self { case .family: return Brand.ink; case .nanny: return Color(hex: 0x2E7D6B); case .babysitter: return Color(hex: 0x5B4B9A); case .auPair: return Color(hex: 0xC2557A) } }
    var soft: Color { switch self { case .family: return Brand.sage.opacity(0.35); case .nanny: return Color(hex: 0xD6EDE5); case .babysitter: return Color(hex: 0xE3DDF5); case .auPair: return Color(hex: 0xFBDDE8) } }
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

struct BunnyView: View {
    var size: CGFloat = 96
    @State private var up = false
    var body: some View {
        Image("bunny").resizable().scaledToFit().frame(width: size, height: size)
            .offset(y: up ? -4 : 2).rotationEffect(.degrees(up ? 2 : -2))
            .animation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true), value: up)
            .onAppear { up = true }.accessibilityHidden(true)
    }
}

struct BigButton: View {
    let title: String; var tint: Color = Brand.ink; var busy = false; let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack { if busy { ProgressView().tint(.white) }; Text(title).font(.system(size: 18, weight: .semibold)) }
                .frame(maxWidth: .infinity, minHeight: 52).background(tint).foregroundStyle(.white).clipShape(RoundedRectangle(cornerRadius: 16))
        }.disabled(busy)
    }
}

struct Chip: View {
    let text: String; var on = false; var tint: Color = Brand.ink
    var body: some View {
        Text(text).font(.system(size: 16, weight: .medium)).padding(.horizontal, 14).padding(.vertical, 9)
            .background(on ? tint : Color.white).foregroundStyle(on ? .white : Brand.ink)
            .overlay(Capsule().stroke(tint.opacity(0.35), lineWidth: 1.5)).clipShape(Capsule())
    }
}

struct Card<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View { content.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(Color.white).clipShape(RoundedRectangle(cornerRadius: 20)).shadow(color: .black.opacity(0.06), radius: 8, y: 3) }
}

struct LogoView: View { var size: CGFloat = 120; var body: some View { Image("logo").resizable().scaledToFit().frame(width: size, height: size).accessibilityLabel("Caresitters") } }
