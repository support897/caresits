import SwiftUI
import FirebaseAuth

/// The Caresitters server (free Cloudflare worker): push alerts, payments, jobs done and completion counts.
enum Api {
    static let base = "https://caresitters-api.placenciailse.workers.dev"
    @discardableResult
    static func call(_ path: String, _ body: [String: Any]? = nil) async -> [String: Any]? {
        guard let u = Auth.auth().currentUser, let tok = try? await u.getIDToken(), let url = URL(string: base + path) else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = body == nil ? "GET" : "POST"
        req.setValue("Bearer " + tok, forHTTPHeaderField: "Authorization")
        if let body { req.setValue("application/json", forHTTPHeaderField: "Content-Type"); req.httpBody = try? JSONSerialization.data(withJSONObject: body) }
        guard let (d, _) = try? await URLSession.shared.data(for: req) else { return nil }
        return (try? JSONSerialization.jsonObject(with: d)) as? [String: Any]
    }
    static func open(_ s: String?) { if let s, let u = URL(string: s) { UIApplication.shared.open(u) } }
    static func notify(to: String, kind: String, text: String, rel: String? = nil) {
        guard !to.isEmpty else { return }
        Task { await call("/notify", ["toUid": to, "kind": kind, "text": text, "relId": rel ?? ""]) }
    }
    static func other(_ rel: String, me: String) -> String {
        let p = rel.components(separatedBy: "_"); return p.count == 2 ? (p[0] == me ? p[1] : p[0]) : ""
    }
    static func stats(_ uid: String) async -> (done: Int, cancelled: Int) {
        guard let url = URL(string: base + "/stats?uid=" + uid), let (d, _) = try? await URLSession.shared.data(from: url),
              let j = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] else { return (0, 0) }
        return ((j["done"] as? Int) ?? 0, (j["cancelled"] as? Int) ?? 0)
    }
    static func payStatus(_ bookingId: String) async -> String {
        guard let url = URL(string: base + "/pay/status?bookingId=" + bookingId), let (d, _) = try? await URLSession.shared.data(from: url),
              let j = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] else { return "unpaid" }
        return (j["status"] as? String) ?? "unpaid"
    }
}

/// Jobs done and completion rate, public on every profile.
struct RdTrust: View {
    let uid: String
    @State private var s: (done: Int, cancelled: Int)? = nil
    var body: some View {
        Group {
            if let s {
                let total = s.done + s.cancelled
                HStack(spacing: 8) {
                    RdChip(text: String(s.done) + (s.done == 1 ? " job done" : " jobs done"), icon: "check")
                    RdChip(text: total == 0 ? "New here" : String(Int((Double(s.done) / Double(total) * 100).rounded())) + "% completed", icon: "shield", tone: total == 0 || s.cancelled == 0 ? 0 : 1)
                }
            }
        }.task { s = await Api.stats(uid) }
    }
}

struct RdPayoutCard: View {
    @EnvironmentObject var st: RdStore
    @State private var ready: Bool? = nil
    @State private var busy = false
    @State private var askTerms = false
    var body: some View {
        RdCard(title: "Get paid") {
            RdMuted(text: ready == true ? "Payouts are on. Families pay through Caresitters and the money reaches you after the job." : "Set up payouts in a few taps with Stripe. Families pay in the app. You keep 100 percent of your rate. Your first payout can take longer.")
            if ready != true {
                RdCta(title: busy ? "Opening" : "Set up payouts", small: true) {
                    busy = true
                    Task {
                        let t = await Api.call("/terms/status")
                        if (t?["ok"] as? Bool) != true { busy = false; askTerms = true; return }
                        let r = await Api.call("/pay/onboard", [:]); busy = false; if let e = r?["error"] as? String { st.err = e } else { Api.open(r?["url"] as? String) }
                    }
                }
            }
        }
        .alert("Payment terms", isPresented: $askTerms) {
            Button("I agree") { Task { await Api.call("/terms/accept", [:]); let r = await Api.call("/pay/onboard", [:]); if let e = r?["error"] as? String { st.err = e } else { Api.open(r?["url"] as? String) } } }
            Button("Cancel", role: .cancel) {}
        } message: { Text("You keep 100 percent of your rate. Money is released after the job. Your first payout can take longer while Stripe checks your account, and payouts arrive 7 days after release. A cancel or no-show is a strike: 3 strikes pause you for 14 days, 5 close your account. You agree to repay amounts reversed because of your conduct. Full terms: caresitters-web.placenciailse.workers.dev/payment-terms.html") }
        .task { let r = await Api.call("/pay/ready", [:]); ready = r?["ready"] as? Bool }
    }
}
