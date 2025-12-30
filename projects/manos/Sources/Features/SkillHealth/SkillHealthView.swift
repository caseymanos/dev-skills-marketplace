import SwiftUI

struct SkillHealthView: View {
    var body: some View {
        List {
            Text("No skills monitored")
                .foregroundStyle(.secondary)
        }
        .navigationTitle("Skill Health")
    }
}

#Preview {
    NavigationStack {
        SkillHealthView()
    }
}
