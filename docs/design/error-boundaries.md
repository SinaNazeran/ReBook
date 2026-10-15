# Global and route error boundaries (checklist 4.4)

## Boundary placement and recovery

This is a React/Vite SPA, so Next.js error.tsx/global-error.tsx conventions do
not apply. AppRoot mounts a global ErrorBoundary outside BrowserRouter and App.
It covers router, auth/cart providers, navigation, session status, footer, and
toaster React render/lifecycle failures. Its fallback uses native elements,
ordinary links, and a reload button; it has no router, context, API, or component
library dependency. Existing application CSS styles it, but its text and controls
remain ordinary usable HTML without that styling.

The existing boundary around Suspense/Routes is now wrapped in RouteErrorBoundary.
A failed page leaves navigation and the footer usable. A pathname or query change
clears the failed state, allowing navigation to another page or another URL for
the same page. Healthy pages are not remounted by this boundary when URLs change.
Hash-only changes do not retry a failed page. A still-broken destination remains
contained. Reload is a full document reload, which can also recover from stale
lazy-module state after a deployment; it does not invoke a mutation retry handler.

Both fallbacks show Persian recovery text, an alert, a focused heading, and native
home/support links. The global fallback supplies its own main landmark and RTL
language/direction. The route fallback uses the existing main landmark. Raw
exception messages/stacks are not rendered. Existing console error reporting is
retained; external monitoring belongs to item 7.2. Recovery copy asks users to
check request status before repeating a submission/payment after a crash.

React boundaries catch descendant render and lifecycle failures, including effect
failures and errors surfaced by lazy rendering. They do not catch arbitrary event
handler exceptions, detached asynchronous callback failures, initial script
download/evaluation failures before mounting, or failures of the outermost
fallback itself. Existing request-level error handling remains necessary.

## Verification

Verified locally on 2026-10-15:

- Full Django suite with normal password hashing: 181 tests ran; 178 passed and
  three optional live Redis tests skipped. Those Redis tests passed under 2.5;
  live Redis was not rerun for this item.
- Ruff, Django system checks, and migration drift checks passed. Production-mode
  deployment checks reported only intentional staged HSTS warnings W005/W021.
- ESLint and all 110 frontend tests in 19 files passed using
  `npm test -- --pool=threads --maxWorkers=1`. Six new tests cover global
  render/effect failures, route/query recovery, preservation of healthy mounted
  pages, router/root composition, focused fallback, and private-detail omission.
  The missing global presentation and failed route recovery were reproduced as
  red tests before implementing their behavior.
- Production build passed with the explicit verification-only URL
  `https://api.verification-only.example/api`; this is not deployment config.
- Actual-app Chrome checks passed at 1440px and 390px for route, navigation-shell,
  and auth-provider crashes. Verified shell retention for route failure, route
  navigation recovery, actual reload/home-link recovery, focused headings, no
  exposed exception text, and no horizontal overflow. Screenshots were inspected.
- Browser faults were injected only into intercepted development-module responses
  by an ignored temporary harness. No fault hooks were added to application code.
  API responses were mocked GET/OPTIONS data; no data was submitted. Expected
  injected exceptions appeared in development console reporting.
- Independent code review found no actionable issues. `git diff --check` passed;
  all 255 source files met the 300-line limit (largest: 288). Docs are exempt.

Browser artifacts: ignored `.playwright-mcp/boundary-audit/`. Chrome required the
normal desktop outside the sandbox; ordinary edits/tests stayed in the sandbox.
The temporary Vite server was stopped after verification.

No commit, deployment, private environment-file edit, migration application, or
existing-upload cleanup occurred. Production migrations and scheduled cleanup
retries remain requirements. Live cloud storage, CDN behavior, and Nginx syntax
were not verified locally.
