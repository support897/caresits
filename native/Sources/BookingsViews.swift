import SwiftUI

@MainActor
final class BookingStore: ObservableObject {
    @Published var items: [Booking] = []
    @Published var people: [String: Person] = [:]
    @Published var loaded = false
    func load(_ me: Person) async {
        guard !me.id.isEmpty else { return }
        items = await Backend.bookings(me.id, side: me.side)
        for b in items { let o = me.side == "family" ? b.carerUid : b.familyUid; if people[o] == nil, let p = await Backend.loadProfile(o) { people[o] = p } }
        loaded = true
    }
    func other(_ b: Booking, me: Person) -> Person? { people[me.side == "family" ? b.carerUid : b.familyUid] }
}

struct BookingRow: View {
    @EnvironmentObject var s: Session
    let b: Booking; let other: Person?; var reload: () async -> Void
    @State private var busy = false; @State private var err = ""; @State private var showReview = false; @State private var reviewed = true
    @State private var showRecord = false; @State private var askCancel = false
    var me: Person { s.meSafe }
    var isCarer: Bool { me.side == "carer" }
    var ended: Bool { (Backend.endDate(b.date, b.to) ?? .distantFuture) < Date() }
    var started: Bool { (Backend.endDate(b.date, b.from) ?? .distantFuture) < Date() }
    var body: some View {
        Card { VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                PhotoView(key: other?.photoKey ?? "", size: 48, fallback: other?.role.icon ?? .bunny)
                VStack(alignment: .leading) { Text(other?.firstName ?? "…").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)); Text("\(pretty(b.dateValue)) · \(b.from)–\(b.to)").font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline)).foregroundStyle(Brand.muted) }
                Spacer(); IconLabel(icon: b.stateIcon, text: b.stateLabel, size: 15).font(.footnote.bold()).padding(.horizontal, 10).padding(.vertical, 5).background(b.state == "accepted" || b.state == "completed" ? Brand.signBooked : (b.state == "requested" ? Brand.rose : Color.clear)).clipShape(Capsule())
            }
            if b.estimate > 0 { IconLabel(icon: .rate, text: "About $\(Int(b.estimate))", size: 15).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)) }
            if !b.note.isEmpty { Text("“\(b.note)”").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).italic().foregroundStyle(Brand.muted) }
            if b.state == "cancelled" && !b.cancelledBy.isEmpty { Text(b.cancelledBy == me.id ? "You cancelled this booking." : "\(other?.firstName ?? "They") cancelled this booking.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted) }
            if PayConfig.visible {
                PayLines(b: b, isCarer: isCarer, otherName: other?.firstName ?? "them")
                if !isCarer && b.pay?.state == "held" { PayActions(b: b, reload: reload) }
                Button { showRecord = true } label: { IconLabel(icon: .doc, text: "Payment record", size: 16) }.font(.footnote.weight(.semibold)).accessibilityIdentifier("paymentRecord")
            }
            HStack {
                if isCarer && b.state == "requested" { act("Accept", "accepted", s.role.tint, icon: .check); act("Decline", "declined", Brand.field, ink: true) }
                if !isCarer && (b.state == "requested" || b.state == "accepted") {
                    if PayConfig.visible && b.state == "accepted" { Button { askCancel = true } label: { Text("Cancel").font(.subheadline.bold()).padding(.horizontal, 16).padding(.vertical, 10).background(Brand.field).foregroundStyle(Brand.ink).clipShape(Capsule()) } }
                    else { act("Cancel", "cancelled", Brand.field, ink: true) }
                }
                if isCarer && b.state == "accepted" && ended { act("Mark done", "completed", s.role.tint, icon: .sparkle) }
                if isCarer && b.state == "accepted" && started { act("Family did not show", "noshow", Brand.field, ink: true) }
                if isCarer && b.state == "accepted" && !ended { act("Cancel", "cancelled", Brand.field, ink: true) }
                if !isCarer && b.state == "completed" && !reviewed { Button { showReview = true } label: { Chip(text: "Leave a review", on: true, tint: s.role.tint, icon: .star) } }
            }
            if !err.isEmpty { Text(err).font(.custom("Atkinson Hyperlegible", size: 12, relativeTo: .caption)).foregroundStyle(Brand.ink) }
        } }
        .confirmationDialog(cancelWords, isPresented: $askCancel, titleVisibility: .visible) {
            Button("Cancel this booking", role: .destructive) { Task { busy = true; err = ""; do { try await Backend.transition(b, to: "cancelled", actorUid: me.id, actorIsCarer: isCarer); await reload() } catch { err = "That did not work. Please try again." }; busy = false } }
            Button("Keep it", role: .cancel) {}
        }
        .sheet(isPresented: $showRecord) { PaymentRecordSheet(b: b, otherName: other?.firstName ?? "them") }
        .sheet(isPresented: $showReview) { ReviewSheet(booking: b, name: other?.firstName ?? "your carer") { reviewed = true } }
        .task { if !isCarer && b.state == "completed" { reviewed = await Backend.hasReview(b) } }
    }
    /// Which step of the ladder this cancel is on, in plain words.
    var cancelWords: String {
        let start = Backend.endDate(b.date, b.from) ?? .distantFuture
        return start.timeIntervalSinceNow > 24 * 3600 ? "More than a day ahead. Cancelling is free." : "Inside a day. \(other?.firstName ?? "The carer") is paid half and the rest comes back to you."
    }
    func act(_ title: String, _ to: String, _ tint: Color, icon: BI? = nil, ink: Bool = false) -> some View {
        Button { Task { busy = true; err = ""; do { try await Backend.transition(b, to: to, actorUid: me.id, actorIsCarer: isCarer); await reload() } catch { err = "That did not work. Please try again." }; busy = false } } label: { HStack(spacing: 6) { if let icon { BrandIcon(kind: icon, size: 16, color: ink ? Brand.ink : Color(hex: 0x2D2A35), mono: true) }; Text(title) }.font(.subheadline.bold()).padding(.horizontal, 16).padding(.vertical, 10).background(tint).foregroundStyle(ink ? Brand.ink : Color(hex: 0x2D2A35)).clipShape(Capsule()) }.disabled(busy)
    }
    func pretty(_ d: Date) -> String { let f = DateFormatter(); f.dateFormat = "EEE d MMM"; return f.string(from: d) }
}

struct ReviewSheet: View {
    @Environment(\.dismiss) var dismiss
    let booking: Booking; let name: String; var done: () -> Void
    @State private var stars = 5; @State private var text = ""; @State private var busy = false; @State private var err = ""
    var body: some View {
        VStack(spacing: 16) {
            BunnyView(size: 90, mood: .encourage)
            Text("How was \(name)?").font(Brand.title(26)).foregroundStyle(Brand.titleColor)
            HStack { ForEach(1...5, id: \.self) { i in Button { stars = i } label: { BrandIcon(kind: .star, size: 34, color: Brand.bunny, solid: i <= stars) } } }
            TextField("Say something kind (optional)", text: $text, axis: .vertical).lineLimit(3...5).padding(14).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
            Text("Reviews can't be edited later.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
            if !err.isEmpty { Text(err).foregroundStyle(Brand.ink) }
            BigButton(title: "Save review", busy: busy) { Task { busy = true; do { try await Backend.addReview(booking, rating: stars, text: text); done(); dismiss() } catch { err = "Could not save. Please try again." }; busy = false } }
            Button("Not now") { dismiss() }
        }.padding(24).background(Brand.cream.ignoresSafeArea())
    }
}

/// Month calendar. Family: all bookings plus "new booking". Carers: bookings plus "my free days".
struct BookingsCalendarView: View {
    @EnvironmentObject var s: Session
    @StateObject private var store = BookingStore()
    @State private var month = Date(); @State private var selected = Date()
    @State private var showNew = false; @State private var showFree = false
    var role: Role { s.role }
    let cal = Calendar(identifier: .gregorian)
    var days: [Date?] {
        guard let start = cal.date(from: cal.dateComponents([.year, .month], from: month)), let range = cal.range(of: .day, in: .month, for: start) else { return [] }
        let lead = (cal.component(.weekday, from: start) + 5) % 7
        return Array(repeating: nil, count: lead) + range.compactMap { cal.date(byAdding: .day, value: $0 - 1, to: start) }
    }
    func list(on d: Date) -> [Booking] { store.items.filter { cal.isDate($0.dateValue, inSameDayAs: d) && $0.state != "declined" && $0.state != "cancelled" } }
    var body: some View {
        NavigationStack {
            ScrollView { VStack(spacing: 14) {
                Header(role: role, title: role == .auPair ? "My week" : "Calendar")
                Card { VStack(spacing: 8) {
                    HStack {
                        Button { month = cal.date(byAdding: .month, value: -1, to: month)! } label: { BrandIcon(kind: .chevron, size: 20).rotationEffect(.degrees(180)) }
                        Spacer(); Text(month, format: .dateTime.month(.wide).year()).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)); Spacer()
                        Button { month = cal.date(byAdding: .month, value: 1, to: month)! } label: { BrandIcon(kind: .chevron, size: 20) }
                    }
                    HStack { ForEach(["M", "T", "W", "T", "F", "S", "S"], id: \.self) { Text($0).font(.caption.bold()).frame(maxWidth: .infinity).foregroundStyle(Brand.muted) } }
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 6) {
                        ForEach(days.indices, id: \.self) { i in
                            if let d = days[i] {
                                let n = list(on: d); let sel = cal.isDate(d, inSameDayAs: selected)
                                Button { selected = d } label: {
                                    VStack(spacing: 2) {
                                        Text("\(cal.component(.day, from: d))").font(.custom("Atkinson Hyperlegible", size: 16).weight(sel ? .bold : .regular))
                                        Circle().fill(n.isEmpty ? .clear : (n.contains { $0.state == "requested" } ? Brand.rose : Brand.signBooked)).frame(width: 6, height: 6)
                                    }.frame(maxWidth: .infinity, minHeight: 42).background(sel ? role.soft : .clear).clipShape(RoundedRectangle(cornerRadius: 10)).foregroundStyle(cal.isDateInToday(d) ? role.tint : Brand.ink)
                                }
                            } else { Color.clear.frame(height: 42) }
                        }
                    }
                    HStack(spacing: 14) { HStack(spacing: 5) { Circle().fill(Brand.rose).frame(width: 9, height: 9); Text("Waiting") }; HStack(spacing: 5) { Circle().fill(Brand.signBooked).frame(width: 9, height: 9); Text("Booked") } }.font(.custom("Atkinson Hyperlegible", size: 12, relativeTo: .caption))
                } }.padding(.horizontal, 20)
                if role == .family { BigButton(title: "New booking", tint: role.tint, icon: .plus) { showNew = true }.padding(.horizontal, 20) }
                else { BigButton(title: "My free days and hours", tint: role.tint, icon: .clock) { showFree = true }.padding(.horizontal, 20) }
                let todays = list(on: selected)
                VStack(alignment: .leading, spacing: 10) {
                    Text(selected, format: .dateTime.weekday(.wide).day().month(.wide)).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)).padding(.horizontal, 20)
                    if !store.loaded { ProgressView().frame(maxWidth: .infinity) }
                    else if todays.isEmpty { EmptyHint(icon: .sun, text: role == .family ? "Nothing booked" : "Nothing booked") }
                    ForEach(todays) { b in BookingRow(b: b, other: store.other(b, me: s.meSafe)) { await store.load(s.meSafe) }.padding(.horizontal, 20) }
                }
            }.padding(.bottom, 100) }
            .background(Brand.cream.ignoresSafeArea()).refreshable { await store.load(s.meSafe) }.task { await store.load(s.meSafe) }
            .sheet(isPresented: $showNew, onDismiss: { Task { await store.load(s.meSafe) } }) { NewBookingPicker() }
            .sheet(isPresented: $showFree) { AvailabilityEditor() }
        }
    }
}

struct NewBookingPicker: View {
    @EnvironmentObject var s: Session
    @Environment(\.dismiss) var dismiss
    @State private var carers: [Person] = []; @State private var loaded = false; @State private var chosen: Person?
    var body: some View {
        NavigationStack {
            ScrollView { VStack(spacing: 12) {
                Text("Who would you like to book?").font(Brand.title(24)).foregroundStyle(Brand.titleColor).padding(.top, 8)
                if !loaded { ProgressView() } else if carers.isEmpty { EmptyHint(icon: .bunny, text: "No carers yet") }
                ForEach(carers) { c in Button { chosen = c } label: { PersonRow(person: c, saved: false, tint: s.role.tint) }.buttonStyle(.plain) }
            }.padding(20) }
            .background(Brand.cream.ignoresSafeArea()).toolbar { ToolbarItem(placement: .topBarLeading) { Button("Close") { dismiss() } } }
            .sheet(item: $chosen, onDismiss: { dismiss() }) { BookSheet(carer: $0) }
            .task { if let me = s.me { carers = await Backend.discover(me: me, services: me.services); loaded = true } }
        }
    }
}

struct AvailabilityEditor: View {
    @EnvironmentObject var s: Session
    @Environment(\.dismiss) var dismiss
    @State private var days: Set<String> = []; @State private var from = "08:00"; @State private var to = "17:00"; @State private var busy = false; @State private var err = ""
    var body: some View {
        VStack(spacing: 16) {
            Text("When are you free?").font(Brand.title(26)).foregroundStyle(Brand.titleColor).padding(.top, 20)
            FlowChips(items: allDays, selected: $days, tint: s.role.tint)
            HStack { picker("From", $from); picker("To", $to) }
            if !err.isEmpty { Text(err).foregroundStyle(Brand.ink) }
            BigButton(title: "Save", tint: s.role.tint, busy: busy) { Task {
                busy = true; defer { busy = false }
                let sched: [String: Any] = Dictionary(uniqueKeysWithValues: days.map { ($0, ["from": from, "to": to] as [String: Any]) })
                do { try await Backend.saveProfile((s.uid ?? ""), card: ["availability": sched]); await s.reload(); dismiss() } catch { err = "Could not save. Try again." }
            } }
            Spacer()
        }.padding(20).background(Brand.cream.ignoresSafeArea())
        .onAppear { days = Set(s.me?.days ?? []) }
    }
    func picker(_ t: String, _ b: Binding<String>) -> some View {
        let times = stride(from: 5, through: 23, by: 1).flatMap { h in ["00", "30"].map { String(format: "%02d:%@", h, $0) } }
        return Picker(t, selection: b) { ForEach(times, id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu).padding(6).background(Brand.card).clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

/// Carers: every request waiting for an answer, newest first, plus what is confirmed next.
struct RequestsView: View {
    @EnvironmentObject var s: Session
    @StateObject private var store = BookingStore()
    var role: Role { s.role }
    var body: some View {
        NavigationStack {
            ScrollView { VStack(alignment: .leading, spacing: 12) {
                Header(role: role, title: "Requests")
                let waiting = store.items.filter { $0.state == "requested" }
                let coming = store.items.filter { $0.state == "accepted" }
                if !store.loaded { ProgressView().frame(maxWidth: .infinity).padding(30) }
                else if waiting.isEmpty && coming.isEmpty { EmptyHint(icon: .tray, text: "No requests yet") }
                if !waiting.isEmpty { IconLabel(icon: .clock, text: "Waiting for you", size: 18).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)).padding(.horizontal, 20); ForEach(waiting) { b in BookingRow(b: b, other: store.other(b, me: s.meSafe)) { await store.load(s.meSafe) }.padding(.horizontal, 20) } }
                if !coming.isEmpty { IconLabel(icon: .checkCircle, text: "Confirmed", size: 18).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)).padding(.horizontal, 20); ForEach(coming) { b in BookingRow(b: b, other: store.other(b, me: s.meSafe)) { await store.load(s.meSafe) }.padding(.horizontal, 20) } }
            }.padding(.bottom, 100) }
            .background(Brand.cream.ignoresSafeArea()).refreshable { await store.load(s.meSafe) }.task { await store.load(s.meSafe) }
        }
    }
}

/// Nanny home: what is on today, this week, and a simple earnings estimate.
struct TodayView: View {
    @EnvironmentObject var s: Session
    @StateObject private var store = BookingStore()
    let cal = Calendar.current
    var body: some View {
        NavigationStack {
            ScrollView { VStack(alignment: .leading, spacing: 12) {
                Header(role: .nanny, title: "Hello, \(s.me?.firstName ?? "")")
                let mine = store.items.filter { $0.state == "accepted" || $0.state == "completed" }
                let week = mine.filter { cal.isDate($0.dateValue, equalTo: Date(), toGranularity: .weekOfYear) }
                HStack(spacing: 12) {
                    stat(.tray, "\(store.items.filter { $0.state == "requested" }.count)", "new requests")
                    stat(.calendar, "\(week.count)", "jobs this week")
                    stat(.rate, "$\(Int(week.reduce(0) { $0 + $1.estimate }))", "this week")
                }.padding(.horizontal, 20)
                IconLabel(icon: .sun, text: "Today", size: 18).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)).padding(.horizontal, 20)
                let today = mine.filter { cal.isDateInToday($0.dateValue) }
                if !store.loaded { ProgressView().frame(maxWidth: .infinity) }
                else if today.isEmpty { EmptyHint(icon: .nanny, text: "Nothing today") }
                ForEach(today) { b in BookingRow(b: b, other: store.other(b, me: s.meSafe)) { await store.load(s.meSafe) }.padding(.horizontal, 20) }
                let up = mine.filter { $0.dateValue > Date() && !cal.isDateInToday($0.dateValue) && $0.state == "accepted" }.prefix(4)
                if !up.isEmpty { IconLabel(icon: .arrow, text: "Coming up", size: 18).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold)).padding(.horizontal, 20); ForEach(Array(up)) { b in BookingRow(b: b, other: store.other(b, me: s.meSafe)) { await store.load(s.meSafe) }.padding(.horizontal, 20) } }
            }.padding(.bottom, 100) }
            .background(Brand.cream.ignoresSafeArea()).refreshable { await store.load(s.meSafe) }.task { await store.load(s.meSafe) }
        }
    }
    func stat(_ e: BI, _ v: String, _ l: String) -> some View { Card { VStack { BrandIcon(kind: e, size: 30); Text(v).font(.title2.bold()); Text(l).font(.custom("Atkinson Hyperlegible", size: 12, relativeTo: .caption)).foregroundStyle(Brand.muted) }.frame(maxWidth: .infinity) } }
}
