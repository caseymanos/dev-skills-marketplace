import SwiftUI

struct ApprovalGatesView: View {
    var body: some View {
        List {
            Text("No pending approvals")
                .foregroundStyle(.secondary)
        }
        .navigationTitle("Approval Gates")
    }
}

#Preview {
    NavigationStack {
        ApprovalGatesView()
    }
}
