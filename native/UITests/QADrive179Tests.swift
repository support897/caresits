import XCTest

// QA drive, Caresitters build 179, head 32028ed, branch build-179.
// Quality PASS + Efficiency PASS; upload NOT authorised, so this runs on the
// locally built signed bytes of that head. Proof-only; never ships.
// Legs 1-7 in QA's commission order (23:32). One leg per run. Team test
// accounts only, fresh nat-scheme accounts made inside each walk, deleted
// at the end of each leg that creates one. Self-contained: no dependency on
// the suite's base class, so the suite composition never changes.
final class QADrive179Tests: XCTestCase {
    let app = XCUIApplication()
    override func setUp() { continueAfterFailure = false }
    var epoch: Int { Int(Date().timeIntervalSince1970) }

    func shot(_ name: String) {
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
        let d = "/Users/ilseplacencia/Apps/nativeproj/pics/shots"; try? FileManager.default.createDirectory(atPath: d, withIntermediateDirectories: true); try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "\(d)/\(name).png"))
    }
    func screenTexts() -> String { app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | ") }
    func screenButtons() -> String { app.buttons.allElementsBoundByIndex.map { $0.label }.joined(separator: " | ") }
    func tap(_ label: String, timeout: TimeInterval = 15) {
        var b = app.buttons[label].firstMatch
        if !b.waitForExistence(timeout: 3) { b = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", label)).firstMatch }
        if !b.waitForExistence(timeout: timeout) { shot("MISSING-\(label)"); XCTFail("button \(label) missing. Screen: " + screenTexts() + " || Buttons: " + screenButtons()); return }
        sleep(1); b.tap()
    }
    func type(_ field: XCUIElement, _ text: String) {
        if !field.waitForExistence(timeout: 30) { XCTFail("field missing: " + String(app.debugDescription.prefix(1500))); return }
        field.tap(); sleep(1)
        if !(field.value(forKey: "hasKeyboardFocus") as? Bool ?? true) { field.tap(); sleep(1) }
        field.typeText(text)
    }
    func dismissKb() { let t = app.staticTexts["onbTitle"]; if t.exists { t.tap() } }
    func next() {
        let t = app.staticTexts["onbTitle"]; let before = t.exists ? t.label : ""
        tap("Next"); sleep(2)
        if t.exists && t.label == before { tap("Next"); sleep(2) }
    }
    func fillYou(_ name: String) {
        type(app.textFields["Your name"], name)
        type(app.textFields["Postcode"], "4005"); dismissKb()
        type(app.textFields["Suburb"], "New Farm"); dismissKb()
    }
    func signOutIfInside() {
        if app.tabBars.buttons["Me"].waitForExistence(timeout: 5) {
            app.tabBars.buttons["Me"].tap()
            let so = app.buttons["Sign out"]
            for _ in 0..<6 where !so.isHittable { app.swipeUp() }
            so.tap(); sleep(2)
        }
    }
    func freshCreds(_ tag: String) -> (String, String) {
        let e = epoch
        return ("projects.reports.ilse+nat\(tag)\(e)@gmail.com", "Nat-\(e)-Zq9")
    }
    func createAccount(email: String, pw: String) {
        tap("Use email")
        type(app.textFields["Email"], email)
        type(app.secureTextFields["Password (6+ letters)"], pw)
        tap("Create my account")
        shot("qa-after-create")
        // QA leg 01 verdict (Could not check, first run): the role tap fired
        // while the save password sheet still stood and computed hit point
        // {-1, -1}; the tap never landed. Fixed harness shape: dismiss the
        // sheet and VERIFY it is gone, wait until the role pick is visible
        // AND hittable, then tap, with real screenshots at each step.
        let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for _ in 0..<10 {
            if sb.buttons["Not Now"].exists { sb.buttons["Not Now"].tap(); sleep(1) }
            if app.buttons["Not Now"].exists { app.buttons["Not Now"].tap(); sleep(1) }
            if !sb.buttons["Not Now"].exists && !app.buttons["Not Now"].exists { break }
            sleep(1)
        }
        let sheetGone = !sb.buttons["Not Now"].exists && !app.buttons["Not Now"].exists
        print("QA sheet gone after create: \(sheetGone)")
        shot("qa-role-screen")
        let role = app.buttons["I need care"]
        XCTAssertTrue(role.waitForExistence(timeout: 30), "role pick stands. Texts: " + screenTexts())
        var hittable = false
        for _ in 0..<30 { if role.isHittable { hittable = true; break }; sleep(1) }
        print("QA role pick hittable: \(hittable) frame: \(role.frame)")
        XCTAssertTrue(hittable, "role pick never became hittable. Texts: " + screenTexts())
        shot("qa-role-screen-ready")
        role.tap(); sleep(1)
        shot("qa-role-after-tap")
        XCTAssertTrue(app.textFields["Your name"].waitForExistence(timeout: 25), "first-run onboarding stands")
    }
    func signIn(email: String, pw: String) {
        tap("Use email")
        if app.buttons["I already have an account"].exists { app.buttons["I already have an account"].tap(); sleep(1) }
        type(app.textFields["Email"], email)
        type(app.secureTextFields["Password (6+ letters)"], pw)
        tap("Sign in")
    }
    func onboardFamily(name: String) {
        fillYou(name); next(); next()
        type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 90), "inside after onboarding")
    }
    func deckReady() {
        // Onboarding's Finish can land inside on the Me tab (seen leg 02 run 2:
        // the walk stood on Me with the deck one tab away). Go to the deck tab
        // first, then wait for the card; a no-op when already standing there.
        let findCare = app.tabBars.buttons["Find care"]
        if findCare.exists { findCare.tap(); sleep(1) }
        let card = app.descendants(matching: .any)["topCard"].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 75), "deck: no card. Texts: " + screenTexts() + " || Buttons: " + screenButtons())
    }
    /// Swipe right on the top card, take the match banner, open the chat from it.
    /// Returns the matched first name from the banner text.
    func matchAndOpenChat() -> String {
        deckReady()
        shot("qa-deck-card")
        let card = app.descendants(matching: .any)["topCard"].firstMatch
        card.swipeRight(); sleep(2)
        let banner = app.descendants(matching: .any)["matchBanner"].firstMatch
        XCTAssertTrue(banner.waitForExistence(timeout: 10), "no match banner after right swipe. Texts: " + screenTexts())
        shot("qa-match-banner")
        let bannerText = banner.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " ")
        print("QA banner: \(bannerText)")
        var firstName = ""
        if let r = bannerText.range(of: "Matched with ") { firstName = String(bannerText[r.upperBound...]).trimmingCharacters(in: .whitespaces) }
        let bm = app.buttons.matching(NSPredicate(format: "label == %@", "Message")).allElementsBoundByIndex.first
        XCTAssertNotNil(bm, "no banner Message button")
        bm?.tap(); sleep(2)
        XCTAssertTrue(app.textFields["Message"].waitForExistence(timeout: 20), "Message tap did not open a chat. Texts: " + screenTexts())
        if firstName.isEmpty {
            // The banner's staticTexts do not carry the "Matched with" line on
            // this build (leg 01 + leg 02 runs both extracted ""). Fall back to
            // the chat screen's own "Book <firstName>" button title.
            let btnTexts = screenButtons()
            if let r = btnTexts.range(of: "Book ") {
                let rest = btnTexts[r.upperBound...]
                let token = rest.split(separator: "|").first.map(String.init) ?? ""
                firstName = token.trimmingCharacters(in: .whitespaces)
            }
            print("QA name fallback from chat Book button: \(firstName)")
        }
        return firstName
    }
    func deleteAccount(pw: String) {
        app.tabBars.buttons["Me"].tap()
        let del = app.buttons["Delete my account"]
        for _ in 0..<6 where !del.isHittable { app.swipeUp() }
        del.tap(); tap("Delete everything")
        let pwField = app.secureTextFields["Your password"]
        if pwField.waitForExistence(timeout: 20) {
            func pwLen() -> Int { (pwField.value as? String)?.count ?? 0 }
            pwField.tap(); sleep(1)
            var ok = false
            for _ in 0..<3 where !ok {
                if pwLen() > 0 { pwField.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: pwLen() + 4)) }
                for ch in pw { pwField.typeText(String(ch)); usleep(120_000) }
                sleep(1)
                ok = pwLen() == pw.count
                print("QA delete reauth pw length: \(pwLen()) of \(pw.count)")
            }
            XCTAssertTrue(ok, "reauth password typed in full")
            let confirm = app.buttons["Confirm and delete"]
            XCTAssertTrue(confirm.waitForExistence(timeout: 10), "confirm and delete shows")
            confirm.tap()
        }
        let out = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch.waitForExistence(timeout: 120)
        shot("qa-delete-lands-on-door")
        XCTAssertTrue(out, "delete did not land on the door")
    }

    // MARK: - leg 01: chat first, then book
    // Cleanup walk, added 13 Nov on QA's leg 01 re-run: run 1's account was
    // created but its role tap missed, so the app resumes at the role pick
    // on every launch and the session survives even an app uninstall (the
    // auth session lives in the sim keychain). This walk finishes that
    // account's onboarding, then signs out, so the deciding re-run starts
    // at the door. The account itself stays on the backend: its password
    // was never printed in full anywhere (the run log truncates typed
    // values), so the delete flow's re-auth step cannot be walked for it.
    func testQA00_CleanupResumed() {
        app.launch()
        sleep(3)
        if app.tabBars.buttons["Me"].exists { print("QA00 already inside; signing out"); signOutIfInside(); sleep(2); print("QA00 door after sign out: \(app.buttons["Use email"].exists)"); return }
        let role = app.buttons["I need care"]
        XCTAssertTrue(role.waitForExistence(timeout: 20), "QA00 role pick stands. Texts: " + screenTexts())
        var hittable = false
        for _ in 0..<30 { if role.isHittable { hittable = true; break }; sleep(1) }
        print("QA00 role pick hittable: \(hittable)")
        XCTAssertTrue(hittable, "QA00 role pick never hittable")
        shot("qa00-role-screen")
        role.tap(); sleep(1)
        shot("qa00-role-after-tap")
        XCTAssertTrue(app.textFields["Your name"].waitForExistence(timeout: 25), "QA00 onboarding stands after role tap")
        onboardFamily(name: "QA Cleanup")
        signOutIfInside()
        sleep(2)
        print("QA00 door after sign out: \(app.buttons["Use email"].exists)")
        shot("qa00-door-after-signout")
    }
    func testQA01_ChatFirstNoBooking() {
        let (email, pw) = freshCreds("qa01")
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        createAccount(email: email, pw: pw)
        onboardFamily(name: "QA Chat First")
        let name = matchAndOpenChat()
        shot("qa01-chat-open")
        let texts = screenTexts()
        XCTAssertFalse(texts.contains("Chat did not open"), "chat did not open: " + texts)
        XCTAssertFalse(texts.lowercased().contains("booking request"), "booking-request gate appeared: " + texts)
        XCTAssertFalse(texts.contains("Chat opens after a yes"), "after-a-yes gate text present: " + texts)
        print("QA01 chat first: chat opened from match with \(name), no booking made. Screen: \(texts)")
        if app.navigationBars.buttons.firstMatch.exists { app.navigationBars.buttons.firstMatch.tap(); sleep(1) }
        deleteAccount(pw: pw)
        print("QA01 account: \(email)")
    }

    // MARK: - leg 02: message loading speed, cold and warm
    func testQA02_MessageSpeed() {
        let (email, pw) = freshCreds("qa02")
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        createAccount(email: email, pw: pw)
        onboardFamily(name: "QA Fast Chat")
        let name = matchAndOpenChat()
        shot("qa02-chat-open")
        // Back to the deck, then time the Messages list and the thread.
        if app.navigationBars.buttons.firstMatch.exists { app.navigationBars.buttons.firstMatch.tap(); sleep(1) }
        func timeList(_ tag: String) -> Double {
            app.tabBars.buttons["Messages"].tap()
            let t0 = Date()
            let row = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", name)).firstMatch
            let ok = row.waitForExistence(timeout: 30)
            let dt = Date().timeIntervalSince(t0)
            print("QA02 messages list \(tag): \(String(format: "%.2f", dt))s row=\(ok)")
            XCTAssertTrue(ok, "messages list \(tag): no row for \(name). Texts: " + screenTexts())
            shot("qa02-list-\(tag)")
            return dt
        }
        func timeThread(_ tag: String) -> Double {
            let row = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", name)).firstMatch
            if row.exists { row.tap() } else { app.links.firstMatch.tap() }
            let t0 = Date()
            let ok = app.textFields["Message"].waitForExistence(timeout: 30)
            let dt = Date().timeIntervalSince(t0)
            print("QA02 thread \(tag): \(String(format: "%.2f", dt))s open=\(ok)")
            XCTAssertTrue(ok, "thread \(tag) did not open. Texts: " + screenTexts())
            shot("qa02-thread-\(tag)")
            if app.navigationBars.buttons.firstMatch.exists { app.navigationBars.buttons.firstMatch.tap(); sleep(1) }
            return dt
        }
        timeList("warm-1")
        timeThread("warm-1")
        app.tabBars.buttons["Find care"].tap(); sleep(1)
        timeList("warm-2")
        timeThread("warm-2")
        // Cold: terminate and relaunch, saved login lands inside.
        app.terminate(); sleep(2)
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 30), "relaunch did not land inside")
        timeList("cold")
        timeThread("cold")
        deleteAccount(pw: pw)
        print("QA02 account: \(email)")
    }

    // MARK: - leg 03: no green anywhere, shots at every screen
    func testQA03_NoGreenSweep() {
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        let splashHere = app.descendants(matching: .any)["splash"].exists
        print("QA03 splash at launch: \(splashHere)")
        shot("qa03-splash")
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 20), "door did not appear")
        shot("qa03-door")
        print("QA03 door texts: " + screenTexts())
        let (email, pw) = freshCreds("qa03")
        createAccount(email: email, pw: pw)
        onboardFamily(name: "QA Green Sweep")
        deckReady()
        shot("qa03-deck")
        print("QA03 deck texts: " + screenTexts())
        _ = matchAndOpenChat()
        shot("qa03-chat")
        print("QA03 chat texts: " + screenTexts())
        if app.navigationBars.buttons.firstMatch.exists { app.navigationBars.buttons.firstMatch.tap(); sleep(1) }
        app.tabBars.buttons["Me"].tap(); sleep(2)
        shot("qa03-me")
        print("QA03 me texts: " + screenTexts())
        print("QA03 sweep shots taken: splash, door, deck, chat, me. Green pixel counts run on the fetched PNGs; the bunny art's own edge pixels are named there.")
        deleteAccount(pw: pw)
        print("QA03 account: \(email)")
    }

    // MARK: - leg 04: logo image-compare, in-app mark and splash
    func testQA04_LogoCompare() {
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        let splashHere = app.descendants(matching: .any)["splash"].exists
        print("QA04 splash at launch: \(splashHere)")
        shot("qa04-splash")
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 20), "door did not appear")
        let logo = app.images["Caresitters"].firstMatch
        XCTAssertTrue(logo.waitForExistence(timeout: 10), "in-app logo mark missing on the door")
        print("QA04 logo frame: \(logo.frame)")
        shot("qa04-door-logo")
        tap("Use email")
        XCTAssertTrue(app.textFields["Email"].waitForExistence(timeout: 10), "email page did not open")
        let logo2 = app.images["Caresitters"].firstMatch
        if logo2.exists { print("QA04 email-page logo frame: \(logo2.frame)") }
        shot("qa04-email-logo")
        print("QA04 logo frames printed for the crop; the pixel compare against the approved master runs on the fetched PNGs.")
    }

    // MARK: - leg 05a: email sign-up + email sign-in
    func testQA05a_EmailDoors() {
        let (email, pw) = freshCreds("qa05a")
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        createAccount(email: email, pw: pw)
        fillYou("Door Proof"); next(); next()
        type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 90), "inside after onboarding")
        shot("qa05a-signup-inside")
        signOutIfInside()
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 15), "back on the door after sign out")
        signIn(email: email, pw: pw)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 60), "sign in returns inside")
        app.tabBars.buttons["Me"].tap(); sleep(2)
        shot("qa05a-signin-own-data")
        print("QA05a sign in returned to own data. Me texts: " + screenTexts())
        deleteAccount(pw: pw)
        print("QA05a account: \(email)")
    }

    // MARK: - leg 05b: Google + Apple cancel walks, quiet return; email Back + swipe-back
    func testQA05b_GoogleAppleCancels() {
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 20), "door did not appear")
        let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for (label, tag) in [("Google", "google"), ("Apple", "apple")] {
            let b = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", label)).firstMatch
            XCTAssertTrue(b.waitForExistence(timeout: 20), "\(label) button missing on the door")
            b.tap(); sleep(4)
            shot("qa05b-\(tag)-page")
            if sb.buttons["Cancel"].exists { sb.buttons["Cancel"].tap(); sleep(2) }
            XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 10), "\(label) cancel did not return to the door")
            // Run 1 (qa05b) died inside screenTexts(): the element tree was
            // still settling from the sheet dismissal and the index walk
            // threw a snapshot failure at the helper, before the Apple
            // error-line assert could run. Let the tree settle first.
            sleep(3)
            let texts = screenTexts()
            XCTAssertFalse(texts.lowercased().contains("cancel"), "\(label) cancel left an error line: " + texts)
            XCTAssertFalse(texts.lowercased().contains("could not"), "\(label) cancel left an error line: " + texts)
            shot("qa05b-\(tag)-quiet")
            print("QA05b \(label) cancel returned quietly. Door texts: \(texts)")
        }
        tap("Use email")
        XCTAssertTrue(app.textFields["Email"].waitForExistence(timeout: 10), "email page did not open")
        tap("Back", timeout: 10)
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 10), "Back did not return to the door")
        tap("Use email")
        XCTAssertTrue(app.textFields["Email"].waitForExistence(timeout: 10), "email page did not open the second time")
        let s = app.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.5)), e = app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5))
        s.press(forDuration: 0.1, thenDragTo: e)
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 10), "swipe back did not return to the door")
        shot("qa05b-email-back")
        print("QA05b email Back and swipe-back both returned to the door.")
    }

    // MARK: - leg 05c: saved login survives terminate + relaunch
    /// Tail check split out of 05b run 2: after an Apple cancel the walk's
    /// next "Use email" tap did not open the email page within 10 s. This
    /// reproduces that exact sequence on a fresh launch to settle whether
    /// the door is dead after an Apple cancel or the run 2 moment was
    /// residue from two back to back system sheets.
    func testQA05d_EmailAfterAppleCancel() {
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 20), "door did not appear")
        let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let b = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Apple")).firstMatch
        XCTAssertTrue(b.waitForExistence(timeout: 20), "Apple button missing on the door")
        b.tap(); sleep(4)
        if sb.buttons["Cancel"].exists { sb.buttons["Cancel"].tap(); sleep(2) }
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 10), "Apple cancel did not return to the door")
        sleep(3)
        print("QA05d door after Apple cancel: \(screenTexts())")
        tap("Use email")
        XCTAssertTrue(app.textFields["Email"].waitForExistence(timeout: 15), "email page did not open after Apple cancel")
        shot("qa05d-email-after-apple-cancel")
        tap("Back", timeout: 10)
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 10), "Back did not return to the door")
        tap("Use email")
        XCTAssertTrue(app.textFields["Email"].waitForExistence(timeout: 10), "email page did not open the second time")
        let s = app.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.5)), e = app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5))
        s.press(forDuration: 0.1, thenDragTo: e)
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 10), "swipe back did not return to the door")
        shot("qa05d-email-back")
        print("QA05d email page opens after Apple cancel; Back and swipe-back both returned to the door.")
    }

    func testQA05c_SavedLogin() {
        let (email, pw) = freshCreds("qa05c")
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        createAccount(email: email, pw: pw)
        fillYou("Door Proof"); next(); next()
        type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 90), "inside after onboarding")
        signOutIfInside()
        signIn(email: email, pw: pw)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 60), "signed in before kill")
        app.terminate(); sleep(2)
        app.launch()
        let inside = app.tabBars.buttons["Me"].waitForExistence(timeout: 30)
        let doorShown = app.buttons["Use email"].exists
        shot("qa05c-saved-login-relaunch")
        XCTAssertTrue(inside && !doorShown, "relaunch did not land inside")
        print("QA05c saved login: relaunch landed inside, not on the door.")
        deleteAccount(pw: pw)
        print("QA05c account: \(email)")
    }

    // MARK: - leg 06: name-audit strings photographed in situ
    func testQA06_NameAuditStrings() {
        let (email, pw) = freshCreds("qa06")
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        createAccount(email: email, pw: pw)
        let skip = app.buttons["skipFamily"].firstMatch
        XCTAssertTrue(skip.waitForExistence(timeout: 10), "Skip for now button missing on the name step")
        shot("qa06-skip-button")
        print("QA06 Skip for now stands on the name step. Screen: " + screenTexts())
        skip.tap(); sleep(1)
        let link = app.buttons["finishFamilyLinkOnboarding"]
        XCTAssertTrue(link.waitForExistence(timeout: 10), "skip notice link missing")
        shot("qa06-skip-notice")
        link.tap()
        XCTAssertTrue(app.staticTexts["My family"].waitForExistence(timeout: 10), "link did not open My family")
        tap("Done")
        next(); next(); sleep(1)
        tap("Finish", timeout: 20)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 90), "inside after onboarding")
        app.tabBars.buttons["Me"].tap(); sleep(2)
        shot("qa06-me-nameless")
        let meTexts = screenTexts()
        print("QA06 nameless profile in Me. Member shown: \(app.staticTexts["Member"].exists). Me texts: \(meTexts)")
        deleteAccount(pw: pw)
        print("QA06 account: \(email)")
    }

    // MARK: - leg 07: rendered map pins
    func testQA07_MapPins() {
        let (email, pw) = freshCreds("qa07")
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        createAccount(email: email, pw: pw)
        onboardFamily(name: "QA Map Pins")
        deckReady()
        tap("Map")
        sleep(6)
        shot("qa07-map")
        print("QA07 map rendered. Screen: " + screenTexts() + " || Buttons: " + screenButtons())
        app.tabBars.buttons["Me"].tap(); sleep(1)
        deleteAccount(pw: pw)
        print("QA07 account: \(email)")
    }
}
