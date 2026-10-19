# Rules amendment: the photo lifecycle stamp (v5)

Status: PREPARED at the Caresitters desk, 19 Oct 2026.
Security seal requested. Not published anywhere. The live
text on both projects stays the sealed v4 text until this
amendment is sealed and proven on the twin, F17 discipline.

## Why

Ilse's ruling (19 Oct 2026): profile photos auto delete
after 3 months of app inactivity. HQ's build spec: a
server-trusted lastActive stamp on the carer account,
refreshed when the signed-in app opens, through a guarded
path that is not a free client write; a daily sweeper on
Blaze deletes the photo object and clears the profile's
photo slot for carers whose stamp is 90 or more days old.

The stamp needs a home no client can forge. Inside
users/{uid} the catch-all grants the owner a write on any
document, banning only five keys, so a stamp seated there
could carry any value its owner chose, including a fresh
date written by a stale account. The seat follows the
_entitlements precedent: at the root, outside the catch-all.

## The change

accounts/firestore.rules.amended-v5.txt is the sealed v4
text plus exactly two hunks (verified by diff):

1. A header note (the design record block) describing the
   _activity seat and its fence.
2. One arm, after the _entitlements arm:

   match /_activity/{uid} {
     allow read: if false;
     allow create, update: if signedIn()
       && request.auth.uid == uid && !isAnon()
       && request.resource.data.keys().hasOnly(["lastActiveAt"])
       && request.resource.data.lastActiveAt == request.time;
     allow delete: if signedIn() && request.auth.uid == uid && !isAnon();
   }

The write admits one key only, and its value must equal
the server's own clock. The client's stamp uses the SDK's
serverTimestamp sentinel, which resolves to exactly that
value. A hand-built timestamp (backdated, future, guessed)
is never equal at evaluation and refuses. The delete arm
exists so the account deletion walk can remove the stamp
with the account; the stamp has no value to anyone else.

Client side (built): app2/live.js exports
activityStampPath(uid, side) (carers only) and bootLive
writes the stamp fail soft after the profile resolves, so
until this arm is published the write simply refuses and
nothing breaks. Sweeper core: photo-sweeper/ (NOT
DEPLOYED; it runs with the storage wave on Blaze).

## Battery plan (twin first, on Security's word)

Script: accounts/hidden_run/battery-activity.mjs.
Legs:
ACT-1 a stamp write carrying the server time (a :commit
  updateTransforms setToServerValue REQUEST_TIME write,
  the REST twin of the SDK sentinel) is ALLOWED.
ACT-2 a stamp write carrying a hand-built past timestamp
  is DENIED.
ACT-3 a stamp write carrying an extra key beside
  lastActiveAt is DENIED.
ACT-4 a stamp write on another user's document is DENIED.
ACT-5 an anonymous stamp write is DENIED.
ACT-6 a client read of the stamp, even its owner's, is
  DENIED (the sweeper reads on the admin plane only).
ACT-7 the owner deletes their own stamp (the account
  deletion shape) is ALLOWED.
Standing battery re-run on the folded text, as ever.

## Open refinements (Ilse's pick, not in this amendment)

A warning email about 7 days before a sweep, and the
swept profile dropping out of family search until a fresh
photo lands. Neither needs this arm changed: the warning
is sweeper behaviour, and the search drop reads a
photoClearedAt stamp the sweeper writes on the profile
doc through the admin plane.
