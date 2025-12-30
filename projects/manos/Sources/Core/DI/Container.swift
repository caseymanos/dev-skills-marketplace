import Foundation
import SwiftData

// MARK: - Environment Configuration

/// Application environment configuration for dependency injection.
/// Determines API endpoints, feature defaults, and service behavior.
enum AppEnvironment: String, Sendable, CaseIterable {
    case dev
    case staging
    case prod

    /// Maps to the existing APIEnvironment for network clients
    var apiEnvironment: APIEnvironment {
        switch self {
        case .dev: .dev
        case .staging: .staging
        case .prod: .prod
        }
    }

    /// Default environment based on build configuration
    static var current: AppEnvironment {
        #if DEBUG
        return .dev
        #else
        return .prod
        #endif
    }

    /// Whether debug features should be available
    var isDebugEnabled: Bool {
        switch self {
        case .dev: true
        case .staging: true
        case .prod: false
        }
    }

    /// Whether to use in-memory storage (useful for testing/previews)
    var usesInMemoryStorage: Bool {
        self == .dev
    }
}

// MARK: - Service Protocols

/// Protocol for services that need environment-aware configuration
protocol EnvironmentConfigurable {
    init(environment: APIEnvironment)
}

// MARK: - Dependency Container

/// Main dependency injection container providing access to all application services.
///
/// Usage:
/// ```swift
/// // Access shared container
/// let container = DIContainer.shared
///
/// // Get services
/// let api = container.apiClient
/// let auth = container.authService
///
/// // Switch environment (before any services are accessed)
/// DIContainer.configure(environment: .staging)
/// ```
@MainActor
final class DIContainer: Sendable {
    // MARK: - Singleton

    /// Shared container instance
    static let shared = DIContainer()

    // MARK: - Configuration

    /// Current application environment
    private(set) var environment: AppEnvironment

    /// Configure the container with a specific environment.
    /// Must be called before accessing any services.
    static func configure(environment: AppEnvironment) {
        shared.environment = environment
    }

    // MARK: - Initialization

    private init() {
        self.environment = AppEnvironment.current
    }

    // MARK: - Core Services (Lazy Initialization)

    /// API client for network requests
    private var _apiClient: APIClient?
    var apiClient: APIClient {
        if let existing = _apiClient {
            return existing
        }
        let client = APIClient(environment: environment.apiEnvironment)
        _apiClient = client
        return client
    }

    /// WebSocket client for real-time events
    private var _webSocketClient: WebSocketClient?
    var webSocketClient: WebSocketClient {
        if let existing = _webSocketClient {
            return existing
        }
        let client = WebSocketClient(environment: environment.apiEnvironment)
        _webSocketClient = client
        return client
    }

    // MARK: - Auth & Security Services

    /// Authentication service for token management
    private var _authService: AuthService?
    var authService: AuthService {
        if let existing = _authService {
            return existing
        }
        let service = AuthService()
        _authService = service
        return service
    }

    /// Biometric authentication service
    private var _biometricService: BiometricService?
    var biometricService: BiometricService {
        if let existing = _biometricService {
            return existing
        }
        let service = BiometricService()
        _biometricService = service
        return service
    }

    // MARK: - Platform Services

    /// Push notification service
    private var _pushService: PushService?
    var pushService: PushService {
        if let existing = _pushService {
            return existing
        }
        let service = PushService()
        _pushService = service
        return service
    }

    /// Terminal session service
    private var _terminalService: TerminalService?
    var terminalService: TerminalService {
        if let existing = _terminalService {
            return existing
        }
        let service = TerminalService()
        _terminalService = service
        return service
    }

    // MARK: - Feature Services

    /// Feature flag management
    private var _featureFlagService: FeatureFlagService?
    var featureFlagService: FeatureFlagService {
        if let existing = _featureFlagService {
            return existing
        }
        let service = FeatureFlagService()
        // Apply environment-specific defaults
        if environment.isDebugEnabled {
            service.setOverride(.debugStreaming, enabled: true)
        }
        _featureFlagService = service
        return service
    }

    // MARK: - Data Layer

    /// SwiftData store for persistence
    private var _dataStore: DataStore?
    var dataStore: DataStore {
        get throws {
            if let existing = _dataStore {
                return existing
            }
            let store = try DataStore()
            _dataStore = store
            return store
        }
    }

    /// SwiftData model container (convenience accessor)
    var modelContainer: ModelContainer {
        get throws {
            try dataStore.container
        }
    }

    // MARK: - Container Reset (Testing)

    /// Reset all cached services. Used primarily for testing.
    func reset() {
        _apiClient = nil
        _webSocketClient = nil
        _authService = nil
        _biometricService = nil
        _pushService = nil
        _terminalService = nil
        _featureFlagService = nil
        _dataStore = nil
    }
}

// MARK: - SwiftUI Environment Integration

import SwiftUI

/// Environment key for the DI container
private struct DIContainerKey: @preconcurrency EnvironmentKey {
    @MainActor static let defaultValue: DIContainer = .shared
}

extension EnvironmentValues {
    /// Access the dependency injection container
    @MainActor
    var container: DIContainer {
        get { self[DIContainerKey.self] }
        set { self[DIContainerKey.self] = newValue }
    }
}

extension View {
    /// Inject the DI container into the view hierarchy
    @MainActor
    func withContainer(_ container: DIContainer = .shared) -> some View {
        self.environment(\.container, container)
    }
}

// MARK: - Service Factory (Testing Support)

/// Factory for creating services with custom configurations.
/// Useful for testing and SwiftUI previews.
@MainActor
struct ServiceFactory {
    let environment: AppEnvironment

    init(environment: AppEnvironment = .current) {
        self.environment = environment
    }

    func makeAPIClient() -> APIClient {
        APIClient(environment: environment.apiEnvironment)
    }

    func makeWebSocketClient() -> WebSocketClient {
        WebSocketClient(environment: environment.apiEnvironment)
    }

    func makeAuthService() -> AuthService {
        AuthService()
    }

    func makeBiometricService() -> BiometricService {
        BiometricService()
    }

    func makePushService() -> PushService {
        PushService()
    }

    func makeTerminalService() -> TerminalService {
        TerminalService()
    }

    func makeFeatureFlagService() -> FeatureFlagService {
        let service = FeatureFlagService()
        if environment.isDebugEnabled {
            service.setOverride(.debugStreaming, enabled: true)
        }
        return service
    }

    func makeDataStore() throws -> DataStore {
        try DataStore()
    }
}
