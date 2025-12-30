import Foundation
import UIKit
import UserNotifications

@MainActor
final class PushService: Sendable {
    func requestPermission() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
        } catch {
            return false
        }
    }

    func registerForRemoteNotifications() {
        #if !targetEnvironment(simulator)
        UIApplication.shared.registerForRemoteNotifications()
        #endif
    }
}
