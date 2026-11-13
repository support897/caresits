import SwiftUI

/// Build 181 item 2. The questionnaire as tick cards, from the HTML question set (QuestionBank.swift, generated).
/// One tap ticks a card and that question counts as done. No typing here: name and postcode are asked in sign up.
struct TickCard: View {
    let label: String; var icon: BI? = nil; let on: Bool; let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                BrandIcon(kind: icon ?? (on ? .checkCircle : .circle), size: 26, color: Color(hex: 0xC2345B))
                Text(label).font(.system(size: 14, weight: .bold)).multilineTextAlignment(.center).foregroundStyle(Brand.ink)
                    .lineLimit(3).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 84).padding(.horizontal, 6).padding(.vertical, 8)
            .background(on ? Brand.blush : Brand.paleGround)
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(on ? Brand.bunny : Brand.bunnyBlush, lineWidth: 2))
            .overlay(alignment: .topTrailing) {
                if on { BrandIcon(kind: .check, size: 12, color: .white).padding(4).background(Color(hex: 0xC2345B)).clipShape(Circle()).padding(6) }
            }
            .clipShape(RoundedRectangle(cornerRadius: 18))
        }.buttonStyle(.plain)
        .accessibilityLabel(label).accessibilityValue(on ? "ticked" : "not ticked").accessibilityIdentifier("tick-\(label)")
    }
}

struct QuestionnaireView: View {
    @EnvironmentObject var s: Session
    @State private var answers: [String: Any] = [:]
    @State private var strengths: [String: String] = [:]
    @State private var saveErr = ""
    var side: String { s.me?.side == "carer" ? "carer" : "family" }
    var bank: [QDef] { side == "carer" ? QuestionBank.carer : QuestionBank.family }
    var pages: [String] { var seen: [String] = []; for q in bank where QuestionnaireView.asked(q) && !seen.contains(q.page) { seen.append(q.page) }; return seen }
    var counted: [QDef] { bank.filter { $0.set != "tick" && QuestionnaireView.asked($0) } }
    var doneCount: Int { counted.filter { done($0) }.count }

    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Text("Tick what is true.").font(Brand.title(28)).foregroundStyle(Brand.titleColor)
            Text("One tap and that question is done. No typing.").font(.subheadline).foregroundStyle(Brand.muted)
            if !saveErr.isEmpty { Text(saveErr).font(.footnote).foregroundStyle(Brand.ink).padding(.horizontal, 20) }
            Card { VStack(alignment: .leading, spacing: 6) {
                Text("\(doneCount) of \(counted.count) done").font(.headline).accessibilityIdentifier("qProgress")
                ProgressView(value: Double(doneCount), total: Double(max(counted.count, 1))).tint(Brand.bunny)
                Text(levelText).font(.footnote).foregroundStyle(Brand.muted)
            } }.padding(.horizontal, 20)
            ForEach(pages, id: \.self) { page in
                VStack(alignment: .leading, spacing: 10) {
                    Text(page).font(Brand.title(20)).foregroundStyle(Brand.titleColor).padding(.horizontal, 20)
                    ForEach(bank.filter { $0.page == page && QuestionnaireView.asked($0) }, id: \.id) { q in
                        Card { VStack(alignment: .leading, spacing: 10) {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(q.label).font(.headline).foregroundStyle(Brand.ink)
                                    if !q.hint.isEmpty { Text(q.hint).font(.footnote).foregroundStyle(Brand.muted) }
                                }
                                Spacer()
                                if done(q) { BrandIcon(kind: .checkCircle, size: 20, color: Color(hex: 0xC2345B)) }
                            }
                            widget(q)
                            if q.strength { HStack(spacing: 8) { ForEach([("must", "Must have"), ("pref", "I prefer"), ("either", "Either way")], id: \.0) { k in
                                Button { setStrength(q, k.0) } label: { Text(k.1).font(.footnote.weight(.semibold)).padding(.horizontal, 12).padding(.vertical, 8)
                                    .background((strengths[q.id] ?? "pref") == k.0 ? Brand.blush : Brand.paleGround).foregroundStyle(Brand.ink)
                                    .overlay(Capsule().stroke((strengths[q.id] ?? "pref") == k.0 ? Brand.bunny : Brand.bunnyBlush, lineWidth: 1.5)).clipShape(Capsule()) }.buttonStyle(.plain).accessibilityIdentifier("strength-\(q.id)-\(k.0)") } } }
                        } }.padding(.horizontal, 20).accessibilityIdentifier("q-\(q.id)")
                    }
                }
            }
        }.padding(.vertical, 16).padding(.bottom, 100) }
        .background(Brand.cream.ignoresSafeArea())
        .task { await load() }
    }

    // MARK: progress, by the level tags of the questionnaire partition
    var levelText: String {
        let base = counted.filter { $0.set == "base" && $0.required }
        let quick = counted.filter { $0.level == "quick" }, better = counted.filter { $0.level == "better" }
        let match = counted.filter { !$0.optional && $0.level != "optional" }
        if !(base + quick).allSatisfy({ done($0) }) { return "Explore: finish the safety and core questions to connect." }
        if !better.allSatisfy({ done($0) }) { return "Quick Connect: messaging and job posts are open." }
        if !match.allSatisfy({ done($0) }) { return "Better Match: answer the rest for Full Match." }
        return "Full Match: every match question answered."
    }

    // MARK: answers
    func done(_ q: QDef) -> Bool {
        guard let v = answers[q.id] else { return false }
        if let a = v as? [Any] { return !a.isEmpty }
        if let d = v as? [String: String] { return d.values.contains { !$0.isEmpty } }
        if let str = v as? String { return !str.isEmpty }
        return true
    }
    func list(_ id: String) -> [String] { (answers[id] as? [String]) ?? [] }
    func load() async {
        guard let uid = s.uid else { return }
        answers = AnswerStore.loadLocal(uid)
        let remote = await AnswerStore.loadAll(uid)
        for q in bank where !q.code.isEmpty {
            guard let d = remote[q.code], let v = d["v"] else { continue }
            answers[q.id] = v; if let st = d["s"] as? String { strengths[q.id] = st }
        }
    }
    /// One answer changes: coded questions write their own document; the rest stay on this device.
    func set(_ id: String, _ v: Any?) {
        if let v { answers[id] = v } else { answers.removeValue(forKey: id) }
        guard let uid = s.uid, let q = bank.first(where: { $0.id == id }) else { return }
        if q.code.isEmpty {
            AnswerStore.saveLocal(uid, answers.filter { k, _ in bank.first(where: { $0.id == k })?.code.isEmpty ?? true })
            return
        }
        let st = q.strength ? (strengths[id] ?? "pref") : nil
        Task {
            if let v {
                var val = v; if let str = v as? String { val = String(str.prefix(q.kind == .text ? 2000 : 120)) }
                if let l = v as? [String] { val = Array(l.prefix(q.code == "F8" ? 12 : 10)) }
                if let v2 = (v as? String) ?? (v as? [String])?.first, v2.isEmpty { await AnswerStore.remove(uid, code: q.code); return }
                do { try await AnswerStore.write(uid, code: q.code, v: val, strength: st, feed: q.feed); saveErr = "" } catch { saveErr = "Could not save that answer. Try again." }
            } else { await AnswerStore.remove(uid, code: q.code) }
        }
    }
    func setStrength(_ q: QDef, _ st: String) { strengths[q.id] = st; if let v = answers[q.id] { set(q.id, v) } }
    func toggle(_ q: QDef, _ o: String) {
        var l = list(q.id)
        if let i = l.firstIndex(of: o) { l.remove(at: i) } else { if q.kind == .many3 && l.count >= 3 { l.removeFirst() }; l.append(o) }
        set(q.id, l.isEmpty ? nil : l)
    }

    // MARK: widgets
    let cols = [GridItem(.adaptive(minimum: 96), spacing: 10)]
    @ViewBuilder func widget(_ q: QDef) -> some View {
        switch q.kind {
        case .pick where q.options.count > 12:
            Picker(q.label, selection: Binding(get: { (answers[q.id] as? String) ?? "" }, set: { set(q.id, $0.isEmpty ? nil : $0) })) {
                Text("Pick").tag(""); ForEach(q.options, id: \.label) { Text($0.label).tag($0.label) }
            }.pickerStyle(.menu).tint(Color(hex: 0xC2345B)).accessibilityIdentifier("pick-\(q.id)")
        case .pick:
            LazyVGrid(columns: cols, spacing: 10) { ForEach(q.options, id: \.label) { o in
                TickCard(label: o.label, icon: o.icon, on: (answers[q.id] as? String) == o.label) { set(q.id, (answers[q.id] as? String) == o.label ? nil : o.label) } } }
        case .many, .many3:
            LazyVGrid(columns: cols, spacing: 10) { ForEach(q.options, id: \.label) { o in
                TickCard(label: o.label, icon: o.icon, on: list(q.id).contains(o.label)) { toggle(q, o.label) } } }
        case .yesno:
            LazyVGrid(columns: cols, spacing: 10) { ForEach(["Yes", "No"], id: \.self) { o in
                TickCard(label: o, on: (answers[q.id] as? String) == o) { set(q.id, (answers[q.id] as? String) == o ? nil : o) } } }
        case .grid:
            VStack(alignment: .leading, spacing: 6) {
                ForEach(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], id: \.self) { day in
                    HStack(spacing: 6) {
                        Text(day).font(.footnote.weight(.bold)).frame(width: 32, alignment: .leading)
                        ForEach(["morning", "midday", "afternoon", "evening", "night"], id: \.self) { part in
                            let key = "\(day)-\(part)"
                            Button { toggle(q, key) } label: { Text(part.prefix(3)).font(.system(size: 11, weight: .bold)).frame(maxWidth: .infinity, minHeight: 34)
                                .background(list(q.id).contains(key) ? Brand.blush : Brand.paleGround).foregroundStyle(Brand.ink)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(list(q.id).contains(key) ? Brand.bunny : Brand.bunnyBlush, lineWidth: 1.5)).clipShape(RoundedRectangle(cornerRadius: 10)) }.buttonStyle(.plain)
                        }
                    }
                }
            }
        case .band:
            let v = (answers[q.id] as? [Int]) ?? [18, 60]
            HStack { Text("From"); Picker("From", selection: Binding(get: { v[0] }, set: { set(q.id, [$0, max($0, v[1])]) })) { ForEach(16..<86, id: \.self) { Text("\($0)").tag($0) } }.tint(Color(hex: 0xC2345B))
                Text("to"); Picker("To", selection: Binding(get: { v[1] }, set: { set(q.id, [min(v[0], $0), $0]) })) { ForEach(16..<86, id: \.self) { Text("\($0)").tag($0) } }.tint(Color(hex: 0xC2345B)) }
        case .experience, .expChecks:
            let d = (answers[q.id] as? [String: String]) ?? [:]
            VStack(alignment: .leading, spacing: 8) {
                ForEach(q.kind == .experience ? ["0-1", "1-3", "3-5", "5-12", "12+"] : ["0-1", "1-3", "3-5", "5-12"], id: \.self) { b in
                    HStack { Text("Years with ages \(b)").font(.subheadline); Spacer()
                        Picker(b, selection: Binding(get: { d[b] ?? "" }, set: { var n = d; n[b] = $0; set(q.id, n) })) {
                            ForEach(["", "0", "1", "2", "3", "4", "5", "6", "7", "10", "15", "20"], id: \.self) { Text($0.isEmpty ? "Pick" : ($0 == "20" ? "20+" : $0)).tag($0) } }.tint(Color(hex: 0xC2345B)) }
                }
                if q.kind == .expChecks {
                    LazyVGrid(columns: cols, spacing: 10) { ForEach(["Register verified", "Document sighted", "Getting them now"], id: \.self) { o in
                        TickCard(label: o, icon: .shield, on: d["checks"] == o) { var n = d; n["checks"] = d["checks"] == o ? "" : o; set(q.id, n) } } }
                }
            }
        case .homeFacts:
            LazyVGrid(columns: cols, spacing: 10) { ForEach([("petsOk", "Pets are fine", BI.paw), ("smokerOk", "Smoking is fine", BI.banned), ("nonSmokerHousehold", "Non smoking home", BI.home)], id: \.0) { k in
                TickCard(label: k.1, icon: k.2, on: list(q.id).contains(k.0)) { toggle(q, k.0) } } }
        case .text:
            TextField("Write a few words", text: Binding(get: { (answers[q.id] as? String) ?? "" }, set: { answers[q.id] = $0 }), axis: .vertical)
                .padding(14).background(Brand.field).clipShape(RoundedRectangle(cornerRadius: 12)).onSubmit { set(q.id, answers[q.id]) }
                .accessibilityIdentifier("write-\(q.id)")
        }
    }
}

extension QuestionnaireView {
    /// Name and postcode are asked at sign up, never here (her standing typing exceptions). The two write ins a side stay typed.
    static func asked(_ q: QDef) -> Bool { !["displayName", "postcode"].contains(q.id) }
}
