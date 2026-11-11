import SwiftUI

// MARK: Care tab and child profiles. Six sections. Medical is three separate records, never one document.

struct CareHome: View {
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @EnvironmentObject var ctx: CareContext
    var body: some View {
        Screen {
            if !ctx.loaded { ProgressView().frame(maxWidth: .infinity).padding(30) }
            else if ctx.spaces.isEmpty { EmptyState(title: "No care spaces yet", detail: "Make a space in Chats, then add your children here.") }
            ForEach(ctx.spaces) { sp in
                VStack(alignment: .leading, spacing: 12) {
                    Text(sp.name).font(Brand.title(22)).foregroundStyle(th.theme.text)
                    let kids = ctx.children[sp.id] ?? []
                    if kids.isEmpty { Body(text: "No children in this space yet.", muted: true) }
                    ForEach(kids) { c in
                        RowLink(icon: "care", title: c.name, subtitle: subtitle(c)) { ChildView(space: sp, child: c) }
                    }
                    if CareAccess.canEditChildDetails(sp.role) { RowLink(icon: "plus", title: "Add a child") { AddChildView(space: sp) } }
                }
            }
        }
        .navigationTitle("Care")
        .task { if let u = s.uid { await ctx.load(uid: u) } }
    }
    func subtitle(_ c: ChildProfile) -> String {
        var parts: [String] = []
        if c.ageYears > 0 { parts.append("Age \(c.ageText)") }
        if let a = ctx.allergyNames[c.id], !a.isEmpty { parts.append("Allergies: \(a.joined(separator: ", "))") }
        return parts.joined(separator: ". ")
    }
}

struct AddChildView: View {
    let space: SpaceSummary
    @EnvironmentObject var s: Session
    @EnvironmentObject var ctx: CareContext
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var age = ""
    @State private var interests = ""
    @State private var error = ""
    @State private var busy = false
    var body: some View {
        Screen {
            Heading(text: "Add a child")
            if !CareAccess.canEditChildDetails(space.role) { Notice(text: "Only a family admin can add a child.") }
            CareField(title: "Name", text: $name)
            CareField(title: "Age in years", text: $age, keyboard: .decimalPad)
            CareField(title: "Interests (separate with commas)", text: $interests)
            Body(text: "Allergies, medicine and emergency details are added next, each on its own page.", muted: true)
            if !error.isEmpty { Notice(text: error, warn: true) }
            BigButton(title: "Save child", busy: busy) {
                guard CareAccess.canEditChildDetails(space.role), let uid = s.uid else { return }
                let n = name.trimmingCharacters(in: .whitespaces)
                guard !n.isEmpty else { error = "Add a name."; return }
                guard let a = Double(age.replacingOccurrences(of: ",", with: ".")), a >= 0, a <= 30 else { error = "Age must be a number from 0 to 30."; return }
                var c = ChildProfile(id: "", name: String(n.prefix(60)), ageYears: a)
                c.interests = CareText.list(interests, maxItems: 20, maxLength: 40)
                busy = true; error = ""
                Task {
                    do { _ = try await CareRepo.saveChild(spaceId: space.id, child: c, by: uid); await ctx.load(uid: uid); dismiss() }
                    catch { self.error = error.localizedDescription }
                    busy = false
                }
            }
        }
        .navigationTitle("Add child").navigationBarTitleDisplayMode(.inline)
    }
}

enum ChildPage: Hashable { case health, meals, sleep, mood, learning, memories
    var title: String { switch self { case .health: return "Health and safety"; case .meals: return "Meals"; case .sleep: return "Sleep and routine"; case .mood: return "Mood"; case .learning: return "Learning"; case .memories: return "Memories" } }
    var icon: String { switch self { case .health: return "shield"; case .meals: return "meal"; case .sleep: return "nap"; case .mood: return "mood"; case .learning: return "activity"; case .memories: return "photo" } }
    var section: ChildSection? { switch self { case .health: return .health; case .meals: return .meals; case .sleep: return .sleep; case .mood: return .mood; case .learning: return .learning; case .memories: return nil } }
}

struct ChildView: View {
    let space: SpaceSummary
    let child: ChildProfile
    @EnvironmentObject var th: ThemeStore
    @State private var allergies: [String]? = nil
    var body: some View {
        Screen {
            HStack(spacing: 14) {
                BunnyView(size: 64)
                VStack(alignment: .leading) {
                    Text(child.name).font(Brand.title(28)).foregroundStyle(th.theme.text)
                    if child.ageYears > 0 { Body(text: "Age \(child.ageText)", muted: true) }
                }
            }
            if let a = allergies, !a.isEmpty { Notice(text: "Allergy alert. Allergies: \(a.joined(separator: ", ")). Check labels and ask the parent before serving.", warn: true) }
            if CareAccess.canReadEmergency(space.role, space.perms) {
                RowLink(icon: "phone", title: "Emergency sheet", subtitle: "Contacts, doctor and notes") { EmergencyView(space: space, child: child) }
            }
            ForEach([ChildPage.health, .meals, .sleep, .mood, .learning, .memories], id: \.self) { p in
                RowLink(icon: p.icon, title: p.title, subtitle: summary(p)) { ChildSectionPage(space: space, child: child, page: p) }
            }
        }
        .navigationTitle(child.name).navigationBarTitleDisplayMode(.inline)
        .task { if CareAccess.canReadAllergies(space.role, space.perms) { allergies = (await CareRepo.loadAllergies(spaceId: space.id, childId: child.id))?.map { $0.name }.filter { !$0.isEmpty } } }
    }
    func summary(_ p: ChildPage) -> String {
        if let sec = p.section { return String((child.notes[sec] ?? "").prefix(60)) }
        return child.memories.first.map { String($0.prefix(60)) } ?? ""
    }
}

struct ChildSectionPage: View {
    let space: SpaceSummary
    let child: ChildProfile
    let page: ChildPage
    @EnvironmentObject var s: Session
    @EnvironmentObject var th: ThemeStore
    @EnvironmentObject var ctx: CareContext
    @State private var notes = ""
    @State private var list = ""
    @State private var wake = ""
    @State private var bed = ""
    @State private var naps: [ChildNap] = []
    @State private var milestone = ""
    @State private var note = ""
    @State private var loaded = false
    var canEdit: Bool { page == .memories ? CareAccess.canPost(space.role) : CareAccess.canEditNotes(space.role) }

    var body: some View {
        Screen {
            Heading(text: page.title)
            if let sec = page.section { Body(text: sec.hint, muted: true) }
            if page == .health {
                RowLink(icon: "pills", title: "Medical details", subtitle: "Allergies, medication and emergency. Each is its own record.") { MedicalView(space: space, child: child) }
            }
            if page.section != nil {
                CareField(title: "Notes", text: $notes, lines: 5).disabled(!canEdit).opacity(canEdit ? 1 : 0.8)
            }
            if page == .meals { CareField(title: "Food preferences (separate with commas)", text: $list, lines: 2).disabled(!canEdit) }
            if page == .learning { CareField(title: "Learning goals (separate with commas)", text: $list, lines: 2).disabled(!canEdit) }
            if page == .sleep {
                HStack { CareField(title: "Wake up (HH:MM)", text: $wake).disabled(!canEdit); CareField(title: "Bedtime (HH:MM)", text: $bed).disabled(!canEdit) }
                ForEach(naps.indices, id: \.self) { i in
                    HStack { CareField(title: "Nap from", text: Binding(get: { naps[i].from }, set: { naps[i].from = $0 })); CareField(title: "Nap to", text: Binding(get: { naps[i].to }, set: { naps[i].to = $0 })) }
                }
                if canEdit && naps.count < 4 { Button("Add a nap") { naps.append(ChildNap(from: "", to: "")) }.font(Brand.body().weight(.semibold)).frame(minHeight: 44) }
            }
            if page == .memories {
                CareField(title: "Memories (one per line)", text: $list, lines: 4).disabled(!canEdit)
                if !child.milestones.isEmpty {
                    Text("Milestones").font(Brand.title(20)).foregroundStyle(th.theme.text)
                    ForEach(Array(child.milestones.enumerated()), id: \.offset) { _, m in
                        Card { VStack(alignment: .leading) { Text(m.title).font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text); Text(m.at.shortDay).font(Brand.body(15)).foregroundStyle(th.theme.muted); if !m.note.isEmpty { Body(text: m.note) } } }
                    }
                }
                if canEdit { CareField(title: "New milestone (optional)", text: $milestone) }
            }
            if !note.isEmpty { Notice(text: note) }
            if canEdit { BigButton(title: "Save") { save() } } else { Body(text: "You can read this page. A carer or admin can change it.", muted: true) }
        }
        .navigationTitle(page.title).navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard !loaded else { return }; loaded = true
            if let sec = page.section { notes = child.notes[sec] ?? "" }
            switch page {
            case .meals: list = child.foodPreferences.joined(separator: ", ")
            case .learning: list = child.learningGoals.joined(separator: ", ")
            case .memories: list = child.memories.joined(separator: "\n")
            case .sleep: wake = child.wake; bed = child.bed; naps = child.naps
            default: break
            }
        }
    }

    func save() {
        guard let uid = s.uid else { return }
        if page == .sleep {
            for t in [wake, bed] where !t.isEmpty && !CareText.isTime(t) { note = "Times look like 07:30."; return }
            for n in naps where (!n.from.isEmpty || !n.to.isEmpty) && !(CareText.isTime(n.from) && CareText.isTime(n.to)) { note = "Nap times look like 13:00."; return }
        }
        Task {
            // Start from the newest saved child, so an older screen never wipes another carer's change.
            var c = await CareRepo.child(spaceId: space.id, id: child.id) ?? child
            if let sec = page.section { c.notes[sec] = notes }
            switch page {
            case .meals: c.foodPreferences = CareText.list(list, maxItems: 30, maxLength: 60)
            case .learning: c.learningGoals = CareText.list(list, maxItems: 30, maxLength: 60)
            case .memories:
                c.memories = list.split(separator: "\n").map { String($0).trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.prefix(50).map { String($0.prefix(300)) }
                if !milestone.trimmingCharacters(in: .whitespaces).isEmpty { c.milestones.append(ChildMilestone(title: String(milestone.prefix(80)), at: Date(), note: "")); milestone = "" }
            case .sleep: c.wake = wake; c.bed = bed; c.naps = naps.filter { !$0.from.isEmpty && !$0.to.isEmpty }
            default: break
            }
            do { let ok = try await CareRepo.saveChild(spaceId: space.id, child: c, by: uid); note = SaveText.result(ok); await ctx.load(uid: uid) }
            catch { note = error.localizedDescription }
        }
    }
}

// MARK: Medical. Three records. Each one saves alone and raises its own team alert.

struct MedicalView: View {
    let space: SpaceSummary
    let child: ChildProfile
    var body: some View {
        Screen {
            Heading(text: "Medical for \(child.name)")
            Notice(text: "Every change to these records sends a team alert. This is not medical advice.")
            if CareAccess.canReadAllergies(space.role, space.perms) { AllergyCard(space: space, child: child) }
            if CareAccess.canReadMedication(space.role, space.perms) { MedicationCard(space: space, child: child) }
            if CareAccess.canReadEmergency(space.role, space.perms) { EmergencyCard(space: space, child: child) }
            if !CareAccess.canReadMedical(space.role, space.perms) { EmptyState(title: "Medical is closed for you", detail: "A family admin can open allergies or medication for you.") }
        }
        .navigationTitle("Medical").navigationBarTitleDisplayMode(.inline)
    }
}

struct MedicalCardFrame<Content: View>: View {
    let section: MedicalSection
    let canEdit: Bool
    @Binding var editing: Bool
    let status: String
    var onSave: () -> Void
    @ViewBuilder var content: Content
    @EnvironmentObject var th: ThemeStore
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack { CareIcon(name: section.icon, size: 28); Text(section.title).font(Brand.title(22)).foregroundStyle(th.theme.text); Spacer()
                    if canEdit && !editing { Button("Edit") { editing = true }.font(Brand.body(17).weight(.semibold)).frame(minWidth: 44, minHeight: 44) } }
                content
                if !status.isEmpty { Notice(text: status, warn: status == SaveText.medicalUnconfirmed) }
                if editing { BigButton(title: "Save \(section.title.lowercased())") { onSave() } }
                if !canEdit { Text("Only a family admin can change this.").font(Brand.body(15)).foregroundStyle(th.theme.muted) }
            }
        }
    }
}

struct AllergyCard: View {
    let space: SpaceSummary
    let child: ChildProfile
    @EnvironmentObject var s: Session
    @State private var items: [AllergyRecord] = []
    @State private var editing = false
    @State private var status = ""
    @State private var failedRead = false
    var body: some View {
        MedicalCardFrame(section: .allergies, canEdit: CareAccess.canWriteMedical(space.role), editing: $editing, status: status, onSave: save) {
            if failedRead { Notice(text: "Could not read the allergy list. Ask a parent before serving food.", warn: true) }
            if items.isEmpty && !editing { Body(text: "No allergies on file. That is not a safety guarantee. Ask the parent.", muted: true) }
            ForEach(items.indices, id: \.self) { i in
                if editing {
                    CareField(title: "Allergy", text: Binding(get: { items[i].name }, set: { items[i].name = $0 }))
                    CareField(title: "How serious", text: Binding(get: { items[i].severity }, set: { items[i].severity = $0 }))
                    CareField(title: "Notes", text: Binding(get: { items[i].notes }, set: { items[i].notes = $0 }))
                } else {
                    VStack(alignment: .leading) { Text(items[i].name).font(Brand.body(18).weight(.semibold)); if !items[i].severity.isEmpty { Body(text: items[i].severity) }; if !items[i].notes.isEmpty { Body(text: items[i].notes, muted: true) } }
                }
            }
            if editing { Button("Add an allergy") { items.append(AllergyRecord()) }.font(Brand.body().weight(.semibold)).frame(minHeight: 44) }
        }
        .task { if let l = await CareRepo.loadAllergies(spaceId: space.id, childId: child.id) { items = l; failedRead = false } else { failedRead = true } }
    }
    func save() {
        guard let uid = s.uid else { return }
        Task { do { let ok = try await CareRepo.saveMedical(spaceId: space.id, child: child, section: .allergies, payload: CareRepo.allergyPayload(items), by: uid)
            status = ok ? "Saved. The team has been alerted." : SaveText.medicalUnconfirmed; if ok { editing = false } } catch { status = error.localizedDescription } }
    }
}

struct MedicationCard: View {
    let space: SpaceSummary
    let child: ChildProfile
    @EnvironmentObject var s: Session
    @State private var items: [MedicationRecord] = []
    @State private var editing = false
    @State private var status = ""
    var body: some View {
        MedicalCardFrame(section: .medication, canEdit: CareAccess.canWriteMedical(space.role), editing: $editing, status: status, onSave: save) {
            if items.isEmpty && !editing { Body(text: "No medication on file.", muted: true) }
            ForEach(items.indices, id: \.self) { i in
                if editing {
                    CareField(title: "Medicine", text: Binding(get: { items[i].name }, set: { items[i].name = $0 }))
                    CareField(title: "Dose, as the parent or doctor wrote it", text: Binding(get: { items[i].dose }, set: { items[i].dose = $0 }))
                    CareField(title: "Times", text: Binding(get: { items[i].times }, set: { items[i].times = $0 }))
                    CareField(title: "Notes", text: Binding(get: { items[i].notes }, set: { items[i].notes = $0 }))
                } else {
                    VStack(alignment: .leading) { Text(items[i].name).font(Brand.body(18).weight(.semibold)); Body(text: [items[i].dose, items[i].times].filter { !$0.isEmpty }.joined(separator: ", ")); if !items[i].notes.isEmpty { Body(text: items[i].notes, muted: true) } }
                }
            }
            if editing { Button("Add a medicine") { items.append(MedicationRecord()) }.font(Brand.body().weight(.semibold)).frame(minHeight: 44) }
        }
        .task { if let l = await CareRepo.loadMedication(spaceId: space.id, childId: child.id) { items = l } }
    }
    func save() {
        guard let uid = s.uid else { return }
        Task { do { let ok = try await CareRepo.saveMedical(spaceId: space.id, child: child, section: .medication, payload: CareRepo.medicationPayload(items), by: uid)
            status = ok ? "Saved. The team has been alerted." : SaveText.medicalUnconfirmed; if ok { editing = false } } catch { status = error.localizedDescription } }
    }
}

struct EmergencyCard: View {
    let space: SpaceSummary
    let child: ChildProfile
    @EnvironmentObject var s: Session
    @State private var rec = EmergencyRecord()
    @State private var editing = false
    @State private var status = ""
    var body: some View {
        MedicalCardFrame(section: .emergency, canEdit: CareAccess.canWriteMedical(space.role), editing: $editing, status: status, onSave: save) {
            if rec.contacts.isEmpty && !editing { Body(text: "No emergency contacts on file.", muted: true) }
            ForEach(rec.contacts.indices, id: \.self) { i in
                if editing {
                    CareField(title: "Contact name", text: Binding(get: { rec.contacts[i].name }, set: { rec.contacts[i].name = $0 }))
                    CareField(title: "Phone", text: Binding(get: { rec.contacts[i].phone }, set: { rec.contacts[i].phone = $0 }), keyboard: .phonePad)
                    CareField(title: "Who they are to the child", text: Binding(get: { rec.contacts[i].relationship }, set: { rec.contacts[i].relationship = $0 }))
                } else { Body(text: "\(rec.contacts[i].name), \(rec.contacts[i].relationship) \(rec.contacts[i].phone)") }
            }
            if editing {
                Button("Add a contact") { rec.contacts.append(EmergencyContact()) }.font(Brand.body().weight(.semibold)).frame(minHeight: 44)
                CareField(title: "Doctor", text: $rec.doctor)
                CareField(title: "Notes", text: $rec.notes, lines: 3)
            } else {
                if !rec.doctor.isEmpty { Body(text: "Doctor: \(rec.doctor)") }
                if !rec.notes.isEmpty { Body(text: rec.notes, muted: true) }
            }
        }
        .task { if let r = await CareRepo.loadEmergency(spaceId: space.id, childId: child.id) { rec = r } }
    }
    func save() {
        guard let uid = s.uid else { return }
        Task { do { let ok = try await CareRepo.saveMedical(spaceId: space.id, child: child, section: .emergency, payload: CareRepo.emergencyPayload(rec), by: uid)
            status = ok ? "Saved. The team has been alerted." : SaveText.medicalUnconfirmed; if ok { editing = false } } catch { status = error.localizedDescription } }
    }
}

struct EmergencyView: View {
    let space: SpaceSummary
    let child: ChildProfile
    @EnvironmentObject var th: ThemeStore
    @State private var rec: EmergencyRecord? = nil
    @State private var done = false
    func tel(_ p: String) -> URL? { URL(string: "tel:" + p.filter { $0.isNumber || $0 == "+" }) }
    var body: some View {
        Screen {
            Heading(text: "Emergency sheet for \(child.name)")
            Notice(text: "In an emergency call 000 first.", warn: true)
            if !CareAccess.canReadEmergency(space.role, space.perms) { Notice(text: "Only a family admin can open this.") }
            else if let r = rec {
                if r.contacts.isEmpty { Body(text: "No contacts yet. Add them in Medical.", muted: true) }
                ForEach(r.contacts) { c in
                    Card { HStack { VStack(alignment: .leading) { Text(c.name).font(Brand.body(18).weight(.semibold)).foregroundStyle(th.theme.text); Body(text: c.relationship, muted: true) }
                        Spacer()
                        if let u = tel(c.phone), !c.phone.isEmpty { Link(destination: u) { HStack { CareIcon(name: "phone", size: 22, tint: .white, fill: false); Text("Call").font(Brand.body(17).weight(.semibold)) }.foregroundStyle(.white).padding(.horizontal, 16).frame(minHeight: 48).background(Brand.ink).clipShape(Capsule()) } } } }
                }
                if !r.doctor.isEmpty { Card { Body(text: "Doctor: \(r.doctor)") } }
                if !r.notes.isEmpty { Card { Body(text: r.notes) } }
            } else if done { Body(text: "Nothing on file.", muted: true) } else { ProgressView() }
        }
        .navigationTitle("Emergency").navigationBarTitleDisplayMode(.inline)
        .task { if CareAccess.canReadEmergency(space.role, space.perms) { rec = await CareRepo.loadEmergency(spaceId: space.id, childId: child.id) }; done = true }
    }
}
