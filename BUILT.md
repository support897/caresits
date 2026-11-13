# Build 180 (from 179 head 32028ed)

Four fixes. Nothing else touched.

1. F-179-1 Use email after the Apple flow. The email page was a full screen cover that could stay stuck after the system Apple alert. It is now shown inline by the door (WelcomeView.swift), so there is no cover to get stuck. Test testDoorAfterApple: Apple flow dismissed, Use email, email page opens, twice. Passed alone twice (80 s run, earlier 67 s run).
2. F-179-2 Skip for now removed from the onboarding name step only (OnboardingView.swift). Empty name is blocked, the name stands on Me. testSkipFamilyAndLabels rewritten for this.
3. F-179-3 Opening renders. RootGate holds the splash (bunny, Caresitters, Find care. Share the day.) for 2.2 s before the door, then fades. Design unchanged. Proof: pictures-b180/opening/cold-launch-180.mov and opening-strip-180.png.
4. Clean door after Apple. runApple returns quietly on any failure or cancel. No raw system text is ever shown; other failures say "Could not sign in. Please try again." testDoorAfterApple asserts the door text is exactly Caresitters, G, Continue with Google, Use email.

Also: build number 180. testDeleteTimeout now waits for the tab bar after relaunch (test only).

## Tests
Full suite on the final tree: 17 of 20 passed first time. Failed in the full run: testDeckCarer (Families button matched several elements), testDeleteTimeout (tapped Me before the tab bar existed), testDoorAfterApple (door did not appear; it ran right after the failed delete test). Each was rerun alone and passed (DoorAfterApple 80 s, DeckCarer 134 s, DeleteTimeout 290 s after the wait fix). Result bundles: ~/Apps/caresits-b180-suite.xcresult and .log, ~/Apps/caresits-b180-doorafterapple.xcresult.

## Honest gaps
- I never reproduced the stuck Use email button on the old 179 code on this simulator. The old code failed earlier on the raw error line. The cure is structural, and the proof is a pass after the change, not a fail before it.
- The Mac load average is about 90. A cold launch shows plain pink ground for about 19 to 23 s before the first app frame (dyld loading, outside app code). The opening then stands for 2.4 s. On a normal device this wait should not exist, but I could not prove that here. The device walk is still needed.
- A launch-screen image for the opening was tried and removed; it did not render.
- The carer-side label "Member" for a nameless profile (Models.swift:38) is unchanged and unproven. Body text plum #3A2E33 needs her eye.
- Flaky on this Mac: DeckCarer, DeleteTimeout, BabysitterApp, SwipeDeck.
- Nothing uploaded. Waiting for the upload word. TestFlight only.
