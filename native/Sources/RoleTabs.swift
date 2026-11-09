import SwiftUI

/// Each role gets its own app: different tabs, names, colours and tools.
struct RoleTabs: View {
    @EnvironmentObject var s: Session
    var body: some View {
        let r = s.role
        TabView {
            switch r {
            case .family:
                DiscoverView().tabItem { Label("Find care", systemImage: "heart.circle.fill") }
                BookingsCalendarView().tabItem { Label("Calendar", systemImage: "calendar") }
                MessagesView().tabItem { Label("Messages", systemImage: "bubble.left.and.bubble.right.fill") }
                MeView().tabItem { Label("Me", systemImage: "person.crop.circle.fill") }
            case .nanny:
                TodayView().tabItem { Label("Today", systemImage: "sun.max.fill") }
                RequestsView().tabItem { Label("Requests", systemImage: "tray.full.fill") }
                BookingsCalendarView().tabItem { Label("Calendar", systemImage: "calendar") }
                MessagesView().tabItem { Label("Families", systemImage: "bubble.left.and.bubble.right.fill") }
                MeView().tabItem { Label("Me", systemImage: "person.crop.circle.fill") }
            case .babysitter:
                DiscoverView().tabItem { Label("Jobs", systemImage: "moon.stars.fill") }
                RequestsView().tabItem { Label("Requests", systemImage: "tray.full.fill") }
                BookingsCalendarView().tabItem { Label("Calendar", systemImage: "calendar") }
                MessagesView().tabItem { Label("Families", systemImage: "bubble.left.and.bubble.right.fill") }
                MeView().tabItem { Label("Me", systemImage: "person.crop.circle.fill") }
            case .auPair:
                DiscoverView().tabItem { Label("Host families", systemImage: "globe.europe.africa.fill") }
                BookingsCalendarView().tabItem { Label("My week", systemImage: "calendar") }
                RequestsView().tabItem { Label("Requests", systemImage: "tray.full.fill") }
                MessagesView().tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right.fill") }
                MeView().tabItem { Label("Me", systemImage: "person.crop.circle.fill") }
            }
        }.tint(r.tint)
    }
}

struct Header: View {
    let role: Role; let title: String; var subtitle: String = ""
    var body: some View {
        HStack(spacing: 12) {
            Text(role.emoji).font(.system(size: 34))
            VStack(alignment: .leading, spacing: 2) { Text(title).font(Brand.title(26)).foregroundStyle(role.tint); if !subtitle.isEmpty { Text(subtitle).font(.subheadline).foregroundStyle(Brand.muted) } }
            Spacer(); BunnyView(size: 48)
        }.padding(.horizontal, 20).padding(.top, 8)
    }
}

struct PhotoView: View {
    let key: String; var size: CGFloat = 64; var round = true; var fallback = "🐰"; var fill = false
    @State private var url: URL?
    var body: some View {
        Group {
            if let url { if fill { Color.clear.overlay { AsyncImage(url: url) { p in p.resizable().scaledToFill() } placeholder: { ProgressView() } }.clipped() } else { AsyncImage(url: url) { p in p.resizable().scaledToFill() } placeholder: { ProgressView() } } }
            else { ZStack { Brand.blush; Text(fallback).font(.system(size: size * 0.5)) } }
        }.frame(width: fill ? nil : size, height: fill ? nil : size).frame(maxWidth: fill ? .infinity : nil, maxHeight: fill ? .infinity : nil).clipped().clipShape(RoundedRectangle(cornerRadius: round ? size / 2 : 16))
        .task(id: key) { url = await Media.url(for: key) }
    }
}

struct EmptyHint: View {
    let emoji: String; let text: String
    var body: some View { VStack(spacing: 8) { Text(emoji).font(.system(size: 56)); Text(text).foregroundStyle(Brand.muted).multilineTextAlignment(.center) }.padding(40).frame(maxWidth: .infinity) }
}
