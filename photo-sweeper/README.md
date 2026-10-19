# Caresitters photo lifecycle sweeper

The server worker for Ilse's photo lifecycle ruling of
19 Oct 2026: profile photos auto delete after 3 months of
app inactivity. HQ's build spec of the same day shapes it:
a server trusted lastActive stamp, a daily scheduled
sweeper, and the photo object plus its profile slot cleared
in the same pass so no surface ever renders a broken image.

## Status: NOT DEPLOYED

This code has not run anywhere. It deploys with the
storage wave: Blaze buys the scheduled functions and the
bucket it reads and deletes from, and both land on Ilse's
upgrade tap (a billing act, hers alone). Security reviews
the code itself before any deploy, the same way the push
sender's design and code were read.

## The pieces

Stamp (client): app2/live.js writes lastActiveAt to
_activity/{uid} when a signed in carer opens the app. The
value is the server's own clock and nothing else; the
rules arm (accounts/firestore.rules.amended-v5.txt, case
at accounts/RULES-AMENDMENT-LIFECYCLE.md) admits exactly
that one key at exactly that value, so the stamp can
never be forged or backdated. Until the arm is published
the write refuses harmlessly.

Planner + executor (here): planSweep chooses the stale
carers (90 or more days, photo still stored, never swept
before, trusted stamp present — no stamp, no sweep).
runSweep deletes each object first and clears its slot
second, in the same pass; a failed delete leaves the slot
untouched and reports loudly. Every effect rides injected
dependencies, so sweeper-tests.mjs proves the whole
behaviour on fakes. The deployed wrapper wires those
dependencies to the admin plane (Firestore reads over
_activity + profiles, Storage deletes) at wave time.

## Scope fences

PHOTOS ONLY. Profile words, answers and the account are
never touched: her save forever rule bends for pictures
only, by her own direction. Day Story objects are never
in scope (the object list names profile-photos only): the
family's memories of their child keep forever, deletion
the family's alone, bin first.

## The refinements (settled by Ilse's tap, 19 Oct 17:47)

Both are built into the core. The warning: planWarn picks
the carers inside the window (stamp 83 or more days old,
not yet 90, not already warned in this inactivity window),
and runWarn sends first and marks second, so a warning
that never sent is retried, never believed. Its words are
hers (WARN_COPY: open the app to keep your photo). The
one piece that lands with the wave is the mail TRANSPORT
itself: no mail route exists for this app yet, so
sendWarning stays an injected dependency until the wave
wires it.

The search drop: the sweep stamps photoClearedAt on the
profile doc as it clears the slot; Browse excludes a
stamped carer from family search entirely (entries and
the nearly list alike), and the photo write clears the
stamp the moment a fresh photo lands, so a returning
carer is back in search in the same action.
