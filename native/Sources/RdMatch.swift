import Foundation

// Caresitters redesign: matching engine. A direct port of the tested matching.js.
// Rules: musts are hard lines, preferences score points, money never scores, visa never scores,
// the pair score is the average of both directions.

struct RdCheck { var name: String; var status: String; var statusText: String = ""; var date: String = "" }
struct RdKeyedCheck { var key: String; var check: RdCheck }
struct RdCert { var name: String; var status: String; var date: String }
struct RdVisa { var state: String = "unknown"; var type: String = ""; var text: String = ""; var arrives: String = ""; var rule: String = "" }

struct RdCarer: Identifiable {
    var id: String
    var role: String
    var name: String
    var also: [String] = []
    var age: Int = 0
    var nat: String = ""
    var suburb: String = ""
    var city: String = ""
    var lat: Double = 0
    var lng: Double = 0
    var from: String = ""
    var fromLon: Double = 0
    var fromLat: Double = 0
    var photos: [String] = []
    var captions: [String] = []
    var years: Int = 0
    var payFloor: Double = 0
    var payText: String = ""
    var headline: String = ""
    var bio: String = ""
    var checks: [RdKeyedCheck] = []
    var certs: [RdCert] = []
    var skills: [String] = []
    var tasks: [String] = []
    var languages: [String] = []
    var traits: [String] = []
    var approach: String = ""
    var activities: [String] = []
    var petsOk: Bool = true
    var availDays: [String] = []
    var availFrom: Double = 0
    var availTo: Double = 0
    var arriveFrom: Double = 0
    var arriveTo: Double = 0
    var maxMonths: Double = 6
    var maxHours: Double = 30
    var maxKm: Double? = nil
    var noPets: Bool = false
    var ownRoom: Bool = false
    var wantsTraits: [String] = []
    var wantsApproach: String? = nil
    var wantsHome: [String] = []
    var willing: [String]? = nil
    var visa: RdVisa = RdVisa()
    init(_ id: String, _ role: String, _ name: String) { self.id = id; self.role = role; self.name = name }
    func check(_ key: String) -> RdCheck? { checks.first(where: { $0.key == key })?.check }
    func cert(_ name: String) -> RdCert? { certs.first(where: { $0.name == name }) }
}

struct RdFamily: Identifiable {
    var id: String
    var kind: String
    var name: String
    var also: [String] = []
    var suburb: String = ""
    var city: String = ""
    var lat: Double = 0
    var lng: Double = 0
    var photos: [String] = []
    var captions: [String] = []
    var kids: String = ""
    var pets: Bool = false
    var petText: String = ""
    var headline: String = ""
    var bio: String = ""
    var needDays: [String] = []
    var needFrom: Double = 0
    var needTo: Double = 0
    var radiusKm: Double = 15
    var startFrom: Double = 0
    var startTo: Double = 0
    var months: Double = 6
    var hours: Double = 25
    var startText: String = ""
    var wantsLanguages: [String] = []
    var wantsTasks: [String] = []
    var wantsSkills: [String] = []
    var wantsTraits: [String] = []
    var wantsApproach: String? = nil
    var wantsActivities: [String] = []
    var mustCheck: String? = nil
    var mustSkills: [String] = []
    var mustPetsOk: Bool = false
    var mustNonSmoker: Bool = false
    var visaReady: Bool = false
    var payOffer: Double = 0
    var payUnit: String = "hour"
    var payText: String = ""
    var homeLanguages: [String] = []
    var climate: [String] = []
    var offersHome: [String] = []
    var start: String = ""
    var stay: String = ""
    init(_ id: String, _ kind: String, _ name: String) { self.id = id; self.kind = kind; self.name = name }
}

struct RdBucket { var key: String; var label: String; var weight: Int; var family: Int; var carer: Int }
struct RdEss { var key: String; var label: String; var ok: Bool; var detail: String }

struct RdResult {
    var pct: Int
    var label: String
    var forFamily: Int
    var forCarer: Int
    var km: Double?
    var buckets: [RdBucket]
    var essentials: [RdEss]
    var unmet: [RdEss]
    var passes: Bool
    var reasons: [String]
    var reasonsCarer: [String]
    var gaps: [String]
}

struct RdRanked { var carer: RdCarer; var m: RdResult }

enum RdMatch {
    static let keys: [String] = ["availability", "style", "skills", "language", "place", "activities"]
    static let defaultWeights: [String: Double] = ["availability": 25, "style": 20, "skills": 20, "language": 15, "place": 10, "activities": 10]
    static let labels: [String: String] = ["availability": "Days and times", "style": "Care style", "skills": "Skills and tasks", "language": "Language", "place": "Distance", "activities": "Activities"]
    static let labelsAuPair: [String: String] = ["availability": "Start, stay and hours", "style": "Care style", "skills": "Skills and tasks", "language": "Language", "place": "Home and extras", "activities": "Activities"]

    // ----- small helpers -----
    static func inter(_ a: [String], _ b: [String]) -> [String] { return a.filter { b.contains($0) } }
    static func listText(_ a: [String]) -> String {
        if a.count <= 1 { return a.joined() }
        return a.dropLast().joined(separator: ", ") + " and " + (a.last ?? "")
    }
    static func clamp01(_ x: Double) -> Double { return max(0, min(1, x)) }
    static func rnd(_ x: Double) -> Int { return Int(x.rounded()) }
    static func numText(_ x: Double) -> String {
        let r = (x * 10).rounded() / 10
        if r == r.rounded() { return String(Int(r)) }
        return String(r)
    }
    static func hourText(_ h: Double) -> String {
        let hh = Int(floor(h))
        let mm = Int(((h - Double(hh)) * 60).rounded())
        let ap = hh >= 12 ? "pm" : "am"
        let h12 = hh % 12 == 0 ? 12 : hh % 12
        var s = String(h12)
        if mm != 0 { s += ":" + (mm < 10 ? "0" : "") + String(mm) }
        return s + ap
    }
    static func daysText(_ d: [String]) -> String { return d.count == 7 ? "every day" : d.joined(separator: " ") }
    static func capital(_ s: String) -> String { return s.prefix(1).uppercased() + s.dropFirst() }
    static func lc(_ s: String) -> String { return s.lowercased() }
    static func lcs(_ a: [String]) -> [String] { return a.map { $0.lowercased() } }
    static func unique(_ a: [String]) -> [String] { var o: [String] = []; for x in a { if !o.contains(x) { o.append(x) } }; return o }

    static func haversineKm(_ aLat: Double, _ aLng: Double, _ bLat: Double, _ bLng: Double) -> Double {
        let R = 6371.0
        let dLat = (bLat - aLat) * Double.pi / 180
        let dLng = (bLng - aLng) * Double.pi / 180
        let x = sin(dLat / 2) * sin(dLat / 2) + cos(aLat * Double.pi / 180) * cos(bLat * Double.pi / 180) * sin(dLng / 2) * sin(dLng / 2)
        return R * 2 * atan2(x.squareRoot(), (1 - x).squareRoot())
    }

    static func normalise(_ w: [String: Double]?) -> [String: Double] {
        var out: [String: Double] = [:]
        var sum = 0.0
        for k in keys {
            var v = defaultWeights[k] ?? 0
            if let w = w, let x = w[k], x >= 0 { v = x }
            out[k] = v
            sum += v
        }
        if sum == 0 { return defaultWeights }
        for k in keys { out[k] = (out[k] ?? 0) * 100 / sum }
        return out
    }

    // ----- bucket scorers -----
    struct Part { var s: Double; var why: String = ""; var gap: String = "" }

    static func timesCover(_ fam: RdFamily, _ car: RdCarer) -> (s: Double, daysOk: Int, daysAll: Int) {
        if fam.needDays.isEmpty { return (1, 0, 0) }
        var total = 0.0, covered = 0.0
        var daysOk = 0
        for d in fam.needDays {
            let want = fam.needTo - fam.needFrom
            total += want
            if car.availDays.contains(d) {
                let ov = max(0, min(fam.needTo, car.availTo) - max(fam.needFrom, car.availFrom))
                covered += ov
                if ov >= want - 0.01 { daysOk += 1 }
            }
        }
        return (total > 0 ? covered / total : 1, daysOk, fam.needDays.count)
    }

    static func availability(_ fam: RdFamily, _ car: RdCarer) -> Part {
        if fam.kind == "aupair" {
            let overlapStart = max(fam.startFrom, car.arriveFrom)
            let overlapEnd = min(fam.startTo, car.arriveTo)
            let startFit = overlapEnd >= overlapStart ? 1.0 : clamp01(1 - (overlapStart - overlapEnd) / 45)
            let stayFit = clamp01(car.maxMonths / fam.months)
            let hoursFit = car.maxHours >= fam.hours ? 1.0 : clamp01(car.maxHours / fam.hours)
            let s = 0.4 * startFit + 0.3 * stayFit + 0.3 * hoursFit
            var why = "", gap = ""
            if startFit == 1 && hoursFit == 1 { why = "Can start " + fam.startText + " and work " + numText(fam.hours) + " hours a week" }
            if stayFit < 1 { gap = "Can stay " + numText(car.maxMonths) + " months, you asked for " + numText(fam.months) }
            return Part(s: s, why: why, gap: gap)
        }
        let r = timesCover(fam, car)
        var why = "", gap = ""
        if r.s >= 0.99 { why = "Free " + daysText(fam.needDays) + ", " + hourText(fam.needFrom) + " to " + hourText(fam.needTo) + ", the times you need" }
        else if r.s > 0 { gap = "Free on " + String(r.daysOk) + " of " + String(r.daysAll) + " days you need" }
        else { gap = "Not free on the days you need" }
        return Part(s: r.s, why: why, gap: gap)
    }

    static func style(_ fam: RdFamily, _ car: RdCarer) -> Part {
        let shared = inter(fam.wantsTraits, car.traits)
        let approachMatch = fam.wantsApproach == nil || fam.wantsApproach == car.approach
        let tScore = fam.wantsTraits.isEmpty ? 1.0 : Double(shared.count) / Double(fam.wantsTraits.count)
        let s = 0.55 * tScore + 0.45 * (approachMatch ? 1.0 : 0.35)
        var why = ""
        if !shared.isEmpty, let ap = fam.wantsApproach, approachMatch { why = capital(listText(shared)) + ", and follows " + ap }
        else if !shared.isEmpty { why = capital(listText(shared)) + ", the feel you picked" }
        else if let ap = fam.wantsApproach, approachMatch { why = "Follows " + ap + ", like your home" }
        var gap = ""
        if let ap = fam.wantsApproach, !approachMatch { gap = "Style is " + car.approach + ", you picked " + ap }
        return Part(s: s, why: why, gap: gap)
    }

    static func skills(_ fam: RdFamily, _ car: RdCarer) -> Part {
        let asked = unique(fam.wantsTasks + fam.wantsSkills)
        if asked.isEmpty { return Part(s: 1) }
        let have = inter(asked, car.skills + car.tasks)
        let missing = asked.filter { !have.contains($0) }
        return Part(s: Double(have.count) / Double(asked.count),
                    why: have.isEmpty ? "" : "Has " + listText(lcs(have)) + ", as you asked",
                    gap: missing.isEmpty ? "" : "Does not list " + listText(lcs(missing)))
    }

    static func language(_ fam: RdFamily, _ car: RdCarer) -> Part {
        let want = fam.wantsLanguages
        if want.isEmpty { return Part(s: 1) }
        let shared = inter(want, car.languages)
        let s = Double(shared.count) / Double(want.count)
        var why = ""
        if !shared.isEmpty {
            why = "Speaks " + listText(shared)
            if !inter(fam.homeLanguages, shared).isEmpty { why += " with your family" }
        }
        let miss = want.filter { !shared.contains($0) }
        return Part(s: s, why: why, gap: miss.isEmpty ? "" : "No " + listText(miss))
    }

    static func place(_ fam: RdFamily, _ car: RdCarer, _ km: Double?) -> Part {
        if fam.kind == "aupair" {
            let wants = car.wantsHome
            if wants.isEmpty { return Part(s: 1) }
            let have = inter(wants, fam.offersHome)
            let miss = wants.filter { !fam.offersHome.contains($0) }
            return Part(s: Double(have.count) / Double(wants.count),
                        why: have.isEmpty ? "" : "Home offers " + listText(lcs(have)) + ", as the au pair hopes",
                        gap: miss.isEmpty ? "" : "Home does not list " + listText(lcs(miss)))
        }
        let d = km ?? 0
        let r = fam.radiusKm
        let s = d <= r * 0.4 ? 1.0 : clamp01(1 - (d - r * 0.4) / (r * 0.6))
        return Part(s: s, why: d <= r ? "Lives " + numText(d) + " km away" : "", gap: d > r ? numText(d) + " km away, outside your " + numText(r) + " km" : "")
    }

    static func activities(_ fam: RdFamily, _ car: RdCarer) -> Part {
        let w = fam.wantsActivities
        if w.isEmpty { return Part(s: 1) }
        let sh = inter(w, car.activities)
        return Part(s: Double(sh.count) / Double(w.count), why: sh.isEmpty ? "" : "Loves " + listText(lcs(sh)) + " with children")
    }

    // ----- essentials -----
    static func essentials(_ fam: RdFamily, _ car: RdCarer, _ km: Double?) -> [RdEss] {
        var out: [RdEss] = []
        if let mc = fam.mustCheck {
            let chk = car.check(mc)
            let ok = chk?.status == "verified"
            var detail = "No check shown"
            if let c = chk { detail = c.status == "verified" ? c.name + ", checked " + c.date : c.name + ", " + c.statusText }
            out.append(RdEss(key: "check", label: chk?.name ?? "Safety check", ok: ok, detail: detail))
        }
        for sk in fam.mustSkills {
            let has = car.skills.contains(sk)
            let cert = car.cert(sk)
            let ok = has && (cert == nil || cert?.status != "expired")
            var detail = has ? "Listed" : "Not listed"
            if let c = cert { detail = c.status == "expired" ? "Expired " + c.date : "Sighted " + c.date }
            out.append(RdEss(key: sk, label: sk, ok: ok, detail: detail))
        }
        if fam.mustPetsOk { out.append(RdEss(key: "pets", label: "Happy around pets", ok: car.petsOk, detail: car.petsOk ? "Happy around pets" : "Prefers no pets")) }
        if fam.payOffer > 0 {
            let ok = fam.payOffer >= car.payFloor
            let d = fam.payUnit == "week" ? "$" + numText(fam.payOffer) + " a week offered, floor $" + numText(car.payFloor) : "$" + numText(fam.payOffer) + " an hour offered, rate $" + numText(car.payFloor)
            out.append(RdEss(key: "pay", label: "Pay", ok: ok, detail: d))
        }
        if let mk = car.maxKm, let d = km, fam.kind != "aupair" {
            out.append(RdEss(key: "distance", label: "Travel distance", ok: d <= mk, detail: numText(d) + " km, limit " + numText(mk) + " km"))
        }
        if car.noPets && fam.pets { out.append(RdEss(key: "carerPets", label: "Pets at home", ok: false, detail: "Family has a pet, carer prefers none")) }
        if car.ownRoom && fam.kind == "aupair" { out.append(RdEss(key: "room", label: "Own room", ok: fam.offersHome.contains("Own room"), detail: "Own room")) }
        return out
    }

    // ----- the reverse direction -----
    static func reverse(_ fam: RdFamily, _ car: RdCarer, _ km: Double?, _ W: [String: Double]) -> (parts: [String: Double], total: Double) {
        let aupair = fam.kind == "aupair"
        var p: [String: Double] = [:]
        p["availability"] = aupair ? availability(fam, car).s : timesCover(fam, car).s
        let cwT = car.wantsTraits
        let tShare = cwT.isEmpty ? 1.0 : Double(inter(cwT, fam.climate).count) / Double(cwT.count)
        let apOk = car.wantsApproach == nil || car.wantsApproach == fam.wantsApproach
        p["style"] = 0.55 * tShare + 0.45 * (apOk ? 1.0 : 0.35)
        let asked = unique(fam.wantsTasks + fam.wantsSkills)
        let willing = car.willing ?? (car.skills + car.tasks)
        p["skills"] = asked.isEmpty ? 1.0 : Double(inter(asked, willing).count) / Double(asked.count)
        let hl = fam.homeLanguages.isEmpty ? ["English"] : fam.homeLanguages
        p["language"] = inter(hl, car.languages).isEmpty ? 0.3 : 1.0
        if aupair {
            let wh = car.wantsHome
            p["place"] = wh.isEmpty ? 1.0 : Double(inter(wh, fam.offersHome).count) / Double(wh.count)
        } else {
            let lim = car.maxKm ?? 20
            let d = km ?? 0
            p["place"] = d <= lim * 0.5 ? 1.0 : clamp01(1 - (d - lim * 0.5) / (lim * 0.8))
        }
        let fa = fam.wantsActivities
        p["activities"] = fa.isEmpty ? 1.0 : Double(inter(fa, car.activities).count) / Double(fa.count)
        var total = 0.0
        for k in keys { total += (W[k] ?? 0) * (p[k] ?? 0) }
        return (p, total)
    }

    static func carerReasons(_ fam: RdFamily, _ car: RdCarer, _ km: Double?, _ p: [String: Double], _ ess: [RdEss]) -> [String] {
        var out: [String] = []
        let aupair = fam.kind == "aupair"
        if aupair { if (p["availability"] ?? 0) >= 0.85 { out.append("Start date and weekly hours fit what you are hoping for") } }
        else if (p["availability"] ?? 0) >= 0.99 { out.append("Their days and hours fit yours: " + daysText(fam.needDays) + ", " + hourText(fam.needFrom) + " to " + hourText(fam.needTo)) }
        if ess.contains(where: { $0.key == "pay" && $0.ok }) {
            let offer = fam.payUnit == "week" ? "$" + numText(fam.payOffer) + " a week" : "$" + numText(fam.payOffer) + " an hour"
            let above = fam.payUnit == "week" ? "floor of $" + numText(car.payFloor) : "rate of $" + numText(car.payFloor)
            out.append("They offer " + offer + ", above your " + above)
        }
        let sh = inter(fam.homeLanguages.isEmpty ? ["English"] : fam.homeLanguages, car.languages)
        if !sh.isEmpty { out.append("You share " + listText(sh) + " at home") }
        let tsh = inter(car.wantsTraits, fam.climate)
        if !tsh.isEmpty { out.append("They like " + listText(lcs(tsh)) + " too, just like you") }
        if aupair {
            let hs = inter(car.wantsHome, fam.offersHome)
            if !hs.isEmpty { out.append("Home offers " + listText(lcs(hs))) }
        } else if let d = km { out.append(numText(d) + " km from you") }
        let asked = unique(fam.wantsTasks + fam.wantsSkills)
        let wl = car.willing ?? (car.skills + car.tasks)
        let ok = inter(asked, wl)
        if !ok.isEmpty { out.append("They ask for " + listText(lcs(ok)) + ", which you offer") }
        return Array(out.prefix(4))
    }

    // ----- the public function -----
    static func score(_ fam: RdFamily, _ car: RdCarer, weights: [String: Double]? = nil) -> RdResult {
        let W = normalise(weights)
        let km: Double? = (fam.lat != 0 && car.lat != 0) ? haversineKm(fam.lat, fam.lng, car.lat, car.lng) : nil
        let aupair = fam.kind == "aupair"
        var parts: [String: Part] = [:]
        parts["availability"] = availability(fam, car)
        parts["style"] = style(fam, car)
        parts["skills"] = skills(fam, car)
        parts["language"] = language(fam, car)
        parts["place"] = place(fam, car, km)
        parts["activities"] = activities(fam, car)
        var forFamily = 0.0
        for k in keys { forFamily += (W[k] ?? 0) * (parts[k]?.s ?? 0) }
        let rev = reverse(fam, car, km, W)
        let pair = (forFamily + rev.total) / 2
        let ess = essentials(fam, car, km)
        var unmet = ess.filter { !$0.ok }
        if fam.visaReady && car.visa.state != "ready" { unmet.append(RdEss(key: "visa", label: "Visa ready", ok: false, detail: car.visa.text.isEmpty ? "Visa not ready yet" : car.visa.text)) }
        var reasons: [String] = []
        var gaps: [String] = []
        let order = keys.enumerated().sorted { (a, b) -> Bool in
            let sa = (W[a.element] ?? 0) * (parts[a.element]?.s ?? 0)
            let sb = (W[b.element] ?? 0) * (parts[b.element]?.s ?? 0)
            if sa != sb { return sa > sb }
            return a.offset < b.offset
        }.map { $0.element }
        for k in order {
            if let p = parts[k] {
                if !p.why.isEmpty && reasons.count < 4 { reasons.append(p.why) }
                if !p.gap.isEmpty { gaps.append(p.gap) }
            }
        }
        let rc = carerReasons(fam, car, km, rev.parts, ess)
        let pct = rnd(pair)
        let label = pct >= 90 ? "Perfect Pair" : pct >= 80 ? "Strong Fit" : pct >= 65 ? "Good Fit" : "Possible"
        let lab = aupair ? labelsAuPair : labels
        var buckets: [RdBucket] = []
        for k in keys {
            buckets.append(RdBucket(key: k, label: lab[k] ?? k, weight: rnd(W[k] ?? 0), family: rnd((parts[k]?.s ?? 0) * 100), carer: rnd((rev.parts[k] ?? 0) * 100)))
        }
        return RdResult(pct: pct, label: label, forFamily: rnd(forFamily), forCarer: rnd(rev.total), km: km, buckets: buckets,
                        essentials: ess, unmet: unmet, passes: unmet.isEmpty, reasons: reasons, reasonsCarer: rc, gaps: gaps)
    }

    static func rank(_ fam: RdFamily, _ pool: [RdCarer], weights: [String: Double]? = nil) -> (matches: [RdRanked], nearly: [RdRanked]) {
        var rows: [RdRanked] = pool.filter { $0.role == fam.kind }.map { RdRanked(carer: $0, m: score(fam, $0, weights: weights)) }
        rows.sort { (a, b) -> Bool in
            if a.m.pct != b.m.pct { return a.m.pct > b.m.pct }
            return (a.m.km ?? 0) < (b.m.km ?? 0)
        }
        return (rows.filter { $0.m.passes }, rows.filter { !$0.m.passes })
    }
}
