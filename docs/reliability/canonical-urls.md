# Canonical URLs — item 6.3

## Origin configuration

Production builds require `VITE_SITE_URL` in addition to the existing
`VITE_API_URL`. The site URL must be an explicit HTTPS origin, with no
credentials, path other than `/`, query, or fragment. No browser host or API
origin is guessed as the public frontend origin. A terminal slash is accepted
and normalized to the origin. Invalid values fail configuration with a message
that does not echo the supplied value.

The new `frontend/.env.example` contains verification-only HTTPS examples.
Deployment must supply its actual public frontend/API origins and rebuild.
Private environment files are not edited. Development without `VITE_SITE_URL`
remains usable and emits no canonical links; a supplied invalid origin is
rejected in development as well.

## Eligibility and URL policy

Home, catalog, About, Contact, Login, and Register receive self-referencing
absolute canonical URLs. Known static route casing and terminal slashes are
normalized consistently with existing route metadata. Static-page queries and
URL fragments do not change those pages' identity and are omitted.

Catalog URLs retain `category`, `search`, `condition`, `min_price`, `max_price`,
`ordering`, `page`, and `page_size`. They can change the displayed content;
paginated URLs are not collapsed to page one. Keys are sorted deterministically,
while repeated-value order is preserved to avoid changing existing filter
semantics. Values are URL-encoded. Empty/default values are retained rather
than assuming equivalence that the existing application has not established.
Unrecognized parameters, including tracking parameters, are omitted because
the catalog does not use them to choose content. This does not change routing,
filter validation, pagination, or crawling/indexing policy.

Book canonicals are generated only from a successfully loaded API record with
public `approved` or `sold` status and a positive safe integer ID. The returned
ID determines the canonical path, so a successful `/books/005` resolves to
`/books/5`. Seller-only pending/rejected listings, loading, missing books,
request failures, and invalid IDs do not receive canonicals.

Account/private routes, create/edit-book, Cart/receipt, unknown routes,
NotFound views, error boundaries, and catalog request-error views have no
canonical. Canonicals are not substitutes for authentication, HTTP status,
robots directives, or indexing controls. Those responsibilities are unchanged.
Home retains its self-canonical when an optional latest-books/category request
fails because its primary homepage content remains available. Auxiliary
category failures likewise do not suppress an otherwise usable catalog.

## Ownership and cleanup

`PageMetadata` owns canonical links alongside the existing title/description
pair. It deduplicates canonical link elements, including case variants in
`rel`. A page that omits the prop inherits the nearest lower-priority owner's
canonical. Explicit `null` suppresses it. Peer page owners are not inherited,
so stale cleanup cannot restore a previous page's canonical over a destination.
StrictMode/update/unmount reconciliation follows the existing ownership model;
the last unmount restores the original head metadata.

The shared HTML shell deliberately contains no canonical. One static Home
canonical on every SPA route would conflict with later JavaScript values.
Route-specific canonicals are available after JavaScript renders; this work
does not add SSR or prerendering, guarantee a crawler's chosen canonical, or
certify live hosting. Verification builds use
`https://frontend.verification-only.example` and
`https://api.verification-only.example/api`, not deployment configuration.

## Coverage

Regression tests cover origin/build validation, public/private eligibility,
catalog query ordering/encoding/pagination, book statuses/IDs, static tag
adoption/deduplication, StrictMode, navigation and stale-peer cleanup,
explicit error overrides, and catalog/book error/retry behavior. The existing
font build regression supplies the new explicit site origin. Later SEO items
and private environment files remain outside this change.

The production-browser audit passed 70 samples at 1440px and 390px widths:
32 public/query/error/Cart direct visits, six book-status samples, 16 private
route visits, two held book-loading states and two successful ready states,
two catalog errors and two recoveries, two Home auxiliary failures, and six
navigation/back samples. Expected canonical presence, absence, and exact values
were asserted alongside the existing title/description and heading invariants.
All canonicals used the configured frontend HTTPS origin rather than the local
browser/API host. No runtime exceptions or real API mutations occurred.
Temporary servers and Chrome exited.

The initial browser run sampled immediately after the URL changed to Cart,
while React still displayed the prior book view. Its assertion failed against
that prior view's metadata, and the incomplete run was not counted as passing.
The corrected runner waits for the destination Cart view before reading the
head; the complete 70-sample rerun passed. Ignored tooling/results are under
`.playwright-mcp/verify-canonicals-63-implemented.mjs` and
`.playwright-mcp/canonicals-63-implemented/`, including the initial sampling
failure. Browser APIs and records were mocked, not deployment data.

The full frontend suite passed 162 tests across 33 files with
`npm test -- --pool=threads --maxWorkers=1`. Ruff, ESLint, the production build,
Django system/migration-drift checks, and `git diff --check` passed. Production
mode used temporary verification-only HTTPS CORS/CSRF origins and reported only
intentional HSTS warnings W005/W021. All 276 tracked/nonignored new source files
met the 300-line limit (largest: 289); documentation is exempt. Independent
read-only review found no actionable issues after confirming the distinction
between dedicated error views and Home's optional-content failures.

The full Django suite passed with normal password hashing: 181 tests ran,
178 passed, and three optional live Redis tests were skipped because
`REDIS_TEST_URL` was unset. Those tests previously passed under item 2.5; live
Redis was not revalidated here. The browser audit completed before the full
frontend suite, which completed before the full Django suite.

No commit, deployment, private environment-file edit, migration application,
or existing-upload deletion occurred.
