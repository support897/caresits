import SwiftUI

/// Tinder style deck. One person fills the screen. Tap the left or right side of the photo for the next photo,
/// swipe right to heart, swipe left to pass. Scroll down for every photo, why you match, and the rest.
/// Built from the live card (RdLiveCard) and the mockup deck (RdDeck), same colours, same buttons.
struct RdTinderDeck: View {
    @EnvironmentObject var st: RdStore
    @State private var people: [RdLivePerson] = []
    @State private var loaded = false
    @State private var i = 0
    @State private var dx: CGFloat = 0

    var body: some View {
        ZStack(alignment: .top) {
            Color.white.ignoresSafeArea()
            if i < people.count {
                RdTinderCard(x: people[i], onPass: { next(false) }, onLike: { next(true) })
                    .id(people[i].id)
                    .offset(x: dx).rotationEffect(.degrees(Double(dx) / 30))
                    .simultaneousGesture(DragGesture(minimumDistance: 30)
                        .onChanged { v in if abs(v.translation.width) > abs(v.translation.height) * 1.5 { dx = v.translation.width } }
                        .onEnded { v in
                            let horizontal = abs(v.translation.width) > abs(v.translation.height) * 1.5
                            if horizontal && v.translation.width > 110 { next(true) }
                            else if horizontal && v.translation.width < -110 { next(false) }
                            else { withAnimation(.easeOut(duration: 0.2)) { dx = 0 } }
                        })
            } else {
                VStack(spacing: 14) {
                    Spacer()
                    if loaded {
                        Text(people.isEmpty ? "Nobody inside " + String(st.radius) + " km yet. New people show here as they join." : "That is everyone for now.")
                            .font(RdF.body(16)).foregroundColor(RdC.mut).multilineTextAlignment(.center).padding(.horizontal, 30)
                        if !people.isEmpty { RdCta(title: "See them again") { withAnimation { i = 0 } }.padding(.horizontal, 40) }
                    } else {
                        Text("Looking near " + st.postcode).font(RdF.bold(14)).foregroundColor(RdC.mut)
                    }
                    Spacer()
                }
            }
            RdTopBar(on: "deck").padding(.top, 2)
        }
        .task { await load() }
    }

    func load() async {
        people = await RdLive.people(st)
        loaded = true
    }

    func next(_ like: Bool) {
        let who = people[i].p.id
        if like { Task { if !RdHeartStore.shared.mine.contains(who) { await RdHeartStore.shared.toggle(who) } } }
        withAnimation(.easeIn(duration: 0.18)) { dx = like ? 500 : -500 }
        Task {
            try? await Task.sleep(nanoseconds: 190_000_000)
            dx = 0
            i += 1
        }
    }
}

struct RdTinderCard: View {
    @EnvironmentObject var st: RdStore
    var x: RdLivePerson
    var onPass: () -> Void
    var onLike: () -> Void
    @State private var pi = 0

    var body: some View {
        let p = x.p
        let keys = ([p.photoKey] + p.gallery).filter { !$0.isEmpty }
        let isAu = p.services.contains("au_pair")
        let dests = RdLive.dests(p)
        GeometryReader { g in
            ZStack(alignment: .bottom) {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        // Screen one: the big photo with the short card.
                        ZStack(alignment: .bottom) {
                            Group {
                                if keys.isEmpty { RdC.blush } else { RdRemotePhoto(key: keys[min(pi, keys.count - 1)]) }
                            }.frame(width: g.size.width, height: g.size.height).clipped()
                            HStack(spacing: 0) {
                                Color.clear.contentShape(Rectangle()).onTapGesture { if pi > 0 { pi -= 1 } }
                                Color.clear.contentShape(Rectangle()).onTapGesture { if pi < keys.count - 1 { pi += 1 } }
                            }
                            LinearGradient(colors: [Color.clear, Color.black.opacity(0.35)], startPoint: .center, endPoint: .bottom).allowsHitTesting(false)
                            VStack(spacing: 0) {
                                if keys.count > 1 {
                                    HStack(spacing: 4) { ForEach(0..<keys.count, id: \.self) { n in Capsule().fill(n == pi ? Color.white : Color.white.opacity(0.5)).frame(height: 3) } }
                                        .padding(.horizontal, 16).padding(.top, 6)
                                }
                                Spacer()
                            }.allowsHitTesting(false)
                            VStack(alignment: .leading, spacing: 8) {
                                HStack(spacing: 12) {
                                    RdRing(pct: x.score, size: 70, line: 8)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(x.label).font(RdF.bold(12)).foregroundColor(.white).padding(.horizontal, 12).padding(.vertical, 3).background(RdC.ras).clipShape(Capsule())
                                        Text(p.name).font(RdF.title(26)).foregroundColor(RdC.ink).lineLimit(1).minimumScaleFactor(0.7)
                                    }
                                    Spacer(minLength: 0)
                                }
                                if isAu && x.rank == 0 { RdPlaceRibbon(text: "From " + RdLive.fromOf(p) + ". " + st.country + " is the first choice", icon: "globe") }
                                else if isAu && !dests.isEmpty { RdPlaceRibbon(text: "From " + RdLive.fromOf(p) + ". Picked " + dests.joined(separator: ", "), icon: "globe") }
                                else { RdPlaceRibbon(text: "Postcode " + p.postcode + (x.km >= 0 ? ", " + Geo.label(x.km) + " away" : "")) }
                                HStack(spacing: 6) {
                                    if p.side == "family" { RdPill(role: "family") } else { RdPill(role: isAu ? "aupair" : (p.services.first ?? "nanny")) }
                                    Spacer(minLength: 0)
                                    HStack(spacing: 4) { Text("Scroll for more").font(RdF.bold(12)).foregroundColor(RdC.mut); RdIcon(name: "chevron", size: 14).rotationEffect(.degrees(90)) }
                                }
                            }
                            .padding(14).background(Color.white.opacity(0.94)).clipShape(RoundedRectangle(cornerRadius: 28))
                            .padding(.horizontal, 12).padding(.bottom, 88)
                            .onTapGesture { st.viewing = x; st.go("person") }
                        }.frame(height: g.size.height)

                        // Below the fold: why you match, about, every photo.
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Why you match").font(RdF.title(22)).foregroundColor(RdC.ink)
                            if x.why.isEmpty { RdMuted(text: "Complete your profile to see more reasons.") }
                            ForEach(Array(x.why.enumerated()), id: \.offset) { _, w in RdReason(text: w) }
                            if !p.headline.isEmpty { Text(p.headline).font(RdF.bold(17)).foregroundColor(RdC.ink).padding(.top, 6) }
                            if !p.about.isEmpty { Text(p.about).font(RdF.body(15)).foregroundColor(RdC.ink).fixedSize(horizontal: false, vertical: true) }
                            RdFlow(spacing: 6) { ForEach(p.services, id: \.self) { RdChip(text: $0.replacingOccurrences(of: "_", with: " ").capitalized) } }
                            if keys.count > 1 {
                                Text("Photos").font(RdF.title(22)).foregroundColor(RdC.ink).padding(.top, 6)
                                ForEach(Array(keys.enumerated()), id: \.offset) { _, k in
                                    RdRemotePhoto(key: k).frame(maxWidth: .infinity).frame(height: 360).clipShape(RoundedRectangle(cornerRadius: 24))
                                }
                            }
                            RdCta(title: "See full profile") { st.viewing = x; st.go("person") }.padding(.top, 6)
                        }.padding(.horizontal, 16).padding(.vertical, 18).padding(.bottom, 90).frame(maxWidth: .infinity, alignment: .leading).background(Color.white)
                    }
                }
                // The four buttons stay on screen while you scroll.
                HStack(spacing: 10) {
                    RdIconButton(icon: "x", size: 52) { onPass() }
                    RdCta(title: st.isFamily ? "Book " + p.firstName : "Say yes", icon: "calendar") { st.bookWith = p.id; st.bookName = p.firstName; st.bookRate = p.rate; st.go("book") }
                    RdIconButton(icon: "heart", size: 52) { onLike() }
                    RdMsgButton(action: { Task { if await RdLive.openChat(st, otherUid: p.id) { st.go("chat") } } }, size: 52)
                }.padding(.horizontal, 12).padding(.top, 8).padding(.bottom, 10).background(Color.white.opacity(0.96))
            }
        }
    }
}
