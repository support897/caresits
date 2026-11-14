import SwiftUI

// MARK: Item 31 — the bunny tour (brief section 3, Guides).
// The bunny of record walks you through the five tabs: she
// stands, points, and speaks one short caption per tab. The
// tour is skippable at every step; closing it mid-way keeps
// your place, and it offers to resume where you left off.
// Reduced movement (the system setting or the bunny's own
// "less movement" setting) stills every pose — BunnyView
// already carries that law; the tour adds no motion of its own.

struct BunnyTourView: View {
    @EnvironmentObject var th: ThemeStore
    @Environment(\.dismiss) private var dismiss
    @AppStorage("carespace.tourStep") private var step = 0
    @AppStorage("carespace.tourDone") private var done = false
    struct Stop { let tab: String; let pose: BunnyView.Pose; let words: String }
    static let stops: [Stop] = [
        Stop(tab: "Chats", pose: .hello, words: "This is Chats. Everyone in your care space talks here — no lost messages, ever."),
        Stop(tab: "Calendar", pose: .point, words: "This is the Calendar. Bookings, shifts and pickups stand here, and changes ask first."),
        Stop(tab: "Care", pose: .point, words: "This is Care. Each child's page holds their day, their food, their sleep — and their allergy record, big and clear."),
        Stop(tab: "Activities", pose: .celebrate, words: "This is Activities. The day's activities stand ready before the day starts, made for each child by name."),
        Stop(tab: "Profile", pose: .rest, words: "This is Profile. Your name, your care team, and Settings — every setting lives in Settings. That is the whole tour!")
    ]
    var body: some View {
        Screen {
            Spacer()
            BunnyView(pose: Self.stops[min(step, 4)].pose, size: 170)
                .frame(maxWidth: .infinity)
            Text(Self.stops[min(step, 4)].tab).font(Brand.title(26)).foregroundStyle(th.theme.text)
                .frame(maxWidth: .infinity)
            Text(Self.stops[min(step, 4)].words).font(Brand.body(18)).foregroundStyle(th.theme.text)
                .multilineTextAlignment(.center)
            HStack(spacing: 8) {
                ForEach(0..<Self.stops.count, id: \.self) { i in
                    Circle().fill(i <= step ? Brand.bunny : Brand.blush).frame(width: 10, height: 10)
                }
            }
            .frame(maxWidth: .infinity)
            if step < Self.stops.count - 1 {
                BigButton(title: "Next") { step += 1 }
                Button("Skip the tour") { done = true; step = 0; dismiss() }
                    .font(Brand.body(16)).frame(minHeight: 44)
            } else {
                BigButton(title: "Done") { done = true; step = 0; dismiss() }
            }
            if step > 0 {
                Button("Back") { step -= 1 }.font(Brand.body(16)).frame(minHeight: 44)
            }
            Spacer()
        }
        .navigationTitle("Bunny tour")
        .navigationBarTitleDisplayMode(.inline)
    }
}
