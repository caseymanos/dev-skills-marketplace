import Foundation

protocol SSHTransport: Sendable {
    func connect(host: String, port: Int) async throws
    func authenticate(username: String, privateKey: Data) async throws
    func openChannel() async throws -> SSHChannel
    func disconnect() async
}

protocol SSHChannel: Sendable {
    func requestPTY(term: String, width: Int, height: Int) async throws
    func exec(command: String) async throws
    func write(_ data: Data) async throws
    func read() async throws -> Data
    func close() async
}

actor TerminalService {
    private var activeConnection: (any SSHTransport)?

    func connect(host: String, port: Int = 22, username: String, privateKey: Data) async throws {
        // Implementation will use SwiftNIO SSH
    }

    func attachTmux(sessionName: String) async throws {
        // Will execute: tmux attach -t <sessionName>
    }

    func disconnect() async {
        await activeConnection?.disconnect()
        activeConnection = nil
    }
}
