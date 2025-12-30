import Foundation

enum FeatureFlag: String, CaseIterable, Sendable {
    case terminalEnabled
    case debugStreaming
}

@MainActor
@Observable
final class FeatureFlagService {
    private var overrides: [FeatureFlag: Bool] = [:]

    func isEnabled(_ flag: FeatureFlag) -> Bool {
        overrides[flag] ?? defaultValue(for: flag)
    }

    func setOverride(_ flag: FeatureFlag, enabled: Bool) {
        overrides[flag] = enabled
    }

    private func defaultValue(for flag: FeatureFlag) -> Bool {
        switch flag {
        case .terminalEnabled:
            #if DEBUG
            return true
            #else
            return false
            #endif
        case .debugStreaming:
            return false
        }
    }
}
