import SwiftUI

struct LiveTraceView: View {
    var body: some View {
        List {
            Text("Live trace & logs stream")
                .foregroundStyle(.secondary)
        }
        .navigationTitle("Live Trace")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Open in Web") {
                    // Deep link to web
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        LiveTraceView()
    }
}
