import XCTest

// Commission two (QA, build 178): the device door pass, one walk per door.
// Accounts are fresh nat-scheme tester accounts made inside each walk.
// Proof-only; never ships. Helpers come from CSProofBase (UidWalkTests.swift).
final class DoorPass178Tests: CSProofBase {
    var epoch: Int { Int(Date().timeIntervalSince1970) }

    func freshCreds(_ tag: String) -> (String, String) {
        let e = epoch
        return ("projects.reports.ilse+nat\(tag)\(e)@gmail.com", "Nat-\(e)-Zq9")
    }

    func createAccount(email: String, pw: String) {
        tap("Use email")
        type(app.textFields["Email"], email)
        type(app.secureTextFields["Password (6+ letters)"], pw)
        tap("Create my account")
        let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for _ in 0..<8 { if sb.buttons["Not Now"].waitForExistence(timeout: 2) { sb.buttons["Not Now"].tap(); break }; if app.buttons["Not Now"].exists { app.buttons["Not Now"].tap(); break } }
        tap("I need care", timeout: 30)
        XCTAssertTrue(app.textFields["Your name"].waitForExistence(timeout: 25), "first-run onboarding stands")
    }

    func signIn(email: String, pw: String) {
        tap("Use email")
        if app.buttons["I already have an account"].exists { app.buttons["I already have an account"].tap(); sleep(1) }
        type(app.textFields["Email"], email)
        type(app.secureTextFields["Password (6+ letters)"], pw)
        tap("Sign in")
    }

    func testDoorA_EmailSignUp() {
        let (email, pw) = freshCreds("door")
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        createAccount(email: email, pw: pw)
        shot("door-email-signup-first-run")
        finishOnboarding()
        shot("door-email-signup-inside")
        print("DOORPASS signup email: \(email)")
    }

    func testDoorB_EmailSignIn() {
        let (email, pw) = freshCreds("back")
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        createAccount(email: email, pw: pw)
        finishOnboarding()
        signOutIfInside()
        XCTAssertTrue(app.buttons["Use email"].waitForExistence(timeout: 15), "back on the door after sign out")
        signIn(email: email, pw: pw)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 60), "sign in returns inside")
        app.tabBars.buttons["Me"].tap(); sleep(2)
        shot("door-email-signin-own-data")
        print("DOORPASS signin email: \(email)")
    }

    func testDoorC_GoogleWalk() {
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        let g = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Google")).firstMatch
        XCTAssertTrue(g.waitForExistence(timeout: 20), "Google button stands on the door")
        g.tap(); sleep(4)
        shot("door-google")
        let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let page = sb.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "google")).firstMatch
        print("DOORPASS google page visible: \(page.waitForExistence(timeout: 10))")
        if sb.buttons["Cancel"].exists { sb.buttons["Cancel"].tap(); sleep(2) }
    }

    func testDoorD_AppleWalk() {
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        let a = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Apple")).firstMatch
        XCTAssertTrue(a.waitForExistence(timeout: 20), "Apple button stands on the door")
        a.tap(); sleep(4)
        shot("door-apple")
        let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let page = sb.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "Apple")).firstMatch
        print("DOORPASS apple sheet visible: \(page.waitForExistence(timeout: 10))")
        if sb.buttons["Cancel"].exists { sb.buttons["Cancel"].tap(); sleep(2) }
    }

    func testDoorE_SavedLogin() {
        let (email, pw) = freshCreds("stay")
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
        signOutIfInside()
        createAccount(email: email, pw: pw)
        finishOnboarding()
        signOutIfInside()
        signIn(email: email, pw: pw)
        XCTAssertTrue(app.tabBars.buttons["Me"].waitForExistence(timeout: 60), "signed in before kill")
        app.terminate(); sleep(2)
        app.launch()
        let inside = app.tabBars.buttons["Me"].waitForExistence(timeout: 30)
        let doorShown = app.buttons["Use email"].exists
        shot("door-saved-login-relaunch")
        XCTAssertTrue(inside && !doorShown, "relaunch lands inside, not on the door")
        print("DOORPASS savedlogin email: \(email)")
    }
}
