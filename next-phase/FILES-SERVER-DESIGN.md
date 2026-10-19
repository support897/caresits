# Caresitters files server: design for Security's read

Status: DESIGN, nothing built or deployed. Her word of
19 Oct 2026 (18:27): Blaze is closed (prepayment refused);
the file home is her own server. Capacity truth (step 1,
reported to HQ): the Apex VPS (ServerHost 192.236.165.98,
Debian 12, Docker, Caddy front door) is the fit box: 59 GB
disk, 44 GB free read live 19 Oct; 3,915 MB RAM, ~1,295 MB
available; idle load. Firestore and Auth stay on free Spark;
rules v5, the _activity arm and _entitlements stand as-is.

## The shape in one paragraph

A small gatekeeper service of our own, running on the box
in its own container, bound to a localhost port behind
Caddy at files.caresits.xyz. It stores files in its own
directory, verifies the app's Firebase login token on the
server side, and hands out short lived signed links for
upload, view and delete. No public links, no listing, no
unauthenticated surface. The sealed Storage rules' privacy
shape is re-implemented as service logic (the store rules
text stays on file, unused).

## Runtime and footprint

- Node.js, standard library only (http, crypto, fs). Zero
  npm dependencies: nothing third party to audit, nothing
  to rot, and the whole service is small enough to read in
  one sitting at the design read.
- Own container, own unprivileged service user, own data
  directory /srv/caresitters-files (mounted into the
  container only), own secrets file on the box (mode 600,
  root readable only): the link signing secret, generated
  on the box, never in chat, repo or client code.
- Binds 127.0.0.1 on a free localhost port (8123 proposed);
  Caddy routes only files.caresits.xyz to it, the house
  pattern every tenant on this box already follows.
- DNS: caresits.xyz sits at Cloudflare; one DNS only A
  record "files" to the box, added when the service is
  about to go live (the rollout discipline).

## Data layout and path safety

Files live at /srv/caresitters-files/<uid>/<class>/<name>:

- class "profile-photos": photo.jpg, extra-1.jpg ..
  extra-4.jpg (the client's existing planners name these).
- class "certificates": the checks documents a carer
  uploads (PDF, 10 MB cap, mirroring the sealed S-2 fence).
- class "day-story": per pair and day, named by the
  client's day story planner when that wiring is built
  (the photo request/reply flow gains its bytes here).
- The resume PDF has NO class: it never uploads (device
  only extraction, see client adaptation).

Every path segment is validated against strict allow
patterns (uid shape, the class list, the name patterns).
No dotdot, no absolute paths, no symlink following out of
the root, and no listing endpoint exists at all.

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
returns one link: https://files.caresits.xyz/f/<token>,
where the token is base64url( payload ).base64url(
HMAC-SHA256( secret, payload ) ) and the payload binds
{ op, uid-scope path, exp }. TTL 10 minutes (uploads 15).
The /f/ endpoint checks the MAC in constant time, the
expiry, and that the op matches the HTTP method, then:

- PUT: streams the body to a temp file in the target
  directory, enforces the class size cap while streaming
  (abort and unlink on overflow), then renames into place
  (a replace is atomic; a failed upload never leaves a
  torn file). Content type is not trusted from the client;
  it is assigned from the class and extension at serve
  time.
- GET: streams the file with the class content type,
  X-Content-Type-Options: nosniff, and a Content Security
  Policy of sandbox on document classes. Missing file:
  plain 404.
- DELETE: unlinks; missing is 404; success is 200 with an
  empty body. Delete is proven client side by a fresh GET
  link answering 404 (read-back, as everywhere).

Links are single path, single op, short lived. A leaked
link is a 10 minute window onto one file with one verb,
which is the exposure the design accepts and states.

## The sweeper and the warner on the box

The built planner/warner (photo-sweeper/) deploys as a
scheduled job on the box (daily). Its executor deps map
to this home: deleteObject = a service side unlink inside
the data directory (no HTTP), photo facts read from
Firestore. The server side Firestore access it needs
(_activity stamps, profile photo fields, warning marks)
rides a dedicated credential whose custody is Security's
to rule: proposal is a service account JSON created for
this job alone (read _activity + profiles, write the two
photo fields + warning marks, nothing else), held on the
box at mode 600. The warning email sends via Purelymail
SMTP as hello@caresits.xyz; its credential likewise sits
in the box's secrets file under Security's custody call.
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

Nothing deploys until this read lands.
