import SwiftUI
import PhotosUI
import FirebaseAuth
import FirebaseFirestore

// MARK: Photos. Private files, kept under the care space. Same file service the web app uses.

struct PickedPhoto: Transferable {
    let data: Data
    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(importedContentType: .image) { d in PickedPhoto(data: d) }
    }
}

enum SpaceMedia {
    static let base = "https://caresits-files.placenciailse.workers.dev"
    @MainActor static var cache: [String: URL] = [:]

    /// Same rule as the web app: a photo key must live under this care space and nowhere else.
    static func isKey(_ key: String, forSpace spaceId: String) -> Bool {
        spaceId.range(of: "^[A-Za-z0-9_-]{1,128}$", options: .regularExpression) != nil
            && key.hasPrefix("spaces/\(spaceId)/") && key.count > "spaces/\(spaceId)/".count && !key.contains("..")
    }

    static func load(_ item: PhotosPickerItem) async throws -> Data {
        if let d = try? await item.loadTransferable(type: Data.self), !d.isEmpty { return d }
        if let p = try? await item.loadTransferable(type: PickedPhoto.self), !p.data.isEmpty { return p.data }
        throw CareError(message: "This photo could not be opened. If it is in iCloud, wait for it to download, or pick another.")
    }

    /// Shrinks to 1600 px and saves as JPEG. That also removes location and camera details.
    static func prepare(_ data: Data) throws -> Data {
        guard let img = UIImage(data: data) else { throw CareError(message: "That picture could not be opened.") }
        let longest = max(img.size.width, img.size.height)
        guard longest > 0 else { throw CareError(message: "That picture could not be opened.") }
        let scale = min(1, 1600 / longest)
        let size = CGSize(width: max(1, img.size.width * scale), height: max(1, img.size.height * scale))
        let fmt = UIGraphicsImageRendererFormat(); fmt.scale = 1; fmt.opaque = true
        let out = UIGraphicsImageRenderer(size: size, format: fmt).image { _ in img.draw(in: CGRect(origin: .zero, size: size)) }
        var q: CGFloat = 0.84
        while q > 0.2 { if let j = out.jpegData(compressionQuality: q), j.count < 1_500_000 { return j }; q -= 0.15 }
        throw CareError(message: "That picture is too big.")
    }

    static func randomId() -> String { String((0..<20).map { _ in "abcdef0123456789".randomElement() ?? "0" }) }

    static func call(_ body: [String: Any]) async throws -> [String: Any] {
        guard let user = Auth.auth().currentUser else { throw CareError(message: "Please sign in again.") }
        let token = try await user.getIDToken()
        guard let endpoint = URL(string: base + "/v1/link") else { throw CareError(message: "The photo service address is wrong.") }
        var req = URLRequest(url: endpoint)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200, let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw CareError(message: "The photo service said no (code \(code)). Please try again.")
        }
        return json
    }

    /// One automatic retry for a network hiccup. A clear refusal is not retried.
    static func uploadSafe(_ raw: Data, spaceId: String) async throws -> String {
        do { return try await upload(raw, spaceId: spaceId) }
        catch let e as CareError { throw e }
        catch { try? await Task.sleep(nanoseconds: 800_000_000); return try await upload(raw, spaceId: spaceId) }
    }

    /// Returns the file key to save with the photo record.
    static func upload(_ raw: Data, spaceId: String) async throws -> String {
        guard let uid = Auth.auth().currentUser?.uid else { throw CareError(message: "Please sign in again.") }
        let jpg = try prepare(raw)
        let name = "photo-\(randomId()).jpg"
        let wanted = "spaces/\(spaceId)/gallery/\(name)"
        let link = try await call(["class": "space-media", "name": name, "ownerUid": uid, "spaceId": spaceId,
                                   "bytes": jpg.count, "contentType": "image/jpeg", "op": "put"])
        guard let urlStr = link["url"] as? String, let url = URL(string: urlStr) else { throw CareError(message: "The photo service gave no upload link.") }
        let key = (link["key"] as? String) ?? wanted
        guard isKey(key, forSpace: spaceId) else { throw CareError(message: "The photo service picked a place outside this care space.") }
        var put = URLRequest(url: url); put.httpMethod = "PUT"
        for (h, v) in (link["headers"] as? [String: String]) ?? ["content-type": "image/jpeg"] where h.lowercased() != "content-length" { put.setValue(v, forHTTPHeaderField: h) }
        let (_, resp) = try await URLSession.shared.upload(for: put, from: jpg)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else { throw CareError(message: "The photo could not be saved (code \(code)).") }
        return key
    }

    @MainActor static func url(for key: String) async -> URL? {
        if key.isEmpty { return nil }
        if let c = cache[key] { return c }
        guard let uid = Auth.auth().currentUser?.uid,
              let link = try? await call(["op": "get", "key": key, "ownerUid": uid]),
              let s = link["url"] as? String, let u = URL(string: s) else { return nil }
        cache[key] = u
        return u
    }
}

// MARK: Pieces

/// Drawn stand in for a photo: soft sage tile, the bunny, a small picture mark. Never a stock photo.
struct PhotoPlaceholder: View {
    var loading = false
    var body: some View {
        ZStack {
            Brand.sage.opacity(0.35)
            VStack(spacing: 6) {
                BunnyView(size: 56)
                if loading { ProgressView() } else { CareIcon(name: "photo", size: 26) }
            }
        }
    }
}

struct SpacePhoto: View {
    let key: String
    var height: CGFloat = 200
    @State private var url: URL? = nil
    @State private var tried = false
    var body: some View {
        ZStack {
            if let url = url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    case .failure: PhotoPlaceholder()
                    default: PhotoPlaceholder(loading: true)
                    }
                }
            } else {
                PhotoPlaceholder(loading: !tried)
            }
        }
        .frame(maxWidth: .infinity).frame(height: height).clipped()
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .accessibilityElement(children: .ignore).accessibilityLabel("Care photo")
        .task(id: key) { url = await SpaceMedia.url(for: key); tried = true }
    }
}

/// Choose a photo from the phone, shrink it, send it to this care space, and hand back its key.
struct PhotoAddButton: View {
    let spaceId: String
    var title = "Choose a photo"
    var onKey: (String) -> Void
    var onError: (String) -> Void
    @State private var pick: PhotosPickerItem? = nil
    @State private var working = false
    var body: some View {
        PhotosPicker(selection: $pick, matching: .images) {
            Pill(title: working ? "Sending the photo" : title, icon: "photo", on: false)
        }
        .disabled(working)
        .onChange(of: pick) { item in
            guard let item = item else { return }
            pick = nil; working = true
            Task {
                do { let d = try await SpaceMedia.load(item); let k = try await SpaceMedia.uploadSafe(d, spaceId: spaceId); onKey(k) }
                catch { onError(error.localizedDescription) }
                working = false
            }
        }
    }
}

// MARK: Gallery data (careSpaces/{id}/gallery)

struct GalleryItem: Identifiable, Equatable {
    var id: String
    var key: String
    var kind: String
    var by: String
    var at: Date
    var childId: String?
    var sharedByParent: Bool
}

extension CareRepo {
    /// A parent reads everything. Anyone else reads only what a parent shared, and only photos with no child or a shared child photo.
    static func loadGallery(spaceId: String, role: CareRole) async throws -> [GalleryItem] {
        let ref = space(spaceId).collection("gallery")
        let snap = role == .admin ? try await ref.getDocuments() : try await ref.whereField("sharedByParent", isEqualTo: true).getDocuments()
        let items: [GalleryItem] = snap.documents.compactMap { d in
            let m = d.data()
            guard let key = m["key"] as? String, let at = date(m["at"]) else { return nil }
            let child = (m["childId"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            return GalleryItem(id: d.documentID, key: key, kind: m["kind"] as? String ?? "photo", by: m["by"] as? String ?? "", at: at,
                               childId: child, sharedByParent: m["sharedByParent"] as? Bool ?? false)
        }
        return items.filter { role == .admin || $0.childId == nil || $0.sharedByParent }.sorted { $0.at > $1.at }
    }

    static func addGalleryPhoto(spaceId: String, key: String, childId: String?, by uid: String) async throws -> GalleryItem {
        guard SpaceMedia.isKey(key, forSpace: spaceId) else { throw CareError(message: "This file does not belong to this care space.") }
        let ref = space(spaceId).collection("gallery").document()
        var data: [String: Any] = ["key": key, "kind": "photo", "by": uid, "at": FieldValue.serverTimestamp(),
                                   "sharedByParent": childId == nil]
        if let c = childId, !c.isEmpty { data["childId"] = c }
        _ = try await commit { done in ref.setData(data, completion: done) }
        return GalleryItem(id: ref.documentID, key: key, kind: "photo", by: uid, at: Date(), childId: childId, sharedByParent: childId == nil)
    }

    static func setGalleryShared(spaceId: String, itemId: String, shared: Bool, role: CareRole) async throws {
        guard CareAccess.canShareGallery(role) else { throw CareError(message: "Only a parent can change photo sharing.") }
        let ref = space(spaceId).collection("gallery").document(itemId)
        _ = try await commit(wait: 8) { done in ref.updateData(["sharedByParent": shared], completion: done) }
    }
}

// MARK: Gallery page (a pushed page, never a sheet)

struct GalleryView: View {
    let space: SpaceSummary
    var child: ChildProfile? = nil
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @State private var items: [GalleryItem] = []
    @State private var loading = true
    @State private var error = ""
    @State private var note = ""
    @State private var busyId = ""
    var canRead: Bool { CareAccess.canSeePhotos(space.role, space.perms) }
    var shown: [GalleryItem] { items.filter { child == nil || $0.childId == nil || $0.childId == child?.id } }

    var body: some View {
        Screen {
            Heading(text: child.map { "\($0.name)'s photos" } ?? "Photos")
            BodyText(text: "Private. A parent decides what is shared.", muted: true)
            if !error.isEmpty { Notice(text: error, warn: true) }
            if !note.isEmpty { Notice(text: note) }
            if !canRead {
                EmptyState(title: "Photo access is off", detail: "Ask a parent to open photos for you in this care space.")
            } else {
                if s.uid != nil {
                    PhotoAddButton(spaceId: space.id, onKey: { add($0) }, onError: { error = $0 })
                }
                if loading { ProgressView().frame(maxWidth: .infinity).padding(20) }
                else if shown.isEmpty { EmptyState(title: "No photos yet", detail: "Photos you add will show here.") }
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                    ForEach(shown) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            if item.kind == "video" { PhotoPlaceholder().frame(height: 140).clipShape(RoundedRectangle(cornerRadius: 16)) }
                            else { SpacePhoto(key: item.key, height: 140) }
                            Text(item.at.shortDay).font(Brand.body(14)).foregroundStyle(th.theme.muted)
                            if item.childId == nil { Text("Shared with this space").font(Brand.body(14)).foregroundStyle(th.theme.text) }
                            else if item.sharedByParent { Text("Shared with family").font(Brand.body(14)).foregroundStyle(th.theme.text) }
                            else if space.role == .admin { Text("Private until a parent shares it").font(Brand.body(14)).foregroundStyle(th.theme.muted) }
                            if CareAccess.canShareGallery(space.role), item.childId != nil {
                                Button { toggle(item) } label: { Pill(title: item.sharedByParent ? "Stop sharing" : "Share with family", on: false) }
                                    .buttonStyle(.plain).disabled(busyId == item.id)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Photos").navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
    }

    func reload() async {
        guard canRead else { loading = false; return }
        do { items = try await CareRepo.loadGallery(spaceId: space.id, role: space.role); error = "" }
        catch { self.error = "Could not load photos for this care space." }
        loading = false
    }

    func add(_ key: String) {
        guard let uid = s.uid else { error = "Sign in again before adding a photo."; return }
        error = ""; note = ""
        Task {
            do { let item = try await CareRepo.addGalleryPhoto(spaceId: space.id, key: key, childId: child?.id, by: uid)
                items.insert(item, at: 0)
                note = child == nil ? "Photo added to this private care space." : "Photo added. It stays private until a parent shares it." }
            catch { self.error = "The photo uploaded, but could not be added to this gallery." }
        }
    }

    func toggle(_ item: GalleryItem) {
        busyId = item.id; error = ""; note = ""
        Task {
            do { try await CareRepo.setGalleryShared(spaceId: space.id, itemId: item.id, shared: !item.sharedByParent, role: space.role)
                if let i = items.firstIndex(where: { $0.id == item.id }) { items[i].sharedByParent.toggle() }
                note = item.sharedByParent ? "Photo is private again." : "Photo shared with the family." }
            catch { self.error = "Could not change sharing. Ask a parent admin to try again." }
            busyId = ""
        }
    }
}
