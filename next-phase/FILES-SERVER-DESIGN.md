# Caresitters files home: design for Security's read

Status: DESIGN, nothing built or deployed. Her FINAL word
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
  secrets file on the box (mode 600, root readable
  only): the scoped R2 API token (created by PB into
  custody: this bucket only, object read/write, nothing
  else), never in chat, repo or client code. The client
  never sees the token; it sees only presigned links.
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
- class "day-story": per pair and day, named by the
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
- Deletes are owner only in every class (a family never
  deletes a carer's files; pair members delete Day Story
  entries only through the app's own bin flow naming the
  exact object, which rides the pair check plus the
  caller's own authorship record in the day story doc:
  Security to rule whether authorship or pair membership
  is the delete fence for this class).

## Signed links

POST /v1/link { op: put | get | del, class, name } with
the Bearer token. On an authorised request the service
returns one presigned R2 URL (SigV4; the signature binds
the method, the exact key and the expiry). TTL 10
minutes (uploads 15). The phone then speaks to R2
directly:

- PUT: the client uploads the object. The size caps are
  enforced two ways: the client downscales before upload
  (built), and the sweeper-side census (and the proof
  battery) verifies object sizes by class; a presigned
  PUT cannot carry a content-length condition under
  SigV4 query signing, so the cap's hard enforcement is
  the upload policy plus verification, stated plainly
  rather than dressed as a signature property. Security
  to rule whether that suffices or whether uploads route
  through the gatekeeper after all for the cap's sake.
- GET: R2 serves the object with its stored content
  type (set at upload from the class map, never from
  the client's claim). Missing key: R2's plain 404.
- DELETE: presigned DELETE; success reads back as a
  fresh presigned GET answering 404 (read-back, as
  everywhere).

Links are single key, single op, short lived. A leaked
link is a 10 minute window onto one object with one
verb, which is the exposure the design accepts and
states.

## The sweeper and the warner on the box

The built planner/warner (photo-sweeper/) deploys as a
scheduled job on the box (daily). Its executor deps map
to this home: deleteObject = an R2 DeleteObject call
under the same scoped token (S3 API from the box), photo
facts read from Firestore. The server side Firestore
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

Forged link (tampered MAC) refused · expired link
refused · op mismatch (PUT to a get link) refused · no
token 401 · anonymous token 401 · other user's put/del
refused · profile photo cross-read allowed (as designed)
· certificate read by a non pair family refused ·
day-story read by a non member refused · listing
attempt 404s on every prefix · size cap enforced
mid-stream · delete by owner then GET 404 read-back ·
replace leaves exactly one file. Then the lifecycle
legs on this home: upload, sweep pass deletes the
objects and clears the slots, warning sent and marked.

## Open questions for Security's read

1. The authorisation matrix above: confirmed or amended.
2. Day Story delete fence: authorship vs pair membership.
3. The sweeper credential custody (service account scope
   as proposed) and the Purelymail SMTP credential route.
4. Link TTLs (10 / 15 minutes) and the GET replay window
   they imply: accepted or tightened.
5. Whether the gatekeeper should also rate limit /v1/link
   per uid (proposal: yes, a simple in memory counter,
   generous ceiling, stated in the build).
6. The PUT size cap's enforcement (see Signed links):
   upload policy plus census verification, or route the
   bytes through the gatekeeper for a hard mid-stream
   cap. Security's call; the design does not hide the gap.
7. The R2 token's scope as proposed (this bucket only,
   object read/write): confirmed at PB's creation, with
   the bucket privacy (no public access, no dev URL) as
   a synthetic-proof battery item.

Nothing deploys until this read lands, and nothing is
created in Cloudflare until her enable confirm lands
and PB creates the bucket + token into custody.
