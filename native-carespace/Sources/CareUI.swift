import SwiftUI

// MARK: Shared pieces for the care-day screens. Themed, drawn icons only, no sheets.

struct Screen<Content: View>: View {
    @EnvironmentObject var th: ThemeStore
    var spacing: CGFloat = 16
    @ViewBuilder var content: Content
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: spacing) { content }
                .padding(.horizontal, 20).padding(.vertical, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(th.theme.bg.ignoresSafeArea())
    }
}

struct Heading: View {
    @EnvironmentObject var th: ThemeStore
    let text: String
    var body: some View { Text(text).font(Brand.title(24)).foregroundStyle(th.theme.text).accessibilityAddTraits(.isHeader) }
}

struct BodyText: View {
    @EnvironmentObject var th: ThemeStore
    let text: String
    var muted = false
    var body: some View { Text(text).font(Brand.body()).foregroundStyle(muted ? th.theme.muted : th.theme.text).fixedSize(horizontal: false, vertical: true) }
}

struct CareField: View {
    @EnvironmentObject var th: ThemeStore
    let title: String
    @Binding var text: String
    var lines = 1
    var keyboard: UIKeyboardType = .default
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(Brand.body(15)).foregroundStyle(th.theme.muted)
            Group {
                if lines > 1 { TextField("", text: $text, axis: .vertical).lineLimit(lines...(lines + 4)) }
                else { TextField("", text: $text).keyboardType(keyboard) }
            }
            .font(Brand.body()).foregroundStyle(th.theme.text)
            .padding(14).frame(minHeight: 50, alignment: .topLeading)
            .background(th.theme.field).clipShape(RoundedRectangle(cornerRadius: 14))
        }
    }
}

struct Pill: View {
    @EnvironmentObject var th: ThemeStore
    let title: String
    var icon: String? = nil
    var on: Bool
    var body: some View {
        HStack(spacing: 6) {
            if let i = icon { CareIcon(name: i, size: 18, tint: on ? .white : th.theme.text, fill: false) }
            Text(title).font(Brand.body(16))
        }
        .padding(.horizontal, 14).frame(minHeight: 44)
        .background(on ? Brand.ink : th.theme.field)
        .foregroundStyle(on ? Color.white : th.theme.text)
        .clipShape(Capsule())
    }
}

struct Notice: View {
    @EnvironmentObject var th: ThemeStore
    let text: String
    var warn = false
    var body: some View {
        Text(text).font(Brand.body()).foregroundStyle(Brand.ink)
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(warn ? Brand.blush : Brand.sage.opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .accessibilityAddTraits(.updatesFrequently)
    }
}

struct RowLink<Dest: View>: View {
    @EnvironmentObject var th: ThemeStore
    let icon: String
    let title: String
    var subtitle = ""
    @ViewBuilder var dest: Dest
    var body: some View {
        NavigationLink { dest } label: {
            Card {
                HStack(spacing: 14) {
                    CareIcon(name: icon, size: 28)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title).font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text)
                        if !subtitle.isEmpty { Text(subtitle).font(Brand.body(15)).foregroundStyle(th.theme.muted).multilineTextAlignment(.leading) }
                    }
                    Spacer()
                    CareIcon(name: "chevron.right", size: 18, tint: th.theme.muted, fill: false)
                }
            }
        }.buttonStyle(.plain)
    }
}

struct EmptyState: View {
    @EnvironmentObject var th: ThemeStore
    let title: String
    var detail = ""
    var body: some View {
        VStack(spacing: 10) {
            BunnyView(size: 90)
            Text(title).font(Brand.title(22)).foregroundStyle(th.theme.text).multilineTextAlignment(.center)
            if !detail.isEmpty { Text(detail).font(Brand.body()).foregroundStyle(th.theme.muted).multilineTextAlignment(.center) }
        }.frame(maxWidth: .infinity).padding(.vertical, 24)
    }
}

enum SaveText {
    static func result(_ synced: Bool) -> String { synced ? "Saved." : "Saved on this phone. It will sync when you are back online." }
    static let medicalUnconfirmed = "Could not confirm the save yet. It is kept on this phone and will send when you are back online. Check it again before you rely on it."
}

extension Date {
    var shortDay: String { formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)) }
}
