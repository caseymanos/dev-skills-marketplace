import Foundation

/// Comprehensive error types for the terminal subsystem.
/// Maps to user-facing messages and recovery actions as defined in the spec.
enum TerminalError: Error, Sendable, Equatable {
    // MARK: - Network / Transport Errors

    /// Remote host is unreachable (VPN/Tailscale not connected)
    case tailnetUnreachable

    /// SSH connection failed with an underlying reason
    case connectionFailed(underlying: String)

    /// Connection attempt timed out
    case connectionTimeout

    /// Existing connection was lost
    case connectionLost

    // MARK: - Authentication / Trust Errors

    /// SSH authentication failed (key rejected, wrong user, etc.)
    case authenticationFailed

    /// No stored host key fingerprint (TOFU not yet established)
    case hostKeyMissing

    /// Host key fingerprint doesn't match stored value (potential MITM)
    case hostKeyMismatch(expected: String, got: String)

    // MARK: - tmux / Remote Errors

    /// Requested tmux session does not exist on the remote
    case tmuxSessionNotFound(name: String)

    /// A tmux command failed to execute
    case tmuxCommandFailed(output: String)

    // MARK: - Local / Configuration Errors

    /// Configuration is invalid or incomplete
    case invalidConfiguration

    /// Private key not found in keychain
    case keyNotFound(keyId: String)

    /// Failed to persist or load data
    case persistenceError
}

// MARK: - User-Facing Messages

extension TerminalError {
    /// User-friendly message to display in the UI
    var userMessage: String {
        switch self {
        case .tailnetUnreachable:
            return "Remote host unreachable. Is Tailscale connected?"
        case .connectionFailed(let underlying):
            return "Connection failed: \(underlying)"
        case .connectionTimeout:
            return "Connection timed out. Check your network."
        case .connectionLost:
            return "Connection lost. Reconnecting…"
        case .authenticationFailed:
            return "SSH key rejected by host."
        case .hostKeyMissing:
            return "Host identity not yet verified."
        case .hostKeyMismatch:
            return "Host identity changed. Connection blocked for security."
        case .tmuxSessionNotFound(let name):
            return "Session '\(name)' no longer exists."
        case .tmuxCommandFailed(let output):
            return "Remote command failed: \(output)"
        case .invalidConfiguration:
            return "Terminal configuration is invalid."
        case .keyNotFound(let keyId):
            return "SSH key '\(keyId)' not found."
        case .persistenceError:
            return "Failed to save or load data."
        }
    }

    /// Whether the error is recoverable through automatic retry
    var isRecoverable: Bool {
        switch self {
        case .connectionLost, .connectionTimeout, .tailnetUnreachable:
            return true
        case .authenticationFailed, .hostKeyMismatch, .keyNotFound, .invalidConfiguration:
            return false
        case .connectionFailed, .hostKeyMissing, .tmuxSessionNotFound, .tmuxCommandFailed, .persistenceError:
            return false
        }
    }

    /// Suggested action for the user
    var suggestedAction: String? {
        switch self {
        case .tailnetUnreachable:
            return "Open Tailscale or enable VPN"
        case .authenticationFailed:
            return "Reconfigure SSH key or username"
        case .hostKeyMismatch:
            return "Reset host trust (requires biometric)"
        case .connectionLost:
            return "Wait for reconnection or tap retry"
        case .tmuxSessionNotFound:
            return nil
        case .keyNotFound:
            return "Import or generate a new SSH key"
        default:
            return nil
        }
    }
}

// MARK: - LocalizedError Conformance

extension TerminalError: LocalizedError {
    var errorDescription: String? {
        userMessage
    }
}
