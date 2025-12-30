import Foundation

/// Main orchestrator protocol for terminal session lifecycle management.
/// Coordinates between SSH transport, tmux client, and UI state.
protocol TerminalOrchestrator: Sendable {
    // MARK: - Session Management

    /// All known terminal sessions
    var sessions: [TerminalSession] { get async }

    /// The currently active (focused) session, if any
    var activeSession: TerminalSession? { get async }

    /// Create a new terminal session and connect to the remote tmux session.
    /// - Parameters:
    ///   - displayName: User-facing name for the session
    ///   - tmuxSessionName: Remote tmux session to attach to
    ///   - host: Host connection configuration
    /// - Returns: The created session
    /// - Throws: `TerminalError` on connection or attachment failure
    func createSession(
        displayName: String,
        tmuxSessionName: String,
        host: TerminalHostRef
    ) async throws -> TerminalSession

    /// Attach to an existing session.
    /// - Parameter sessionId: ID of the session to attach
    /// - Throws: `TerminalError` on connection failure
    func attach(sessionId: UUID) async throws

    /// Detach from a session without destroying it.
    /// The remote tmux session remains alive.
    /// - Parameter sessionId: ID of the session to detach
    func detach(sessionId: UUID) async

    /// Destroy a session and optionally kill the remote tmux session.
    /// - Parameters:
    ///   - sessionId: ID of the session to destroy
    ///   - killRemote: Whether to also kill the remote tmux session
    func destroy(sessionId: UUID, killRemote: Bool) async

    // MARK: - Input/Output

    /// Send user input to the active session.
    /// - Parameter data: Input data (keystrokes)
    func sendInput(_ data: Data) async throws

    // MARK: - Lifecycle

    /// Handle app entering background.
    /// Detaches all sessions gracefully.
    func handleBackground() async

    /// Handle app returning to foreground.
    /// Reconnects and reattaches sessions as needed.
    func handleForeground() async

    // MARK: - Discovery

    /// Discover tmux sessions on a remote host matching our naming convention.
    /// - Parameter host: Host to query
    /// - Returns: List of tmux session names
    func discoverSessions(on host: TerminalHostRef) async throws -> [String]
}

/// Delegate protocol for receiving terminal orchestrator events.
protocol TerminalOrchestratorDelegate: AnyObject, Sendable {
    /// Called when session state changes.
    /// - Parameter sessions: Updated list of all sessions
    func orchestratorDidUpdateSessions(_ sessions: [TerminalSession])

    /// Called when terminal output is received for the active session.
    /// - Parameter data: Terminal output data
    func orchestratorDidReceiveOutput(_ data: Data)

    /// Called when an error occurs.
    /// - Parameters:
    ///   - error: The error that occurred
    ///   - sessionId: The session affected, if any
    func orchestratorDidEncounterError(_ error: TerminalError, forSession sessionId: UUID?)
}

// MARK: - Connection State

/// Overall connection state for the orchestrator.
enum OrchestratorConnectionState: String, Sendable, Equatable {
    /// No connection established
    case disconnected

    /// Establishing SSH connection
    case connecting

    /// Authenticating with remote host
    case authenticating

    /// Connected and ready
    case connected

    /// Attempting to reconnect after connection loss
    case reconnecting

    /// Connection failed
    case failed
}
