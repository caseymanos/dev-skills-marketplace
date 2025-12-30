import Foundation
import SwiftData

@Model
final class ApprovalGate {
    @Attribute(.unique) var id: String
    var status: ApprovalStatus
    var summary: String
    var requestedAt: Date
    var expiresAt: Date?
    var webUrl: String?

    init(id: String, status: ApprovalStatus, summary: String, requestedAt: Date = .now, expiresAt: Date? = nil, webUrl: String? = nil) {
        self.id = id
        self.status = status
        self.summary = summary
        self.requestedAt = requestedAt
        self.expiresAt = expiresAt
        self.webUrl = webUrl
    }
}

enum ApprovalStatus: String, Codable, Sendable {
    case pending
    case approved
    case rejected
    case expired
}
