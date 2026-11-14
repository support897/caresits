import Foundation

/// Cause-proof prints for build 29 (items 1 + 2). Debug builds only; never logs
/// an email, a password or a name, only lengths and result words.
enum Trace {
    static func log(_ tag: String, _ msg: String = "") {
        #if DEBUG
        let line = "CS29TRACE \(ISO8601DateFormatter().string(from: Date())) \(tag) \(msg)"
        NSLog("%@", line)
        if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
            let f = dir.appendingPathComponent("cs29-trace.log")
            if let h = try? FileHandle(forWritingTo: f) { h.seekToEndOfFile(); h.write((line + "\n").data(using: .utf8)!); try? h.close() }
            else { try? (line + "\n").write(to: f, atomically: true, encoding: .utf8) }
        }
        #endif
    }
}
