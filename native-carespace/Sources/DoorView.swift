import SwiftUI
import AuthenticationServices

/// DOOR LAW — NEW SHAPE (Ilse, 11 Nov): the first page shows ONLY Google and
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
        do { try await f() } catch { err = Self.spoken(error) }
        busy = false
    }
    static func spoken(_ e: Error) -> String {
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

/// The CareSpace mark, drawn in code from the approved brand SVG geometry
/// (house + heart). The logo redo concepts wait on Ilse's pick; until she
/// approves one, the current mark geometry stands.
struct LogoMark: View {
    var size: CGFloat = 120
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.225).fill(Brand.blush)
            HouseHeart().fill(Brand.ink)
                .padding(size * 0.13)
            HeartShape().fill(Brand.cream)
                .frame(width: size * 0.34, height: size * 0.30)
                .offset(y: size * 0.10)
        }
        .frame(width: size, height: size)
        .accessibilityLabel("CareSpace")
    }
}

struct HouseHeart: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        let h = r.height
        p.move(to: CGPoint(x: r.minX, y: r.minY + h * 0.38))
        p.addLine(to: CGPoint(x: r.midX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.minY + h * 0.38))
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX, y: r.maxY))
        p.closeSubpath()
        return p
    }
}

struct HeartShape: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        let w = r.width, h = r.height
        p.move(to: CGPoint(x: r.midX, y: r.maxY))
        p.addCurve(to: CGPoint(x: r.minX, y: r.minY + h * 0.35),
                   control1: CGPoint(x: r.minX + w * 0.1, y: r.minY + h * 0.75),
                   control2: CGPoint(x: r.minX, y: r.minY + h * 0.55))
        p.addCurve(to: CGPoint(x: r.midX, y: r.minY + h * 0.28),
                   control1: CGPoint(x: r.minX, y: r.minY + h * 0.05),
                   control2: CGPoint(x: r.midX - w * 0.18, y: r.minY))
        p.addCurve(to: CGPoint(x: r.maxX, y: r.minY + h * 0.35),
                   control1: CGPoint(x: r.midX + w * 0.18, y: r.minY),
                   control2: CGPoint(x: r.maxX, y: r.minY + h * 0.05))
        p.addCurve(to: CGPoint(x: r.midX, y: r.maxY),
                   control1: CGPoint(x: r.maxX, y: r.minY + h * 0.55),
                   control2: CGPoint(x: r.maxX - w * 0.1, y: r.minY + h * 0.75))
        return p
    }
}
