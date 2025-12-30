import SwiftUI

struct AgentDetailView: View {
    let agentId: String

    var body: some View {
        List {
            Section("Status") {
                Text("Agent: \(agentId)")
            }

            Section("Context Health") {
                Text("Token usage: --")
            }

            Section("Recent Events") {
                Text("No recent events")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Agent Detail")
    }
}

#Preview {
    NavigationStack {
        AgentDetailView(agentId: "agent-123")
    }
}
