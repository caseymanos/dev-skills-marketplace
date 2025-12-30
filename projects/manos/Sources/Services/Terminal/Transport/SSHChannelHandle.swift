import Foundation

/// Handle to an SSH channel within a connection.
/// Used to identify and manage individual channels for terminal sessions.
struct SSHChannelHandle: Sendable, Equatable, Hashable {
    /// Unique identifier for this channel within the connection
    let id: UInt32

    /// When the channel was opened
    let openedAt: Date

    init(id: UInt32, openedAt: Date = Date()) {
        self.id = id
        self.openedAt = openedAt
    }
}

extension SSHChannelHandle: CustomStringConvertible {
    var description: String {
        "SSHChannel(\(id))"
    }
}
