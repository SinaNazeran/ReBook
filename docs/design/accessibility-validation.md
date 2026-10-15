# Semantic HTML and accessibility (checklist 4.8)

## Audited foundation and completed fixes

The existing SPA uses a labeled navigation landmark, one main landmark with a
skip link, a footer, semantic buttons/links, form labels, fieldsets/legends, and
named sections. React Bootstrap supplies the existing dialog, dropdown, and tab
semantics. Existing custom upload labels have visible focus outlines when their
visually hidden inputs receive keyboard focus. Existing alerts/live statuses,
shared Form invalid states/descriptions, condition-group description, and the
seller-note disclosure's expanded/controls attributes are retained.

The approved changes close custom-control validation gaps:

- Each condition radio exposes aria-invalid while the condition has an error.
  The existing fieldset description still references condition-error. Error
  focus still moves to condition-good; choosing another condition clears both
  the error and invalid states. The group description is not duplicated on each
  radio, avoiding repeated descriptions while moving within the group.
- The cover file input exposes aria-invalid alongside its existing cover-error
  description. A valid replacement clears both stale error attributes.
- The avatar file input exposes aria-invalid and a conditional description
  referencing the stable avatar-error ID. The existing alert role remains, so
  immediate announcement and later field review are both supported. Valid file
  replacement clears the error, invalid state, and description reference.

Validation rules, request payloads, upload handling, and focus behavior are not
changed. Native controls and existing associations remain in use.

## Verification

Verified locally on 2026-10-15:

- Three new integration regressions against actual CreateBook/Profile reproduced
  the missing invalid states before implementation, then passed. They cover a
  server condition error, rejected cover/avatar file types, valid replacements,
  preserved group descriptions/alerts, and removal of stale attributes.
- Full frontend suite: 126 tests passed in 22 files using
  `npm test -- --pool=threads --maxWorkers=1`. ESLint passed.
- Chrome accessibility-tree checks at 390px and 1440px confirmed invalid=true
  on the three control types, the condition group's existing error description,
  the avatar input's new error description, and correction/recovery. Real Tab
  navigation reached the cover input and activated the associated label outline.
  A screenshot taken before scrolling settled was rechecked: after settling the
  outlined label was within the viewport at both widths. No focus fix was needed.
- Browser responses and file objects were mocked/local. No actual listing,
  profile upload, or other mutation was sent to the backend. No runtime exceptions.
  The harness was updated to accept its own existing unsaved-form navigation
  prompts after testing a valid image replacement; the final run passed.
- Full Django suite with normal password hashing: 181 tests ran, 178 passed,
  three optional live Redis tests skipped. Live Redis was previously verified
  under 2.5 and was not rerun here.
- Ruff, Django system/migration checks passed. Production-mode checks reported
  only intentional staged HSTS warnings W005/W021.
- Production build passed with the explicit verification-only HTTPS API URL
  `https://api.verification-only.example/api`, not deployment configuration.
  The plugin-timing advisory was not a build failure.
- Independent review found no actionable issues. `git diff --check` passed;
  all 259 source files met the 300-line limit (largest: 289). Docs are exempt.

Browser artifacts are ignored under `.playwright-mcp/responsive-audit/`, including
accessibility-results.json and focus-geometry snapshots. The temporary Vite server
was stopped. Chrome required the normal desktop outside the sandbox; ordinary
edits and automated checks ran in the sandbox.

This is a bounded code/keyboard/accessibility-tree audit, not a claim of complete
WCAG certification. Physical assistive-technology and screen-reader speech output
were not tested. Broader audit reference: Vercel Web Interface Guidelines,
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
(accessibility/focus/form rules; other checklist phases remain separate).

No commit, deployment, private environment-file edit, migration application, or
existing-upload cleanup occurred. Production migrations and scheduled cleanup
retries remain requirements. Live cloud storage, CDN behavior, and Nginx syntax
were not verified; payments remain simulated.
