import SwiftUI
import PhotosUI
import FirebaseAuth

/// Children: how many and how old. Ages only, never names.
struct RdKidsEditor: View {
    @Binding var ages: [Int]
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Stepper("Children: " + String(ages.count), onIncrement: { if ages.count < 8 { ages.append(3) } }, onDecrement: { if !ages.isEmpty { ages.removeLast() } })
                .font(RdF.bold(16)).padding(.horizontal, 20)
            ForEach(0..<ages.count, id: \.self) { i in
                Stepper("Child " + String(i + 1) + ": " + (ages[i] < 1 ? "under 1" : String(ages[i]) + (ages[i] == 1 ? " year" : " years")), value: $ages[i], in: 0...17)
                    .font(RdF.body(15)).padding(.horizontal, 20)
            }
            Text("Ages only. Never names or faces.").font(RdF.body(12)).foregroundColor(RdC.mut).padding(.horizontal, 20)
        }
    }
}

/// My profile: view and change everything in one short page.
struct RdLiveProfile: View {
    @EnvironmentObject var st: RdStore
    @State private var name = ""
    @State private var about = ""
    @State private var photoKey = ""
    @State private var rate = 40
    @State private var years = 0
    @State private var langs: [String] = []
    @State private var types: [String] = []
    @State private var picks: [PhotosPickerItem] = []
    @State private var busy = false
    @State private var msg = ""
    @State private var loaded = false
    var radiusBinding: Binding<[String]> { Binding(get: { [String(st.radius) + " km"] }, set: { v in st.radius = Int((v.first ?? "15 km").split(separator: " ").first ?? "15") ?? 15 }) }
    var countryBinding: Binding<[String]> { Binding(get: { [st.country] }, set: { st.country = $0.first ?? "Australia" }) }
    var homeBinding: Binding<[String]> { Binding(get: { st.home.isEmpty ? [] : [st.home] }, set: { st.home = $0.first ?? "" }) }
    var body: some View {
        let fam = st.isFamily
        let au = !fam && st.pickedCare == "aupair"
        VStack(spacing: 0) {
            RdHeader(title: "My profile")
            RdScroll {
                HStack {
                    PhotosPicker(selection: $picks, maxSelectionCount: 1, matching: .images) {
                        ZStack { RdRemotePhoto(key: photoKey).frame(width: 96, height: 96).clipShape(Circle()); if photoKey.isEmpty { RdIcon(name: "camera", size: 30) } }
                    }
                    Spacer()
                }.padding(.horizontal, 20).padding(.top, 4)
                .onChange(of: picks) { _, items in
                    guard let it = items.first else { return }
                    Task { if let d = try? await Media.load(it), let k = try? await Media.uploadSafe(d, kind: "avatar") { photoKey = k }; picks = [] }
                }
                RdInput(label: "Name", text: $name)
                RdInput(label: "Postcode", text: $st.postcode, keyboard: .numbersAndPunctuation)
                RdLabel(title: "Country")
                RdSelChips(items: RdVisaBy.destList, multi: false, sel: countryBinding)
                RdLabel(title: fam ? "How far should carers be?" : "How far can you travel?")
                RdSelChips(items: ["5 km", "10 km", "15 km", "25 km"], multi: false, sel: radiusBinding)
                RdLabel(title: fam ? "Looking for" : "I am a")
                RdSelChips(items: ["nanny", "babysitter", "au_pair"].map { RdLiveProfile.nice($0) }, multi: fam, max: 3, sel: Binding(get: { types.map { RdLiveProfile.nice($0) } }, set: { v in types = v.map { RdLiveProfile.raw($0) } }))
                if fam {
                    RdLabel(title: "Your children")
                    RdKidsEditor(ages: $st.kidsAges)
                } else {
                    RdLabel(title: "Your rate per hour")
                    Stepper("$" + String(rate), value: $rate, in: 15...120).font(RdF.bold(18)).padding(.horizontal, 20)
                    Stepper("Years with children: " + String(years), value: $years, in: 0...40).font(RdF.bold(16)).padding(.horizontal, 20)
                    RdLabel(title: "Languages")
                    RdSelChips(items: ["English", "Spanish", "German", "Mandarin", "Italian", "French", "Japanese", "Arabic"], multi: true, sel: $langs)
                }
                if au {
                    RdLabel(title: "Your home country")
                    RdSelChips(items: RdVisaBy.homeList, multi: false, sel: homeBinding)
                    RdLabel(title: "Where do you want to go?", sub: "Up to 3. First tap is your first choice.")
                    RdSelChips(items: RdVisaBy.destList, multi: true, max: 3, sel: $st.dests)
                }
                RdLabel(title: "About you", sub: "Up to 300 letters")
                RdInput(label: "A short hello", text: $about)
                if !fam { RdPayoutCard().padding(.top, 8); RdAskReview().padding(.top, 8) }
                if let me = RdLive.uid { RdTrust(uid: me).padding(.horizontal, 20).padding(.top, 8) }
                if !msg.isEmpty { Text(msg).font(RdF.body(13)).foregroundColor(msg.hasPrefix("Saved") ? RdC.okFg : RdC.ras).padding(.horizontal, 20).padding(.top, 6) }
            }
            RdBottomBar { RdCta(title: busy ? "Saving" : "Save") { save() } }
        }.task { await load() }
    }
    static func nice(_ r: String) -> String { return r == "au_pair" ? "Au pair" : r.capitalized }
    static func raw(_ l: String) -> String { return l == "Au pair" ? "au_pair" : l.lowercased() }
    func load() async {
        guard !loaded, let u = RdLive.uid, let p = await Backend.loadProfile(u) else { loaded = true; return }
        let fam0 = st.isFamily
        name = p.name == "Member" ? st.firstName : p.name
        about = p.about
        photoKey = p.photoKey
        if !p.postcode.isEmpty { st.postcode = p.postcode }
        types = p.services
        rate = Int(p.rate > 0 ? p.rate : 40)
        years = p.years
        langs = p.languages
        st.kidsAges = p.kids.map { $0.age }
        st.country = RdLive.country(p)
        st.radius = (p.card["maxDistanceKm"] as? NSNumber)?.intValue ?? st.radius
        if p.services.contains("au_pair") { st.home = RdLive.fromOf(p) == "abroad" ? "" : RdLive.fromOf(p); st.dests = RdLive.dests(p) }
        st.photoKey = p.photoKey; st.about = p.about; st.rate = fam0 ? 0 : Int(p.rate)
        loaded = true
    }
    func save() {
        guard let u = RdLive.uid else { msg = "Please sign in first."; return }
        if let pr = RdSafe.problem([about, name]) { msg = pr; st.err = pr; return }
        busy = true
        let fam = st.isFamily
        var card: [String: Any] = ["careTypes": types.isEmpty ? [RdLive.careType(st.pickedCare)] : types, "maxDistanceKm": st.radius, "auPairHost": ["country": st.country]]
        if fam { card["kids"] = st.kidsAges.prefix(8).map { ["ageYears": $0] }; card["ageGroups"] = RdLive.bands(st.kidsAges) }
        else { card["rate"] = Double(rate); card["experienceYears"] = years; card["languages"] = langs }
        if !fam && types.contains("au_pair") { card["auPair"] = ["homeCountry": st.home, "destinations": st.dests, "visaNotes": st.visa] as [String: Any]; card["auPairHost"] = ["country": st.home.isEmpty ? st.country : st.home] }
        Task {
            do {
                try await Backend.saveProfile(u, side: fam ? "family" : "carer", name: name.isEmpty ? "Member" : name, postcode: st.postcode, photoKey: photoKey.isEmpty ? nil : photoKey, about: about, card: card)
                st.firstName = name; st.origin = nil; st.about = about; st.photoKey = photoKey; st.rate = fam ? 0 : rate
                if let f = types.first { st.pickedCare = f == "au_pair" ? "aupair" : f }
                msg = "Saved."
            } catch { msg = "Could not save: " + error.localizedDescription }
            busy = false
        }
    }
}
