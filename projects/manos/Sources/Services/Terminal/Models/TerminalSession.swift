import Foundation

/// A terminal session representing a connection to a remote tmux session.
/// Persists session metadata for reconnection after backgrounding.
struct TerminalSession: Identifiable, Codable, Sendable, Equatable {
    /// Unique identifier for this session
    let id: UUID

    /// User-facing display name
    var displayName: String

    /// Remote tmux session name (e.g., "claude-abc123")
    var tmuxSessionName: String

    /// Remote host connection reference
    var host: TerminalHostRef

    /// When the session was first created
    var createdAt: Date

    /// Last time this session had activity
    var lastActivity: Date

    /// Current channel connection state
    var channelState: ChannelState

    /// Last error encountered (if any)
    var lastError: CodableTerminalError?

    init(
        id: UUID = UUID(),
        displayName: String,
        tmuxSessionName: String,
        host: TerminalHostRef,
        createdAt: Date = Date(),
        lastActivity: Date = Date(),
        channelState: ChannelState = .disconnected,
        lastError: TerminalError? = nil
    ) {
        self.id = id
        self.displayName = displayName
        self.tmuxSessionName = tmuxSessionName
        self.host = host
        self.createdAt = createdAt
        self.lastActivity = lastActivity
        self.channelState = channelState
        self.lastError = lastError.map { CodableTerminalError(from: $0) }
    }
}

// MARK: - TerminalError Codable Wrapper

/// A Codable wrapper for TerminalError to support persistence.
/// Associated values are preserved for serialization.
struct CodableTerminalError: Codable, Sendable, Equatable {
    enum ErrorType: String, Codable, Sendable {
        case tailnetUnreachable
        case connectionFailed
        case connectionTimeout
        case connectionLost
        case authenticationFailed
        case hostKeyMissing
        case hostKeyMismatch
        case tmuxSessionNotFound
        case tmuxCommandFailed
        case invalidConfiguration
        case keyNotFound
        case persistenceError
    }

    let type: ErrorType
    let underlying: String?
    let expected: String?
    let got: String?
    let name: String?
    let output: String?
    let keyId: String?

    init(from error: TerminalError) {
        switch error {
        case .tailnetUnreachable:
            self.type = .tailnetUnreachable
            self.underlying = nil
            self.expected = nil
            self.got = nil
            self.name = nil
            self.output = nil
            self.keyId = nil
        case .connectionFailed(let underlying):
            self.type = .connectionFailed
            self.underlying = underlying
            self.expected = nil
            self.got = nil
            self.name = nil
            self.output = nil
            self.keyId = nil
        case .connectionTimeout:
            self.type = .connectionTimeout
            self.underlying = nil
            self.expected = nil
            self.got = nil
            self.name = nil
            self.output = nil
            self.keyId = nil
        case .connectionLost:
            self.type = .connectionLost
            self.underlying = nil
            self.expected = nil
            self.got = nil
            self.name = nil
            self.output = nil
            self.keyId = nil
        case .authenticationFailed:
            self.type = .authenticationFailed
            self.underlying = nil
            self.expected = nil
            self.got = nil
            self.name = nil
            self.output = nil
            self.keyId = nil
        case .hostKeyMissing:
            self.type = .hostKeyMissing
            self.underlying = nil
            self.expected = nil
            self.got = nil
            self.name = nil
            self.output = nil
            self.keyId = nil
        case .hostKeyMismatch(let expected, let got):
            self.type = .hostKeyMismatch
            self.underlying = nil
            self.expected = expected
            self.got = got
            self.name = nil
            self.output = nil
            self.keyId = nil
        case .tmuxSessionNotFound(let name):
            self.type = .tmuxSessionNotFound
            self.underlying = nil
            self.expected = nil
            self.got = nil
            self.name = name
            self.output = nil
            self.keyId = nil
        case .tmuxCommandFailed(let output):
            self.type = .tmuxCommandFailed
            self.underlying = nil
            self.expected = nil
            self.got = nil
            self.name = nil
            self.output = output
            self.keyId = nil
        case .invalidConfiguration:
            self.type = .invalidConfiguration
            self.underlying = nil
            self.expected = nil
            self.got = nil
            self.name = nil
            self.output = nil
            self.keyId = nil
        case .keyNotFound(let keyId):
            self.type = .keyNotFound
            self.underlying = nil
            self.expected = nil
            self.got = nil
            self.name = nil
            self.output = nil
            self.keyId = keyId
        case .persistenceError:
            self.type = .persistenceError
            self.underlying = nil
            self.expected = nil
            self.got = nil
            self.name = nil
            self.output = nil
            self.keyId = nil
        }
    }

    /// Convert back to TerminalError
    func toTerminalError() -> TerminalError {
        switch type {
        case .tailnetUnreachable:
            return .tailnetUnreachable
        case .connectionFailed:
            return .connectionFailed(underlying: underlying ?? "Unknown")
        case .connectionTimeout:
            return .connectionTimeout
        case .connectionLost:
            return .connectionLost
        case .authenticationFailed:
            return .authenticationFailed
        case .hostKeyMissing:
            return .hostKeyMissing
        case .hostKeyMismatch:
            return .hostKeyMismatch(expected: expected ?? "", got: got ?? "")
        case .tmuxSessionNotFound:
            return .tmuxSessionNotFound(name: name ?? "")
        case .tmuxCommandFailed:
            return .tmuxCommandFailed(output: output ?? "")
        case .invalidConfiguration:
            return .invalidConfiguration
        case .keyNotFound:
            return .keyNotFound(keyId: keyId ?? "")
        case .persistenceError:
            return .persistenceError
        }
    }
}

// MARK: - Convenience Extensions

extension TerminalSession {
    /// Get the actual TerminalError from the codable wrapper
    var error: TerminalError? {
        lastError?.toTerminalError()
    }

    /// Update the session with a new error
    func withError(_ error: TerminalError?) -> TerminalSession {
        var copy = self
        copy.lastError = error.map { CodableTerminalError(from: $0) }
        return copy
    }

    /// Update the channel state
    func withState(_ state: ChannelState) -> TerminalSession {
        var copy = self
        copy.channelState = state
        return copy
    }

    /// Update last activity timestamp
    func withActivity() -> TerminalSession {
        var copy = self
        copy.lastActivity = Date()
        return copy
    }
}
