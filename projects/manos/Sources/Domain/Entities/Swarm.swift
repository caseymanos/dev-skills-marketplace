import Foundation
import SwiftData

@Model
final class Swarm {
    @Attribute(.unique) var id: String
    var name: String
    var status: SwarmStatus
    var activeAgents: Int
    var errorRate: Double
    var updatedAt: Date

    init(id: String, name: String, status: SwarmStatus, activeAgents: Int, errorRate: Double, updatedAt: Date = .now) {
        self.id = id
        self.name = name
        self.status = status
        self.activeAgents = activeAgents
        self.errorRate = errorRate
        self.updatedAt = updatedAt
    }
}

enum SwarmStatus: String, Codable, Sendable {
    case active
    case paused
    case error
    case terminated
}
