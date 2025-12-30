import Foundation
import SwiftData

@Model
final class Incident {
    @Attribute(.unique) var id: String
    var severity: IncidentSeverity
    var summary: String
    var swarmId: String?
    var agentId: String?
    var createdAt: Date
    var status: IncidentStatus
    var webUrl: String?

    init(id: String, severity: IncidentSeverity, summary: String, swarmId: String? = nil, agentId: String? = nil, createdAt: Date = .now, status: IncidentStatus, webUrl: String? = nil) {
        self.id = id
        self.severity = severity
        self.summary = summary
        self.swarmId = swarmId
        self.agentId = agentId
        self.createdAt = createdAt
        self.status = status
        self.webUrl = webUrl
    }
}

enum IncidentSeverity: String, Codable, Sendable {
    case critical
    case high
    case medium
    case low
}

enum IncidentStatus: String, Codable, Sendable {
    case active
    case acknowledged
    case resolved
}
