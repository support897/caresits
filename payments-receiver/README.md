# Caresitters payments receiver

Status: DEPLOYED (19 Oct 2026) on the Apex VPS as the
caresitters-payments container behind Caddy at
hooks.caresits.xyz/rc (the DNS record is the one step
outside this file). The enabling build's server half:
RevenueCat webhooks land here and become the app's own
entitlement records (payments chapter section 3 and
D3). The credential is the charter's custom role
(Security, reviews/2026-10-19-caresits-receiver-
credential-charter.md): a dedicated service account,
entities get/create/update, no delete, no list; its
JSON and the webhook value rest in separate mode-600
files in the stack's secrets directory on the box. The
wrapper was proven end to end on the twin project
before deploy (write, exact read back, dedupe, fences,
cleanup), and the production legs at deploy were the
no-write set: bad auth 401 and logged, TEST ping 200
with nothing written, the ledger get-by-id answering
under the role. Finance configures the RevenueCat
webhook from the custody note in hidden_custody/
(local only, never pushed).

receiver.mjs is the pure core: it translates a
RevenueCat webhook body into the section 3 record for
_entitlements/{uid} (the seat the amended rules fold
pins: system written only, the client reads its own
record and never writes it), and it checks the webhook
Authorization value in constant time. The unlock rule
itself lives in accounts/account.js
(entitlementFromRecord), untouched: trialing opens
Family Plus only, the Search Pass window closes at
expires_at, a cancellation stays open only until its
period end.

The shell (server.mjs, written at deploy) is a thin
Node http service in the files gatekeeper's house
pattern: verify the Authorization header (a shared
secret generated on the box into custody; Finance sets
it in RevenueCat's dashboard from the custody note,
never through chat), parse the body, dedupe by
source_event_id, write the record and an event ledger
entry through Firestore's REST plane under the
receiver's own credential, answer 200. Proposed home:
the Apex VPS behind Caddy at hooks.caresits.xyz/rc,
its own container, its own secrets file at mode 600.

receiver-tests.mjs proves the mapping on fake events:
the three products, the status map, the pass window
(store expiration wins; otherwise purchase plus three
calendar months, clamped), the anonymous and foreign
fences, and the authorization compare.

What waits: Finance's word on the webhook hand off
(the custody route proposed to them 19 Oct 2026), the
deploy itself, and QA's sandbox purchase pass against
the deployed receiver (buy, entitlement lands, paid
opens, restore, cancel, closes at period end, plus the
Search Pass window end leg and Finding's no trial
proof in behaviour).
