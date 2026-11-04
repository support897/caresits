# Cloud Functions deployment steps

**Owner must deploy. No function has been deployed by this change.** A Firebase Blaze plan is required for Cloud Functions. Review billing, privacy, data retention, and Australian childcare-safety wording before deployment.

1. From the repository root, install dependencies and build the strict TypeScript functions:

   ```sh
   cd /home/user/cc
   pnpm install
   pnpm --filter @cc/functions run build
   ```

2. Enable Firebase App Check for both apps in the Firebase console. Register the production attestation providers and confirm valid App Check traffic before enforcement. Callable functions set `enforceAppCheck: true`; do not weaken this flag to make a client work.

3. Set the RevenueCat webhook secret on the Firebase project. The CLI prompts for the value. Never put this value in either app, source control, or chat.

   ```sh
   npx firebase-tools functions:secrets:set REVENUECAT_WEBHOOK_SECRET --project caresits-812a0
   ```

4. Deploy only Cloud Functions. This command uses the Firebase config in `packages/rules/firebase.json`; it does not deploy Firestore or Storage rules.

   ```sh
   npx firebase-tools deploy --only functions --config packages/rules/firebase.json --project caresits-812a0
   ```

5. Copy the deployed `entitlementsWebhook` HTTPS URL into RevenueCat. Configure the webhook to send `POST` requests with the `x-revenuecat-secret` header set to the same secret. Do not include the secret in the URL or request body.

6. Review the deployment output and App Check metrics. Test booking decisions, verification, export, account deletion, and the scheduled daily recap with controlled test accounts and devices before enabling those flows for users.

Carers stay free. Family plan prices remain A$14.95 Finding, A$24.95 Family Plus, and A$49 Search Pass. Never deploy the proposed Firestore rules from this package without the owner’s separate review and approval.
