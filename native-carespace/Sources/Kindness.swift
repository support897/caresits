import SwiftUI
import FirebaseFirestore

// MARK: Item 15 — Join the AI kindness revolution.
// The design of record is KINDNESS-DESIGN-PACK.md (read whole at this
// desk before this file was written): ONE design in all seven apps,
// only the skin changes. CareSpace's skin: the bunny of record in her
// celebrate pose, Way B pastel, Fraunces titles, and CareSpace's warm
// line: "Your gift keeps the day stories free for every family."
// Money is NEVER collected in the app (Apple 3.2.2(iv)): the Give
// button opens her giving page in Safari. The rainbow fills with
// PEOPLE, never money. Names stand only where a person chose to put
// theirs; anonymous gifts are colour and a small heart.

enum KindnessLink {
    /// Her Stripe Payment Link giving page for CareSpace. One line,
    /// set once HQ confirms the live link (the pack's route A). Until
    /// it stands, the screen says so plainly instead of opening a
    /// wrong page.
    static let giveURL = ""
}

struct KindnessEntry: Identifiable, Equatable {
    let id: String
    var name: String        // empty = anonymous
    var message: String     // empty = no message
    var monthYear: String
    var app: String         // which app they came from (tiny mark)
}

enum KindnessRepo {
    /// The shared wall lives at the top level: one rainbow for all
    /// seven apps. Reads only — the wall is written by the giving
    /// page's backend when a gift lands, never from inside an app.
    static func loadWall() async -> [KindnessEntry] {
        guard let snap = try? await Backend.db.collection("kindnessWall")
            .order(by: "at", descending: false).limit(to: 500).getDocuments() else { return [] }
        return snap.documents.map { d in
            let m = d.data()
            return KindnessEntry(id: d.documentID,
                                 name: m["name"] as? String ?? "",
                                 message: m["message"] as? String ?? "",
                                 monthYear: m["monthYear"] as? String ?? "",
                                 app: m["app"] as? String ?? "")
        }
    }
}

/// The seven Revolution colours, in the order of record.
enum RainbowColours {
    static let all: [Color] = [
        Color(hex: 0xFF6B6B), Color(hex: 0xFF9F43), Color(hex: 0xFFD93D),
        Color(hex: 0x6BCB77), Color(hex: 0x4D96FF), Color(hex: 0x9B5DE5),
        Color(hex: 0xFF6BAE)
    ]
}

/// The rainbow, drawn. Every gift is one spot, the same size, first
/// gift at the foot of the first arc, filling along the arcs; when
/// the arcs fill, a new outer ring begins. Named spots carry their
/// first name; anonymous spots carry a small heart.
struct RainbowView: View {
    let entries: [KindnessEntry]
    var height: CGFloat = 190
    private let perArc = 14
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let cx = w / 2
            let base = height - 8
            ZStack {
                ForEach(0..<RainbowColours.all.count, id: \.self) { i in
                    let r = (w / 2 - 14) - CGFloat(i) * 15
                    Path { p in
                        p.addArc(center: CGPoint(x: cx, y: base), radius: max(r, 10),
                                 startAngle: .degrees(180), endAngle: .degrees(360), clockwise: false)
                    }
                    .stroke(RainbowColours.all[i], style: StrokeStyle(lineWidth: 11, lineCap: .round))
                }
                ForEach(Array(entries.prefix(perArc * 7).enumerated()), id: \.offset) { idx, e in
                    spot(idx: idx, entry: e, cx: cx, base: base, w: w)
                }
            }
        }
        .frame(height: height)
    }
    @ViewBuilder func spot(idx: Int, entry: KindnessEntry, cx: CGFloat, base: CGFloat, w: CGFloat) -> some View {
        let arc = idx / perArc
        let pos = idx % perArc
        let r = (w / 2 - 14) - CGFloat(arc) * 15
        let frac = perArc == 1 ? 0.5 : Double(pos) / Double(perArc - 1)
        let ang = Double.pi * (1 - frac)
        let x = cx + r * CGFloat(cos(ang))
        let y = base - r * CGFloat(sin(ang))
        ZStack {
            Circle().fill(Color.white.opacity(0.9)).frame(width: 13, height: 13)
            if entry.name.isEmpty {
                CareIcon(name: "care", size: 9, tint: RainbowColours.all[min(arc, 6)], fill: false)
            }
        }
        .position(x: x, y: y)
    }
}

/// One donor message as a little cloud (her words: the messages fly
/// over as clouds, super cute). Only real messages ever fly.
struct CloudView: View {
    let entry: KindnessEntry
    var body: some View {
        VStack(spacing: 1) {
            Text(entry.message).font(Brand.body(13)).foregroundStyle(Brand.ink)
                .lineLimit(2).multilineTextAlignment(.center)
            Text(entry.name.isEmpty ? "A kind human" : entry.name)
                .font(Brand.body(11)).foregroundStyle(Brand.ink.opacity(0.7))
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(
            ZStack {
                Capsule().fill(Color.white)
                Circle().fill(Color.white).frame(width: 26, height: 26).offset(x: -18, y: -12)
                Circle().fill(Color.white).frame(width: 20, height: 20).offset(x: 16, y: -10)
            }
            .shadow(color: Brand.ink.opacity(0.12), radius: 3, y: 2)
        )
        .padding(.top, 12)
    }
}

struct KindnessView: View {
    @EnvironmentObject var th: ThemeStore
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("carespace.bunnyLessMovement") private var lessMovement = false
    @State private var entries: [KindnessEntry] = []
    @State private var loaded = false
    @State private var drift = false
    var messages: [KindnessEntry] { entries.filter { !$0.message.isEmpty } }
    var shownClouds: ArraySlice<KindnessEntry> { messages.suffix(5) }
    var body: some View {
        Screen {
            BunnyView(pose: .celebrate, size: 110).frame(maxWidth: .infinity)
            Text("Join the AI kindness revolution").font(Brand.title(28)).foregroundStyle(th.theme.text)
                .multilineTextAlignment(.center).frame(maxWidth: .infinity)
            BodyText(text: "Your gift keeps the day stories free for every family.", muted: true)
            // The sky band: real messages drift over the rainbow.
            ZStack {
                if !shownClouds.isEmpty {
                    HStack(spacing: 14) {
                        ForEach(Array(shownClouds)) { e in
                            NavigationLink { KindnessWallView(entries: entries, focus: e.id) } label: { CloudView(entry: e) }
                                .buttonStyle(.plain)
                        }
                    }
                    .offset(x: (drift && !reduceMotion && !lessMovement) ? -6 : 6)
                    .animation((reduceMotion || lessMovement) ? nil : .easeInOut(duration: 6).repeatForever(autoreverses: true), value: drift)
                }
            }
            .frame(maxWidth: .infinity)
            NavigationLink { KindnessWallView(entries: entries, focus: nil) } label: {
                RainbowView(entries: entries)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Touch the rainbow to see every name")
            Text(entries.count >= 20 ? "\(entries.count) kind humans in this rainbow" : "Be one of the first in this rainbow")
                .font(Brand.body(15)).foregroundStyle(th.theme.muted)
                .frame(maxWidth: .infinity)
            Text("Touch the rainbow to see every name").font(Brand.body(14)).foregroundStyle(th.theme.muted)
                .frame(maxWidth: .infinity)
            BigButton(title: "Give to keep it free") {
                if let u = URL(string: KindnessLink.giveURL), !KindnessLink.giveURL.isEmpty {
                    openURL(u)
                }
            }
            if KindnessLink.giveURL.isEmpty {
                BodyText(text: "The giving page is being set up. Giving opens here in Safari, never inside the app.", muted: true)
            }
            BodyText(text: "Give only if you want. This app stays free for all.", muted: true)
            if !loaded { BodyText(text: "Loading the rainbow.", muted: true) }
        }
        .navigationTitle("Kindness")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            entries = await KindnessRepo.loadWall()
            loaded = true
            drift = true
        }
    }
}

/// The wall: every name and message, in the order people joined,
/// first joiners first. View only — no money moves here, ever.
struct KindnessWallView: View {
    let entries: [KindnessEntry]
    let focus: String?
    @EnvironmentObject var th: ThemeStore
    var body: some View {
        Screen {
            RainbowView(entries: entries, height: 170)
            Heading(text: "The kindness wall")
            if entries.isEmpty {
                EmptyState(title: "No names yet", detail: "Be the first kind human in this rainbow.")
            }
            ForEach(entries) { e in
                Card {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 8) {
                            if e.name.isEmpty {
                                CareIcon(name: "care", size: 18, tint: Brand.bunny, fill: false)
                                Text("A kind human").font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text)
                            } else {
                                Text(e.name).font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text)
                            }
                            Spacer()
                            Text(e.monthYear).font(Brand.body(14)).foregroundStyle(th.theme.muted)
                        }
                        if !e.message.isEmpty {
                            Text(e.message).font(Brand.body(16)).foregroundStyle(th.theme.text)
                        }
                        if e.id == focus {
                            Text("You came from this cloud.").font(Brand.body(13)).foregroundStyle(Brand.ink)
                        }
                    }
                }
            }
        }
        .navigationTitle("Kindness wall")
        .navigationBarTitleDisplayMode(.inline)
    }
}
