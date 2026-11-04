 
 Caresitters and CareSpace: build brief 
 Caresitters and CareSpace
 Build brief for the AI that builds both apps. Tap the bunny: this is the kind of constant, gentle motion it needs everywhere.
 0 of 0 steps done Your ticks save on this device 
 Copy the whole brief Open all Clear ticks 
 1. Your mission and the rules 
 Rebuild and extend the existing app (repo build 143, caresits ). It is not a blank page. Make two connected apps on one account system and one backend: Caresitters (find care) and CareSpace (run the care day). Both must feel like the best childcare apps anyone has used.
 Never break these: (1) A carer is shown as verified only when a real check happened. (2) AI writes words and suggests; it never decides safety, allergies or who is qualified. (3) Carers pay nothing, ever. (4) No fake scarcity, no manipulative notifications. (5) Children’s data is private by default and shared only by a parent.
 Working names live in one place ( brand.js ): APP1="Caresitters" , APP2="CareSpace" . The CareSpace name has an unresolved trademark risk, so never hard-code it in strings, images or file names.
 Ask the owner (Ilse) before any large visual change the brief does not already approve. Approved: new logo with stronger contrast, animated bunny, same palette and fonts.
 2. What exists today (audit of build 143) 
 About 22k lines in app2/ , 23 test files ( *-tests.mjs ), English plus six languages: Spanish, Arabic, Hindi, Vietnamese, Cantonese, Mandarin (Arabic needs right-to-left).
 Firebase Auth (Google, Apple, email and password), Firestore rules in accounts/ , files through a Cloudflare R2 gatekeeper ( files-gatekeeper/ ), payments through RevenueCat ( payments-receiver/ , plans.js , prices.js ).
 Already built: door and role pick ( door.* ), questionnaire ( journey.js ), Find, Matches, Urgent board, Children, Day Story, Calendar, Roster, Timesheet, Emergency, Recently Deleted, trust and checks ( trust.js ), activities, shopping, au pair map ( world.js , countries.js ), a bunny tour ( tour.js ).
 Today everything is one app with three “sides” (family, career, communicate) and a Finding or Connected mode switch ( mode.js , shell.js ).
 Problems to fix
 Name split: “Caresits” in README and manifest, “Caresitters” in the UI. Use Caresitters everywhere. Keep existing caresits-* storage keys, or migrate them, so no user loses data.
 Logo: icon.svg is cream figures on a tan heart on a beige square. Contrast is weak at app-icon size.
 Bunny: seven still PNGs ( app2/bunny/ ). Six have opaque white backgrounds; only hello is transparent. Nothing moves.
 One menu for everything: a long side drawer holds Find, Children, Roster and Calendar together. Marketplace and daily care need separate homes.
 Market notes
 Australian rivals include Sittr, Juggle Street, Babysits and Bubble, plus Care.com. Reviews complain about costly subscriptions, unclear background checks and high sitter commissions. Answer these openly in the product: free for carers, visible check status, plain prices.
 3. Brand: keep the look, fix three things 
 The palette and fonts are already right. Keep them as tokens.
 Ink green #1E4D44 Cream #FDF8F0 Sage #9CC5B5 Blush #F6CBD3 Bunny pink #F4A9BC 
 Fonts: Newsreader for headlines, Atkinson Hyperlegible for body (both are in /fonts ). Add a dark theme using the same hues. Minimum body text 17px; contrast 4.5:1.
 Logo
 Keep the idea: a heart holding a carer and a child. Redraw as a bold single-colour shape, ink green heart with cream figures on a blush tile. Produce SVG plus 1024 app-icon, adaptive Android icon, favicon and a one-colour version. It must read at 29px. Show the owner two options before shipping.
 The bunny (the memorable thing)
 Keep the character: pink, heart on the belly, soft ears. Build one component, bunny.js , as a layered vector (Rive or Lottie, or SVG with CSS), transparent background, under 60 KB, with a mood API: bunny.set("hello"|"point"|"celebrate"|"encourage"|"oops"|"rest"|"think") . The seven PNG poses become these moods.
 Always moving (idle): breathing, blinking every 3 to 5 seconds, ear twitch, occasional look-around, tiny weight shift.
 Reacts: follows the finger with its eyes, hops when tapped, claps on a match, rests while a form loads, tilts its head when the user pauses.
 Guides: walks to a spot, points at it and speaks a short caption (the tour).
 Safe: respect prefers-reduced-motion (still pose, no loops), pause when off-screen, never block a tap, never nag. A “Turn the bunny down” setting.
 Replace every <img class="bunnyBig"> and the menu bunny in find.js, calendar.js, bin.js, family.js, homes.js, journey.js, aupair-find.js, shell .
 Name
 Caresitters is descriptive and sits near Sittr, Sittercity and Care.com. Protect it through the logo and bunny as a registered mark. Before launch: IP Australia trademark search, domain and store-name checks.
 4. Caresitters: the journey, screen by screen 
 Welcome. Bunny waves. “Find care. Share the day.” Two big cards: I need care / I give care. Remember the pick.
 Sign in. Google, Apple or email. One account can hold both roles; never duplicate the identity.
 Bunny tour. 5 skippable steps, each pointing at the real screen. Resume if closed.
 Family profile, in small steps. Progress ring, selection cards instead of forms: family, each child (name or nickname, age), care type (babysitter, nanny, au pair), schedule, budget, distance, values. Exact address and child photos stay private until the parent shares.
 Carer profile. Photo, headline, intro, optional video, languages, experience, qualifications, rate, availability. Each qualification has its own status: submitted, under review, verified, expired, needs renewal. Uploading a document never makes someone “verified”.
 Discover. Sections, not endless scroll: Best matches, Available this week, New verified, Recently active, Saved. Cards show photo, first name, distance, rate, rating, verified badges, availability.
 Match score. Rule-based and explained (see section 6). Tap the score to see why.
 Profile. Big photo, video intro, “why you match”, checks with dates, reviews, calendar, rate and estimated cost.
 Book. Pick date and time, confirm rate and cost, send. At most five taps. Cancellation policy visible on this screen.
 Accepted. One calm celebration: bunny claps, “You’re connected.” Only after a real acceptance.
 Hand-off. “Set up your Care Space” invites the family and carer into CareSpace with one tap. Skippable.
 Repeat. “Book my usual carer”, and recurring weekly bookings with automatic availability checks.
 Au pair world
 A separate placement path with its own screens: country map, host family profile (room, pocket money, hours, duties, languages, visa help), au pair profile, and a clear line between childcare duties and unrelated housework. Visa guidance is per country and per passport, comes from official government sources with a “last checked” date, and is shown as a separate status next to compatibility. Never imply someone is eligible when it is unknown.
 5. CareSpace: the daily care app 
 CareSpace is a calm daily tool, like a messenger built for childcare. It must be useful on day one even if the family never used the marketplace (they invite their own nanny, grandparent or au pair).
 Tab What it does 
 Chats Messenger-style home. One private Care Space per family. A carer who works for three families sees three separate spaces and can never mix them up. Filters: All, Families, Carers, Unread, Requests. 
 Calendar Bookings, shifts, school, activities, pickups, time off. Views: mine, one family, team. Time-off request flows to the affected family, who approves, declines or proposes a swap. Never silently cancels a booking. 
 Care Child profiles with six sections: Health and safety, Meals, Sleep and routine, Mood, Learning, Memories. Daily report in seconds, with one tap, a note, photo or voice. 
 Activities Age-based ideas that match the child’s interests and what the family owns. Each has time, materials, steps, learning goal and a “simpler / more kids / Spanish version” button. Ties to the shopping list. 
 Profile Account, languages, notification choices, permissions, privacy, Care Team, the bunny setting. 
 Today (the CareSpace home)
 A timeline for the day: arrival, meals, naps, activities, pickup. Parents see what the child ate, drank, slept, their mood, photos and what is next. They can ask for an update on an item (“send a photo of the painting”) and it attaches to that item instead of a lost message.
 Care Team and permissions
 Roles: Admin (parents), Regular carer, Limited carer (e.g. weekend sitter), Family viewer (e.g. grandparent). The parent chooses who sees allergies, medication, photos, calendar and private messages. Access is revocable. A carer who leaves loses access; the family keeps its records.
 Allergy safety
 Allergy alerts show on the child’s profile, on meal planning, on recipes and when logging a meal.
 Checks are conservative and rule-based, with explicit “unknown ingredient” and cross-contamination warnings. AI must not rule anything safe.
 Medication and emergency details are stored apart from daily notes, with tighter access. Only an authorised person can edit them, and each change alerts the care team.
 Shopping
 One list from approved meals and activities: item, family, child, source, who buys, due date, bought, reimbursed. Lists never mix across families.
 Notifications
 One bell. Categories: messages, booking reminders, care updates, requests, calendar changes, shopping, allergy changes. Parents choose every update, key events or a daily recap. Carers can mute non-urgent items while working; safety alerts always get through.
 How the two apps link
 A permanent message button in Caresitters opens CareSpace, or the store page if it is not installed (universal links).
 After an accepted booking: “Set up our Care Space.” On carer and family profiles: “Already working together? Manage it in CareSpace.”
 One sign-in, one user id, one backend. Separate analytics, notification settings and release schedules.
 6. Matching and trust rules 
 Separate essentials (date and time, required checks, accepted ages, strict maximum budget) from preferences (Montessori, outdoor play, a Spanish speaker). A carer missing an essential is excluded or shows the unmet item. A high score never hides it.
 Score = weighted average of how well each criterion matches. Starting weights: experience 25, personality and care style 20, availability 20, budget 15, location 10, activities 10. Families can change weights.
 Match works both ways: carers see families that fit their rate, area, schedule and style.
 Every score shows “Why this match” as plain sentences, and says plainly when something is unchecked.
 Visa eligibility is a separate indicator, never folded into the percentage.
 AI helps write profiles and pulls preferences out of free text. The user confirms before saving. It must not invent qualifications or praise.
 Safety tools: report, block, emergency contacts, booking records, payments in-app. Include an in-booking safety check-in.
 Australia: model checks per state (Queensland Blue Card; other states use their own Working With Children Check). Check current official requirements before wording anything.
 7. Backend and data 
 Keep one Firebase project, users/{uid} ownership, entitlements at _entitlements/{uid} , and the existing Firestore rules style.
 Add careSpaces/{spaceId} with members/{uid} (role, permissions, status), plus children , dayStory , calendar , shopping , messages under the space. Access depends on membership, never on a client-written role.
 A user keeps a private child profile in users/{uid} ; the parent links it to a space. Removing a member removes access instantly.
 Write rules and tests ( accounts/tests.mjs pattern) proving: no cross-family reads, a carer can’t edit allergies, a removed member is locked out, entitlements can’t be client-written.
 Photos and files: reuse the R2 gatekeeper, keys under spaces/<id>/… , strip EXIF on the device, five-minute presigned links.
 Update accounts/DATA-MODEL.md with every change. Keep plan prices as they are (A$14.95 Finding, A$24.95 Family Plus, A$49 Search Pass; carers free).
 Universal links, push per app, offline reads for Today and Calendar, and queued writes when the connection drops.
 All new text goes through lang.js in all seven languages, with right-to-left checked for Arabic. Add a test per language like the existing lang-*-tests.mjs .
 Privacy: a children’s-data review against Australian privacy law and the App Store and Google Play family rules before launch. Get legal advice for the final wording.
 8. Tech stack and how to build 
 Decision: keep the web app plus Capacitor wrapper you already have. Do not rewrite in React Native or Expo. The 22k lines of tested logic and seven languages are the asset. Revisit only if profiling shows real jank.
 Why not a fully native iPhone app (Swift)
 Swift runs on iPhone only. Android would need a second full build.
 It would discard the existing logic, seven languages and tests, and cost months.
 This app is forms, lists, chat, calendar, photos and a mascot. Capacitor already covers camera, push, payments and offline storage.
 Rive animation runs well either way.
 Options: React with Capacitor (chosen, lowest effort, both platforms); React Native or Expo (smoother, needs a rewrite); native Swift (smoothest, iPhone only, rewrite twice).
 When to add native parts
 Real users report lag on older phones.
 You want Live Activities for a carer’s shift or home-screen widgets for today’s care. Add these as small native Swift modules without rewriting anything.
 The app grows enough to justify a dedicated mobile developer.
 Payments: store and Australian rules differ for in-app plans versus booking payments for real-world services. Have these checked before wiring booking payments.
 Stack
 Language: TypeScript in strict mode for all new code. Old .js modules keep running (allowJs) and are converted when touched.
 UI: React 18 with Vite and framer-motion for new screens (store-build/app3 already uses this). Old vanilla screens stay live beside them and are replaced one screen at a time.
 Bunny: Rive state machine (.riv, @rive-app/canvas) with an SVG fallback.
 Apps: Capacitor 8 for iOS and Android. Two apps, two bundle ids (Caresitters keeps com.ilse.caresits), one shared codebase.
 Repo: one monorepo with pnpm workspaces: apps/caresitters, apps/carespace, packages/core (auth, Firebase, i18n, brand tokens, bunny, match engine, types), packages/rules (Firestore and storage rules with tests).
 Backend: Firebase Auth and Firestore as now, plus Cloud Functions in TypeScript for anything that must be trusted: booking state changes, verification status, plan entitlements (RevenueCat webhook), push, account export and deletion. Keep R2 for files and RevenueCat for plans.
 Shared checks: Zod schemas used by both the apps and the functions. Verified flags are written only by the server, never by a client.
 Safety net: Firebase App Check, least-privilege rules, rate limits, no secrets in the client, crash reporting, privacy-friendly analytics.
 Method
 One checklist step per branch. Write the test first, then the code. Small commits.
 Replace piece by piece (strangler pattern). The app must run and pass its tests after every merge.
 Never change Firestore rules without emulator tests. Save each live version as a dated file like the existing firestore.rules.live-* files.
 New features sit behind flags (Firebase Remote Config) so you can switch them off.
 Tests: the existing *-tests.mjs files, Vitest for logic, Firebase Emulator for rules, Playwright on a phone-size screen, including Arabic right-to-left. A CI run (GitHub Actions) must pass before merging.
 Budgets: lazy-load screens, WebP images, first screen fast on a mid-range phone, bunny under 60 KB.
 Keep DATA-MODEL.md and README current as part of every change.
 9. Build order: tick as you go 
 10. Done means 
 A new family finds, books and connects with a carer, then lands in a working Care Space, in one sitting with no dead ends.
 A family with an existing nanny uses CareSpace with no marketplace account.
 All existing tests still pass, and new rules and match tests pass.
 Every screen works at 360px width, with large text, screen readers, keyboard focus and Arabic right-to-left.
 The bunny moves on every screen where it appears, and stops cleanly with reduced motion.
 No screen shows “verified” without a real completed check.
 Extra ideas to consider after launch
 Meet-and-greet video call before booking.
 Trial shift with a short feedback form for both sides.
 Backup carer suggestions when someone is sick.
 Printable emergency sheet and a yearly records export.
 Gentle milestone memories the parent can turn into a keepsake.
