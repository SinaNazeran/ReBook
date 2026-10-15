# Double-submit prevention (checklist 4.5)

## Guard contract and scope

useSubmissionGuard acquires an in-memory lock synchronously before invoking an
action, including before its first await. A repeated call with the same key
returns without invoking the action. Different keys remain independent. Locks
release in finally on completion, rejection, synchronous throws, and validation
returns. The pending Set is a renderable snapshot; the ref Set enforces exclusion
even when React has not rendered the disabled state yet. Locks belong to the
mounted hook instance, not to browser tabs or server processes.

The eight form flows now call their existing validated submission body through
this guard: login, registration, profile, contact, support, create/edit listing,
existing-order payment, and cart checkout. Every submit event still prevents
default, including a suppressed repeat. Existing disabled buttons, Persian busy
labels, validation/focus handling, error feedback, and request payloads remain.
Invalid input can be corrected and submitted; failed requests allow explicit retry.

Catalog wishlist toggles retain their per-book exclusion and now expose pending
feedback to BookCard: a disabled busy heart control, spinner, and accessible status.
The detail-page wishlist action now has a per-book lock, disabled button, and busy
label. Saved-list optimistic removals use per-book locks and a pending status;
different books can proceed independently and failures restore removed entries.
Detail cart add/remove share a per-book action key; cancellation has its own key.

Individual and bulk notification read actions share one lock. This prevents their
optimistic updates/rollback snapshots from racing. Read controls disable and a
visible live status explains the pending update; navigation links remain usable.

The guard supplements the existing API/backend protection. Durable checkout and
payment Idempotency-Key generation, account ownership, server receipts, and retry
semantics are unchanged. It does not persist mutations, schedule automatic retries,
or claim cross-tab exactly-once behavior. Existing React state and server guards
for other mutation controls remain in place.

## Verification

Verified locally on 2026-10-15:

- Full Django suite with normal hashing: 181 tests ran; 178 passed, three optional
  live Redis tests skipped. Redis was previously verified under item 2.5 and was
  not rerun live for this item.
- Ruff, Django system checks, and migration drift checks passed. Production-mode
  deployment checks reported only intentional staged HSTS warnings W005/W021.
- ESLint and all 123 frontend tests in 21 files passed with
  `npm test -- --pool=threads --maxWorkers=1`. Thirteen new regressions cover all
  eight real forms, same-batch duplicate events, disabled/busy feedback, failure
  retry, invalid-input recovery, detail wishlist duplication, independent catalog
  and saved-list books, and individual-versus-bulk notification serialization.
  All eight forms reproduced two requests before their guards were implemented;
  detail/notification duplicate requests and catalog feedback gaps were also red.
- Production build passed using the explicit verification-only HTTPS API URL
  `https://api.verification-only.example/api`, not deployment configuration.
- Actual-app Chrome checks passed at 1440px and 390px for support and checkout:
  repeated submit events produced one POST, pending buttons disabled and showed
  Persian progress, failure unlocked retry, support success cleared the form,
  and checkout reached its receipt. The checkout retry reused its Idempotency-Key.
  Desktop/mobile pending screenshots were inspected. No runtime exceptions.
- Browser API requests, including POSTs, were intercepted and fulfilled locally;
  no real tickets, orders, or payments were created. Harness selector/preflight
  issues were resolved before the successful final run. The initial selector
  submitted the navigation search form instead of the intended support form.
- Independent review found no actionable issues. `git diff --check` passed.
  All 258 source files met the 300-line limit; largest: 288. Docs are exempt.

Ignored browser artifacts: `.playwright-mcp/submission-audit/`. Chrome needed the
normal desktop outside the sandbox. Ordinary edits and automated checks ran inside
the sandbox. The temporary Vite server was stopped after the subsequent
read-only responsive audit.

No commit, deployment, private environment-file edit, migration application, or
existing-upload cleanup occurred. Production migrations and scheduled cleanup
retries remain requirements. Live cloud storage, CDN behavior, and Nginx syntax
were not verified locally. Payments remain simulated.
