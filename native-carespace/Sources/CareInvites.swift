import SwiftUI
import FirebaseFirestore

// MARK: Invites and join with code. A port of the web app's data/invites.ts.
// Only a parent admin makes an invite. An invite is for one person, lasts 7 days, and never makes an admin.

enum CareInvite {
    /// No I, L, O, 0 or 1, so a code is easy to read out loud.
    static let alphabet = Array("ABCDEFGHJKMNPQRSTUVWXYZ23456789")
    static let codeLength = 8
    static let days = 7

    static func clean(_ v: String) -> String { v.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() }
    static func isCode(_ v: String) -> Bool {
        let c = clean(v)
        return c.count == codeLength && c.allSatisfy { alphabet.contains($0) }
    }
    static func makeCode() -> String {
        var g = SystemRandomNumberGenerator()
        return String((0..<codeLength).map { _ in alphabet.randomElement(using: &g) ?? "A" })
    }

    struct Target: Equatable { var spaceId: String; var code: String }

    /// Accepts the full join code "spaceId.CODE", or the invite link with spaceId and code in it.
    static func parse(_ input: String) -> Target? {
        let value = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.isEmpty { return nil }
        if let comps = URLComponents(string: value), comps.scheme != nil, let items = comps.queryItems {
            let space = items.first { $0.name == "spaceId" }?.value ?? items.first { $0.name == "space" }?.value ?? ""
            let code = clean(items.first { $0.name == "code" }?.value ?? "")
            return !space.isEmpty && isCode(code) ? Target(spaceId: space, code: code) : nil
        }
        guard let dot = value.lastIndex(of: "."), dot != value.startIndex else { return nil }
        let space = String(value[value.startIndex..<dot]).trimmingCharacters(in: .whitespaces)
        let code = clean(String(value[value.index(after: dot)...]))
        return !space.isEmpty && isCode(code) ? Target(spaceId: space, code: code) : nil
    }

    static func link(spaceId: String, code: String) -> String {
        var c = URLComponents(string: "https://caresits.xyz/join")
        c?.queryItems = [URLQueryItem(name: "spaceId", value: spaceId), URLQueryItem(name: "code", value: code)]
        return c?.string ?? "https://caresits.xyz/join"
    }

    /// Starting access for each role. The web core package is not in the pack, so these are a safe reading:
    /// medicine is closed for everyone but a parent, and the parent sees and can change every box before the invite is made.
    static func defaultPerms(_ role: CareRole) -> CarePerms {
        switch role {
        case .admin: return .all
        case .regular: return CarePerms(allergies: true, medication: false, photos: true, calendar: true, privateMessages: true)
        case .limited: return CarePerms(allergies: false, medication: false, photos: false, calendar: true, privateMessages: true)
        case .viewer: return CarePerms(allergies: false, medication: false, photos: true, calendar: true, privateMessages: false)
        }
    }
    static func effective(_ role: CareRole, _ p: CarePerms) -> CarePerms {
        if role == .admin { return .all }
        var x = p
        if role == .viewer { x.privateMessages = false }
        return x
    }
    static func permsData(_ p: CarePerms) -> [String: Any] {
        ["allergies": p.allergies, "medication": p.medication, "photos": p.photos, "calendar": p.calendar, "privateMessages": p.privateMessages]
    }
}

struct InviteFailure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

extension CareRepo {
    struct MadeInvite { var code: String; var expiresAt: Date }

    static func createInvite(spaceId: String, by uid: String, role: CareRole, perms: CarePerms) async throws -> MadeInvite {
        guard !uid.isEmpty, !spaceId.isEmpty else { throw InviteFailure(message: "Please sign in again.") }
        let me = try await space(spaceId).collection("members").document(uid).getDocument()
        let m = me.data() ?? [:]
        guard me.exists, (m["status"] as? String ?? "active") == "active", (m["role"] as? String) == "admin" else {
            throw InviteFailure(message: "Only a parent admin can create invites.")
        }
        guard role != .admin else { throw InviteFailure(message: "An invite cannot make someone an admin.") }
        let expires = Date().addingTimeInterval(Double(CareInvite.days) * 86400)
        let data: [String: Any] = ["spaceId": spaceId, "role": role.rawValue, "perms": CareInvite.permsData(CareInvite.effective(role, perms)),
                                   "createdBy": uid, "createdAt": FieldValue.serverTimestamp(), "expiresAt": Timestamp(date: expires), "usedBy": NSNull()]
        for _ in 0..<5 {
            let code = CareInvite.makeCode()
            let ref = db.collection("careSpaceInvites").document(code)
            do {
                _ = try await db.runTransaction { (tx, errPtr) -> Any? in
                    do {
                        if try tx.getDocument(ref).exists { throw InviteFailure(message: "code-collision") }
                        tx.setData(data, forDocument: ref)
                        return true
                    } catch { errPtr?.pointee = error as NSError; return nil }
                }
                return MadeInvite(code: code, expiresAt: expires)
            } catch {
                if error.localizedDescription == "code-collision" { continue }
                throw InviteFailure(message: "The invite could not be made. Check your connection and parent access.")
            }
        }
        throw InviteFailure(message: "The invite could not be made. Please try again.")
    }

    /// Joins with an invite. The saved name is used as is. An empty saved name stops here, with no stand in name.
    static func joinWithInvite(_ target: CareInvite.Target, uid: String, myName: String) async throws -> (role: CareRole, spaceName: String, spaceId: String) {
        let name = myName.trimmingCharacters(in: .whitespaces)
        guard !uid.isEmpty, CareInvite.isCode(target.code), !target.spaceId.isEmpty else { throw InviteFailure(message: "Enter the full join code or invite link.") }
        guard !name.isEmpty else { throw InviteFailure(message: "Add your name in Profile first.") }
        let inviteRef = db.collection("careSpaceInvites").document(CareInvite.clean(target.code))
        let memberRef = space(target.spaceId).collection("members").document(uid)
        let code = CareInvite.clean(target.code)
        let out: Any?
        do {
            out = try await db.runTransaction { (tx, errPtr) -> Any? in
                do {
                    let snap = try tx.getDocument(inviteRef)
                    guard snap.exists, let inv = snap.data() else { throw InviteFailure(message: "This invite was not found. Ask the parent to send a new one.") }
                    if let used = inv["usedBy"] as? String, !used.isEmpty { throw InviteFailure(message: "This invite has already been used.") }
                    guard let exp = date(inv["expiresAt"]), exp > Date() else { throw InviteFailure(message: "This invite has expired. Ask the parent for a new one.") }
                    guard (inv["spaceId"] as? String) == target.spaceId else { throw InviteFailure(message: "This invite was not found. Ask the parent to send a new one.") }
                    if (inv["createdBy"] as? String) == uid { throw InviteFailure(message: "You cannot join a space you created.") }
                    if let t = inv["targetUid"] as? String, !t.isEmpty, t != uid { throw InviteFailure(message: "This invite is for someone else.") }
                    let mem = try tx.getDocument(memberRef)
                    if mem.exists, ((mem.data()?["status"] as? String) ?? "active") == "active" { throw InviteFailure(message: "You already belong to this care space.") }
                    guard let r = inv["role"] as? String, ["regular", "limited", "viewer"].contains(r), let role = CareRole(rawValue: r) else { throw InviteFailure(message: "Enter the full join code or invite link.") }
                    let perms: CarePerms = inv["perms"] != nil ? CareInvite.effective(role, CarePerms.from(inv["perms"], role: role)) : CarePerms(allergies: false, medication: false, photos: false, calendar: false, privateMessages: false)
                    tx.updateData(["usedBy": uid], forDocument: inviteRef)
                    tx.setData(["role": role.rawValue, "status": "active", "perms": CareInvite.permsData(perms), "displayName": name,
                                "joinedAt": FieldValue.serverTimestamp(), "invitedBy": inv["createdBy"] as? String ?? "", "inviteId": code], forDocument: memberRef)
                    return role.rawValue
                } catch { errPtr?.pointee = error as NSError; return nil }
            }
        } catch {
            if let f = error as? InviteFailure { throw f }
            let msg = error.localizedDescription
            let known = ["This invite", "You ", "Enter the"]
            if known.contains(where: { msg.hasPrefix($0) }) { throw InviteFailure(message: msg) }
            throw InviteFailure(message: "Could not join this care space. Check the code and your connection.")
        }
        let role = CareRole(rawValue: out as? String ?? "") ?? .viewer
        let snap = try? await space(target.spaceId).getDocument()
        let spaceName = (snap?.data()?["name"] as? String) ?? "Care space"
        try? await db.collection("users").document(uid).collection("spaces").document(target.spaceId).setData(
            ["spaceId": target.spaceId, "name": spaceName, "memberRole": role.rawValue, "joinedAt": CareTime.iso(Date())], merge: true)
        return (role, spaceName, target.spaceId)
    }
}

// MARK: Invite someone (parent admin only)

struct InviteView: View {
    let space: SpaceSummary
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @State private var role: CareRole = .regular
    @State private var perms = CareInvite.defaultPerms(.regular)
    @State private var made: CareRepo.MadeInvite? = nil
    @State private var busy = false
    @State private var error = ""
    @State private var note = ""
    static let roles: [CareRole] = [.regular, .limited, .viewer]
    var allowed: Bool { CareAccess.canInvite(space.role) }
    var full: String { made.map { "\(space.id).\($0.code)" } ?? "" }
    var link: String { made.map { CareInvite.link(spaceId: space.id, code: $0.code) } ?? "" }

    var body: some View {
        Screen {
            Heading(text: "Invite someone")
            BodyText(text: "Share a private code or link. It works once and lasts 7 days.", muted: true)
            if !allowed { Notice(text: "Only a parent admin can create invites.", warn: true) }
            Text("Their role").font(Brand.body(15)).foregroundStyle(th.theme.muted)
            ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(Self.roles, id: \.self) { r in
                Button { role = r; perms = CareInvite.defaultPerms(r); made = nil; note = ""; error = "" } label: { Pill(title: r.label, on: role == r) }.buttonStyle(.plain)
            } } }
            Card {
                VStack(alignment: .leading, spacing: 4) {
                    Text("This person can see").font(Brand.title(20)).foregroundStyle(th.theme.text)
                    permRow("Allergies", $perms.allergies)
                    permRow("Medication", $perms.medication)
                    permRow("Child photos", $perms.photos)
                    permRow("Calendar", $perms.calendar)
                    permRow("Private messages", $perms.privateMessages, locked: role == .viewer)
                    BodyText(text: "Only a parent admin can change medical records.", muted: true)
                }
            }
            if !error.isEmpty { Notice(text: error, warn: true) }
            if !note.isEmpty { Notice(text: note) }
            BigButton(title: "Create invite code and link", busy: busy) { make() }.disabled(!allowed)
            if let m = made {
                Card {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack { CareIcon(name: "key", size: 26); Text("Invite ready").font(Brand.title(22)).foregroundStyle(th.theme.text) }
                        BodyText(text: "Full join code", muted: true)
                        Text(full).font(.system(size: 20, weight: .semibold, design: .monospaced)).foregroundStyle(th.theme.text).textSelection(.enabled)
                        Button { UIPasteboard.general.string = full; note = "Join code copied." } label: { Pill(title: "Copy join code", icon: "copy", on: false) }.buttonStyle(.plain)
                        Button { UIPasteboard.general.string = link; note = "Invite link copied." } label: { Pill(title: "Copy link", icon: "link", on: false) }.buttonStyle(.plain)
                        if let url = URL(string: link) {
                            ShareLink(item: url, message: Text("Join \(space.name) on CareSpace with this private invite.")) { Pill(title: "Share invite", icon: "send", on: true) }
                        }
                        BodyText(text: "Use by \(m.expiresAt.formatted(date: .abbreviated, time: .omitted)).", muted: true)
                    }
                }
            }
        }
        .navigationTitle("Invite").navigationBarTitleDisplayMode(.inline)
    }

    func permRow(_ title: String, _ value: Binding<Bool>, locked: Bool = false) -> some View {
        Toggle(isOn: Binding(get: { value.wrappedValue && !locked }, set: { value.wrappedValue = $0; made = nil })) {
            Text(title).font(Brand.body()).foregroundStyle(th.theme.text)
        }.tint(Brand.ink).disabled(locked).frame(minHeight: 44)
    }

    func make() {
        guard let uid = s.uid, allowed, !busy else { return }
        busy = true; error = ""; note = ""; made = nil
        Task {
            do { made = try await CareRepo.createInvite(spaceId: space.id, by: uid, role: role, perms: perms) }
            catch { self.error = error.localizedDescription }
            busy = false
        }
    }
}

// MARK: Join with code

struct JoinView: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @EnvironmentObject var ctx: CareContext
    @Environment(\.dismiss) private var dismiss
    @State private var input = ""
    @State private var busy = false
    @State private var error = ""
    @State private var joined: SpaceSummary? = nil
    @State private var joinedName = ""

    var body: some View {
        Screen {
            HStack { Heading(text: "Join with code"); Spacer(); BunnyView(size: 56) }
            BodyText(text: "Paste the code or link from the parent.", muted: true)
            if let sp = joined {
                Notice(text: "You joined \(sp.name).")
                NavigationLink { SpaceView(space: sp, uid: s.uid ?? "") } label: { Pill(title: "Open \(sp.name)", on: true) }.buttonStyle(.plain)
            } else if !joinedName.isEmpty {
                Notice(text: "You joined \(joinedName).")
                BigButton(title: "Back to chats") { dismiss() }
            } else {
                CareField(title: "Invite code or link", text: $input)
                if !error.isEmpty { Notice(text: error, warn: true) }
                BigButton(title: "Join care space", busy: busy) { join() }
            }
        }
        .navigationTitle("Join").navigationBarTitleDisplayMode(.inline)
    }

    func join() {
        guard let uid = s.uid, !busy else { return }
        guard let target = CareInvite.parse(input) else { error = "Enter the full join code or invite link."; return }
        busy = true; error = ""
        Task {
            do {
                let r = try await CareRepo.joinWithInvite(target, uid: uid, myName: s.myName)
                await ctx.load(uid: uid)
                if let sp = ctx.space(r.spaceId) { joined = sp } else { joinedName = r.spaceName }
            } catch { self.error = error.localizedDescription }
            busy = false
        }
    }
}
