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
}
