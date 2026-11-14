import SwiftUI

// ITEM 11 — Join the AI kindness revolution (design pack of record, 13 Nov 2026).
// The in app screen carries the story, the rainbow, the clouds, the wall (view only) and one
// button. The money itself is always collected on the giving page in Safari, never in the app
// (the pack's Apple shape, guideline 3.2.2(iv)): the amount cards, the pay ways and the name
// choice live on that page. No donor, name or amount is ever invented here: the rainbow and
// the wall read the kindness feed the website publishes, and until it does they stand at
// their honest first lines.

struct KindDonor: Identifiable, Decodable {
    let id: Int
    let name: String?
    let message: String?
    let monthYear: String
}

@MainActor final class KindnessStore: ObservableObject {
    @Published var donors: [KindDonor] = []
    @Published var loaded = false
    static let feedURL = URL(string: "https://ilseplacencia.shop/kindness/wall.json")
    static let giveURL = URL(string: "https://ilseplacencia.shop/kindness")!
    func load() async {
        guard !loaded else { return }
        loaded = true
        guard let url = Self.feedURL, let (data, resp) = try? await URLSession.shared.data(from: url),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let feed = try? JSONDecoder().decode([KindDonor].self, from: data) else { return }
        donors = feed
    }
}

/// The rainbow of record: seven Revolution arcs, filling with people, never money. Every gift
/// takes one spot, all spots the same size. Named donors newest few show their first name on
/// the arc; anonymous spots carry colour and a heart. A full rainbow starts a new outer ring.
struct RainbowView: View {
    let donors: [KindDonor]
    static let colours: [UInt32] = [0xFF6B6B, 0xFF9F43, 0xFFD93D, 0x6BCB77, 0x4D96FF, 0x9B5DE5, 0xFF6BAE]
    var body: some View {
        ZStack {
            ForEach(0..<7, id: \.self) { i in
                Circle().trim(from: 0.5, to: 1.0).stroke(Color(hex: Self.colours[i]), style: StrokeStyle(lineWidth: 13, lineCap: .round))
                    .frame(width: 300 - CGFloat(i) * 30, height: 300 - CGFloat(i) * 30)
            }
            ForEach(Array(donors.enumerated()), id: \.offset) { (i, d) in spot(i, d) }
        }.frame(width: 330, height: 330).frame(height: 172, alignment: .top).clipped()
    }
    func spot(_ i: Int, _ d: KindDonor) -> some View {
        // Outer rings: arc radius step 15, ring step 115, 12 spots an arc.
        let arc = (i / 12) % 7, ring = i / 84
        let r = 143 - CGFloat(arc) * 15 + CGFloat(ring) * 115
        let f = (CGFloat(i % 12) + 0.5) / 12
        let a = Double.pi * (1 - Double(f))
        let x = 165 + r * CGFloat(cos(a)), y = 165 - r * CGFloat(sin(a))
        let colour = Color(hex: Self.colours[arc])
        let showName = d.name != nil && i >= donors.count - 8
        return Group {
            if showName, let n = d.name {
                Text(n).font(.custom("Atkinson Hyperlegible", size: 9, relativeTo: .caption2).weight(.bold)).foregroundStyle(Color(hex: 0x2D2A35))
                    .padding(.horizontal, 4).padding(.vertical, 1).background(colour).clipShape(Capsule())
                    .overlay(Capsule().stroke(Color.white, lineWidth: 1))
            } else if d.name == nil {
                BrandIcon(kind: .heart, size: 8, color: .white, mono: true).frame(width: 15, height: 15).background(colour).clipShape(Circle()).overlay(Circle().stroke(Color.white, lineWidth: 1))
            } else {
                Circle().fill(colour).frame(width: 11, height: 11).overlay(Circle().stroke(Color.white, lineWidth: 1.5))
            }
        }.position(x: x, y: y)
    }
}

/// One donor message as a little cloud: the message, and under it the first name, or A kind human.
struct KindCloud: View {
    let donor: KindDonor
    var body: some View {
        ZStack {
            HStack(spacing: -8) {
                Circle().frame(width: 30, height: 30)
                Circle().frame(width: 42, height: 42).offset(y: -6)
                Circle().frame(width: 30, height: 30)
            }.foregroundStyle(Color.white)
            RoundedRectangle(cornerRadius: 16).fill(Color.white).frame(height: 30).offset(y: 8)
            VStack(spacing: 1) {
                Text(donor.message ?? "").font(.custom("Atkinson Hyperlegible", size: 12, relativeTo: .caption)).foregroundStyle(Brand.ink).lineLimit(2)
                Text(donor.name ?? "A kind human").font(.custom("Atkinson Hyperlegible", size: 10, relativeTo: .caption2)).foregroundStyle(Brand.muted)
            }.padding(.horizontal, 14).frame(maxWidth: 190)
        }.shadow(color: Color.black.opacity(0.08), radius: 4, y: 2)
    }
}

/// The sky band over the rainbow: at most five clouds drift at a walking pace, newest first.
/// With reduced motion they sit still in a soft row. A tap opens the wall at that card.
struct CloudBand: View {
    let donors: [KindDonor]
    var onTap: (KindDonor) -> Void
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    @State private var drift = false
    var clouds: [KindDonor] { Array(donors.filter { !($0.message ?? "").isEmpty }.reversed().prefix(5)) }
    var body: some View {
        Group {
            if clouds.isEmpty { Color.clear.frame(height: 4) }
            else if reduceMotion {
                ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 12) { ForEach(clouds) { d in Button { onTap(d) } label: { KindCloud(donor: d) }.buttonStyle(.plain) } }.padding(.vertical, 6) }.frame(height: 84)
            } else {
                GeometryReader { geo in
                    ZStack {
                        ForEach(Array(clouds.enumerated()), id: \.offset) { (i, d) in
                            Button { onTap(d) } label: { KindCloud(donor: d) }.buttonStyle(.plain)
                                .offset(x: drift ? geo.size.width + 30 : -230, y: CGFloat(i % 3) * 26)
                                .animation(.linear(duration: 46 + Double(i) * 11).repeatForever(autoreverses: false).delay(Double(i) * 13), value: drift)
                        }
                    }
                }.frame(height: 96).clipped().onAppear { drift = true }
            }
        }
    }
}

/// The wall: every name in the order people joined, first joiners first. No amounts, ever.
struct KindWallView: View {
    let donors: [KindDonor]
    var highlight: Int? = nil
    @Environment(\.dismiss) var dismiss
    var body: some View {
        ScrollViewReader { proxy in
            ScrollView { VStack(spacing: 12) {
                RainbowView(donors: donors).padding(.top, 6)
                if donors.isEmpty {
                    Text("Be one of the first in this rainbow.").font(.custom("Atkinson Hyperlegible", size: 16, relativeTo: .body)).foregroundStyle(Brand.muted).padding(.top, 10)
                }
                ForEach(donors) { d in
                    Card {
                        HStack(alignment: .top, spacing: 10) {
                            BunnyView(size: 26, mood: .hello)
                            VStack(alignment: .leading, spacing: 3) {
                                HStack(spacing: 6) {
                                    Text(d.name ?? "A kind human").font(.custom("Atkinson Hyperlegible", size: 16, relativeTo: .body).weight(.semibold))
                                    if d.name == nil { BrandIcon(kind: .heart, size: 14, color: Brand.bunny, mono: true) }
                                }
                                if let m = d.message, !m.isEmpty { Text(m).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .body)).foregroundStyle(Brand.ink) }
                                Text(d.monthYear).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
                            }
                            Spacer()
                        }
                    }.id(d.id)
                        .overlay(RoundedRectangle(cornerRadius: 20).stroke(d.id == highlight ? Brand.bunny : Color.clear, lineWidth: 2))
                }
            }.padding(.horizontal, 20).padding(.bottom, 24) }
                .onAppear { if let h = highlight { withAnimation { proxy.scrollTo(h, anchor: .center) } } }
        }
        .background(Brand.cream.ignoresSafeArea())
        .navigationTitle("The kindness wall")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
    }
}

struct KindnessView: View {
    @StateObject private var store = KindnessStore()
    @State private var showWall = false
    @State private var wallHighlight: Int? = nil
    @Environment(\.openURL) var openURL
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            BunnyView(size: 104, mood: .celebrate).padding(.top, 6)
            Text("Join the AI kindness revolution").font(Brand.title(29)).foregroundStyle(Brand.titleColor).multilineTextAlignment(.center)
            Text("Your gift keeps matching free for families and carers.").font(.custom("Atkinson Hyperlegible", size: 16, relativeTo: .body)).foregroundStyle(Brand.muted).multilineTextAlignment(.center)
            CloudBand(donors: store.donors) { d in wallHighlight = d.id; showWall = true }
            Button { wallHighlight = nil; showWall = true } label: { RainbowView(donors: store.donors) }.buttonStyle(.plain).accessibilityIdentifier("kindnessRainbow")
            Text("Touch the rainbow to see every name.").font(.custom("Atkinson Hyperlegible", size: 14, relativeTo: .subheadline)).foregroundStyle(Brand.muted)
            Text(store.donors.count >= 20 ? "\(store.donors.count) kind humans in this rainbow" : "Be one of the first in this rainbow")
                .font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .body).weight(.semibold)).foregroundStyle(Brand.ink)
            BigButton("Give to keep it free", icon: .gift) { openURL(KindnessStore.giveURL) }.padding(.top, 4)
            Text("Give only if you want. This app stays free for all.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
        }.padding(.horizontal, 20).padding(.bottom, 24) }
            .background(Brand.cream.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showWall) { NavigationStack { KindWallView(donors: store.donors, highlight: wallHighlight) } }
            .task { await store.load() }
    }
}
