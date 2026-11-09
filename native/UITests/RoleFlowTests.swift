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
    func type(_ field: XCUIElement, _ text: String) { if !field.waitForExistence(timeout: 30) { XCTFail("field missing: " + String(app.debugDescription.prefix(1500))); return }; field.tap(); sleep(1); field.typeText(text) }


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
        if app.textFields["Your name"].waitForExistence(timeout: 6) || app.buttons["Next ➜"].exists { return }
        if app.buttons["I need care"].waitForExistence(timeout: 2) && !app.buttons["✉️  Use email"].exists { tap(side == "family" ? "I need care" : "I give care"); return }
        tap("✉️  Use email")
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
    func next() { let t = app.staticTexts["onbTitle"]; let before = t.exists ? t.label : ""; tap("Next ➜"); sleep(2); if t.exists && t.label == before { tap("Next ➜"); sleep(2) } }
    func fillYou(_ name: String) {
        type(app.textFields["Your name"], name)
        type(app.textFields["Postcode"], "4005"); dismissKb()
        type(app.textFields["Suburb"], "New Farm")
        dismissKb()
    }
    func finishAndCheck(tabs: [String], role: String) {
        tap("🎉 Finish", timeout: 20)
        for t in tabs { XCTAssertTrue(app.tabBars.buttons[t].waitForExistence(timeout: 30), "\(role): tab \(t) missing") }
        shot("home-\(role)")
        for t in tabs { app.tabBars.buttons[t].tap(); sleep(2); shot("\(role)-\(t)") }
        // Me tab: delete account (cleans up the live test user)
        app.tabBars.buttons["Me"].tap()
        let del = app.buttons["Delete my account"]
        for _ in 0..<6 where !del.isHittable { app.swipeUp() }
        del.tap()
        tap("Delete everything")
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 30), "\(role): not signed out after delete")
    }

    func testSwipeDeck() {
        signUp(side: "family"); fillYou("Test Swipe"); next(); next(); type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("🎉 Finish", timeout: 20)
        let card = app.descendants(matching: .any)["topCard"].firstMatch
        if !card.waitForExistence(timeout: 75) { XCTFail("deck: no card. Texts: " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | ") + " || Buttons: " + app.buttons.allElementsBoundByIndex.map { $0.label }.joined(separator: " | ")); return }
        shot("deck-before")
        card.swipeRight(); sleep(2); shot("deck-after-like")
        app.buttons["Skip"].tap(); sleep(2); shot("deck-after-skip")
        app.buttons["Saved"].tap(); sleep(2); shot("deck-saved")
        app.tabBars.buttons["Me"].tap()
        let del = app.buttons["Delete my account"]
        for _ in 0..<6 where !del.isHittable { app.swipeUp() }
        del.tap(); tap("Delete everything")
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 30))
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
            tap("✉️  Use email")
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
        tap("🎉 Finish", timeout: 20)
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
        if !app.buttons["🎉 Finish"].waitForExistence(timeout: 6) { next() }
        finishAndCheck(tabs: ["Find care", "Calendar", "Messages", "Me"], role: "family")
    }
    func carer(_ kind: String, tabs: [String]) {
        signUp(side: "carer"); fillYou("Test " + kind); next()
        tap(kind); shot("kind-chosen-\(kind)"); next(); shot("after-kind-next-\(kind)")
        tap("⏭️ Skip")
        type(app.textFields["A few words about your care"], "Kind and calm care"); dismissKb(); next()
        finishAndCheck(tabs: tabs, role: kind)
    }
    func testNannyApp() { carer("Nanny", tabs: ["Today", "Requests", "Calendar", "Families", "Me"]) }
    func testBabysitterApp() { carer("Babysitter", tabs: ["Jobs", "Requests", "Calendar", "Families", "Me"]) }
    func testAuPairApp() { carer("Au pair", tabs: ["Host families", "My week", "Requests", "Chat", "Me"]) }
}
