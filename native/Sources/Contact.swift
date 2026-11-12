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

/// Message or Send resume for one person. Chat opens on the match: no booking has to come first.
struct ContactSheet: View {
    @EnvironmentObject var s: Session
    @Environment(\.dismiss) var dismiss
    let person: Person; let mode: ContactMode
    @State private var rel: Relationship?; @State private var loaded = false
    @State private var resume: Resume?; @State private var busy = false; @State private var sent = false; @State private var err = ""
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
        }
        .task { await open(); if mode == .resume { resume = await Backend.loadResume(me.id) } }
    }
    /// Opens (or finds) the chat with this person. The sheet can open before the session has settled, so the profile is
    /// reloaded and the open is tried again before saying it did not work.
    func open() async {
        for attempt in 0..<3 {
            if s.me == nil || attempt > 0 { await s.reload() }
            if let m = s.me {
                do { rel = try await Backend.openChat(me: m, other: person); err = ""; break }
                catch { err = error.localizedDescription; if error.localizedDescription.contains("booking request") { break } }
            }
            try? await Task.sleep(nanoseconds: 800_000_000)
        }
        loaded = true
    }
    @ViewBuilder func info(_ rel: Relationship?) -> some View {
        VStack(spacing: 14) {
            BunnyView(size: 90, mood: sent ? .celebrate : .think)
            if sent { HStack(spacing: 8) { BrandIcon(kind: .checkCircle, size: 28, color: Brand.ink); Text("Sent").font(Brand.title(26)).foregroundStyle(Brand.titleColor) }; Text("\(person.firstName) can read your resume in chat.").multilineTextAlignment(.center).foregroundStyle(Brand.muted) }
            else if rel == nil {
                Text("Chat did not open").font(Brand.title(24)).foregroundStyle(Brand.titleColor)
                Text(err.isEmpty ? "Check your connection and try again." : err).multilineTextAlignment(.center).foregroundStyle(Brand.muted)
                BigButton(title: "Try again", tint: s.role.tint, icon: .undo) { loaded = false; Task { await open() } }
            } else if resume == nil || resume!.isEmpty {
                Text("No resume yet").font(Brand.title(24)).foregroundStyle(Brand.titleColor)
                Text("Add your resume in Me, then come back.").multilineTextAlignment(.center).foregroundStyle(Brand.muted)
            } else {
                Text("Send your resume to \(person.firstName)?").font(Brand.title(24)).foregroundStyle(Brand.titleColor).multilineTextAlignment(.center)
                Text("Your own words. Phone, email and address are never included.").font(.footnote).multilineTextAlignment(.center).foregroundStyle(Brand.muted)
                if !err.isEmpty { Text(err).foregroundStyle(Brand.ink).font(.callout) }
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
