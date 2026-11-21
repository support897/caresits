import SwiftUI

// Map, home, bookings, messages, me, settings, menu, safety, resume and review screens.

struct RdMapArt: View {
    var body: some View {
        Canvas { g, s in
            g.fill(Path(CGRect(origin: .zero, size: s)), with: .color(Color(hex: 0xF4EEF1)))
            var river = Path()
            river.move(to: CGPoint(x: -10, y: s.height * 0.55))
            river.addCurve(to: CGPoint(x: s.width * 0.55, y: s.height * 0.42), control1: CGPoint(x: s.width * 0.15, y: s.height * 0.72), control2: CGPoint(x: s.width * 0.35, y: s.height * 0.28))
            river.addCurve(to: CGPoint(x: s.width + 10, y: s.height * 0.62), control1: CGPoint(x: s.width * 0.75, y: s.height * 0.56), control2: CGPoint(x: s.width * 0.9, y: s.height * 0.7))
            g.stroke(river, with: .color(RdC.sky.opacity(0.9)), style: StrokeStyle(lineWidth: 30, lineCap: .round))
            for i in 0..<7 {
                var r = Path()
                let y = s.height * (0.08 + 0.14 * Double(i))
                r.move(to: CGPoint(x: 0, y: y)); r.addLine(to: CGPoint(x: s.width, y: y + (i % 2 == 0 ? 30 : -24)))
                g.stroke(r, with: .color(Color.white), style: StrokeStyle(lineWidth: i % 3 == 0 ? 9 : 5, lineCap: .round))
            }
            for i in 0..<5 {
                var r = Path()
                let x = s.width * (0.08 + 0.2 * Double(i))
                r.move(to: CGPoint(x: x, y: 0)); r.addLine(to: CGPoint(x: x + (i % 2 == 0 ? 40 : -30), y: s.height))
                g.stroke(r, with: .color(Color.white), style: StrokeStyle(lineWidth: i % 2 == 0 ? 8 : 5, lineCap: .round))
            }
            let parks: [CGRect] = [CGRect(x: s.width * 0.1, y: s.height * 0.1, width: 90, height: 60), CGRect(x: s.width * 0.62, y: s.height * 0.72, width: 100, height: 70)]
            for p in parks { g.fill(Path(roundedRect: p, cornerRadius: 22), with: .color(Color(hex: 0xDDEBD8))) }
        }
    }
}

struct RdMap: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                RdMapArt().ignoresSafeArea()
                pins(c, geo.size)
                VStack { RdTopBar(on: "map"); Spacer() }
                VStack(spacing: 8) {
                    HStack(spacing: 6) {
                        RdChip(text: "12 km", icon: "pin")
                        RdChip(text: c.fm ? "Free Mon Wed Fri" : "Needs Mon Wed Fri", icon: "calendar")
                        Spacer()
                    }.padding(.horizontal, 16)
                    HStack(spacing: 12) {
                        RdPhoto(key: c.photos[0]).frame(width: 64, height: 64).clipShape(RoundedRectangle(cornerRadius: 18))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(c.name).font(RdF.bold(17)).foregroundColor(RdC.ink).lineLimit(1)
                            Text(c.subline).font(RdF.body(12)).foregroundColor(RdC.mut).lineLimit(1)
                            RdPills(roles: Array(c.pillRoles.prefix(1)))
                        }
                        Spacer(minLength: 0)
                        RdRing(pct: c.m.pct, size: 62, line: 7)
                    }.padding(12).background(Color.white).clipShape(RoundedRectangle(cornerRadius: 26)).padding(.horizontal, 12).onTapGesture { st.go("profile") }
                    HStack(spacing: 12) {
                        RdCta(title: c.mainTitle, icon: c.mainIcon) { st.go("book") }
                        RdMsgButton { st.go("chat") }
                    }.padding(.horizontal, 16).padding(.bottom, 8)
                }
            }
        }
    }
    @ViewBuilder func pins(_ c: RdCtx, _ size: CGSize) -> some View {
        let pts: [(String, Double, Double, Bool)] = mapPoints(c)
        ForEach(0..<pts.count, id: \.self) { i in
            let p = pts[i]
            BunnyPin(selected: p.3).scaleEffect(p.3 ? 0.6 : 0.46).position(x: size.width * p.1, y: size.height * p.2)
        }
    }
    func mapPoints(_ c: RdCtx) -> [(String, Double, Double, Bool)] {
        var out: [(String, Double, Double, Bool)] = []
        func norm(_ lat: Double, _ lng: Double) -> (Double, Double) {
            let x: Double = (lng - 152.95) / 0.13
            let y: Double = (-27.37 - lat) / 0.17
            return (min(0.9, max(0.1, x)), min(0.6, max(0.18, y * 0.7 + 0.05)))
        }
        if c.fm {
            for p in RdData.carers where p.role == c.role { let n = norm(p.lat, p.lng); out.append((p.id, n.0, n.1, p.id == c.car.id)) }
        } else {
            for f in RdData.families where f.kind == c.fam.kind { let n = norm(f.lat, f.lng); out.append((f.id, n.0, n.1, f.id == c.fam.id)) }
        }
        return out
    }
}

struct RdWorldMap: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        let ap: [RdCarer] = RdData.carers.filter { $0.role == "aupair" }
        VStack(spacing: 0) {
            HStack { Text("Au pairs near and far").font(RdF.title(22)).foregroundColor(RdC.ink); Spacer() }.padding(.horizontal, 20).padding(.top, 4)
            RdTopBar(on: "map")
            ScrollView(showsIndicators: false) {
                VStack(spacing: 8) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 24).fill(Color(hex: 0xF4EEF1))
                        Canvas { g, s in
                            let spots: [(Double, Double)] = [(0.5, 0.3), (0.52, 0.34), (0.55, 0.28), (0.5, 0.4), (0.2, 0.3), (0.25, 0.4), (0.3, 0.5), (0.7, 0.35), (0.78, 0.4), (0.8, 0.7), (0.85, 0.75), (0.5, 0.55), (0.55, 0.6), (0.6, 0.62)]
                            for p in spots { g.fill(Path(ellipseIn: CGRect(x: s.width * p.0 - 14, y: s.height * p.1 - 12, width: 28, height: 24)), with: .color(RdC.blush.opacity(0.7))) }
                        }
                        BunnyPin(selected: true).scaleEffect(0.5).position(x: 330, y: 140)
                        BunnyPin().scaleEffect(0.4).position(x: 170, y: 70)
                        BunnyPin().scaleEffect(0.4).position(x: 200, y: 90)
                    }.frame(height: 220).padding(.horizontal, 16).padding(.top, 8)
                    RdFlow(spacing: 6) { RdChip(text: "Visa ready", tone: 1); RdChip(text: "Already in Australia"); RdChip(text: "Arriving by February", tone: 2) }.padding(.horizontal, 16)
                    ForEach(Array(ap.enumerated()), id: \.offset) { _, a in
                        let m = RdMatch.score(RdData.family(id: "hartley"), a)
                        HStack(spacing: 12) {
                            RdPhoto(key: a.photos[0]).frame(width: 56, height: 56).clipShape(RoundedRectangle(cornerRadius: 16))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(a.name).font(RdF.bold(16)).foregroundColor(RdC.ink)
                                Text(a.from + " · " + a.visa.arrives).font(RdF.body(12)).foregroundColor(RdC.mut)
                                RdVisaChip(visa: a.visa)
                            }
                            Spacer(minLength: 0)
                            RdRing(pct: m.pct, size: 50, line: 6)
                        }.padding(10).background(Color.white).overlay(RoundedRectangle(cornerRadius: 22).stroke(RdC.line, lineWidth: 1)).padding(.horizontal, 16).onTapGesture { st.go("profile") }
                    }
                    RdCta(title: c.mainTitle, icon: c.mainIcon) { st.go("book") }.padding(.horizontal, 16).padding(.top, 6)
                }.padding(.bottom, 20)
            }
        }
    }
}

struct RdHomeCard: View {
    var pct: Int
    var label: String
    var name: String
    var sub: String
    var photo: String
    var body: some View {
        HStack(spacing: 14) {
            RdPhoto(key: photo).frame(width: 72, height: 72).clipShape(RoundedRectangle(cornerRadius: 20))
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(RdF.bold(13)).foregroundColor(RdC.ras)
                Text(name).font(RdF.title(20)).foregroundColor(RdC.ink)
                Text(sub).font(RdF.body(14)).foregroundColor(RdC.mut)
            }
            Spacer(minLength: 0)
            RdRing(pct: pct, size: 72, line: 8)
        }.padding(14).background(RdC.pale).clipShape(RoundedRectangle(cornerRadius: 28)).padding(.horizontal, 16).padding(.vertical, 6)
    }
}

struct RdFamHome: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 0) { Text("Good morning, Sofia").font(RdF.body(14)).foregroundColor(RdC.mut); Text("Your best pair today").font(RdF.title(26)).foregroundColor(RdC.ink) }
                Spacer()
                RdIconButton(icon: "menu") { st.go("menu") }
            }.padding(.horizontal, 20).padding(.top, 6)
            RdScroll {
                RdHomeCard(pct: 97, label: "Perfect Pair", name: "Maya Okafor", sub: "Nanny, 2.9 km away", photo: "n1").onTapGesture { st.viewKey = "v1"; st.go("profile") }
                HStack(spacing: 12) {
                    RdCta(title: "Book Maya", icon: "calendar") { st.viewKey = "v1"; st.go("book") }
                    RdMsgButton { st.viewKey = "v1"; st.go("chat") }
                }.padding(.horizontal, 16).padding(.top, 4)
                HStack(spacing: 10) {
                    RdCta(title: "See all matches", style: 1, small: true) { st.viewKey = "v1"; st.root("deck") }
                    RdCta(title: "Map", style: 1, small: true) { st.viewKey = "v1"; st.root("map") }
                }.padding(.horizontal, 16).padding(.top, 8)
                RdLabel(title: "This week")
                RdCard { RdMuted(text: "No bookings yet. Book Maya to get started.") }
                RdLabel(title: "Need care another way?")
                HStack(spacing: 10) {
                    RdCta(title: "Babysitter", icon: "moon", style: 1, small: true) { st.viewKey = "v2"; st.root("deck") }
                    RdCta(title: "Au pair", icon: "globe", style: 1, small: true) { st.viewKey = "v3"; st.root("deck") }
                }.padding(.horizontal, 16)
            }
        }
    }
}

struct RdCarHome: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 0) { Text("Good morning, Maya").font(RdF.body(14)).foregroundColor(RdC.mut); Text("Families who fit you").font(RdF.title(26)).foregroundColor(RdC.ink) }
                Spacer()
                RdIconButton(icon: "menu") { st.go("menu") }
            }.padding(.horizontal, 20).padding(.top, 6)
            RdScroll {
                RdHomeCard(pct: 97, label: "Perfect Pair", name: "The Reyes family", sub: "Offers $42 an hour", photo: "f1").onTapGesture { st.viewKey = "v4"; st.go("profile") }
                RdCta(title: "Say yes to the Reyes family", icon: "check") { st.viewKey = "v4"; st.go("book") }.padding(.horizontal, 16).padding(.top, 4)
                RdLabel(title: "Your profile")
                RdCard { RdMuted(text: "Complete. Blue Card checked 14 Aug 2026. First aid sighted.") }
                RdLabel(title: "Your week")
                RdCalendar(days: ["Mon", "Tue", "Wed", "Thu", "Fri"], from: 7, to: 18)
            }
        }
    }
}

struct RdTabs: View {
    @EnvironmentObject var st: RdStore
    static func tabIndex(_ id: String) -> Int {
        switch id {
        case "famhome", "carhome": return 0
        case "deck", "list": return 1
        case "map", "worldmap": return 2
        case "bookings": return 3
        case "inbox": return 4
        default: return 0
        }
    }
    var body: some View {
        let items: [(String, String, String)] = [("Home", "home", st.isFamily ? "famhome" : "carhome"), (st.isFamily ? "Discover" : "Find Families", "search", "deck"), ("Map", "pin", "map"), ("Bookings", "calendar", "bookings"), ("Messages", "chat", "inbox")]
        VStack(spacing: 0) {
            Rectangle().fill(RdC.line).frame(height: 1)
            HStack(spacing: 0) {
                ForEach(0..<items.count, id: \.self) { i in
                    let on: Bool = RdTabs.tabIndex(st.current) == i
                    Button { st.tab = i; st.root(items[i].2) } label: {
                        VStack(spacing: 3) {
                            RdIcon(name: items[i].1, size: 24, color: on ? RdC.ras : RdC.mut)
                            Text(items[i].0).font(RdF.bold(11)).foregroundColor(on ? RdC.ras : RdC.mut).lineLimit(1).minimumScaleFactor(0.7)
                        }.frame(maxWidth: .infinity)
                    }.buttonStyle(.plain)
                }
            }.padding(.top, 8).padding(.bottom, 4)
        }.background(Color.white)
    }
}

struct RdBookingRow: View {
    var photo: String
    var name: String
    var when: String
    var status: String
    var body: some View {
        HStack(spacing: 12) {
            RdPhoto(key: photo).frame(width: 52, height: 52).clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) { Text(name).font(RdF.bold(16)).foregroundColor(RdC.ink); Text(when).font(RdF.body(13)).foregroundColor(RdC.mut) }
            Spacer()
            RdTag(text: status, fill: status == "Confirmed" ? RdC.okBg : RdC.warnBg, fg: status == "Confirmed" ? RdC.okFg : RdC.warnFg)
        }.padding(12).background(Color.white).overlay(RoundedRectangle(cornerRadius: 22).stroke(RdC.line, lineWidth: 1)).padding(.horizontal, 16).padding(.vertical, 4)
    }
}

struct RdBookings: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        VStack(spacing: 0) {
            RdHeader(title: "Bookings", back: false)
            RdPick(items: ["Coming up", "Waiting", "Past"], sel: 0).padding(.horizontal, 20).padding(.bottom, 6)
            RdScroll {
                RdBookingRow(photo: c.photos[0], name: c.name, when: c.fam.needDays.isEmpty ? "From " + c.fam.start : RdMatch.daysText(c.fam.needDays), status: "Confirmed")
                RdBookingRow(photo: "b1", name: "Lily Chen", when: "Fri 6pm", status: "Waiting")
            }
        }
    }
}

struct RdInboxRow: View {
    var photo: String
    var name: String
    var msg: String
    var time: String
    var unread: Bool
    var role: String
    var body: some View {
        HStack(spacing: 12) {
            RdPhoto(key: photo).frame(width: 54, height: 54).clipShape(Circle())
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) { Text(name).font(RdF.bold(16)).foregroundColor(RdC.ink); RdPill(role: role) }
                Text(msg).font(RdF.body(14)).foregroundColor(RdC.mut).lineLimit(1)
            }
            Spacer(minLength: 0)
            VStack(spacing: 6) { Text(time).font(RdF.body(12)).foregroundColor(RdC.mut); if unread { Circle().fill(RdC.ras).frame(width: 10, height: 10) } }
        }.padding(.horizontal, 20).padding(.vertical, 8)
    }
}

struct RdInbox: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        VStack(spacing: 0) {
            RdHeader(title: "Messages", back: false)
            RdPick(items: ["All", "Not booked yet", "Booked"], sel: 0).padding(.horizontal, 20).padding(.bottom, 6)
            RdScroll {
                RdInboxRow(photo: c.photos[0], name: c.name, msg: "Wednesday works. See you then.", time: "now", unread: true, role: c.fm ? c.role : "family").onTapGesture { st.go("chat") }
                RdInboxRow(photo: "b1", name: "Lily Chen", msg: "Happy to help on Friday", time: "2h", unread: false, role: "babysitter").onTapGesture { st.go("chat") }
                RdInboxRow(photo: "a1", name: "Anna Keller", msg: "My visa letter is ready", time: "Mon", unread: false, role: "aupair").onTapGesture { st.go("chat") }
                RdInboxRow(photo: "f1", name: "The Reyes family", msg: "Hello! We read your profile", time: "Sun", unread: false, role: "family").onTapGesture { st.go("chat") }
            }
        }
    }
}

struct RdNavRow: View {
    var icon: String
    var title: String
    var value: String = ""
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                RdIcon(name: icon, size: 24)
                Text(title).font(RdF.body(17)).foregroundColor(RdC.ink)
                Spacer()
                if !value.isEmpty { Text(value).font(RdF.body(15)).foregroundColor(RdC.mut) }
                RdIcon(name: "chevron", size: 18, color: RdC.mut)
            }.padding(.horizontal, 20).padding(.vertical, 14).overlay(Rectangle().fill(RdC.line).frame(height: 1), alignment: .bottom)
        }.buttonStyle(.plain)
    }
}

struct RdMe: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let c = st.ctx()
        VStack(spacing: 0) {
            RdHeader(title: "Me")
            RdScroll {
                HStack(spacing: 14) {
                    RdPhoto(key: c.fm ? "f1" : "n1").frame(width: 70, height: 70).clipShape(Circle())
                    VStack(alignment: .leading) { Text(c.fm ? "Sofia Reyes" : "Maya Okafor").font(RdF.title(22)).foregroundColor(RdC.ink); Text(c.fm ? "Family" : "Nanny").font(RdF.body(15)).foregroundColor(RdC.mut) }
                    Spacer()
                }.padding(20)
                RdNavRow(icon: "person", title: "My profile") { st.go("profile") }
                RdNavRow(icon: "camera", title: "My photos") { st.go("photoup") }
                RdNavRow(icon: "star", title: "Reviews") { st.go("revreq") }
                RdNavRow(icon: "shield", title: "Safety and checks") { st.go("safety") }
                RdNavRow(icon: "settings", title: "Settings") { st.go("settings") }
            }
        }
    }
}

struct RdSettings: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: "Settings")
            RdScroll {
                RdNavRow(icon: "sun", title: "Theme", value: "Light") { }
                RdNavRow(icon: "globe", title: "Language", value: "English") { }
                RdNavRow(icon: "bunny", title: "Bunny", value: "Pink") { }
                RdNavRow(icon: "bell", title: "Notifications", value: "On") { }
                RdNavRow(icon: "sliders", title: "What matters to me") { st.go("settingsmatch") }
                RdNavRow(icon: "loop", title: "Sign out") { st.root("splash") }
                RdNavRow(icon: "x", title: "Delete account") { }
            }
        }
    }
}

struct RdSettingsMatch: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let labels: [(String, Int)] = [("Days and hours", 25), ("Style and approach", 20), ("Skills", 20), ("Language", 15), ("Place", 10), ("Activities", 10)]
        VStack(spacing: 0) {
            RdHeader(title: "What matters to you")
            RdScroll {
                RdMuted(text: "Slide up what matters most. Your matches update.").padding(.horizontal, 20)
                ForEach(0..<labels.count, id: \.self) { i in RdWeightRow(label: labels[i].0, value: Double(labels[i].1)) }
                RdMuted(text: "Money never adds points. Must haves are always kept.").padding(.horizontal, 20).padding(.top, 10)
            }
            RdBottomBar { RdCta(title: "Update my matches") { st.back() } }
        }
    }
}

struct RdWeightRow: View {
    var label: String
    @State var value: Double
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack { Text(label).font(RdF.body(16)).foregroundColor(RdC.ink); Spacer(); Text(String(Int(value))).font(RdF.bold(16)).foregroundColor(RdC.ink) }
            Slider(value: $value, in: 0...40, step: 5).tint(RdC.pink)
        }.padding(.horizontal, 20).padding(.vertical, 4)
    }
}

struct RdMenu: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let fam: [(String, String)] = [("child", "My children"), ("home", "My family profile"), ("heart", "Saved carers"), ("camera", "My photos"), ("shield", "Safety and checks"), ("bell", "Notifications"), ("group", "CareSpace"), ("info", "Help and support"), ("settings", "Settings"), ("loop", "Switch role")]
        let car: [(String, String)] = [("person", "My profile"), ("calendar", "Availability"), ("cap", "Qualifications"), ("camera", "My photos"), ("doc", "Resume"), ("rate", "Rates and preferences"), ("shield", "Safety"), ("group", "CareSpace"), ("bell", "Notifications"), ("settings", "Settings"), ("loop", "Switch role")]
        let items: [(String, String)] = st.isFamily ? fam : car
        VStack(spacing: 0) {
            RdHeader(title: "Menu")
            RdScroll {
                ForEach(0..<items.count, id: \.self) { i in
                    RdNavRow(icon: items[i].0, title: items[i].1) { route(items[i].1) }
                }
            }
        }
    }
    func route(_ t: String) {
        switch t {
        case "Settings": st.go("settings")
        case "Safety and checks", "Safety": st.go("safety")
        case "Resume": st.go("resume")
        case "My photos": st.go("photoup")
        case "Switch role": st.root("role")
        case "My profile", "My family profile": st.go("profile")
        case "Rates and preferences": st.go("settingsmatch")
        default: break
        }
    }
}

struct RdSafety: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: "Safety and checks")
            RdScroll {
                RdLabel(title: "Your country")
                RdField(label: "Country", value: "Australia, Queensland")
                RdLabel(title: "What is needed here")
                RdCard { RdReason(text: "Needed for nannies, babysitters and au pairs in Queensland.", bold: "Blue Card") }
                RdCard { RdReason(text: "Needed by many families. Recommended.", bold: "First aid") }
                RdLabel(title: "Your checks")
                RdCard { RdReason(text: "Checked 14 Aug 2026", bold: "Blue Card") }
                RdCard { RdReason(text: "Uploaded, not yet checked", gap: true, bold: "First aid") }
                RdMuted(text: "Uploaded is not checked. Verified means a real check with a date.").padding(.horizontal, 24).padding(.top, 8)
            }
        }
    }
}

struct RdResume: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: "Resume")
            RdScroll {
                RdLabel(title: "Your resume")
                RdCard {
                    HStack(spacing: 12) {
                        RdIcon(name: "doc", size: 30)
                        VStack(alignment: .leading) { Text("Maya_Okafor_Resume.pdf").font(RdF.bold(16)).foregroundColor(RdC.ink); Text("212 KB. Added 20 Nov 2026").font(RdF.body(13)).foregroundColor(RdC.mut) }
                    }
                    RdMuted(text: "Uploaded, not checked. Only checks with a date get a Verified mark.")
                    HStack(spacing: 8) { RdCta(title: "Replace", icon: "plus", style: 1, small: true) { }; RdCta(title: "Preview", style: 1, small: true) { st.go("resumeview") } }
                }
                RdCard {
                    RdMuted(text: "Upload a resume PDF, Word or a photo. Up to 10 MB.")
                    RdCta(title: "Choose file", icon: "plus", small: true) { }
                }
                RdLabel(title: "No resume?")
                RdCard { RdCta(title: "Make one from my profile", icon: "sparkle", style: 1, small: true) { st.go("resumeview") } }
                RdLabel(title: "Who can see it")
                RdPick(items: ["Matches", "After yes", "On send"], sel: 1).padding(.horizontal, 20)
                RdMuted(text: "Families who match me, after I say yes to a family, or only when I send it.").padding(.horizontal, 24).padding(.top, 6)
            }
        }
    }
}

struct RdResumeView: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let car: RdCarer = RdData.carer(id: "maya")
        VStack(spacing: 0) {
            RdHeader(title: "Resume")
            RdScroll {
                RdLabel(title: "Maya Okafor", sub: "Nanny and babysitter · Ashgrove, Brisbane")
                RdSection(title: "Summary", text: car.headline)
                RdSection(title: "Experience")
                RdCard { RdReason(text: "2022 to now. Two children, ages 3 and 6. School runs, cooking, homework help.", bold: "Nanny, family in Ashgrove") }
                RdCard { RdReason(text: "2019 to 2022. Spanish spoken daily.", bold: "Nanny, family in Madrid") }
                RdSection(title: "Checks and certificates")
                RdCard { RdReason(text: "Checked 14 Aug 2026", bold: "Blue Card") }
                RdCard { RdReason(text: "Sighted 2 Mar 2026", bold: "First aid and CPR") }
            }
        }
    }
}

struct RdRevReq: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let safe: [String] = ["One link, one review. It works once.", "The reviewer must confirm their email with a 6 digit code.", "It must be the same email you asked. A different email is blocked.", "The link ends after 14 days.", "You cannot review yourself. Same device and email are blocked.", "You cannot edit or delete a review. You can reply."]
        VStack(spacing: 0) {
            RdHeader(title: "Ask for a review")
            RdScroll {
                RdMuted(text: "Ask a family you worked for. They get a secure link by email.").padding(.horizontal, 20)
                RdField(label: "Their name", value: "Sofia Reyes")
                RdField(label: "Their email", value: "sofia@example.com")
                RdCard(title: "How we keep reviews real", tint: RdC.pale) { ForEach(0..<safe.count, id: \.self) { RdReason(text: safe[$0]) } }
                RdNavRow(icon: "star", title: "Reviews from other apps") { st.go("revapps") }
            }
            RdBottomBar { RdCta(title: "Send the link", icon: "mail") { st.go("revsent") } }
        }
    }
}

struct RdRevSent: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: "Review requests")
            RdScroll {
                RdCard {
                    HStack(spacing: 12) { RdIcon(name: "mail", size: 26); VStack(alignment: .leading) { Text("Sofia Reyes").font(RdF.bold(16)).foregroundColor(RdC.ink); Text("Sent 21 Nov. Ends 5 Dec.").font(RdF.body(13)).foregroundColor(RdC.mut) }; Spacer(); RdTag(text: "Waiting", fill: RdC.warnBg, fg: RdC.warnFg) }
                    HStack(spacing: 8) { RdCta(title: "Send reminder", style: 1, small: true) { }; RdCta(title: "See what they see", style: 1, small: true) { st.go("revwrite") } }
                }
                RdLabel(title: "Your reviews")
                RdCard { RdMuted(text: "No reviews yet. Real reviews appear here after a booking or a verified link.") }
                RdCard(title: "How a review will show", tint: RdC.pale) {
                    RdMuted(text: "Reviewer name, a stars row and their words. Marked Email verified and Booked on Caresitters when it applies. This is a layout note, not a review.")
                }
            }
        }
    }
}

struct RdRevWrite: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        VStack(spacing: 0) {
            RdHeader(title: "Caresitters")
            RdScroll {
                RdBigTitle(text: "Maya asked for your review", sub: "Takes one minute.")
                RdCard(title: "Step 1. Confirm your email") {
                    RdMuted(text: "We sent a 6 digit code to s***@example.com")
                    HStack(spacing: 6) { ForEach(Array("123456".enumerated()), id: \.offset) { _, d in Text(String(d)).font(RdF.title(22)).frame(maxWidth: .infinity, minHeight: 48).background(RdC.field).clipShape(RoundedRectangle(cornerRadius: 12)) } }
                }
                RdCard(title: "Step 2. Your review") {
                    HStack(spacing: 6) { ForEach(0..<5, id: \.self) { _ in BrandIcon(kind: .star, size: 30, color: RdC.pink, solid: true) } }
                    RdFlow(spacing: 8) { ForEach(["On time", "Calm", "Great with children", "Good cook", "Would hire again"], id: \.self) { RdToggleChip(text: $0, on: $0 == "Calm") } }
                }
                RdField(label: "In your words", value: "Write a few words")
                RdField(label: "Your name", value: "Sofia R.")
            }
            RdBottomBar { RdCta(title: "Send my review") { st.back() } }
        }
    }
}

struct RdRevApps: View {
    @EnvironmentObject var st: RdStore
    var body: some View {
        let apps: [String] = ["Babysits", "Care.com", "Sittercity", "UrbanSitter", "Sittr"]
        VStack(spacing: 0) {
            RdHeader(title: "Reviews from other apps")
            RdScroll {
                RdMuted(text: "Bring your good name with you. Paste your profile link. To prove it is yours, add a short code to your bio on that app, then we read the rating.").padding(.horizontal, 20)
                ForEach(0..<apps.count, id: \.self) { i in
                    RdCard {
                        HStack { Text(apps[i]).font(RdF.bold(17)).foregroundColor(RdC.ink); Spacer(); RdTag(text: i == 0 ? "Waiting for code" : "Not linked", fill: i == 0 ? RdC.warnBg : RdC.field, fg: i == 0 ? RdC.warnFg : RdC.mut) }
                        if i == 0 {
                            RdField(label: "Your profile link", value: "babysits.com/...")
                            RdMuted(text: "Code for your bio: CS 4821 7730")
                        } else {
                            RdCta(title: "Link profile", style: 1, small: true) { }
                        }
                    }
                }
                RdMuted(text: "Reviews from other apps show separately and are marked with the app name.").padding(.horizontal, 24).padding(.top, 8)
            }
        }
    }
}
