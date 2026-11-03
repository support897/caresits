Firestore rules tests (emulator). Ran 3 Nov 2026 against accounts/firestore.rules.live-2026-11-03.txt: 19 passed, 0 failed.
Run: npm i firebase-tools @firebase/rules-unit-testing firebase; copy the rules file to firestore.rules; firebase.json with firestore emulator port 8085; npx firebase emulators:exec --only firestore --project demo-cs "node rules.test.mjs". Needs Java 21+.
Covers: no cross-family reads, carer cannot edit allergies (children), removed and inactive members locked out, nobody can make themselves admin, entitlements not client-writable, messages append-only.
