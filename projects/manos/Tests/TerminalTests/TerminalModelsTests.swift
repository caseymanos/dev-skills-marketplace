import XCTest
@testable import AgentObservability

final class TerminalModelsTests: XCTestCase {

    // MARK: - TerminalHostRef Tests

    func testTerminalHostRef_CodableRoundtrip() throws {
        let host = TerminalHostRef(
            hostnameOrIP: "100.64.0.1",
            port: 22,
            username: "obs-terminal",
            keyId: "private-key-1",
            hostKeyId: "host-key-fingerprint-1"
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(host)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(TerminalHostRef.self, from: data)

        XCTAssertEqual(host, decoded)
        XCTAssertEqual(decoded.hostnameOrIP, "100.64.0.1")
        XCTAssertEqual(decoded.port, 22)
        XCTAssertEqual(decoded.username, "obs-terminal")
        XCTAssertEqual(decoded.keyId, "private-key-1")
        XCTAssertEqual(decoded.hostKeyId, "host-key-fingerprint-1")
    }

    func testTerminalHostRef_DisplayAddress() {
        let defaultPort = TerminalHostRef(
            hostnameOrIP: "mac.local",
            port: 22,
            username: "admin",
            keyId: "key",
            hostKeyId: "hk"
        )
        XCTAssertEqual(defaultPort.displayAddress, "admin@mac.local")

        let customPort = TerminalHostRef(
            hostnameOrIP: "mac.local",
            port: 2222,
            username: "admin",
            keyId: "key",
            hostKeyId: "hk"
        )
        XCTAssertEqual(customPort.displayAddress, "admin@mac.local:2222")
    }

    // MARK: - ChannelState Tests

    func testChannelState_CodableRoundtrip() throws {
        let states: [ChannelState] = [
            .disconnected,
            .connecting,
            .attached,
            .detached,
            .reconnecting
        ]

        let encoder = JSONEncoder()
        let decoder = JSONDecoder()

        for state in states {
            let data = try encoder.encode(state)
            let decoded = try decoder.decode(ChannelState.self, from: data)
            XCTAssertEqual(state, decoded)
        }
    }

    func testChannelState_Properties() {
        XCTAssertFalse(ChannelState.disconnected.isConnected)
        XCTAssertFalse(ChannelState.connecting.isConnected)
        XCTAssertTrue(ChannelState.attached.isConnected)
        XCTAssertTrue(ChannelState.detached.isConnected)
        XCTAssertFalse(ChannelState.reconnecting.isConnected)

        XCTAssertTrue(ChannelState.attached.isActive)
        XCTAssertFalse(ChannelState.detached.isActive)

        XCTAssertTrue(ChannelState.connecting.isTransitioning)
        XCTAssertTrue(ChannelState.reconnecting.isTransitioning)
        XCTAssertFalse(ChannelState.attached.isTransitioning)
    }

    // MARK: - TerminalError Tests

    func testTerminalError_Equatable() {
        XCTAssertEqual(TerminalError.tailnetUnreachable, TerminalError.tailnetUnreachable)
        XCTAssertEqual(
            TerminalError.connectionFailed(underlying: "timeout"),
            TerminalError.connectionFailed(underlying: "timeout")
        )
        XCTAssertNotEqual(
            TerminalError.connectionFailed(underlying: "timeout"),
            TerminalError.connectionFailed(underlying: "refused")
        )
        XCTAssertEqual(
            TerminalError.hostKeyMismatch(expected: "abc", got: "def"),
            TerminalError.hostKeyMismatch(expected: "abc", got: "def")
        )
    }

    func testTerminalError_UserMessages() {
        XCTAssertTrue(TerminalError.tailnetUnreachable.userMessage.contains("Tailscale"))
        XCTAssertTrue(TerminalError.authenticationFailed.userMessage.contains("rejected"))
        XCTAssertTrue(TerminalError.hostKeyMismatch(expected: "a", got: "b").userMessage.contains("blocked"))
    }

    func testTerminalError_Recoverability() {
        XCTAssertTrue(TerminalError.connectionLost.isRecoverable)
        XCTAssertTrue(TerminalError.connectionTimeout.isRecoverable)
        XCTAssertFalse(TerminalError.authenticationFailed.isRecoverable)
        XCTAssertFalse(TerminalError.hostKeyMismatch(expected: "a", got: "b").isRecoverable)
    }

    // MARK: - CodableTerminalError Tests

    func testCodableTerminalError_AllCases() throws {
        let errors: [TerminalError] = [
            .tailnetUnreachable,
            .connectionFailed(underlying: "Network error"),
            .connectionTimeout,
            .connectionLost,
            .authenticationFailed,
            .hostKeyMissing,
            .hostKeyMismatch(expected: "SHA256:abc123", got: "SHA256:def456"),
            .tmuxSessionNotFound(name: "claude-test"),
            .tmuxCommandFailed(output: "no server running"),
            .invalidConfiguration,
            .keyNotFound(keyId: "my-key-id"),
            .persistenceError
        ]

        let encoder = JSONEncoder()
        let decoder = JSONDecoder()

        for error in errors {
            let codable = CodableTerminalError(from: error)
            let data = try encoder.encode(codable)
            let decoded = try decoder.decode(CodableTerminalError.self, from: data)
            let restored = decoded.toTerminalError()

            XCTAssertEqual(error, restored, "Roundtrip failed for \(error)")
        }
    }

    // MARK: - TerminalSession Tests

    func testTerminalSession_CodableRoundtrip() throws {
        let host = TerminalHostRef(
            hostnameOrIP: "192.168.1.100",
            port: 22,
            username: "claude",
            keyId: "key-123",
            hostKeyId: "hostkey-abc"
        )

        let session = TerminalSession(
            displayName: "Claude Dev Session",
            tmuxSessionName: "claude-dev-001",
            host: host,
            channelState: .attached,
            lastError: nil
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        let data = try encoder.encode(session)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let decoded = try decoder.decode(TerminalSession.self, from: data)

        XCTAssertEqual(session.id, decoded.id)
        XCTAssertEqual(session.displayName, decoded.displayName)
        XCTAssertEqual(session.tmuxSessionName, decoded.tmuxSessionName)
        XCTAssertEqual(session.host, decoded.host)
        XCTAssertEqual(session.channelState, decoded.channelState)
        XCTAssertNil(decoded.lastError)
    }

    func testTerminalSession_CodableRoundtrip_WithError() throws {
        let host = TerminalHostRef(
            hostnameOrIP: "192.168.1.100",
            port: 22,
            username: "claude",
            keyId: "key-123",
            hostKeyId: "hostkey-abc"
        )

        let session = TerminalSession(
            displayName: "Claude Dev Session",
            tmuxSessionName: "claude-dev-001",
            host: host,
            channelState: .disconnected,
            lastError: .connectionLost
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        let data = try encoder.encode(session)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let decoded = try decoder.decode(TerminalSession.self, from: data)

        XCTAssertEqual(session.id, decoded.id)
        XCTAssertEqual(decoded.error, .connectionLost)
    }

    func testTerminalSession_ConvenienceMethods() {
        let host = TerminalHostRef(
            hostnameOrIP: "localhost",
            port: 22,
            username: "test",
            keyId: "k",
            hostKeyId: "h"
        )

        var session = TerminalSession(
            displayName: "Test",
            tmuxSessionName: "test-session",
            host: host
        )

        // Test withState
        let attached = session.withState(.attached)
        XCTAssertEqual(attached.channelState, .attached)
        XCTAssertEqual(session.channelState, .disconnected) // Original unchanged

        // Test withError
        let withError = session.withError(.authenticationFailed)
        XCTAssertEqual(withError.error, .authenticationFailed)
        XCTAssertNil(session.error) // Original unchanged

        // Test withActivity
        let originalActivity = session.lastActivity
        // Sleep briefly to ensure time difference
        Thread.sleep(forTimeInterval: 0.01)
        let updated = session.withActivity()
        XCTAssertGreaterThan(updated.lastActivity, originalActivity)
    }

    // MARK: - SSHChannelHandle Tests

    func testSSHChannelHandle_Equality() {
        let handle1 = SSHChannelHandle(id: 1)
        let handle2 = SSHChannelHandle(id: 1)
        let handle3 = SSHChannelHandle(id: 2)

        XCTAssertEqual(handle1, handle2)
        XCTAssertNotEqual(handle1, handle3)
    }

    func testSSHChannelHandle_Hashable() {
        let handle1 = SSHChannelHandle(id: 1)
        let handle2 = SSHChannelHandle(id: 2)

        var set = Set<SSHChannelHandle>()
        set.insert(handle1)
        set.insert(handle2)
        set.insert(handle1) // Duplicate

        XCTAssertEqual(set.count, 2)
    }

    func testSSHChannelHandle_Description() {
        let handle = SSHChannelHandle(id: 42)
        XCTAssertEqual(handle.description, "SSHChannel(42)")
    }
}
