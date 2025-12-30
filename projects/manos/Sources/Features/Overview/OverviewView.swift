import SwiftUI

struct OverviewView: View {
    var body: some View {
        List {
            Section("Active Incidents") {
                Text("No active incidents")
                    .foregroundStyle(.secondary)
            }

            Section("Active Swarms") {
                Text("No active swarms")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Overview")
    }
}

#Preview {
    NavigationStack {
        OverviewView()
    }
}
