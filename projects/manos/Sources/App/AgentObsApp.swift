import SwiftUI
import SwiftData

@main
struct AgentObsApp: App {
    /// Access to the dependency injection container
    @MainActor private let container = DIContainer.shared

    init() {
        // Configure environment before any services are accessed
        // In a real app, this could be read from launch arguments or config
        #if DEBUG
        DIContainer.configure(environment: .dev)
        #else
        DIContainer.configure(environment: .prod)
        #endif
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .withContainer(container)
        }
        .modelContainer(makeModelContainer())
    }

    /// Create the SwiftData model container from the DI container
    @MainActor
    private func makeModelContainer() -> ModelContainer {
        do {
            return try container.modelContainer
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }
}
