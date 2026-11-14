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


    var testPw = ""; var testEmail = ""
    func signUp(side: String) {
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        // Leftover signed-in test user from an earlier run: sign out first.
        // The tab bar can lag under a busy Mac: a short wait misses a signed-in session and the run then taps the door on the deck.
        if app.tabBars.buttons["Me"].waitForExistence(timeout: 30) { signOutFromMe() }
        // A previous interrupted run can leave a signed-in test user at the profile step: carry on with it, then it is deleted at the end.
        if app.textFields["Your name"].waitForExistence(timeout: 6) || app.buttons["Next"].exists { return }
        if app.buttons["I need care"].waitForExistence(timeout: 2) && !app.buttons["Use email"].exists { tap(side == "family" ? "I need care" : "I give care"); return }
        tap("Use email")
        let email = "projects.reports.ilse+nat\(side)\(Int(Date().timeIntervalSince1970))@gmail.com"
        type(app.textFields["Email"], email)
        testPw = "Nat-\(Int(Date().timeIntervalSince1970))-Zq9"; testEmail = email
        try? (email + "\n").appendLine(to: "/Users/ilseplacencia/cs181/test-accounts-made.txt")
        type(app.secureTextFields["Password (6+ letters)"], testPw)
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
    /// Sign out and delete live inside Settings now (item 1, her 22:13 shape: the settings row on Me is the entry).
    func openSettings() {
        if app.descendants(matching: .any)["settingsScreen"].firstMatch.exists { return }
        let st = app.descendants(matching: .any)["openSettings"].firstMatch
        XCTAssertTrue(reveal(st, max: 10), "settings row missing on Me")
        st.tap(); sleep(1)
        XCTAssertTrue(app.descendants(matching: .any)["settingsScreen"].firstMatch.waitForExistence(timeout: 10), "Settings did not open")
    }
    func signOutFromMe() {
        app.tabBars.buttons["Me"].tap()
        openSettings()
        let so = app.buttons["Sign out"]
        XCTAssertTrue(reveal(so, max: 10), "sign out button missing in Settings")
        so.tap(); sleep(2)
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 30), "sign out did not return to the door")
    }
    /// The tab pick rides the session object: after a sign out and a fresh sign in inside one launch,
    /// the app can reopen on Me. Go to the first tab first, then open the urgent board.
    func tapUrgent() {
        // The tab bar can lag the Finish tap: wait for the first tab before touching it.
        // A blind count check skips the tap silently and the Urgent tap then fails on Me.
        XCTAssertTrue(app.tabBars.buttons.element(boundBy: 0).waitForExistence(timeout: 15), "first tab missing before Urgent")
        app.tabBars.buttons.element(boundBy: 0).tap(); sleep(2)
        tap("Urgent")
    }
    func deleteFromSettings() {
        openSettings()
        let del = app.buttons["Delete my account"]
        XCTAssertTrue(reveal(del, max: 10), "delete button missing in Settings")
        del.tap(); tap("Delete everything")
    }
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
        deleteFromSettings()
        let out = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 75)
        if !out { shot("FAIL-delete-\(role)") }
        XCTAssertTrue(out, "\(role): not signed out after delete " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | "))
    }

    func testSwipeDeck() {
        signUp(side: "family"); fillYou("Test Swipe"); next(); next(); type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        if app.tabBars.buttons.element(boundBy: 0).waitForExistence(timeout: 15) { app.tabBars.buttons.element(boundBy: 0).tap(); sleep(2) }
        let card = app.descendants(matching: .any)["topCard"].firstMatch
        if !card.waitForExistence(timeout: 75) { XCTFail("deck: no card. Texts: " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | ") + " || Buttons: " + app.buttons.allElementsBoundByIndex.map { $0.label }.joined(separator: " | ")); return }
        shot("deck-before")
        card.swipeRight(); sleep(2); shot("deck-after-like")
        app.buttons["Pass"].tap(); sleep(2); shot("deck-after-skip")
        app.buttons["Matches"].tap(); sleep(2); shot("deck-saved")
        app.tabBars.buttons["Me"].tap()
        deleteFromSettings()
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
            signOutFromMe()
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
        deleteFromSettings(); sleep(3)
    }
    func testFamilyApp() {
        signUp(side: "family"); fillYou("Test Family"); next()
        // care: nanny preselected, add babysitter
        tap("Babysitter"); next()
        type(app.textFields["Name or nickname"], "Mia"); dismissKb(); sleep(1); next()
        if !app.buttons["Finish"].waitForExistence(timeout: 6) { next() }
        finishAndCheck(tabs: ["Find care", "Calendar", "Messages", "Me"], role: "family")
    }
    /// Door law: the first page has only Apple, Google and one small email button. Email is on its own page.
    func testDoorPages() {
        app.launchArguments += ["-AppleLanguages", "(en)"]; app.launch()
        if app.tabBars.buttons["Me"].waitForExistence(timeout: 5) { return }
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 60), "no door"); shot("b179-door-1")
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Google")).firstMatch.exists, "no Google")
        XCTAssertFalse(app.textFields["Email"].exists, "email field must not be on the first page")
        XCTAssertFalse(app.staticTexts["Care, close to home"].exists, "spare text still there")
        app.buttons["Use email"].tap()
        XCTAssertTrue(app.textFields["Email"].waitForExistence(timeout: 10), "no email page"); shot("b179-door-2-email")
        XCTAssertTrue(app.buttons["Create my account"].exists); XCTAssertTrue(app.buttons["I already have an account"].exists)
        // swipe from the left edge goes back to the door
        let s = app.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.5)), e = app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5))
        s.press(forDuration: 0.1, thenDragTo: e)
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 10), "back swipe did not return to the door")
    }
    /// A fresh account: the typed name shows in Me (never "Member"), the theme pick works and sticks, pay screens stay hidden.
    func testFreshNameThemePay() {
        signUp(side: "family"); fillYou("Zelda Proofname"); next()
        tap("Babysitter"); next()
        type(app.textFields["Name or nickname"], "Mia"); dismissKb(); sleep(1); next()
        if !app.buttons["Finish"].waitForExistence(timeout: 6) { next() }
        tap("Finish", timeout: 20)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 30)); app.tabBars.buttons["Me"].tap(); sleep(2)
        XCTAssertTrue(app.staticTexts["Zelda Proofname"].waitForExistence(timeout: 10), "typed name not shown in Me"); shot("b179-me-light")
        XCTAssertFalse(app.staticTexts["Member"].exists, "Member placeholder leaked")
        XCTAssertFalse(app.buttons["Set up payments"].exists, "pay screens must be hidden when not live")
        openSettings()
        for p in ["dark", "beige", "brand", "light"] {
            openSettings()
            let b = app.buttons["theme-\(p)"]; for _ in 0..<4 where !b.exists { app.swipeUp() }
            if !b.exists { XCTFail("no theme button \(p)"); break }
            b.tap(); sleep(2); app.tabBars.buttons["Me"].tap(); shot("b179-me-\(p)")
            XCTAssertTrue(app.tabBars.buttons["Me"].exists, "tabs lost after theme \(p)")
        }
        deleteFromSettings()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 120), "not signed out after delete")
    }
    func carer(_ kind: String, tabs: [String]) {
        signUp(side: "carer"); fillYou("Test " + kind); next()
        tap(kind); shot("kind-chosen-\(kind)"); next(); shot("after-kind-next-\(kind)")
        tap("Skip")
        type(app.textFields["A few words about your care"], "Kind and calm care"); dismissKb(); next()
        finishAndCheck(tabs: tabs, role: kind)
    }
    // MARK: Build 181 item 2 asking proof (pictured, both sides)
    func qshot(_ name: String) {
        sleep(2)
        let d = "/Users/ilseplacencia/cs181/pics"; try? FileManager.default.createDirectory(atPath: d, withIntermediateDirectories: true)
        try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "\(d)/\(name).png"))
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }
    func reveal(_ el: XCUIElement, max: Int = 40) -> Bool {
        for _ in 0..<max { if (el.exists || el.waitForExistence(timeout: 2)) && el.isHittable { return true }; app.swipeUp(velocity: .slow) }
        return false
    }
    func openAsking() {
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 60)); app.tabBars.buttons["Me"].tap(); sleep(2)
        let b = app.buttons["openAsking"]; XCTAssertTrue(reveal(b, max: 8), "no asking row in Me"); b.tap()
        XCTAssertTrue(app.staticTexts["askingTitle"].waitForExistence(timeout: 30), "asking did not open")
    }
    func asking(side: String) {
        if side == "family" {
            signUp(side: "family"); fillYou("Test QFam"); next(); tap("Babysitter"); next()
            type(app.textFields["Name or nickname"], "Mia"); dismissKb(); sleep(1); next()
            if !app.buttons["Finish"].waitForExistence(timeout: 6) { next() }
        } else {
            signUp(side: "carer"); fillYou("Test QCarer"); next(); tap("Nanny"); next(); tap("Skip")
            type(app.textFields["A few words about your care"], "Kind and calm care"); dismissKb(); next()
        }
        tap("Finish", timeout: 20)
        openAsking()
        qshot("ask-\(side)-0-top")
        let pets = side == "family" ? "Pets at home" : "Fine with pets"
        let ticks = ["Dancing", pets, "Languages", "Calm", "Driving licence", "First aid", "CPR", "Own room", "Pocket money"]
        for t in ticks {
            let c = app.buttons["tick-\(t)"].firstMatch
            XCTAssertTrue(reveal(c), "pick missing: \(t)"); c.tap(); sleep(1)
            if t != "Languages" && t != "Pocket money" { XCTAssertEqual(c.value as? String, "ticked", "\(t) did not tick") }
            if t == "Languages" { let ch = app.buttons["chip-languages-Spanish"]; XCTAssertTrue(reveal(ch)); ch.tap(); sleep(1); XCTAssertEqual(ch.value as? String, "ticked"); XCTAssertEqual(c.value as? String, "ticked", "Languages card did not tick"); qshot("ask-\(side)-chip-Spanish") }
            if t == "Pocket money" { let ch = app.buttons["chip-pocket-$150"]; XCTAssertTrue(reveal(ch)); ch.tap(); sleep(1); XCTAssertEqual(ch.value as? String, "ticked"); XCTAssertEqual(c.value as? String, "ticked", "Pocket money card did not tick"); qshot("ask-\(side)-chip-pocket") }
            qshot("ask-\(side)-tick-\(t.replacingOccurrences(of: " ", with: "_"))")
        }
        // every screen of the sheet, top to bottom, so the au pair section stands in a picture
        for _ in 0..<60 { app.swipeDown(velocity: .fast) }
        for i in 0..<12 { qshot("ask-\(side)-page-\(String(format: "%02d", i))"); app.swipeUp(); app.swipeUp() }
        // relaunch: card key picks and the coded first aid pick come back from the account, the device picks from the device
        app.terminate(); app.launchArguments += ["-AppleLanguages", "(en)"]; app.launch()
        openAsking()
        for t in ["Dancing", pets, "Languages", "Calm", "Driving licence", "First aid", "CPR", "Own room", "Pocket money"] {
            let c = app.buttons["tick-\(t)"].firstMatch
            XCTAssertTrue(reveal(c), "after relaunch pick missing: \(t)"); XCTAssertEqual(c.value as? String, "ticked", "\(t) lost after relaunch")
            if t == "Languages" { c.tap(); sleep(1); let ch = app.buttons["chip-languages-Spanish"]; XCTAssertTrue(reveal(ch)); XCTAssertEqual(ch.value as? String, "ticked", "Spanish lost after relaunch") }
            if t == "Pocket money" { c.tap(); sleep(1); let ch = app.buttons["chip-pocket-$150"]; XCTAssertTrue(reveal(ch)); XCTAssertEqual(ch.value as? String, "ticked", "pocket money lost after relaunch") }
            qshot("ask-\(side)-relaunch-\(t.replacingOccurrences(of: " ", with: "_"))")
        }
        try? "\(side) all picks stood after relaunch".write(toFile: "/Users/ilseplacencia/cs181/pics/result-\(side).txt", atomically: true, encoding: .utf8)
        for _ in 0..<60 { app.swipeDown(velocity: .fast) }
        app.navigationBars.buttons.firstMatch.tap(); sleep(1)
        deleteFromSettings()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 120))
    }
    func testAskingFamily() { asking(side: "family") }
    func testAskingCarer() { asking(side: "carer") }


    // Build 181 item 2 re-picture: every pick with its icon as shipped, both sides, au pair included
    func askingIcons(side: String) {
        if side == "family" {
            signUp(side: "family"); fillYou("Test QFam"); next(); tap("Babysitter"); next()
            type(app.textFields["Name or nickname"], "Mia"); dismissKb(); sleep(1); next()
            if !app.buttons["Finish"].waitForExistence(timeout: 6) { next() }
        } else {
            signUp(side: "carer"); fillYou("Test QCarer"); next(); tap("Nanny"); next(); tap("Skip")
            type(app.textFields["A few words about your care"], "Kind and calm care"); dismissKb(); next()
        }
        tap("Finish", timeout: 20)
        openAsking()
        for i in 0..<12 {
            qshot("icons-\(side)-page-\(String(format: "%02d", i))")
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72)).press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.44)))
        }
        for _ in 0..<60 { app.swipeDown(velocity: .fast) }
        app.navigationBars.buttons.firstMatch.tap(); sleep(1)
        deleteFromSettings()
        // After a long run the account asks to sign in once more before it deletes.
        if app.staticTexts["Is it really you?"].waitForExistence(timeout: 20) {
            type(app.secureTextFields["Your password"], testPw); dismissKb(); tap("Confirm and delete")
        }
        let out = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 240)
        qshot("icons-\(side)-after-delete")
        XCTAssertTrue(out, "not signed out after delete: " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | "))
    }
    func testIconsFamily() { askingIcons(side: "family") }
    func testIconsCarer() { askingIcons(side: "carer") }

    // Build 181 item 3: the map as her Map World page, pictured on each side
    func mapProof(_ tag: String, side: String, service: String = "Nanny") {
        if side == "family" {
            signUp(side: "family"); fillYou("Test MFam"); next(); tap("Babysitter"); next()
            type(app.textFields["Name or nickname"], "Mia"); dismissKb(); sleep(1); next()
            if !app.buttons["Finish"].waitForExistence(timeout: 6) { next() }
        } else {
            signUp(side: "carer"); fillYou("Test MCarer"); next(); tap(service); next()
            if app.buttons["Skip"].waitForExistence(timeout: 4) { tap("Skip") }
            let about = app.textFields["A few words about your care"]
            if about.waitForExistence(timeout: 4) { type(about, "Kind and calm care"); dismissKb() }
            next()
        }
        tap("Finish", timeout: 20)
        XCTAssertTrue(app.tabBars.buttons.element(boundBy: 0).waitForExistence(timeout: 60)); app.tabBars.buttons.element(boundBy: 0).tap(); sleep(2)
        let mapBtn = app.buttons["Map"]
        if !mapBtn.waitForExistence(timeout: 60) { qshot("map-\(tag)-FAIL-no-map-button") }
        XCTAssertTrue(mapBtn.exists, "no Map button"); sleep(6); qshot("map-\(tag)-0-before-tap")
        for _ in 0..<3 {
            let tg = app.descendants(matching: .any).matching(identifier: "mapToggle").firstMatch
            if tg.exists && tg.label == "Deck" { break }
            if tg.exists { tg.tap() }; sleep(5)
        }
        if !(app.otherElements["peopleMap"].waitForExistence(timeout: 30) || app.maps.firstMatch.waitForExistence(timeout: 5)) { qshot("map-\(tag)-FAIL-map-did-not-open") }
        let pin = app.descendants(matching: .any).matching(identifier: "mapPin").firstMatch
        if !pin.waitForExistence(timeout: 90) { qshot("map-\(tag)-FAIL-no-pins"); try? app.debugDescription.write(toFile: "/Users/ilseplacencia/cs181/logs/dbg-nopins.txt", atomically: true, encoding: .utf8) }
        XCTAssertTrue(pin.exists, "MAP WITH NO PINS (a fail)")
        qshot("map-\(tag)-1-standing-with-pins")
        pin.tap(); sleep(2)
        let meet = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Meet ")).firstMatch
        if !meet.waitForExistence(timeout: 15) { qshot("map-\(tag)-FAIL-pin-did-not-select") }
        XCTAssertTrue(meet.exists, "pin did not select (no Meet button)")
        qshot("map-\(tag)-2-pin-selected")
        meet.tap(); sleep(3)
        qshot("map-\(tag)-3-person-opened")
        app.navigationBars.buttons.firstMatch.tap(); sleep(2)
        app.tabBars.buttons["Me"].tap(); sleep(2)
        deleteFromSettings()
        if app.staticTexts["Is it really you?"].waitForExistence(timeout: 20) { type(app.secureTextFields["Your password"], testPw); dismissKb(); tap("Confirm and delete") }
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 240), "account not deleted")
    }
    // Build 181 item 3: country picking. The au pair picks her own country (card nationality); the family picks countries (looking prefs nationality)
    // and the family's map shows au pairs only from those countries.
    func pickCountry(_ pick: String, chip: String, expect: String = "ticked", open: Bool = true) {
        let card = app.buttons["tick-" + pick]; XCTAssertTrue(reveal(card, max: 40), "no country pick card " + pick)
        if open { card.tap(); sleep(1) }
        let c = app.buttons["chip-country-" + chip]; XCTAssertTrue(reveal(c, max: 12), "no country chip " + chip)
        if c.value as? String != expect { c.tap(); sleep(3) }
        XCTAssertEqual(c.value as? String, expect, "chip " + chip)
    }
    func leaveAsking() { app.navigationBars.buttons.firstMatch.tap(); sleep(2) }
    func setMap(_ on: Bool) {
        let tg = app.descendants(matching: .any).matching(identifier: "mapToggle").firstMatch
        XCTAssertTrue(tg.waitForExistence(timeout: 60), "no map toggle")
        for _ in 0..<3 { if (tg.label == "Deck") == on { return }; tg.tap(); sleep(5) }
    }
    func deleteThisAccount() {
        app.tabBars.buttons["Me"].tap(); sleep(2)
        deleteFromSettings()
        if app.staticTexts["Is it really you?"].waitForExistence(timeout: 20) { type(app.secureTextFields["Your password"], testPw); dismissKb(); tap("Confirm and delete") }
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 240), "account not deleted")
    }
    func testCountryMap() {
        // 1. the au pair picks her country, relaunch reads it back
        signUp(side: "carer"); fillYou("Test CAuPair"); next(); tap("Au pair"); next()
        if app.buttons["Skip"].waitForExistence(timeout: 4) { tap("Skip") }
        let about = app.textFields["A few words about your care"]
        if about.waitForExistence(timeout: 4) { type(about, "Kind and calm care"); dismissKb() }
        next(); tap("Finish", timeout: 20)
        let apEmail = testEmail, apPw = testPw
        openAsking(); pickCountry("My country", chip: "Colombian"); qshot("country-1-aupair-picks-colombian")
        app.terminate(); app.launch()
        openAsking(); pickCountry("My country", chip: "Colombian", open: true)
        qshot("country-2-aupair-after-relaunch-colombian-still-ticked")
        leaveAsking(); signOutFromMe(); sleep(1)
        // 2. the family picks Filipino: the Colombian au pair must not show on its map
        signUp(side: "family"); fillYou("Test CFam"); next(); tap("Au pair"); next()
        type(app.textFields["Name or nickname"], "Mia"); dismissKb(); sleep(1); next()
        if !app.buttons["Finish"].waitForExistence(timeout: 6) { next() }
        tap("Finish", timeout: 20)
        openAsking(); pickCountry("Countries you welcome", chip: "Filipino"); qshot("country-3-family-picks-filipino")
        leaveAsking(); app.tabBars.buttons.element(boundBy: 0).tap(); sleep(2)
        setMap(true); sleep(10)
        let pin = app.descendants(matching: .any).matching(identifier: "mapPin").firstMatch
        XCTAssertFalse(pin.waitForExistence(timeout: 30), "an au pair pin showed although the family chose Filipino")
        qshot("country-4-filipino-chosen-no-colombian-au-pair-pin")
        setMap(false)
        // 3. the family switches to Colombian: her pin appears
        openAsking(); pickCountry("Countries you welcome", chip: "Filipino", expect: "not ticked", open: false)
        pickCountry("Countries you welcome", chip: "Colombian", open: false); qshot("country-5-family-switches-to-colombian")
        leaveAsking(); app.tabBars.buttons.element(boundBy: 0).tap(); sleep(2)
        setMap(true)
        XCTAssertTrue(pin.waitForExistence(timeout: 90), "no au pair pin although the family chose Colombian")
        qshot("country-6-colombian-chosen-au-pair-pin-shows")
        pin.tap(); sleep(2)
        let meet = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Meet ")).firstMatch
        XCTAssertTrue(meet.waitForExistence(timeout: 15), "no Meet"); qshot("country-7-au-pair-pin-selected"); meet.tap(); sleep(3)
        qshot("country-8-au-pair-opened")
        app.navigationBars.buttons.firstMatch.tap(); sleep(2)
        // 4. clean up both accounts
        deleteThisAccount()
        tap("Use email"); tap("I already have an account")
        type(app.textFields["Email"], apEmail); type(app.secureTextFields["Password (6+ letters)"], apPw); dismissKb(); tap("Sign in")
        testPw = apPw; XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 90), "au pair did not sign in"); deleteThisAccount()
    }
    func testMapFamily() { mapProof("family", side: "family") }
    func testMapNanny() { mapProof("nanny", side: "carer", service: "Nanny") }
    func testMapAuPair() { mapProof("aupair", side: "carer", service: "Au pair") }


    func testNannyApp() { carer("Nanny", tabs: ["Families", "Requests", "Calendar", "Chat", "Me"]) }
    func testBabysitterApp() { carer("Babysitter", tabs: ["Jobs", "Requests", "Calendar", "Families", "Me"]) }
    func testAuPairApp() { carer("Au pair", tabs: ["Host families", "My week", "Requests", "Chat", "Me"]) }

    /// F-179-2: the name step has no skip. A family cannot pass it without a name, and the name stands on the profile.
    func testSkipFamilyAndLabels() {
        signUp(side: "family")
        for l in ["Your name", "Postcode", "Suburb"] { XCTAssertTrue(app.staticTexts[l].waitForExistence(timeout: 10), "visible label missing: \(l)") }
        shot("b180-name-step-no-skip")
        XCTAssertFalse(app.buttons["Skip for now"].exists || app.buttons["skipFamily"].exists, "Skip for now still stands on the name step")
        tap("Next"); sleep(2)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Add your name")).firstMatch.exists, "no name ask after Next with an empty name")
        XCTAssertTrue(app.textFields["Your name"].exists, "the empty name got past the name step")
        shot("b180-name-step-blocks-empty")
        fillYou("Named Family"); next(); next(); type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 90))
        app.tabBars.buttons["Me"].tap(); sleep(2)
        XCTAssertTrue(app.staticTexts["Named Family"].waitForExistence(timeout: 15), "the name is not on the profile. Texts: " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | "))
        shot("b180-me-name-stands")
        deleteFromSettings()
        let door = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 120)
        shot("b180-after-delete"); XCTAssertTrue(door, "no door after delete. Texts: " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | "))
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
        deleteFromSettings()
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
        deleteFromSettings()
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
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 90), "no tab bar after relaunch")
        app.tabBars.buttons["Me"].tap()
        deleteFromSettings()
        let out = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 90)
        shot("b177-delete-5-normal-lands-on-sign-in"); XCTAssertTrue(out, "normal delete did not land on the sign in door")
    }
    /// F-179-1 and 180 item 4: the Apple flow dismissed (in whatever shape the sim offers), twice, then Use email opens the email page.
    /// The door must stand with no raw error line.
    func testDoorAfterApple() {
        app.launchArguments += ["-AppleLanguages", "(en)"]; app.launch()
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 40), "door did not appear")
        let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for round in 1...2 {
            let apple = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Apple")).firstMatch
            XCTAssertTrue(apple.waitForExistence(timeout: 20), "Apple button missing")
            apple.tap(); sleep(4); shot("b180-apple-flow-\(round)")
            for n in ["Close", "Cancel", "OK"] where sb.buttons[n].exists { sb.buttons[n].tap(); break }
            sleep(4)
            XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 10), "door not back after Apple (round \(round))")
            let texts = app.staticTexts.allElementsBoundByIndex.map { $0.label }
            print("B180 door after Apple round \(round): \(texts)")
            shot("b180-door-clean-\(round)")
            XCTAssertFalse(texts.contains(where: { $0.lowercased().contains("couldn") || $0.contains("AuthenticationServices") || $0.lowercased().contains("error") }), "raw error line on the door: \(texts)")
            tap("Use email")
            XCTAssertTrue(app.textFields["Email"].waitForExistence(timeout: 15), "email page did not open after Apple dismissed (round \(round))")
            shot("b180-email-page-\(round)")
            app.buttons["emailBack"].tap()
            XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 10), "Back did not return to the door (round \(round))")
        }
    }
    /// Sign back in with an account this test made earlier.
    func signIn(email: String, pw: String) {
        tap("Use email")
        let toggle = app.buttons["I already have an account"]
        if toggle.waitForExistence(timeout: 6) { toggle.tap() }
        type(app.textFields["Email"], email)
        type(app.secureTextFields["Password (6+ letters)"], pw)
        tap("Sign in")
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 60), "sign in did not land")
    }
    func ensureTicked(_ id: String) {
        let b = app.buttons[id].firstMatch
        XCTAssertTrue(reveal(b, max: 10), "chip missing: \(id)")
        if (b.value as? String) != "ticked" { b.tap(); sleep(1) }
        XCTAssertEqual(b.value as? String, "ticked", "chip did not tick: \(id)")
    }
    /// Item 4, the urgent board, walked whole: family posts, carer says yes and the chat opens at once,
    /// family picks the carer, the post reads filled and names the carer. Both accounts delete at the end.
    func testUrgentBoard() {
        let note = "Urgent note WALK\(Int(Date().timeIntervalSince1970))"
        signUp(side: "family"); fillYou("Test UFam"); next(); next()
        type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        let famEmail = testEmail, famPw = testPw
        tapUrgent()
        tap("Post an urgent need")
        tap("Tomorrow")
        ensureTicked("part-Evening")
        ensureTicked("band-3-5")
        let nf = app.descendants(matching: .any)["jobNote"].firstMatch
        XCTAssertTrue(nf.waitForExistence(timeout: 10), "note field missing"); nf.tap(); sleep(1); nf.typeText(note)
        dismissKb()
        XCTAssertTrue(reveal(app.buttons["postJob"], max: 6), "post button missing"); app.buttons["postJob"].tap(); sleep(3)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Tomorrow")).firstMatch.waitForExistence(timeout: 30), "post not in the family list")
        qshot("urgent-1-family-post-live")
        signOutFromMe()
        // carer: the post stands as a swipe card; a yes writes interest and opens the chat at once
        signUp(side: "carer"); fillYou("Test UCarer"); next(); tap("Nanny"); next(); tap("Skip")
        type(app.textFields["A few words about your care"], "Kind and calm care"); dismissKb(); next()
        tap("Finish", timeout: 20)
        let carEmail = testEmail, carPw = testPw
        tapUrgent()
        let card = app.descendants(matching: .any)["urgentCard"].firstMatch
        if !card.waitForExistence(timeout: 90) { qshot("urgent-FAIL-no-card"); XCTFail("urgent card never showed. Texts: " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | ")); return }
        // Leftover posts from failed runs can stand ahead of this run's post in the deck: pass until this run's card stands.
        func topCardHasNote() -> Bool { app.descendants(matching: .any)["urgentCard"].firstMatch.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", note)).firstMatch.exists }
        var onMine = topCardHasNote()
        var passes = 0
        while !onMine && passes < 6 {
            let passBtn = app.descendants(matching: .any)["urgentPass"].firstMatch
            if !passBtn.exists { break }
            passBtn.tap(); sleep(3); passes += 1
            onMine = topCardHasNote()
        }
        XCTAssertTrue(onMine, "the carer deck never reached this run's post")
        qshot("urgent-2-carer-card")
        app.descendants(matching: .any)["urgentYes"].firstMatch.tap(); sleep(3)
        XCTAssertTrue(app.textFields["Message"].waitForExistence(timeout: 30), "chat did not open on the yes")
        qshot("urgent-3-chat-open")
        tap("Close")
        signOutFromMe()
        // family again: the yes stands on the post; picking fills it and names the carer
        signIn(email: famEmail, pw: famPw); testEmail = famEmail; testPw = famPw
        tapUrgent()
        let pick = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'pickCarer-'")).firstMatch
        if !pick.waitForExistence(timeout: 60) { qshot("urgent-FAIL-no-yes"); XCTFail("yes list never showed the carer. Texts: " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | ")); return }
        qshot("urgent-4-family-yes-list")
        pick.tap(); sleep(3)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Filled by")).firstMatch.waitForExistence(timeout: 30), "post did not read filled with the carer name")
        qshot("urgent-5-filled")
        deleteThisAccount()
        signIn(email: carEmail, pw: carPw); testEmail = carEmail; testPw = carPw
        deleteThisAccount()
    }
    /// Item 4 expiry: a post whose start has passed reads Ended for the family and never shows to a carer.
    func testUrgentExpiry() {
        let note = "Urgent note PAST\(Int(Date().timeIntervalSince1970))"
        signUp(side: "family"); fillYou("Test XPFam"); next(); next()
        type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        tapUrgent()
        tap("Post an urgent need")
        tap("Today")
        ensureTicked("part-Morning")
        ensureTicked("band-3-5")
        let nf = app.descendants(matching: .any)["jobNote"].firstMatch
        XCTAssertTrue(nf.waitForExistence(timeout: 10), "note field missing"); nf.tap(); sleep(1); nf.typeText(note)
        dismissKb()
        XCTAssertTrue(reveal(app.buttons["postJob"], max: 6), "post button missing"); app.buttons["postJob"].tap(); sleep(3)
        // the start time was "now" as the form opened: by the time the list reads it back, it has passed
        XCTAssertTrue(app.staticTexts["Ended"].waitForExistence(timeout: 30), "past post did not read Ended. Texts: " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | "))
        qshot("urgentx-1-family-ended")
        deleteThisAccount()
        signUp(side: "carer"); fillYou("Test XPCarer"); next(); tap("Nanny"); next(); tap("Skip")
        type(app.textFields["A few words about your care"], "Kind and calm care"); dismissKb(); next()
        tap("Finish", timeout: 20)
        tapUrgent(); sleep(8)
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", note)).firstMatch.exists, "a past post showed to a carer")
        qshot("urgentx-2-carer-no-past-post")
        deleteThisAccount()
    }
    /// Item 4 distance: a far post stays off a nearby carer's board until the distance opens to Any.
    func testUrgentDistance() {
        let note = "Urgent note FAR\(Int(Date().timeIntervalSince1970))"
        signUp(side: "family"); fillYou("Test DFam"); next(); next()
        type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        let famEmail = testEmail, famPw = testPw
        tapUrgent()
        tap("Post an urgent need")
        tap("Tomorrow")
        ensureTicked("part-Evening")
        ensureTicked("band-3-5")
        let pc = app.textFields["jobPostcode"]
        XCTAssertTrue(pc.waitForExistence(timeout: 10), "postcode field missing"); pc.tap(); sleep(1)
        for _ in 0..<6 { pc.typeText(XCUIKeyboardKey.delete.rawValue) }
        pc.typeText("7250"); dismissKb()
        let nf = app.descendants(matching: .any)["jobNote"].firstMatch
        nf.tap(); sleep(1); nf.typeText(note); dismissKb()
        XCTAssertTrue(reveal(app.buttons["postJob"], max: 6), "post button missing"); app.buttons["postJob"].tap(); sleep(3)
        signOutFromMe()
        signUp(side: "carer"); fillYou("Test DCarer"); next(); tap("Nanny"); next(); tap("Skip")
        type(app.textFields["A few words about your care"], "Kind and calm care"); dismissKb(); next()
        tap("Finish", timeout: 20)
        let carEmail = testEmail, carPw = testPw
        // the urgent distance rides the phone: make sure it stands at 25 km before judging the cut
        app.tabBars.buttons["Me"].tap(); openSettings()
        let anyMenu = app.buttons.matching(NSPredicate(format: "label == 'Any'")).firstMatch
        if anyMenu.waitForExistence(timeout: 4) { anyMenu.tap(); sleep(1); tap("25 km") }
        app.tabBars.buttons.element(boundBy: 0).tap()
        tapUrgent(); sleep(10)
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", note)).firstMatch.exists, "a far post showed inside 25 km")
        qshot("urgentd-1-far-post-hidden")
        // open the urgent distance to Any in Settings: the far post now shows
        app.tabBars.buttons["Me"].tap(); openSettings()
        let menu = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "25 km")).firstMatch
        XCTAssertTrue(reveal(menu, max: 10), "urgent distance menu missing"); menu.tap(); sleep(1)
        tap("Any distance")
        app.tabBars.buttons.element(boundBy: 0).tap(); tapUrgent(); sleep(8)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", note)).firstMatch.waitForExistence(timeout: 60), "far post did not show at Any distance")
        qshot("urgentd-2-far-post-shown")
        deleteThisAccount()
        signIn(email: famEmail, pw: famPw); testEmail = famEmail; testPw = famPw
        tapUrgent()
        let close = app.buttons["closePost"].firstMatch
        if close.waitForExistence(timeout: 30) { close.tap(); sleep(2) }
        deleteThisAccount()
    }
}

extension String {
    func appendLine(to path: String) throws {
        let u = URL(fileURLWithPath: path)
        if let h = try? FileHandle(forWritingTo: u) { h.seekToEndOfFile(); h.write(Data(self.utf8)); try h.close() } else { try write(to: u, atomically: true, encoding: .utf8) }
    }
}
