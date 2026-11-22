import SwiftUI

/// The root of the redesign. Holds the router, the edge swipe back, and the tab bar.
struct RdRoot: View {
    @StateObject private var st = RdStore()
    private let tabScreens: Set<String> = ["famhome", "carhome", "deck", "map", "worldmap", "list", "bookings", "inbox", "urgent", "urgentmine"]
    private let noSwipe: Set<String> = ["deck", "splash", "famhome", "carhome", "bookings", "inbox", "map", "worldmap", "list", "urgent", "urgentmine"]

    var body: some View {
        VStack(spacing: 0) {
            screen(st.current).frame(maxWidth: .infinity, maxHeight: .infinity).background(Color.white)
            if tabScreens.contains(st.current) && st.current != "deck" { RdTabs() }
        }
        .background(Color.white.ignoresSafeArea())
        .environmentObject(st)
        .tint(RdC.pink)
        .preferredColorScheme(.light)
        .gesture(DragGesture(minimumDistance: 24).onEnded { v in
            if v.startLocation.x < 28 && v.translation.width > 80 && !noSwipe.contains(st.current) { st.back() }
        })
        .onAppear { launchArgs(); RdLive.restore(st) }
    }

    func launchArgs() {
        let a = ProcessInfo.processInfo.arguments
        guard let i = a.firstIndex(of: "-rdview"), i + 1 < a.count else { return }
        let v = a[i + 1]
        st.viewKey = v
        st.isFamily = (RdCtx.views[v]?.asFamily ?? true)
        st.pickedCare = (v == "v2") ? "babysitter" : ((v == "v3" || v == "v5") ? "aupair" : "nanny")
        st.setupRole = st.isFamily ? "family" : st.pickedCare
        if let j = a.firstIndex(of: "-rdscreen"), j + 1 < a.count {
            let s = a[j + 1]
            st.stack = [st.isFamily ? "famhome" : "carhome"]
            if s != "home" { st.stack = [s] }
        }
    }

    @ViewBuilder func screen(_ id: String) -> some View {
        switch id {
        case "splash": RdSplash()
        case "role": RdRole()
        case "door": RdDoor()
        case "email": RdEmail()
        case "caretype": RdCareType()
        case "sw": RdSetupWho()
        case "sa": RdSetupAbout()
        case "ss": RdSetupStyle()
        case "sk": RdSetupSkills()
        case "sd": RdSetupDesc()
        case "sm": RdSetupWhen()
        case "photoup": RdPhotoUp()
        case "finding": RdFinding()
        case "famhome": RdFamHome()
        case "carhome": RdCarHome()
        case "deck": if RdLive.signedIn { RdLiveDeck() } else { RdDeck() }
        case "profile": RdProfile()
        case "photos": RdPhotosView()
        case "why": RdWhy()
        case "book": RdBook()
        case "trial": RdTrial()
        case "trialdone": RdTrialDone()
        case "sent": RdSent()
        case "confirmed": RdConfirmed()
        case "chat": if st.chatRel.isEmpty { RdChat() } else { RdLiveChat() }
        case "list": RdList()
        case "filters": RdFilters()
        case "map": if st.ctx().au && st.ctx().fm { RdWorldMap() } else { RdMap() }
        case "worldmap": RdWorldMap()
        case "bookings": RdBookings()
        case "inbox": if RdLive.signedIn { RdLiveInbox() } else { RdInbox() }
        case "me": RdMe()
        case "settings": RdSettings()
        case "settingsmatch": RdSettingsMatch()
        case "menu": RdMenu()
        case "safety": RdSafety()
        case "resume": RdResume()
        case "resumeview": RdResumeView()
        case "revreq": RdRevReq()
        case "revsent": RdRevSent()
        case "revwrite": RdRevWrite()
        case "revapps": RdRevApps()
        case "urgent": RdUrgent()
        case "urgentdetail": RdUrgentDetail()
        case "urgentapply": RdUrgentApply()
        case "urgentsent": RdUrgentSent()
        case "urgentpost": RdUrgentPost()
        case "urgentposted": RdUrgentPosted()
        case "urgentmine": RdUrgentMine()
        case "urgentbooked": RdUrgentBooked()
        case "visacheck": RdVisaCheck()
        default: RdSplash()
        }
    }
}
