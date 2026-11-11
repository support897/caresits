# CareSpace native (Swift + SwiftUI)

Bundle id `com.ilse.carespace`, version 1.0.0, **next build 26** (TestFlight
only, never sent to App Review without Ilse's approval).
Display name: **CareSpace** — only CareSpace, everywhere (Ilse's ruling,
11 Nov 2026).

## Status (honest)
Phase 1 scaffold, written 2026-11-11 by the CareSpace Boss desk on the
Caresitters native pattern. NOT yet compiled — the first compile happens
on the Polar build seat. Nothing here is "done" until it builds, walks
and passes the gates on the exact build.

## What is here
- `Sources/Theme.swift` — brand tokens (match Caresitters exactly) +
  the four themes (light/white default, dark, beige, brand), picker-ready,
  pick saved on device and on the profile so it survives restore.
- `Sources/DoorView.swift` — DOOR LAW new shape: first page shows only
  Apple, Google and one small "Use email instead" button; drawn Google G;
  the current mark drawn in code until Ilse picks a logo-redo concept.
- `Sources/EmailDoorView.swift` — email on its OWN page; sign-up asks the
  user's name and saves it to their own profile; sign-in never creates
  an account. `NameAskView` for Google/Apple first sign-ins.
- `Sources/Session.swift` — Firebase Auth (same project as Caresitters),
  Google + Apple + email; the saved name is the only greeting source.
- `Sources/Backend.swift` — profile name/theme on `profiles/{uid}`;
  care data lives under `careSpaces/{spaceId}` (Phase 2+).
- `Sources/CareSpaceApp.swift` — root gate + five tabs, each with its own
  navigation stack; the swipe-back gesture is never disabled (swipe law).
- `Sources/BunnyView.swift` — the bunny as layered SwiftUI shapes, hello
  mood v1, calm setting stills it. Full 7-mood set lands in Phase 4.
- `Info.plist` (display name CareSpace), `App.entitlements` (Apple sign-in).

## What is NOT here yet
- Xcode project generator + Assets (app icon PNGs from the approved mark,
  bunny/logo images, GoogleService-Info.plist — never committed): Polar seat.
- Phase 2 screens (Today, Chats, Calendar, Care, daily report; medical as
  separate allergy/medication/emergency records), Phase 3 (team, push,
  offline, delete proof), Phase 4 (luxurious icon set, full bunny moods,
  7 languages + RTL), Phase 5 gates on the exact build.

## Laws riding this build
Door new shape · swipe back everywhere · four themes, white default ·
per-user name ask, greetings use the user's own saved name · no reference
to Ilse in any user surface · no emojis · luxurious designed icons ·
name is CareSpace only · TestFlight only.
