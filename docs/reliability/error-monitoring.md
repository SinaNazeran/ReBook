# Error logging and monitoring — item 7.2

ReBook reports unexpected client failures to its Django API and writes sanitized
JSON diagnostics to the process console (stderr). There is no new SDK, paid
service, error database, dashboard, or external transmission destination. Existing
error recovery, authentication, API error propagation, and Persian UI are retained.

## Server diagnostics and correlation

`config.observability` configures standard Django/Python logging. Each origin
request receives a new 32-character `X-Request-ID`; incoming IDs are ignored.
The header is exposed to approved frontend origins through the existing CORS
policy. A context variable keeps concurrent request logs separate; Django's
post-response exception logging can also read the ID from the request object.

JSON records contain UTC time, severity, a fixed event/source category, and where
available the request ID, method, status, and matched route **template**. Unknown
routes are labeled `unmatched`. Exceptions include their class and up to eight
backend-relative file/function/line locations. The formatter does not interpolate
the original log message or include exception messages, source lines, locals,
absolute filesystem paths, visited URLs, queries, IPs, account identifiers,
headers, cookies, request bodies, or response bodies. Browser metadata is
allowlisted again by the formatter, even after endpoint validation.

This deliberately trades detailed browser messages/stacks for a small diagnostic
surface. Route, event kind, and a related server request ID support triage, but
this is not a full stack-trace service. No source maps are uploaded. Django's
development HTTP server may emit separate sanitized status records in addition
to the correlated application failure record.

## Client reporting

The existing error boundaries report `render_error`. One installed global handler
reports uncaught `ErrorEvent`s and unhandled promise rejections, with cleanup on
Vite hot disposal. The normal Axios error interceptor reports API 500–599 responses
and preserves the original rejection and 401 session-recovery behavior. Expected
4xx responses and cancellation are excluded. Ordinary handled network errors and
resource-loading errors are not reported as unexpected JavaScript failures.

`errorReporting.js` derives only a fixed page bucket such as `book-detail`; it
never sends a visited path, book ID, search term, message, stack, or user object.
API failure reports optionally include a validated server request ID and status.
The reporter allows five attempts per minute and twenty per page lifetime and
deduplicates identical metadata during the minute. Attempts count even if delivery
fails. Reloading creates a new client budget; server limits remain authoritative.

Reporting shares the configured API base and CSRF-token parsing with Axios;
terminal API-base slashes are normalized consistently. It uses an isolated `fetch`
transport, not Axios. Each request has a five-
second abort timeout, credentials for existing sessions/CSRF, no caching, no
redirect following, and explicit `no-referrer` policy on both bootstrap and report
requests so same-origin telemetry cannot disclose the current URL. If the CSRF
cookie is not yet available, one shared in-flight
request obtains a masked token from the existing CSRF endpoint. No login or session
is fabricated. Failures are swallowed, never toasted, retried, or recursively
reported. An abrupt tab close, offline device, early bootstrap failure before the
reporter loads, or blocked request can lose reports; delivery is best effort.

## Collector protections

`POST /api/client-errors/` accepts guest and authenticated reports, with CSRF
enforced for both. JSON is limited to 2 KiB at the view; unknown fields, arbitrary
page names/event kinds, invalid UUIDs, and invalid statuses are rejected. Existing
API write throttles apply alongside a ten-report-per-minute collector limit using
the existing trusted-proxy/IP handling and Redis-backed limiter. Rate storage
failure returns 503 rather than disabling throttling.

A valid report returns 202 and writes one `browser_report` JSON record. It creates
no ORM record and is excluded only by exact path from the SQLite mutation writer
transaction. All business mutation routes retain their existing atomic protection.
Normal authentication may read a session, but telemetry does not acquire a database
writer transaction or alter the session.

Browser reports are **untrusted observations**, not proof of a server fault or
identity. A claimed correlation ID appears under `browser.reported_request_id`,
normalized as a UUID; the log record's own `request_id` is independently generated.
CSRF and throttling reduce abuse but do not authenticate an anonymous reporter.
Configure reverse-proxy request-size/connection limits as well: application view
validation does not replace an upstream body-size limit.

## Health and deployment

`GET /api/health` and `HEAD /api/health` require no session or CSRF token. They
perform `SELECT 1` and ping configured Redis, or fail when Redis is required but
absent. Redis uses the existing rate-store client and its connection/read timeout
and retry policy; monitoring timeouts must allow for that policy. Redis ACLs must
permit `PING` as well as the commands used for rate limiting.

The response is only `{"status":"ok"}` (200) or
`{"status":"unavailable"}` (503), with the existing no-store API cache policy.
HEAD has no body. The endpoint checks dependency connectivity, not schema/migration
state, writable storage capacity, external providers, frontend hosting, or all
business capabilities. It does not disclose dependency addresses or errors.
It bypasses normal API throttling so an unavailable limiter cannot hide the probe.

For a real deployment:

- Collect stderr JSON through the process manager/container logging system;
  choose restricted access, retention, rotation, and storage limits there.
- Poll the backend HTTPS `/api/health` externally and alert on non-200, connection
  failure, or timeout. Probe the frontend separately. No uptime provider or alert
  destination is configured by this repository change.
- Keep API responses and the collector uncached, preserve CORS and request-ID
  headers, and apply reverse-proxy body/connection limits.
- Configure web-server, hosting, CDN, and third-party logs separately to avoid
  sensitive URLs or payloads. The application formatter does not control them.
  Vite's local development instrumentation and browser developer tools may show
  raw errors; they are not the production structured reporting sink.
- Apply migrations and configure Redis and HTTPS as documented in earlier audit
  items. No production service was contacted or deployment configuration changed.

## Verification ledger

Verified locally on Windows on 2026-10-16:

- Full Django suite with normal hashing: 188 tests ran in 315.822s; 185 passed and
  three optional live Redis tests skipped because `REDIS_TEST_URL` was unset.
  Seven new backend tests cover the collector's CSRF/schema/size/rate protections,
  dependency failures, sanitized logs, generated IDs, thread isolation/cleanup,
  and exclusion of log-only reports from the SQLite writer transaction.
- Final full frontend suite: 176 tests passed in 37 files. Tests cover payload
  allowlisting, deduplication/budget, early CSRF bootstrap, silent delivery failure,
  handler cleanup, error-boundary integration, API 5xx correlation, unchanged
  rejection/401 recovery, explicit no-referrer policy, and a trailing-slash API base.
- Existing real-backend browser smoke suite: six tests passed, including normal
  authentication, guest-cart merging, checkout, and persisted order invariants.
- Browser audit at 1440px and 390px: all four event kinds reached the real collector
  and JSON logs, for eight verified reports. A deliberate backend failure proved
  request-ID correlation. A real React error boundary recovered from the injected
  render failure. The final audit used a trailing-slash API configuration and
  asserted that report requests had no `Referer` header. Structured JSON records
  contained none of the injected private error text. Browser APIs were not mocked;
  injected faults and storage were local and disposable. Mobile was emulation.
- Independent review found an inherited Referer-policy issue; explicit
  `no-referrer` on both reporting requests fixed it. Regression assertions failed
  before the correction and passed afterward; the reviewer confirmed resolution.
  A separate regression exposed and verified the trailing-slash correction.
  Initial missing-endpoint/writer-lock regressions and development fixture/tool
  failures were corrected; partial or failed runs were not counted as passes.
- Ruff, ESLint, Django system and migration-drift checks, production build,
  whitespace checks, and the source-size check passed. All 294 source files were
  within 300 lines; the largest remained 289. Deployment checks retained only
  the intentional staged-HSTS W005/W021 warnings. Build/check origins were
  verification-only HTTPS examples.
- Temporary servers, browsers, and storage were cleaned up. The existing SQLite
  database SHA-256 was unchanged. No commit, production deployment, private
  environment edit, existing-upload deletion, alert subscription, or external
  error-reporting account was created.

Production TLS/proxy behavior, live Redis health/ACL operation, external uptime
alerts, and hosting-level log retention were not certified. Dependencies were not
changed; previously reported npm advisories remain outside this item's scope.
