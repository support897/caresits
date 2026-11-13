import SwiftUI
import AuthenticationServices

/// DOOR LAW — NEW SHAPE (standing): the first page shows ONLY Google and
/// Apple, plus ONE small button for email instead. No unnecessary text.
/// The email door is its own page (EmailDoorView). Sign-up is the first screen.
struct DoorView: View {
    @EnvironmentObject var s: Session
    @State private var err = ""
    @State private var busy = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 22) {
                Spacer()
                LogoMark(size: 128)
                Text("CareSpace").font(Brand.title(40)).foregroundStyle(Brand.ink)
                Spacer()
                VStack(spacing: 12) {
                    SignInWithAppleButton(.continue) { s.prepareApple($0) } onCompletion: { r in
                        Task { await run { try await s.finishApple(r) } }
                    }
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 54).clipShape(RoundedRectangle(cornerRadius: 16))

                    Button { Task { await run { try await s.google() } } } label: {
                        HStack(spacing: 10) {
                            GoogleG()
                            Text("Continue with Google").font(.system(size: 18, weight: .semibold))
                        }
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(.white).foregroundStyle(.black)
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.35)))
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    }

                    NavigationLink {
                        EmailDoorView()
                    } label: {
                        Text("Use email instead")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(Brand.ink)
                            .padding(.vertical, 8)
                    }
                }
                if !err.isEmpty {
                    Text(err).foregroundStyle(.red).font(.callout).multilineTextAlignment(.center)
                }
                Spacer().frame(height: 8)
            }
            .padding(24)
            .background(Color.white.ignoresSafeArea())
            .navigationBarHidden(true)
        }
    }

    func run(_ f: () async throws -> Void) async {
        busy = true; err = ""
        do { try await f() }
        // A cancel or walk-back is a quiet return — the door stands clean,
        // no error line (F-CS27-2).
        catch let e where Session.isCancel(e) { }
        catch { err = Self.spoken(error) }
        busy = false
    }
    static func spoken(_ e: Error) -> String {
        if case AppError.msg(let m) = e { return m }
        let t = e.localizedDescription
        if t.contains("17011") || t.lowercased().contains("no user record") || t.lowercased().contains("user-not-found") {
            return "No account with that email. Use Sign up to make one."
        }
        if t.contains("17009") || t.lowercased().contains("wrong-password") || t.lowercased().contains("invalid-credential") {
            return "That password does not match. Try again."
        }
        if t.contains("17007") || t.lowercased().contains("already-in-use") {
            return "That email already has an account. Use Sign in."
        }
        return "Something went wrong. Please try again."
    }
}

/// The Google G, drawn as vector arcs in Google's four colours — a designed
/// mark, never a bare letter.
struct GoogleG: View {
    var size: CGFloat = 22
    var body: some View {
        ZStack {
            arc(color: Color(hex: 0xEA4335), from: -50, to: 35)
            arc(color: Color(hex: 0xFBBC05), from: 35, to: 125)
            arc(color: Color(hex: 0x34A853), from: 125, to: 215)
            arc(color: Color(hex: 0x4285F4), from: 215, to: 310)
            Rectangle().fill(Color(hex: 0x4285F4))
                .frame(width: size * 0.52, height: size * 0.18)
                .offset(x: size * 0.24, y: 0)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
    private func arc(color: Color, from: Double, to: Double) -> some View {
        Circle().trim(from: CGFloat(from + 90) / 360, to: CGFloat(to + 90) / 360)
            .stroke(color, style: StrokeStyle(lineWidth: size * 0.24, lineCap: .butt))
            .rotationEffect(.degrees(-90))
            .frame(width: size * 0.82, height: size * 0.82)
    }
}

/// The CareSpace mark — her pick of record, "way 1 The Answer Back"
/// (Logo Boss carespace-logo-pro.svg, md5 a4fa07a2; the PNG in the asset
/// catalog is byte-identical to the Logo Boss export). Proper graphic
/// artwork, never drawn in code: the old code-drawn house+heart is gone.
struct LogoMark: View {
    var size: CGFloat = 120
    var body: some View {
        Image("CareSpaceMark")
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(height: size)
            .accessibilityLabel("CareSpace")
    }
}
