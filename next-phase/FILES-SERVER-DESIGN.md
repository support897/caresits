# Caresitters files home: design for Security's read

Status: READ PASSED WITH REQUIRED AMENDMENTS (Security,
19 Oct 2026: reviews/2026-10-19-caresits-files-server-
read.md) AND THE R2 ADDENDUM IN THE SAME FILE GOVERNS
wherever the two conflict. This file now reads AS
AMENDED BY THE ADDENDUM: Q1 matrix confirmed · Q2 day
story delete is FAMILY SIDE ONLY · Q3 sweeper custody
approved · Q4/A2 PUT and DELETE presigns are 5 minutes
(single use is not enforceable on a presign; replay
inside the window on the same key and verb is the
accepted residual) · Q5/A7 rate limit and issuance
budget enforced by the gatekeeper · A3 verification at
CONFIRM TIME · A4 EXIF strip client side · A5 day story
keys under pairs/<pairId>/day-story/ · A9 no store response
overrides on GET presigns · R1 bucket privacy proven by
refused anonymous requests · R2 the token lives in box
custody only · R3 every presign binds bucket, exact
key, verb, expiry and the PUT length. Nothing built or
deployed yet. Her FINAL word
of 19 Oct 2026 (18:35, by her tap, the catch printed on
the option: "card on file to switch it on, $0 to use"):
the file home is CLOUDFLARE R2: one private bucket,
Asia-Pacific placement, no public access, no public dev
URL. ACCOUNT SEPARATION (caught live 19 Oct 18:39): the
bucket lives in a FRESH Cloudflare account in Ilse's own
name, never in Fiesta's account: Fiesta is a separate
business and is for sale, so Caresitters' user photos and
billing can never sit inside it. The parked enable
screen sat in Fiesta's signed-in session and was NOT
clicked. The path there: Blaze picked 17:52, killed by her
word 18:27 (a prepayment demand at Confirm; Blaze is
closed, never re-presented) · her own server commissioned
18:27 and capacity-proven (the Apex VPS: 59 GB disk,
44 GB free read live 19 Oct; it now hosts the gatekeeper
and the sweeper instead of the bytes) · R2 picked over it
18:35. Her one step is the Cloudflare enable sitting
(card typed by her own fingers into Cloudflare's screen);
on her confirm PB creates the bucket plus a scoped API
token into custody. Firestore and Auth stay on free
Spark; rules v5, the _activity arm and _entitlements
stand as-is.

## The shape in one paragraph

Files live ONLY in the private R2 bucket, under keys
<uid>/<class>/<name>. A small gatekeeper service of our
own, running on the Apex VPS in its own container behind
Caddy at files.caresits.xyz, verifies the app's Firebase
login token on the server side and hands out short lived
PRESIGNED links (R2's own S3 signatures) for upload, view
and delete. Bytes flow between the phone and R2 directly;
the gatekeeper never touches a byte. No public links, no
listing, no unauthenticated surface: an unauthenticated
request to a known key refuses (a battery leg, per
Security's charter). The sealed Storage rules' privacy
shape is re-implemented as the authorisation matrix the
gatekeeper enforces before it signs anything (the store
rules text stays on file, unused).

## Runtime and footprint

- Node.js, standard library only (http, crypto). Zero npm
  dependencies: nothing third party to audit, nothing to
  rot, and the whole service is small enough to read in
  one sitting at the design read. Presigning is SigV4
  HMAC over the request: standard library work.
- Own container, own unprivileged service user, own
  secrets files on the box (mode 600, root readable
  only). TWO R2 TOKENS (Q7, confirmed as amended): the
  GATEKEEPER's (this bucket only · object read + write
  + DELETE · NO LIST) and the SWEEPER's (this bucket
  only · object read + LIST + delete, riding the census
  and the version purges). No admin rights, no account
  permissions on either. Separate files, created by PB
  into custody, the scope AND the account identity read
  back at creation (fresh account, her name). The
  tokens never enter chat, repo or client code; the
  client sees only presigned links.
- Binds 127.0.0.1 on a free localhost port (8123 proposed);
  Caddy routes only files.caresits.xyz to it, the house
  pattern every tenant on this box already follows.
- DNS: caresits.xyz sits at Cloudflare; one DNS only A
  record "files" to the box, added when the service is
  about to go live (the rollout discipline).

## Data layout and path safety

Bucket keys run <uid>/<class>/<name>:

- class "profile-photos": photo.jpg, extra-1.jpg ..
  extra-4.jpg (the client's existing planners name these).
- class "certificates": the checks documents a carer
  uploads (PDF, 10 MB cap, mirroring the sealed S-2 fence).
- class "day-story" lives under a DIFFERENT root (A5):
  pairs/<pairId>/day-story/<name>, per pair and day, named by the
  client's day story planner when that wiring is built
  (the photo request/reply flow gains its bytes here).
- The resume PDF has NO class: it never uploads (device
  only extraction, see client adaptation).

Every key segment is validated against strict allow
patterns (uid shape, the class list, the name patterns)
before anything is signed. The gatekeeper exposes no
listing operation and signs no List call, ever; the
bucket itself is private with no public dev URL, so a
key alone is never a door.

## Authentication: the Firebase token, verified on the box

Every API call carries the app's Firebase ID token
(Authorization: Bearer). The gatekeeper verifies it the
standard way: RS256 signature against Google's public
certs for project caresits-812a0 (fetched from the
securetoken endpoint, cached per its Cache-Control),
issuer https://securetoken.google.com/caresits-812a0,
audience caresits-812a0, expiry checked. The uid comes
only from the verified token; anonymous tokens are refused
everywhere (the sealed rules' stance). Anything missing,
malformed or expired is a plain 401 with no detail.

## Authorisation matrix (mirrors the sealed rules + the pair model)

- profile-photos: write and delete by the owner only.
  Read by any verified signed in (non anonymous) user:
  profile photos are what Find cards render, as today.
- certificates: write and delete by the owner only. Read
  by the owner, or by a family in a pair with the owner
  whose pair state is contact or hired (her 15 Oct ruling:
  checks stay viewable documents, to the people the app
  already lets see them). Pair state is checked by reading
  the pair document in Firestore with the CALLER's token,
  so Firestore's own rules judge the read; the gatekeeper
  trusts no client claim.
- day-story: read and write by pair members only (the
  pair check as above); nobody else, ever. These are the
  family's memories; the sealed model's caution applies
  doubled.
- Deletes are owner only in the profile and certificate
  classes. DAY STORY DELETE IS FAMILY SIDE ONLY (Q2,
  ruled): the family's side of the pair holds the only
  day story delete verb (through the app's bin flow,
  naming the exact object); THE CARER HOLDS NO DAY STORY
  DELETE VERB AT ALL, neither in the client nor at the
  gatekeeper, which never signs a day story delete for
  the carer side of a pair.

## Presigned links and confirm-time verification (A2, A3, A9, R3)

POST /v1/link { op: put | get | del, class, name,
bytes } with the Bearer token. On an authorised request
the gatekeeper returns one signed door. Every door
binds the bucket, the exact key, the verb and the
window (R3). PUT IS ISSUED HEADER SIGNED (Security's
strengthening, 19 Oct 2026): the gatekeeper returns the
object URL plus the signed headers (Content Length and
Content Type among them, both declared by the client:
it knows its byte count, it downscaled locally, and
the class fixes the type), and the client sends those
headers verbatim with its PUT; R2 itself refuses a
length or type mismatch at upload, and the battery's
R3 leg runs in exactly this form. Query string
presigns for PUT are NOT used. GET and DELETE ride
presigned URLs as below. Confirm then catches what a
signature cannot: the magic bytes. TTLs: PUT doors and
DELETE presigns live 5 MINUTES (A2: single use cannot be enforced on a
presign, so the window shrinks and replay inside it on
the same key with the same verb is the accepted
residual, stated not hidden); GET presigns live 10
minutes and carry signed response overrides setting
Cache Control to no-store (A9) and the content type
from the class map. A missing key is R2's plain 404.
The Firebase token never appears inside a link.

VERIFICATION STANDS AT CONFIRM TIME (A3 + the Q6
closure set, Security's ruling 19 Oct 2026: policy +
verification SUFFICES; proxying the bytes through the
gatekeeper is DECLINED). Confirm is a first class,
SYNCHRONOUS step in the client flow: PUT, then confirm,
and only on confirm success does any reference land.
After its PUT the client calls POST /v1/confirm
{ class, name } with its token; the gatekeeper reads
the object back under its token: HEAD for the size
(over the class cap: photos 5 MB, certificates 10 MB,
day story 5 MB), and a ranged GET of the first bytes
for the magic (JPEG for photos and day story, PDF for
certificates). On a pass the gatekeeper answers ok and
only then does the client write the reference (the
profile field, the card gallery, the day story
record). On a fail the gatekeeper DELETES THE OBJECT
AT ONCE, ALL VERSIONS, and refuses, so the reference
never lands and no bad object lingers. UNCONFIRMED
KEYS STAY UNREACHABLE (Q6 iii): a GET for a profile
photo or a certificate is issued ONLY when the owner's
profile slot names that exact key, read from Firestore
under the CALLER's token; deterministic key names open
nothing, for strangers and for the owner alike. A
DAILY ORPHAN CENSUS (Q6 iv) rides the box's daily job
(the sweeper's run, under the sweeper's list token):
every bucket key is checked against the confirm ledger
and the app state's references; an unconfirmed,
unreferenced key older than 24 hours is purged (all
versions) and counted in the run's report. THE
RESIDUAL, NAMED AND ACCEPTED: between PUT and confirm
an oversize or wrong type object can exist: unreferenced,
unreachable, unlisted. Existence without reachability
is the whole of it (Q6 v: the per uid budget stands
enforced at issuance).

THE EXIF STRIP IS CLIENT SIDE (A4): photos are
re-encoded by the client's downscale before upload,
which drops EXIF in the re-encode; the battery's
served-bytes leg (read the served object, find no EXIF
markers) stands unchanged as the proof.

## Recovery without versioning (A1, FINAL SHAPE)

CORRECTION OF RECORD (Security, 19 Oct 2026, their
call withdrawn at their own chair): VERSIONING IS
NOT AVAILABLE ON R2. Cloudflare's own S3
compatibility table lists Get/PutBucketVersioning as
NOT IMPLEMENTED, and there is no ListObjectVersions;
R2 keeps no versions. This desk's original
no-versioning decision was the only possibility on
this platform. The recovery story is re-founded on
what R2 has:

- USER DELETES RIDE THE TRASH SHAPE (as first filed by
  this desk): a user delete that the app bins (profile
  photos, Day Story) MOVES the object under
  trash/<owner-uid>/<original key>; the app's 30 day
  Recently Deleted window restores by moving it back
  (read back byte equal in the battery); the bin's
  30 day expiry hard deletes the trash object.
- THE SWEEPER DELETES IN TWO PHASES: at 90 days the
  pass MOVES the photo object to a quarantine/ prefix
  and clears the profile slot in the same pass (the
  user's deletion is WHOLE at 90: the profile is out of
  search and the slot is empty); the daily job then
  HARD PURGES quarantine entries aged 7 more days.
  That week is the machinery-accident grace versioning
  would have given. RESCUE INSIDE THE WEEK IS
  OPERATOR ONLY: there is no app path back from a
  sweep, and this design DISCLOSES the +7 day byte
  purge plainly so nobody calls the sweep incomplete.
- ACCOUNT DELETION HARD DELETES AT THE ACT, proven by
  an inventory read showing the user's keys at zero,
  final by law. That finality is the named residual,
  accepted: an account deletion is a ruled event with
  no grace by design.
- RULED PERMANENT DELETES (a user's confirmed delete
  forever, the bin's 30 day expiry) hard delete at the
  act in the same way, inventory-proven.
  retired; no trash keys exist in the design or the
  gatekeeper core.

## Token verification and the revocation posture

Verification is the public certs route (above): no
Firebase service account or Admin key is held for it,
so there is nothing extra to keep custody of. THE
REVOCATION POSTURE, named for the ruling: Firebase ID
tokens live at most one hour and this route cannot see
revocations inside that hour. The design accepts that
bound IN WRITING, on this reasoning: the ID token alone
grants nothing but the right to ask; the actual
capabilities are the signed links (10 minutes, single
object, single verb) and the one shot upload call, so a
revoked user's outstanding reach dies within 15 minutes
worst case, and their next ask fails at expiry. If
Security rules otherwise, the upgrade path is a
checkRevoked call on the delete and certificate verbs
via a service account, at the cost of a held key; the
design does not hold one until so ruled.

## The sweeper and the warner on the box

The built planner/warner (photo-sweeper/) deploys as a
scheduled job on the box (daily). Its executor deps map
to this home: the sweep's delete is TWO PHASE (the
final shape ruling): at 90 days the object MOVES to a
quarantine/ prefix (a copy plus a delete under THE
SWEEPER'S OWN token, read + list + delete, Q7; S3 API
from the box) and the slot clears in the same pass;
the daily run HARD PURGES quarantine entries aged 7
more days. The orphan census rides the same run.
Photo facts read from Firestore. The server side Firestore
access it needs (_activity stamps, profile photo fields,
warning marks) rides a dedicated credential whose
custody is Security's to rule: proposal is a service
account JSON created for this job alone (read _activity
+ profiles, write the two photo fields + warning marks,
nothing else), held on the box at mode 600. The warning
email sends via Purelymail SMTP as hello@caresits.xyz;
its credential likewise sits in the box's secrets file
under Security's custody call.
Every ruling stands verbatim: warn at 83 days, sweep at
90, objects first then slots, missing stamp never swept,
the never-stamped class on arm age plus an unrescued
warning, Day Story never in scope.

## Client adaptation (step 3, after this read)

- photo.js keeps its planners and public functions; the
  transport changes: uploadToStorage / deleteFromStorage
  resolve through the gatekeeper (ID token from the
  default app session, link, then the byte call).
  Stored references change from download URLs to internal
  paths (profile-photos/<uid>/photo.jpg); planPathFromUrl
  already returns exactly that shape for both URL and
  path inputs, so the deletion walks and the lifecycle
  code carry over.
- Readers (Find cards, gallery, profile) request a GET
  link at render and swap the img src when it lands, with
  the existing placeholder behaviour while pending.
- Certificates ride the same transport (class
  certificates).
- Day Story photo bytes: the request/reply flow stores
  the file via the transport and names its path in the
  day story record (that flow's bytes were waiting on
  storage by design).
- THE RESUME PDF BECOMES DEVICE ONLY: trust.js drops the
  upload leg entirely. The file is read on the phone
  (the parser already runs there), the draft builds, and
  nothing leaves the device; the temp lifecycle becomes
  the review screen's own lifetime. The resumeFile
  record, the temp box, the discard walk and the finish
  cleanup all retire (the code paths are named in the
  build report; suite legs re-pin). Account deletion's
  storage walk shrinks to photos + certificates.
  STATUS: THIS LEG IS BUILT (19 Oct evening, ahead of the
  read, being client only and server independent): the
  temp upload, the resumeFile record and router case,
  the seam field, the temp box, the finish cleanup, the
  photo layer's resume planner/remover and the account
  deletion walk's resume piece are all retired; suites
  photo 17, live 38, resume 19, pdf 7 green on the shape,
  with a device-only source leg pinning that no upload
  stands anywhere in the resume handler.
- Account deletion order holds: files are deleted and
  proven gone (fresh GET links answer 404) while the
  session still lives, before the Firestore and Auth
  deletion, exactly as deleteMyAccount is sequenced now.

## Proof battery (replaces the Blaze battery, same discipline)

R1 FIRST, ON THE CREATED BUCKET, BEFORE ANY REAL KEY:
an unauthenticated GET on a known key refuses · an
unsigned LIST refuses · the public dev URL is off
(read back from the bucket's settings). Then the legs:
forged link (tampered signature) refused · expired
link refused · op mismatch refused · R3 TAMPER: a PUT
whose length differs from the signed length refused
at R2 · no token 401 · anonymous token 401 · other
user's upload/delete refused · CONFIRM legs: an
oversize upload fails confirm and its object is
deleted by the gatekeeper (all versions) · a magic
mismatch (a PDF header in a photo upload, and the
reverse) fails confirm the same way · an unconfirmed
key is never referenced by any app state · a GET for
an unreferenced key refuses at issuance, owner and
stranger alike (Q6 iii) · the ORPHAN CENSUS leg: an
unconfirmed, unreferenced key aged past 24 hours is
purged by the daily run and counted in its report,
while a confirmed or referenced key of the same age
stands untouched · served bytes carry no
EXIF markers (A4) · profile photo cross-read allowed
(as designed) · certificate read by a non pair family
refused · day-story read by a non member refused ·
a day story DELETE link refuses for the carer side
(Q2) · listing refused on every route · DELETE PROVEN
THREE WAYS (Security's charter): a fresh GET link
refuses 404 · a GET link issued BEFORE the delete also
refuses · the server side inventory (the scoped
token's list, a proof plane tool only, never an
endpoint) shows the key gone · replace leaves exactly
one object · THE RECOVERY PROOFS (blocking): a
binned object moves to trash and restores byte equal ·
the sweep's two phases proven: at 90 days the object
stands in quarantine and the slot is cleared and the
original key refuses · at +7 days the quarantine entry
is hard purged and the inventory shows it gone · an
account deletion's inventory reads zero. BACKUP
+ RESTORE: durability is the provider's (R2, A1); the
restore drill is this battery run end to end on the
real bucket with synthetic users before any real
photo. Then the lifecycle legs on this home: upload,
sweep pass moves the objects to quarantine and clears
the slots, the +7 day purge follows, warning sent and
marked.

## Open questions for Security's read

1. The authorisation matrix: CONFIRMED as amended (Q1).
2. Day Story delete fence: RULED, family side only (Q2).
3. The sweeper credential custody: APPROVED as proposed
   (Q3; the no-field-scope residual stands named in
   Security's read); the Purelymail SMTP credential
   rides the same box secrets file.
4. Link TTLs: PUT/DELETE 5 minutes, GET 10 (Q4 as
   restated by A2).
5. Rate limit + issuance budget: YES (Q5/A7); the
   ceiling is stated in the build.
6. Verification placement: CONFIRM TIME (A3) governs;
   the through-gatekeeper streaming shape is superseded
   by the addendum and stands retired in this file.
7. The R2 token scope OF RECORD (Q7 as amended):
   TWO tokens, this bucket only: the gatekeeper's
   (object read + write + DELETE, NO list) and the
   sweeper's (object read + LIST + delete, deleting
   under its own token), each in its OWN mode 600
   secrets file (A8). Confirmed at PB's creation, with
   R1's bucket privacy proofs running before any real
   key.

Nothing deploys until this read lands, and nothing is
created in Cloudflare until her enable confirm lands
and PB creates the bucket + token into custody.
