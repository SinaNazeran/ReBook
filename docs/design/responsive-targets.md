# Responsive layout and touch targets (checklist 4.6)

## Implemented scope

The existing 2.75rem / 44px touch-target token now sets real minimum block and
inline sizes for clearing catalog filters, expanding book notes, notification
links, auth-switch links, the footer brand, linked ledger titles, the contact
sign-in action, and receipt copy controls. Ledger links retain desktop ellipsis
and the existing mobile wrapping rule; block padding expands their clickable box.

Modal and responsive-offcanvas header close buttons now have a 44px border-box
with flex shrinking disabled. Their icon backgrounds remain centered. This also
covers responsive offcanvas classes such as offcanvas-lg, not just offcanvas.

The account dropdown has a dedicated styling class and a viewport-bounded width.
Below the desktop navbar breakpoint it also stays within its parent width. A long
email/name can truncate within the menu rather than making a 320px page 357px wide.
The series menu keeps its existing independent layout.

Existing compact filter chips and wishlist hearts keep their 44px expanded
pseudo-element hit areas. Card titles keep the stretched-link hit area. Small
radio inputs use their full-size condition labels, and visually hidden file inputs
use visible upload labels. Hidden skip links and controls in inactive tabs are
not touch-target failures. Modal/offcanvas backdrops make background controls
unavailable; their intentional 0.92 scale is excluded from foreground measurement.

## Verification

Verified locally on 2026-10-15:

- Core browser regression: 30 scenarios across 320, 390, 768, 1024, and 1440px,
  covering filtered catalog, detail notes, notifications, login, profile, and cart.
  Explicit 44px assertions reproduced the original 36px clear-filter failure,
  then passed after implementation. No page overflow or runtime exceptions.
- Broader browser pass: 70 scenarios at the same widths covering home,
  registration, editor/condition labels, long own-listing titles, orders,
  wishlist, support accordion, anonymous contact, about, unknown routes, expanded
  mobile navigation/account menus, filter sheets, and payment dialogs. Final run:
  no page overflow, no runtime exceptions, changed visible targets at least
  44x44px. Long account content and close buttons were corrected during this pass.
- Actual receipt recovery at 390/1440px additionally verified the copy button's
  44px dimensions and page containment. Support/checkout repeat and retry checks
  still passed, including reuse of the checkout idempotency key.
- Screenshots were inspected for mobile/tablet layouts, long wrapped titles,
  bounded account menus, filter sheets, and payment dialogs. Data and submissions
  were mocked locally; no real uploads, tickets, orders, or payments were created.
- Full Django suite with normal hashing: 181 tests ran, 178 passed, three optional
  live Redis tests skipped. These Redis tests passed under 2.5; live Redis was
  not rerun for this item.
- Ruff, Django system/migration checks, and ESLint passed. Production-mode checks
  reported only intentional staged HSTS warnings W005/W021.
- Final complete frontend run: 123 tests passed in 21 files with
  `npm test -- --pool=threads --maxWorkers=1`. An earlier run passed 121 tests but
  failed to start the appRoot.test.jsx worker (pool response timeout); it was not
  counted as passing. A complete rerun after browser work passed all 123 tests.
- Production build passed, including a repeat after the final receipt CSS change,
  with `https://api.verification-only.example/api`. This is not deployment config.
  One build emitted a plugin-timing advisory, not a failure.
- Independent review found no actionable regressions. `git diff --check` passed;
  all 258 source files met the 300-line limit (largest: 289). Docs are exempt.

Browser artifacts are ignored under `.playwright-mcp/responsive-audit/` and
`.playwright-mcp/submission-audit/`. Chrome required the normal desktop outside the
sandbox; ordinary repository edits/checks ran inside the sandbox. The temporary
Vite server was stopped after the next read-only accessibility audit.
Browser widths are emulated; physical touch devices and a
screen-reader pass were not tested here.

No commit, deployment, private environment-file edit, migration application, or
existing-upload cleanup occurred. Production migrations and scheduled cleanup
retries remain requirements. Live cloud storage, CDN behavior, and Nginx syntax
were not verified. Payments remain simulated.
