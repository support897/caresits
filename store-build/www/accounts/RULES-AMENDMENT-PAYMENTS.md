# RULES AMENDMENT — PAYMENTS (the entitlement record arm)

Filed by the Caresitters desk, 19 Oct 2026, under the payments
chapter (Finance PAYMENTS-CHAPTER-PLAN §3). For Security's seal.
Nothing publishes on this desk's word alone.

## The change (one arm, one header note)

Text of record proposed: `firestore.rules.amended-v4.txt`, the
amended-v3 text plus exactly:

1. A header comment naming the record and why its seat is the root.
2. One arm, seated directly after the `_comp` arm:

```
match /_entitlements/{uid} { allow read: if signedIn() && request.auth.uid == uid && !isAnon(); allow create, update, delete: if false; }
```

No other line of the v3 text changes.

## Why the seat is the root

Finance §3 fixes the record's SHAPE (fields verbatim) and its law
(system written only; the client reads its own and never writes).
The draft DATA-MODEL line seated it at users/{uid}/meta/plan.
Read against the live amended-v3 text, that seat is forgeable:
the `match /users/{uid}/{document=**}` catch-all allows an owner
to create and update ANY doc in their folder, banning only the
keys plan, planSource, comp, role and owner. The §3 field names
(entitlement, status, product, lane, trial_ends_at,
period_ends_at, expires_at, source_event_id) are not in that
list, so a signed-in user could write their own meta/plan record
carrying entitlement "finding" and status "active" and the
client reader would honour it.

`_comp` already sits at the root for exactly this class of
reason. The entitlement record follows it. Writers (the
RevenueCat and Stripe webhook receivers, chapter §6 step 3)
write on the admin plane and never touch these rules.

## Client side shipped with this fold

- `accounts/account.js`: `entitlementFromRecord` (pure adapter,
  §3 record to the resolver's payment shape; the unlock rule is
  §3's, with Finding's no-trial law on top: a trialing Finding
  record opens nothing) and `plusExtrasOpen` (the in-app free
  month, chapter §9: derived from the Auth creation time, opens
  the Family Plus extras only, never the Finding door).
- `app2/live.js`: at boot, family accounts only, reads
  `_entitlements/{uid}` and publishes the resolved plan at
  `window.CARESITS_PLAN` and on `window.CARESITS_ME`.
- `app2/thread.js`: a live thread with no plan of its own takes
  the boot-resolved plan. Demo seams carry their own and are
  untouched.

## Battery owed before any publish (twin first)

1. A signed-in family writes `_entitlements/{own uid}`: DENIED.
2. The same user writes `users/{uid}/meta/questionnaire`: ALLOWED
   (the neighbouring arms are untouched).
3. The owner reads their own `_entitlements/{uid}`: ALLOWED
   (record seeded on the admin plane).
4. Another signed-in user reads it: DENIED.
5. An anonymous session reads or writes it: DENIED.
6. The full standing battery re-runs against the v4 text: no
   other leg moves.

Production publish follows the F17 discipline: Security's seal,
then the desk publishes on Security's word and proves by hash
read-back plus the production-shape probes.
