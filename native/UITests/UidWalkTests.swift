import XCTest

// Shared helpers for the build-178 proof walks, copied from RoleFlowTests
// (which is final and cannot be subclassed). Proof-only; never ships.
class CSProofBase: XCTestCase {
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
    func dismissKb() { let t = app.staticTexts["onbTitle"]; if t.exists { t.tap() } }
    func next() { let t = app.staticTexts["onbTitle"]; let before = t.exists ? t.label : ""; tap("Next"); sleep(2); if t.exists && t.label == before { tap("Next"); sleep(2) } }
    func fillYou(_ name: String) {
        type(app.textFields["Your name"], name)
        type(app.textFields["Postcode"], "4005"); dismissKb()
        type(app.textFields["Suburb"], "New Farm")
        dismissKb()
    }
    func signOutIfInside() {
        if app.tabBars.buttons["Me"].waitForExistence(timeout: 5) {
            app.tabBars.buttons["Me"].tap()
            let so = app.buttons["Sign out"]
            for _ in 0..<6 where !so.isHittable { app.swipeUp() }
            so.tap(); sleep(2)
        }
    }
    func finishOnboarding() {
        fillYou("Door Proof"); next(); next()
        type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 90), "inside after onboarding")
    }
}

// Commission one (QA, build 178): ONE fresh expendable account whose uid is
// captured BEFORE deletion. Credentials arrive via TEST_RUNNER_ env so the
// shell can read the uid from the account's own record by email between the
// two methods. Proof-only; never ships.
final class UidWalkTests: CSProofBase {
    var uidEmail: String { ProcessInfo.processInfo.environment["CS_UID_EMAIL"] ?? "" }
    var uidPw: String { ProcessInfo.processInfo.environment["CS_UID_PW"] ?? "" }

    func testA_createAndOnboard() {
        XCTAssertFalse(uidEmail.isEmpty, "CS_UID_EMAIL not set")
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        // Leftover state from the first attempt: the account was created and
        // the session sits at the role pick. Carry on from there.
        if app.buttons["I need care"].waitForExistence(timeout: 3) && !app.buttons["Use email"].exists {
            tap("I need care")
            let nf = app.textFields["Your name"]
            XCTAssertTrue(nf.waitForExistence(timeout: 25), "onboarding name step reached from role pick")
            fillYou("Del Proof"); next(); next()
            type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
            tap("Finish", timeout: 20)
            XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 90), "inside after onboarding")
            print("UIDWALK created email: \(uidEmail)")
            shot("uid-1-inside")
            return
        }
        tap("Use email")
        type(app.textFields["Email"], uidEmail)
        type(app.secureTextFields["Password (6+ letters)"], uidPw)
        tap("Create my account")
        let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for _ in 0..<8 { if sb.buttons["Not Now"].waitForExistence(timeout: 2) { sb.buttons["Not Now"].tap(); break }; if app.buttons["Not Now"].exists { app.buttons["Not Now"].tap(); break } }
        tap("I need care", timeout: 30)
        let nameField = app.textFields["Your name"]
        if !nameField.waitForExistence(timeout: 12) {
            let again = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "I need care")).firstMatch
            if again.exists { again.tap() }
        }
        if !nameField.waitForExistence(timeout: 25) {
            print("UIDWALK screen dump: " + app.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " | ") + " || Buttons: " + app.buttons.allElementsBoundByIndex.map { $0.label }.joined(separator: " | "))
            shot("uid-0-stuck")
        }
        XCTAssertTrue(nameField.exists, "onboarding name step reached")
        fillYou("Del Proof"); next(); next()
        type(app.textFields["Name or nickname"], "Mia"); dismissKb(); next()
        tap("Finish", timeout: 20)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 90), "inside after onboarding")
        print("UIDWALK created email: \(uidEmail)")
        shot("uid-1-inside")
    }

    func testB_deleteAndReportMoment() {
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 30), "saved login lands inside")
        app.tabBars.buttons["Me"].tap()
        let del = app.buttons["Delete my account"]
        for _ in 0..<6 where !del.isHittable { app.swipeUp() }
        del.tap(); tap("Delete everything")
        // The app re-authenticates before deleting: "Is it really you?"
        let pwField = app.secureTextFields["Your password"]
        XCTAssertTrue(pwField.waitForExistence(timeout: 20), "reauth sheet shows")
        // The sheet's secure field drops characters from fast typing:
        // clear, type character by character, and only proceed when the
        // masked length equals the full password length.
        func pwLen() -> Int { (pwField.value as? String)?.count ?? 0 }
        pwField.tap(); sleep(1)
        var ok = false
        for _ in 0..<3 where !ok {
            if pwLen() > 0 { pwField.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: pwLen() + 4)) }
            for ch in uidPw { pwField.typeText(String(ch)); usleep(120_000) }
            sleep(1)
            ok = pwLen() == uidPw.count
            print("UIDWALK reauth pw length: \(pwLen()) of \(uidPw.count)")
        }
        XCTAssertTrue(ok, "reauth password typed in full")
        shot("uid-2-reauth")
        let confirm = app.buttons["Confirm and delete"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 10), "confirm and delete shows")
        confirm.tap()
        print("UIDWALK deleted epoch: \(Date().timeIntervalSince1970)")
        let door = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Use email")).firstMatch
        let landed = door.waitForExistence(timeout: 90)
        shot("uid-2-lands-on-sign-in")
        XCTAssertTrue(landed, "delete lands on the sign in door")
    }
}
