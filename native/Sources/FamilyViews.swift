import SwiftUI

/// A text field with a real, visible label above it. Placeholders are only examples.
struct LabeledField: View {
    let label: String; let placeholder: String; @Binding var text: String
    var content: UITextContentType? = nil; var keyboard: UIKeyboardType = .default
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.system(size: 16, weight: .semibold)).foregroundStyle(Brand.ink)
            TextField(placeholder, text: $text).textContentType(content).keyboardType(keyboard)
                .padding(14).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12))
                .accessibilityLabel(label).accessibilityIdentifier(label)
        }
    }
}

/// The three family detail lines, each with its own label. Used in onboarding and in Me, My family.
struct FamilyDetailsFields: View {
    @Binding var name: String; @Binding var postcode: String; @Binding var suburb: String
    var body: some View {
        VStack(spacing: 14) {
            LabeledField(label: "Your name", placeholder: "First and last name", text: $name, content: .name)
            LabeledField(label: "Postcode", placeholder: "For example 4005", text: $postcode, content: .postalCode, keyboard: .numberPad)
            LabeledField(label: "Suburb", placeholder: "For example New Farm", text: $suburb, content: .addressCity)
        }
    }
}

/// Me, My family. The same screen the "Skip for now" link opens.
struct FamilyEditor: View {
    @EnvironmentObject var s: Session; @Environment(\.dismiss) var dismiss
    @State private var name = ""; @State private var postcode = ""; @State private var suburb = ""
    @State private var kids: [(name: String, age: Int)] = []
    @State private var busy = false; @State private var err = ""
    var body: some View {
        ScrollView { VStack(spacing: 16) {
            BunnyView(size: 80, mood: .hello).padding(.top, 16)
            Text("My family").font(Brand.title(28)).foregroundStyle(Brand.titleColor).accessibilityIdentifier("familyEditorTitle")
            FamilyDetailsFields(name: $name, postcode: $postcode, suburb: $suburb)
            ForEach(kids.indices, id: \.self) { i in
                Card { HStack {
                    TextField("Name or nickname", text: Binding(get: { kids[i].name }, set: { kids[i].name = $0 }))
                    Stepper("\(kids[i].age) y", value: Binding(get: { kids[i].age }, set: { kids[i].age = $0 }), in: 0...17).fixedSize()
                } }
            }
            Button { if kids.count < 8 { kids.append(("", 3)) } } label: { IconLabel(icon: .plus, text: "Add a child") }.font(.headline)
            Text("Your exact address is never shown. Children's details stay private.").font(.footnote).foregroundStyle(Brand.muted).multilineTextAlignment(.center)
            if !err.isEmpty { Text(err).foregroundStyle(Brand.ink).font(.callout) }
            BigButton(title: "Save", tint: s.role.tint, busy: busy) { Task { await save() } }
            Button("Close") { dismiss() }.font(.headline)
        }.padding(20) }
        .background(Brand.cream.ignoresSafeArea())
        .onAppear { let m = s.meSafe; name = m.name == "A family" ? "" : m.name; postcode = m.postcode; suburb = m.suburb; kids = m.kids }
    }
    func save() async {
        let n = name.trimmingCharacters(in: .whitespaces)
        if n.isEmpty || (postcode.isEmpty && suburb.isEmpty) { err = "Add your name and a postcode or suburb."; return }
        guard let uid = s.uid else { return }
        busy = true; err = ""; defer { busy = false }
        let k = kids.filter { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty }.map { ["name": String($0.name.split(separator: " ").first ?? ""), "ageYears": $0.age] as [String: Any] }
        do { try await Backend.saveProfile(uid, name: n, postcode: postcode, card: ["suburb": suburb, "kids": k]); await s.reload(); dismiss() }
        catch { err = "Could not save. Try again." }
    }
}

/// The notice shown in onboarding after "Skip for now": where to finish it later, as a link that opens that screen.
struct FamilySkippedNotice: View {
    var open: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("You skipped your family details. Finish them later in").font(.footnote).foregroundStyle(Brand.muted)
            Button(action: open) { HStack(spacing: 4) { Text("Me → My family").font(.callout.weight(.semibold)).underline(); BrandIcon(kind: .arrow, size: 16) } }
                .accessibilityIdentifier("finishFamilyLinkOnboarding")
        }.frame(maxWidth: .infinity, alignment: .leading).padding(12).background(Brand.blush.opacity(0.25)).clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
