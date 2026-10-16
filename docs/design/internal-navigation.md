# Internal linking and breadcrumbs — checklist 6.6

## Audit and scope

The existing navbar, footer, category tabs, book cards, and contextual page links
use React Router links, which render anchors with real `href` values. The book
cover transition preserves the anchor and native modified clicks. Navbar search
submission, logout, post-save redirects, retry controls, and filter submission
are actions, not replacements for the corresponding navigation links.

Two changes were needed: there were no breadcrumbs, and the catalog continuation
control changed the page URL through JavaScript without exposing a link target.
This item adds rendered navigation to those existing flows. Google's [link
guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
describes anchors with `href` as the crawlable link form.

No server-rendering layer, backend endpoint, authorization change, or JSON-LD is
introduced. Initial HTML remains the existing client-rendered SPA shell. These
links become available after React renders; this work does not certify discovery
by a crawler that does not execute JavaScript. Structured data remains item 6.9.

## Breadcrumb behavior

| View | Trail |
| --- | --- |
| Catalog | Home → Books |
| Resolved category | Home → Books → known category ancestors → current category |
| Loaded book | Home → Books → known category ancestors/category → current book |
| Book without a category | Home → Books → current book |
| Listing editor, ready or blocked | Home → My books → Edit listing |

The actual labels are Persian. Home and other flat pages do not acquire a
redundant breadcrumb. Book/editor loading, missing, and failed book views do not
retain a previous listing's trail. Editor blocked states retain the generic
management trail, without exposing another listing's title.

Each trail uses a named `nav`, ordered list, ancestor `Link` elements, and one
terminal non-link `span` with `aria-current="page"`. Decorative left chevrons
are hidden from assistive technology. It adds no heading. This follows the
[WAI breadcrumb pattern](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/).

Category ancestry comes from the existing complete-tree category loader/cache.
Book pages without a category do not request category data for breadcrumbs.
When a parent is unavailable, show the known leaf; a cycle falls back to that
leaf rather than inventing a path or looping. An unknown catalog slug has the
generic catalog trail. Recovery and route changes recompute the current trail.

Category destinations are constructed with `URLSearchParams`, using fixed local
`/books` paths. Breadcrumb links navigate to the structural ancestor and clear
search/price/condition/pagination filters. Existing category tabs and filter
links retain their previous filter-preservation behavior. User-provided labels
are rendered as text in `bdi`, never HTML.

The approved visual refinement follows ReBook's printed pocket-book language:

- The catalog trail sits inside the existing masthead, below the category tabs
  and above the page title. Its existing series rule remains the main divider.
- Book/editor trails form quiet page-context rows with the existing hairline
  rule token, aligned with the sheet content.
- Ancestors use muted ink at rest; the current page uses ink and the existing
  500 UI weight. Hover/focus uses the existing darker green hover token, an
  underline, and the global focus ring. There is no duplicated component ring.
- The existing `series-index-mark` provides a small decorative accent, using
  the book/category ink or the editor's claret brand ink.
- Typography remains Vazirmatn FD at the small-label scale, with the existing
  1.8 body line height. Persian lettering and mixed-script isolation are retained.
- Link heights are 32px on desktop and at least 44px on mobile. Spacing uses
  existing tokens, logical properties, and the existing Bootstrap breakpoint.
- Long current labels are visually clamped to two lines. Their complete text
  remains in the DOM for accessibility and in the full page heading; ancestors
  remain available and wrap without horizontal overflow.

The refinement reuses existing fonts, colors, components, and dependencies.
Its only transition is the existing-token hover color change, disabled under
reduced motion.

## Catalog continuation

The public catalog's “show more” control is now a real link. Its local target
preserves the current filter/query pairs and sets the next page based on the
last successful load. It does not trust a server-supplied absolute `next` URL.
Direct loading of that URL uses the existing cumulative catalog-page behavior.
The existing ten-page cap on initial cumulative loading is unchanged; this item
does not certify exhaustive discovery of listings beyond that cap.

An ordinary click prevents full navigation and invokes the existing append
handler, preserving URL replacement, duplicate-row suppression, and focus on
the first newly loaded book. Modified clicks retain native link behavior. A
busy link keeps its `href` and focusability but blocks duplicate ordinary loads.
Its established green outline/letterpress treatment is retained. A token-spaced
hairline above the continuation row makes it a consistent catalog section ending.
Personal-list continuation controls remain buttons: those append private data
without navigating to a public catalog URL.

Regression testing exposed an existing same-page retry bug: after an append
failure the URL already referred to the requested page, so setting it again did
not rerun the effect. A conditional reload trigger now retries that page while
retaining loaded rows. Ordinary successful pagination does not need that trigger.

## Initial implementation verification

Focused tests cover semantic links/current-page ownership, router ancestor
navigation, safely encoded and missing/cyclic categories, category recovery,
book changes, escaped labels, native modified clicks, busy guards, and append
failure/retry with URL/filter preservation and deduplication.

The production-build browser harness passed 31 samples at desktop/mobile widths,
including a 320px mixed-language long-title case. It covers category ancestry,
unknown categories, category-service failure, no-category books, book error
views, ready/blocked editing, ancestor navigation, keyboard focus,
same-URL append retry and focus transfer, and direct continuation URLs. It also
checks one H1/title/description, nonempty real navigation targets, valid fragment
targets, terminal current-page semantics, and breadcrumb overflow. No runtime
exceptions were captured. Screenshots were inspected at mobile widths.

Browser APIs were mocked and read-only; no real mutations occurred. The local
harness applies emitted frontend response headers. Its server and browser were
stopped. Build origins were explicitly verification-only:
`https://frontend.verification-only.example` and
`https://api.verification-only.example/api`.

The complete frontend rerun passed 170 tests across 35 files with
`npm test -- --pool=threads --maxWorkers=1`. The first full attempt passed 164
tests across 34 files but failed to start the `headingHierarchy.test.jsx` worker;
it was a failed run, not a passing result. The full rerun passed without test
configuration or application changes.

Required repository checks passed on 2026-10-16:

- Full Django suite with normal password hashing: 181 tests ran in 311.198s;
  178 passed and three optional live Redis tests skipped because
  `REDIS_TEST_URL` was not configured. Those three were not counted as passing.
- Django system checks and migration drift: passed.
- Ruff, frontend ESLint, production build, and `git diff --check`: passed.
- All 282 checked source files were within 300 lines; largest was 289.
- Production-mode Django checks reported only the intentional staged HSTS
  warnings W005/W021. Security policy was unchanged.

Browser work finished before the full suites, and the complete frontend and
Django suites ran sequentially. Independent read-only review found no actionable
issues. No deployment, physical screen-reader speech, real search-engine
crawl/indexing, or hosting-level HTTP status behavior is certified by these
checks. No commit is made by this task.

## Approved visual refinement verification

The refined production build passed 35 browser samples at 1440px, 390px, and
320px as applicable. Existing navigation, fallback, retry, focus, and metadata
checks were retained. Additional checks cover catalog masthead placement, theme
colors and weight, decorative marks, mobile target heights, two-line visual
clamping with complete DOM text, 200% text resizing, 200% CSS layout zoom,
forced-colors focus visibility, and motion preferences. CSS layout zoom is not
a certification of native browser zoom UI or physical-device behavior.

Contrast checks used rendered/computed paper and text colors across all eight
existing series inks. Muted and current text passed 4.5:1, and the minimum hover
text contrast was 5.35:1. Final browser output captured no runtime exceptions.
Desktop/mobile catalog, book, editor, long-title, focus, and continuation
screenshots were inspected. The temporary server and browser were stopped.

Fresh verification after the approved refinement:

- Full frontend suite: 170 tests passed across 35 files in 181.16s, using
  `npm test -- --pool=threads --maxWorkers=1`. This run had no worker errors.
- Full Django suite with normal password hashing: 181 tests ran in 295.225s;
  178 passed and three optional live Redis tests skipped because
  `REDIS_TEST_URL` was not configured. They are not counted as passing.
- Focused regression tests (10 across three files), frontend ESLint, production
  build, Ruff, system/migration checks, and `git diff --check`: passed.
- All 282 checked source files remained within 300 lines; largest was 289.
- Production checks reported only intentional staged HSTS warnings W005/W021.
- Independent read-only review found no actionable issues.

Browser work finished before the full frontend and Django suites, which ran
sequentially. Builds used the verification-only HTTPS origins stated above.
The initial implementation results above remain historical; these results cover
the approved visual refinement. Physical-device/screen-reader and native browser
zoom behavior remain uncertified. No commit or deployment occurred.
