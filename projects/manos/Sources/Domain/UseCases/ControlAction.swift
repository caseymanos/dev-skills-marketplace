import Foundation

enum ControlActionType: String, Sendable {
    case pause
    case resume
    case terminate
}

struct ControlActionRequest: Sendable {
    let action: ControlActionType
    let reason: String?
    let requestId: String

    init(action: ControlActionType, reason: String? = nil) {
        self.action = action
        self.reason = reason
        self.requestId = UUID().uuidString
    }
}
