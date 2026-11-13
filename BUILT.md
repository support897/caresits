# Build 181 (branch build-181, base build-180 head 1bba116). Not pushed.

## What the tree holds now
- Item 1, Settings law (f410c85, on GitHub): Sources/SettingsView.swift holds the Look pick and the bunny volume toggle. MeView keeps the person only and has a Settings row.
- Item 2, the asking (code done, pictured and relaunch proven both sides, see Proofs):
  - Sources/AskingView.swift. Family: What type of care are you looking for, Your ideal candidate. Carer: What type of care work are you looking for, Your ideal family. Both sides then carry an Au pair section, mirrored (the family offers, the au pair looks for). Icon picks only, one tap ticks, no typing. Every pick stands on both sides as a pair on the same key. Opened from Me, What I am asking for.
  - Sources/BrandIcon.swift: 22 new designed icons (balloon, calm, gentle, firm, tree, blocks, ruler, bend, dance, licence, pot, cpr, cap, door, bath, shower, plate, weekend, suitcase, flag, loop, bus). Every pick has its own icon.
  - Sources/Answers.swift (AnswerStore): the coded first aid document and the device store.
  - The old question flow (QuestionBank, its generator, the 50 question sheet) is removed by her ruling.
  - native/tools/rt181.sh runs one UI test. UITests/RoleFlowTests.swift has testAskingFamily and testAskingCarer.
- Item 9 folds into item 2. Item 12 and items 13 to 24 are cancelled; the tab layout stays.

## Where each pick is saved
1. Card keys, profiles/{uid}.card[key] (all inside the sealed card key list): personality (Calm, Playful, Gentle, Firm, Outdoorsy, Musical), routineStyle (Montessori, Strict, Flexible), activities (Dancing, Swimming), languages (the Which one picker), tasks (Homework help), drives (Driving licence), ownCar, cooking, pets (family, Pets at home), petsOk (carer, Fine with pets), payOffered (family) and payFloor (au pair) for the Pocket money weekly amount pick. Lists are [String], the rest bool, pay a number. Unticking deletes the key.
2. Coded: First aid rides its pair, profiles/{uid}/answers/F21 (family) and C22 (carer). Keys only bucket, v, s, feed.
3. DEVICE ONLY (UserDefaults), no sealed home, EXCLUDED from scoring until a rules amendment is sealed: CPR, Education, and the au pair living picks (own room, own bathroom, shared bathroom, full board, weekly hours, days off, weekend off a month, paid holiday, stay length, start window, duties in writing, use of car, phone help, flexible hours, completion bonus, language course help, transport help).
No key and no code is invented.

## Reading I made (HQ to confirm)
- Pocket money is the only weekly amount pick, so it is the pick that carries payOffered and payFloor. If those keys were meant for something else, say so.
- Pets: family writes pets, carer writes petsOk.

## Proofs on the packaged simulator build (iPhone 18 Pro)
- Family and carer each: signed up, opened What I am asking for, ticked Dancing, Pets, Languages (Spanish), Calm, Driving licence, First aid, CPR, Own room, Pocket money ($150), pictured every screen top to bottom (12 pages a side, au pair section on both), relaunched the app, and every pick read back ticked. Card key picks and first aid come only from the account on relaunch; CPR and Own room only from the device. Pictures in ~/cs181/pics-fam and ~/cs181/pics-car, result-family.txt and result-carer.txt.
- Not proven: the end of each run (delete my account) failed its last check on both sides, so two test accounts may remain on Firebase. A direct owner read of the stored card and the F21 and C22 documents was not run; the relaunch read back is the evidence.
- Icon change after the pictures: Outdoorsy (tree) and Firm were redrawn and Language course help now uses the chat icon. Compiled, not re-pictured.

## Gaps
- The native deck does not read these picks. Matching engine untouched.
- Some picks are paired by key, not by a score yet.
- Items 3 to 11, the new Reviews item and the new Essential notifications item are not started.
- ESSENTIAL NOTIFICATIONS (queued after Reviews): the app side registration stands from the push design of record (Security pass, 17 Oct): device docs under the profile, kind only payloads with no names and no message text, opt out in three layers. The OUTBOUND SENDER half waits on the Blaze upgrade and her APNs key; nothing is built around that. Live delivery is NOT PROVEN until the sender lands.
- The Mac load average is 500 to 800, so each side takes 10 to 15 minutes.

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
