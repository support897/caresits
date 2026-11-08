# Caresitters native (SwiftUI)

Bundle id `com.ilse.caresits`, version 1.0.0, **build 175**. TestFlight only. See `../HANDOVER.md` for what changed, test results and open items.

## Build
1. Copy your own `GoogleService-Info.plist` into this folder (never committed).
2. `python3 genproj.py` writes `Caresitters.xcodeproj` from `Sources/`, `UITests/` and `Assets.xcassets/`.
3. Build the `Caresitters` scheme.

## Layout
`Sources/` app, `UITests/RoleFlowTests.swift` simulator tests, `Assets.xcassets/` icon, logo, bunny (exact shipped bytes), `design-pictures/` the seven tour pictures, `../e2e/native/native-flow.mjs` rules replay.
