# DESIGN PACKAGE PIN + CLASH-CHECK — CareSpace (2026-11-17, PREP step 1 of BUILD-CHAIN-PREP.md)

State: PINNED AS PREP. Nothing builds until her tap. On her approval tap this HTML
becomes the CareSpace HTML of record and the chain in BUILD-CHAIN-PREP.md fires.
Checked against HER-RULINGS.md print c0afe1ef + BRAND-OF-RECORD.md. All reads at this
desk's own hand, 2026-11-17 ~14:5x–15:0x AEST.

## THE PACKAGE (home: ~/workspace/nanny-app/design-package-2026-11-17/)
Verified md5s (first 8) + sizes, read at this desk — all match HQ's prints exactly:
- CareSpace design HTML — CareSpace_Final_Design_and_Screen_Atlas.html — 5ceb58fe — 58,661 B
- Brand board HTML — Caresitters_CareSpace_Refreshed_Brand_Board.html — 34bf7073 — 8,219 B
- CareSpace Family atlas — CareSpace_Family_Every_Screen_Visual_Atlas.png — 2a066e6e — 192,062 B
- CareSpace Carer atlas — CareSpace_Carer_Every_Screen_Visual_Atlas.png — 3941f8df — 177,775 B
- Brand board PNG — a_detailed_brand_style_board_app_design_system_a.png — 12a074ad — 1,885,535 B
(Caresitters-side files stand in the same folder — 4bc22d15, df5f2236, 5178d4ba — not this desk's pin.)

## SCREEN INVENTORY (counted in the file: 46 = Family 24 + Carer 22) — Pass
Family: First launch · Account · Create space · Home · Family chat · Roster · My children ·
Child details · Health · Calendar · Schedules · Bookings · Booking changes · Meals · Recipe ·
Activities · Activity details · Chores · Shopping · Photos · Daily reports · Notifications ·
Permissions · Settings.
Carer: First launch · Account · Join space · Family switcher · Home · Family chat · Roster ·
Assigned children · Child details · Health · Calendar · My schedule · Bookings · Time off ·
Meals · Activities · Chores · Shopping · Send a photo · Daily report · Notifications · Settings.
Plus per-role bottom navigation + side menu screens, and closing sections: Private family
space · Shared account and cross-app lifecycle · Implementation rules · QA acceptance.
Every item of her 14:29 order is present: white background, role ask first, cross-app
account, remember kids, activities, side menu with photo sending, meals/activities/chores
menus, changeable bookings, family chat (roster + kids + planned activities), changeable
schedules, permissions.

## SAME AS RECORD — Pass
- Palette — CORRECTED by the Correction Addendum at the end of this file (C4–C7):
  the design's nine values stand as printed in the board, but four of them clash with
  the shared brand record and do NOT ride the build. The verdict as first written
  ("nine values exact, Pass") is superseded by the addendum.
- Ink Green — CORRECTED by addendum C4: the HTML does keep #1E4D44 off surfaces
  (text ink + atlas scaffolding only) and dark mode is true black, but as THE copy
  colour it clashes with the record (ink of record #2D2A35, no dark green ever).
  The record governs the build.
- Fonts kept: Fraunces (titles) + Atkinson Hyperlegible (body) — no replacement.
- Name: CareSpace only. "Daily Care" appears 0 times in the HTML.
- Settings Law: Settings is its own screen in both roles (Family 24 / Carer 22) holding
  space settings, account, privacy, export, delete, accessibility, role switch.
  Notifications + Permissions are settings-area destinations in the side menu, not
  Profile items; the Account screen holds identity. Pass.
- Medical data law: parents control allergies, medication and emergency records;
  carers create timestamped observations and cannot alter authoritative medical facts.
  Matches the three-separate-records law exactly.
- Bunny: the board's own words rule that board art is a visual reference only and
  production reuses the master, never redraws it. Its seven named poses (hello, point,
  celebrate, encourage, oops, rest, think) match the seven locked poses of record.
  The locked masters govern the build (icon def559f1 · logo a4fa07a2 · door mark
  1aaa5ada · pose md5s in BRAND-OF-RECORD.md). Fence: pose/animate only within the
  standing art law — locked PNG art is never rigged or morphed.
- Icons: custom vector only, no emojis anywhere. Australian plain English, no fake
  urgency. Progress = real completed tasks, never parenting quality.
- Cross-app: one identity across Caresitters + CareSpace, shared Firebase Auth UID,
  authorised session handoff (never a token in an unprotected URL). Standalone
  CareSpace works without a marketplace booking. One canonical child record owned by
  the parent, referenced per space with explicit grants, restored without duplicates.
  Switching spaces isolates children, chat, calendar, photos and tasks; a carer picks
  the space before uploading a photo.

## DIFFERENT BY HER WORD (her instruction cited; stands on her approval tap)
- ROLE ASK BEFORE THE DOOR: the standing door law puts sign-in first (Google + Apple +
  one small email line). The design's First launch "must precede sign in on first use"
  ("Are you Family or Carer?" — two branded role cards). Covered by her 14:29 word:
  family-or-carer ask FIRST, everything adapts. The door's own composition law is
  untouched and governs the Account / sign-in screens at build.
- ORGANISATION: the new role-split structure (bottom navigation + side menu; 24 Family
  + 22 Carer screens) replaces brief c545b006 section 5's five-tab organisation.
  Covered by her 14:29 fresh-design order + her 14:45 chain order. On her tap this
  HTML becomes the CareSpace HTML of record; c545b006 retires to history for CareSpace.

## CLASH — NOT COVERED BY HER WORDS (filed; fences stand for the build)
- C1 · STACK LINE: the design's Implementation rules say "Retain React, TypeScript,
  Vite and Capacitor if supported by the current repo. Restore the missing monorepo
  shared core and config…" CareSpace of record is NATIVE SwiftUI (native-carespace/,
  base edb8609) and her chain order says build FROM THE LATEST BUILD; no word of hers
  orders a stack change. FENCE: the line reads as Caresitters/monorepo context only —
  for CareSpace its own condition fails (this app in the repo is native). The build
  stays native SwiftUI from edb8609. No builder may read this line as a rewrite order.
- C2 · KINDNESS GAP: "Kindness" appears 0 times in the CareSpace HTML. Build-29 scope
  of record (her 2026-11-14 word) carries the AI Kindness page as its own menu item
  FIRST, with the give flow (the give link still stands unwired — Stripe
  reauthorization is hers). Her 14:29 words never mention Kindness, so the design's
  silence does not drop it. FENCE: the Kindness page rides the new build from build-29
  scope unless she drops it herself. Named here so it cannot vanish silently; HQ may
  surface it at her approval tap.
- C3 · MARK WORDING (minor, no action): the board describes the CareSpace mark as the
  ear arch "with two message bubbles"; the mark of record carries the message bubble
  at its centre (masters: logo a4fa07a2, door mark 1aaa5ada). The board itself rules
  "use vector master assets", so the masters govern and the sentence changes nothing.
  Recorded so the build-time picture compare uses the master, not the sentence.

## HONEST GAP (ChatGPT's own words, carried openly)
The atlases are schematic layouts, not pixel-perfect mockups; the detail lives in the
HTML. Build-time picture compares therefore run against the HTML + the locked masters,
never against atlas pixels.

## STATE
Pin + clash-check filed as PREP (BUILD-LOG + CARESPACE-LEDGER, 2026-11-17). The
package stands shown to her by HQ with the build tap; her yes fires the prepped chain
(stamp floor 2611151236, re-read at fire time). Nothing has built.

## CORRECTION ADDENDUM — 2026-11-17, filed at fire time before the handout (bad news first)
This desk's first clash-check read the design's brand layer against the brand board's
own value list and HQ's summary, and passed the palette. That was the wrong source.
Checked against the SHARED brand record (the Caresitters desk's clash-check of the same
package, read whole at this desk; the shared HER-RULINGS; HQ's fencing ruling), the
brand layer clashes for CareSpace too. The structure verdicts stand; the palette Pass
is superseded by C4–C7 below. HQ's FENCING RULING governs the whole build: the chain
does not stop; the build is FENCED TO HER-RULINGS on every clash — the record governs
wherever the design drifts; NO clash is adopted without her explicit word (her fire
order named none of them). This desk's BRAND-OF-RECORD.md carried the same old-brief
residue (its §3 was the brief's tokens, Newsreader included); its ink + font lines are
corrected in place, dated today, pointing at the governing record.

- C4 · INK: the design sets Ink Green #1E4D44 as all copy (counted in both files).
  Record: no dark green ever; ink of record #2D2A35 (14 Nov colour evidence).
  FENCE: build copy colour is #2D2A35. #1E4D44 does not ride.
- C5 · CONTRAST FIX DROPPED: Deep Raspberry #C2345B appears 0 times in the design +
  board (counted at this desk). Her 15 Nov word put strong pink on every word that
  must be read (Bunny Pink on white measures 1.87:1 — the fault class behind her
  Caresitters 181 rejection). FENCE: titles, primary actions and must-read words use
  Deep Raspberry #C2345B; Fraunces 900 for the name and titles per the shared record.
- C6 · ACCENT HEXES: the design's Sky #DDEFF9 + Sun #FFF0BA are NEW values. Audited
  of record: sky #B9D6EC, butter #F6D67C. Their jobs are fenced right (small
  supporting details only); the values are not of record. FENCE: audited values ride.
- C7 · MISSING LOCKED PINK + GROUND: Bunny Blush #F2C4CE appears 0 times in the
  design palette (only two of the three locked pinks stand). Pale Pink Ground
  #FBEFF2 is also absent — white ground passes by her 14:29 word; the ground note
  rides the splash fence: the locked icon, logo and splash art of record are
  unchanged by this design. FENCE: Bunny Blush stands in the build palette.
- C8 · DOOR SHAPE (checked at this desk on the CareSpace Account screens): both
  roles read "Apple, Google, email and existing Caresitters session" on ONE screen,
  Apple first. Door law of record: Google first + Apple + ONE small "Use email
  instead" line; email on its own page; cancels return quietly, no error line.
  FENCE: the door keeps its locked shape inside the new look. The role ask before it
  stands by her 14:29 word (pin's "Different by her word" stands). The cross-app
  session recognition rides the shared-UID handoff — it is not a fourth door button.
- C9 · NAME STEP + THEMES (design silent; counted: "your name" 0, "theme" 0):
  FENCES: sign-up asks the user's own name and saves it (per-user name law — greetings
  use the signed-in user's own saved name only); CareSpace's theme set of record
  rides in Settings (white default, the pick survives restore, dark = true black).
- NOT CLASHES for CareSpace (differences from the Caresitters check, named so nobody
  cross-applies them): the seven bunny poses EXIST here as locked art of record
  (pose md5s in BRAND-OF-RECORD.md) — the pose fence is only the standing art law
  (never redrawn, never rigged or morphed, nothing overlaid). The Urgent board is a
  Caresitters feature; CareSpace has none and gains none. The mark's two-bubble
  wording matches this desk's locked direction (centre bubble + tiny answering
  bubble, 12 Nov) — masters still govern (C3 stands as written).

AMENDED VERDICT: structure Pass (46 screens, her whole 14:29 order); brand layer
fenced at C4–C7; door fenced at C8; gaps fenced at C9; stack fenced at C1; Kindness
fenced at C2. The chain fires fenced — no clash rides silently.

## FIRED — 2026-11-17 14:55, her word (main chat)
"No stopping, give it all access and passwords it needs like TestFlight and GitHub
repo, also all skills and knowledge until it's the best at making apps, testing,
human psychology, design, etc EVERYTHING NEEDED FOR AN APP END TO END."
Her tap fired the prepped chain. This pin + its correction addendum are the build's
clash record of record; the fences ride the handout into the build pack. On the
chain firing, this HTML (5ceb58fe) becomes the CareSpace HTML of record; c545b006
retires to history for CareSpace.

## HOLD + SUPERSESSION — 2026-11-17 14:57–14:59 (her correction burst)
She rejected this package ("stops looking ai", "I don't want latest green",
bunny stays her original, brand = a whole document, research first, way more
icons / dopamine / intuitive / step by step). HQ ordered a ChatGPT redo and both
Bosses HOLD the build at the handout/start stage. This pin's "FIRED" stamp above
is superseded by this hold: the HTML 5ceb58fe does NOT become the HTML of
record; the pack was never pushed and the handout was never sent. The fences
(C1–C9) stand and now carry two of her own explicit rulings (no green; native
Swift). On the redo package + her yes: re-pin fresh, refresh the read proof
(HER-RULINGS print moved by the burst filing), re-issue the handout, refire.
