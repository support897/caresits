import SwiftUI

// MARK: Items 20-35 — the daily place and its pages.
// Today is the one daily place (item 21): the timeline stands
// there, calendar happenings flow in there, and the photo ask
// (item 20) lives there too — one home, settled in this file's
// header: an ask is a day item of kind photo carrying an ask;
// the answer is the photo itself, added to the day and the
// album (item 23, the gallery the photos already feed).
// The pages below hang off Today: roster, timesheet, shopping,
// reminders, emergency, checks, recently deleted.

// Date.shortDay stands in CareUI.swift (the house helper) —
// this file uses it, never redeclares it.

// MARK: Item 26 — Roster: the team's week, from the calendar.

struct RosterView: View {
    @ObservedObject var model: SpaceModel
    var weekEvents: [CalendarEvent] {
        let cal = Calendar.current
        let start = cal.date(from: cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: Date())) ?? Date()
        let end = cal.date(byAdding: .day, value: 7, to: start) ?? start
        return CareCalendar.expand(model.events, from: start, to: end)
            .filter { $0.start >= start && $0.start < end }
            .sorted { $0.start < $1.start }
    }
    var body: some View {
        Screen {
            Heading(text: "This week")
            if weekEvents.isEmpty {
                EmptyState(title: "Nothing on the roster", detail: "Shifts and bookings for this week stand here.")
            }
            ForEach(weekEvents) { e in
                Card {
                    HStack(spacing: 10) {
                        CareIcon(name: e.kind.icon, size: 24)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(e.title).font(Brand.body(17).weight(.semibold))
                            Text("\(e.start.shortDay) · \(CareTime.clock(e.start)) to \(CareTime.clock(e.end))")
                                .font(Brand.body(14))
                            Text(nameOf(e.ownerUid)).font(Brand.body(14))
                            if e.state == .requested { Text("Waiting for an answer").font(Brand.body(14)) }
                            if e.state == .declined { Text("Declined — the calendar did not change").font(Brand.body(14)) }
                        }
                    }
                }
            }
            // Item 22: sick on the day names its own faster shape —
            // one tap raises today's time-off request; the other
            // side's accept is what moves the roster (the calendar
            // decide flow), a decline leaves both calendars as they
            // were. Time off and meeting-place changes ride the
            // calendar's own request + edit flows.
            if let uid = sUid {
                BigButton(title: "Tell the team I am sick today") {
                    let cal = Calendar.current
                    let start = cal.startOfDay(for: Date())
                    let end = cal.date(byAdding: .day, value: 1, to: start) ?? start
                    Task {
                        _ = try? await CareRepo.addEvent(spaceId: model.space.id, title: "Sick today", kind: .timeoff,
                                                         start: start, end: end, childId: nil, by: uid, role: model.space.role)
                        sickNote = "Sent. The team sees it straight away."
                    }
                }
                if let sickNote { BodyText(text: sickNote, muted: true) }
            }
        }
        .navigationTitle("Roster")
        .navigationBarTitleDisplayMode(.inline)
    }
    @EnvironmentObject var s: Session
    @State private var sickNote: String?
    var sUid: String? { s.uid }
    func nameOf(_ uid: String) -> String { model.members.first(where: { $0.id == uid })?.shownName ?? "" }
}

// MARK: Item 27 — Timesheet: worked hours from roster shifts.

struct TimesheetView: View {
    @ObservedObject var model: SpaceModel
    /// Family sees only their own carers: this page stands inside
    /// one space, and its members are that space's team — nobody
    /// else's hours can appear here.
    var rows: [(name: String, hours: Double)] {
        let cal = Calendar.current
        let start = cal.date(from: cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: Date())) ?? Date()
        let end = cal.date(byAdding: .day, value: 7, to: start) ?? start
        var totals: [String: Double] = [:]
        for e in CareCalendar.expand(model.events, from: start, to: end)
        where e.kind == .shift && (e.state == .active || e.state == .approved) && e.start >= start && e.start < end {
            totals[e.ownerUid, default: 0] += e.end.timeIntervalSince(e.start) / 3600
        }
        return model.members.map { (name: $0.shownName, hours: totals[$0.id] ?? 0) }
            .filter { $0.hours > 0 }.sorted { $0.hours > $1.hours }
    }
    var body: some View {
        Screen {
            Heading(text: "Hours this week")
            if rows.isEmpty {
                EmptyState(title: "No hours yet", detail: "Worked hours from this week's shifts stand here.")
            }
            ForEach(Array(rows.enumerated()), id: \.offset) { _, r in
                Card {
                    HStack {
                        Text(r.name).font(Brand.body(17).weight(.semibold))
                        Spacer()
                        Text(String(format: "%.1f h", r.hours)).font(Brand.body(17))
                    }
                }
            }
            BodyText(text: "Counted from the shifts on the roster, this week only.", muted: true)
        }
        .navigationTitle("Timesheet")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: Item 30 — Shopping: the brief's own fields, word for word:
// item, family, child, source, who buys, due date, bought,
// reimbursed. Lists never mix across families: this page stands
// inside one care space and reads only that space's list.

struct ShoppingView: View {
    @ObservedObject var model: SpaceModel
    @EnvironmentObject var s: Session
    @State private var items: [ShoppingItem] = []
    @State private var name = ""
    @State private var note: String?
    var body: some View {
        Screen {
            Heading(text: "Shopping for \(model.space.name)")
            if items.isEmpty {
                EmptyState(title: "Nothing to buy", detail: "Things the day needs stand here — activity materials land here on their own.")
            }
            ForEach(items) { it in
                Card {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(it.name).font(Brand.body(17).weight(.semibold))
                        if !it.source.isEmpty { BodyText(text: "For: \(it.source)", muted: true) }
                        if let cid = it.childId, let c = model.children.first(where: { $0.id == cid }) {
                            BodyText(text: "Child: \(c.name)", muted: true)
                        }
                        if !it.buyByName.isEmpty { BodyText(text: "Who buys: \(it.buyByName)", muted: true) }
                        if !it.due.isEmpty { BodyText(text: "Due: \(it.due)", muted: true) }
                        HStack(spacing: 10) {
                            PillButton(title: it.bought ? "Bought" : "To buy", on: it.bought) {
                                var x = it; x.bought.toggle()
                                Task { _ = await CareRepo.updateShopping(spaceId: model.space.id, item: x); await reload() }
                            }
                            PillButton(title: it.reimbursed ? "Reimbursed" : "Not reimbursed", on: it.reimbursed) {
                                var x = it; x.reimbursed.toggle()
                                Task { _ = await CareRepo.updateShopping(spaceId: model.space.id, item: x); await reload() }
                            }
                        }
                    }
                }
            }
            CareField(title: "Add something to buy", text: $name)
            BigButton(title: "Add to the list") {
                let n = name.trimmingCharacters(in: .whitespaces)
                guard !n.isEmpty else { return }
                Task {
                    _ = await CareRepo.addShopping(spaceId: model.space.id,
                                                   item: ShoppingItem(name: n, childId: nil, source: "Added by hand",
                                                                      buyByName: "", due: "", bought: false, reimbursed: false))
                    name = ""; await reload()
                }
            }
            if let note { BodyText(text: note, muted: true) }
        }
        .navigationTitle("Shopping")
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
    }
    func reload() async { items = await CareRepo.shopping(spaceId: model.space.id) }
}

// MARK: Item 28 — Reminders: the forward list. Booking starts,
// pickups, medication times, decisions waiting. Item 11's push
// is this list's delivery leg; the kinds are switchable in
// Settings, one by one (item 35).

struct RemindersView: View {
    @ObservedObject var model: SpaceModel
    var upcoming: [CalendarEvent] {
        let now = Date()
        let end = Calendar.current.date(byAdding: .day, value: 7, to: now) ?? now
        return CareCalendar.expand(model.events, from: now, to: end)
            .filter { $0.start >= now && $0.start < end && ($0.state == .active || $0.state == .approved) }
            .sorted { $0.start < $1.start }
    }
    var waiting: [CalendarEvent] { model.events.filter { $0.state == .requested }.sorted { $0.start < $1.start } }
    var openAsks: [TimelineItem] { model.items.filter { $0.asks.contains { !$0.answered } } }
    var body: some View {
        Screen {
            Heading(text: "Coming up")
            if upcoming.isEmpty && waiting.isEmpty && openAsks.isEmpty {
                EmptyState(title: "Nothing waiting", detail: "Bookings, pickups and decisions waiting stand here.")
            }
            ForEach(upcoming) { e in
                Card {
                    HStack(spacing: 10) {
                        CareIcon(name: e.kind.icon, size: 24)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(e.title).font(Brand.body(17).weight(.semibold))
                            Text("\(e.start.shortDay) · \(CareTime.clock(e.start))").font(Brand.body(14))
                        }
                    }
                }
            }
            if !waiting.isEmpty {
                Heading(text: "Decisions waiting")
                ForEach(waiting) { e in
                    Card {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(e.title).font(Brand.body(17).weight(.semibold))
                            Text("\(e.start.shortDay) · asked by \(model.members.first(where: { $0.id == e.ownerUid })?.shownName ?? "a team member")")
                                .font(Brand.body(14))
                        }
                    }
                }
            }
            if !openAsks.isEmpty {
                Heading(text: "Asks waiting")
                ForEach(openAsks) { it in
                    ForEach(it.asks.filter { !$0.answered }, id: \.at) { a in
                        Card { BodyText(text: a.text) }
                    }
                }
            }
            BodyText(text: "Medication times stand on the child's page, with the medication record.", muted: true)
        }
        .navigationTitle("Reminders")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: Item 32 — Emergency: contacts + the child's important
// info, together, big. It stands ON the three separate medical
// records and reads them — it never becomes a fourth record.
// Only the child's own team sees it (this page lives inside the
// space, behind the same access gates as the medical pages).

struct EmergencyHubView: View {
    @ObservedObject var model: SpaceModel
    @State private var childId: String?
    var child: ChildProfile? { model.children.first(where: { $0.id == childId }) ?? model.children.first }
    var body: some View {
        Screen {
            Heading(text: "Emergency")
            if model.children.count > 1 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack { ForEach(model.children) { c in PillButton(title: c.name, on: child?.id == c.id) { childId = c.id } } }
                }
            }
            if let c = child {
                let allergies = model.allergyNames[c.id] ?? []
                if !allergies.isEmpty {
                    Text("Allergy alert: \(allergies.joined(separator: ", "))")
                        .font(Brand.title(22)).foregroundStyle(Brand.ink)
                        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                        .background(Brand.blush).clipShape(RoundedRectangle(cornerRadius: 14))
                }
                EmergencyContactsCard(space: model.space, child: c)
                BodyText(text: "Medication and full details stand on \(c.name)'s page, each as its own record.", muted: true)
            } else {
                EmptyState(title: "No children yet", detail: "Emergency details stand here for each child.")
            }
        }
        .navigationTitle("Emergency")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct EmergencyContactsCard: View {
    let space: SpaceSummary
    let child: ChildProfile
    @State private var contacts: [EmergencyContact] = []
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Text(child.name).font(Brand.title(24))
                if contacts.isEmpty { BodyText(text: "No emergency contacts on file yet.", muted: true) }
                ForEach(contacts) { ct in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(ct.name).font(Brand.body(20).weight(.semibold))
                        if !ct.relationship.isEmpty { Text(ct.relationship).font(Brand.body(17)) }
                        if !ct.phone.isEmpty { Text(ct.phone).font(Brand.body(20)) }
                    }
                }
            }
        }
        .task { contacts = (await CareRepo.loadEmergency(spaceId: space.id, childId: child.id))?.contacts ?? [] }
    }
}

// MARK: Item 34 — Checks: each team member's checks, with status
// and dates. The word "verified" stands only where a real check
// stands in the member's record (brief rule 1) — this page reads
// the check records Caresitters keeps on the shared profile and
// invents nothing: no record reads "No check on record".

struct ChecksView: View {
    @ObservedObject var model: SpaceModel
    @State private var byMember: [String: [ProfileCheck]] = [:]
    var body: some View {
        Screen {
            Heading(text: "Checks")
            BodyText(text: "Checks stand as the records hold them. A check is called verified only when a real check stands behind it.", muted: true)
            ForEach(model.members) { m in
                Card {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(m.shownName).font(Brand.body(18).weight(.semibold))
                        let checks = byMember[m.id] ?? []
                        if checks.isEmpty { BodyText(text: "No check on record.", muted: true) }
                        ForEach(checks) { c in
                            HStack {
                                Text(c.name).font(Brand.body(16))
                                Spacer()
                                Text(c.status == "verified" ? "Verified" : c.status.capitalized).font(Brand.body(15))
                            }
                            if !c.date.isEmpty { BodyText(text: c.date, muted: true) }
                        }
                    }
                }
            }
        }
        .navigationTitle("Checks")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            for m in model.members { byMember[m.id] = await Backend.loadChecks(m.id) }
        }
    }
}

// MARK: Item 29 — Recently Deleted: a 30-day restorable bin.
// Only day items land here in this round. Deletion stays the
// family's alone: restore any time inside 30 days; after 30
// days an entry leaves the bin list, and "delete for good" is a
// person's tap, never a sweeper.

struct DeletedView: View {
    @ObservedObject var model: SpaceModel
    @EnvironmentObject var s: Session
    @State private var entries: [DeletedEntry] = []
    @State private var note: String?
    var body: some View {
        Screen {
            Heading(text: "Recently deleted")
            BodyText(text: "Deleted day entries rest here for 30 days. Put one back with Restore.", muted: true)
            if entries.isEmpty {
                EmptyState(title: "Nothing here", detail: "Things deleted from the day pages rest here for 30 days.")
            }
            ForEach(entries) { e in
                Card {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(e.text).font(Brand.body(17).weight(.semibold))
                        BodyText(text: "Deleted \(e.deletedAt.shortDay)", muted: true)
                        HStack(spacing: 10) {
                            PillButton(title: "Restore", on: false) {
                                Task { note = await CareRepo.restoreDeleted(spaceId: model.space.id, entry: e) ? "Put back on the day page." : "Could not restore."; await reload() }
                            }
                            if model.space.role == .admin {
                                PillButton(title: "Delete for good", on: false) {
                                    Task { _ = await CareRepo.purgeDeleted(spaceId: model.space.id, entry: e); await reload() }
                                }
                            }
                        }
                    }
                }
            }
            if let note { BodyText(text: note, muted: true) }
        }
        .navigationTitle("Recently deleted")
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
    }
    func reload() async { entries = await CareRepo.deletedEntries(spaceId: model.space.id) }
}
