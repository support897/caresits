import Foundation
import PDFKit

/// Reads a resume on the phone. The file is never uploaded. Phone numbers, emails, links and street lines are removed.
enum ResumeParser {
    static func text(from url: URL) throws -> String {
        let ok = url.startAccessingSecurityScopedResource(); defer { if ok { url.stopAccessingSecurityScopedResource() } }
        if url.pathExtension.lowercased() == "pdf" {
            guard let doc = PDFDocument(url: url), let s = doc.string, !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw AppError.msg("We could not read text in that PDF. Try a text file or type it in.") }
            return s
        }
        return try String(contentsOf: url, encoding: .utf8)
    }

    static func redact(_ input: String) -> String {
        var s = input
        let rules = [#"[\w.+-]+@[\w-]+(\.[\w-]+)+"#, #"(https?://|www\.)\S+"#, #"\+?\(?\d[\d\s().-]{7,}\d"#]
        for r in rules { s = s.replacingOccurrences(of: r, with: "", options: .regularExpression) }
        let drop = try! NSRegularExpression(pattern: #"\b(date of birth|dob|passport|tax file|tfn|medicare|licen[cs]e (no|number)|card number)\b"#, options: .caseInsensitive)
        return s.split(separator: "\n", omittingEmptySubsequences: false).filter { l in drop.firstMatch(in: String(l), range: NSRange(location: 0, length: l.utf16.count)) == nil }.joined(separator: "\n")
    }

    enum Section { case summary, jobs, education, skills, certs, skip }
    static func heading(_ line: String) -> Section? {
        let c = line.trimmingCharacters(in: CharacterSet(charactersIn: " :-–—_*#\t")).lowercased()
        if c.isEmpty || c.count > 40 { return nil }
        func m(_ p: String) -> Bool { c.range(of: "^(\(p))$", options: .regularExpression) != nil }
        if m("summary|profile|about me|about|objective|career objective|personal statement|personal profile") { return .summary }
        if m("((relevant |professional |work |childcare |employment |nanny |babysitting )?(experience|history))|employment( history)?|work history") { return .jobs }
        if m("education|training|studies|academic( background)?|education and training") { return .education }
        if m("((key |core |special |personal )?skills)|strengths|interests|languages|abilities") { return .skills }
        if m("certificates?|certifications?|qualifications?|licen[cs]es?|accreditations?|checks|first aid|courses") { return .certs }
        if m("references?|referees?|contact( details)?|personal details") { return .skip }
        return nil
    }
    static func clip(_ s: String, _ n: Int = 300) -> String { String(s.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ").prefix(n)) }
    static func entries(_ lines: [String]) -> [String] {
        var out: [String] = []
        for raw in lines {
            let l = raw.trimmingCharacters(in: .whitespaces); if l.isEmpty { continue }
            let isBullet = l.range(of: #"^([•·▪●◦*\-–—]|\d+[.)])\s+"#, options: .regularExpression) != nil
            let stripped = l.replacingOccurrences(of: #"^([•·▪●◦*\-–—]|\d+[.)])\s+"#, with: "", options: .regularExpression)
            if isBullet, !out.isEmpty { out[out.count - 1] += "; " + stripped } else { out.append(stripped) }
        }
        return out.map { clip($0) }.filter { !$0.isEmpty }
    }
    static func parse(_ input: String) -> Resume {
        let lines = redact(input.replacingOccurrences(of: "\r", with: "\n")).components(separatedBy: "\n")
        var b: [Section: [String]] = [:]; var cur: Section? = nil; var pre: [String] = []
        for l in lines {
            if let h = heading(l) { cur = h; continue }
            if let c = cur { b[c, default: []].append(l) } else if !l.trimmingCharacters(in: .whitespaces).isEmpty { pre.append(l) }
        }
        let found = [Section.summary, .jobs, .education, .skills, .certs].contains { !(b[$0] ?? []).allSatisfy { $0.trimmingCharacters(in: .whitespaces).isEmpty } }
        let sum = found ? (b[.summary] ?? []).joined(separator: " ") : pre.dropFirst().joined(separator: " ")
        let skills = (b[.skills] ?? []).flatMap { $0.replacingOccurrences(of: #"^([•·▪●◦*\-–—]|\d+[.)])\s+"#, with: "", options: .regularExpression).split(whereSeparator: { ",;|•·".contains($0) }) }.map { clip(String($0), 60) }.filter { $0.count > 1 }
        var seen = Set<String>(); let uniq = skills.filter { seen.insert($0).inserted }
        return Resume(summary: clip(sum, 600), jobs: Array(entries(b[.jobs] ?? []).prefix(8)), education: Array(entries(b[.education] ?? []).prefix(6)), skills: Array(uniq.prefix(20)), certificates: Array(entries(b[.certs] ?? []).prefix(8)))
    }

    /// Years of work counted from ranges like "2019 - 2022" or "2021 - present".
    static func years(_ r: Resume) -> Int {
        let now = Calendar.current.component(.year, from: Date()); var total = 0
        let re = try! NSRegularExpression(pattern: #"((?:19|20)\d{2})\s*[-–—to ]+\s*((?:19|20)\d{2}|present|current)"#, options: .caseInsensitive)
        for j in r.jobs {
            guard let m = re.firstMatch(in: j, range: NSRange(j.startIndex..., in: j)), let a = Range(m.range(at: 1), in: j), let bR = Range(m.range(at: 2), in: j) else { continue }
            let start = Int(j[a]) ?? 0; let end = Int(j[bR]) ?? now
            if end >= start && end - start <= 40 { total += end - start }
        }
        return min(total, 30)
    }
    static func headline(_ r: Resume) -> String {
        let first = r.summary.components(separatedBy: ". ").first ?? ""
        let h = first.isEmpty ? (r.jobs.first ?? "") : first
        return String(h.split(separator: "(").first.map(String.init)?.trimmingCharacters(in: .whitespaces).prefix(80) ?? "")
    }
}
