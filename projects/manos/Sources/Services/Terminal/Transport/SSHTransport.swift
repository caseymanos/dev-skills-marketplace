import Foundation

/// Protocol defining the SSH transport layer interface.
/// Abstracts SSH connection management to allow swappable implementations
/// (e.g., SwiftNIO SSH, libssh2, mock for testing).
protocol SSHTransport: Sendable {
    /// Connect to a remote host using the provided host reference.
    /// - Parameter host: The host configuration including credentials
    /// - Throws: `TerminalError.connectionFailed`, `TerminalError.connectionTimeout`,
    ///           `TerminalError.tailnetUnreachable`, `TerminalError.authenticationFailed`,
    ///           `TerminalError.hostKeyMismatch`
    func connect(to host: TerminalHostRef) async throws

    /// Disconnect from the remote host and clean up resources.
    func disconnect() async

    /// Open a PTY shell channel for interactive terminal use.
    /// - Returns: Handle to the opened channel
    /// - Throws: `TerminalError.connectionLost` if not connected
    func openPTYShellChannel() async throws -> SSHChannelHandle

    /// Open an exec channel for running a single command.
    /// - Parameter command: The command to execute
    /// - Returns: Handle to the opened channel
    /// - Throws: `TerminalError.connectionLost` if not connected
    func openExecChannel(command: String) async throws -> SSHChannelHandle

    /// Send data to a specific channel.
    /// - Parameters:
    ///   - data: Data to send (typically user keystrokes)
    ///   - channel: Handle to the target channel
    /// - Throws: `TerminalError.connectionLost` if channel is invalid
    func send(_ data: Data, on channel: SSHChannelHandle) async throws

    /// Close a specific channel.
    /// - Parameter channel: Handle to the channel to close
    func close(_ channel: SSHChannelHandle) async

    /// Update the terminal window size for a channel.
    /// - Parameters:
    ///   - cols: Number of columns
    ///   - rows: Number of rows
    ///   - channel: Handle to the channel
    /// - Throws: `TerminalError.connectionLost` if channel is invalid
    func setWindowSize(cols: Int, rows: Int, on channel: SSHChannelHandle) async throws
}

/// Delegate protocol for receiving data and events from SSH channels.
protocol SSHTransportDelegate: AnyObject, Sendable {
    /// Called when data is received on a channel.
    /// - Parameters:
    ///   - transport: The transport that received the data
    ///   - data: The received data (terminal output)
    ///   - channel: The channel that produced the data
    func transport(_ transport: any SSHTransport, didReceive data: Data, on channel: SSHChannelHandle)

    /// Called when a channel is closed remotely.
    /// - Parameters:
    ///   - transport: The transport
    ///   - channel: The channel that was closed
    func transport(_ transport: any SSHTransport, channelDidClose channel: SSHChannelHandle)

    /// Called when the connection is lost.
    /// - Parameters:
    ///   - transport: The transport
    ///   - error: The error that caused the disconnection
    func transport(_ transport: any SSHTransport, didDisconnectWithError error: TerminalError?)
}

/// Extended transport protocol with delegate support.
/// Implementations should use this for full functionality.
protocol DelegatingSSHTransport: SSHTransport {
    /// The delegate to receive events
    var delegate: (any SSHTransportDelegate)? { get set }
}
