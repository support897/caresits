import XCTest

/// CareSpace build 29 drive tests — written fresh at the CareSpace Boss
/// desk 2026-11-14 (the file standing in cs-test29 was blank: 4,551 bytes
/// of zeros and blank lines, no test functions).
/// testAutoFillOff: the SIM AUTOFILL LAW check on CS29 Test.
/// testSignUpThenSignIn: the instrumented reproduction for items 1 + 2 —
/// the app carries Trace prints (CS29TRACE) to its own cs29-trace.log.
final class CareSpaceFlowTests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    // MARK: AutoFill OFF in this sim's Settings (fleet pattern:
    // UI test against com.apple.Preferences; the switch takes a
    // coordinate tap at dx 0.9, a plain element tap does not flip it).
    func testAutoFillOff() throws {
        let prefs = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
        prefs.launch()
        XCTAssertTrue(prefs.wait(for: .runningForeground, timeout: 30))

        let general = prefs.cells.staticTexts["General"]
        if !general.waitForExistence(timeout: 10) {
            prefs.swipeUp()
        }
        XCTAssertTrue(general.waitForExistence(timeout: 10), "General row not found")
        general.tap()

        var autofill = prefs.cells.staticTexts["AutoFill & Passwords"]
        if !autofill.waitForExistence(timeout: 6) {
            prefs.swipeUp()
            autofill = prefs.cells.staticTexts["AutoFill & Passwords"]
        }
        XCTAssertTrue(autofill.waitForExistence(timeout: 10), "AutoFill & Passwords row not found")
        autofill.tap()

        let sw = prefs.switches["AutoFill Passwords and Passkeys"]
        XCTAssertTrue(sw.waitForExistence(timeout: 15), "AutoFill switch not found")
        let before = sw.value as? String
        print("AUTOFILL-VALUE-BEFORE: \(before ?? "nil")")
        if before == "1" {
            sw.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
            Thread.sleep(forTimeInterval: 1.0)
        }
        let after = sw.value as? String
        print("AUTOFILL-VALUE-AFTER: \(after ?? "nil")")
        XCTAssertEqual(after, "0", "AutoFill Passwords and Passkeys must read OFF")
    }

    // MARK: Items 1 + 2 — fresh email sign-up must land greeted by the
    // typed name (no second ask), then sign-out and sign-in must land.
    func testSignUpThenSignIn() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-carespace.theme", "light"]
        app.launch()

        let stamp = Int(Date().timeIntervalSince1970)
        let email = "projects.reports.ilse+cs29t\(stamp)@gmail.com"
        let password = "TraceTest29!"
        let name = "Trace Tester"

        // Door -> email page. The email line is a NavigationLink, which
        // the accessibility tree carries as a BUTTON, not a static text
        // (run 6 diagnosis, 2026-11-14: the staticTexts query waited the
        // full 60 s in vain while the door stood — the app's own trace
        // read listener.done with uidSet=false, the door state).
        let emailLink = app.buttons["Use email instead"]
        XCTAssertTrue(emailLink.waitForExistence(timeout: 60), "Door did not stand")
        emailLink.tap()

        // Sign up (the segmented control starts on Sign up).
        // Item 16: sign-up asks who you are FIRST — no pick, no account.
        let familyPick = app.buttons["Family"]
        XCTAssertTrue(familyPick.waitForExistence(timeout: 15), "Who-are-you pick did not stand")
        familyPick.tap()
        let nameField = app.textFields["Your name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 15))
        nameField.tap(); nameField.typeText(name)
        let emailField = app.textFields["Email"]
        emailField.tap(); emailField.typeText(email)
        let pwField = app.secureTextFields["Password"]
        pwField.tap(); pwField.typeText(password)
        app.buttons["Create my account"].tap()

        // Item 1: lands inside, greeted — the name ask must NOT stand.
        let chatsTab = app.tabBars.buttons["Chats"]
        let landed = chatsTab.waitForExistence(timeout: 60)
        let nameAsk = app.staticTexts["What is your name?"]
        print("SIGNUP-LANDED-INSIDE: \(landed) NAMEASK-STANDING: \(nameAsk.exists)")
        XCTAssertFalse(nameAsk.exists, "Item 1 fault: name re-asked after sign-up")
        XCTAssertTrue(landed, "Sign-up did not land inside")

        // Sign out from Profile.
        app.tabBars.buttons["Profile"].tap()
        let signOut = app.buttons["Sign out"]
        XCTAssertTrue(signOut.waitForExistence(timeout: 15))
        signOut.tap()
        // The confirm lives in the dialog's SHEET — scoped there,
        // because the Profile button behind it carries the same label
        // and an unscoped query matches both (run at this desk
        // 2026-11-15: "Multiple matching elements found" at this tap,
        // the sparse tree showing the sheet already open).
        let confirm = app.sheets.buttons["Sign out"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 10))
        confirm.tap()

        // Back at the door -> email page -> Sign in mode.
        XCTAssertTrue(emailLink.waitForExistence(timeout: 30), "Door did not return after sign-out")
        emailLink.tap()
        let seg = app.segmentedControls.buttons["Sign in"]
        XCTAssertTrue(seg.waitForExistence(timeout: 15))
        seg.tap()
        let emailField2 = app.textFields["Email"]
        emailField2.tap(); emailField2.typeText(email)
        let pwField2 = app.secureTextFields["Password"]
        pwField2.tap(); pwField2.typeText(password)
        // The segmented control's own "Sign in" segment is also a button
        // with this label, and tree order does NOT put the submit last
        // (proven at this desk 2026-11-15: an index-1 tap hit the
        // already-selected segment and the form never ran — the app's
        // trace shows no tap line at all). The submit is the "Sign in"
        // button BELOW the mode switch; pick it by geometry and say
        // so in the log.
        let switchFrame = app.segmentedControls.firstMatch.frame
        let signInMatches = app.buttons.matching(NSPredicate(format: "label == 'Sign in'"))
        var submit: XCUIElement?
        for i in 0..<signInMatches.count {
            let el = signInMatches.element(boundBy: i)
            print("SIGNIN-MATCH \(i): frame=\(el.frame)")
            if el.frame.minY > switchFrame.maxY { submit = el; break }
        }
        XCTAssertTrue(submit != nil, "Sign-in submit not found below the mode switch")
        submit!.tap()

        // Item 2: sign-in lands inside on its own.
        let landed2 = chatsTab.waitForExistence(timeout: 60)
        print("SIGNIN-LANDED-INSIDE: \(landed2)")
        XCTAssertTrue(landed2, "Item 2 fault: sign-in did not land inside")
    }

    // MARK: QA plan drive, batch 1 (this desk, plan order): the five
    // tabs stand; Profile carries identity only (Settings Law — a
    // setting row here is Not pass); Settings carries Theme, Language,
    // Notifications, Permissions, Privacy + the two bunny rows; the
    // item 8 theme save STANDS across a cold relaunch with no launch
    // argument (the stored pick rules, nothing forces it).
    func testDriveSurfaces() throws {
        let app = XCUIApplication()
        app.launch()

        let stamp = Int(Date().timeIntervalSince1970)
        let email = "projects.reports.ilse+cs29d\(stamp)@gmail.com"
        // Normalise the start state: the simulator keychain survives
        // uninstalls (proven at this desk 2026-11-15), so the app may
        // launch already signed in. If it did, sign out first so the
        // drive starts at the door like a fresh user.
        if app.tabBars.buttons["Chats"].waitForExistence(timeout: 10) {
            app.tabBars.buttons["Profile"].tap()
            let out = app.buttons["Sign out"]
            XCTAssertTrue(out.waitForExistence(timeout: 15), "Signed-in start: Sign out missing")
            out.tap()
            let confirm = app.sheets.buttons["Sign out"]
            XCTAssertTrue(confirm.waitForExistence(timeout: 10))
            confirm.tap()
        }
        let doorLink = app.buttons["Use email instead"]
        XCTAssertTrue(doorLink.waitForExistence(timeout: 60), "Door did not stand")
        doorLink.tap()
        let familyPick = app.buttons["Family"]
        XCTAssertTrue(familyPick.waitForExistence(timeout: 30), "Who-are-you pick did not stand")
        familyPick.tap()
        let nameField = app.textFields["Your name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 15))
        nameField.tap(); nameField.typeText("Drive Tester")
        let emailField = app.textFields["Email"]
        emailField.tap(); emailField.typeText(email)
        let pwField = app.secureTextFields["Password"]
        pwField.tap(); pwField.typeText("TraceTest29!")
        app.buttons["Create my account"].tap()
        let chatsTab = app.tabBars.buttons["Chats"]
        XCTAssertTrue(chatsTab.waitForExistence(timeout: 60), "Drive sign-up did not land inside")

        // The five tabs of record stand.
        for tab in ["Chats", "Calendar", "Care", "Activities", "Profile"] {
            XCTAssertTrue(app.tabBars.buttons[tab].exists, "Tab missing: \(tab)")
        }
        print("DRIVE-TABS-OK: true")

        // Profile: identity only. RowLink is a NavigationLink whose
        // accessibility label composes title + subtitle, so rows are
        // matched by label prefix, never by exact title.
        func row(_ title: String) -> XCUIElement {
            app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
        }
        app.tabBars.buttons["Profile"].tap()
        XCTAssertTrue(row("Join the AI kindness revolution").waitForExistence(timeout: 15), "Kindness row missing (must stand FIRST)")
        XCTAssertTrue(row("Your name").exists, "Your name row missing")
        XCTAssertTrue(row("Care Team").exists, "Care Team row missing")
        XCTAssertTrue(row("Settings").exists, "Settings row missing")
        XCTAssertTrue(app.buttons["Sign out"].exists, "Sign out missing")
        XCTAssertFalse(app.buttons["Theme"].exists, "SETTINGS LAW: Theme picker stands in Profile")
        XCTAssertFalse(app.staticTexts["Calm bunny"].exists, "SETTINGS LAW: Calm bunny stands in Profile")
        print("DRIVE-PROFILE-OK: true")

        // Settings: the whole surface stands here, and only here.
        row("Settings").tap()
        let themeHead = app.buttons["Theme"]
        XCTAssertTrue(themeHead.waitForExistence(timeout: 15), "Theme picker missing in Settings")
        XCTAssertTrue(row("Language").exists, "Language row missing in Settings")
        XCTAssertTrue(row("Notifications").exists, "Notifications row missing in Settings")
        XCTAssertTrue(row("Permissions").exists, "Permissions row missing in Settings")
        XCTAssertTrue(row("Privacy").exists, "Privacy row missing in Settings")
        if !app.staticTexts["Calm bunny"].exists { app.swipeUp() }
        XCTAssertTrue(app.staticTexts["Calm bunny"].waitForExistence(timeout: 10), "Calm bunny missing in Settings")
        XCTAssertTrue(app.staticTexts["Less movement on screens with the bunny."].exists, "Less movement row missing in Settings")
        print("DRIVE-SETTINGS-OK: true")

        // Item 8: pick Dark, cold relaunch with NO launch argument —
        // the stored pick must rule.
        themeHead.tap()
        let darkPick = app.buttons["Dark"]
        XCTAssertTrue(darkPick.waitForExistence(timeout: 10), "Dark theme pick missing")
        darkPick.tap()
        Thread.sleep(forTimeInterval: 1.0)
        print("THEME-VALUE-AFTER-PICK: \(themeHead.value as? String ?? "nil")")
        app.terminate()
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["Chats"].waitForExistence(timeout: 60), "Relaunch did not land inside")
        app.tabBars.buttons["Profile"].tap()
        XCTAssertTrue(row("Settings").waitForExistence(timeout: 15))
        row("Settings").tap()
        let themeHead2 = app.buttons["Theme"]
        XCTAssertTrue(themeHead2.waitForExistence(timeout: 15), "Theme picker missing after relaunch")
        let stands = (themeHead2.value as? String) == "Dark"
        print("THEME-SAVE-STANDS: \(stands) value=\(themeHead2.value as? String ?? "nil")")
        XCTAssertTrue(stands, "Item 8 fault: theme save did not stand across relaunch")
    }
}
