# Caresitters handover: build 175 (9 Nov 2026)

## Repository state
Base commit before this build: e84667b602389218c5c3d0c0e5730b047b05f5f1 (build 174). Build 175 sources are the files in `native/`, `e2e/native/` and this file. The commit that carries them is the next commit on `main` (see `git log`). TestFlight only. Never sent to App Review.

## What changed (the ten items)
1. Repo push completed from the Mac files: genproj.py, UITests, Assets.xcassets with exact PNG bytes, e2e/native/native-flow.mjs. GoogleService-Info.plist is never committed; copy your own into native/ before building.
2. This file.
3. Me subtitle reads once: "Your family" (family) or "Nanny · Free for carers, always" (carers).
4. "⭐ n yrs" chip hidden when years is 0.
5. Headline line hidden when empty. Firestore: four demo profiles (Maria, Daniel, Chloe, Anna) had the headline "Test answer"; replaced with plain headlines. Only card.headline was changed.
6. Bottom space added so the last section clears the tab bar on the profile detail, Messages, Calendar, Requests, Today and Me.
7. Message and Send resume added (deck row and profile detail). Send resume shows for carers viewing families only. The chat rule is unchanged: chat opens after a booking is accepted, so before that the buttons say so and a family can go to Book. If Ilse wants chat before booking, that needs a rules change. Her call.
8. testPictures: cause was the iOS "Save Password?" sheet after account creation (the same fix existed only in signUp). Added the same dismissal to the tour. Tour passes. Picture 02 re-shot clean.
9. Bunny restored: bunny.png is Ilse's drawing, md5 22fd3985728c88182e1d870a6a6a8132, exact bytes. It has a white background (RGB, no alpha).
10. Logo: HOLD. Not touched.

## What was preserved
Metadata strip and Backend.swift photo prepare unchanged. Sign-up first. White look. Prices untouched.

## Testing evidence
- Full UI suite on the fixes (before the bunny swap): testAuPairApp, testBabysitterApp, testFamilyApp, testNannyApp, testPictures, testSwipeDeck all passed.
- After the bunny swap: testPictures re-run and passed (7 pictures re-shot). The other tests were not re-run for the asset-only change.
- Rules replay (native-flow.mjs): not re-run for build 175, no rules or backend change. Last run before 174 exited 0.
- Message and Send resume buttons: visible and compile; the send path was not exercised end to end (unverified).

## Known issues / open
- Message and Send resume depend on an accepted booking (see 7).
- Logo awaits Ilse: approve shipped mark, or pick option A or B.
- About 40 UI-test profiles ("Test ...", headline "Kind and calm care") still exist in Firestore and can show in the deck. Delete in the Firebase console when Ilse says.
- Google and Apple sign-in not exercised on the simulator.
- No push notifications, English only, text-only chat, no payments.

## External blockers
GitHub push needs the owner login (done by HQ from the Mac files). Old token `polar-caresits-push` should be deleted by the user.

## Deployment status
Build 175 (version 1.0.0, bundle com.ilse.caresits) uploaded, VALID, added to "Device Route QA". Ship script now signs embedded frameworks before export (build 174's first upload failed without it).

## Next action
Ilse tests build 175 on TestFlight and answers: logo pick, chat-before-booking yes/no.
