import SwiftUI

// MARK: Chats home, new space, space page (Today, Chat, Children), chat thread.

enum ChatFilter: String, CaseIterable { case all = "All", families = "Families", carers = "Carers", unread = "Unread", requests = "Requests" }

struct ChatsHome: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @EnvironmentObject var ctx: CareContext
    @State private var filter: ChatFilter = .all
    @State private var query = ""

    func unread(_ sp: SpaceSummary) -> Bool {
        guard let m = ctx.lastMessage[sp.id], m.from != (s.uid ?? "") else { return false }
        return m.at > CareRepo.lastRead(uid: s.uid ?? "", spaceId: sp.id)
    }
    func requests(_ sp: SpaceSummary) -> Int { ctx.events.filter { $0.spaceId == sp.id && $0.state == .requested }.count }
    var shown: [SpaceSummary] {
        ctx.spaces.filter { sp in
            switch filter {
            case .all: return true
            case .families: return sp.role == .admin || sp.role == .viewer
            case .carers: return sp.role == .regular || sp.role == .limited
            case .unread: return unread(sp)
            case .requests: return requests(sp) > 0
            }
        }.filter { query.isEmpty || $0.name.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        Screen {
            Text("Hello, \(s.myName)").font(Brand.title(28)).foregroundStyle(th.theme.text)
            BodyText(text: "Find care. Share the day.", muted: true)
            HStack(spacing: 10) {
                CareIcon(name: "search", size: 20, tint: th.theme.muted, fill: false)
                TextField("Search your spaces", text: $query).font(Brand.body()).foregroundStyle(th.theme.text)
            }.padding(14).frame(minHeight: 50).background(th.theme.field).clipShape(RoundedRectangle(cornerRadius: 14))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack { ForEach(ChatFilter.allCases, id: \.self) { f in
                    Button { filter = f } label: { Pill(title: f.rawValue, on: filter == f) }.buttonStyle(.plain)
                } }
            }
            if !ctx.loaded {
                ProgressView().frame(maxWidth: .infinity).padding(30)
            } else if ctx.spaces.isEmpty {
                EmptyState(title: "No care spaces yet", detail: "Make one for your family. Join with a code comes soon.")
            } else if shown.isEmpty {
                EmptyState(title: "Nothing here", detail: "Try another filter.")
            } else {
                ForEach(shown) { sp in
                    NavigationLink { SpaceView(space: sp, uid: s.uid ?? "") } label: {
                        Card {
                            HStack(spacing: 14) {
                                ZStack { Circle().fill([Brand.sage, Brand.blush, Brand.bunny.opacity(0.6), Brand.sage.opacity(0.6)][sp.colorIndex]).frame(width: 48, height: 48)
                                    CareIcon(name: "people", size: 26, fill: false) }
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack { Text(sp.name).font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text)
                                        if unread(sp) { Circle().fill(Brand.bunny).frame(width: 10, height: 10).accessibilityLabel("Unread") } }
                                    Text(ctx.lastMessage[sp.id]?.text ?? sp.role.label).font(Brand.body(15)).foregroundStyle(th.theme.muted).lineLimit(1)
                                    if requests(sp) > 0 { Text("\(requests(sp)) time off request\(requests(sp) == 1 ? "" : "s")").font(Brand.body(15)).foregroundStyle(Brand.ink) }
                                }
                                Spacer()
                                CareIcon(name: "chevron.right", size: 18, tint: th.theme.muted, fill: false)
                            }
                        }
                    }.buttonStyle(.plain)
                }
            }
            RowLink(icon: "plus", title: "New care space", subtitle: "For your family or your care team") { NewSpaceView() }
        }
        .navigationTitle("Chats")
        .task { if let u = s.uid { await ctx.load(uid: u) } }
    }
}

struct NewSpaceView: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var ctx: CareContext
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var busy = false
    @State private var error = ""
    var body: some View {
        Screen {
            Heading(text: "New care space")
            BodyText(text: "A care space is one shared place for a family and the people who help care for their children.", muted: true)
            CareField(title: "Space name", text: $name)
            if !error.isEmpty { Notice(text: error, warn: true) }
            BigButton(title: "Make space", busy: busy) {
                guard let uid = s.uid else { return }
                busy = true; error = ""
                Task {
                    do { try await CareRepo.createSpace(uid: uid, myName: s.myName, spaceName: name); await ctx.load(uid: uid); dismiss() }
                    catch { self.error = error.localizedDescription }
                    busy = false
                }
            }
        }
        .navigationTitle("New space").navigationBarTitleDisplayMode(.inline)
    }
}

enum SpaceTab: String, CaseIterable { case today = "Today", chat = "Chat", children = "Children" }

struct SpaceView: View {
    let space: SpaceSummary
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @StateObject private var model: SpaceModel
    @State private var tab: SpaceTab = .today

    init(space: SpaceSummary, uid: String) {
        self.space = space
        _model = StateObject(wrappedValue: SpaceModel(space: space, uid: uid))
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("Section", selection: $tab) { ForEach(SpaceTab.allCases, id: \.self) { Text($0.rawValue).tag($0) } }
                .pickerStyle(.segmented).padding(.horizontal, 20).padding(.vertical, 10)
            switch tab {
            case .today: TodayView(model: model)
            case .chat: ChatPanel(model: model)
            case .children: SpaceChildrenView(model: model)
            }
        }
        .background(th.theme.bg.ignoresSafeArea())
        .navigationTitle(space.name).navigationBarTitleDisplayMode(.inline)
        .task { await model.load(); model.listen() }
        .onDisappear { model.stop() }
    }
}

struct ChatPanel: View {
    @ObservedObject var model: SpaceModel
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @State private var text = ""
    @State private var note = ""
    var allowed: Bool { CareAccess.canSeeChat(model.space.role, model.space.perms) }
    var body: some View {
        if !allowed {
            Screen { EmptyState(title: "Chat is closed for you", detail: "A family admin can open it in your member settings.") }
        } else {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 10) {
                            if model.messages.isEmpty { EmptyState(title: "No messages yet", detail: "Say hello to your team.") }
                            ForEach(model.messages) { m in
                                let mine = m.from == (s.uid ?? "")
                                VStack(alignment: mine ? .trailing : .leading, spacing: 3) {
                                    if !mine { Text(model.name(of: m.from, me: s.myName)).font(Brand.body(14)).foregroundStyle(th.theme.muted) }
                                    Text(m.text).font(Brand.body()).foregroundStyle(mine ? Color.white : th.theme.text)
                                        .padding(12).background(mine ? Brand.ink : th.theme.field).clipShape(RoundedRectangle(cornerRadius: 16))
                                    Text(m.queued ? "Waiting to send" : CareTime.clock(m.at)).font(Brand.body(13)).foregroundStyle(th.theme.muted)
                                }
                                .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading).id(m.id)
                            }
                        }.padding(20)
                    }
                    .onChange(of: model.messages.count) { _ in if let l = model.messages.last { proxy.scrollTo(l.id, anchor: .bottom) } }
                }
                if !note.isEmpty { Notice(text: note).padding(.horizontal, 20) }
                if CareAccess.canPost(model.space.role) {
                    HStack(spacing: 10) {
                        TextField("Write a message", text: $text, axis: .vertical).font(Brand.body()).foregroundStyle(th.theme.text)
                            .lineLimit(1...4).padding(12).background(th.theme.field).clipShape(RoundedRectangle(cornerRadius: 16))
                        Button {
                            guard let uid = s.uid else { return }
                            let t = String(text.prefix(1000)); text = ""
                            Task { do { let ok = try await CareRepo.sendMessage(spaceId: model.space.id, text: t, from: uid); note = ok ? "" : "Saved on this phone. It will send when you are back online." }
                                catch { note = error.localizedDescription } }
                        } label: {
                            ZStack { Circle().fill(Brand.ink).frame(width: 48, height: 48); CareIcon(name: "send", size: 24, tint: .white, fill: false) }
                        }.accessibilityLabel("Send")
                        .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
                    }.padding(.horizontal, 20).padding(.vertical, 10)
                }
            }
            .onAppear { if let u = s.uid { CareRepo.markRead(uid: u, spaceId: model.space.id) } }
            .onChange(of: model.messages.count) { _ in if let u = s.uid { CareRepo.markRead(uid: u, spaceId: model.space.id) } }
        }
    }
}
