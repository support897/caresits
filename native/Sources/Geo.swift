import Foundation
import CoreLocation

/// Postcode to place, and distance between two places. Uses the phone's own geocoder (no key, no new service).
/// Only the postcode is looked up, never a street address. Results are kept on the phone so each postcode is asked once.
enum Geo {
    static var cache: [String: CLLocationCoordinate2D] = [:]
    static var misses: Set<String> = []
    private static let defaultsKey = "caresits.geo.cache"

    static func loadCache() {
        guard cache.isEmpty, let d = UserDefaults.standard.dictionary(forKey: defaultsKey) as? [String: [Double]] else { return }
        for (k, v) in d where v.count == 2 { cache[k] = CLLocationCoordinate2D(latitude: v[0], longitude: v[1]) }
    }
    static func saveCache() {
        UserDefaults.standard.set(cache.mapValues { [$0.latitude, $0.longitude] }, forKey: defaultsKey)
    }
    static func coord(postcode: String) async -> CLLocationCoordinate2D? {
        let pc = postcode.trimmingCharacters(in: .whitespaces)
        guard pc.count >= 4 else { return nil }
        loadCache()
        if let c = cache[pc] { return c }
        if misses.contains(pc) { return nil }
        let marks = try? await CLGeocoder().geocodeAddressString("\(pc), Australia")
        if let c = marks?.first?.location?.coordinate { cache[pc] = c; saveCache(); return c }
        misses.insert(pc); return nil
    }
    static func km(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        CLLocation(latitude: a.latitude, longitude: a.longitude).distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude)) / 1000
    }
    static func label(_ km: Double) -> String { km < 1 ? "Under 1 km" : "\(Int(km.rounded())) km" }
}
