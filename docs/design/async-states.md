# Loading, empty, and error states (checklist 4.3)

## Completed scope

Existing page-level loading, empty, and error presentations remain in place.
This item closes the audited gaps in auxiliary category data, session startup,
and unread notification counts. Shared feedback is Persian and uses the existing
design tokens. Category loading includes a static skeleton placeholder; failure
is an alert with a contextual retry button. A successful empty response has
different text from a failed request. Retry controls have a 44px minimum height.
Navigation feedback explicitly uses the light foreground token on its dark surface.

Category states are displayed in navigation, footer, home collections, catalog,
and the book editor. The complete-tree pagination cache and its existing TTL are
preserved. Individual mounted consumers own their retry state; an existing cached
tree can satisfy a later retry. A failed refresh retains previously usable data.
Catalog/home books remain usable when categories fail. Editor fields and the
saved category survive failure and retry; an unavailable saved category remains
visible while the select is disabled. No form submission is triggered by retry.

Session startup distinguishes a genuine HTTP 401 from network, 403, and server
errors. Only the former establishes an anonymous session. Other failures show a
global retry alert and keep identity unresolved. Protected pages stay hidden,
cart queues stay inactive, and public book cart actions are disabled. Defensive
calls into an inactive cart queue reject explicitly rather than reporting success.
Session recovery preserves the existing generation/ownership guards, including
late responses after login or a newer session attempt.

Unread counts distinguish unknown, current zero, and a stale last-known value.
Failures provide inline retry rather than repeated toasts. The notification list
remains usable independently. Polling does not overlap outstanding requests;
superseded requests are aborted and late responses cannot cross account changes.
Logout clears the displayed identity's state, including logout and return to the
same account. A stale same-account count is explicitly labeled as last known.

## Verification

Verified locally on 2026-10-15:

- Full Django suite with normal password hashing: 181 tests ran, 178 passed,
  three optional live Redis tests skipped. These Redis tests previously passed
  under item 2.5; live Redis was not rerun for this item.
- Ruff, Django system checks, and migration drift checks passed. Production-mode
  system checks reported only the intentional staged HSTS warnings W005/W021.
- ESLint and all 104 frontend tests in 17 files passed using
  `npm test -- --pool=threads --maxWorkers=1`. Twenty new regressions cover
  failure/recovery, empty versus failed responses, preserved editor changes,
  unresolved identity/cart behavior, stale responses, and polling cancellation.
  Existing cart and category regressions were adapted to the explicit contracts.
- Production build passed, including a repeat after the final CSS contrast fix,
  with `VITE_API_URL=https://api.verification-only.example/api`. This is a
  verification-only URL, not deployment configuration.
- Actual-app Chrome checks passed at 1440px and 390px: session failure/recovery,
  no guest cart fetch while identity is unknown, disabled public cart actions,
  distinct category failure/empty states, retained book content, preserved editor
  selection and unsaved title, and unread retry without losing the list.
  Desktop/mobile screenshots were inspected and navigation contrast corrected.
  No runtime exceptions or data submissions occurred. Browser responses were
  mocked GET/OPTIONS data, not live backend authentication.
- Independent code review found two cart/notification request-lifecycle issues;
  regression tests and fixes were applied. Follow-up review found no remaining
  actionable issues. Initial red tests and browser harness failures were resolved.
- `git diff --check` and the 300-line source-file limit passed. Largest source:
  288 lines. Documentation is exempt.

Local browser artifacts are in the ignored `.playwright-mcp/async-audit/` folder.
Headless Chrome required execution outside the sandbox's private desktop; normal
repository edits and verification ran inside the sandbox. The temporary Vite
server was stopped after browser verification.

No commit, deployment, private environment-file edit, migration application, or
existing-upload cleanup was performed. Production still requires migrations and
scheduled file-cleanup retries. Live cloud storage, CDN behavior, and Nginx syntax
were not verified. Runtime exception containment is audited separately in 4.4.
