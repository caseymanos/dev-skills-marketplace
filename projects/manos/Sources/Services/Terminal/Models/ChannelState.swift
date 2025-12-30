import Foundation

/// State of an SSH channel for a terminal session.
/// Tracks the connection lifecycle from disconnected through attached/detached states.
enum ChannelState: String, Codable, Sendable, Equatable {
    /// Not connected to the remote host
    case disconnected

    /// Currently establishing connection
    case connecting

    /// Connected and attached to a tmux session
    case attached

    /// Connected but detached from tmux session (e.g., after backgrounding)
    case detached

    /// Attempting to reconnect after connection loss
    case reconnecting
}

extension ChannelState {
    /// Whether the channel is in a connected state (attached or detached)
    var isConnected: Bool {
        switch self {
        case .attached, .detached:
            return true
        case .disconnected, .connecting, .reconnecting:
            return false
        }
    }

    /// Whether the channel is actively streaming terminal data
    var isActive: Bool {
        self == .attached
    }

    /// Whether a connection attempt is in progress
    var isTransitioning: Bool {
        switch self {
        case .connecting, .reconnecting:
            return true
        case .disconnected, .attached, .detached:
            return false
        }
    }
}
