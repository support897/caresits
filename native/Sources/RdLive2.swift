import SwiftUI
import MapKit
import FirebaseAuth

// Live booking, bookings list, home and map. Uses Backend.swift and RdLive.people.

struct RdLiveBook: View {
    @EnvironmentObject var st: RdStore
    @State private var day = Date().addingTimeInterval(86400)
    @State private var from = Calendar.current.date(bySettingHour: 17, minute: 0, second: 0, of: Date()) ?? Date()
    @State private var to = Calendar.current.date(bySettingHour: 21, minute: 0, second: 0, of: Date()) ?? Date()
    @State private var rate = 40
    @State private var note = ""
    @State private var busy = false
    @State private var done = false
    @State private var err = ""
    var hours: Double { max(0, to.timeIntervalSince(from) / 3600) }
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: "Book " + st.bookName)
            if done {
                Spacer()
                Image("bunny").resizable().scaledToFit().frame(width: 90)
                Text("Request sent").font(RdF.title(30)).foregroundColor(RdC.ink).padding(.top, 10)
                Text(st.bookName + " will say yes or no. You can message while you wait.").font(RdF.body(15)).foregroundColor(RdC.mut).multilineTextAlignment(.center).padding(.horizontal, 30).padding(.top, 4)
                Spacer()
                RdBottomBar { RdCta(title: "See my bookings") { st.root("bookings") } }
            } else {
                RdScroll {
                    DatePicker("Day", selection: $day, in: Date()..., displayedComponents: .date).font(RdF.bold(16)).padding(.horizontal, 20)
                    DatePicker("From", selection: $from, displayedComponents: .hourAndMinute).font(RdF.bold(16)).padding(.horizontal, 20).padding(.top, 8)
                    DatePicker("To", selection: $to, displayedComponents: .hourAndMinute).font(RdF.bold(16)).padding(.horizontal, 20).padding(.top, 8)
                    RdLabel(title: "Pay per hour", sub: "About $" + String(Int(Double(rate) * hours)) + " for " + String(format: "%.1f", hours) + " hours. You pay 10 percent on top. The carer keeps 100 percent.")
                    HStack(spacing: 14) { RdIconButton(icon: "minus") { if rate > 20 { rate -= 1 } }; Text("$" + String(rate)).font(RdF.title(34)).foregroundColor(RdC.ras); RdIconButton(icon: "plus") { if rate < 120 { rate += 1 } } }.padding(.horizontal, 20)
                    RdInput(label: "Note to " + st.bookName, text: $note)
                    RdCard(tint: RdC.pale) { RdMuted(text: "Card payment is not switched on yet. Nothing is charged. Pay the carer directly for now.") }
                    if !err.isEmpty { Text(err).font(RdF.body(13)).foregroundColor(RdC.ras).padding(.horizontal, 20) }
                }
                RdBottomBar { RdCta(title: busy ? "Sending" : (st.isFamily ? "Send booking request" : "Message the family"), icon: "calendar") {
                    guard let u = RdLive.uid else { err = "Please sign in first."; return }
                    if !st.isFamily { Task { if await RdLive.openChat(st, otherUid: st.bookWith) { st.go("chat") } }; return }
                    busy = true
                    let d = DateFormatter(); d.dateFormat = "yyyy-MM-dd"
                    let t = DateFormatter(); t.dateFormat = "HH:mm"
                    Task {
                        do { try await Backend.createBooking(familyUid: u, carerUid: st.bookWith, date: d.string(from: day), from: t.string(from: from), to: t.string(from: to), rate: Double(rate), note: note); done = true; err = "" }
                        catch { err = error.localizedDescription }
                        busy = false
                    }
                } }
            }
        }
        .onAppear { if st.bookRate > 0 { rate = Int(st.bookRate) } }
        .onDisappear { st.bookWith = "" }
    }
}

struct RdLiveBookings: View {
    @EnvironmentObject var st: RdStore
    @State private var rows: [(Booking, Person?)] = []
    @State private var loaded = false
    @State private var err = ""
    var body: some View {
        VStack(spacing: 0) {
            HStack { Text("Bookings").font(RdF.title(26)).foregroundColor(RdC.ink); Spacer() }.padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 8)
            RdScroll {
                if loaded && rows.isEmpty { RdCard { RdMuted(text: "No bookings yet. Book someone from the deck.") } }
                ForEach(0..<rows.count, id: \.self) { i in
                    let b = rows[i].0
                    let isCarer = b.carerUid == RdLive.uid
                    RdCard {
                        HStack(spacing: 12) {
                            RdRemotePhoto(key: rows[i].1?.photoKey ?? "").frame(width: 48, height: 48).clipShape(Circle())
                            VStack(alignment: .leading, spacing: 2) { Text(rows[i].1?.name ?? "Member").font(RdF.bold(16)).foregroundColor(RdC.ink); RdMuted(text: b.date + ", " + b.from + " to " + b.to) }
                            RdTag(text: b.state.capitalized, fill: b.state == "accepted" ? RdC.okBg : RdC.warnBg, fg: b.state == "accepted" ? RdC.okFg : RdC.warnFg)
                        }
                        RdMuted(text: "$" + String(Int(b.rate)) + " an hour, about $" + String(Int(b.estimate)))
                        HStack(spacing: 8) {
                            if isCarer && b.state == "requested" {
                                RdCta(title: "Accept", small: true) { act(b, "accepted", true) }
                                RdCta(title: "Decline", style: 1, small: true) { act(b, "declined", true) }
                            } else if b.state == "requested" || b.state == "accepted" {
                                RdCta(title: "Cancel", style: 1, small: true) { act(b, "cancelled", isCarer) }
                            }
                        }
                    }
                }
                if !err.isEmpty { Text(err).font(RdF.body(13)).foregroundColor(RdC.ras).padding(.horizontal, 20) }
            }
        }.task { await load() }
    }
    func act(_ b: Booking, _ to: String, _ carer: Bool) {
        guard let u = RdLive.uid else { return }
        Task { do { try await Backend.transition(b, to: to, actorUid: u, actorIsCarer: carer); await load() } catch { err = error.localizedDescription } }
    }
    func load() async {
        guard let u = RdLive.uid else { loaded = true; return }
        let bs = await Backend.bookings(u, side: st.isFamily ? "family" : "carer")
        let ps = await Backend.loadProfiles(bs.map { $0.familyUid == u ? $0.carerUid : $0.familyUid })
        rows = bs.map { ($0, ps[$0.familyUid == u ? $0.carerUid : $0.familyUid]) }
        loaded = true
    }
}

/// Home: the best live match, with Book and Message, or an honest empty line.
struct RdLiveHome: View {
    @EnvironmentObject var st: RdStore
    @State private var best: RdLivePerson? = nil
    @State private var loaded = false
    var body: some View {
        VStack(spacing: 0) {
            if let x = best {
                HStack(spacing: 14) {
                    RdRemotePhoto(key: x.p.photoKey).frame(width: 72, height: 72).clipShape(RoundedRectangle(cornerRadius: 20))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(x.label).font(RdF.bold(13)).foregroundColor(RdC.ras)
                        Text(x.p.name).font(RdF.title(20)).foregroundColor(RdC.ink)
                        Text(x.km >= 0 ? "Postcode " + x.p.postcode + ", " + Geo.label(x.km) + " away" : "Postcode " + x.p.postcode).font(RdF.body(14)).foregroundColor(RdC.mut)
                    }
                    Spacer(minLength: 0)
                    RdRing(pct: x.score, size: 62, line: 7)
                }.padding(14).background(Color.white).overlay(RoundedRectangle(cornerRadius: 28).stroke(RdC.line, lineWidth: 1)).padding(.horizontal, 16).padding(.vertical, 8)
                HStack(spacing: 12) {
                    RdCta(title: st.isFamily ? "Book " + x.p.firstName : "Say yes", icon: "calendar") { st.bookWith = x.p.id; st.bookName = x.p.firstName; st.bookRate = x.p.rate; st.go("book") }
                    RdMsgButton { Task { if await RdLive.openChat(st, otherUid: x.p.id) { st.go("chat") } } }
                }.padding(.horizontal, 16).padding(.top, 4)
                HStack(spacing: 10) {
                    RdCta(title: "See all matches", style: 1, small: true) { st.root("deck") }
                    RdCta(title: "Map", style: 1, small: true) { st.root("map") }
                }.padding(.horizontal, 16).padding(.top, 8)
            } else {
                RdCard { RdMuted(text: loaded ? "Nobody inside " + String(st.radius) + " km yet. We will show your best match here as people join." : "Looking for your best match") }
                RdCta(title: "See all matches", style: 1, small: true) { st.root("deck") }.padding(.horizontal, 16).padding(.top, 8)
            }
        }.task { best = await RdLive.people(st).first; loaded = true }
    }
}

/// A short list of upcoming bookings for Home.
struct RdLiveWeek: View {
    @EnvironmentObject var st: RdStore
    @State private var lines: [String] = []
    @State private var loaded = false
    var body: some View {
        RdCard {
            if lines.isEmpty { RdMuted(text: loaded ? "No bookings yet." : "Loading") }
            ForEach(lines, id: \.self) { RdMuted(text: $0) }
        }.task {
            guard let u = RdLive.uid else { loaded = true; return }
            let bs = await Backend.bookings(u, side: st.isFamily ? "family" : "carer")
            lines = bs.filter { $0.state == "accepted" || $0.state == "requested" }.prefix(5).map { $0.date + ", " + $0.from + " to " + $0.to + ", " + $0.state }
            loaded = true
        }
    }
}

struct RdLiveMap: View {
    @EnvironmentObject var st: RdStore
    @State private var people: [RdLivePerson] = []
    @State private var sel: String = ""
    @State private var loaded = false
    var body: some View {
        let o = st.origin
        ZStack(alignment: .bottom) {
            Map(initialPosition: .region(MKCoordinateRegion(center: o ?? CLLocationCoordinate2D(latitude: -27.47, longitude: 153.02), span: MKCoordinateSpan(latitudeDelta: Double(max(st.radius, 5)) / 40, longitudeDelta: Double(max(st.radius, 5)) / 40)))) {
                if let o { MapCircle(center: o, radius: Double(st.radius) * 1000).foregroundStyle(RdC.pink.opacity(0.12)).stroke(RdC.pink, lineWidth: 2) }
                ForEach(people) { x in
                    if let c = x.coord {
                        Annotation("", coordinate: c, anchor: .bottom) { BunnyPin(selected: x.id == sel).scaleEffect(x.id == sel ? 0.6 : 0.46).onTapGesture { sel = x.id } }
                    }
                }
            }
            .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
            .ignoresSafeArea()
            VStack { RdTopBar(on: "map"); Spacer() }
            VStack(spacing: 8) {
                if let x = people.first(where: { $0.id == sel }) {
                    HStack(spacing: 12) {
                        RdRemotePhoto(key: x.p.photoKey).frame(width: 64, height: 64).clipShape(RoundedRectangle(cornerRadius: 18))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(x.p.name).font(RdF.bold(17)).foregroundColor(RdC.ink).lineLimit(1)
                            Text("Postcode " + x.p.postcode + (x.km >= 0 ? ", " + Geo.label(x.km) + " away" : "")).font(RdF.body(12)).foregroundColor(RdC.mut)
                        }
                        Spacer(minLength: 0)
                        RdRing(pct: x.score, size: 62, line: 7)
                    }.padding(12).background(Color.white).clipShape(RoundedRectangle(cornerRadius: 26)).padding(.horizontal, 12)
                    HStack(spacing: 12) {
                        RdCta(title: st.isFamily ? "Book " + x.p.firstName : "Say yes", icon: "calendar") { st.bookWith = x.p.id; st.bookName = x.p.firstName; st.bookRate = x.p.rate; st.go("book") }
                        RdMsgButton { Task { if await RdLive.openChat(st, otherUid: x.p.id) { st.go("chat") } } }
                    }.padding(.horizontal, 16)
                } else if loaded {
                    Text(people.isEmpty ? "Nobody inside " + String(st.radius) + " km yet." : "Tap a bunny to see who it is.").font(RdF.bold(14)).foregroundColor(RdC.ink).padding(10).background(Color.white).clipShape(Capsule())
                }
            }.padding(.bottom, 12)
        }.task { _ = await RdLive.origin(st); people = await RdLive.people(st); loaded = true }
    }
}
