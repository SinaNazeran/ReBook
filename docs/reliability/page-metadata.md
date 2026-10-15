# Page titles and descriptions — item 6.1

## Scope and ownership

The client-rendered React/Vite application retains one title and description in
`frontend/index.html` for initial loading and JavaScript-disabled visits.
`PageMetadata` adopts these elements instead of adding competing React-managed
head elements. It writes strings through `textContent` and `content`, never HTML.
No new package or server-side rendering subsystem is introduced.

An active metadata owner supplies the current title/description. Priority zero
belongs to `RouteMetadata`, outside Suspense and protected-route gates, so a lazy
or session-loading view has route-appropriate metadata. Pages override that
fallback; error boundaries override page metadata. On update/unmount, owners
reconcile against the remaining current owners rather than restoring a stale
page snapshot. The final unmount restores the original HTML fallback pair.
Existing duplicate title/description elements are collapsed to one pair.

All existing Persian page titles are preserved. Home now explicitly owns its
metadata. Static page descriptions describe their actual purpose. Book detail
uses title, author, resolved category, and sold status when available; absent
optional fields are omitted. It does not copy arbitrary seller notes or personal
fields. Catalog descriptions use resolved categories and applied filter chips,
not unsaved form edits. Empty results retain the catalog context.

Book loading, request failure, missing books, unknown routes, route/global error
boundaries, and cart receipts have appropriate metadata. Account and receipt
descriptions remain generic: email, address, tracking references, and other
private account/order values are excluded.

## Verification

Regression coverage includes static-node adoption, duplicate/missing tags,
StrictMode, safe text insertion, route fallback priority, navigation/unmount
cleanup, dynamic book/category/filter descriptions, book-state recovery,
error-boundary recovery, and receipt transitions with private checkout data.

Production-browser checks use mocked GET APIs, synthetic books/categories, and
the explicit verification-only API origin
`https://api.verification-only.example/api`. Public direct visits cover Home,
catalog, About, Contact, Login, Register, Cart, book detail, unknown routes,
category/search variants, book 404, and book request error. Authenticated mobile
visits cover Profile, My Books, My Orders, Wishlist, Notifications, Support,
Create Book, and Edit Book. About → Home → catalog navigation checks destination
metadata after the destination view renders. Every sampled head contains exactly
one title and one description; the nine original public route descriptions are
distinct. No runtime exceptions or real API mutations occurred. Temporary
servers and headless Chrome exited.

Ignored browser tooling and results:
`.playwright-mcp/verify-metadata-61-implemented.mjs` and
`.playwright-mcp/metadata-61-implemented/results.json`.

Full verification passed: 145 frontend tests across 29 files, and the full
Django suite with normal password hashing (181 ran, 178 passed, three optional
live Redis tests skipped because `REDIS_TEST_URL` was unset). Those optional
tests previously passed under item 2.5; live Redis was not revalidated here.
An earlier complete frontend run also passed 142 tests before the additional
book/error/receipt regressions were added. Frontend and Django suites ran
sequentially.

Ruff, ESLint, Django system checks, migration drift, production build,
`git diff --check`, and the source-file limit passed. All 271 tracked/nonignored
new source files were within 300 lines (largest: 289); documentation is exempt.
Production-mode Django checks used temporary verification-only HTTPS CORS/CSRF
origins and reported only the intentional staged-rollout HSTS warnings W005/W021.
Independent read-only review found no actionable issues.

## Deployment limitations

The initial HTML remains a shared SPA fallback until JavaScript runs. This work
does not provide route-specific server HTML, guarantee crawler rendering or
search snippets, certify indexing, or verify live hosting. Production API and
frontend origins must be supplied by deployment configuration. Mocked browser
verification does not certify production backend content or deployment behavior.

Heading hierarchy, canonicals, social cards, icons, internal links, sitemap,
robots directives, structured data, and LLMs.txt are separate checklist items.
No deployment, commit, private environment-file edit, migration application,
or existing-upload deletion is included in 6.1.
