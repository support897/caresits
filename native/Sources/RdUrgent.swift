import SwiftUI

// Urgent board: families post, carers scroll and apply, family books right away.
// Also postcode and country helpers and the visa by country lines.

struct RdUrgentPostData: Identifiable {
    var id: String
    var fam: String, av: String, whenText: String, time: String, left: String
    var rate: Int, hrs: Double
    var sub: String, pc: String, km: Double
    var kids: String, body: String
    var imgs: [String], role: String, tags: [String]
    var applied: Int, pct: Int
    var qa: [(String, String, String)]
    var total: Int { return Int((Double(rate) * hrs).rounded()) }
}

struct RdWhenChip: View {
    var text: String
    var body: some View {
        let soon = text == "Today" || text == "Tonight"
        HStack(spacing: 6) {
            RdIcon(name: "clock", size: 15, color: soon ? .white : RdC.ink)
            Text(text).font(RdF.bold(13)).foregroundColor(soon ? .white : RdC.ink)
        }.padding(.horizontal, 12).padding(.vertical, 5).background(soon ? RdC.ras : RdC.sun).clipShape(Capsule())
    }
}

struct RdUrgentCard: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    var u: RdUrgentPostData
    var mine: Bool = false
    var detail: Bool = false
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                RdRemotePhoto(key: u.av).frame(width: 46, height: 46).clipShape(Circle())
                VStack(alignment: .leading, spacing: 1) {
                    Text(u.fam).font(RdF.bold(16)).foregroundColor(RdC.ink)
                    Text(u.sub + " " + u.pc + (u.km >= 0 ? " , " + String(format: "%.1f", u.km) + " km" : "")).font(RdF.body(12)).foregroundColor(RdC.mut).lineLimit(1).minimumScaleFactor(0.8)
                }
                Spacer(minLength: 0)
                if !mine && u.pct > 0 { RdRing(pct: u.pct, size: 52, line: 6) }
            }
            HStack(spacing: 8) { RdWhenChip(text: u.whenText); Text(u.left).font(RdF.bold(13)).foregroundColor(RdC.mut) }
            HStack(alignment: .firstTextBaseline) {
                Text("$" + String(u.rate) + " an hour").font(RdF.title(22)).foregroundColor(RdC.ras)
                Spacer()
                Text(u.time).font(RdF.body(12)).foregroundColor(RdC.mut)
            }
            Text("About $" + String(u.total) + " for " + String(u.hrs) + " hours. Children: " + u.kids).font(RdF.body(13)).foregroundColor(RdC.mut)
            Text(u.body).font(RdF.body(15)).foregroundColor(RdC.ink).fixedSize(horizontal: false, vertical: true)
            RdFlow(spacing: 6) {
                RdPill(role: u.role)
                ForEach(u.tags, id: \.self) { RdChip(text: $0) }
            }
            if !u.imgs.isEmpty {
                HStack(spacing: 6) { ForEach(u.imgs, id: \.self) { k in RdPhoto(key: k).frame(height: 104).clipShape(RoundedRectangle(cornerRadius: 16)) } }
            }
            if !mine && !detail {
                HStack(spacing: 8) {
                    RdCta(title: us.applied.contains(u.id) ? "Applied" : "Apply now", icon: "check", small: true) { us.selected = u.id; st.go(us.applied.contains(u.id) ? "urgentsent" : "urgentapply") }
                    Button { us.selected = u.id; st.go("urgentdetail") } label: {
                        HStack(spacing: 6) { RdIcon(name: "chat", size: 20); Text("Ask").font(RdF.bold(15)).foregroundColor(RdC.ink) }
                            .padding(.horizontal, 16).frame(height: 48).overlay(Capsule().stroke(RdC.line, lineWidth: 2))
                    }.buttonStyle(.plain)
                }
                if u.applied > 0 { Text(String(u.applied) + " carers applied. Fast replies win.").font(RdF.body(12)).foregroundColor(RdC.mut) }
            }
        }
        .padding(14).background(Color.white)
        .overlay(RoundedRectangle(cornerRadius: 26).stroke(RdC.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 26))
        .padding(.horizontal, 14).padding(.bottom, 12)
        .onTapGesture { if !detail { us.selected = u.id; st.go("urgentdetail") } }
    }
}

struct RdUrgent: View {
    @EnvironmentObject var st: RdStore
    @ObservedObject var us = RdUrgentStore.shared
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 6) { Circle().fill(RdC.ras).frame(width: 9, height: 9); Text("Urgent board").font(RdF.title(26)).foregroundColor(RdC.ink) }
                    Text("Families near you need help now. Postcode " + st.postcode + ", " + String(st.radius) + " km").font(RdF.body(13)).foregroundColor(RdC.mut)
                }
                Spacer()
                RdIconButton(icon: "sliders") { st.go("filters") }
            }.padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 8)
            .task { while !Task.isCancelled { await us.load(st); try? await Task.sleep(nanoseconds: 20_000_000_000) } }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(["All", "Now", "Tonight", "Tomorrow", "Weekend", "Nanny", "Babysitter", "Near me"], id: \.self) { f in
                        Button { us.filter = f } label: { RdChip(text: f, on: us.filter == f) }.buttonStyle(.plain)
                    }
                }.padding(.horizontal, 16)
            }.padding(.bottom, 10)
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 0) {
                    ForEach(us.visible) { u in RdUrgentCard(u: u) }
                    if us.loaded && us.visible.isEmpty { Text("No urgent jobs inside " + String(st.radius) + " km right now. This page checks again every 20 seconds.").font(RdF.body(15)).foregroundColor(RdC.mut).multilineTextAlignment(.center).padding(30) }
                    if !us.msg.isEmpty { Text(us.msg).font(RdF.body(13)).foregroundColor(RdC.ras).padding(.horizontal, 20) }
                }.padding(.bottom, 20)
            }.refreshable { await us.load(st) }
        }
    }
}

/// Visa lines by country, from official pages checked 22 Nov 2026.
enum RdVisaBy {
    static let lines: [String: [String]] = [
        "Australia": ["Working Holiday 417 or Work and Holiday 462", "Ages 18 to 30, up to 35 for some countries", "Up to 12 months. No family sponsor needed"],
        "United Kingdom": ["Youth Mobility Scheme", "Ages 18 to 35 for Australia, Canada, New Zealand, South Korea", "Up to 2 years. Family does not sponsor"],
        "USA": ["J-1 Au Pair, needs a sponsor agency", "Ages 18 to 26", "12 months. Up to 45 hours a week"],
        "Germany": ["Au pair visa", "Ages 18 to 26", "6 to 12 months. Up to 30 hours a week"],
        "France": ["Young au pair long stay visa", "Ages 18 to 30", "1 year, up to 2 years. Up to 25 hours a week"],
        "Canada": ["IEC Working Holiday, no au pair visa", "Ages 18 to 35, 18 to 30 for some countries", "Up to 2 years. Open work permit"],
        "Ireland": ["No au pair visa confirmed", "Not confirmed", "Not confirmed"],
        "New Zealand": ["Work visa needed for au pair work", "Not confirmed", "Not confirmed"]
    ]
}

struct RdVisaRow: View {
    var n: Int
    var place: String
    var status: String
    var body: some View {
        let v = RdVisaBy.lines[place] ?? ["Not confirmed", "Not confirmed", "Not confirmed"]
        VStack(alignment: .leading, spacing: 4) {
            HStack { Text(String(n) + ". " + place).font(RdF.bold(16)).foregroundColor(RdC.ink); Spacer(); if n == 1 { RdTag(text: "First choice") } }
            Text(v[0] + "\n" + v[1] + "\n" + v[2]).font(RdF.body(13)).foregroundColor(RdC.mut).fixedSize(horizontal: false, vertical: true)
            RdTag(text: status, fill: status == "Check the rules" ? RdC.warnBg : RdC.okBg, fg: status == "Check the rules" ? RdC.warnFg : RdC.okFg)
        }.padding(14).background(n == 1 ? RdC.pale : Color.white)
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(n == 1 ? RdC.ras : RdC.line, lineWidth: 2)).clipShape(RoundedRectangle(cornerRadius: 22)).padding(.horizontal, 16).padding(.bottom, 10)
    }
}

/// A postcode field and the first choice banner used on the deck.
struct RdPlaceRibbon: View {
    var text: String
    var icon: String = "pin"
    var body: some View {
        HStack(spacing: 8) { RdIcon(name: icon, size: 18); Text(text).font(RdF.bold(13)).foregroundColor(RdC.ink).lineLimit(2).minimumScaleFactor(0.8) }
            .padding(.horizontal, 12).padding(.vertical, 8).frame(maxWidth: .infinity, alignment: .leading).background(RdC.pale).clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
enum RdPostcode {
    static let map: [String: String] = ["Ashgrove": "4060", "Paddington": "4064", "Kelvin Grove": "4059", "Indooroopilly": "4068", "Toowong": "4066", "St Lucia": "4067", "Bulimba": "4171", "Chermside": "4032"]
    static func of(_ suburb: String) -> String { return map[suburb] ?? "4000" }
}
