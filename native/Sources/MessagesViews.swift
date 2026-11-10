import SwiftUI
import FirebaseFirestore
import PhotosUI

struct MessagesView: View {
    @EnvironmentObject var s: Session
    @State private var rows: [(rel: Relationship, other: Person?)] = []
    @State private var loaded = false
    var role: Role { s.role }
    var body: some View {
        NavigationStack {
            ScrollView { VStack(alignment: .leading, spacing: 12) {
                Header(role: role, title: role == .family ? "Your carers" : "Your \(role.otherPlural)", subtitle: "Chat opens when a booking is accepted")
                if !loaded { ProgressView().frame(maxWidth: .infinity).padding(30) }
                else if rows.isEmpty { EmptyHint(icon: .chat, text: role == .family ? "No chats yet" : "No chats yet") }
                ForEach(rows, id: \.rel.id) { r in
                    NavigationLink { ChatView(rel: r.rel, other: r.other) } label: {
                        Card { HStack(spacing: 12) { PhotoView(key: r.other?.photoKey ?? "", size: 52, fallback: r.other?.role.icon ?? .bunny); VStack(alignment: .leading) { Text(r.other?.name ?? "…").font(.headline).foregroundStyle(Brand.ink); Text(r.other.map { $0.side == "carer" ? $0.role.name : "Family" } ?? "").font(.subheadline).foregroundStyle(Brand.muted) }; Spacer(); BrandIcon(kind: .chevron, size: 18, color: Brand.muted) } }
                    }.buttonStyle(.plain).padding(.horizontal, 20)
                }
            }.padding(.bottom, 100) }
            .background(Brand.cream.ignoresSafeArea()).refreshable { await load() }.task { await load() }
        }
    }
    func load() async {
        guard let me = s.me else { return }
        var out: [(Relationship, Person?)] = []
        for r in await Backend.relationships(me.id, side: me.side) where r.state == "contact" || r.state == "hired" {
            out.append((r, await Backend.loadProfile(r.other(me.id))))
        }
        rows = out.map { (rel: $0.0, other: $0.1) }; loaded = true
    }
}

struct ChatView: View {
    @EnvironmentObject var s: Session
    let rel: Relationship; let other: Person?
    @State private var msgs: [ChatMessage] = []; @State private var text = ""; @State private var err = ""
    @State private var listener: ListenerRegistration?
    @State private var pick: PhotosPickerItem?; @State private var sending = false
    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView { LazyVStack(spacing: 8) {
                    if msgs.isEmpty { EmptyHint(icon: .chat, text: "Say hello to \(other?.firstName ?? "them")!") }
                    ForEach(msgs) { m in
                        let mine = m.from == s.uid
                        HStack { if mine { Spacer(minLength: 50) }
                            if m.kind == "photo" && !m.mediaKey.isEmpty { PhotoView(key: m.mediaKey, size: 220, round: false).accessibilityIdentifier("chatPhoto") }
                            else { Text(m.text).padding(.horizontal, 14).padding(.vertical, 10).background(mine ? s.role.tint : .white).foregroundStyle(mine ? .white : Brand.ink).clipShape(RoundedRectangle(cornerRadius: 18)) }
                            if !mine { Spacer(minLength: 50) } }.id(m.id)
                    }
                }.padding(14) }
                .onChange(of: msgs.count) { _, _ in if let l = msgs.last { withAnimation { proxy.scrollTo(l.id, anchor: .bottom) } } }
            }
            if !err.isEmpty { Text(err).font(.caption).foregroundStyle(.red) }
            HStack(spacing: 10) {
                PhotosPicker(selection: $pick, matching: .images) {
                    ZStack { if sending { ProgressView() } else { BrandIcon(kind: .camera, size: 24, color: s.role.tint) } }.frame(width: 44, height: 44).background(Brand.field).clipShape(Circle())
                }.disabled(sending).accessibilityLabel("Share a photo")
                TextField("Message", text: $text, axis: .vertical).lineLimit(1...4).padding(12).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 20))
                Button { Task { await send() } } label: { BrandIcon(kind: .send, size: 22, color: .white, mono: true).padding(12).background(s.role.tint).clipShape(Circle()) }.disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
            }.padding(12).background(.ultraThinMaterial)
        }
        .background(Brand.cream.ignoresSafeArea()).navigationTitle(other?.firstName ?? "Chat").navigationBarTitleDisplayMode(.inline)
        .onChange(of: pick) { _, item in if let item { Task { await sendPhoto(item) } } }
        .onAppear { listener = Backend.listenMessages(rel.id) { msgs = $0 } }.onDisappear { listener?.remove() }
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
