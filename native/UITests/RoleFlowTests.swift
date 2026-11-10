import XCTest

/// Real taps through the real app: sign up as each role, check each role gets its own tabs, then delete the account.
final class RoleFlowTests: XCTestCase {
    let app = XCUIApplication()
    override func setUp() { continueAfterFailure = false }

    func shot(_ name: String) {
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
        let d = "/Users/ilseplacencia/Apps/nativeproj/pics/shots"; try? FileManager.default.createDirectory(atPath: d, withIntermediateDirectories: true); try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "\(d)/\(name).png"))
    }
    func tap(_ label: String, timeout: TimeInterval = 15) {
        var b = app.buttons[label].firstMatch
        if !b.waitForExistence(timeout: 3) { b = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", label)).firstMatch }
        if !b.waitForExistence(timeout: timeout) { shot("MISSING-\(label)"); XCTFail("button \(label) missing. Screen: " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | ") + " || Buttons: " + app.buttons.allElementsBoundByIndex.map { $0.label }.joined(separator: " | ")); return }
        sleep(1); b.tap()
    }
    func type(_ field: XCUIElement, _ text: String) { if !field.waitForExistence(timeout: 30) { XCTFail("field missing: " + String(app.debugDescription.prefix(1500))); return }; field.tap(); sleep(1); if !(field.value(forKey: "hasKeyboardFocus") as? Bool ?? true) { field.tap(); sleep(1) }; field.typeText(text) }


    func signUp(side: String) {
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        // Leftover signed-in test user from an earlier run: sign out first.
        if app.tabBars.buttons["Me"].waitForExistence(timeout: 5) {
            app.tabBars.buttons["Me"].tap()
            let so = app.buttons["Sign out"]
            for _ in 0..<6 where !so.isHittable { app.swipeUp() }
            so.tap(); sleep(2)
        }
        // A previous interrupted run can leave a signed-in test user at the profile step: carry on with it, then it is deleted at the end.
        if app.textFields["Your name"].waitForExistence(timeout: 6) || app.buttons["Next"].exists { return }
        if app.buttons["I need care"].waitForExistence(timeout: 2) && !app.buttons["Use email"].exists { tap(side == "family" ? "I need care" : "I give care"); return }
        tap("Use email")
        let email = "projects.reports.ilse+nat\(side)\(Int(Date().timeIntervalSince1970))@gmail.com"
        type(app.textFields["Email"], email)
        type(app.secureTextFields["Password (6+ letters)"], "Nat-\(Int(Date().timeIntervalSince1970))-Zq9")
        shot("welcome-\(side)")
        tap("Create my account")
        let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for _ in 0..<8 { if sb.buttons["Not Now"].waitForExistence(timeout: 2) { sb.buttons["Not Now"].tap(); break }; if app.buttons["Not Now"].exists { app.buttons["Not Now"].tap(); break } }
        tap(side == "family" ? "I need care" : "I give care", timeout: 30)
        let nameField = app.textFields["Your name"]
        if !nameField.waitForExistence(timeout: 12) {
            let again = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", side == "family" ? "I need care" : "I give care")).firstMatch
            if again.exists { again.tap() }
        }
        if !nameField.waitForExistence(timeout: 25) { shot("after-create-\(side)"); XCTFail("sign up did not reach onboarding: " + String(app.debugDescription.prefix(1800))) }
    }
    func dismissKb() { let t = app.staticTexts["onbTitle"]; if t.exists { t.tap() } }
    func next() { let t = app.staticTexts["onbTitle"]; let before = t.exists ? t.label : ""; tap("Next"); sleep(2); if t.exists && t.label == before { tap("Next"); sleep(2) } }
    func fillYou(_ name: String) {
        type(app.textFields["Your name"], name)
        type(app.textFields["Postcode"], "4005"); dismissKb()
        type(app.textFields["Suburb"], "New Farm")
        dismissKb()
    }
    func finishAndCheck(tabs: [String], role: String) {
        tap("Finish", timeout: 20)
        for t in tabs { XCTAssertTrue(app.tabBars.buttons[t].waitForExistence(timeout: 30), "\(role): tab \(t) missing") }
        shot("home-\(role)")
        for t in tabs { app.tabBars.buttons[t].tap(); sleep(2); shot("\(role)-\(t)") }
        // Me tab: delete account (cleans up the live test user)
        app.tabBars.buttons["Me"].tap()
        let del = app.buttons["Delete my account"]
        for _ in 0..<6 where !del.isHittable { app.swipeUp() }
        del.tap()
        tap("Delete everything")
        let out = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 75)
        if !out { shot("FAIL-delete-\(role)") }
        XCTAssertTrue(out, "\(role): not signed out after delete " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | "))
    }

    func testSwipeDeck() {
        signUp(side: "family"); fillYou("Test Swipe"); next(); next(); type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        let card = app.descendants(matching: .any)["topCard"].firstMatch
        if !card.waitForExistence(timeout: 75) { XCTFail("deck: no card. Texts: " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | ") + " || Buttons: " + app.buttons.allElementsBoundByIndex.map { $0.label }.joined(separator: " | ")); return }
        shot("deck-before")
        card.swipeRight(); sleep(2); shot("deck-after-like")
        app.buttons["Pass"].tap(); sleep(2); shot("deck-after-skip")
        app.buttons["Matches"].tap(); sleep(2); shot("deck-saved")
        app.tabBars.buttons["Me"].tap()
        let del = app.buttons["Delete my account"]
        for _ in 0..<6 where !del.isHittable { app.swipeUp() }
        del.tap(); tap("Delete everything")
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 120))
    }
    func pic(_ name: String) {
        sleep(2)
        let d = "/Users/ilseplacencia/Apps/nativeproj/pics"
        try? FileManager.default.createDirectory(atPath: d, withIntermediateDirectories: true)
        try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "\(d)/\(name).png"))
    }
    /// Pictures only: walks the app and saves still pictures. No assertions about behaviour.
    func testPictures() {
        app.launchArguments += ["-AppleLanguages", "(en)"]; app.launch()
        if app.tabBars.buttons["Me"].waitForExistence(timeout: 5) {
            app.tabBars.buttons["Me"].tap(); let so = app.buttons["Sign out"]
            for _ in 0..<6 where !so.isHittable { app.swipeUp() }
            so.tap(); sleep(2)
        }
        if !app.buttons["I need care"].waitForExistence(timeout: 4) {
            pic("01-sign-up-first")
            tap("Use email")
            type(app.textFields["Email"], "projects.reports.ilse+natpics\(Int(Date().timeIntervalSince1970))@gmail.com")
            type(app.secureTextFields["Password (6+ letters)"], "Nat-\(Int(Date().timeIntervalSince1970))-Zq9")
            tap("Create my account")
            let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
            for _ in 0..<8 { if sb.buttons["Not Now"].waitForExistence(timeout: 2) { sb.buttons["Not Now"].tap(); break }; if app.buttons["Not Now"].exists { app.buttons["Not Now"].tap(); break } }
            _ = app.buttons["I need care"].waitForExistence(timeout: 30); sleep(2)
        }
        pic("02-i-need-care-or-i-give-care")
        tap("I need care")
        fillYou("Harper Family"); next(); next()
        type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        _ = app.descendants(matching: .any)["topCard"].firstMatch.waitForExistence(timeout: 75)
        sleep(4); pic("03-home-swipe-deck")
        app.buttons["Details"].tap(); sleep(3); pic("04-profile")
        if app.navigationBars.buttons.firstMatch.exists { app.navigationBars.buttons.firstMatch.tap() } else { app.swipeRight() }; sleep(1)
        app.tabBars.buttons["Calendar"].tap(); pic("05-calendar")
        app.tabBars.buttons["Messages"].tap(); pic("06-messages")
        app.tabBars.buttons["Me"].tap(); pic("07-menu-me")
        let del = app.buttons["Delete my account"]
        for _ in 0..<6 where !del.isHittable { app.swipeUp() }
        del.tap(); tap("Delete everything"); sleep(3)
    }
    func testFamilyApp() {
        signUp(side: "family"); fillYou("Test Family"); next()
        // care: nanny preselected, add babysitter
        tap("Babysitter"); next()
        type(app.textFields["Name or nickname"], "Mia"); dismissKb(); sleep(1); next()
        if !app.buttons["Finish"].waitForExistence(timeout: 6) { next() }
        finishAndCheck(tabs: ["Find care", "Calendar", "Messages", "Me"], role: "family")
    }
    func carer(_ kind: String, tabs: [String]) {
        signUp(side: "carer"); fillYou("Test " + kind); next()
        tap(kind); shot("kind-chosen-\(kind)"); next(); shot("after-kind-next-\(kind)")
        tap("Skip")
        type(app.textFields["A few words about your care"], "Kind and calm care"); dismissKb(); next()
        finishAndCheck(tabs: tabs, role: kind)
    }
    func testNannyApp() { carer("Nanny", tabs: ["Families", "Requests", "Calendar", "Chat", "Me"]) }
    func testBabysitterApp() { carer("Babysitter", tabs: ["Jobs", "Requests", "Calendar", "Families", "Me"]) }
    func testAuPairApp() { carer("Au pair", tabs: ["Host families", "My week", "Requests", "Chat", "Me"]) }

    func testSkipFamilyAndLabels() {
        signUp(side: "family")
        for l in ["Your name", "Postcode", "Suburb"] { XCTAssertTrue(app.staticTexts[l].waitForExistence(timeout: 10), "visible label missing: \(l)") }
        shot("b176-labels-you-step")
        tap("Skip for now")
        let link = app.buttons["finishFamilyLinkOnboarding"]
        XCTAssertTrue(link.waitForExistence(timeout: 10), "skip notice link missing")
        shot("b176-skip-notice")
        link.tap()
        XCTAssertTrue(app.staticTexts["My family"].waitForExistence(timeout: 10), "link did not open My family"); shot("b176-link-opens-family")
        tap("Done")
        next(); next(); sleep(1)
        tap("Finish", timeout: 20)
        let home = app.buttons["finishFamilyLink"]
        XCTAssertTrue(home.waitForExistence(timeout: 90), "home banner link missing")
        shot("b176-home-banner")
        home.tap()
        XCTAssertTrue(app.staticTexts["familyEditorTitle"].waitForExistence(timeout: 15), "Me > My family did not open"); shot("b176-me-my-family")
        type(app.textFields["Your name"], "Skip Test"); dismissKbAny()
        type(app.textFields["Postcode"], "4005"); dismissKbAny()
        tap("Save"); sleep(3)
        XCTAssertFalse(app.buttons["finishFamilyLink"].exists, "banner should be gone after finishing")
        app.tabBars.buttons["Me"].tap()
        let del = app.buttons["Delete my account"]
        for _ in 0..<6 where !del.isHittable { app.swipeUp() }
        del.tap(); tap("Delete everything")
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 75))
    }
    func dismissKbAny() { let t = app.staticTexts["familyEditorTitle"]; if t.exists { t.tap() } else { dismissKb() } }
    func testPhotoProof() {
        app.launchEnvironment["CS_PHOTOPROOF"] = "1"
        signUp(side: "family"); fillYou("Photo Proof"); next(); next(); type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 90))
        app.tabBars.buttons["Me"].tap()
        let p = app.staticTexts["photoProof"]
        _ = p.waitForExistence(timeout: 30)
        for _ in 0..<60 where !(p.exists && p.label.contains("PROOF")) { sleep(2) }
        let rep = p.exists ? p.label : "no report"
        try? rep.write(toFile: "/Users/ilseplacencia/Apps/nativeproj/pics/photo-proof-ui.txt", atomically: true, encoding: .utf8)
        sleep(3); shot("b176-photo-proof-me")
        XCTAssertTrue(rep.contains("PROOF OK"), rep)
        let del = app.buttons["Delete my account"]
        for _ in 0..<8 where !del.isHittable { app.swipeUp() }
        del.tap(); tap("Delete everything")
    }
    func testIconGallery() {
        app.launchEnvironment["CS_ICONS"] = "1"; app.launch(); sleep(3); shot("b176-icon-gallery")
        app.swipeUp(); sleep(1); shot("b176-icon-gallery-2")
    }
    func testBunnyReacts() {
        app.launchEnvironment["CS_ICONS"] = "1"; app.launch(); sleep(2)
        shot("b176-bunny-a"); sleep(2); shot("b176-bunny-b")
    }
    func testChatPhoto() {
        addTeardownBlock { [self] in cleanupProof() }
        app.launchEnvironment["CS_CHATPROOF"] = "1"; app.launchArguments += ["-AppleLanguages", "(en)"]; app.launch()
        let msgs = app.tabBars.buttons["Messages"]
        XCTAssertTrue(msgs.waitForExistence(timeout: 240), "chat proof setup did not finish: " + ((try? String(contentsOfFile: "/Users/ilseplacencia/Apps/nativeproj/pics/chat-proof.txt")) ?? app.staticTexts["chatProof"].label))
        let rep = (try? String(contentsOfFile: "/Users/ilseplacencia/Apps/nativeproj/pics/chat-proof.txt")) ?? "no report"
        XCTAssertTrue(rep.contains("CHAT PROOF OK"), rep)
        msgs.tap(); sleep(2); shot("b177-chat-list")
        let row = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Proof")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 20)); row.tap()
        let ph = app.descendants(matching: .any)["chatPhoto"].firstMatch
        XCTAssertTrue(ph.waitForExistence(timeout: 30), "photo not in thread"); sleep(4); shot("b177-chat-photo-1")
        app.navigationBars.buttons.firstMatch.tap(); sleep(2)
        row.tap()
        XCTAssertTrue(ph.waitForExistence(timeout: 30), "photo not in thread after return"); sleep(4); shot("b177-chat-photo-2-after-return")
        app.navigationBars.buttons.firstMatch.tap(); sleep(1)
        app.buttons["proofCleanup"].tap(); sleep(12)
    }
    func win(_ x: Double, _ y: Double) -> XCUICoordinate { app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: x, dy: y)) }
    func dragCard(left: Bool) { win(left ? 0.8 : 0.2, 0.4).press(forDuration: 0.1, thenDragTo: win(left ? 0.1 : 0.9, 0.42)) }
    func proofName() -> String { let r = (try? String(contentsOfFile: "/Users/ilseplacencia/Apps/nativeproj/pics/chat-proof.txt")) ?? ""; return r.split(separator: "\n").first(where: { $0.hasPrefix("carer name: ") }).map { String($0.dropFirst(12)) } ?? "Proof" }
    /// Old test pairs may still sit in the live pool. Pass cards until this run's own person is on top.
    func topIs(_ name: String) { for _ in 0..<10 where !(app.staticTexts[name].exists && app.staticTexts[name].isHittable) { dragCard(left: true); sleep(2) } }
    func tapTop(_ label: String) {
        let b = app.buttons.matching(NSPredicate(format: "label == %@", label)).allElementsBoundByIndex.last
        XCTAssertNotNil(b, "no tappable \(label)"); b?.tap()
    }
    func testDeckFamily() {
        addTeardownBlock { [self] in cleanupProof() }
        app.launchEnvironment["CS_CHATPROOF"] = "1"; app.launchArguments += ["-AppleLanguages", "(en)"]; app.launch()
        let card = app.descendants(matching: .any)["topCard"].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 240), "no deck card: " + ((try? String(contentsOfFile: "/Users/ilseplacencia/Apps/nativeproj/pics/chat-proof.txt")) ?? ""))
        XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@ OR identifier == %@", "%", "matchPercent")).firstMatch.waitForExistence(timeout: 20), "no match percent on card")
        topIs(proofName()); sleep(3); shot("b177-deck-1-card-percent-distance")
        win(0.8, 0.3).tap(); sleep(1); shot("b177-deck-2-description-slide")
        win(0.2, 0.3).tap(); sleep(1)
        dragCard(left: false); sleep(2)
        XCTAssertTrue(app.descendants(matching: .any)["matchBanner"].firstMatch.waitForExistence(timeout: 10), "no match banner"); shot("b177-deck-4-right-match")
        let bm = app.buttons.matching(NSPredicate(format: "label == %@", "Message")).allElementsBoundByIndex.first; XCTAssertNotNil(bm, "no banner Message"); bm?.tap(); sleep(4)
        let chat = app.textFields["Message"].waitForExistence(timeout: 20); shot("b177-deck-5-message-opens-chat")
        XCTAssertTrue(chat, "Message did not open a chat. Texts: " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | "))
        tap("Close"); sleep(1)
        dragCard(left: true); sleep(2); shot("b177-deck-3-left-pass")
        tap("Map"); sleep(6); shot("b177-deck-6-map")
        cleanupProof()
    }
    func testDeckCarer() {
        addTeardownBlock { [self] in cleanupProof() }
        app.launchEnvironment["CS_CHATPROOF"] = "1"; app.launchEnvironment["CS_CHATPROOF_END"] = "carer"; app.launchArguments += ["-AppleLanguages", "(en)"]; app.launch()
        XCTAssertTrue(app.tabBars.buttons["Families"].waitForExistence(timeout: 240), "carer app did not open"); app.tabBars.buttons["Families"].tap()
        let card = app.descendants(matching: .any)["topCard"].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 90), "no deck card for carer")
        sleep(3); shot("b177-deck-7-carer-card")
        tapTop("Send resume"); sleep(3); shot("b177-deck-8-send-resume-sheet")
        let offered = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Send your resume to")).firstMatch.waitForExistence(timeout: 30)
        shot("b178-deck-8b-sheet-offers-send"); XCTAssertTrue(offered, "sheet never offered Send. Texts: " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | "))
        let go = app.buttons.matching(NSPredicate(format: "label == %@", "Send resume")).allElementsBoundByIndex.first(where: { $0.isHittable })
        XCTAssertNotNil(go, "no tappable Send in the sheet"); go?.tap()
        XCTAssertTrue(app.staticTexts["Sent"].waitForExistence(timeout: 20), "resume not sent"); sleep(1); shot("b177-deck-9-resume-sent")
        tap("Close"); sleep(1)
        cleanupProof()
    }
    func cleanupProof() { if app.buttons["proofCleanup"].exists { app.buttons["proofCleanup"].tap(); sleep(14) } }
    func deleteFlow(_ name: String) {
        signUp(side: "family"); fillYou(name); next(); next(); type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 90))
        app.tabBars.buttons["Me"].tap()
        let del = app.buttons["Delete my account"]
        for _ in 0..<6 where !del.isHittable { app.swipeUp() }
        del.tap(); tap("Delete everything")
    }
    func testDeleteSlow() {
        app.launchEnvironment["CS_DELETE_DELAY"] = "30"
        deleteFlow("Slow Delete")
        XCTAssertTrue(app.descendants(matching: .any)["deleteBusy"].firstMatch.waitForExistence(timeout: 15), "no busy state"); sleep(2); shot("b177-delete-1-busy")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "taking longer")).firstMatch.waitForExistence(timeout: 20), "no slow line"); shot("b177-delete-2-slow-line")
        let out = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 90)
        shot("b177-delete-3-lands-on-sign-in"); XCTAssertTrue(out, "slow delete did not land on the sign in door")
    }
    func testDeleteTimeout() {
        app.launchEnvironment["CS_DELETE_DELAY"] = "40"; app.launchEnvironment["CS_DELETE_TIMEOUT"] = "14"
        deleteFlow("Timeout Delete")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Still not done")).firstMatch.waitForExistence(timeout: 40), "no timeout line"); sleep(1); shot("b177-delete-4-timeout-line")
        app.terminate(); app.launchEnvironment["CS_DELETE_DELAY"] = "0"; app.launchEnvironment["CS_DELETE_TIMEOUT"] = "60"; app.launch()
        app.tabBars.buttons["Me"].tap()
        let del = app.buttons["Delete my account"]
        for _ in 0..<6 where !del.isHittable { app.swipeUp() }
        del.tap(); tap("Delete everything")
        let out = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 90)
        shot("b177-delete-5-normal-lands-on-sign-in"); XCTAssertTrue(out, "normal delete did not land on the sign in door")
    }
}
