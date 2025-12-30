import Foundation
import SwiftData

@Model
final class Agent {
    @Attribute(.unique) var id: String
    var swarmId: String
    var status: AgentStatus
    var taskSummary: String?
    var updatedAt: Date

    init(id: String, swarmId: String, status: AgentStatus, taskSummary: String? = nil, updatedAt: Date = .now) {
        self.id = id
        self.swarmId = swarmId
        self.status = status
        self.taskSummary = taskSummary
        self.updatedAt = updatedAt
    }
}

enum AgentStatus: String, Codable, Sendable {
    case running
    case paused
    case error
    case waiting
    case terminated
}
