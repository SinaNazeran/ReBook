# Design tokens (checklist 4.1)

## Token ownership

- frontend/src/styles/theme/primitives.css owns shared white/black primitives,
  RGB channels, the spacing scale, corner radii, and focus-ring width.
- theme/tokens.css owns the existing brand and semantic palette, Bootstrap
  mappings, overlay/raised shadows, typography, and motion defaults.
- depth/controls.css retains the existing object-depth tokens and their
  ordering. It also names the navbar shadow and the shared inset field shadow.
- theme/typography-controls.css defines the focus shadow at each consuming
  control so a locally overridden Bootstrap focus-ring color still applies.

Import order: primitives, semantic theme, app styles, depth, then the existing
third-party toast stylesheet. No runtime dependencies were added.

## Using the scale

Spacing uses quarter-rem steps: --rb-space-1 is 0.25rem,
--rb-space-4 is 1rem, and --rb-space-1-5 is 0.375rem.
The additional --rb-space-px-2 preserves existing fixed two-pixel gaps.
Use these for reusable margin, padding, and gap values; keep the original unit.
Do not replace a pixel value with a rem approximation.

Bootstrap's default, small, large, and extra-large radius variables map to the
corresponding ReBook radius tokens. One- and two-pixel print details use
--rb-radius-hairline and --rb-radius-print; circles and pills remain distinct
(50% versus 999px).

Keep component-dependent shadow formulas at their consuming scope.
Moving a formula containing local variables to :root can resolve its color
before a component overrides that color. Existing --shade, --series-*,
--key-*, and --d-* behavior was preserved, not redesigned.

## Intentional literals

The refactor replaces matching values, without rounding or changing geometry.
Zero/auto, component widths and heights, responsive breakpoints, typography,
animation transforms/timing, illustration geometry, bespoke cover/receipt frame
shadows, and one-off corner shapes remain local where appropriate.
Encoded SVG colors remain inside their data URLs: document CSS variables do
not substitute inside SVG image documents.

Gradient color spaces, mix percentages, alpha values, contrast/reduced-motion
rules, and source order remain unchanged. Token consolidation does not certify
the separate RTL, accessibility, responsive-layout, animation, or SEO items.

## Visual verification

Local headless Chrome compared the committed CSS baseline with the working CSS
using identical static component fixtures and the same Bootstrap/toast CSS.
Fixtures cover navigation/footer, catalog card, tabs, forms, buttons, dropdown,
notification/support surfaces, and a toast. A local focus-color override is
included to check variable scope.

Five scenarios (1440px desktop, 390px mobile, reduced motion, increased contrast,
and a 20px root font) each exercise rest, focus, hover, and pressed states.
All standard computed properties and element rectangles, including pseudo-element
styles, and screenshot PNG bytes must match. Transitions/animations are frozen
for elements and pseudo-elements to remove capture-time differences.

This is CSS equivalence verification, not full end-to-end coverage: fixture text
uses the available fallback font and there are no live API calls, authenticated
journeys, or production CDN/storage checks. Local verification artifacts and the
harness are in the ignored .playwright-mcp/token-audit/ directory.

## Verification record

Verified locally on 2026-10-15:

- Django: 181 tests ran, 178 passed, three optional live Redis tests skipped.
  Normal Django password hashing was used. Live Redis was not rerun for 4.1.
- Ruff, Django system checks, and migration drift checks passed.
- Deployment checks with process-only production verification settings reported
  only the intentional staged-HSTS warnings W005 and W021. An earlier check with
  local development settings reported W004/W008/W012/W016/W018; those settings
  are not a deployment configuration.
- Frontend ESLint passed. The first test run passed 55 tests before a worker
  startup timeout; a full retry with --pool=threads --maxWorkers=1 passed all
  68 tests across 12 files, with no remaining worker errors.
- Production build passed with the explicit verification-only API URL
  https://api.verification-only.example/api. This is not a deployment target.
  Vite emitted a plugin-timing advisory, not a build failure.
- All 28 changed stylesheets matched their committed declarations after
  expanding the introduced tokens and removing only the new token definitions.
- All 20 visual scenario/state comparisons matched computed properties,
  element/pseudo-element styles, rectangles, and PNG bytes. Mobile uses a
  viewport meta tag and a true 390px layout. Desktop/mobile screenshots were
  inspected; fixture checks do not certify actual route responsiveness.
- git diff --check passed; all 241 source files were within 300 lines
  (largest: 288 lines). Documentation is exempt.

No commit, deployment, private environment-file edit, database migration, or
existing-upload cleanup was performed. Prior deployment limitations remain:
production migrations and scheduled cleanup retries are still required; live
cloud storage, CDN behavior, and Nginx syntax have not been verified locally.

