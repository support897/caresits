# Cloud Functions deployment

**Not deployed.** Sandbox cannot reach the live Firestore project. Cloud Functions and the 15-minute booking-reminder schedule need the Firebase project on the Blaze plan. Upgrade and deployment need the project owner's approval. Do not weaken App Check or the notification rules to work around billing.

## Deploy steps

1. In Firebase Console, open project `caresits-812a0` and upgrade its billing plan to Blaze. Confirm billing alerts and budget limits with the owner first.
2. Install or use the Firebase CLI, then sign in with an account authorized for this project:

   ```sh
   cd /home/user/cc
   npx firebase-tools login
   npx firebase-tools projects:list
   ```

3. Install workspace packages and compile the strict TypeScript functions:

   ```sh
   pnpm install
   pnpm --filter @cc/functions run build
   ```

4. Register production App Check providers for both apps in Firebase Console. Verify valid App Check traffic before relying on `bookingDecide`; its callable keeps `enforceAppCheck: true`.
5. The full Functions deployment also includes RevenueCat's webhook. Set its secret interactively before deployment; never place it in source, the apps, or chat:

   ```sh
   npx firebase-tools functions:secrets:set REVENUECAT_WEBHOOK_SECRET --project caresits-812a0
   ```

6. From the repository root, deploy Functions only. This config points to `../../functions`; it does not deploy Firestore or Storage rules:

   ```sh
   npx firebase-tools deploy --only functions --config packages/rules/firebase.json --project caresits-812a0
   ```

7. Confirm the callable, instant-book trigger, and scheduled reminder function are listed:

   ```sh
   npx firebase-tools functions:list --project caresits-812a0
   ```

8. In a controlled test project/account, verify instant booking with opt-in, family child ages, and conflict/no-conflict cases. Verify the scheduler writes one owner-private reminder per booking member, does not duplicate it, and skips cancelled bookings. Review logs and App Check metrics before enabling production traffic.
9. Merge and separately test `docs/RULES-LIVE/notifications-rules-snippet.txt`. Do not deploy rules from `packages/rules` without the rules owner's separate review.

The build and pure tests can run locally. Live Firestore, App Check, Cloud Scheduler, and production deployment remain **unverified** until the owner completes these steps.
