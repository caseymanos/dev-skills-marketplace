import Foundation

/// Main entry point for terminal functionality.
/// Wraps the TerminalOrchestrator and provides a simpler API for common operations.
actor TerminalService {
    // MARK: - Dependencies

    private var transport: (any SSHTransport)?
    private var sessions: [UUID: TerminalSession] = [:]
    private var activeSessionId: UUID?

    // MARK: - Public API

    /// Connect to a host and attach to a tmux session.
    /// - Parameters:
    ///   - host: Host configuration
    ///   - tmuxSessionName: Name of the tmux session to attach
    /// - Returns: The created terminal session
    func connect(to host: TerminalHostRef, tmuxSessionName: String) async throws -> TerminalSession {
        guard let transport = transport else {
            throw TerminalError.invalidConfiguration
        }

        // Connect SSH
        try await transport.connect(to: host)

        // Create session
        let session = TerminalSession(
            displayName: tmuxSessionName,
            tmuxSessionName: tmuxSessionName,
            host: host,
            channelState: .connecting
        )

        sessions[session.id] = session
        activeSessionId = session.id

        return session
    }

    /// Set the transport implementation to use.
    /// - Parameter transport: The SSH transport
    func setTransport(_ transport: any SSHTransport) {
        self.transport = transport
    }

    /// Get all sessions.
    var allSessions: [TerminalSession] {
        Array(sessions.values)
    }

    /// Get the active session.
    var activeSession: TerminalSession? {
        guard let id = activeSessionId else { return nil }
        return sessions[id]
    }

    /// Disconnect all sessions and clean up.
    func disconnect() async {
        await transport?.disconnect()
        sessions.removeAll()
        activeSessionId = nil
    }

    /// Update a session's state.
    func updateSession(_ session: TerminalSession) {
        sessions[session.id] = session
    }

    /// Remove a session.
    func removeSession(id: UUID) {
        sessions.removeValue(forKey: id)
        if activeSessionId == id {
            activeSessionId = nil
        }
    }
}
