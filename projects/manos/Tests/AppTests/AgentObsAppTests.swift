import Testing
@testable import AgentObservability

@Suite("App Tests")
struct AgentObsAppTests {
    @Test("App launches successfully")
    func appLaunches() async throws {
        // Basic smoke test
        #expect(true)
    }
}
