import SwiftUI
import UIKit

enum RdPhotos {
    private static let cache = NSCache<NSString, UIImage>()
    static func image(_ key: String) -> UIImage? {
        if let c = cache.object(forKey: key as NSString) { return c }
        let s: String? = b64A(key) ?? b64B(key) ?? b64C(key)
        guard let str = s, let d = Data(base64Encoded: str), let img = UIImage(data: d) else { return nil }
        cache.setObject(img, forKey: key as NSString)
        return img
    }
}

/// A photo that fills its frame without stretching.
struct RdPhoto: View {
    var key: String
    var contentMode: ContentMode = .fill
    var body: some View {
        GeometryReader { g in
            if let im = RdPhotos.image(key) {
                Image(uiImage: im).resizable().aspectRatio(contentMode: contentMode).frame(width: g.size.width, height: g.size.height).clipped()
            } else {
                Color(hex: 0xF6CBD3)
            }
        }
    }
}
