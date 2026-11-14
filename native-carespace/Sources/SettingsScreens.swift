import SwiftUI
import UserNotifications
import Photos
import AVFoundation
import FirebaseAuth
import AuthenticationServices

// MARK: Settings — every setting lives here, never in Profile
// (her law, 13 Nov 14:11). Items 4, 5, 6 of build 29.

struct SettingsView: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    var body: some View {
        Screen {
            ThemePicker()
            BunnySettingsCard()
            RowLink(icon: "chat", title: "Language", subtitle: "Your language pick, saved for you") { LanguageView() }
            RowLink(icon: "bell", title: "Notifications", subtitle: "Choose what pings you") { NotificationsView() }
            RowLink(icon: "key", title: "Permissions", subtitle: "What CareSpace can use on this phone") { PermissionsView() }
            RowLink(icon: "shield", title: "Privacy", subtitle: "What CareSpace stores, in plain words") { PrivacyView() }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// The bunny rows, by their exact names (item 5). Two settings, two rows:
/// Calm bunny stills the gentle bob; Less movement stills the bunny for
/// anyone who wants screens kept still (and follows the system switch).
struct BunnySettingsCard: View {
    @EnvironmentObject var th: ThemeStore
    @AppStorage("carespace.bunnyCalm") private var calm = false
    @AppStorage("carespace.bunnyLessMovement") private var lessMovement = false
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 14) {
                Text("The bunny").font(Brand.title(22)).foregroundStyle(th.theme.text)
                Toggle(isOn: $calm) {
                    Text("Calm bunny").font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text)
                }.tint(Brand.ink).frame(minHeight: 44)
                Toggle(isOn: $lessMovement) {
                    Text("Less movement on screens with the bunny.").font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text)
                }.tint(Brand.ink).frame(minHeight: 44)
            }
        }
    }
}

// MARK: Item 4 — language. The pick saves to this phone and to the user's
// own prefs; the words stay English until Phase 4 lands real translations.
// Never fake a translation.

/// The language options of record (items 4 + 18 share them).
enum LanguageOptions {
    struct Opt { let code: String; let label: String }
    static let all: [Opt] = [
        Opt(code: "en", label: "English"), Opt(code: "es", label: "Español"),
        Opt(code: "pt", label: "Português"), Opt(code: "fr", label: "Français"),
        Opt(code: "it", label: "Italiano"), Opt(code: "de", label: "Deutsch"),
        Opt(code: "zh", label: "中文"), Opt(code: "ar", label: "العربية")
    ]
}

struct LanguageView: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @AppStorage("carespace.language") private var code = "en"
    static let options: [(String, String)] = [
        ("en", "English"), ("es", "Español"), ("pt", "Português"),
        ("fr", "Français"), ("it", "Italiano"), ("de", "Deutsch"),
        ("zh", "中文"), ("ar", "العربية")
    ]
    var body: some View {
        Screen {
            Heading(text: "Language")
            BodyText(text: "CareSpace speaks English for now. Your pick is saved, and CareSpace will use it as soon as the translations are ready.", muted: true)
            Card {
                VStack(spacing: 4) {
                    ForEach(Self.options, id: \.0) { opt in
                        Button {
                            code = opt.0
                            if let uid = s.uid { Task { try? await Backend.savePref(uid, "language", opt.0) } }
                        } label: {
                            HStack {
                                Text(opt.1).font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text)
                                Spacer()
                                if code == opt.0 { CareIcon(name: "check", size: 20, fill: false) }
                            }
                            .frame(minHeight: 44).contentShape(Rectangle())
                        }.buttonStyle(.plain)
                        .accessibilityLabel(opt.1)
                        .accessibilityAddTraits(code == opt.0 ? .isSelected : [])
                    }
                }
            }
        }
        .navigationTitle("Language")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if let uid = s.uid, let saved = await Backend.loadPrefs(uid)["language"] as? String,
               Self.options.contains(where: { $0.0 == saved }) { code = saved }
        }
    }
}

// MARK: Item 4 + item 35 — notification choices. Every kind of ping has
// its own switch; a switch saves to this phone and to the user's prefs.
// Delivery wiring is item 11; these switches are what it reads.

enum NotifKind {
    static let all: [(String, String, String)] = [
        ("messages", "Messages", "chat"),
        ("photoRequests", "Photo requests", "photo"),
        ("activities", "Activities", "sun"),
        ("meals", "Meals and lunch", "meal"),
        ("tracker", "Daily tracker", "report"),
        ("workChanges", "Work changes", "cal"),
        ("sick", "Sick notices", "bell"),
        ("reminders", "Reminders", "clock")
    ]
    static func isOn(_ kind: String) -> Bool {
        let v = UserDefaults.standard.object(forKey: "carespace.notif.\(kind)") as? Bool
        return v ?? true
    }
    static func set(_ kind: String, _ on: Bool, uid: String?) {
        UserDefaults.standard.set(on, forKey: "carespace.notif.\(kind)")
        guard let uid else { return }
        Task {
            let prefs = await Backend.loadPrefs(uid)
            var map = prefs["notifications"] as? [String: Bool] ?? [:]
            map[kind] = on
            try? await Backend.savePref(uid, "notifications", map)
        }
    }
}

struct NotificationsView: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @State private var states: [String: Bool] = [:]
    @State private var phoneState = "checking"
    var body: some View {
        Screen {
            Heading(text: "Notifications")
            // Item 11: the permission ask lives here, gently — plain
            // words and the person's own tap, never a cold prompt.
            if phoneState == "notAsked" {
                Card {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 12) { BunnyView(pose: .hello, size: 52); Text("A gentle ping when something happens in your care spaces. Nothing noisy, ever.").font(Brand.body(16)).foregroundStyle(th.theme.text) }
                        BigButton(title: "Turn on notifications") {
                            Task { _ = await PushSetup.askPermission(); await refreshPhoneState() }
                        }
                    }
                }
            } else if phoneState == "off" {
                Notice(text: "Notifications are off for CareSpace on this phone. Open Settings to turn them on.", warn: true)
            }
            BodyText(text: "Pick what pings you. Each one is its own switch, and a quiet switch means no ping of that kind.", muted: true)
            Card {
                VStack(spacing: 6) {
                    ForEach(NotifKind.all, id: \.0) { kind in
                        Toggle(isOn: Binding(
                            get: { states[kind.0] ?? true },
                            set: { states[kind.0] = $0; NotifKind.set(kind.0, $0, uid: s.uid) }
                        )) {
                            HStack(spacing: 10) {
                                CareIcon(name: kind.2, size: 24)
                                Text(kind.1).font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text)
                            }
                        }.tint(Brand.ink).frame(minHeight: 44)
                    }
                }
            }
        }
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await refreshPhoneState()
            var m: [String: Bool] = [:]
            for k in NotifKind.all { m[k.0] = NotifKind.isOn(k.0) }
            if let uid = s.uid, let saved = await Backend.loadPrefs(uid)["notifications"] as? [String: Bool] {
                for (k, v) in saved { m[k] = v; UserDefaults.standard.set(v, forKey: "carespace.notif.\(k)") }
            }
            states = m
        }
    }
    func refreshPhoneState() async {
        let st = await UNUserNotificationCenter.current().notificationSettings()
        switch st.authorizationStatus {
        case .authorized, .provisional, .ephemeral: phoneState = "on"
        case .denied: phoneState = "off"
        default: phoneState = "notAsked"
        }
    }
}

// MARK: Item 6 — permissions. Live system states, read fresh on this
// page; a denied one carries its own route to the iOS Settings page.

struct PermissionsView: View {
    @EnvironmentObject var th: ThemeStore
    @State private var notif = "Checking"
    @State private var photos = "Checking"
    @State private var mic = "Checking"
    var body: some View {
        Screen {
            Heading(text: "Permissions")
            BodyText(text: "These are this phone's own switches. CareSpace only uses what you allow.", muted: true)
            permRow(icon: "bell", title: "Notifications", state: notif)
            permRow(icon: "photo", title: "Photos", state: photos)
            permRow(icon: "phone", title: "Microphone", state: mic)
        }
        .navigationTitle("Permissions")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }
    @ViewBuilder func permRow(icon: String, title: String, state: String) -> some View {
        Card {
            HStack(spacing: 14) {
                CareIcon(name: icon, size: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text)
                    Text(state).font(Brand.body(15)).foregroundStyle(th.theme.muted)
                }
                Spacer()
                if state == "Off" {
                    Button("Open Settings") {
                        if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) }
                    }
                    .font(Brand.body(16).weight(.semibold)).foregroundStyle(Brand.ink)
                }
            }
        }
    }
    func load() async {
        let n = await UNUserNotificationCenter.current().notificationSettings()
        notif = Self.word(n.authorizationStatus)
        photos = Self.photoWord(PHPhotoLibrary.authorizationStatus(for: .readWrite))
        mic = Self.word(AVCaptureDevice.authorizationStatus(for: .audio))
    }
    static func word(_ s: UNAuthorizationStatus) -> String {
        switch s {
        case .authorized, .provisional, .ephemeral: return "On"
        case .denied: return "Off"
        default: return "Not asked yet"
        }
    }
    static func word(_ s: AVAuthorizationStatus) -> String {
        switch s {
        case .authorized: return "On"
        case .denied, .restricted: return "Off"
        default: return "Not asked yet"
        }
    }
    static func photoWord(_ s: PHAuthorizationStatus) -> String {
        switch s {
        case .authorized: return "On"
        case .limited: return "Some photos"
        case .denied, .restricted: return "Off"
        default: return "Not asked yet"
        }
    }
}

// MARK: Item 6 — privacy, in plain words. The delete entry point lands
// here with item 13.

struct PrivacyView: View {
    @EnvironmentObject var th: ThemeStore
    var body: some View {
        Screen {
            Heading(text: "Privacy")
            Card {
                VStack(alignment: .leading, spacing: 10) {
                    BodyText(text: "CareSpace keeps your care spaces, your children, your messages and your photos so your care team can see the day together.")
                    BodyText(text: "Only the people in a care space can see what is inside it. Nobody else can, and your spaces never mix.")
                    BodyText(text: "Your name and your picks live on your own profile. Your settings live in your own private settings space.")
                }
            }
            RowLink(icon: "trash", title: "Delete my account", subtitle: "Deletes your account and everything tied to it") { DeleteAccountView() }
        }
        .navigationTitle("Privacy")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Item 13: the delete. Plain words first, a fresh sign-in proves it
/// is really you, then the backend callable removes the whole
/// footprint. Nothing half deletes from this phone.
struct DeleteAccountView: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @State private var pw = ""
    @State private var reauthed = false
    @State private var busy = false
    @State private var err = ""
    @State private var confirm = false
    @State private var done = false
    var body: some View {
        Screen {
            Heading(text: "Delete my account")
            Card {
                VStack(alignment: .leading, spacing: 10) {
                    BodyText(text: "This deletes your CareSpace account for good: your sign-in, your name and profile, your place in every care team, your saved picks, and your entitlement record.")
                    BodyText(text: "A care space with another admin stays for them. A care space where you are the only admin is deleted with your account.", muted: true)
                    BodyText(text: "It cannot be undone.", muted: true)
                }
            }
            if done {
                Notice(text: "Your account is deleted. Thank you for being here.")
                BunnyView(pose: .rest, size: 90).frame(maxWidth: .infinity)
            } else if s.needsReauth && !reauthed {
                BodyText(text: "First, sign in once more so we know it is you.", muted: true)
                if s.provider == "password" {
                    SecureField("Your password", text: $pw)
                        .padding(14).background(Color(hex: 0xF1EDE4))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    BigButton(title: "Confirm it is me", busy: busy) {
                        Task {
                            busy = true; err = ""
                            do {
                                guard let u = Auth.auth().currentUser, let e = u.email else { throw AppError.msg("Sign in again first.") }
                                try await u.reauthenticate(with: EmailAuthProvider.credential(withEmail: e, password: pw))
                                reauthed = true
                            } catch { err = DoorView.spoken(error) }
                            busy = false
                        }
                    }
                } else if s.provider == "google.com" {
                    BigButton(title: "Confirm with Google", busy: busy) {
                        Task {
                            busy = true; err = ""
                            do { try await s.google(); reauthed = true } catch { if !Session.isCancel(error) { err = DoorView.spoken(error) } }
                            busy = false
                        }
                    }
                } else {
                    SignInWithAppleButton(.signIn) { req in s.prepareApple(req) } onCompletion: { result in
                        Task {
                            do { try await s.finishApple(result); reauthed = true } catch { if !Session.isCancel(error) { err = DoorView.spoken(error) } }
                        }
                    }
                    .frame(height: 54).clipShape(RoundedRectangle(cornerRadius: 14))
                }
            } else {
                BigButton(title: "Delete my account", tint: Color(hex: 0xB03A48), busy: busy) { confirm = true }
            }
            if !err.isEmpty { Notice(text: err, warn: true) }
        }
        .navigationTitle("Delete account")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Delete your account for good?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Delete my account", role: .destructive) {
                Task {
                    busy = true; err = ""
                    do {
                        try await Backend.deleteMyAccount()
                        done = true
                        s.signOut()
                    } catch { err = "The delete could not finish. Check your connection and try again." }
                    busy = false
                }
            }
            Button("Keep my account", role: .cancel) {}
        }
    }
}

// MARK: Item 7 — Care Team stands as a Profile row and opens the team
// surface. Item 9 completes it (roles read true, in-app permissions).

struct CareTeamView: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var ctx: CareContext
    @State private var ties: [(name: String, state: String)] = []
    var body: some View {
        Screen {
            Heading(text: "Care Team")
            if ctx.spaces.isEmpty {
                EmptyState(title: "No care space yet", detail: "Your team stands here once you have a care space.")
            }
            ForEach(ctx.spaces) { sp in
                RowLink(icon: "people", title: sp.name.isEmpty ? "Care space" : sp.name,
                        subtitle: "You are \(sp.role.label.lowercased()) here") { TeamSpaceView(space: sp) }
            }
            RowLink(icon: "key", title: "Join with code", subtitle: "Use a code or link from a parent") { JoinView() }
            // Item 17: the same account works in both apps. People
            // already connected in Caresitters stand already
            // connected here — never asked to connect again.
            if !ties.isEmpty {
                Heading(text: "From Caresitters")
                BodyText(text: "You use the same account in Caresitters and CareSpace, so your people carry over.", muted: true)
                ForEach(Array(ties.enumerated()), id: \.offset) { _, t in
                    Card {
                        HStack(spacing: 10) {
                            CareIcon(name: "people", size: 22)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(t.name.isEmpty ? "A person from Caresitters" : t.name)
                                    .font(Brand.body(17).weight(.semibold))
                                Text(t.state == "active" || t.state == "booked" ? "Already connected" : "Connected in Caresitters")
                                    .font(Brand.body(14))
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Care Team")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if !ctx.loaded, let u = s.uid { await ctx.load(uid: u) }
            if let uid = s.uid {
                var out: [(String, String)] = []
                for r in await Backend.loadRelationships(uid) {
                    out.append((await Backend.loadProfileName(r.otherUid), r.state))
                }
                ties = out
            }
        }
    }
}

struct TeamSpaceView: View {
    let space: SpaceSummary
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @State private var members: [TeamMember] = []
    var body: some View {
        Screen {
            Heading(text: space.name.isEmpty ? "Care space" : space.name)
            Card {
                VStack(alignment: .leading, spacing: 10) {
                    if members.isEmpty { BodyText(text: "Loading your team.", muted: true) }
                    ForEach(members) { m in
                        if space.role == .admin, m.id != s.uid {
                            NavigationLink { MemberAccessView(space: space, member: m) } label: {
                                memberRow(m, chevron: true)
                            }.buttonStyle(.plain)
                        } else {
                            memberRow(m, chevron: false)
                        }
                    }
                }
            }
            if space.role == .admin {
                BodyText(text: "Tap a person to change what they can see and do here.", muted: true)
            }
            RowLink(icon: "plus", title: "Invite someone", subtitle: "Share a private code or link") { InviteView(space: space) }
        }
        .navigationTitle("Team")
        .navigationBarTitleDisplayMode(.inline)
        .task { members = await CareRepo.members(spaceId: space.id) }
    }
    func memberRow(_ m: TeamMember, chevron: Bool) -> some View {
        HStack(spacing: 10) {
            CareIcon(name: "user", size: 24)
            Text(m.shownName).font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text)
            Spacer()
            Text(m.role.label).font(Brand.body(15)).foregroundStyle(th.theme.muted)
            if chevron { CareIcon(name: "chevron.right", size: 16, tint: th.theme.muted, fill: false) }
        }
        .frame(minHeight: 40).contentShape(Rectangle())
    }
}

/// Item 9: a parent admin changes a member's role and what they can
/// see, in the app. The member record is the one source the other
/// phone reads, so a change here lands on their side.
struct MemberAccessView: View {
    let space: SpaceSummary
    let member: TeamMember
    @EnvironmentObject var th: ThemeStore
    @Environment(\.dismiss) private var dismiss
    @State private var role: CareRole = .regular
    @State private var perms = CarePerms()
    @State private var busy = false
    @State private var note = ""
    @State private var err = ""
    var body: some View {
        Screen {
            Heading(text: member.shownName)
            Text("Their role").font(Brand.body(15)).foregroundStyle(th.theme.muted)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    ForEach([CareRole.regular, .limited, .viewer], id: \.self) { r in
                        Button { role = r; perms = CareInvite.defaultPerms(r) } label: { Pill(title: r.label, on: role == r) }.buttonStyle(.plain)
                    }
                }
            }
            Card {
                VStack(spacing: 6) {
                    permToggle("Allergies", icon: "shield", key: \.allergies)
                    permToggle("Medication", icon: "pills", key: \.medication)
                    permToggle("Photos", icon: "photo", key: \.photos)
                    permToggle("Calendar", icon: "cal", key: \.calendar)
                    permToggle("Private messages", icon: "chat", key: \.privateMessages)
                }
            }
            BigButton(title: "Save their access", busy: busy) {
                Task {
                    busy = true; err = ""; note = ""
                    do {
                        let ok = try await CareRepo.setMemberAccess(spaceId: space.id, memberUid: member.id, role: role, perms: perms)
                        note = SaveText.result(ok)
                    } catch { err = (error as? CareError)?.message ?? "Could not save. Try again." }
                    busy = false
                }
            }
            if !note.isEmpty { Notice(text: note) }
            if !err.isEmpty { Notice(text: err, warn: true) }
        }
        .navigationTitle("Access")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            role = member.role == .admin ? .regular : member.role
            perms = member.perms
        }
    }
    func permToggle(_ title: String, icon: String, key: WritableKeyPath<CarePerms, Bool>) -> some View {
        Toggle(isOn: Binding(get: { perms[keyPath: key] }, set: { perms[keyPath: key] = $0 })) {
            HStack(spacing: 10) {
                CareIcon(name: icon, size: 24)
                Text(title).font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text)
            }
        }.tint(Brand.ink).frame(minHeight: 44)
    }
}
