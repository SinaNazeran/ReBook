# Automated browser smoke tests — item 7.6

The Playwright suite complements Vitest component tests and Django API
tests. It exercises the real React application over HTTP against a disposable
Django backend. Application API responses are not mocked, and login uses the UI
with real session cookies and CSRF enforcement.

## Run locally

Install backend requirements into the repository-root `venv`, then from `frontend/`:

```sh
npm ci
npx playwright install chromium
npm run test:smoke
```

The entry point selects `venv/Scripts/python.exe` on Windows or `venv/bin/python`
elsewhere, falling back to `python` on PATH. Node is the same executable running
npm. No manually started servers or configured private environment files are
required. Browser installation requires network access and writes to Playwright's
normal user cache. Linux hosts may also need Playwright's OS browser dependencies.

The harness imports the existing single Django settings module with `.env`
loading suppressed and a controlled configuration. SQLite, media, and static
storage live in a newly created OS temporary directory. Cache/rate limiting uses
the existing process-local development backend; no external Redis is contacted.
Passwords use the configured normal Django hasher. No existing database, upload,
or private environment file is modified.

The backend binds loopback on an OS-assigned port. A second OS-assigned port is
selected for Vite, which uses `strictPort`; a collision fails instead of switching
ports or reusing another server. Only this exact frontend origin is trusted for
credentialed CORS and CSRF. The test frontend uses the real temporary API origin
and a verification-only HTTPS site origin for canonical metadata. These settings
are local verification configuration, not deployment configuration.

## Coverage

Three tests run on Chromium at 1440 × 900 and at 390 × 844 with mobile/touch
emulation. Each test gets a new browser context; each project has separate buyers,
readers, and books. One worker and no retries keep failures visible and avoid
competing mutations of the disposable catalog.

1. Home renders, then navigation leads to the catalog and a seeded book detail.
2. A protected route redirects to login, UI authentication returns to it, the
   session survives reload, and UI logout restores the authentication requirement.
3. A guest adds a book, logs in from checkout, retains the merged cart after a
   reload, and completes simulated checkout. The UI displays the returned tracking
   code; read-only API requests with the browser's actual session verify exactly
   one paid order with a successful matching transaction. Reload shows an empty
   cart. Finally, the backend checks persisted order/transaction/cart invariants.

Tests locate controls by accessible role/label/text, wait for observable state and
responses, and fail on uncaught page errors. Browser requests outside the two
local origins are blocked; local application requests continue to the real server.
There are no fixed sleeps, authentication injection, or test-only application API
endpoints.

## Failure artifacts and cleanup

Failed tests retain traces and screenshots under ignored
`frontend/test-results/smoke/`. Playwright prints the trace viewer command. These
artifacts contain only generated test accounts and sample data; keep them local.
Vitest discovery remains restricted to `tests/**/*.test.{js,jsx}`.

The runner closes Vite after Playwright exits; the Python harness shuts down its
HTTP server and removes temporary storage on success, test failure, or an ordinary
console interruption. Forced process termination or a machine crash cannot
guarantee cleanup. No command discovers or terminates unrelated servers.

## Limits and verification

This is a local development-server smoke suite, not production hosting, TLS,
Redis availability, real payment, physical-device, Firefox/WebKit, or visual
regression certification. Mobile coverage is Chromium emulation. Production
builds and the existing full test suites remain separate required checks.

Verified locally on Windows on 2026-10-16:

- Two consecutive clean-database runs passed all six browser tests (50.4s and
  55.4s), including both persisted checkout invariant checks. The final run also
  included the bounded backend-startup timeout.
- A local, ignored fault-injection wrapper forced CSRF origin rejection. Both
  browsing tests passed; the four authentication/cart journeys failed on the
  blocked write paths. This expected failing run verified that real Django CSRF
  enforcement is part of the journey. It is not a skipped or passing smoke run.
- The first attempt could not launch because matching Chromium was not yet
  installed. A subsequent development run exposed incorrect test assumptions
  about the paginated order response and the post-logout landing route. The final
  assertions validate the actual pagination contract, successful logout and a
  subsequent protected-API 401, without requiring Home as the logout destination.
  No application behavior was changed to satisfy these tests.
- Full Vitest: 170 tests passed in 35 files. Full Django with normal hashing:
  181 tests ran in 332.168s, with 178 passing and three optional live Redis tests
  skipped because `REDIS_TEST_URL` was unset.
- ESLint, Ruff, Django system/migration-drift checks, production build, diff
  whitespace checks, and source-file size checks passed. All 287 source files
  were within 300 lines; the largest was 289. Deployment checks reported only
  the intentional staged-HSTS W005/W021 warnings. Production build/check origins
  were verification-only HTTPS examples, not a deployment.
- Temporary storage was removed after success and failure, smoke listening
  ports closed, and the existing local database SHA-256 remained unchanged.

`npm audit` separately reported nine existing dependency advisories (two moderate,
seven high). The lockfile change adds only `@playwright/test`, `playwright`, and
`playwright-core`; none of those packages was named in the audit findings. Existing
dependency versions were preserved. This item does not certify an advisory-free
dependency tree or remediate unrelated dependencies.
