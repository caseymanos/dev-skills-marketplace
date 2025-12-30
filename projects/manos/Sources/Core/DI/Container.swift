import Foundation

@MainActor
final class DIContainer: Sendable {
    static let shared = DIContainer()

    private init() {}
}
