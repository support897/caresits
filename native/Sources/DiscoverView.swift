import SwiftUI
import MapKit
import CoreLocation

struct DiscoverView: View {
    @EnvironmentObject var s: Session
    @State private var people: [Person] = []
    @State private var saved: Set<String> = []
    @State private var loaded = false
    @State private var filter = "all"
    @State private var onlySaved = false
    @AppStorage("caresits.radiusKm") private var radius = 25
    @State private var myCoord: CLLocationCoordinate2D?
    @State private var coords: [String: CLLocationCoordinate2D] = [:]
    @State private var showMap = false
    @State private var urgent = false
    @State private var mapPick: String?
    @State private var pinSel: String?
    @State private var camTick = 0
    @State private var countries: [String] = []
    @State private var banner: Person?
    @State private var mapRegion: MKCoordinateRegion?

    var role: Role { s.role }
    var services: [String] { s.me?.services ?? [] }
    /// Distance in km from me to a person, when both postcodes could be placed.
    func km(_ p: Person) -> Double? {
        guard let a = myCoord, let b = coords[p.postcode.trimmingCharacters(in: .whitespaces)] else { return nil }
        return Geo.km(a, b)
    }
    /// The deck pool: my city or the chosen distance. "Any" (0) shows everyone. A person whose place is unknown is kept.
    var shown: [Person] {
        people.filter { p in
            (filter == "all" || p.services.contains(filter)) && (!onlySaved || saved.contains(p.id))
                && (onlySaved || radius == 0 || (km(p).map { $0 <= Double(radius) } ?? true))
        }
    }
    var title: String { switch role { case .family: return "Find care"; case .nanny: return "Families"; case .babysitter: return "Jobs"; case .auPair: return "Host families" } }

    @State private var skipped: Set<String> = []
    @State private var camera: MapCameraPosition = .automatic
    /// Frame the first view on the pins so everyone on the map is in sight.
    func frame(_ pins: [Person]) {
        let pts = pins.compactMap { coords[$0.postcode.trimmingCharacters(in: .whitespaces)] }.map { MKMapPoint($0) }
        guard let f = pts.first else { return }
        var r = MKMapRect(origin: f, size: MKMapSize(width: 0, height: 0))
        for p in pts { r = r.union(MKMapRect(origin: p, size: MKMapSize(width: 0, height: 0))) }
        let padW = max(r.size.width * 0.25, 20000), padH = max(r.size.height * 0.25, 20000)
        camera = .rect(r.insetBy(dx: -padW, dy: -padH))
    }
    @State private var detail: Person?
    @State private var drag: CGSize = .zero
    @State private var deckContact: (person: Person, mode: ContactMode)?
    var deck: [Person] {
        let base = shown.filter { !skipped.contains($0.id) }; guard let me = s.me else { return base }
        let byMatch = base.sorted { $0.match(with: me).percent > $1.match(with: me).percent }
        // The completion ladder: a carer finishing under 80 percent of bookings shows later, after every
        // carer at or above the line. The match percent itself never changes; only the order does.
        let sorted = byMatch.sorted { (($0.side == "carer" && ($0.completion?.rate ?? 1) < 0.8) ? 1 : 0) < (($1.side == "carer" && ($1.completion?.rate ?? 1) < 0.8) ? 1 : 0) }
        #if DEBUG
        // Test only: the proof run's own person goes first, so old test profiles in the live pool never hide it.
        if let first = UserDefaults.standard.stringArray(forKey: "cs.proof.first"), let i = sorted.firstIndex(where: { first.contains($0.id) }) { var a = sorted; let x = a.remove(at: i); a.insert(x, at: 0); return a }
        #endif
        return sorted
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 10) {
                HStack(spacing: 10) {
                    Text(title).font(Brand.title(30)).foregroundStyle(Brand.titleColor)
                    Spacer()
                    Menu {
                        ForEach([10, 25, 50, 0], id: \.self) { k in Button(k == 0 ? "Any distance" : "\(k) km") { radius = k; skipped = [] } }
                    } label: { Text(radius == 0 ? "Any" : "\(radius) km").font(.custom("Atkinson Hyperlegible", size: 16).weight(.semibold)).foregroundStyle(Brand.ink).padding(.horizontal, 14).padding(.vertical, 10).background(Brand.field).clipShape(Capsule()) }.accessibilityIdentifier("radiusMenu")
                    Button { showMap.toggle() } label: { BrandIcon(kind: .pin, size: 24, color: Brand.ink, solid: showMap).padding(10).background(Brand.field).clipShape(Circle()) }.accessibilityLabel(showMap ? "Deck" : "Map").accessibilityIdentifier("mapToggle")
                    Button { onlySaved.toggle(); skipped = [] } label: { BrandIcon(kind: .heart, size: 24, color: Brand.bunny, solid: onlySaved).padding(10).background(Brand.field).clipShape(Circle()) }.accessibilityLabel("Matches")
                }.padding(.horizontal, 20).padding(.top, 8)
                if role == .family, let m = s.me, m.postcode.isEmpty && m.suburb.isEmpty {
                    HStack(spacing: 8) {
                        Text("Family details missing.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
                        Button { s.goMyFamily = true } label: { HStack(spacing: 4) { Text("Me → My family").font(.footnote.weight(.semibold)).underline(); BrandIcon(kind: .arrow, size: 14, color: role.tint) } }.accessibilityIdentifier("finishFamilyLink")
                        Spacer()
                    }.padding(.horizontal, 20)
                }
                if !showMap {
                    HStack(spacing: 8) {
                        Button { urgent = false } label: { Chip(text: "Browse", on: !urgent, tint: Brand.bunny) }.accessibilityIdentifier("browseTab")
                        Button { urgent = true } label: { Chip(text: "Urgent", on: urgent, tint: Brand.bunny, icon: .clock) }.accessibilityIdentifier("urgentTab")
                        Spacer()
                    }.padding(.horizontal, 20)
                }
                if role == .family && services.count > 1 && !showMap && !urgent {
                    ScrollView(.horizontal, showsIndicators: false) { HStack {
                        Button { filter = "all"; skipped = [] } label: { Chip(text: "All", on: filter == "all", tint: role.tint) }
                        ForEach(services, id: \.self) { sv in Button { filter = sv; skipped = [] } label: { Chip(text: (serviceLabels[sv] ?? sv) + "s", on: filter == sv, tint: role.tint) } }
                    }.padding(.horizontal, 20) }
                }
                if let b = banner {
                    HStack(spacing: 10) {
                        BrandIcon(kind: .heart, size: 20, color: Brand.bunny, solid: true)
                        Text("Matched with \(b.firstName)").font(.custom("Atkinson Hyperlegible", size: 16).weight(.semibold)).foregroundStyle(Brand.ink)
                        Spacer()
                        Button("Message") { deckContact = (b, .message); banner = nil }.font(.custom("Atkinson Hyperlegible", size: 16).weight(.semibold)).foregroundStyle(role.tint)
                    }.padding(14).background(Brand.card).clipShape(RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.black.opacity(0.1), lineWidth: 1)).padding(.horizontal, 20).padding(.top, 00).transition(.move(edge: .top).combined(with: .opacity)).accessibilityIdentifier("matchBanner")
                }
                if showMap { mapView.padding(.horizontal, 20).frame(maxHeight: .infinity) } else if urgent { UrgentBoardView().frame(maxHeight: .infinity) } else { deckStack }
                if !showMap && !urgent {
                    HStack(spacing: 18) {
                        roundBtn(.cross, Brand.muted, "Pass") { if let p = deck.first { fling(p, like: false) } }
                        roundBtn(.info, Brand.ink, "Details") { detail = deck.first }
                        roundBtn(.heart, Brand.bunny, "Match", solid: true) { if let p = deck.first { fling(p, like: true) } }
                    }.padding(.bottom, 8)
                }
            }
            .background(Brand.cream.ignoresSafeArea()).refreshable { await load() }.task { await load() }.onChange(of: showMap) { _, on in if on { Task { await refreshCountries() } } }
            .sheet(isPresented: Binding(get: { deckContact != nil }, set: { if !$0 { deckContact = nil } })) { if let d = deckContact { ContactSheet(person: d.person, mode: d.mode) } }
            .navigationDestination(item: $detail) { p in PersonDetailView(person: p, saved: saved.contains(p.id)) { on in if on { saved.insert(p.id) } else { saved.remove(p.id) } } }
            .onChange(of: mapPick) { _, id in if let id, let p = people.first(where: { $0.id == id }) { detail = p; mapPick = nil } }
        }
    }
    var deckStack: some View {
        ZStack {
            if !loaded { ProgressView() }
            else if deck.isEmpty {
                VStack(spacing: 10) {
                    BunnyView(size: 80, mood: onlySaved ? .encourage : .rest)
                    Text(onlySaved ? "No matches yet" : "You saw everyone").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)).foregroundStyle(Brand.muted)
                    if !skipped.isEmpty { Button { skipped = [] } label: { IconLabel(icon: .undo, text: "See again") }.buttonStyle(.bordered) }
                    if !onlySaved && radius != 0 && !people.isEmpty { Button("Any distance") { radius = 0 }.font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)) }
                }
            }
            ForEach(Array(deck.prefix(3).enumerated().reversed()), id: \.element.id) { i, p in
                SwipeCard(person: p, tint: role.tint, top: i == 0, offset: i == 0 ? drag : .zero, depth: i, match: s.me.map { p.match(with: $0) }, distance: km(p),
                          onMessage: { deckContact = (p, .message) }, onResume: s.me?.side == "carer" ? { deckContact = (p, .resume) } : nil)
                    .clipShape(RoundedRectangle(cornerRadius: 28)).contentShape(RoundedRectangle(cornerRadius: 28))
                    .gesture(i == 0 ? DragGesture(minimumDistance: 16)
                        .onChanged { drag = $0.translation }
                        .onEnded { v in
                            if abs(v.translation.width) > 110 { fling(p, like: v.translation.width > 0) }
                            else { withAnimation(.spring()) { drag = .zero } }
                        } : nil)
                    .accessibilityIdentifier(i == 0 ? "topCard" : "card\(i)")
            }
        }.padding(.horizontal, 20).frame(maxHeight: .infinity)
    }
    /// The map shows everyone (not limited by the deck distance), still only the other side of the match.
    var mapView: some View {
        let _ = camTick
        // Family chosen countries: au pairs show only when their own country (card nationality) is one the family picked.
        let chosen = (role == .family ? countries : [])
        let pins = people.filter { coords[$0.postcode.trimmingCharacters(in: .whitespaces)] != nil && (chosen.isEmpty || $0.role != .auPair || chosen.contains($0.nationality)) }
        let picked = pins.first { $0.id == pinSel }
        return MapReader { proxy in
            Map(position: $camera).accessibilityIdentifier("peopleMap")
                .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false))
                .onMapCameraChange(frequency: .continuous) { ctx in mapRegion = ctx.region; camTick &+= 1 }
                .onAppear { frame(pins) }.onChange(of: pins.count) { _, _ in frame(pins) }
                // The wash: pale pink land and pale blue sea as near as MapKit allows. The pins sit above it so they stay raspberry.
                .overlay { Color.white.opacity(0.8).allowsHitTesting(false) }
                .overlay { Color(hex: 0xFFE3EC).opacity(0.25).blendMode(.multiply).allowsHitTesting(false) }
                .overlay {
                    ZStack(alignment: .topLeading) {
                        ForEach(pins) { p in
                            if let c = coords[p.postcode.trimmingCharacters(in: .whitespaces)], let pt = proxy.convert(c, to: .local) {
                                Button { pinSel = (pinSel == p.id) ? nil : p.id } label: { BunnyPin(selected: pinSel == p.id) }
                                    .buttonStyle(.plain).frame(width: 50, height: BunnyPin.height)
                                    .offset(x: pt.x - 25, y: pt.y - BunnyPin.height * 62.0 / 86.0)
                                    .zIndex(pinSel == p.id ? 1 : 0)
                                    .accessibilityLabel(p.firstName).accessibilityIdentifier("mapPin").accessibilityValue(pinSel == p.id ? "selected" : "not selected")
                            }
                        }
                    }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
        }
        .overlay(alignment: .topTrailing) {
            VStack(spacing: 12) {
                mapBtn(.plus, "Zoom in") { zoom(0.5) }
                mapBtn(.minus, "Zoom out") { zoom(2) }
                mapBtn(.locate, "My place") { if let c = myCoord { camera = .region(MKCoordinateRegion(center: c, span: MKCoordinateSpan(latitudeDelta: 0.25, longitudeDelta: 0.25))) } }
            }.padding(12)
        }
        .overlay(alignment: .bottom) {
            HStack(alignment: .bottom, spacing: 6) {
                Group {
                    if let c = picked {
                        Button { mapPick = c.id } label: { HStack(spacing: 6) { Text("Meet \(c.firstName)").font(.custom("Atkinson Hyperlegible", size: 16).weight(.semibold)); BrandIcon(kind: .arrow, size: 16, color: BunnyPin.raspberry) } }
                            .buttonStyle(.plain).accessibilityIdentifier("meetPinned")
                    } else {
                        Text(pins.isEmpty ? "No one is on the map yet" : "Tap a pin to meet someone nearby.").font(.custom("Atkinson Hyperlegible", size: 16).weight(.medium))
                    }
                }.foregroundStyle(Brand.ink).padding(.horizontal, 16).padding(.vertical, 12).background(Brand.card).clipShape(Capsule())
                Spacer(minLength: 0)
                BunnyView(size: 64, mood: .hello)
            }.padding(.horizontal, 10).padding(.bottom, 8)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24)).overlay(RoundedRectangle(cornerRadius: 24).stroke(Brand.bunnyBlush, lineWidth: 1.5))
    }
    func mapBtn(_ icon: BI, _ label: String, _ f: @escaping () -> Void) -> some View {
        Button(action: f) { BrandIcon(kind: icon, size: 22, color: BunnyPin.raspberry).frame(width: 46, height: 46).background(Brand.card).clipShape(Circle()).shadow(color: .black.opacity(0.08), radius: 3, y: 1) }
            .buttonStyle(.plain).accessibilityLabel(label)
    }
    func zoom(_ k: Double) {
        guard let r = mapRegion else { return }
        camera = .region(MKCoordinateRegion(center: r.center, span: MKCoordinateSpan(latitudeDelta: min(max(r.span.latitudeDelta * k, 0.005), 120), longitudeDelta: min(max(r.span.longitudeDelta * k, 0.005), 120))))
    }
    func roundBtn(_ icon: BI, _ c: Color, _ label: String, solid: Bool = false, _ f: @escaping () -> Void) -> some View {
        Button(action: f) { BrandIcon(kind: icon, size: 26, color: c, solid: solid).frame(width: 56, height: 56).background(Brand.card).clipShape(Circle()).overlay(Circle().stroke(Color.black.opacity(0.1), lineWidth: 1)) }.accessibilityLabel(label)
    }
    func fling(_ p: Person, like: Bool) {
        withAnimation(.easeIn(duration: 0.22)) { drag = CGSize(width: like ? 700 : -700, height: 40) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.23) {
            if like, let me = s.me { saved.insert(p.id); Task { await Backend.setSaved(me.id, p.id, true) }; withAnimation { banner = p }
                DispatchQueue.main.asyncAfter(deadline: .now() + 7) { withAnimation { if banner?.id == p.id { banner = nil } } } }
            if !onlySaved || !like { skipped.insert(p.id) }
            drag = .zero
        }
    }
    /// The family's chosen countries (looking musts or prefs nationality), read fresh so a change in the asking shows on the map.
    func refreshCountries() async {
        guard let uid = s.uid, let me = await Backend.loadProfile(uid) else { return }
        let mu = me.looking["musts"] as? [String: Any], pr = me.looking["prefs"] as? [String: Any]
        countries = (mu?["nationality"] as? [String]) ?? (pr?["nationality"] as? [String]) ?? []
    }
    func load() async {
        guard let me = s.me else { return }
        await refreshCountries()
        async let list = Backend.discover(me: me, services: me.services)
        async let sv = Backend.savedIds(me.id)
        people = await list; saved = await sv; loaded = true
        // Place me and everyone by postcode, one lookup per postcode.
        myCoord = await Geo.coord(postcode: me.postcode)
        var found: [String: CLLocationCoordinate2D] = [:]
        for pc in Set(people.map { $0.postcode.trimmingCharacters(in: .whitespaces) }) where !pc.isEmpty {
            if let c = await Geo.coord(postcode: pc) { found[pc] = c; coords = found }
        }
        coords = found
    }
}

struct PersonRow: View {
    let person: Person; let saved: Bool; let tint: Color
    @State private var verified: String?
    @State private var rating: (avg: Double, count: Int)?
    var body: some View {
        Card {
            HStack(spacing: 14) {
                PhotoView(key: person.photoKey, size: 72, fallback: person.role.icon)
                VStack(alignment: .leading, spacing: 4) {
                    HStack { Text(person.firstName).font(.title3.bold()).foregroundStyle(Brand.ink); if verified != nil { IconLabel(icon: .shield, text: "Checked", size: 12, gap: 4).font(.caption.bold()).padding(.horizontal, 6).padding(.vertical, 2).background(Brand.blush.opacity(0.5)).clipShape(Capsule()) } ; Spacer(); if saved { BrandIcon(kind: .heart, size: 20, color: Brand.bunny, solid: true) } }
                    if person.side == "carer" {
                        if !person.headline.isEmpty { Text(person.headline).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)).foregroundStyle(Brand.muted).lineLimit(2) }
                        HStack(spacing: 10) { IconLabel(icon: person.role.icon, text: person.role.name, size: 14).padding(.horizontal, 8).padding(.vertical, 3).background(person.role.sign.opacity(0.7)).clipShape(Capsule()); if person.rate > 0 { IconLabel(icon: .rate, text: "\(Int(person.rate))/h", size: 14) }; if person.years > 0 { IconLabel(icon: .star, text: "\(person.years)y", size: 14) } }.font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote))
                        if person.side == "carer" { Text(person.completionText).font(.custom("Atkinson Hyperlegible", size: 12, relativeTo: .caption)).foregroundStyle(Brand.muted) }
                        if let r = rating { IconLabel(icon: .star, text: "\(String(format: "%.1f", r.avg)) (\(r.count))", size: 13, color: Brand.bunny).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.ink) }
                    } else {
                        Text(person.suburb.isEmpty ? "Family" : person.suburb).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)).foregroundStyle(Brand.muted)
                        HStack(spacing: 10) { Text(person.services.map { serviceLabels[$0] ?? $0 }.joined(separator: " · ")); if person.budgetMax > 0 { IconLabel(icon: .rate, text: "up to \(Int(person.budgetMax))/h", size: 14) } }.font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote))
                        if !person.kids.isEmpty { IconLabel(icon: .child, text: person.kids.map { "\($0.name.isEmpty ? "Child" : $0.name) \($0.age)" }.joined(separator: ", "), size: 14).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)) }
                    }
                    if !person.days.isEmpty { Text(person.days.joined(separator: " ")).font(.custom("Atkinson Hyperlegible", size: 12, relativeTo: .caption)).foregroundStyle(tint) }
                }
            }
        }.task { if person.side == "carer" { verified = await Backend.verifiedLevel(person.id); rating = await Backend.reviewSummary(person.id) } }
    }
}

struct PersonDetailView: View {
    @EnvironmentObject var s: Session
    let person: Person; @State var saved: Bool; var onSave: (Bool) -> Void
    @State private var verified: String?; @State private var resume: Resume?
    @State private var reviews: [(rating: Int, text: String)] = []
    @State private var profileReviews: [(rating: Int, text: String, by: String)] = []
    @State private var showReview = false
    @State private var showBook = false
    @State private var photoIndex = 0
    @State private var showSet = false
    @State private var contact: ContactMode?
    @State private var rating: (avg: Double, count: Int)?
    var role: Role { s.role }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if person.allPhotos.isEmpty {
                    PhotoView(key: "", size: 150, fallback: person.role.icon).padding(.top, 10)
                } else {
                    TabView(selection: $photoIndex) { ForEach(person.allPhotos.indices, id: \.self) { i in PhotoView(key: person.allPhotos[i], size: 300, round: false, fallback: person.role.icon, fill: true).tag(i).onTapGesture { showSet = true } } }
                        .tabViewStyle(.page(indexDisplayMode: .automatic)).frame(height: 300).clipShape(RoundedRectangle(cornerRadius: 20)).padding(.top, 10).accessibilityIdentifier("profileGallery")
                        .fullScreenCover(isPresented: $showSet) { PhotoSetView(keys: person.allPhotos, start: photoIndex) }
                }
                Text(person.name).font(Brand.title(30)).foregroundStyle(Brand.titleColor)
                if person.side == "carer" {
                    if !person.headline.isEmpty { Text(person.headline).font(.title3).foregroundStyle(Brand.muted).multilineTextAlignment(.center) }
                    HStack { Chip(text: person.role.name, on: true, tint: Brand.bunny, icon: person.role.icon); if person.rate > 0 { Chip(text: "\(Int(person.rate))/h", icon: .rate) }; if person.years > 0 { Chip(text: person.years == 1 ? "1 yr" : "\(person.years) yrs", icon: .star) } }
                    Text(person.completionText).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)).foregroundStyle(Brand.muted).accessibilityIdentifier("completionRate")
                }
                Card { VStack(alignment: .leading, spacing: 8) {
                    Text("Checks").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                    if let v = verified { IconLabel(icon: .shield, text: "Checked: \(v.capitalized)", size: 18) } else { IconLabel(icon: .search, text: "Not checked yet", size: 18, color: Brand.muted).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)).foregroundStyle(Brand.muted) }
                } }
                if !person.about.isEmpty { Card { VStack(alignment: .leading) { Text("About").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)); Text(person.about) } } }
                if !person.languages.isEmpty { Card { VStack(alignment: .leading) { IconLabel(icon: .globe, text: "Languages", size: 18).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)); Text(person.languages.joined(separator: ", ")) } } }
                if !person.days.isEmpty { Card { VStack(alignment: .leading) { IconLabel(icon: .calendar, text: "Days", size: 18).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)); Text(person.days.joined(separator: " · ")) } } }
                if let r = resume, !r.isEmpty { Card { VStack(alignment: .leading, spacing: 6) {
                    IconLabel(icon: .doc, text: "Resume", size: 18).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                    ForEach(r.jobs, id: \.self) { Text("• " + $0).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)) }
                    if !r.skills.isEmpty { Text("Skills: " + r.skills.joined(separator: ", ")).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)) }
                    if !r.certificates.isEmpty { Text("Certificates they list: " + r.certificates.joined(separator: "; ")).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)) }
                    Text("Their own words. Not checked.").font(.custom("Atkinson Hyperlegible", size: 12, relativeTo: .caption)).foregroundStyle(Brand.muted)
                } } }
                Card { VStack(alignment: .leading, spacing: 6) {
                    IconLabel(icon: .star, text: "Reviews", size: 18).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                    if let r = rating { Text("\(String(format: "%.1f", r.avg)) out of 5 from \(r.count)").foregroundStyle(Brand.ink) }
                    if reviews.isEmpty && profileReviews.isEmpty { Text("No reviews yet").font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)).foregroundStyle(Brand.muted) }
                    ForEach(reviews.indices, id: \.self) { i in HStack(spacing: 8) { Stars(count: reviews[i].rating); if !reviews[i].text.isEmpty { Text(reviews[i].text) } }.font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)) }
                    ForEach(profileReviews.indices, id: \.self) { i in VStack(alignment: .leading, spacing: 2) { HStack(spacing: 8) { Stars(count: profileReviews[i].rating); Text(profileReviews[i].by).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline).weight(.semibold)) }; if !profileReviews[i].text.isEmpty { Text(profileReviews[i].text).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)) } } }
                    if let me = s.me, me.id != person.id { Button { showReview = true } label: { IconLabel(icon: .pencil, text: "Leave a review", size: 16, color: Brand.bunny) }.padding(.top, 4).accessibilityIdentifier("leaveReview") }
                } }
                if role == .family && person.side == "carer" { BigButton(title: "Book \(person.firstName)", tint: role.tint, icon: .calendar) { showBook = true } }
                else if person.side == "family" { EmptyView() }
                HStack(spacing: 10) {
                    Button { contact = .message } label: { IconLabel(icon: .chat, text: "Message", size: 20).font(.custom("Atkinson Hyperlegible", size: 17).weight(.semibold)).frame(maxWidth: .infinity, minHeight: 48).background(Brand.field).foregroundStyle(Brand.ink).clipShape(RoundedRectangle(cornerRadius: 14)) }
                    if s.me?.side == "carer" && person.side == "family" { Button { contact = .resume } label: { IconLabel(icon: .doc, text: "Send resume", size: 20).font(.custom("Atkinson Hyperlegible", size: 17).weight(.semibold)).frame(maxWidth: .infinity, minHeight: 48).background(Brand.field).foregroundStyle(Brand.ink).clipShape(RoundedRectangle(cornerRadius: 14)) } }
                }
            }.padding(20).padding(.bottom, 100)
        }
        .background(Brand.cream.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { saved.toggle(); onSave(saved); if let u = s.uid { Task { await Backend.setSaved(u, person.id, saved) } } } label: { BrandIcon(kind: .heart, size: 24, color: Brand.bunny, solid: saved) } } }
        .sheet(isPresented: $showBook) { BookSheet(carer: person) }
        .sheet(isPresented: $showReview) { ProfileReviewSheet(person: person) { Task { profileReviews = await Backend.profileReviews(about: person.id) } } }
        .sheet(item: $contact) { ContactSheet(person: person, mode: $0) }
        .task {
            if person.side == "carer" { verified = await Backend.verifiedLevel(person.id); reviews = await Backend.reviewsFor(carer: person.id); rating = await Backend.reviewSummary(person.id); resume = await Backend.loadResume(person.id) }
            profileReviews = await Backend.profileReviews(about: person.id)
        }
    }
}

struct BookSheet: View {
    @EnvironmentObject var s: Session
    @Environment(\.dismiss) var dismiss
    let carer: Person
    @State private var date = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    @State private var from = Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: Date())!
    @State private var to = Calendar.current.date(bySettingHour: 13, minute: 0, second: 0, of: Date())!
    @State private var note = ""; @State private var busy = false; @State private var err = ""; @State private var done = false
    var f: DateFormatter { let x = DateFormatter(); x.dateFormat = "HH:mm"; x.locale = Locale(identifier: "en_US_POSIX"); return x }
    var hours: Double { Backend.hours(from: f.string(from: from), to: f.string(from: to)) }
    var body: some View {
        NavigationStack {
            ScrollView { VStack(spacing: 14) {
                if done {
                    BunnyView(size: 120, mood: .celebrate); Text("Request sent!").font(Brand.title(28)).foregroundStyle(Brand.titleColor)
                    Text("\(carer.firstName) will reply soon. You can say hello in Messages now.").multilineTextAlignment(.center)
                    BigButton(title: "Done", tint: s.role.tint) { dismiss() }
                } else {
                    HStack { PhotoView(key: carer.photoKey, size: 56, fallback: carer.role.icon); Text("Book \(carer.firstName)").font(Brand.title(24)).foregroundStyle(Brand.titleColor); Spacer() }
                    Card { VStack(alignment: .leading) {
                        DatePicker("Day", selection: $date, in: Date()..., displayedComponents: .date)
                        DatePicker("From", selection: $from, displayedComponents: .hourAndMinute)
                        DatePicker("To", selection: $to, displayedComponents: .hourAndMinute)
                    } }
                    Card { VStack(alignment: .leading, spacing: 4) {
                        IconLabel(icon: .rate, text: "\(Int(carer.rate)) per hour × \(String(format: "%.1f", hours)) h", size: 16).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline))
                        Text("About $\(Int(carer.rate * hours))").font(.title2.bold())
                        if PayConfig.visible { PayPromise(name: carer.firstName, estimate: carer.rate * hours) } else { Text("Free to cancel up to 24 hours before.").font(.custom("Atkinson Hyperlegible", size: 12, relativeTo: .caption)).foregroundStyle(Brand.muted) }
                    } }
                    TextField("Note (optional)", text: $note, axis: .vertical).lineLimit(3...5).padding(14).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
                    if !err.isEmpty { Text(err).foregroundStyle(Brand.ink) }
                    if let c = carer.completion, c.rate < 0.7 { Text("\(carer.firstName) is not taking new bookings right now. Carers under 70 percent finished pause new bookings while they finish the jobs they already have.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted) }
                    BigButton(title: "Send request", tint: s.role.tint, busy: busy) { Task { await send() } }
                }
            }.padding(20) }
            .background(Brand.cream.ignoresSafeArea()).toolbar { ToolbarItem(placement: .topBarLeading) { Button("Close") { dismiss() } } }
        }
    }
    func send() async {
        if let c = carer.completion, c.rate < 0.7 { err = "\(carer.firstName) is not taking new bookings right now."; return }
        guard let uid = s.uid else { return }
        busy = true; err = ""; defer { busy = false }
        let day = Booking.fmt.string(from: date)
        do { try await Backend.createBooking(familyUid: uid, carerUid: carer.id, date: day, from: f.string(from: from), to: f.string(from: to), rate: carer.rate, note: note); done = true }
        catch { err = error.localizedDescription.contains("permission") ? "Please finish your profile first, then try again." : error.localizedDescription }
    }
}

struct SwipeCard: View {
    let person: Person; let tint: Color; let top: Bool; let offset: CGSize; let depth: Int; var match: MatchInfo? = nil
    var distance: Double? = nil
    var onMessage: () -> Void = {}; var onResume: (() -> Void)? = nil
    @State private var slide = 0
    @State private var showSet = false
    /// Photo slides first (profile photo, then gallery), then one description slide.
    var photos: [String] { person.allPhotos }
    var slideCount: Int { max(1, photos.count) + 1 }
    var onInfo: Bool { slide >= max(1, photos.count) }
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            RoundedRectangle(cornerRadius: 28).fill(Brand.field)
            if onInfo { infoSlide } else {
                PhotoView(key: photos.isEmpty ? "" : photos[min(slide, photos.count - 1)], size: 260, round: false, fallback: person.role.icon, fill: true).clipped().clipShape(RoundedRectangle(cornerRadius: 28))
                LinearGradient(colors: [.clear, .black.opacity(0.8)], startPoint: .center, endPoint: .bottom).clipShape(RoundedRectangle(cornerRadius: 28))
            }
            if top {
                HStack(spacing: 0) {
                    Color.clear.contentShape(Rectangle()).onTapGesture { slide = max(0, slide - 1) }.accessibilityHidden(true)
                    Color.clear.contentShape(Rectangle()).onTapGesture { slide = min(slideCount - 1, slide + 1) }.accessibilityIdentifier("nextSlide")
                }.padding(.bottom, 130)
            }
            if !onInfo && !photos.isEmpty && top {
                Button { showSet = true } label: { IconLabel(icon: .camera, text: "Photos", size: 15, color: Color(hex: 0x2D2A35)).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote).weight(.semibold)).padding(.horizontal, 12).padding(.vertical, 7).background(Brand.bunny).clipShape(Capsule()) }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing).padding(20).padding(.bottom, 118).accessibilityIdentifier("seePhotos")
            }
            if !onInfo {
                VStack(alignment: .leading, spacing: 6) {
                    Text(person.firstName).font(Brand.title(32))
                    HStack(spacing: 12) {
                        Text(person.role.name).foregroundStyle(Color(hex: 0x2D2A35)).padding(.horizontal, 10).padding(.vertical, 3).background(person.role.sign).clipShape(Capsule())
                        if person.rate > 0 { Text("\(Int(person.rate))/h") } else if person.budgetMax > 0 { Text("\(Int(person.budgetMax))/h") }
                        if let d = distance { IconLabel(icon: .pin, text: Geo.label(d), size: 15, color: .white) } else if !person.suburb.isEmpty { IconLabel(icon: .pin, text: person.suburb, size: 15, color: .white) }
                    }.font(.subheadline.weight(.semibold)).lineLimit(1)
                    if person.side == "carer" { Text(person.completionText).font(.footnote.weight(.semibold)) }
                    actions.padding(.top, 6)
                }.foregroundStyle(.white).padding(20)
            }
            HStack(spacing: 4) { ForEach(0..<slideCount, id: \.self) { i in Capsule().fill(i == slide ? Color.white : Color.white.opacity(0.4)).frame(height: 4) } }
        .fullScreenCover(isPresented: $showSet) { PhotoSetView(keys: photos, start: min(slide, max(0, photos.count - 1))) }
                .padding(.horizontal, 16).padding(.top, 12).frame(maxHeight: .infinity, alignment: .top).allowsHitTesting(false)
            if let mt = match { Text("\(mt.percent)%").font(.custom("Atkinson Hyperlegible", size: 17).weight(.heavy)).foregroundStyle(Brand.ink).padding(.horizontal, 12).padding(.vertical, 6).background(Brand.card).clipShape(Capsule()).accessibilityIdentifier("matchPercent").frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.horizontal, 16).padding(.top, 28).opacity(top && abs(offset.width) > 60 ? 0 : 1).allowsHitTesting(false) }
            if top {
                Text("MATCH").font(.custom("Atkinson Hyperlegible", size: 34).weight(.heavy)).foregroundStyle(Brand.bunny).padding(8).overlay(RoundedRectangle(cornerRadius: 10).stroke(Brand.bunny, lineWidth: 4)).rotationEffect(.degrees(-14)).opacity(max(0, min(1, Double(offset.width) / 100))).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(26).allowsHitTesting(false)
                Text("PASS").font(.custom("Atkinson Hyperlegible", size: 34).weight(.heavy)).foregroundStyle(.white).padding(8).overlay(RoundedRectangle(cornerRadius: 10).stroke(Brand.bunnyBlush, lineWidth: 4)).rotationEffect(.degrees(14)).opacity(max(0, min(1, Double(-offset.width) / 100))).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(26).allowsHitTesting(false)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
        .scaleEffect(1 - CGFloat(depth) * 0.05).offset(y: CGFloat(depth) * 14)
        .offset(x: offset.width, y: offset.height / 4).rotationEffect(.degrees(Double(offset.width) / 18))
    }
    /// Message and Send resume sit on the card itself.
    @ViewBuilder var actions: some View {
        if top { actionRow }
    }
    var actionRow: some View {
        HStack(spacing: 10) {
            pill("Message", .chat, onMessage)
            if let r = onResume { pill("Send resume", .doc, r) }
        }
    }
    func pill(_ t: String, _ i: BI, _ f: @escaping () -> Void) -> some View {
        Button(action: f) { IconLabel(icon: i, text: t, size: 18, color: Brand.ink).font(.custom("Atkinson Hyperlegible", size: 16).weight(.semibold)).foregroundStyle(Brand.ink).padding(.horizontal, 16).frame(minHeight: 44).background(Brand.card).clipShape(Capsule()) }.accessibilityLabel(t)
    }
    /// The description slide: about, kids, days needed, and why it matches. Plain facts only.
    var infoSlide: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(person.firstName).font(Brand.title(28)).foregroundStyle(Brand.ink).padding(.top, 22)
            if !person.about.isEmpty { Text(person.about).font(.custom("Atkinson Hyperlegible", size: 17)).foregroundStyle(Brand.ink).lineLimit(5) }
            else if !person.headline.isEmpty { Text(person.headline).font(.custom("Atkinson Hyperlegible", size: 17)).foregroundStyle(Brand.ink).lineLimit(3) }
            if !person.kids.isEmpty { IconLabel(icon: .child, text: person.kids.map { "\($0.name.isEmpty ? "Child" : $0.name), \($0.age)" }.joined(separator: "  "), size: 18) }
            if !person.days.isEmpty { IconLabel(icon: .calendar, text: person.side == "family" ? "Help needed: " + person.days.joined(separator: " ") : "Free: " + person.days.joined(separator: " "), size: 18) }
            if let mt = match, !mt.reasons.isEmpty {
                Text("Why it matches").font(.custom("Atkinson Hyperlegible", size: 15).weight(.semibold)).foregroundStyle(Brand.muted).padding(.top, 4)
                ForEach(Array(mt.reasons.enumerated()), id: \.offset) { _, r in IconLabel(icon: r.icon, text: r.text, size: 18) }
            }
            Spacer(minLength: 0)
            actions
        }.font(.custom("Atkinson Hyperlegible", size: 17)).padding(.horizontal, 20).padding(.bottom, 20).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}


/// Leave a review straight on a profile: stars plus optional words. Real reviews only, none invented.
struct ProfileReviewSheet: View {
    @EnvironmentObject var s: Session
    @Environment(\.dismiss) var dismiss
    let person: Person
    var onDone: () -> Void = {}
    @State private var stars = 5; @State private var text = ""; @State private var busy = false; @State private var err = ""
    var body: some View {
        NavigationStack {
            ScrollView { VStack(alignment: .leading, spacing: 14) {
                Text("Review \(person.firstName)").font(Brand.title(24)).foregroundStyle(Brand.titleColor)
                HStack(spacing: 8) { ForEach(1...5, id: \.self) { n in Button { stars = n } label: { BrandIcon(kind: .star, size: 34, color: n <= stars ? Brand.bunny : Brand.muted, mono: n <= stars) } } }.accessibilityIdentifier("reviewStars")
                TextField("Say something kind, if you like", text: $text, axis: .vertical).lineLimit(3...6).padding(12).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("reviewText")
                if !err.isEmpty { Text(err).foregroundStyle(Brand.ink) }
                BigButton("Put my review on their profile", busy: busy) { Task { await save() } }
                Text("Your first name stands beside your review.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
            }.padding(20) }
            .background(Brand.cream.ignoresSafeArea())
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Close") { dismiss() } } }
        }
    }
    func save() async {
        guard let me = s.me else { return }
        busy = true; err = ""
        do { try await Backend.addProfileReview(about: person.id, by: me.id, rating: stars, text: text); onDone(); dismiss() }
        catch { err = "Your review did not save. Please try again." }
        busy = false
    }
}
