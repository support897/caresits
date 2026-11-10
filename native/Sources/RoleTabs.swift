import SwiftUI

/// Each role gets its own app: different tabs, names, colours and tools.
struct RoleTabs: View {
    @EnvironmentObject var s: Session
    @State private var sel = 0
    func tab(_ title: String, _ k: BI) -> some View { Label { Text(title) } icon: { BrandIcon.image(k) } }
    var body: some View {
        let r = s.role
        TabView(selection: $sel) {
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
        }.tint(r.tint)
        .onChange(of: s.goMyFamily) { _, go in if go { sel = r == .family ? 3 : 4 } }
    }
}

struct Header: View {
    let role: Role; let title: String; var subtitle: String = ""
    var body: some View {
        HStack(spacing: 12) {
            BrandIcon(kind: role.icon, size: 34, color: role.tint)
            VStack(alignment: .leading, spacing: 2) { Text(title).font(Brand.title(26)).foregroundStyle(role.tint); if !subtitle.isEmpty { Text(subtitle).font(.subheadline).foregroundStyle(Brand.muted) } }
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
            else { ZStack { Brand.blush; BrandIcon(kind: fallback, size: size * 0.5, color: Brand.ink) } }
        }.frame(width: fill ? nil : size, height: fill ? nil : size).frame(maxWidth: fill ? .infinity : nil, maxHeight: fill ? .infinity : nil).clipped().clipShape(RoundedRectangle(cornerRadius: round ? size / 2 : 16))
        .task(id: key) { url = await Media.url(for: key) }
    }
}

struct EmptyHint: View {
    let icon: BI; let text: String
    var body: some View { VStack(spacing: 8) { BrandIcon(kind: icon, size: 56, color: Brand.sage); Text(text).foregroundStyle(Brand.muted).multilineTextAlignment(.center) }.padding(40).frame(maxWidth: .infinity) }
}
