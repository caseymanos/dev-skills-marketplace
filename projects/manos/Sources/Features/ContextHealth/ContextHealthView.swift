import SwiftUI

struct ContextHealthView: View {
    var body: some View {
        List {
            Section("Token Usage") {
                Text("--/-- tokens")
            }

            Section("Redundancy Score") {
                Text("--")
            }
        }
        .navigationTitle("Context Health")
    }
}

#Preview {
    NavigationStack {
        ContextHealthView()
    }
}
