# Caching strategy (checklist 3.4)

## API policy

All `/api/` responses default to `Cache-Control: private, no-store`, including
authentication, CSRF token responses, carts, orders, checkout, notifications,
personalized book lists, errors, redirects, and database-contention responses.
The catalog contains account-specific wishlist membership, and book visibility
depends on ownership; these responses do not enter a shared response cache.

Successful JSON category pages are the sole public exception. Anonymous requests
without cookies, and responses that do not set cookies, receive
`public, max-age=<remaining seconds>, must-revalidate`. HTML, authenticated
requests, requests with cookies, errors, unsupported query parameters, and legacy
`page=last` requests keep the default storage policy.

Category data is stored in a separate Django LocMem cache: at most 128 entries,
with a 60-second TTL and standard LRU culling. Each entry contains one bounded
page of at most 120 category records and its count. Keys use normalized page
number and page size. Invalid pages are not stored. Continuation links are
rebuilt for each current host/query rather than copied from another request.
Authentication and throttling still execute on every origin request.

This cache is process-local: each worker warms its own entries, workers can
temporarily show different category versions, and process restarts empty it.
There is no Redis data-cache dependency or cache invalidation scheduler. Redis
rate limiting retains its separate behavior. Category edits may take up to 60
seconds to appear; caching more volatile transactional data was deliberately
excluded. Database pagination and conditional purchase checks remain authoritative.

## Frontend category loading

Only complete paged category trees become reusable. Concurrent consumers share
an in-flight promise, even when loading takes longer than the freshness window.
A completed tree expires at the earliest page's expiry. The calculation accounts
for request time, `max-age`, `Age`, and apparent age from `Date`, capped at 60
seconds; `no-store`/`no-cache` responses are not retained for subsequent calls.
`Date` and `Age` are exposed through CORS for cross-origin clients. Failed
refreshes discard the expired tree and allow retry without publishing partial
results. There is no timer or background polling; the next category request
refreshes expired data. Already rendered category navigation updates on its next
load/mount rather than being pushed updates.

## Frontend hosting

The build emits security headers and cache artifacts from the actual output:

- Only emitted files under `/assets/` with a content hash receive
  `public, max-age=31536000, immutable`. Missing assets do not inherit this policy.
- HTML uses `no-cache` so clients revalidate before reusing the shell.
- Vite preview applies the build's policy by request path, with `no-cache` as the
  fallback. This includes unknown nested routes and missing assets served by the
  SPA fallback. Existing security headers still apply.

`_headers` contains non-overlapping cache rules for `/`, single-segment routes
(including `/index.html`), nested `/books/*` routes, and exact emitted asset paths.
Security headers use the global `/*` rule. Do not add a global `Cache-Control`
alongside the exact asset rules: hosts may concatenate duplicate headers rather
than override them. See [Netlify custom header semantics](https://docs.netlify.com/manage/routing/headers/).
For hosts using `_headers`, configure any additional nested SPA fallback routes
to revalidate HTML, and verify the deployed behavior. Unsupported hosts must
translate these rules to their own configuration.

For Nginx, include the emitted `cache-headers.conf` **in the `http` context**;
it defines `$rebook_cache_control` with `no-cache` as the default and exact
immutable asset paths. Include `security-headers.conf` **inside the frontend
HTTPS server block**; it sets security headers and the cache header using that
variable. Include both files from the same build and reload Nginx after each
deployment because the asset names change. Keep API/admin proxy locations
separate and preserve Django's response headers. A nested location defining
`add_header` must repeat/include the complete frontend header policy.

Example (replace paths and TLS configuration for the real deployment):

```nginx
http {
    include /srv/rebook/dist/cache-headers.conf;
    server {
        # Configure HTTPS certificates, listen, and canonical hostname here.
        root /srv/rebook/dist;
        include /srv/rebook/dist/security-headers.conf;
        location ~ /(?:cache-headers|security-headers)\.conf$ { deny all; }
        location / { try_files $uri $uri/ /index.html; }
    }
}
```

Do not serve the generated configuration files publicly. Ensure any upstream
CDN preserves `no-store` for API responses and does not override HTML revalidation.
Retain old hashed assets during deployment overlap so open pages can load their
original chunks. Neither generated artifacts nor local preview prove live CDN
or Nginx behavior; verify headers at the deployed edge.

## Implementation decisions and verification ledger

The approved scope is checklist 3.4 only. Existing committed 3.3 work was preserved.
Ruling: cache category data per process with a hard bound instead of adding a new
shared service dependency. This reduces repeated queries within each worker and
accepts a documented 60-second category freshness window.

Regression tests first reproduced missing API storage policy, repeated category
queries, indefinite frontend memoization, and missing hosting cache rules. A
combined backend run exposed category cache leakage between database fixtures;
the affected category/pagination test setups now clear the dedicated cache. A
review reproduced browser-cached responses receiving a renewed frontend TTL;
the corrected calculation uses exposed `Date` and `Age` as well as `max-age`.

Local HTTP preview on port 5199 verified HTML root, nested catalog, unknown nested
fallback, a real emitted JavaScript asset, and a missing asset. HTML/fallback
responses used `no-cache`; the real asset used the immutable one-year policy;
security headers remained present. Port 4176 returned Windows EACCES even when
retried outside the sandbox, so the successful check used a different local port.

Final verification on 2026-10-15: frontend 68 tests passed using
`npm test -- --pool=threads --maxWorkers=1`; ESLint and production build passed.
The build used the verification-only API URL
`https://api.verification-only.example/api`, with private `.env` files unchanged.
Ruff, Django system checks, and migration drift checks passed; no migration is
needed for 3.4. Production checks using verification-only HTTPS origins reported
only the intentional staged HSTS warnings W005/W021. `git diff --check` passed;
all 226 source files checked were within 300 lines (maximum 288). Nginx is not
installed here, so `nginx -t` and live CDN/Nginx deployment behavior were not
verified. The full Django suite used normal password hashing: 160 tests ran,
157 passed and three optional live Redis tests were skipped. There were no final
test failures. No live deployment was performed.
