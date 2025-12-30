import SwiftUI

enum AppDestination: Hashable {
    case overview
    case swarmHealth
    case agentDetail(agentId: String)
    case liveTrace
    case approvalGates
    case contextHealth
    case skillHealth
    case terminalSessions
}

@MainActor
@Observable
final class AppNavigationState {
    var path = NavigationPath()

    func navigate(to destination: AppDestination) {
        path.append(destination)
    }

    func pop() {
        if !path.isEmpty {
            path.removeLast()
        }
    }

    func popToRoot() {
        path = NavigationPath()
    }
}
