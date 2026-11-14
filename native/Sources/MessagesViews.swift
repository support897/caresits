import SwiftUI
import FirebaseFirestore
import PhotosUI

/// The thread list. It paints at once from the copy kept on the phone, then refreshes. The profiles are read all at once,
/// never one after another.
@MainActor
final class ThreadStore: ObservableObject {
    static let shared = ThreadStore()
    struct Row: Identifiable { let rel: Relationship; let other: Person?; var id: String { rel.id } }
    @Published var rows: [Row] = []
    @Published var loaded = false
    private var owner = ""
    private func key(_ uid: String) -> String { "caresits.threads.\(uid)" }
    /// First paint from the phone: relationship id, who it is, name, kind and photo of each thread.
    func paintFromPhone(_ me: Person) {
        guard owner != me.id, let raw = UserDefaults.standard.array(forKey: key(me.id)) as? [[String: String]] else { return }
        owner = me.id
        var out: [Row] = []
        for d in raw {
            guard let id = d["rel"], let o = d["other"] else { continue }
            let fam: String = me.side == "family" ? me.id : o
            let car: String = me.side == "family" ? o : me.id
            var data: [String: Any] = [:]
            data["side"] = d["side"] ?? "carer"
            data["displayName"] = d["name"] ?? ""
            data["photoUrl"] = d["photo"] ?? ""
            if let svc = d["svc"], !svc.isEmpty { data["card"] = ["careTypes": [svc]] as [String: Any] }
            out.append(Row(rel: Relationship(id: id, familyUid: fam, carerUid: car, state: "contact"), other: Person(id: o, data: data)))
        }
        rows = out
        if !rows.isEmpty { loaded = true }
    }
    func load(_ me: Person) async {
        guard !me.id.isEmpty else { return }
        paintFromPhone(me)
        let rels = await Backend.relationships(me.id, side: me.side).filter { $0.state == "contact" || $0.state == "hired" }
        let people = await Backend.loadProfiles(rels.map { $0.other(me.id) })
        rows = rels.map { Row(rel: $0, other: people[$0.other(me.id)]) }
        loaded = true; owner = me.id
        let raw: [[String: String]] = rows.map { r in ["rel": r.rel.id, "other": r.rel.other(me.id), "name": r.other?.name ?? "", "side": r.other?.side ?? "", "svc": r.other?.services.first ?? "", "photo": r.other?.photoKey ?? ""] }
        UserDefaults.standard.set(raw, forKey: key(me.id))
    }
}

struct MessagesView: View {
    @EnvironmentObject var s: Session
    @ObservedObject private var store = ThreadStore.shared
    var role: Role { s.role }
    var body: some View {
        NavigationStack {
            ScrollView { VStack(alignment: .leading, spacing: 12) {
                Header(role: role, title: "Messages")
                if !store.loaded { ProgressView().frame(maxWidth: .infinity).padding(30) }
                else if store.rows.isEmpty { EmptyHint(icon: .chat, text: "Match with someone, then say hello") }
                ForEach(store.rows) { r in
                    NavigationLink { ChatView(rel: r.rel, other: r.other) } label: {
                        Card { HStack(spacing: 12) { PhotoView(key: r.other?.photoKey ?? "", size: 52, fallback: r.other?.role.icon ?? .bunny); VStack(alignment: .leading) { Text(r.other?.name ?? "…").font(.headline).foregroundStyle(Brand.ink); Text(r.other.map { $0.side == "carer" ? $0.role.name : "Family" } ?? "").font(.subheadline).foregroundStyle(Brand.muted) }; Spacer(); BrandIcon(kind: .chat, size: 16, color: Color(hex: 0x3A2E33), mono: true).frame(width: 30, height: 30).background(Brand.signMessage).clipShape(Circle()) } }
                    }.buttonStyle(.plain).padding(.horizontal, 20)
                }
            }.padding(.bottom, 100) }
            .background(Brand.cream.ignoresSafeArea()).refreshable { if let me = s.me { await store.load(me) } }
            .task { if let me = s.me { store.paintFromPhone(me); await store.load(me) } }
        }
    }
}

struct ChatView: View {
    @EnvironmentObject var s: Session
    let rel: Relationship; let other: Person?
    @State private var msgs: [ChatMessage] = ChatCache.rows[""] ?? []; @State private var text = ""; @State private var err = ""
    @State private var older: [ChatMessage] = []; @State private var noMore = false; @State private var showBook = false
    @State private var listener: ListenerRegistration?
    @State private var pick: PhotosPickerItem?; @State private var sending = false
    @State private var filledNote = false
    var body: some View {
        VStack(spacing: 0) {
            if filledNote { Text("This one is filled").font(.footnote.weight(.semibold)).foregroundStyle(Color(hex: 0x3A2E33)).padding(.horizontal, 14).padding(.vertical, 7).background(Brand.bunny).clipShape(Capsule()).padding(.top, 8).accessibilityIdentifier("filledNote") }
            ScrollViewReader { proxy in
                ScrollView { LazyVStack(spacing: 8) {
                    if msgs.isEmpty && older.isEmpty { EmptyHint(icon: .chat, text: "Say hello") }
                    if msgs.count >= Backend.chatWindow && !noMore { Button { Task { await loadOlder() } } label: { IconLabel(icon: .undo, text: "Earlier messages", size: 16) }.font(.subheadline.weight(.semibold)).padding(.vertical, 6).accessibilityIdentifier("earlierMessages") }
                    ForEach(older + msgs) { m in
                        let mine = m.from == s.uid
                        HStack { if mine { Spacer(minLength: 50) }
                            if m.kind == "photo" && !m.mediaKey.isEmpty { PhotoView(key: m.mediaKey, size: 220, round: false).accessibilityIdentifier("chatPhoto") }
                            else { Text(m.text).padding(.horizontal, 14).padding(.vertical, 10).background(mine ? Brand.bunny : Brand.signMessage.opacity(0.75)).foregroundStyle(mine ? Color(hex: 0x3A2E33) : (ThemeStore.shared.pick == .dark ? Color(hex: 0x3A2E33) : Brand.ink)).clipShape(RoundedRectangle(cornerRadius: 18)) }
                            if !mine { Spacer(minLength: 50) } }.id(m.id)
                    }
                }.padding(14) }
                .onChange(of: msgs.count) { _, _ in if let l = msgs.last { withAnimation { proxy.scrollTo(l.id, anchor: .bottom) } } }
            }
            if !err.isEmpty { Text(err).font(.caption).foregroundStyle(Brand.ink) }
            HStack(spacing: 10) {
                PhotosPicker(selection: $pick, matching: .images) {
                    ZStack { if sending { ProgressView() } else { BrandIcon(kind: .camera, size: 24, color: s.role.tint) } }.frame(width: 44, height: 44).background(Brand.field).clipShape(Circle())
                }.disabled(sending).accessibilityLabel("Share a photo")
                TextField("Message", text: $text, axis: .vertical).lineLimit(1...4).padding(12).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 20))
                Button { Task { await send() } } label: { BrandIcon(kind: .send, size: 22, color: Color(hex: 0x3A2E33), mono: true).padding(12).background(s.role.tint).clipShape(Circle()) }.disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
            }.padding(12).background(.ultraThinMaterial)
        }
        .background(Brand.cream.ignoresSafeArea()).navigationTitle(other?.firstName ?? "Chat").navigationBarTitleDisplayMode(.inline)
        .onChange(of: pick) { _, item in if let item { Task { await sendPhoto(item) } } }
        .onAppear { msgs = ChatCache.rows[rel.id] ?? msgs; listener = Backend.listenMessages(rel.id) { msgs = $0; ChatCache.rows[rel.id] = $0 } }.onDisappear { listener?.remove() }
        .task { if s.me?.side == "carer" { filledNote = await Backend.filledElsewhere(familyUid: rel.familyUid, carerUid: s.uid ?? "") } }
        .toolbar { if s.me?.side == "family", let o = other, o.side == "carer" { ToolbarItem(placement: .topBarTrailing) { Button { showBook = true } label: { IconLabel(icon: .calendar, text: "Book \(o.firstName)", size: 16) }.accessibilityIdentifier("bookFromChat") } } }
        .sheet(isPresented: $showBook) { if let o = other { BookSheet(carer: o) } }
        .backSwipe { dismissChat() }
    }
    @Environment(\.dismiss) private var dismissEnv
    func dismissChat() { dismissEnv() }
    func loadOlder() async {
        guard let first = (older + msgs).first else { return }
        let more = await Backend.olderMessages(rel.id, before: first.at)
        if more.isEmpty { noMore = true } else { older = more + older }
    }
    func sendPhoto(_ item: PhotosPickerItem) async {
        guard let uid = s.uid else { return }
        sending = true; err = ""; defer { sending = false; pick = nil }
        do { try await Backend.sendPhoto(rel.id, from: uid, raw: try await Media.load(item)) }
        catch { err = "Photo not sent: " + error.localizedDescription }
    }
    func send() async {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines); guard !t.isEmpty, let uid = s.uid else { return }
        text = ""; err = ""
        do { try await Backend.send(rel.id, from: uid, text: t) } catch { err = "Message not sent. Check your connection."; text = t }
    }
}

/// The newest window of each chat already read in this run, so a re-open paints before the network answers.
enum ChatCache { static var rows: [String: [ChatMessage]] = [:] }
