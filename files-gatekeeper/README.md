# Caresitters files gatekeeper

Status: CORE + SHELL + WRAPPER BUILT, NOT DEPLOYED
(19 Oct 2026; R2 is ACTIVE in her account and PB's
bucket + tokens are the next input). The design of
record is next-phase/FILES-SERVER-DESIGN.md as amended
by Security's R2 addendum (19 Oct 2026), which governs.

server.mjs is the HTTP shell over the core (POST
/v1/link + the synchronous POST /v1/confirm; every
judged fact read from Firestore under the CALLER's
token): 12/12 over fake deps — the full matrix, Q2 +
Q6 iii + confirm-delete + the issuance window.
wrapper.mjs wires it to the real world (securetoken
JWKS verification, caller-token reads, the gatekeeper's
own presigned bucket reads, the append-only confirm
ledger, the core's issuance budget) and is smoked
against the twin with a REAL Firebase ID token:
verifies, tamper refused, caller-token reads answer,
ledger persists. The shell legs caught two real
defects pre-bucket (the presign override keys, now
camelCase per the core's contract, and the claims uid
mapping); the battery's R3 + A9 legs re-prove both on
the real bucket. Deploy order from here: R1 -> the
shell on the box -> the battery, synthetic users only
-> client adaptation -> sweeper deploy.

## What stands

gatekeeper.mjs is the pure core, proven synthetic
(gatekeeper-tests.mjs): key planning (server composed
keys; profile photos, certificates, day story under
pairs/<pairId>/day-story/; the trash prefix carries
the bin window; NO resume shape
anywhere), the authorisation matrix (Q1 +
Q2: day story delete is family side only, the carer
holds no such verb), Firebase ID token verification on
the public certs route (signature, iss, aud, exp;
anonymous refused; no Firebase key held), R2 presigning
(SigV4; bucket + exact key + verb + expiry bound; PUT
signs the exact content length, R3; GET signs the
no-store overrides, A9; TTLs 5 minutes PUT/DELETE,
10 minutes GET, A2), confirm-time checks (A3: size caps
5 MB photos / 10 MB certificates, magic bytes JPEG/PDF),
and the issuance budget (Q5/A7).

## What waits, in order

1. Her Cloudflare enable confirm (her card, her
   fingers, the fresh account in her name).
2. PB creates the bucket (Asia-Pacific, private, no
   public dev URL) + the scoped token into box custody.
3. R1 on the created bucket (anonymous GET refused,
   unsigned LIST refused, dev URL off read back).
4. server.mjs: the thin HTTP shell (link issuance,
   confirm endpoint reading the object back under the
   token, pair facts read from Firestore under the
   caller's token), containerised on the Apex VPS behind
   Caddy at files.caresits.xyz.
5. The battery against the real bucket, synthetic
   users, every leg in the design's battery section.
6. Client adaptation (photo.js transport, certificate
   + day story bytes, readers via GET links), then the
   sweeper deploy (deletes via the R2 API from the box).

Nothing here ever stores or serves a resume: the resume
is device only by her ruling, and a resume key, verb or
class appearing in this service is a defect on sight.
