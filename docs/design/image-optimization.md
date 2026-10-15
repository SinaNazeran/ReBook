# Image sizing and optimization — checklist 5.2

## Existing foundations

New book covers and avatars already pass through `config.images.shrink_new_upload`
on model saves, including API and admin uploads. Images are EXIF-transposed,
bounded to 1000×1500 for covers or 400×400 for avatars, and encoded as WebP at
quality 82. Existing committed files are not recompressed on unrelated saves.
The full Django suite covers upload sizing/conversion and cover dimensions.

Book cards, hero covers, and ledger thumbnails reserve cover space with CSS
aspect ratios or fixed dimensions. Book detail images receive width/height from
the API's cover metadata. Navbar avatars have explicit dimensions; profile
avatars occupy a fixed square.

The standalone book-detail cover describes the book in its alt text. Editor
previews distinguish the current cover from a selected replacement. Empty alt
text on redundant card/ledger covers and avatars avoids repeating nearby book
titles or account/control names. Hero links have explicit accessible names.

## Bounded change

The editor's `.cover-picked img` previously had only maximum width/height.
Before its existing cover loaded, the image occupied no space, so the controls
and following description field moved when intrinsic dimensions became known.

The image now provides its own responsive 3:4 frame, up to 9rem wide, using an
explicit CSS width and aspect ratio. `object-fit: contain` displays the full
portrait or landscape cover inside that frame. Letterboxing is intentional;
the existing surface color and border radius remain in use.

No upload logic, controls, validation, alt text, backend, stored images, or
dependencies changed. Adding/removing controls after an explicit file selection
still follows the existing form behavior; this change prevents image decoding
from changing the preview's reserved size.

## Browser regression verification

An automated assertion first failed against the unchanged production build:
the pending image had height 0, the preview/control row grew from 44px to 192px,
and the description field moved by 148px after loading.

After the CSS change, all ten production-browser scenarios passed:

- Portrait and landscape covers, held pending then decoded, at widths 320, 390,
  768, and 1440px.
- Failed image requests at 320 and 1440px.
- Each scenario also selected an invalid local file, checked the existing error
  association, selected a valid landscape PNG, checked recovery and retained
  keyboard focus, and restored the existing cover.

In every case the image frame stayed 144×192px and image loading/failure moved
the description field by **0px**. Full-cover containment, no horizontal overflow,
replacement/current-cover alt text, and the associated change-photo label were
verified. Screenshots were inspected, including the 320px landscape layout.
There were no runtime exceptions.

The browser used a mocked authenticated editor and synthetic local images. No
form submission or real API mutation occurred. The synthetic remote fixture was
SVG for deterministic dimensions; valid replacement selection used a generated
PNG. WebP encoding is covered by the existing backend implementation/tests,
not by the mocked browser fixture.

The regression runner and results are ignored local verification tooling:
`.playwright-mcp/verify-bundle-51.mjs --images` and
`.playwright-mcp/image-audit-52/results.json`, with ten screenshots alongside.
The runner's assertions verified the original failure before the fix and the
stable geometry afterward. Its temporary servers and Chrome exited.

## Verification status

Full Django verification passed with normal password hashing: 181 tests ran,
178 passed and three optional live Redis tests were skipped. Those Redis tests
previously passed under 2.5 and were not rerun here.

Ruff, ESLint, Django system checks, migration drift checks, and the production
build passed. Production-mode Django checks used explicit verification-only
HTTPS CORS/CSRF origins and reported only intentional HSTS warnings W005/W021.
The build used `https://api.verification-only.example/api`, not deployment
configuration. Source limits passed for all 264 source files (largest: 289).
Independent read-only review found no actionable issues.

The complete frontend rerun passed all 134 tests in 26 files using
`npm test -- --pool=threads --maxWorkers=1`. The initial run passed 121 tests in
25 files but encountered a worker startup timeout before `pagination.test.jsx`
started; it was not counted as a passing full run. The successful full rerun ran
after the Django suite finished. `git diff --check` also passed.

These local measurements are not production field CLS or a complete accessibility
certification. Existing uploads were not rewritten or deleted. No commit,
deployment, migration application, or private environment-file edit occurred.
Live storage/CDN behavior and production image inventory were not verified.
