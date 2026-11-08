# Caresitters native (SwiftUI)

Bundle id `com.ilse.caresits`, version 1.0.0, **build 174** (TestFlight only, never sent to App Review).

## What is here
- `Sources/` all 13 Swift files of the app (Welcome sign up first, role pick, per-role tabs, swipe deck, calendar, bookings, messages, Me, resume reader, backend).
- `Info.plist`, `App.entitlements`.

## What is NOT here yet (be honest)
- `genproj.py` (Xcode project generator), `UITests/RoleFlowTests.swift`, `Assets.xcassets` (icons, logo, bunny PNGs) and `GoogleService-Info.plist` are not in this folder. The GitHub connector can only send text, so PNGs could not be pushed. `GoogleService-Info.plist` must never be committed.
- `e2e/native/native-flow.mjs` (rules replay) is in the local repo only.

## Tests run on the final code (simulator, live backend)
Family, Nanny, Babysitter, Au pair and swipe deck flows passed. Rules replay exited 0. The screenshot tour test (`testPictures`) failed once and was not investigated.

## Known gaps
No push notifications, no au pair map or visa help, English only, text-only chat, no payments, Google and Apple sign in not exercised on the simulator.
