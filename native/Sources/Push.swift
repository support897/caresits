import SwiftUI
import UIKit
import UserNotifications

/// Essential notifications, the client half (Security design of record, 17 Oct 2026).
/// The app asks, registers, and keeps ONE owner only device doc per install at
/// profiles/{uid}/devices/{deviceId}. The token follows the session: written while signed in,
/// set inactive on sign out, and the deletion walk already enumerates devices. The sender half
/// is a service (named in BUILT.md); payloads carry a kind only, never a name or message text.
enum NotifyKind: String, CaseIterable {
    case message, reminder, bookingRequest, bookingConfirmed, bookingCancelled, urgentAnswer
    var label: String {
        switch self {
        case .message: return "New message"
        case .reminder: return "A message waiting a day"
        case .bookingRequest: return "New booking request"
        case .bookingConfirmed: return "Booking confirmed"
        case .bookingCancelled: return "Booking cancelled"
        case .urgentAnswer: return "An answer on the urgent board"
        }
    }
    var storageKey: String { "caresits.notify." + rawValue }
    /// Only message and reminder are sealed in the device doc kinds map today. The booking and
    /// urgent kinds join it with the notification kinds amendment for Security (BUILT.md).
    var sealed: Bool { self == .message || self == .reminder }
    static func on(_ k: NotifyKind) -> Bool { UserDefaults.standard.object(forKey: k.storageKey) as? Bool ?? true }
}

final class PushDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { @MainActor in await Backend.registerDevice(token: hex) }
    }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {}
}

enum Push {
    /// Asks once the person is signed in (the token follows the session), then registers.
    static func registerIfSignedIn() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            if granted { DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() } }
        }
    }
}
