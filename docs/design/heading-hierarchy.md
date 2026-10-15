# Heading hierarchy — item 6.2

## Scope

The existing successful page outlines already use one H1, H2 section headings,
and H3 book/step headings. This change addresses the gaps in editor previews,
support ticket nesting, and loading/error/session-recovery views.

`BookCard` accepts a contextual `headingAs` value, defaulting to H3 for catalog,
Home, and wishlist sections. The editor preview uses H2 beneath its page H1.
The preview retains its `inert` container; headings within that preview are not
exposed as interactive or accessible content. The DOM heading level is corrected
as well. Existing classes, typography, sizing, and interactions are retained.

Support tickets use H3 accordion headers beneath the H2 “My messages” section.
The existing accordion buttons, expanded state, and behavior remain intact.

Full-page `Loading` renders one contextual, visually hidden H1 alongside its
existing live status. A generic heading covers the initial Suspense fallback;
page-owned loaders supply their Persian page names. Inline loading components
do not add headings to pages that already own an H1.

The book request-error view also has a visually hidden H1. ProtectedRoute and
Cart supply a hidden H1 when session verification prevents their normal view
from rendering. `SessionStatus` continues to own the existing message/retry
button without adding a heading itself, so public pages that remain usable
during a session failure do not receive a second H1. Successful recovery replaces
the state heading with the normal page heading.

These hidden headings preserve the established layout while remaining available
to assistive technology. No automatic focus change is introduced.

## Regression coverage

`headingHierarchy.test.jsx` covers full-page versus inline loading, protected
session loading/failure/recovery, public content during a session failure, cart
session/loading/recovery, editor versus catalog card levels, and ticket heading
nesting with preserved accordion controls. `bookMetadata.test.jsx` additionally
asserts one H1 across book loading, successful results, request failure,
not-found responses, and recovery.

The tests were run before the implementation and reproduced the existing missing
H1s and incorrect H2/H3 levels, then passed after implementation.

The full frontend suite passed 151 tests across 30 files with
`npm test -- --pool=threads --maxWorkers=1`. ESLint, the production build, Ruff,
Django system/migration-drift checks, and `git diff --check` passed. All 272
tracked/nonignored new source files met the 300-line limit (largest: 289);
documentation is exempt. Production-mode checks used temporary verification-only
HTTPS CORS/CSRF origins and reported only intentional HSTS warnings W005/W021.
Independent read-only review found no actionable issues.

The full Django suite passed with normal password hashing: 181 tests ran,
178 passed, and three optional live Redis integration tests were skipped because
`REDIS_TEST_URL` was unset. Those tests previously passed under item 2.5; live
Redis was not revalidated for this frontend change. The full frontend and Django
suites ran sequentially, after the completed browser audit.

## Verification boundaries

The compiled production browser audit passed 93 heading/metadata samples at
1440px and 390px widths: 26 public direct visits, 16 authenticated visits,
16 held-data loading samples and their 16 ready states, two session-loading
samples and their two ready states, six session-error samples and their six
recovered states, plus About → Home → catalog navigation. Every sample contained
one H1, with no skipped heading levels. Metadata retained one title/description.
The support response included a ticket, so H3 nesting was checked with content.

The runner held APIs for book detail, edit-book, My Books, Wishlist,
Notifications, Support, Contact session verification, and Cart. Session failure
and retry were checked on Profile, Cart, and Home to confirm public content
does not gain a second H1. No runtime exceptions occurred. Temporary servers
and Chrome exited.

An initial run timed out during the held session check because the runner
attempted release before the request entered its hold queue. That incomplete
run was not counted as passing. The corrected runner explicitly waits for the
queued request; the complete rerun passed. Ignored tooling/results are under
`.playwright-mcp/verify-headings-62-implemented.mjs` and
`.playwright-mcp/headings-62-implemented/`, including the initial harness failure.

Browser verification uses a local compiled production build, mocked read-only
APIs, synthetic books/tickets/categories, and the verification-only API origin
`https://api.verification-only.example/api`. No real API mutation is needed to
check heading semantics, loading, or session recovery.

These checks do not certify physical screen-reader speech, production crawler
behavior, or live deployment configuration. Canonical tags and later SEO items
are separate work. No commit, deployment, private environment-file modification,
migration application, or existing-upload deletion is part of this item.
