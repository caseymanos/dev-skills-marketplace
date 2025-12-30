import Foundation

/// Reference to a terminal host machine for SSH connections.
/// Contains all information needed to establish an SSH connection.
struct TerminalHostRef: Codable, Sendable, Equatable, Hashable {
    /// Tailnet IP or hostname for the remote machine
    var hostnameOrIP: String

    /// SSH port (default: 22)
    var port: Int

    /// Username for SSH authentication
    var username: String

    /// Keychain identifier for the private key
    var keyId: String

    /// Identifier for the stored TOFU host key fingerprint
    var hostKeyId: String

    init(
        hostnameOrIP: String,
        port: Int = 22,
        username: String,
        keyId: String,
        hostKeyId: String
    ) {
        self.hostnameOrIP = hostnameOrIP
        self.port = port
        self.username = username
        self.keyId = keyId
        self.hostKeyId = hostKeyId
    }
}

extension TerminalHostRef {
    /// A display-friendly representation of the host
    var displayAddress: String {
        if port == 22 {
            return "\(username)@\(hostnameOrIP)"
        }
        return "\(username)@\(hostnameOrIP):\(port)"
    }
}
