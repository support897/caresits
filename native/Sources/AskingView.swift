import SwiftUI
import FirebaseFirestore

/// Build 181 item 2, the asking. Family side: what type of care are you looking for, and your ideal candidate.
/// Carer side: what type of care work are you looking for, and your ideal family. Icon picks only, one tap ticks a pick.
/// Every pick stands on both sides as a pair (same pick, same key) so the two sides can match.
struct TickCard: View {
    let label: String; var icon: BI? = nil; let on: Bool; let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                BrandIcon(kind: icon ?? (on ? .checkCircle : .circle), size: 26, color: Color(hex: 0xC2345B))
                Text(label).font(.custom("Atkinson Hyperlegible", size: 14).weight(.bold)).multilineTextAlignment(.center).foregroundStyle(Brand.ink)
                    .lineLimit(3).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 84).padding(.horizontal, 6).padding(.vertical, 8)
            .background(on ? Brand.blush : Brand.paleGround)
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(on ? Brand.bunny : Brand.bunnyBlush, lineWidth: 2))
            .overlay(alignment: .topTrailing) {
                if on { BrandIcon(kind: .check, size: 12, color: .white).padding(4).background(Color(hex: 0xC2345B)).clipShape(Circle()).padding(6) }
            }
            .clipShape(RoundedRectangle(cornerRadius: 18))
        }.buttonStyle(.plain)
        .accessibilityLabel(label).accessibilityValue(on ? "ticked" : "not ticked").accessibilityIdentifier("tick-\(label)")
    }
}

/// Where a pick is saved.
enum PickHome {
    case list(String, String)       // card key, the value this pick adds to that list
    case flag(String)               // card key, a bool
    case aid                        // coded first aid pair: F21 on the family side, C22 on the carer side
    case device                     // DEVICE ONLY (UserDefaults), no sealed home, EXCLUDED from scoring
    case chips([String], String?)   // one choice among chips; card key (a number) or nil for device only
    case langs                      // the which one picker, saved to card languages
    case country                    // carer: own country on card.nationality. family: chosen countries on looking prefs or musts nationality
    case countryOnly                // family: the chosen countries become a must (looking.musts.nationality) instead of a pref
}
struct Pick: Identifiable { let id: String; let label: String; let icon: BI; let home: PickHome }
struct PickSection: Identifiable { let id: String; let title: String; let note: String; let picks: [Pick] }

enum Asking {
    static let nationalities = ["Australian", "Filipino", "Colombian", "Brazilian", "German", "French", "British", "Irish", "Spanish", "Italian", "Dutch", "Polish", "Japanese", "Korean", "Chinese", "Indian", "Indonesian", "Thai", "Vietnamese", "South African", "New Zealander", "Canadian", "American", "Another background"]
    static let languages = ["English", "Spanish", "Mandarin", "Cantonese", "Hindi", "Arabic", "Vietnamese", "Italian", "Greek", "French", "German", "Filipino"]
    static func sections(_ side: String) -> [PickSection] {
        let fam = side == "family"
        let care = [
            Pick(id: "montessori", label: "Montessori", icon: .blocks, home: .list("routineStyle", "Montessori")),
            Pick(id: "strict", label: "Strict", icon: .ruler, home: .list("routineStyle", "Strict")),
            Pick(id: "flexible", label: "Flexible", icon: .bend, home: .list("routineStyle", "Flexible")),
            Pick(id: "dancing", label: "Dancing", icon: .dance, home: .list("activities", "Dancing")),
            Pick(id: "swimming", label: "Swimming", icon: .swim, home: .list("activities", "Swimming")),
            Pick(id: "homework", label: "Homework help", icon: .book, home: .list("tasks", "Homework help")),
            Pick(id: "cooking", label: "Cooking", icon: .pot, home: .flag("cooking")),
            fam ? Pick(id: "pets", label: "Pets at home", icon: .paw, home: .flag("pets")) : Pick(id: "pets", label: "Fine with pets", icon: .paw, home: .flag("petsOk")),
            Pick(id: "languages", label: "Languages", icon: .globe, home: .langs),
        ]
        let who = [
            Pick(id: "calm", label: "Calm", icon: .calm, home: .list("personality", "Calm")),
            Pick(id: "playful", label: "Playful", icon: .balloon, home: .list("personality", "Playful")),
            Pick(id: "gentle", label: "Gentle", icon: .gentle, home: .list("personality", "Gentle")),
            Pick(id: "firm", label: "Firm", icon: .firm, home: .list("personality", "Firm")),
            Pick(id: "outdoorsy", label: "Outdoorsy", icon: .tree, home: .list("personality", "Outdoorsy")),
            Pick(id: "musical", label: "Musical", icon: .note, home: .list("personality", "Musical")),
            Pick(id: "licence", label: "Driving licence", icon: .licence, home: .flag("drives")),
            Pick(id: "owncar", label: "Own car", icon: .car, home: .flag("ownCar")),
            Pick(id: "firstaid", label: "First aid", icon: .firstAid, home: .aid),
            Pick(id: "cpr", label: "CPR", icon: .cpr, home: .device),
            Pick(id: "education", label: "Education", icon: .cap, home: .device),
        ]
        let aupair = (fam ? [Pick(id: "country", label: "Countries you welcome", icon: .passport, home: .country), Pick(id: "countryonly", label: "Only these countries", icon: .shield, home: .countryOnly)] : [Pick(id: "country", label: "My country", icon: .passport, home: .country)]) + [
            Pick(id: "ownroom", label: "Own room", icon: .door, home: .device),
            Pick(id: "ownbath", label: "Own bathroom", icon: .bath, home: .device),
            Pick(id: "sharedbath", label: "Shared bathroom", icon: .shower, home: .device),
            Pick(id: "fullboard", label: "Full board", icon: .plate, home: .device),
            Pick(id: "pocket", label: "Pocket money", icon: .rate, home: .chips(["$100", "$150", "$200", "$250", "$300"], fam ? "payOffered" : "payFloor")),
            Pick(id: "hours", label: "Weekly hours", icon: .clock, home: .chips(["20 hours", "25 hours", "30 hours", "35 hours", "40 hours", "45 hours"], nil)),
            Pick(id: "daysoff", label: "Days off", icon: .calendar, home: .chips(["1 day", "1.5 days", "2 days"], nil)),
            Pick(id: "weekend", label: "Weekend off a month", icon: .weekend, home: .device),
            Pick(id: "holiday", label: "Paid holiday", icon: .suitcase, home: .device),
            Pick(id: "stay", label: "Stay length", icon: .hourglass, home: .chips(["3 months", "6 months", "9 months", "12 months"], nil)),
            Pick(id: "start", label: "Start window", icon: .flag, home: .chips(["As soon as possible", "In a month", "In 3 months"], nil)),
            Pick(id: "agreement", label: "Duties in writing", icon: .doc, home: .device),
            Pick(id: "usecar", label: "Use of car", icon: .key, home: .device),
            Pick(id: "phone", label: "Phone help", icon: .phone, home: .device),
            Pick(id: "flexhours", label: "Flexible hours", icon: .loop, home: .device),
            Pick(id: "bonus", label: "Completion bonus", icon: .gift, home: .device),
            Pick(id: "course", label: "Language course help", icon: .chat, home: .device),
            Pick(id: "transport", label: "Transport help", icon: .bus, home: .device),
        ]
        return [
            PickSection(id: "care", title: fam ? "What type of care are you looking for" : "What type of care work are you looking for", note: "Tick what fits.", picks: care),
            PickSection(id: "who", title: fam ? "Your ideal candidate" : "Your ideal family", note: fam ? "Tick what you want in a carer." : "Tick what you bring, so we can match you.", picks: who),
            PickSection(id: "aupair", title: "Au pair", note: fam ? "Tick what your family offers an au pair." : "Tick what you look for as an au pair.", picks: aupair),
        ]
    }
    static func codedAid(_ side: String) -> String { side == "family" ? "F21" : "C22" }
}

struct AskingView: View {
    @EnvironmentObject var s: Session
    @State private var lists: [String: [String]] = [:]
    @State private var flags: [String: Bool] = [:]
    @State private var nums: [String: Int] = [:]
    @State private var aid = false
    @State private var natMine: String? = nil
    @State private var natList: [String] = []
    @State private var natOnly = false
    @State private var dev: [String: Any] = [:]       // DEVICE ONLY picks and chips
    @State private var open: Set<String> = []
    @State private var saveErr = ""
    @State private var chain: Task<Void, Never>? = nil
    var side: String { s.me?.side ?? "family" }

    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 18) {
            Text("Tick what you are asking for.").font(Brand.title(28)).foregroundStyle(Brand.titleColor).frame(maxWidth: .infinity, alignment: .center).accessibilityIdentifier("askingTitle")
            Text("One tap ticks a pick. No typing.").font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)).foregroundStyle(Brand.muted).frame(maxWidth: .infinity, alignment: .center)
            if !saveErr.isEmpty { Text(saveErr).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.ink).padding(.horizontal, 20) }
            ForEach(Asking.sections(side)) { sec in
                VStack(alignment: .leading, spacing: 10) {
                    Text(sec.title).font(Brand.title(20)).foregroundStyle(Brand.titleColor).padding(.horizontal, 20)
                    Text(sec.note).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted).padding(.horizontal, 20)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                        ForEach(sec.picks) { p in TickCard(label: p.label, icon: p.icon, on: isOn(p)) { tap(p) } }
                    }.padding(.horizontal, 20)
                    ForEach(sec.picks.filter { open.contains($0.id) }) { p in chipRow(p).padding(.horizontal, 20) }
                }.accessibilityIdentifier("sec-\(sec.id)")
            }
        }.padding(.vertical, 16).padding(.bottom, 100) }
        .background(Brand.cream.ignoresSafeArea())
        .task { await load() }
    }

    // MARK: chips (languages: which one; amounts and lengths as picks)
    func options(_ p: Pick) -> [String] { if case .chips(let o, _) = p.home { return o }; if case .country = p.home { return Asking.nationalities }; return Asking.languages }
    @ViewBuilder func chipRow(_ p: Pick) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(p.home.isLangs ? "Which one" : (p.home.isCountry ? "Which country" : p.label)).font(.footnote.weight(.semibold)).foregroundStyle(Brand.muted)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 8)], alignment: .leading, spacing: 8) {
                ForEach(options(p), id: \.self) { o in
                    let on = chipOn(p, o)
                    Button { chip(p, o) } label: {
                        Text(o).font(.footnote.weight(.semibold)).padding(.horizontal, 12).padding(.vertical, 8).frame(maxWidth: .infinity)
                            .background(on ? Brand.blush : Brand.paleGround).foregroundStyle(Brand.ink)
                            .overlay(Capsule().stroke(on ? Brand.bunny : Brand.bunnyBlush, lineWidth: 1.5)).clipShape(Capsule())
                    }.buttonStyle(.plain).accessibilityLabel(o).accessibilityValue(on ? "ticked" : "not ticked").accessibilityIdentifier("chip-\(p.id)-\(o)")
                }
            }
        }
    }
    func chipOn(_ p: Pick, _ o: String) -> Bool {
        switch p.home {
        case .langs: return (lists["languages"] ?? []).contains(o)
        case .country: return side == "family" ? natList.contains(o) : natMine == o
        case .chips(_, let key): if let key { return nums[key].map { String($0) == o.filter(\.isNumber) } ?? false }; return (dev[p.id] as? String) == o
        default: return false
        }
    }
    func chip(_ p: Pick, _ o: String) {
        switch p.home {
        case .langs:
            var l = lists["languages"] ?? []; if let i = l.firstIndex(of: o) { l.remove(at: i) } else { l.append(o) }
            lists["languages"] = l; persist("languages", l.isEmpty ? nil : l)
        case .country:
            if side == "family" { if let i = natList.firstIndex(of: o) { natList.remove(at: i) } else { natList.append(o) }; writeLooking() }
            else { natMine = natMine == o ? nil : o; persist("nationality", natMine) }
        case .chips(_, let key):
            if let key {
                if chipOn(p, o) { nums[key] = nil; persist(key, nil) } else if let n = Int(o.filter(\.isNumber)) { nums[key] = n; persist(key, n) }
            } else { if (dev[p.id] as? String) == o { dev[p.id] = nil } else { dev[p.id] = o }; saveDevice() }
        default: break
        }
    }

    // MARK: ticking
    func isOn(_ p: Pick) -> Bool {
        switch p.home {
        case .list(let k, let v): return (lists[k] ?? []).contains(v)
        case .flag(let k): return flags[k] ?? false
        case .aid: return aid
        case .device: return (dev[p.id] as? Bool) ?? false
        case .chips(_, let key): if let key { return nums[key] != nil }; return dev[p.id] is String
        case .langs: return !(lists["languages"] ?? []).isEmpty
        case .country: return side == "family" ? !natList.isEmpty : natMine != nil
        case .countryOnly: return natOnly
        }
    }
    func tap(_ p: Pick) {
        switch p.home {
        case .list(let k, let v):
            var l = lists[k] ?? []; if let i = l.firstIndex(of: v) { l.remove(at: i) } else { l.append(v) }
            lists[k] = l; persist(k, l.isEmpty ? nil : l)
        case .flag(let k):
            let on = !(flags[k] ?? false); flags[k] = on; persist(k, on ? true : nil)
        case .aid:
            aid.toggle(); writeAid(aid)
        case .device:
            dev[p.id] = (dev[p.id] as? Bool) == true ? nil : true; saveDevice()
        case .countryOnly:
            natOnly.toggle(); writeLooking()
        case .chips, .langs, .country:
            if open.contains(p.id) { open.remove(p.id) } else { open.insert(p.id) }
        }
    }

    // MARK: saving
    /// Card key picks: saved under the card's own named key. Writes run one after another so none overwrites another.
    func persist(_ key: String, _ v: Any?) {
        guard let uid = s.uid else { return }
        let prev = chain
        chain = Task {
            await prev?.value
            do { try await Backend.saveProfile(uid, card: [key: v ?? FieldValue.delete()]); saveErr = "" } catch { saveErr = "Could not save that pick. Try again." }
        }
    }
    /// Family chosen countries: looking.prefs.nationality, or looking.musts.nationality when "Only these countries" is ticked. Sealed keys, no new key.
    func writeLooking() {
        guard let uid = s.uid else { return }
        let v: Any = natList.isEmpty ? FieldValue.delete() : natList
        let gone: Any = FieldValue.delete()
        let patch: [String: [String: Any]] = natOnly ? ["musts": ["nationality": v], "prefs": ["nationality": gone]] : ["prefs": ["nationality": v], "musts": ["nationality": gone]]
        let prev = chain
        chain = Task {
            await prev?.value
            do { try await Backend.saveProfile(uid, looking: patch); saveErr = "" } catch { saveErr = "Could not save that pick. Try again." }
        }
    }
    /// First aid rides its coded pair at profiles/{uid}/answers/{code}: F21 family, C22 carer. Keys only bucket, v, s, feed.
    func writeAid(_ on: Bool) {
        guard let uid = s.uid else { return }
        let code = Asking.codedAid(side), fam = side == "family"
        let prev = chain
        chain = Task {
            await prev?.value
            if on {
                do { try await AnswerStore.write(uid, code: code, v: fam ? "Must have" : "Yes, a general first aid certificate", strength: fam ? "must" : nil, feed: ""); saveErr = "" } catch { saveErr = "Could not save that pick. Try again." }
            } else { await AnswerStore.remove(uid, code: code) }
        }
    }
    /// DEVICE ONLY: CPR, Education and the au pair living picks have no sealed home. They stay in UserDefaults and are EXCLUDED from scoring until a rules amendment is sealed.
    func saveDevice() { if let uid = s.uid { AnswerStore.saveLocal(uid, dev) } }

    func load() async {
        guard let uid = s.uid else { return }
        dev = AnswerStore.loadLocal(uid)
        let card = (await Backend.loadProfile(uid))?.card ?? s.me?.card ?? [:]
        for k in ["personality", "routineStyle", "activities", "languages", "tasks"] { if let l = card[k] as? [String] { lists[k] = l } }
        for k in ["drives", "ownCar", "cooking", "pets", "petsOk"] { if let b = card[k] as? Bool { flags[k] = b } }
        for k in ["payOffered", "payFloor"] { if let n = card[k] as? Int { nums[k] = n } else if let n = card[k] as? NSNumber { nums[k] = n.intValue } }
        let me = await Backend.loadProfile(uid)
        natMine = me?.nationality.isEmpty == false ? me?.nationality : nil
        let mu = me?.looking["musts"] as? [String: Any], pr = me?.looking["prefs"] as? [String: Any]
        if let l = mu?["nationality"] as? [String], !l.isEmpty { natList = l; natOnly = true } else if let l = pr?["nationality"] as? [String] { natList = l; natOnly = false }
        let remote = await AnswerStore.loadAll(uid)
        aid = remote[Asking.codedAid(side)] != nil
    }
}
extension PickHome {
    var isLangs: Bool { if case .langs = self { return true }; return false }
    var isCountry: Bool { if case .country = self { return true }; return false }
}
