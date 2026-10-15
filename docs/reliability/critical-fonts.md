# Critical font discovery — checklist 5.3

## Existing behavior and approved scope

Home covers were already eager rather than lazy-loaded, book-detail covers
already used high fetch priority, and the Lalezar/Vazirmatn font faces already
used `font-display: swap`. In the Home audit with mocked book placeholders, the
hero heading was the observed LCP candidate at desktop and mobile widths.

The two shared critical fonts previously became discoverable only through CSS
after stylesheet delivery and rendering. The bounded change adds two anonymous
CORS font preloads to `frontend/index.html`, before the application scripts:

- Lalezar Arabic 400 WOFF2, used by the hero heading and shared brand typography.
- Vazirmatn FD Regular 400 WOFF2, used by shared Persian body text.

The source links reference the installed package assets. Vite resolves them to
the same hashed asset URLs already used by the bundled CSS. No font copies,
dependencies, font-face declarations, image priorities, or motion behavior were
changed. Other font weights retain their existing CSS discovery behavior.

The production-build regression executes Vite with `write: false` and an explicit
verification-only API URL. It checks that both preloads have font/WOFF2/CORS
attributes, match the emitted CSS URLs, and point to emitted bytes with the WOFF2
signature. This test first failed without the preloads, then passed with them.

## Browser and development verification

The full production browser run passed 20 scenarios:

- Before/after Home visits at 1440px and 390px, with motion allowed and reduced.
- A before/after desktop Home comparison with stylesheet delivery delayed 350ms.
- After-change catalog, login, about, and book-detail visits at both widths.
- A cache-prime Home visit and a subsequent warm-cache Home visit.

Each visit requested each critical font exactly once. Before the change their
resource initiator was CSS; afterward it was the HTML link. The preload URLs
matched the CSS font requests, loaded faces retained `swap`, and no font/preload
warnings or runtime exceptions were recorded. On the warm-cache visit both
fonts had zero transfer size and nonzero decoded body size.

In the ordinary Home comparisons, critical font requests previously began
105–416ms after the stylesheet completed; afterward they began 195–400ms before
it completed. With the 350ms stylesheet delay, requests changed from 308ms after
stylesheet completion to 603ms before it. These timings describe this local
run, not a guaranteed LCP reduction or production Core Web Vitals result.

The runner served compiled production artifacts with the generated header/cache
policies, using mocked APIs and cover placeholders. It did not send mutations.
The initial browser run stopped on a harness assertion that expected an empty
`crossOrigin` property. Chrome normalizes the empty HTML attribute to
`anonymous`; correcting that expectation made the complete rerun pass without
an application change.

Development-server checks also fetched both real WOFF2 assets successfully from
`/`, `/login`, and `/books/5` (HTTP 200 and valid WOFF2 signature). Temporary
development/production HTTP servers and Chrome exited after verification.

Ignored local tooling and artifacts:
`.playwright-mcp/verify-fonts-53.mjs`,
`.playwright-mcp/font-preload-53/results.json`,
`.playwright-mcp/font-preload-before-53/`, and
`.playwright-mcp/check-font-dev-53.mjs`.

## Full verification

Frontend: all 135 tests in 27 files passed using
`npm test -- --pool=threads --maxWorkers=1`. ESLint and the production build
passed. The build used `https://api.verification-only.example/api`, which is
explicitly verification-only, not deployment configuration.

Ruff, Django system checks, and migration drift checks passed. Production-mode
Django checks used explicit verification-only HTTPS CORS/CSRF origins and
reported only the intentional staged HSTS warnings W005/W021. The full Django
suite passed with normal password hashing: 181 tests ran, 178 passed, and three
optional live Redis tests were skipped. Those Redis tests previously passed
under 2.5 and were not rerun here.

All 265 source files met the 300-line limit (largest: 289); documentation is
exempt. `git diff --check` passed. Independent read-only review found no
actionable issues.

No commit, deployment, private environment-file edit, migration application, or
existing-upload change occurred. Live hosting/CDN behavior and real-user LCP
were not verified. Production migration/cleanup scheduling requirements and
the simulated-payment limitation remain unchanged.
