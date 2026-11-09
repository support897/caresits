import SwiftUI

enum ContactMode: String, Identifiable { case message, resume; var id: String { rawValue } }

extension Resume {
    /// Plain text of the resume for a chat message. Capped under the 1000 character message limit.
    var asMessage: String {
        var p: [String] = ["My resume"]
        if !summary.isEmpty { p.append(summary) }
        if !jobs.isEmpty { p.append("Work: " + jobs.prefix(4).joined(separator: " | ")) }
        if !education.isEmpty { p.append("Study: " + education.prefix(2).joined(separator: " | ")) }
        if !skills.isEmpty { p.append("Skills: " + skills.prefix(10).joined(separator: ", ")) }
        if !certificates.isEmpty { p.append("Certificates I list: " + certificates.prefix(4).joined(separator: "; ")) }
        p.append("My own words. Not checked.")
        return String(p.joined(separator: "\n").prefix(1000))
    }
}

/// Message or Send resume for one person. Chat is only open after a booking is accepted (the rules say so),
/// so before that we say so plainly and offer the booking step instead of pretending.
struct ContactSheet: View {
    @EnvironmentObject var s: Session
    @Environment(\.dismiss) var dismiss
    let person: Person; let mode: ContactMode
    @State private var rel: Relationship?; @State private var loaded = false
    @State private var resume: Resume?; @State private var busy = false; @State private var sent = false; @State private var err = ""
    @State private var showBook = false
    var me: Person { s.meSafe }
    var body: some View {
        NavigationStack {
            Group {
                if !loaded { ProgressView() }
                else if let rel, mode == .message { ChatView(rel: rel, other: person) }
                else { info(rel) }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity).background(Brand.cream.ignoresSafeArea())
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Close") { dismiss() } } }
            .sheet(isPresented: $showBook) { BookSheet(carer: person) }
        }
        .task {
            for r in await Backend.relationships(me.id, side: me.side) where r.other(me.id) == person.id && (r.state == "contact" || r.state == "hired") { rel = r }
            if mode == .resume { resume = await Backend.loadResume(me.id) }
            loaded = true
        }
    }
    @ViewBuilder func info(_ rel: Relationship?) -> some View {
        VStack(spacing: 14) {
            BunnyView(size: 90, mood: sent ? .celebrate : .think)
            if sent { HStack(spacing: 8) { BrandIcon(kind: .checkCircle, size: 28, color: s.role.tint); Text("Sent").font(Brand.title(26)) }; Text("\(person.firstName) can read your resume in chat.").multilineTextAlignment(.center).foregroundStyle(Brand.muted) }
            else if rel == nil {
                Text("Chat opens after a yes").font(Brand.title(24))
                Text(me.side == "family" ? "Book \(person.firstName) first. When they say yes, you can chat." : "A family books you first. When you say yes, you can chat and send your resume.").multilineTextAlignment(.center).foregroundStyle(Brand.muted)
                if me.side == "family" && person.side == "carer" { BigButton(title: "Book \(person.firstName)", tint: s.role.tint, icon: .calendar) { showBook = true } }
            } else if resume == nil || resume!.isEmpty {
                Text("No resume yet").font(Brand.title(24))
                Text("Add your resume in Me, then come back.").multilineTextAlignment(.center).foregroundStyle(Brand.muted)
            } else {
                Text("Send your resume to \(person.firstName)?").font(Brand.title(24)).multilineTextAlignment(.center)
                Text("Your own words. Phone, email and address are never included.").font(.footnote).multilineTextAlignment(.center).foregroundStyle(Brand.muted)
                if !err.isEmpty { Text(err).foregroundStyle(.red).font(.callout) }
                BigButton(title: "Send resume", tint: s.role.tint, busy: busy, icon: .doc) { Task { await send(rel!) } }
            }
        }.padding(24)
    }
    func send(_ rel: Relationship) async {
        guard let r = resume, let uid = s.uid else { return }
        busy = true; err = ""; defer { busy = false }
        do { try await Backend.send(rel.id, from: uid, text: r.asMessage); sent = true } catch { err = "Not sent. Check your connection." }
    }
}
