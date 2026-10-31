# Caresits accounts — data model (accounts wave, 15 Oct 2026)

Built on the programme's accounts pattern (Personal Brand's accounts
kit: canonical Firestore rules v2.2, the CEO counter delta, and the
CEO-DASHBOARD-PATTERN v2). One Firebase project for Caresits alone.
Every user-owned record lives under `users/{uid}/`. Nothing
user-owned exists anywhere else.

## Identity

Firebase Authentication. Three doors, exactly these (HQ order
15 Oct 2026): Google, Apple, and email plus password. One Firebase
user per account. The uid keys every record.

(Record note: the isolation record of 13 Oct named the third door
email plus a one time code. Ilse's ruling of 15 Oct 2026, confirmed
by HQ the same day, supersedes it: the third door is email plus a
user chosen password. The isolation record is amended to cite the
15 Oct ruling as the authority.)

## The user folder (users/{uid})

| Home | Holds |
|---|---|
| `users/{uid}` (profile doc) | Role side (family or carer), the questionnaire answers, profile fields, guide state, settings incl. the Law E background choice. Created EMPTY at first sign in (Empty Start law). Carries NO plan-shaped keys: the rules reject client writes of plan, planSource, comp, role, owner... (role here means the privilege sense; the family/carer side is stored as `side`, a plain profile field.) |
| `users/{uid}/children/{id}` | The family's children and their care fields. |
| `users/{uid}/dayStory/{id}` | Day Story entries for the family's children. |
| `users/{uid}/roster/{id}` | Roster entries. |
| `users/{uid}/timesheets/{id}` | Timesheet entries. |
| `users/{uid}/documents/{id}` | Document records (checks, certificates). Bytes, when they arrive, live in private storage under the same uid path. |
| `users/{uid}/messages/{id}` | Message threads this user takes part in (demo threads in v1 stay on device until the matching build moves them). |
| `users/{uid}/jobs/{id}` | Family job posts, incl. urgent board posts. |
| `users/{uid}/meta/app` | App level state kept per user. |

## Plans (plan tracking)

Entitlement NEVER lives on the user record in a client-writable
form. It resolves, in order:

1. `_comp/{uid}` (desk/console written, clients can neither read
   nor write it; the rules read it via get()). Her own user account
   ("user 2", family side) carries its comp here: Finding free
   forever.
2. The payment path's record of a live subscription or pass,
   written only by the payment path (RevenueCat / Stripe / store
   billing), read by the app as its own plan state at
   `_entitlements/{uid}` (Finance chapter §3's shape, fields
   verbatim). SEAT CORRECTED 19 Oct 2026 (payments wiring): the
   record sits at the root on the _comp precedent, NOT under
   users/{uid}/meta/, because the users/{uid} catch-all lets an
   owner write any doc in their folder and §3's field names are
   not in its banned key list, so a meta seat could be forged by
   its own user. The rules arm: the owner reads their own record;
   every client write is denied; the payment path writes on the
   admin plane. The client-side resolution reads this record
   alone; a comp reaches the client by a system write to the
   record (entitlement finding, status active, no period end)
   made alongside the _comp pin.
3. Default: the free taste.

Plans: free taste (browse, view, 1 message per day; carers free
forever in full) · Finding (A$14.95/mo, NO FREE MONTH — her word
15 Oct 2026; paid from day one) · Family Plus (keeps its free
month) · Search Pass (A$49, a 3 month window; the pass end date is
part of the record, and the Finding door reads open inside the
window only).

## The CEO space (_owner)

| Home | Holds |
|---|---|
| `_owner/config` | The owner of record (uids). Console written only. |
| `_owner/aggregates/people/main` | People counters: activatedWithin7d, returning7d. Written ONLY by the paired client writes in the rules fold (a counter rises in the same batch as the caller's own profile event). |
| `_owner/aggregates/peopleTotal/main` | Signup counter: total (one field, its own document — F17 Block B v2 split). Rises by one in the signup batch, as that write's sole transform. |
| `_owner/aggregates/peopleWeekly/{wk}` | Signup counter for one ISO week (the document id is the week key): count (one field, its own document). Rises by one in the signup batch, as that write's sole transform. |
| `_owner/aggregates/safetyFiled/main` | Safety counter: reports filed (one field, its own document). Rises by one in the filing batch, beside the report document and safetyOpen. |
| `_owner/aggregates/safetyOpen/main` | Safety counter: reports open (one field, its own document). Rises by one in the filing batch; the owner drains it by exactly one on a closure. |
| `_owner/aggregates/money/main` | Paying count, cancels split pending/ended, failed payments, MRR estimate, and the R7 subscription feed events. Written by the payment path alone. |
| `_owner/aggregates/reviews/main` | Review counts, inbox state, stranger replies. Desk/feed written. |
| `_owner/aggregates/outreach/main` | Cold email area: campaigns, sent, replies. Outreach desk feed; reads "not running yet" honestly until a campaign exists. |
| `_owner/aggregates/community/main` | Facebook groups: group, members, growth, posts. Manual or connected feed, labelled which. |
| `_owner/aggregates/avatars/main` | Caresits avatars only (Lio, the Bunny): views + sales per avatar, App Promo's shape. |
| `_owner/aggregates/matching/main` | The matching chapter's audited line: Perfect Pair success rate (from the outcome loop), written by the desk's tuning pass. Lands with the matching build. |

The dashboard reads aggregates ONLY. The owner has no read path
into user folders (TW-4 / NS-1: numbers, never people).

## Demo sessions (SPARK shape)

Anonymous auth sessions, unlocked by the desk-held access code
hash at `_demo/config`, seeding their own copy under their own uid.
No path from demo data into a real account, ever.

## What waits on the matching lock

Cross-user relationship reads (a matched pair reading each other's
matching view, hire grants on children and Day Story, document
sighting grants) take their shapes from the matching chapter, so
their rules matches land with the matching build. Until then, the
wall is the canonical one: a user touches only their own folder.
