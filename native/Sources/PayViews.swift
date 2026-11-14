import SwiftUI

/// PAYING THROUGH THE APP: screens and the flow shape only.
/// The money path is NOT live. There are no Stripe keys in this app, no card or bank detail is ever read or kept here,
/// and no charge, release or refund is made. Every action below ends in `PayService.notLive`.
/// Open points that are Ilse's alone (any platform cut, the auto release time, who carries the processing fee, who rules a
/// hold, every number in the rate ladder) are NOT assumed: a number only shows if the payment service sends it.
enum PayConfig {
    static let live = false
    /// The screens show only when the money path is live, or in the debug preview used for pictures.
    static var visible: Bool {
        #if DEBUG
        if ProcessInfo.processInfo.environment["CS_PAYPREVIEW"] == "1" { return true }
        #endif
        return live
    }
}

enum PayService {
    static let notLiveMessage = "Payments are not switched on yet. Nothing was charged."
    static func startCarerSetup() async throws { throw AppError.msg(notLiveMessage) }
    static func payAtConfirmation(_ b: Booking) async throws { throw AppError.msg(notLiveMessage) }
    static func markDone(_ b: Booking) async throws { throw AppError.msg(notLiveMessage) }
    static func reportProblem(_ b: Booking) async throws { throw AppError.msg(notLiveMessage) }
}

/// The carer's payment state, read from Stripe by the service. Until then it is Not set up.
enum CarerPayState: String { case notSetUp, settingUp, ready
    var label: String { switch self { case .notSetUp: return "Not set up"; case .settingUp: return "Setting up. Stripe is checking."; case .ready: return "Ready to be paid" } }
    var icon: BI { switch self { case .notSetUp: return .circle; case .settingUp: return .clock; case .ready: return .checkCircle } }
}

func money(_ v: Double) -> String { v.rounded() == v ? "A$\(Int(v))" : "A$" + String(format: "%.2f", v) }

/// Me, Get paid. One button opens Stripe's own hosted flow (identity and bank). The app never sees a bank detail.
struct GetPaidCard: View {
    @EnvironmentObject var s: Session
    var state: CarerPayState = .notSetUp
    @State private var msg = ""; @State private var busy = false
    var body: some View {
        Card { VStack(alignment: .leading, spacing: 10) {
            IconLabel(icon: .rate, text: "Get paid", size: 20).font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
            IconLabel(icon: state.icon, text: state.label, size: 18).font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline))
            if state != .ready {
                BigButton(title: "Set up payments", tint: s.role.tint, busy: busy) { Task { busy = true; do { try await PayService.startCarerSetup() } catch { msg = error.localizedDescription }; busy = false } }
                    .accessibilityIdentifier("setUpPayments")
            }
            if !msg.isEmpty { Text(msg).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted) }
            IconLabel(icon: .lock, text: "Your bank details are given to Stripe only. This app never sees them.", size: 14, color: Brand.muted).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
            if s.me?.role == .auPair { Text("Au pair pocket money is paid the same way. The terms do not change.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted) }
        } }
    }
}

/// What each side is told about a booking's money, in plain words. Numbers only if the service sent them.
struct PayLines: View {
    let b: Booking; let isCarer: Bool; let otherName: String
    var amount: Double { b.pay?.amount ?? b.estimate }
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let p = b.pay {
                switch p.state {
                case "held": IconLabel(icon: .lock, text: isCarer ? "\(money(amount)) held for this job" : "Paid \(money(amount)). Held safely by our payment partner until the job is done.", size: 16)
                case "released": IconLabel(icon: .checkCircle, text: isCarer ? "\(money(amount)) on its way to your bank" : "Paid to \(otherName)", size: 16)
                case "refunded": IconLabel(icon: .undo, text: "Refunded in full. Refunds take a few days to reach your card.", size: 16)
                case "partRefunded": IconLabel(icon: .undo, text: "Part refunded" + (p.refunded.map { ": \(money($0))" } ?? "") + ". Refunds take a few days to reach your card.", size: 16)
                case "disputed": IconLabel(icon: .info, text: "Something went wrong was reported. The money stays held while our support looks at it.", size: 16)
                default: EmptyView()
                }
                if p.state == "held", !p.autoReleaseAt.isEmpty { Text("It lets go by itself on \(p.autoReleaseAt) unless something went wrong is tapped first.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted) }
                if let f = p.appFee { Text("App fee \(money(f))").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)) }
                if let f = p.processingFee { Text("Payment partner fee \(money(f))").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)) }
            } else if !isCarer && b.state == "accepted" {
                Text("Waiting for \(otherName) to set up payments.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
            }
        }.font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline))
    }
}

/// The three plain lines of the cancel ladder, shown before a booking is confirmed. No numbers beyond the day line.
struct CancelLadderLines: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Cancel more than a day ahead: free.")
            Text("Cancel inside a day: the carer is paid half.")
            Text("No show: the carer is paid in full.")
        }.font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted).accessibilityIdentifier("cancelLadder")
    }
}

/// The family's price panel on the booking screen.
struct PayPromise: View {
    let name: String; let estimate: Double
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("You pay the app, not \(name). Your money is held by our payment partner until the job is done.").font(.custom("Atkinson Hyperlegible", size: 15, relativeTo: .subheadline))
            Text("Card details go to Stripe only. This app never sees them.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
            CancelLadderLines()
        }
    }
}

/// Booking actions for the family while money is held: Done, or Something went wrong.
struct PayActions: View {
    let b: Booking; var reload: () async -> Void
    @State private var msg = ""; @State private var busy = false
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Button { run { try await PayService.markDone(b) } } label: { IconLabel(icon: .check, text: "Done", size: 16, color: Color(hex: 0x2D2A35)).font(.subheadline.bold()).padding(.horizontal, 16).padding(.vertical, 10).background(Brand.bunny).foregroundStyle(Color(hex: 0x2D2A35)).clipShape(Capsule()) }.accessibilityIdentifier("payDone")
                Button { run { try await PayService.reportProblem(b) } } label: { Text("Something went wrong").font(.subheadline.bold()).padding(.horizontal, 16).padding(.vertical, 10).background(Brand.field).foregroundStyle(Brand.ink).clipShape(Capsule()) }.accessibilityIdentifier("payProblem")
            }.disabled(busy)
            if !msg.isEmpty { Text(msg).font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted) }
        }
    }
    func run(_ f: @escaping () async throws -> Void) { Task { busy = true; msg = ""; do { try await f(); await reload() } catch { msg = error.localizedDescription }; busy = false } }
}

/// Bookings, the booking, Payment record: a plain list both sides can keep.
struct PaymentRecordSheet: View {
    @Environment(\.dismiss) var dismiss
    let b: Booking; let otherName: String
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 12) {
            Text("Payment record").font(Brand.title(26)).foregroundStyle(Brand.titleColor).padding(.top, 24)
            Card { VStack(alignment: .leading, spacing: 6) {
                Text("\(otherName) · \(b.date) · \(b.from) to \(b.to)").font(.custom("Atkinson Hyperlegible", size: 17, relativeTo: .headline).weight(.bold))
                if let p = b.pay {
                    Text("State: \(p.state)"); if let a = p.amount { Text("Amount: \(money(a))") }
                    if let r = p.refunded { Text("Refunded: \(money(r))") }
                    if let f = p.appFee { Text("App fee: \(money(f))") }
                    if let f = p.processingFee { Text("Payment partner fee: \(money(f))") }
                    if !p.releasedAt.isEmpty { Text("Released: \(p.releasedAt)") }
                } else { Text("No payment yet.").foregroundStyle(Brand.muted) }
            } }
            Text("Whether paying through the app changes anyone's tax or work position is not the app's call. The app carries the money and keeps this record.").font(.custom("Atkinson Hyperlegible", size: 13, relativeTo: .footnote)).foregroundStyle(Brand.muted)
            BigButton(title: "Done", tint: Brand.bunny) { dismiss() }
        }.padding(20) }.background(Brand.cream.ignoresSafeArea())
    }
}
