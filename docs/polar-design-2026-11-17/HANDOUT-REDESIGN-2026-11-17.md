# ⛔ HELD — DO NOT START (2026-11-17 14:57–14:59: Ilse rejected this design
# package and ordered a redo. This handout is re-issued against the new package
# before any Polar start. Held at the CareSpace Boss desk; nothing was sent.)

# HANDOUT FOR POLAR — CareSpace, the new design build

Skill picks for this job: local-swiftui-pro first, then local-swift-concurrency,
local-code-review-and-quality, local-hig42-design (the brand rules in this pack win
over it every time), local-xcode-build-orchestrator, local-swift-testing-pro,
local-xcuitest, local-test-evidence-integrity, local-like-for-like-verification,
local-design-fidelity, local-ci-cd-and-automation.

Hello Polar. Ilse fired this build herself. Her words: "No stopping, give it all
access and passwords it needs like TestFlight and GitHub repo, also all skills and
knowledge until it's the best at making apps, testing, human psychology, design,
etc EVERYTHING NEEDED FOR AN APP END TO END."

So: no stopping. You build CareSpace again in its new design, from the latest
build, all the way to done. Find the best way possible yourself and do it that
way. If a way fails twice, drop it and find a better way. Never a third try on
the same wall.

## How to think
- The design HTML in the pack is the picture of the finished app. Build what it
  shows, screen by screen.
- Where the design and the hard rules below fight, the hard rules win. They are
  Ilse's own words from before. The pack file CLASH-CHECK.md lists every fight
  and who wins.
- One small step at a time. Build one screen or one flow. Test it. See it work.
  Then the next one.
- Done means it works like the design says, on a real run, with proof. Not
  "the code looks right".

## Hard rules (Ilse's words — they beat the design where they fight)
1. This app is NATIVE SwiftUI. The design file has one line about React and
   Capacitor. That line is not for this app. Never rebuild the app in another
   stack.
2. Colours: white ground, pink is queen. Words people must read go in Deep
   Raspberry #C2345B (light pink words on white cannot be read — Ilse rejected
   an app for exactly this). Normal words use ink #2D2A35. NO dark green words,
   ever — the design's green ink #1E4D44 does not go in the app. The blue and
   yellow helpers are the audited ones only: sky #B9D6EC, butter #F6D67C. The
   palette also holds Bunny Blush #F2C4CE. Fonts: Fraunces for titles (weight
   900 for the name and titles), Atkinson Hyperlegible for everything else.
3. The bunny, the logo, the icon and the opening picture are LOCKED art. Use
   the master files exactly as they are. Never draw a new bunny. Never stretch
   or bend the bunny pictures. Nothing sits on top of the bunny.
4. The first screen asks: Are you Family or Carer? Then the sign-in page, in
   this exact shape: Google first, Apple second, ONE small "Use email instead"
   line. Email has its own page. If a person cancels Google or Apple, the app
   just goes back quietly — never a red error line.
5. Sign-up asks the person's own name and saves it. The app greets people by
   their own saved name only.
6. Every setting lives in Settings — look, bunny, themes, language, notices,
   permissions, privacy. Never in the account or profile pages. White is the
   default look; a changed look stays changed after the app restarts; dark
   look is true black.
7. A child's health is three separate records: allergies, medication,
   emergency. Parents control them. A carer can add a note with a time on it;
   a carer can never change a health fact.
8. The AI Kindness page stays. It is its own menu item, first in its menu,
   exactly as the last build has it. The new design forgot it. Ilse did not.
9. Sliding back goes to the page before, on every screen. No emojis anywhere
   in the app. Plain Australian English, short kind sentences.
10. Do NOT change the build number or version stamp. The ship step sets it.
11. One thing is known broken and it is NOT yours to fix: deleting an account
    inside the app cannot finish on the server yet, because a server piece is
    waiting on Ilse's billing tap. Keep the in-app delete exactly as the last
    build has it, note it in your report, and keep building. It does not stop
    this build.

## Access
Ilse gave full access for this build: the GitHub repo, TestFlight, the works.
Work in the repo support897/caresits, branch carespace-29. If you hit a wall
that needs a login or a password, do not stop — write ONE line about the wall
in your work note and keep going on everything else; the Boss clears walls the
same day.

## Setup — read first, proof first
Pull the newest carespace-29. In the folder native-carespace/redesign-pack/
you find: HANDOUT.md (this page), CareSpace-Design.html (the design),
Brand-Board.html, HER-RULINGS.md (Ilse's rules), BRAND-OF-RECORD.md,
CLASH-CHECK.md (every fight between the design and her rules, and who wins),
JOURNEY-PLAN.md (the whole customer journey the tests must walk).
Your FIRST work note names those files and their fingerprints (md5) from your
own read. No read proof, no build — the checkers refuse work without it.
The app you start from is the tree at commit edb8609 (the pack commit sits on
top of it; the app code is unchanged from the last build).

## The job — the loop
1. Build the new design into the app, one screen or flow at a time, in the
   design's order: first launch and the role ask, the door, make a space /
   join a space, home, family chat, roster, children, health, calendar,
   schedules, bookings and booking changes, meals, activities, chores,
   shopping, photos, daily reports, notifications, permissions, settings —
   family side (24 screens) and carer side (22 screens).
2. After each piece, test it and keep the proof.
3. Grow the test suite (CareSpaceFlowTests) so it walks the whole
   JOURNEY-PLAN, both sides, end to end. Run ALL the tests, old and new. The
   cloud lane is the carespace-ci.yml workflow; a run on the main computer's
   simulator is fine too — show the proof either way.
4. Push your work to carespace-29 often, in small commits. Never merge into
   main.
5. Keep going until every screen matches the design (with the hard rules
   winning their fights), every test passes, and the whole journey walks
   clean. Fix what the tests find and run them again. That loop is the job.

## Your finish report
When it is all done, write CARESPACE-REDESIGN-FINISH.md in the repo and say so
in your last work note:
- Screen by screen: SAME AS DESIGN / DIFFERENT BY ILSE'S RULE (name the rule) /
  NOT DONE YET. Nothing hides in "mostly done".
- The test runs: which lane, the result file names, pass or not pass for each
  journey leg.
- The delete-account note from rule 11, in one line.
- Anything you could not do, in plain words, with what you tried.
Then the Boss runs the checker gates on your exact final commit and ships it
to TestFlight. Your job ends at a pushed, tested, honestly reported build.
