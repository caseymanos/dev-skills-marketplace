import Foundation

enum WebSocketMessage: Sendable {
    case traceEvent(TraceEvent)
    case log(LogEvent)
    case metric(MetricEvent)
    case approvalGate(ApprovalGateEvent)
}

struct TraceEvent: Codable, Sendable {
    let type: String
    let ts: Double
    let agentId: String
    let spanId: String
    let name: String
}

struct LogEvent: Codable, Sendable {
    let type: String
    let ts: Double
    let agentId: String
    let level: String
    let message: String
}

struct MetricEvent: Codable, Sendable {
    let type: String
    let ts: Double
    let scope: String
    let swarmId: String?
    let agentId: String?
    let name: String
    let value: Double
}

struct ApprovalGateEvent: Codable, Sendable {
    let type: String
    let ts: Double
    let gateId: String
    let status: String
    let summary: String
}

actor WebSocketClient {
    private var task: URLSessionWebSocketTask?
    private let environment: APIEnvironment

    init(environment: APIEnvironment = .dev) {
        self.environment = environment
    }

    func connect() async throws {
        let wsURL = environment.baseURL
            .deletingLastPathComponent()
            .appendingPathComponent("v1/stream")
        var components = URLComponents(url: wsURL, resolvingAgainstBaseURL: false)!
        components.scheme = "wss"
        components.queryItems = [URLQueryItem(name: "protocol", value: "1")]

        task = URLSession.shared.webSocketTask(with: components.url!)
        task?.resume()
    }

    func disconnect() {
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }
}
