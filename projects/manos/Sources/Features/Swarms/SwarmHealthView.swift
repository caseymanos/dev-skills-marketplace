import SwiftUI

struct SwarmHealthView: View {
    var body: some View {
        List {
            Text("Swarm health dashboard")
                .foregroundStyle(.secondary)
        }
        .navigationTitle("Swarm Health")
    }
}

#Preview {
    NavigationStack {
        SwarmHealthView()
    }
}
