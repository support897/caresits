# CareSpace Boss — State Read + Fix Plan
For HQ · 2026-11-11 · Order: Ilse 05:53, fix CareSpace as Swift + SwiftUI, follow all brand.
Labels only in this report: Pass / Not pass / Could not check.
Every claim below is from this desk's own code read on 2026-11-11, files named.

## Of record (given, not re-proven here)
- CareSpace Daily Care · App Store Connect 6830173345 · bundle com.ilse.carespace
- Build 25 VALID in TestFlight.
- Ilse's tester seat: **INSTALLED** (ASC API read, 11 Nov ~10:50
  AEDT — supersedes the 8 Nov INVITED read; the acceptance landed
  between 8 and 11 Nov). The old redeem code TWDDLCQQ is EXPIRED
  and dead — never hand it to her again. A fresh invite cannot be
  sent: Apple's API refuses (already accepted). She needs no code:
  TestFlight → CareSpace Daily Care → build 25. Full record:
  TESTFLIGHT-INVITE.md in this folder.

## 1. What the app is actually built in
**Not pass — it is not Swift at all today.**
- CareSpace in the monorepo (`~/workspace/caresits-ship/apps/carespace`,
  repo support897/caresits) is **React 18 + TypeScript + Vite + Capacitor 8**,
  Firebase web SDK, framer-motion. Proof: its own `package.json`,
  `capacitor.config.ts` (appId com.ilse.carespace), `src/App.tsx`.
- Zero Swift exists for CareSpace. The repo's `native/Sources/` (13 Swift
  files) is **Caresitters only** (bundle com.ilse.caresits, build 174,
  per `native/README.md`).
- Shape that does exist: 5 tabs (Chats · Calendar · Care · Activities ·
  Profile), 27+ screens, a real data layer (spaces, children, calendar,
  meals, medical, shopping, invites, offline queue), 23 logic test files.
  This logic is the asset the Swift build ports — tests become the spec.
- **Could not check — which tree shipped build 25.** `docs/RELEASE.md`
  ships CareSpace from a legacy tree on the Mac (`~/Apps/caresits/
  store-build-cs`, `cap sync ios`) and its handoff notes stop at build 3.
  Nothing on this VM proves the monorepo tree above is byte-equal to
  build 25's tree. First build task is tree custody, below.

## 2. Broken / unfinished — plain labels
- Sign-up door — **Not pass.** Sign-in IS the first screen (Pass on that
  one point) with Google, Apple, email (Pass on shape). But there is
  **no name ask anywhere**, and the email door silently creates the
  account when sign-in fails (`auth.ts` signInEmail falls through to
  createUser). Sign-up and sign-in are merged into one hidden move —
  breaks the all-apps law (name ask, own chosen password as a real
  sign-up) and the sign-up/sign-in boundary law. Against the door
  law's new shape (Ilse, 11 Nov) it also fails on layout: the email
  form opens inline on the same page instead of its own page, and
  the door carries extra text lines the law does not want.
- Themes — **Not pass.** Theme is hard-coded "light" in two places
  (`App.tsx`, `main.tsx`). No picker anywhere (Profile checked). The
  dark theme is two button rules with no dark palette behind them.
  No beige, no brand theme, nothing saved. The new theme law
  (light/dark/beige/brand, white default, change any time) is unbuilt.
- Medical safety data — **Not pass.** The repo's own `docs/DATA-MODEL.md`
  names it: `medical.ts` writes allergies + medication + emergency into
  ONE combined document; the rules require separate section records
  with matching alerts. On a children's allergy path, this is the
  most serious open item in the app.
- Push notifications — **Not pass** in this tree: no push plugin in
  CareSpace's dependencies or Capacitor config. The brief requires
  push per app.
- Cross-app linking — **Not pass** on Android: `docs/LINKING.md` —
  assetlinks SHA-256 fingerprints are still TODO placeholders.
- Account delete — **Pass on shape** (type-DELETE flow in Profile,
  `LegalAndDelete.tsx`). Owner-side delete proof: **Could not check** —
  never driven for CareSpace.
- Languages — **Pass.** 7 languages (English + Spanish, Arabic with RTL,
  Hindi, Vietnamese, Cantonese, Mandarin) with a coverage test.
- Offline — **Pass on shape** (offline queue + tests present);
  real-device offline proof: **Could not check**.
- Per-user name law (Ilse, restated 11 Nov 05:55, after Fit Hard
  greeted "Hi Ilse" on a different account) — **Not pass.** Own sweep
  of CareSpace + shared core, name by name:
  · Hardcoded "Ilse" in user copy, greetings, defaults or samples:
    **none found.** The Fit Hard fault itself is not in this code.
  · Her name DOES sit in identifiers: the bundle ids (`com.ilse.
    carespace`) in the Capacitor config and the well-known link
    files, and one shared-core media host named with her full name
    (`packages/core/src/media/config.ts`). Not greetings — but
    named here so the Swift build moves media to a brand host.
  · The deeper fault is present in generic form: **the name is
    never asked and never saved.** No `updateProfile` call exists
    anywhere; an email user's name stays empty forever, and a
    Google/Apple user's name is only whatever the provider sends.
  · So the app DEFAULTS instead of asking: profile name falls back
    to "Member" (`profiles.ts`), a new space is named "My family"
    and its member "Admin" (`spaces.ts`), an invitee becomes
    "Care team member" (`invites.ts`), Profile falls back to "You".
    Demo fixtures hold demo names only ("Mila", "Johnson family",
    all demo-id fenced, preview file).
  · CareSpace has no by-name greeting at all today — it cannot
    greet wrong, and it cannot greet right either.
- Ease of use (Ilse, 11 Nov, all-apps law — gate item) — **Not pass**
  on the current build. Good bones: big tap targets, 17px minimum
  text, five clear tabs, daily report in one tap. But the door hides
  its biggest move — a new user "signs in" and an account silently
  appears, with no name ask and no moment where they chose anything.
  Confusing at the exact minute that matters most. Ease of use is a
  gate item on the Swift build, judged on the exact build, not
  on this code read.

## 3. Brand breaks (brand of record: BRAND-OF-RECORD.md, same folder)
- Colours — **Not pass.** The app's theme tokens drifted from the brief:
  ink is `#3B2A33` (brand: `#1E4D44`), cream is `#FFFBF2` (brand:
  `#FDF8F0`), the token NAMED sage holds a butter yellow `#FFE08A`
  (brand sage `#9CC5B5` is missing as a token), blush token is
  `#FFE3EC` (brand: `#F6CBD3`). Extra lav/peach/sky pastels ride along
  with no brief behind them. Only bunny pink `#F4A9BC` matches
  everywhere — and the app ICON matches the brand exactly. The app
  wears different colours from its own icon.
- Fonts — **Not pass.** The theme loads Fredoka (titles) + Nunito
  (names) + system body. The brand fonts — Newsreader + Atkinson
  Hyperlegible — sit in the repo's `/fonts` and are not used by
  CareSpace's theme.
- Name surfaces — **Not pass.** `index.html` title is "Care day";
  the manifest name is "Care day", short name "Care". (Ruling of
  11 Nov closes the question behind this fault: the name is
  CareSpace only — see the name lock in Phase 1 and the name
  proof in Phase 5.) The one-place
  name rule exists (brand.ts + CI check) and these surfaces break it.
- Icons — **Not pass.** One shared set of 9 simple stroke paths
  (chat box, calendar box, sun, bag…) serves both apps; the Google
  button is a bold letter "G". Against the raised law (Ilse, 11 Nov
  05:54) — luxurious, premium, designed, never cheap or
  stock-looking, on top of the standing no-emojis law — **Not pass**.
  Icon quality is a gate item on the Swift build, judged on the
  exact build with pictures, never on a file list.
- Emojis — **Pass.** Own search of CareSpace src + shared core src:
  none found.
- Ilse references — **Pass** in app copy and code (own search: none).
  Note only: the bundle id itself carries her name, as every app in
  the fleet does; it is not user-facing copy.
- Bunny — **Pass on shape.** Layered vector, 7 moods, idle motion,
  eye-follow, hop, reduced-motion and "turn the bunny down" all built.
  Small colour drift inside it (its ink `#2b2023`, belly heart
  `#E6AD9E` from the Caresitters set).
- Voice — **Pass, mostly.** Copy is plain, calm, short. One drift:
  the sign-in tagline reads "Run the care day." where the brand
  tagline family is "Find care. Share the day."

## 4. A clash HQ must see
The brief Ilse uploaded (§8) DECIDED: keep web + Capacitor, do not
rewrite native. Ilse's later orders override it — 8 Nov (Swift for
the builds), 10 Nov 19:53 ("fix carespace too as swift + swift ui"),
11 Nov 05:53 (this desk's order). **This plan follows the newest
order: Swift + SwiftUI.** Named here so nobody gates the Swift build
against the brief's old stack line later.
Android consequence, named plainly: Swift is iOS only. The Capacitor
build stays the Android app until Ilse rules otherwise.

## 5. Fix plan — native Swift + SwiftUI, all brand, all laws
Build seat: the three live seats are taken (host Caresitters ·
guest 1 Fit Hard · guest 2 NeedsMe). CareSpace takes the **next free
seat**. Scoping is done now; nothing sits still — Phases 0–1 prep
(pack, brand, port spec) runs without a seat.

- **Phase 0 — Custody + brand lock + logo redo (design only, runs
  ahead of the build).** Pull the Mac legacy shipping tree + the
  monorepo tree, reconcile them into one tree of record in
  support897/caresits; freeze BRAND-OF-RECORD.md as the build's
  brand source. LOGO REDO (Ilse, 11 Nov — all apps; CareSpace's
  turn here): research first (LOGO-RESEARCH.md: Care.com's cradled
  mark, brightwheel, Lillio, the curve/emotion studies, the luxury
  restraint rules), then three hand-drawn vector concepts — A The
  Cradle · B The Arch · C The Ear Heart — on one page
  (logo-concepts/LOGO-PAGE.html), shown large, at app-icon size,
  small, tiny and in one colour, wordmarks set in Newsreader +
  Atkinson themselves. Colours, bunny and style kept; only the
  mark is redone; no AI images. **The current icon stays in the
  app until Ilse approves a new one** — her pick is the only step
  that is hers, asked once, with the page.
- **Phase 1 — Native door (DOOR LAW, new shape — Ilse, 11 Nov).**
  Swift + SwiftUI scaffold on the Caresitters native pattern already
  in the repo (Theme, Session, Backend, Onboarding are the reuse
  base). Bundle com.ilse.carespace, same Firebase project.
  **NAME LOCK (Ilse, 11 Nov: "leave it only as carespace"):**
  the app is named **CareSpace** and nothing else — display name,
  home screen name, store name, every title and header. "Daily
  Care" is never carried into this build; the ASC rename rides
  this build's new version.
  The FIRST page shows **only Google and Apple, plus ONE small
  button for email instead**. Nothing else — no unnecessary text
  on the door pages. The email door is a **separate page**: email +
  the user's own chosen password, with sign up and sign in there.
  Email sign in must **never silently create an account** (the
  named fault of the current build dies here — a wrong or new
  email on the sign-in side gets a plain spoken failure, never a
  surprise account). Sign up **asks the user's name and saves it
  on that user's own profile** (Google/Apple names are shown and
  confirmed, never silently trusted). The door set is unchanged —
  Google · Apple · email + own password; an email link is still
  not a door — only the layout is new. Session remembered,
  no reference to Ilse, no emojis. Every greeting and name surface
  in the app reads the signed-in user's saved name only — nothing
  hardcoded, no fallback person.
  Navigation shell built in this same phase carries the **SWIPE
  LAW (Ilse, 11 Nov)**: sliding back takes you to the previous
  page, like a regular website, on **every** screen. CareSpace
  has no swipe-deck surface, so no screen is excepted here.
- **Phase 2 — The care day.** Today timeline · Chats / spaces ·
  Calendar · Care (child profiles, six sections) · Daily report.
  Medical rebuilt the safe way from the start: allergies, medication
  and emergency as separate records with team alerts — the combined-
  document fault dies here, not patched over.
- **Phase 3 — The rest.** Activities + recipes + shopping · Team and
  permissions (membership-based, removed member locked out) ·
  invites / join · notification choices + real push · cross-link
  to Caresitters · offline Today/Calendar with queued writes ·
  account delete with owner-side proof.
- **Phase 4 — Brand skin.** Brand tokens exactly as the brand page
  (ink green, cream, sage, blush, bunny pink) · Newsreader +
  Atkinson Hyperlegible · **theme law built in: light (white
  default) · dark · beige · brand colour, picker in Profile,
  change any time, pick survives restore** · a designed, luxurious
  icon set made for CareSpace · the bunny ported as a SwiftUI
  vector with its 7 moods and reduced-motion rules · 7 languages
  + Arabic RTL carried over.
- **Phase 5 — Gates + ship.** Quality + Efficiency + QA on the exact
  build, device door pass, icon picture-compared against the
  approval of record, delete proven owner-side. Two named gate
  items ride this phase (Ilse, 11 Nov): **icon quality** — every
  icon on the exact build judged luxurious and brand-designed from
  pictures of the running app, cheap or stock-looking anywhere is
  a fail; and **ease of use** — a first-time user walks sign-up,
  the care day and a daily report on the exact build with no dead
  ends and no hidden moves. Either gate failing holds the ship.
  **Fresh-account name proof (named proof, same phase):** a brand
  new test account is created with a test name that is not Ilse's;
  screenshots show that name — and only that name — on the
  greeting, profile, space name and member list; a second fresh
  account with a different name shows its own name everywhere,
  never the first account's; and the shipped bundle is swept for
  her name in user surfaces (zero, the bundle ids excepted).
  No name proof, no ship.
  **Door proof (named proof, same phase):** a picture of the first
  page showing ONLY Google, Apple and the one small email button,
  with no extra text; a picture of the separate email page; a
  sign-in attempt with a brand-new email on the sign-in side,
  proven to create NO account (the account list is read back);
  then a real sign-up on that page, name asked and saved.
  **Swipe proof (named proof, same phase):** every screen of the
  app is opened and swiped back from, one by one, and each swipe
  lands on the previous page — a written per-screen list with
  Pass / Not pass per screen, walked on the exact build.
  No door proof or no swipe proof, no ship.
  **Name proof (named proof, same phase — Ilse's 11 Nov ruling):**
  the shipped build is swept for "Daily Care" and "Care day" in
  the app name, home screen name, store name, titles and headers
  — zero hits; screenshots show the home screen icon labelled
  CareSpace and the store page titled CareSpace, nothing added.
  No name proof, no ship.
  Then, same sitting: code to the GitHub repo and the build to
  TestFlight (build 26+). Nothing goes to App Review without
  Ilse's approval.

Acceptance, written from Ilse's chair: she opens the app, signs up
with her name in under a minute, sees her care day on a white screen
in the brand colours with the bunny moving gently, flips the theme
to beige and back, and everything she taps does what it says.

## Open items that are not this desk's
- TestFlight seat: CLOSED — state INSTALLED (11 Nov API read);
  the expired code is dead and no invite is outstanding.
- Logo pick: Ilse's, asked once with pictures at Phase 0/4.
- Android future (Swift is iOS only): Ilse's ruling, when she wants it.
