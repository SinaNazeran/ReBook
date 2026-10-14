# Pagination and query bounds

All DRF collection endpoints return `count`, `next`, `previous`, and `results`.
The default page size is 12; `page_size` may request up to 120 rows. Larger
requests are capped at 120. Zero, negative, and nonnumeric sizes fall back to
12. Invalid or nonexistent pages return HTTP 404. Counts are database
aggregates, not downloads of every matching row.

Personal lists retain their existing authentication, ownership, and book
visibility restrictions. Books, purchases, sales, notifications, and support
tickets sort by descending creation time, then descending ID. Wishlist entries
sort by descending addition time, then descending ID. Categories and the admin
user list sort by ID. Each catalog sort has a same-direction ID tie-breaker.

The six personal collections use explicit load-more controls. Purchase and
sale tabs have independent continuations. Displayed totals come from `count`;
notification unread totals come from the global unread-count endpoint. A failed
continuation preserves loaded rows and can be retried without advancing. Requests
from a previous reset or an unmounted consumer cannot publish stale results.
Appended records are deduplicated by ID.

Successful book deletion, wishlist removal, and ticket creation restart the
collection at page one, avoiding shifted offsets within that session. Order
status updates refresh the loaded range with separate bounded page requests.
Mark-all-read affects unseen notifications as well as displayed notifications.

Category consumers share a loader that fetches every page, at most 120 rows
per request. Only a complete tree is published and cached; a failed page clears
the pending cache so another load can retry. This preserves navigation links,
catalog filters, and editor options beyond the first page.

Catalog book responses contain user-scoped `is_wishlisted` membership, computed
with a database `Exists` annotation (false for anonymous requests). Catalog
hearts no longer require downloading a user's full wishlist. Toggle responses
are authoritative; local changes are rolled back on failure.

The cart retains its existing 50-item admission limit; checkout input also
enforces 50 items. These collections do not use pagination.

## Compatibility and limitations

The seven previously unpaginated collection responses change from arrays to
pagination envelopes. Deploy the updated API and frontend together; external
clients must read `results` and follow pagination. Never assume the first page
is the complete collection. Frontend requests extract only the page number
from continuation links and use the configured API client, retaining its origin
and credentials policy.

Numbered pagination supplies deterministic ordering, not a database snapshot.
Concurrent insertions/deletions from another session can move page boundaries;
deduplication removes duplicates, but refresh is needed to resynchronize the
collection. Category loading retains the complete tree in browser memory and
the loaded personal lists grow as users explicitly request additional pages.
The per-response cap does not cap aggregate count cost or deep-offset cost.

Production builds require the real HTTPS API URL. Verification using
`https://api.verification-only.example/api` proves compilation and generated
header behavior only; it is not a usable deployment configuration.

## Verification — 2026-10-14

- Full Django suite, normal password hashing: 121 tests run, 118 passed,
  three optional live Redis tests skipped (no `REDIS_TEST_URL` supplied).
- Six pagination regression tests include 135-row traversal on each of the
  seven endpoints, default/oversized/invalid page sizes, tied timestamps,
  ownership, actual SQL `LIMIT 12`, unseen notification updates, late wishlist
  membership, and the bounded admin user collection.
- Django system checks and Ruff passed. Production-settings deployment checks
  reported only the expected staged HSTS warnings W005/W021; verification used
  HTTPS placeholder origins, without changing private environment files.
- Frontend: 33 tests passed with `npm test -- --pool=threads --maxWorkers=1`;
  ESLint and the production build passed. Build URL:
  `https://api.verification-only.example/api`.
- `git diff --check` passed. All 207 source files checked were at most 300 lines
  (largest: 288); documentation is exempt.
- Independent review found and verified fixes for optimistic wishlist rollback,
  independent order-tab failures, and refresh superseding initial loading.

An earlier full backend run had 115 passes, three skips, and the preexisting
`test_rejected_book_approved_later_gets_a_second_notice` ordering failure. Both
notices existed, but their timestamp ordering was reversed. The first successful
full run left that test unchanged. After explicit approval, the test was
stabilized: it asserts the initial rejection notice, deliberately gives the two
notices equal timestamps, then verifies exactly one rejection and one approval
notice for the same book and the final approved status. The original ordered
assertion was reproduced failing with the tied timestamps before the correction.
The complete suite then passed again (118 passed, three optional live Redis
tests skipped), using normal password hashing. Admin behavior was not changed.
An earlier frontend run passed 20 tests but had two worker-startup timeout
errors. Subsequent complete runs passed without worker errors or changing
the test runner configuration.
