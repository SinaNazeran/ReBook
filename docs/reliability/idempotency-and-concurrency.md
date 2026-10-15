# Idempotency and concurrency (checklist 3.3)

## Mutation boundary

ReBook currently uses SQLite and simulated payments. Unsafe `/api/` requests run
inside a database transaction that begins before Django reads the session and
commits after SessionMiddleware saves it. SQLite `IMMEDIATE` transactions acquire
the writer reservation before application reads. This coordinates order creation,
payment, cancellation, checkout, seller changes, cart limits, guest cart session
updates, and login cart merging across processes.

Order creation, payment, cancellation, and checkout also have explicit atomic
boundaries. Transactions, book status changes, notifications, and successful
idempotency receipts commit together. Missing or mismatched pending transaction
rows reject payment. Responses with status 400 or above roll back API database
changes. Guest cart GET requests no longer save cleaned session snapshots.

SQLite has one writer. This deliberately serializes all unsafe API requests,
including authentication and uploads, and can limit throughput. The configured
lock wait is five seconds; recognized database contention returns HTTP 409 with
`Retry-After: 1`, including CORS headers. Clients may retry their original intent;
there is no automatic background retry loop. Load testing remains a deployment
responsibility. A move to PostgreSQL requires a separate locking design and
database-specific concurrency verification; these tests establish SQLite behavior.

## Retry contract

First-party order creation, payment, cancellation, and checkout requests send
`Idempotency-Key`. Keys contain 8–128 ASCII letters, digits, dots, underscores,
colons, or hyphens. Authentication, permissions, CSRF protection, and throttles
still run before replay handling.

Receipts are scoped to the authenticated user, request path, and key. A matching
JSON payload replays the original successful HTTP status and body for 24 hours,
with `Idempotency-Replayed: true`. Reusing a live key with a different payload
returns 409. Failed operations leave neither partial business changes nor a
success receipt. Legacy callers without a key retain guarded, transactional
behavior but cannot replay a lost success response. Receipt expiry permits a new
intent; existing order and book state checks still apply.

The browser retains retry keys in sessionStorage, indexed by a SHA-256 digest of
the actor, operation, and canonical payload. Shipping details are not stored in
that storage key. Success and definitive validation errors clear the key;
network errors, 409, 429, and server errors retain it. If storage is unavailable,
an in-memory fallback works only for the lifetime of the page. Pending calls for
the same intent share one promise. Authentication changes invalidate the old
actor's queued calls and suppress stale results; already transmitted requests
cannot be recalled.

Cart changes execute sequentially within the current account. Account changes
discard stale responses and unsent queued work. Refresh requests made while a
cart mutation is pending are reconciled with a server GET when the queue drains,
including refreshes after an independent checkout.

## Deployment and retention

Run `python manage.py migrate` before serving the updated application. Migration
`orders.0004_idempotencyrecord` creates the receipt table and its uniqueness
constraint; it does not rewrite order or transaction rows. Production migration
execution is not established by test-database migration runs. This migration was
also applied successfully to the local development database during verification.

Receipts contain the successful API response, including any order details in that
response. Treat the database and its backups as private application data. Expired
receipts are ignored during matching retries. Operators should regularly run
`python manage.py prune_idempotency --limit 1000` to remove one bounded batch of
expired rows. The allowed batch size is 1–5000; repeat batches as needed. No
deployment scheduler is installed by this change.

There is no external payment gateway or webhook endpoint in the current system.
A real gateway requires provider-side idempotency, authenticated webhook receipt
deduplication, and coordination of external effects; database rollback cannot
undo an external charge or an already-sent message.

## Verification scope

Fault-injection tests cover rollback of each critical mutation and receipt-write
failure. Replay tests cover success, conflicting payloads, expiry, actor scope,
and bounded pruning. Separate-connection SQLite overlap tests cover duplicate
payment, payment/cancellation, reservation/checkout, seller edits/deletion versus
payment, authenticated and guest cart writes, and login cart merges. Frontend
tests cover retry-key lifetime, actor transitions, ordered cart changes, stale
responses, and deferred reconciliation.

Verification on 2026-10-15:

- Full Django suite with normal password hashing: 153 tests, 150 passed and three
  optional live Redis tests skipped. The eight SQLite overlap tests passed.
- Django system check, Ruff, and migration drift check passed. Production system
  checks using verification-only HTTPS origins reported only the staged HSTS
  warnings W005 and W021.
- Frontend: 63 tests passed with
  `npm test -- --pool=threads --maxWorkers=1`; ESLint passed.
- Production build passed with the verification-only URL
  `VITE_API_URL=https://api.verification-only.example/api`. This build does not
  establish real deployment configuration; private `.env` files were unchanged.
- `git diff --check` passed. All 221 source files checked were within 300 lines;
  the largest was 288 lines. Documentation is exempt.

Earlier frontend test attempts under concurrent verification encountered worker
startup timeouts; the final full run completed with no failures. No live
production deployment, gateway integration, or production load test was run.
