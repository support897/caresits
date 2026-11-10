import SwiftUI
import UIKit

#if DEBUG
import ImageIO
import UniformTypeIdentifiers
import FirebaseAuth
import FirebaseFirestore

/// Test only (never in the shipped Release build). Runs the REAL photo path against the live file service with a
/// big phone style photo that carries Exif and GPS, then reads the served bytes back and reports what is in them.
extension Media {
    static func samplePhoto(heic: Bool) -> Data? {
        let w = 4032, h = 3024
        let fmt = UIGraphicsImageRendererFormat(); fmt.scale = 1; fmt.opaque = true
        let img = UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: fmt).image { c in
            UIColor(red: 0.55, green: 0.78, blue: 0.95, alpha: 1).setFill(); c.fill(CGRect(x: 0, y: 0, width: w, height: h / 2))
            UIColor(red: 0.35, green: 0.65, blue: 0.40, alpha: 1).setFill(); c.fill(CGRect(x: 0, y: h / 2, width: w, height: h / 2))
            UIColor.yellow.setFill(); c.cgContext.fillEllipse(in: CGRect(x: 3000, y: 300, width: 500, height: 500))
            UIColor(red: 0.96, green: 0.66, blue: 0.74, alpha: 1).setFill(); c.cgContext.fillEllipse(in: CGRect(x: 1300, y: 900, width: 1400, height: 1400))
            UIColor(red: 0.12, green: 0.30, blue: 0.27, alpha: 1).setFill(); c.cgContext.fillEllipse(in: CGRect(x: 1750, y: 1350, width: 150, height: 150)); c.cgContext.fillEllipse(in: CGRect(x: 2150, y: 1350, width: 150, height: 150))
        }
        guard let cg = img.cgImage else { return nil }
        let d = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(d, (heic ? UTType.heic : UTType.jpeg).identifier as CFString, 1, nil) else { return nil }
        let props: [CFString: Any] = [
            kCGImageDestinationLossyCompressionQuality: 0.9,
            kCGImagePropertyOrientation: 6,
            kCGImagePropertyExifDictionary: [kCGImagePropertyExifDateTimeOriginal: "2026:11:09 10:00:00", kCGImagePropertyExifLensModel: "iPhone back camera"],
            kCGImagePropertyTIFFDictionary: [kCGImagePropertyTIFFMake: "Apple", kCGImagePropertyTIFFModel: "iPhone"],
            kCGImagePropertyGPSDictionary: [kCGImagePropertyGPSLatitude: 27.4698, kCGImagePropertyGPSLatitudeRef: "S", kCGImagePropertyGPSLongitude: 153.0251, kCGImagePropertyGPSLongitudeRef: "E"],
        ]
        CGImageDestinationAddImage(dest, cg, props as CFDictionary)
        return CGImageDestinationFinalize(dest) ? d as Data : nil
    }
    static func props(_ d: Data) -> (gps: Bool, exif: Bool, w: Int, h: Int) {
        guard let src = CGImageSourceCreateWithData(d as CFData, nil), let p = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any] else { return (false, false, 0, 0) }
        return (p[kCGImagePropertyGPSDictionary] != nil, p[kCGImagePropertyExifDictionary] != nil, (p[kCGImagePropertyPixelWidth] as? Int) ?? 0, (p[kCGImagePropertyPixelHeight] as? Int) ?? 0)
    }
    /// PUT bytes straight to a fresh upload link and report the status code (negative control: the old, unstripped bytes).
    static func rawPutStatus(_ jpg: Data) async -> String {
        guard let uid = Auth.auth().currentUser?.uid else { return "no user" }
        do {
            let name = "avatar-ctl\(randomId()).jpg"
            let link = try await call(["class": "user-media", "name": name, "ownerUid": uid, "bytes": jpg.count, "contentType": "image/jpeg", "op": "put"])
            guard let s = link["url"] as? String, let u = URL(string: s) else { return "no link" }
            var put = URLRequest(url: u); put.httpMethod = "PUT"; put.setValue("image/jpeg", forHTTPHeaderField: "content-type")
            let (data, resp) = try await URLSession.shared.upload(for: put, from: jpg)
            return "\((resp as? HTTPURLResponse)?.statusCode ?? 0) \(String(data: data, encoding: .utf8) ?? "")"
        } catch { return "error \(error.localizedDescription)" }
    }
    static func proof() async -> (report: String, key: String?, ok: Bool) {
        var L: [String] = []; var avatarKey: String?; var allOK = true
        for heic in [false, true] {
            let tag = heic ? "HEIC" : "JPEG"
            guard let raw = samplePhoto(heic: heic) else { L.append("\(tag): sample could not be built (skipped)"); continue }
            let pin = props(raw)
            L.append("\(tag) in: \(raw.count) bytes, \(pin.w)x\(pin.h), GPS \(pin.gps), Exif \(pin.exif)")
            // Old behaviour: plain redraw + jpegData, no strip.
            if let ui = UIImage(data: raw) {
                let f = UIGraphicsImageRendererFormat(); f.scale = 1; f.opaque = true; f.preferredRange = .standard
                let sz = CGSize(width: 1600, height: 1200)
                let redraw = UIGraphicsImageRenderer(size: sz, format: f).image { _ in ui.draw(in: CGRect(origin: .zero, size: sz)) }
                if let old = redraw.jpegData(compressionQuality: 0.84) {
                    L.append("\(tag) old path (no strip): blocks \(metadataBlocks(old)), PUT -> \(await rawPutStatus(old))")
                }
            }
            do {
                let prepared = try prepare(raw)
                let pb = metadataBlocks(prepared); let pp = props(prepared)
                L.append("\(tag) new path prepared: \(prepared.count) bytes, \(pp.w)x\(pp.h), blocks \(pb), GPS \(pp.gps), Exif \(pp.exif)")
                let key = try await uploadPreparedSafe(prepared, kind: heic ? "gallery" : "avatar")
                if !heic { avatarKey = key }
                let served = try await servedBytes(key)
                let sb = metadataBlocks(served); let sp = props(served)
                let same = served == prepared
                let decodes = UIImage(data: served) != nil
                L.append("\(tag) SAVED key \(key.split(separator: "/").suffix(2).joined(separator: "/")): served \(served.count) bytes, \(sp.w)x\(sp.h), blocks \(sb), GPS \(sp.gps), Exif \(sp.exif), identical to prepared \(same), decodes \(decodes)")
                if !(sb.isEmpty && !sp.gps && !sp.exif && decodes) { allOK = false }
            } catch { L.append("\(tag) FAILED: \(error.localizedDescription)"); allOK = false }
        }
        L.append(allOK ? "PROOF OK" : "PROOF FAILED")
        return (L.joined(separator: "\n"), avatarKey, allOK)
    }
}

/// Test only. Builds a real family and carer pair on the live backend with the app's own code (profile, booking,
/// carer accepts), then the family sends a big sample photo through the real chat photo path (Backend.sendPhoto).
/// After that the normal app opens as the family, so the test walks Messages, the chat, back, and the chat again.
struct ChatProofGate: View {
    @EnvironmentObject var s: Session
    @State private var ready = false
    @State private var status = "chat proof: starting"
    @State private var famEmail = ""; @State private var carEmail = ""; @State private var pw = ""
    var body: some View {
        if ready {
            ZStack(alignment: .topTrailing) {
                RootGate()
                Button("proofCleanup") { Task { await cleanup() } }.font(.system(size: 8)).opacity(0.02).accessibilityIdentifier("proofCleanup")
            }
        } else {
            Text(status).font(.system(size: 11, design: .monospaced)).accessibilityIdentifier("chatProof").padding()
                .task { await run() }
        }
    }
    func fail(_ m: String) { status = "chat proof FAILED: " + m; try? status.write(toFile: "/Users/ilseplacencia/Apps/nativeproj/pics/chat-proof.txt", atomically: true, encoding: .utf8) }
    func run() async {
        var L: [String] = []
        let t = Int(Date().timeIntervalSince1970); let carName = "Proof" + String(t % 100000); L.append("carer name: " + carName); pw = "Cp-\(t)-Zq9x"
        famEmail = "projects.reports.ilse+chatprooff\(t)@gmail.com"; carEmail = "projects.reports.ilse+chatproofc\(t)@gmail.com"
        do {
            try await s.email(carEmail, pw, create: true)
            guard let cu = Auth.auth().currentUser?.uid else { return fail("no carer uid") }
            let sched: [String: Any] = ["Mon": ["from": "09:00", "to": "17:00"], "Tue": ["from": "09:00", "to": "17:00"], "Wed": ["from": "09:00", "to": "17:00"]]
            try await Backend.saveProfile(cu, side: "carer", name: carName, postcode: "2000", about: "Calm, caring nanny with a love for outdoor play.", card: ["careTypes": ["nanny"], "rate": 35, "suburb": "Sydney", "headline": "Calm nanny, outdoor play", "experienceYears": 4, "availability": sched, "maxDistanceKm": 25])
            try? await Backend.saveResume(cu, Resume(summary: "Nanny for four years", jobs: ["Nanny, two families, Sydney"], education: [], skills: ["First aid", "Cooking"], certificates: []))
            L.append("carer account + profile ok")
            try? Auth.auth().signOut(); try await Task.sleep(nanoseconds: 1_500_000_000)
            try await s.email(famEmail, pw, create: true)
            guard let fu = Auth.auth().currentUser?.uid else { return fail("no family uid") }
            try await Backend.saveProfile(fu, side: "family", name: "Proof" + String(t % 100000) + " Family", postcode: "2010", about: "Two kids, busy weekdays, need a calm helper.", card: ["careTypes": ["nanny"], "suburb": "Surry Hills", "budgetMax": 40, "kids": [["name": "Mia", "ageYears": 3], ["name": "Leo", "ageYears": 6]], "scheduleNeed": ["Mon": ["from": "09:00", "to": "12:00"], "Tue": ["from": "09:00", "to": "12:00"]], "maxDistanceKm": 25])
            let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
            try await Backend.createBooking(familyUid: fu, carerUid: cu, date: f.string(from: Date().addingTimeInterval(3 * 86400)), from: "09:00", to: "12:00", rate: 35, note: "chat photo proof")
            L.append("family account + profile + booking ok")
            try? Auth.auth().signOut(); try await Task.sleep(nanoseconds: 1_500_000_000)
            try await s.email(carEmail, pw, create: false)
            let bs = await Backend.bookings(cu, side: "carer")
            guard let b = bs.first else { return fail("carer sees no booking") }
            try await Backend.transition(b, to: "accepted", actorUid: cu, actorIsCarer: true)
            L.append("carer accepted, chat open")
            try? Auth.auth().signOut(); try await Task.sleep(nanoseconds: 1_500_000_000)
            try await s.email(famEmail, pw, create: false)
            let rels = await Backend.relationships(fu, side: "family")
            guard let rel = rels.first(where: { $0.state == "contact" || $0.state == "hired" }) else { return fail("no open chat") }
            guard let raw = Media.samplePhoto(heic: false) else { return fail("no sample photo") }
            let pin = Media.props(raw)
            L.append("sample photo in: \(raw.count) bytes, GPS \(pin.gps), Exif \(pin.exif)")
            try await Backend.sendPhoto(rel.id, from: fu, raw: raw)
            L.append("chat photo SENT through Backend.sendPhoto (Media.prepare strip route)")
            // read the message back and read the served bytes
            let snap = try await Firestore.firestore().collection("relationships").document(rel.id).collection("messages").getDocuments()
            guard let m = snap.documents.first(where: { ($0.data()["kind"] as? String) == "photo" }), let key = m.data()["mediaKey"] as? String else { return fail("photo message not found") }
            let served = try await Media.servedBytes(key)
            let sb = Media.metadataBlocks(served); let sp = Media.props(served)
            L.append("message stored kind photo, key \(key.split(separator: "/").suffix(2).joined(separator: "/")), served \(served.count) bytes, blocks \(sb), GPS \(sp.gps), Exif \(sp.exif), decodes \(UIImage(data: served) != nil)")
            let ok = sb.isEmpty && !sp.gps && !sp.exif && UIImage(data: served) != nil
            L.append(ok ? "CHAT PROOF OK" : "CHAT PROOF FAILED")
            let rep = L.joined(separator: "\n"); status = rep
            try? rep.write(toFile: "/Users/ilseplacencia/Apps/nativeproj/pics/chat-proof.txt", atomically: true, encoding: .utf8)
            if ProcessInfo.processInfo.environment["CS_CHATPROOF_END"] == "carer" { try? Auth.auth().signOut(); try await Task.sleep(nanoseconds: 1_500_000_000); try await s.email(carEmail, pw, create: false); try await Task.sleep(nanoseconds: 2_000_000_000)
                let rr = await Backend.relationships(cu, side: "carer"); L.append("carer sees relationships: " + rr.map { "\($0.id.prefix(6)) \($0.state) fam \($0.familyUid.prefix(6)) car \($0.carerUid.prefix(6))" }.joined(separator: "; ") + " | me.side \(s.meSafe.side) uid \(cu.prefix(6)) fu \(fu.prefix(6))")
                try? L.joined(separator: "\n").write(toFile: "/Users/ilseplacencia/Apps/nativeproj/pics/chat-proof.txt", atomically: true, encoding: .utf8) }
            await s.reload(); ready = true
        } catch { fail(error.localizedDescription + " | " + L.joined(separator: "; ")) }
    }
    func cleanup() async {
        try? await Backend.deleteAccount(Auth.auth().currentUser?.uid ?? "")
        try? Auth.auth().signOut(); try? await Task.sleep(nanoseconds: 1_500_000_000)
        if (try? await s.email(carEmail, pw, create: false)) != nil { try? await Backend.deleteAccount(Auth.auth().currentUser?.uid ?? "") }
        try? Auth.auth().signOut()
    }
}

struct IconGallery: View {
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Text("Caresitters icons").font(Brand.title(24))
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 12) {
                ForEach(BI.allCases, id: \.self) { k in VStack(spacing: 4) { BrandIcon(kind: k, size: 36); Text(k.rawValue).font(.system(size: 9)) } }
            }
            Text("Solid star and heart").font(.footnote)
            HStack(spacing: 18) { BrandIcon(kind: .star, size: 30, color: .orange, solid: true); BrandIcon(kind: .heart, size: 30, color: Brand.bunny, solid: true); Stars(count: 4) }
            Text("Bunny moods (tap, drag a finger, wait)").font(.footnote)
            BunnyMoodsRow()
            HStack { BunnyView(size: 120, mood: .celebrate); BunnyView(size: 120, mood: .think) }
            Text("Large celebrate bunny").font(.footnote)
            BunnyView(size: 300, mood: .celebrate).padding(.bottom, 40)
        }.padding(16) }.background(Color.white)
    }
}

struct PhotoProofBadge: View {
    @EnvironmentObject var s: Session
    @State private var text = ""
    var body: some View {
        Group {
            Text(text.isEmpty ? "proof idle" : text).font(.system(size: 9, design: .monospaced)).accessibilityIdentifier("photoProof").padding(6).opacity(text.isEmpty ? 0 : 1).frame(height: text.isEmpty ? 0 : nil)
        }.task {
            guard ProcessInfo.processInfo.environment["CS_PHOTOPROOF"] == "1", text.isEmpty else { return }
            text = "running"
            try? "started".write(toFile: "/Users/ilseplacencia/Apps/nativeproj/pics/photo-proof-start.txt", atomically: true, encoding: .utf8)
            let r = await Media.proof()
            if let k = r.key, let uid = s.uid { try? await Backend.saveProfile(uid, photoKey: k); await s.reload() }
            text = r.report
            try? r.report.write(toFile: "/Users/ilseplacencia/Apps/nativeproj/pics/photo-proof.txt", atomically: true, encoding: .utf8)
        }
    }
}
#else
struct PhotoProofBadge: View { var body: some View { EmptyView() } }
#endif
