# Photo lifecycle (Ilse's rulings, 19 Oct 2026, 17:47 and 17:48)

## The rulings, in her words as relayed

PROFILE PHOTOS: auto delete after 3 months of app inactivity.
A warning email goes about 7 days before. At 90 days the photo
object is deleted and the slot cleared. The profile drops out
of family search until the carer returns with a fresh photo.

DAY STORY PHOTOS: keep forever. They are the family's memories
of their child. Deletion is the family's alone (the 30 day bin
first). The inactivity sweeper never touches them.

## What this means for the build

Scope of the sweep: profile photos only. That is the main
profile photo (profile-photos/{uid}/photo.jpg) and the four
gallery slots (extra-1..4). Day Story objects, when the storage
wave gives them bytes, live outside the sweep by construction:
the sweeper's path list names profile-photos only, ever.

Inactivity signal, as built to HQ's spec (19 Oct 2026,
superseding this note's first sketch): a server trusted
lastActiveAt stamp at _activity/{uid}, refreshed by the
client when a signed in carer opens the app. The rules arm
(amendment v5, accounts/RULES-AMENDMENT-LIFECYCLE.md)
admits one key only, whose value must equal the server's
own clock, so the stamp can never be forged or backdated;
no stamp, no sweep. (Auth lastSignInTime was considered
and set aside: a persistent session opens the app for
months without signing in, so it understates activity and
would sweep live carers.)

The sweeper core is built at photo-sweeper/ (planner plus
executor, tests green, NOT DEPLOYED): nightly once the
storage wave lands on Blaze, it deletes the main photo
object for carers 90 or more days stale and clears the
card's photoUrl in the same pass, object first, stamping
photoClearedAt on the profile doc.

Refinements, with Ilse for her pick (asked 19 Oct, not
built): a warning email about 7 days before the sweep,
and the swept profile dropping out of family search until
a fresh photo lands. The warning needs the wave's mail
route (no mail route exists for this app today); the
search drop reads the photoClearedAt stamp the sweeper
already writes.

## What stands today

Manual deletion is built and gated separately (the HQ
deletion ruling of the same evening): remove paths for the
main photo, the gallery slots and the temporary resume, and
the account deletion walk removes every object. This
lifecycle is the automatic layer above those paths, and it
builds with the storage wave, not before: there is no bucket
until Blaze lands (F13), and no sweeper host until the sender
wave deploys.
