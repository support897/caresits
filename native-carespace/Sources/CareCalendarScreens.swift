import SwiftUI

// MARK: Calendar. Month grid, three views, add event, time off request, admin decision.

enum CalScope: String, CaseIterable { case mine = "Mine", family = "Family", team = "Team" }

struct CalendarHome: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @EnvironmentObject var ctx: CareContext
    @State private var scope: CalScope = .mine
    @State private var month = Date()
    @State private var day = Date()
    @State private var note = ""

    /// Mine: events I own. Family: school, activities, pickups and bookings. Team: shifts and time off.
    var scoped: [CalendarEvent] {
        ctx.events.filter { e in
            switch scope {
            case .mine: return e.ownerUid == (s.uid ?? "")
            case .family: return [.booking, .school, .activity, .pickup].contains(e.kind)
            case .team: return e.kind == .shift || e.kind == .timeoff
            }
        }
    }
    /// Repeating events are expanded for the month on screen, and the chosen day.
    var expanded: [CalendarEvent] {
        let cal = Calendar.current
        let first = cal.date(from: cal.dateComponents([.year, .month], from: month)) ?? month
        let last = cal.date(byAdding: .day, value: 40, to: first) ?? first
        let lo = min(first, day), hi = max(last, day)
        return CareCalendar.expand(scoped, from: lo, to: hi)
    }
    var dayEvents: [CalendarEvent] { CareCalendar.events(expanded, on: day) }
    let weekdays = ["S", "M", "T", "W", "T", "F", "S"]

    var body: some View {
        Screen {
            Picker("View", selection: $scope) { ForEach(CalScope.allCases, id: \.self) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented)
            HStack {
                Button { month = Calendar.current.date(byAdding: .month, value: -1, to: month) ?? month } label: { CareIcon(name: "chevron.left", size: 24, fill: false).frame(width: 44, height: 44) }.accessibilityLabel("Previous month")
                Spacer()
                Text(month.formatted(.dateTime.month(.wide).year())).font(Brand.title(22)).foregroundStyle(th.theme.text)
                Spacer()
                Button { month = Calendar.current.date(byAdding: .month, value: 1, to: month) ?? month } label: { CareIcon(name: "chevron.right", size: 24, fill: false).frame(width: 44, height: 44) }.accessibilityLabel("Next month")
            }
            let cells = CareCalendar.cells(for: month)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
                ForEach(0..<7, id: \.self) { i in Text(weekdays[i]).font(Brand.body(14)).foregroundStyle(th.theme.muted) }
                ForEach(0..<cells.count, id: \.self) { i in
                    if let d = cells[i] {
                        let isDay = Calendar.current.isDate(d, inSameDayAs: day)
                        let has = !CareCalendar.events(expanded, on: d).isEmpty
                        Button { day = d } label: {
                            VStack(spacing: 2) {
                                Text("\(Calendar.current.component(.day, from: d))").font(Brand.body(16)).foregroundStyle(isDay ? Color.white : th.theme.text)
                                Circle().fill(has ? (isDay ? Color.white : Brand.bunny) : Color.clear).frame(width: 6, height: 6)
                            }.frame(maxWidth: .infinity, minHeight: 46).background(isDay ? Brand.ink : th.theme.field.opacity(0.6)).clipShape(RoundedRectangle(cornerRadius: 12))
                        }.buttonStyle(.plain)
                    } else { Color.clear.frame(height: 46) }
                }
            }
            Heading(text: day.formatted(.dateTime.weekday(.wide).day().month(.wide)))
            if !note.isEmpty { Notice(text: note) }
            if dayEvents.isEmpty { BodyText(text: "Nothing on this day.", muted: true) }
            ForEach(dayEvents) { e in EventRow(event: e, base: ctx.events.first { $0.baseId == e.baseId && $0.spaceId == e.spaceId }, role: ctx.space(e.spaceId)?.role ?? .viewer, childName: ctx.children[e.spaceId]?.first { $0.id == e.childId }?.name ?? "", onDecide: { ok in decide(e, ok) }) }
            RowLink(icon: "plus", title: "Add to calendar", subtitle: "Shifts, bookings, school, pickups and time off") { AddEventView(day: day) }
        }
        .navigationTitle("Calendar")
        .task { if let u = s.uid { await ctx.load(uid: u) } }
    }

    func decide(_ e: CalendarEvent, _ approve: Bool) {
        Task {
            do { let ok = try await CareRepo.decide(spaceId: e.spaceId, eventId: e.baseId, approve: approve); note = SaveText.result(ok); if let u = s.uid { await ctx.load(uid: u) } }
            catch { note = error.localizedDescription }
        }
    }
}

struct EventRow: View {
    let event: CalendarEvent
    /// The saved event this row is a copy of (the same event when it does not repeat).
    var base: CalendarEvent? = nil
    let role: CareRole
    let childName: String
    var onDecide: (Bool) -> Void
    @EnvironmentObject var th: ThemeStore
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    CareIcon(name: event.kind.icon, size: 28)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(event.title).font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text)
                        Text("\(CareTime.clock(event.start)) to \(CareTime.clock(event.end))  \(event.kind.label)").font(Brand.body(15)).foregroundStyle(th.theme.muted)
                        let extra = [event.spaceName, childName].filter { !$0.isEmpty }.joined(separator: ", ")
                        if !extra.isEmpty { Text(extra).font(Brand.body(14)).foregroundStyle(th.theme.muted) }
                    }
                }
                if let r = event.recurring { Text(r.summary).font(Brand.body(15)).foregroundStyle(th.theme.muted) }
                if event.state == .requested { Text("Waiting for approval").font(Brand.body(16).weight(.semibold)).foregroundStyle(Brand.ink).padding(8).background(Brand.blush).clipShape(Capsule()) }
                if event.state == .approved { Text("Approved").font(Brand.body(16).weight(.semibold)).foregroundStyle(Brand.ink).padding(8).background(Brand.sky.opacity(0.6)).clipShape(Capsule()) }
                if event.state == .declined { Text("Declined").font(Brand.body(16).weight(.semibold)).foregroundStyle(th.theme.muted) }
                if let b = base, CareAccess.canPost(role), b.kind != .booking, b.kind != .timeoff {
                    NavigationLink { EditEventView(event: b, occurrenceDay: event.occurrenceDate) } label: {
                        HStack(spacing: 6) { CareIcon(name: "edit", size: 18, fill: false); Text(b.recurring == nil ? "Edit event" : "Edit series").font(Brand.body(16).weight(.semibold)).foregroundStyle(th.theme.text) }.frame(minHeight: 44)
                    }.buttonStyle(.plain)
                }
                if event.state == .requested && CareAccess.canManageTimeOff(role) {
                    HStack { BigButton(title: "Approve") { onDecide(true) }; BigButton(title: "Decline", tint: Brand.bunnyBlush) { onDecide(false) } }
                }
            }
        }
    }
}

struct AddEventView: View {
    let day: Date
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @EnvironmentObject var ctx: CareContext
    @Environment(\.dismiss) private var dismiss
    @State private var spaceId = ""
    @State private var kind: CalendarKind = .booking
    @State private var title = ""
    @State private var childId = ""
    @State private var date = Date()
    @State private var from = Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: Date()) ?? Date()
    @State private var to = Calendar.current.date(bySettingHour: 10, minute: 0, second: 0, of: Date()) ?? Date()
    @State private var error = ""
    @State private var busy = false
    @State private var repeats = false
    @State private var days: Set<String> = []
    @State private var daysTouched = false
    @State private var until = Date()

    var postable: [SpaceSummary] { ctx.spaces.filter { CareAccess.canPost($0.role) } }
    var current: SpaceSummary? { postable.first { $0.id == spaceId } ?? postable.first }
    var body: some View {
        Screen {
            Heading(text: "Add to calendar")
            if postable.isEmpty { Notice(text: "You need a care space where you can post.") }
            else {
                if postable.count > 1 {
                    Text("Space").font(Brand.body(15)).foregroundStyle(th.theme.muted)
                    ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(postable) { sp in Button { spaceId = sp.id } label: { Pill(title: sp.name, on: current?.id == sp.id) }.buttonStyle(.plain) } } }
                }
                Text("Kind").font(Brand.body(15)).foregroundStyle(th.theme.muted)
                ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(CalendarKind.allCases) { k in Button { kind = k } label: { Pill(title: k.label, icon: k.icon, on: kind == k) }.buttonStyle(.plain) } } }
                if kind == .timeoff && current?.role != .admin { Notice(text: "Time off goes to a family admin to approve.") }
                CareField(title: "Title", text: $title)
                if let kids = ctx.children[current?.id ?? ""], !kids.isEmpty {
                    Text("Child (optional)").font(Brand.body(15)).foregroundStyle(th.theme.muted)
                    ScrollView(.horizontal, showsIndicators: false) { HStack {
                        Button { childId = "" } label: { Pill(title: "None", on: childId.isEmpty) }.buttonStyle(.plain)
                        ForEach(kids) { c in Button { childId = c.id } label: { Pill(title: c.name, on: childId == c.id) }.buttonStyle(.plain) } } }
                }
                DatePicker("Day", selection: $date, displayedComponents: .date).font(Brand.body())
                DatePicker("Starts", selection: $from, displayedComponents: .hourAndMinute).font(Brand.body())
                DatePicker("Ends", selection: $to, displayedComponents: .hourAndMinute).font(Brand.body())
                if kind == .shift { repeatSection }
                ForEach(warnings, id: \.self) { Notice(text: "This overlaps \($0). You can still save it.", warn: true) }
                if !error.isEmpty { Notice(text: error, warn: true) }
                BigButton(title: kind == .timeoff && current?.role != .admin ? "Ask for time off" : "Add", busy: busy) { save() }
            }
        }
        .navigationTitle("Add event").navigationBarTitleDisplayMode(.inline)
        .onAppear { date = day; until = day; days = [weekdayName(day)] }
        .onChange(of: date) { _, d in if !daysTouched { days = [weekdayName(d)] }; if until < d { until = d } }
    }

    var recurrence: CalendarRecurrence? {
        guard kind == .shift, repeats else { return nil }
        return CalendarRecurrence(weekdays: CalendarRecurrence.names.filter { days.contains($0) }, until: CareTime.dayKey(until))
    }

    /// Overlaps are a warning only. They never stop the save.
    var warnings: [String] {
        guard let sp = current, kind == .shift || kind == .timeoff else { return [] }
        let (st, en) = CareCalendar.period(day: date, startTime: from, endTime: to)
        guard en > st else { return [] }
        let cand = CalendarEvent(id: "new", spaceId: sp.id, title: title, kind: kind, start: st, end: en, ownerUid: s.uid ?? "", childId: nil, state: .active, recurring: recurrence)
        return CareCalendar.conflicts(cand, with: ctx.events.filter { $0.spaceId == sp.id })
    }

    var repeatSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Toggle(isOn: $repeats) { HStack(spacing: 8) { CareIcon(name: "repeat", size: 22, fill: false); Text("Repeat this shift").font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text) } }
                .tint(Brand.ink).frame(minHeight: 44)
            if repeats {
                Text("Repeat on").font(Brand.body(15)).foregroundStyle(th.theme.muted)
                ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 8) {
                    ForEach(CalendarRecurrence.names, id: \.self) { n in
                        Button { daysTouched = true; if days.contains(n) { days.remove(n) } else { days.insert(n) } } label: { Pill(title: n, on: days.contains(n)) }.buttonStyle(.plain)
                            .accessibilityAddTraits(days.contains(n) ? .isSelected : [])
                    } } }
                HStack(spacing: 8) {
                    Button { daysTouched = true; days = Set(CalendarRecurrence.names) } label: { Pill(title: "Every day", on: false) }.buttonStyle(.plain)
                    Button { daysTouched = true; days = ["Mon", "Tue", "Wed", "Thu", "Fri"] } label: { Pill(title: "Weekdays", on: false) }.buttonStyle(.plain)
                    Button { daysTouched = true; days = [weekdayName(date)] } label: { Pill(title: "Weekly", on: false) }.buttonStyle(.plain)
                }
                DatePicker("Repeat until", selection: $until, in: date..., displayedComponents: .date).font(Brand.body())
            }
        }
    }

    func weekdayName(_ d: Date) -> String { CalendarRecurrence.names[Calendar.current.component(.weekday, from: d) - 1] }

    func save() {
        guard let uid = s.uid, let sp = current else { return }
        let (st, en) = CareCalendar.period(day: date, startTime: from, endTime: to)
        if kind == .shift, repeats, days.isEmpty { error = "Choose at least one day for this repeating shift."; return }
        busy = true; error = ""
        Task {
            do {
                _ = try await CareRepo.addEvent(spaceId: sp.id, title: title.isEmpty ? kind.label : title, kind: kind, start: st, end: en, childId: childId.isEmpty ? nil : childId, by: uid, role: sp.role, recurring: recurrence)
                await ctx.load(uid: uid); dismiss()
            } catch { self.error = error.localizedDescription }
            busy = false
        }
    }
}

// MARK: Edit one event, or a whole series. Nothing is deleted. Ending a series only moves its last day.

struct EditEventView: View {
    let event: CalendarEvent
    var occurrenceDay: String? = nil
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @EnvironmentObject var ctx: CareContext
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var kind: CalendarKind = .shift
    @State private var date = Date()
    @State private var from = Date()
    @State private var to = Date()
    @State private var days: Set<String> = []
    @State private var until = Date()
    @State private var error = ""
    @State private var note = ""
    @State private var busy = false
    @State private var loaded = false
    static let kinds: [CalendarKind] = [.shift, .school, .activity, .pickup]
    var role: CareRole { ctx.space(event.spaceId)?.role ?? .viewer }
    var editable: Bool { CareAccess.canPost(role) && event.kind != .booking && event.kind != .timeoff }

    var body: some View {
        Screen {
            Heading(text: event.recurring == nil ? "Edit event" : "Edit series")
            if !editable { Notice(text: "This role cannot edit this event.") }
            if event.recurring != nil { Notice(text: "Changes apply to the whole series. Past days stay as they are.") }
            CareField(title: "Event name", text: $title)
            ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(Self.kinds) { k in Button { kind = k } label: { Pill(title: k.label, icon: k.icon, on: kind == k) }.buttonStyle(.plain) } } }
            DatePicker(event.recurring == nil ? "Day" : "First day", selection: $date, displayedComponents: .date).font(Brand.body())
            DatePicker("Starts", selection: $from, displayedComponents: .hourAndMinute).font(Brand.body())
            DatePicker("Ends", selection: $to, displayedComponents: .hourAndMinute).font(Brand.body())
            if event.recurring != nil {
                Text("Repeat on").font(Brand.body(15)).foregroundStyle(th.theme.muted)
                ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 8) {
                    ForEach(CalendarRecurrence.names, id: \.self) { n in
                        Button { if days.contains(n) { days.remove(n) } else { days.insert(n) } } label: { Pill(title: n, on: days.contains(n)) }.buttonStyle(.plain)
                            .accessibilityAddTraits(days.contains(n) ? .isSelected : [])
                    } } }
                DatePicker("Repeat until", selection: $until, in: date..., displayedComponents: .date).font(Brand.body())
                if let d = occurrenceDay, let end = CareTime.dayDate(d) {
                    Button { until = end } label: { Pill(title: "End the series after \(end.shortDay)", icon: "repeat", on: false) }.buttonStyle(.plain)
                    BodyText(text: "That sets the last day. Nothing is deleted. Save to keep it.", muted: true)
                }
            }
            if !error.isEmpty { Notice(text: error, warn: true) }
            if !note.isEmpty { Notice(text: note) }
            if editable { BigButton(title: "Save changes", busy: busy) { save() } }
        }
        .navigationTitle("Edit event").navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard !loaded else { return }; loaded = true
            title = event.title; kind = Self.kinds.contains(event.kind) ? event.kind : .shift
            date = event.start; from = event.start; to = event.end
            if let r = event.recurring { days = Set(r.weekdays); until = CareTime.dayDate(r.until) ?? event.start }
        }
    }

    func save() {
        guard editable, let sp = ctx.space(event.spaceId) else { return }
        let t = title.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { error = "Add an event name."; return }
        let (st, en) = CareCalendar.period(day: date, startTime: from, endTime: to)
        guard en > st else { error = "End time must be after start time."; return }
        var next = event
        next.title = t; next.kind = kind; next.start = st; next.end = en
        if event.recurring != nil {
            guard !days.isEmpty else { error = "Choose at least one day for this repeating shift."; return }
            next.recurring = CalendarRecurrence(weekdays: CalendarRecurrence.names.filter { days.contains($0) }, until: CareTime.dayKey(until))
        }
        busy = true; error = ""
        Task {
            do {
                let ok = try await CareRepo.updateEvent(spaceId: sp.id, event: next)
                note = SaveText.result(ok)
                if let u = s.uid { await ctx.load(uid: u) }
                if ok { dismiss() }
            } catch { self.error = error.localizedDescription }
            busy = false
        }
    }
}
