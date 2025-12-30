import Foundation
import SwiftData

@MainActor
final class DataStore {
    let container: ModelContainer

    init() throws {
        let schema = Schema([
            Swarm.self,
            Agent.self,
            Incident.self,
            ApprovalGate.self
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        container = try ModelContainer(for: schema, configurations: [modelConfiguration])
    }

    var context: ModelContext {
        container.mainContext
    }
}
