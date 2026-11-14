import SwiftUI
import FirebaseCore
import FirebaseAppCheck
import FirebaseMessaging
import FirebaseAuth
import FirebaseFirestore
import UserNotifications

// MARK: Item 11 — real push. App Check stands in front of the backend
// calls (deleteMyAccount enforces it), and this phone's FCM token is
// saved on the user's own profile so the backend's pushOnEvent can
// reach it (devices live at profiles/{uid}/devices, per the backend
// read in BUILD-NOTE-29-02).

enum PushSetup {
    static func installAppCheck() {
        #if DEBUG
        AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
        #else
        // Release names no factory: App Check's own default
        // provider (App Attest on this platform) takes over.
        // Naming AppAttestProviderFactory here broke the cloud
        // compile (run 4, 2026-11-14: not in scope in the SDK
        // the lane resolves) — the default needs no naming.
        #endif
    }

    /// Saves this phone's token on the signed-in user's own profile.
    static func saveToken(_ token: String) {
        guard let uid = Auth.auth().currentUser?.uid, !token.isEmpty else { return }
        let ref = Backend.db.collection("profiles").document(uid)
            .collection("devices").document(token)
        ref.setData(["token": token, "at": FieldValue.serverTimestamp(), "platform": "ios"], merge: true)
    }

    /// The gentle ask (item 11): plain words, the person's own tap,
    /// never a cold system prompt out of nowhere.
    static func askPermission() async -> Bool {
        do {
            let ok = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
            if ok {
                await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
                if let t = Messaging.messaging().fcmToken { saveToken(t) }
            }
            return ok
        } catch { return false }
    }

    /// On launch, when permission already stands, keep the token fresh.
    static func refreshIfAllowed() async {
        let st = await UNUserNotificationCenter.current().notificationSettings()
        guard st.authorizationStatus == .authorized else { return }
        await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
        if let t = Messaging.messaging().fcmToken { saveToken(t) }
    }
}

final class PushDelegate: NSObject, UIApplicationDelegate, MessagingDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self
        return true
    }
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        if let t = fcmToken { PushSetup.saveToken(t) }
    }
    /// A ping that lands while the app is open shows gently, as a banner.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }
}
