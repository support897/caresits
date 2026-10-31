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
storage wave lands (the home is Cloudflare R2 by her
final word, 19 Oct 2026; Blaze is closed), it acts on the
profile images (the main photo and the four gallery
objects, her words "the images", HQ ruling 19 Oct 2026)
for carers 90 or more days stale. THE DELETE IS TWO
PHASE (Security's final shape ruling, 19 Oct 2026): at
90 days the object moves to a quarantine prefix and the
slot clears in the same pass (photoClearedAt stamped on
the profile doc; the user's deletion is whole at 90);
the daily job hard purges quarantine entries aged 7
more days. That week is the machinery accident grace;
rescue inside it is operator only, with no app path
back.

Refinements, settled by Ilse's tap (19 Oct 17:47) and
built the same evening: the warning email (planner and
executor in the sweeper core, words settled; its mail
transport lands with the wave, since no mail route exists
for this app today), and the search drop (Browse excludes
a swept carer entirely; the photo write clears the stamp
when a fresh photo lands).

## What stands today

Manual deletion is built and gated separately (the HQ
deletion ruling of the same evening): remove paths for the
main photo, the gallery slots and the temporary resume, and
the account deletion walk removes every object. This
lifecycle is the automatic layer above those paths, and it
builds with the storage wave, not before: there is no bucket
until Blaze lands (F13), and no sweeper host until the sender
wave deploys.
