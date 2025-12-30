import OSLog

enum LogCategory: String {
    case ui
    case ws
    case api
    case terminal
    case push
    case storage
}

enum AppLogger {
    private static let subsystem = Bundle.main.bundleIdentifier ?? "com.agentobs.app"

    static func logger(for category: LogCategory) -> Logger {
        Logger(subsystem: subsystem, category: category.rawValue)
    }
}
