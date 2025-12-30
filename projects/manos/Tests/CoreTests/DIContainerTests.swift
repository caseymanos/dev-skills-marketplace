import Testing
@testable import AgentObservability

@Suite("DIContainer Tests")
struct DIContainerTests {

    // MARK: - Environment Configuration Tests

    @Test("AppEnvironment maps to correct API environment")
    func appEnvironmentMapping() {
        #expect(AppEnvironment.dev.apiEnvironment == .dev)
        #expect(AppEnvironment.staging.apiEnvironment == .staging)
        #expect(AppEnvironment.prod.apiEnvironment == .prod)
    }

    @Test("AppEnvironment debug flag is correct")
    func environmentDebugFlag() {
        #expect(AppEnvironment.dev.isDebugEnabled == true)
        #expect(AppEnvironment.staging.isDebugEnabled == true)
        #expect(AppEnvironment.prod.isDebugEnabled == false)
    }

    @Test("AppEnvironment in-memory storage flag")
    func environmentStorageFlag() {
        #expect(AppEnvironment.dev.usesInMemoryStorage == true)
        #expect(AppEnvironment.staging.usesInMemoryStorage == false)
        #expect(AppEnvironment.prod.usesInMemoryStorage == false)
    }

    // MARK: - Container Configuration Tests

    @MainActor
    @Test("Container can be configured with different environments")
    func containerConfiguration() {
        let container = DIContainer.shared

        DIContainer.configure(environment: .staging)
        #expect(container.environment == .staging)

        DIContainer.configure(environment: .prod)
        #expect(container.environment == .prod)

        // Reset to dev for other tests
        DIContainer.configure(environment: .dev)
        container.reset()
    }

    // MARK: - Service Access Tests

    @MainActor
    @Test("Container provides lazy-initialized services")
    func lazyServiceInitialization() {
        let container = DIContainer.shared
        container.reset()

        // Services should be created on first access
        let api = container.apiClient
        let ws = container.webSocketClient
        let auth = container.authService
        let bio = container.biometricService
        let push = container.pushService
        let terminal = container.terminalService
        let flags = container.featureFlagService

        // Verify they're the same instances on subsequent access
        #expect(container.apiClient === api)
        #expect(container.webSocketClient === ws)
        #expect(container.authService === auth)
        #expect(container.biometricService === bio)
        #expect(container.pushService === push)
        #expect(container.terminalService === terminal)
        #expect(container.featureFlagService === flags)

        container.reset()
    }

    @MainActor
    @Test("Container reset clears cached services")
    func containerReset() {
        let container = DIContainer.shared

        // Access a service to cache it
        let firstApi = container.apiClient

        // Reset the container
        container.reset()

        // Access should create a new instance
        let secondApi = container.apiClient

        #expect(firstApi !== secondApi)
        container.reset()
    }

    // MARK: - Service Factory Tests

    @MainActor
    @Test("ServiceFactory creates services with correct environment")
    func serviceFactoryCreation() {
        let devFactory = ServiceFactory(environment: .dev)
        let prodFactory = ServiceFactory(environment: .prod)

        #expect(devFactory.environment == .dev)
        #expect(prodFactory.environment == .prod)

        // Factories should create independent instances
        let devApi = devFactory.makeAPIClient()
        let prodApi = prodFactory.makeAPIClient()

        #expect(devApi !== prodApi)
    }

    @MainActor
    @Test("ServiceFactory applies environment-specific feature flags")
    func factoryFeatureFlags() {
        let devFactory = ServiceFactory(environment: .dev)
        let prodFactory = ServiceFactory(environment: .prod)

        let devFlags = devFactory.makeFeatureFlagService()
        let prodFlags = prodFactory.makeFeatureFlagService()

        // Dev should have debug streaming enabled
        #expect(devFlags.isEnabled(.debugStreaming) == true)

        // Prod should have debug streaming disabled by default
        #expect(prodFlags.isEnabled(.debugStreaming) == false)
    }
}
