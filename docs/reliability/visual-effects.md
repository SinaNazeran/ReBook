# Visual effects performance — checklist 5.4

## Confirmed issue and bounded change

The hero's depth renderer uses a GSAP ticker to update cover transforms,
opacity, pointer state, and camera styles. A ScrollTrigger already paused it
after an ordinary viewport exit, but setup called `run(true)` unconditionally.
When book data arrived after the user had scrolled beyond the hero, the trigger
started inactive and no toggle occurred to stop the renderer.

The browser reproduced continuous offscreen style updates: 698 mutations at
1440px and 703 at 390px during a 600ms sample. The hero remained fully outside
the viewport. In the same audit, an ordinary viewport exit correctly stopped
updates, isolating the problem to initial visibility synchronization.

The renderer now initializes from the existing visibility trigger's `isActive`
state and reconciles that state again on refresh. Entry/exit continue through
the same idempotent controller. There is no second observer or animation loop.
Animation parameters, CSS effects, reduced-motion gating, contexts, font/import
cancellation, safety timers, pointer behavior, and direct-style cleanup remain
in place.

## Other visual-effect foundations

The source audit found no `backdrop-filter` use. Hero flight and the main
interactive transitions primarily use transforms and opacity; scrolling is
managed by ScrollTrigger rather than an application scroll handler doing
unbounded work. Blur on the hero text is a bounded entrance tween; the page
push-back blur is tied to modal/offcanvas state. The skeleton opacity animation
is conditional on loading and the motion preference. No blanket layer hints,
visual redesign, or unrelated transition changes were introduced.

## Regression and browser verification

Two unit regressions first failed against the unchanged runtime:
offscreen initialization registered a ticker, and refresh had no visibility
reconciliation callback. Both now pass alongside the prior cleanup/font tests.
They cover initialization, entry, exit, refresh without a toggle, repeated
refresh, unmount, and delayed font completion after cleanup.

The production browser runner passed four combinations: widths 1440 and 390px,
each at normal speed and 4× CPU throttling. Every combination tested:

- Held book data, scrolling fully past the hero, and then releasing the data.
- Resize/ScrollTrigger refresh while the initialized hero remains offscreen.
- Entry and ordinary exit.
- Reduced motion, re-enabling motion while offscreen, and subsequent re-entry.
- Navigation away while the renderer is active, including observing retained
  detached nodes for leaked writes after cleanup.

All offscreen and reduced-motion samples recorded **zero style mutations** in
600ms, including late initialization and refresh. Visible samples recorded
changing cover transforms at both CPU settings, and detached nodes received no
late writes after unmount. No runtime exceptions occurred.

The runner used compiled production files with mocked catalog/session APIs and
cover placeholders. No real API mutation or upload occurred. Temporary HTTP
servers and Chrome exited. Ignored local tooling/results are under
`.playwright-mcp/verify-effects-54.mjs` and
`.playwright-mcp/effects-audit-54/`; `before-54.json` preserves the baseline.

This measures unnecessary rendering work and lifecycle behavior. Headless
Chrome's CPU-throttling proxy, with GPU disabled, does not certify sustained
60fps on physical lower-end phones or real GPUs. No production field frame
timing or live hosting behavior was measured.

## Full verification status

Targeted motion tests: nine passed across three files. ESLint, the production
build, Ruff, Django system checks, and migration drift checks passed. Production
mode reported only intentional HSTS warnings W005/W021, using explicit
verification-only HTTPS CORS/CSRF origins. The frontend build used
`https://api.verification-only.example/api`, not deployment configuration.

The complete frontend rerun passed all 137 tests in 27 files using
`npm test -- --pool=threads --maxWorkers=1`. The full Django suite passed with
normal password hashing: 181 tests ran, 178 passed, and three optional live Redis
tests were skipped. The Redis tests previously passed under 2.5 and were not
rerun here.
The initial full frontend run passed 124 tests in 26 files but hit a worker
startup timeout before `pagination.test.jsx` began. It was not counted as a
passing full run. The successful complete rerun ran without the browser audit
or the full Django suite alongside it.
All 265 source files met the 300-line limit (largest: 289); documentation is
exempt. `git diff --check` passed, and independent read-only review found no
actionable issues.

No commit, deployment, private environment-file edit, migration application, or
existing-upload deletion occurred. Production migration/cleanup scheduling and
the simulated-payment limitation remain unchanged.
