import Foundation

enum APIEnvironment: String, Sendable {
    case dev
    case staging
    case prod

    var baseURL: URL {
        switch self {
        case .dev:
            URL(string: "https://dev-api.agentobs.local")!
        case .staging:
            URL(string: "https://staging-api.agentobs.io")!
        case .prod:
            URL(string: "https://api.agentobs.io")!
        }
    }
}

actor APIClient {
    private let environment: APIEnvironment
    private let session: URLSession

    init(environment: APIEnvironment = .dev) {
        self.environment = environment
        self.session = URLSession.shared
    }

    func request<T: Decodable>(_ endpoint: String, method: String = "GET", body: Data? = nil) async throws -> T {
        var request = URLRequest(url: environment.baseURL.appendingPathComponent(endpoint))
        request.httpMethod = method
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, _) = try await session.data(for: request)
        return try JSONDecoder().decode(T.self, from: data)
    }
}
