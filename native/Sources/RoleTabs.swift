import SwiftUI

/// Each role gets its own app: different tabs, names, colours and tools.
struct RoleTabs: View {
    @EnvironmentObject var s: Session
    func tab(_ title: String, _ k: BI) -> some View { Label { Text(title) } icon: { BrandIcon.image(k) } }
    var body: some View {
        let r = s.role
        TabView(selection: $s.tab) {
            switch r {
            case .family:
                DiscoverView().tabItem { tab("Find care", .findCare) }.tag(0)
                BookingsCalendarView().tabItem { tab("Calendar", .calendar) }.tag(1)
                MessagesView().tabItem { tab("Messages", .chat) }.tag(2)
                MeView().tabItem { tab("Me", .person) }.tag(3)
            case .nanny:
                DiscoverView().tabItem { tab("Families", .nanny) }.tag(0)
                RequestsView().tabItem { tab("Requests", .tray) }.tag(1)
                BookingsCalendarView().tabItem { tab("Calendar", .calendar) }.tag(2)
                MessagesView().tabItem { tab("Chat", .chat) }.tag(3)
                MeView().tabItem { tab("Me", .person) }.tag(4)
            case .babysitter:
                DiscoverView().tabItem { tab("Jobs", .moon) }.tag(0)
                RequestsView().tabItem { tab("Requests", .tray) }.tag(1)
                BookingsCalendarView().tabItem { tab("Calendar", .calendar) }.tag(2)
                MessagesView().tabItem { tab("Families", .chat) }.tag(3)
                MeView().tabItem { tab("Me", .person) }.tag(4)
            case .auPair:
                DiscoverView().tabItem { tab("Host families", .globe) }.tag(0)
                BookingsCalendarView().tabItem { tab("My week", .calendar) }.tag(1)
                RequestsView().tabItem { tab("Requests", .tray) }.tag(2)
                MessagesView().tabItem { tab("Chat", .chat) }.tag(3)
                MeView().tabItem { tab("Me", .person) }.tag(4)
            }
        }.tint(Brand.bunny)
        .onChange(of: s.goMyFamily) { _, go in if go { s.tab = r == .family ? 3 : 4 } }
    }
}

struct Header: View {
    let role: Role; let title: String; var subtitle: String = ""
    var body: some View {
        HStack(spacing: 12) {
            BrandIcon(kind: role.icon, size: 22, color: Color(hex: 0x2D2A35), mono: true).frame(width: 42, height: 42).background(role.sign).clipShape(Circle()).accessibilityLabel(role.name)
            VStack(alignment: .leading, spacing: 2) { Text(title).font(Brand.title(26)).foregroundStyle(Brand.titleColor); if !subtitle.isEmpty { Text(subtitle).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)).foregroundStyle(Brand.muted) } }
            Spacer(); BunnyView(size: 36)
        }.padding(.horizontal, 20).padding(.top, 8)
    }
}

struct PhotoView: View {
    let key: String; var size: CGFloat = 64; var round = true; var fallback: BI = .bunny; var fill = false
    @State private var url: URL?
    var body: some View {
        Group {
            if let url { if fill { Color.clear.overlay { AsyncImage(url: url) { p in p.resizable().scaledToFill() } placeholder: { ProgressView() } }.clipped() } else { AsyncImage(url: url) { p in p.resizable().scaledToFill() } placeholder: { ProgressView() } } }
            else {
                // The placeholder of record (item 7): a designed medallion, never a bare icon on a flat fill.
                // Blush Pink into Pale Pink Ground, a thin Bunny Pink ring (photo size and up), the role's own
                // icon in Bunny Pink at the middle. Warm, clearly a placeholder, never a fake photo.
                ZStack {
                    LinearGradient(colors: [Brand.blush, Brand.paleGround], startPoint: .top, endPoint: .bottom)
                    if size >= 64 { Circle().stroke(Brand.bunny, lineWidth: 1.5).frame(width: size * 0.62, height: size * 0.62) }
                    BrandIcon(kind: fallback, size: size * 0.42, color: Brand.bunny)
                }
            }
        }.frame(width: fill ? nil : size, height: fill ? nil : size).frame(maxWidth: fill ? .infinity : nil, maxHeight: fill ? .infinity : nil).clipped().clipShape(RoundedRectangle(cornerRadius: round ? size / 2 : 16))
        .task(id: key) { url = await Media.url(for: key) }
    }
}

struct EmptyHint: View {
    let icon: BI; let text: String
    var body: some View { VStack(spacing: 8) { BrandIcon(kind: icon, size: 56, color: Brand.blush); Text(text).foregroundStyle(Brand.muted).multilineTextAlignment(.center) }.padding(40).frame(maxWidth: .infinity) }
}
