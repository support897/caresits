# Caresitters native - HANDOVER (build 176)

Base: build 175 tree (local commit 035fe96; same bytes as e45e1ba per the pack, e45e1ba itself was not cloned on this Mac).
Build 176 = base + items 11-16. TestFlight only. Never submitted to App Review.

## What changed
- 11 Photo 422. Cause: live worker (mono/src/files-worker/worker.mjs, PUT /put) refuses any JPEG with an Exif APP1 block (422 "exif"). iOS jpegData adds one. Fix: Backend.swift Media.prepare renders sRGB, re-encodes, then stripMetadata removes APP1-APP15 and COM. Upload via uploadPrepared (+ tolerant /v1/confirm). Preview now built from the prepared bytes. Strip stays on every upload.
- 12 Visible labels above name, postcode, suburb: FamilyViews.swift LabeledField, used by OnboardingView.
- 13 Family step skippable (Skip for now). Notice links "Me -> My family" (opens the screen). Banner in DiscoverView, editor in MeView (FamilyEditor).
- 14 Bunny: Bunny.swift, 7 moods, idle motion, reduced-motion and "Turn the bunny down" setting. bunny.png unchanged.
- 15 MeView: rate and years shown only when > 0.
- 16 Icon Law: BrandIcon.swift (40 drawn icons). No emoji or SF Symbols in Sources. Only text arrows "Me -> My family" remain (asked for by item 13).
- Theme: light colour scheme forced at app root.
- genproj.py: version 176, DEBUG condition so debug-only proof code works.

## Proof (simulator, not a real phone)
See pictures-b176/photo-proof-report.txt. Old path: 422 exif. New path: saved, served bytes have no Exif/GPS, identical to prepared, decodes. JPEG and HEIC both. Real-phone check still needs Ilse.

## Tests
rt176.sh <Test|ALL>. All 11 UI tests pass (au pair and skip tests needed a longer delete wait; flaky on slow delete).

## Open for Ilse
Logo pick (shipped mark 2891222f vs A/B), chat-before-booking, delete ~40 leftover test profiles.
Delete the GitHub token polar-caresits-push.

## Build 177
1. Chat photos on the strip route (Backend.sendPhoto, gallery folder, metadata stripped). Proof in pictures-b177.
2. White, cleaner design pass: flat hairline cards, fewer words, shorter empty states. Before and after in pictures-b177/before and after.
3. Swipe deck home: match percent, distance, radius, map, Message and Send resume on the card. Nanny home is now the deck (Today retired). Send resume proof from the carer side did not pass in the UI test.
4. Logo options proposed only, not in the app.
5. Bunny sparkle badge moved and resized (Bunny.swift). Shot in pictures-b177/bunny.
6. Delete shows a busy screen, a slow line after 10 s, a plain timeout after 60 s. Proof in pictures-b177/delete.
