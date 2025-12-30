import SwiftUI

struct TerminalSessionsView: View {
    var body: some View {
        List {
            Text("No terminal sessions configured")
                .foregroundStyle(.secondary)
        }
        .navigationTitle("Terminal Sessions")
    }
}

#Preview {
    NavigationStack {
        TerminalSessionsView()
    }
}
