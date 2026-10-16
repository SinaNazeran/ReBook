# Favicon and app icons — checklist 6.5

ReBook keeps its existing SVG book-spine mark and derives the raster variants
from that source. No external artwork, new branding, or runtime dependencies are
introduced.

| Asset in `frontend/public/` | Purpose |
| --- | --- |
| `favicon.svg` | Existing scalable tab/bookmark mark, declared with `sizes="any"` |
| `favicon.ico` | Legacy/root fallback containing 16×16, 32×32, and 48×48 images |
| `apple-touch-icon.png` | Opaque 180×180 Apple touch icon |
| `icon-192.png`, `icon-512.png` | Transparent general-purpose manifest icons |
| `icon-maskable-512.png` | Opaque 512×512 icon with extra safe-zone padding |
| `site.webmanifest` | Persian name, RTL direction, browser display, icon declarations |

`frontend/index.html` declares the ICO fallback before the SVG icon, plus the
Apple touch icon and manifest. The manifest's theme color matches the existing
HTML theme color. Its start URL, scope, and identity are `/`; names and direction
match the Persian application. Display remains `browser`. This item does not
register a service worker, provide offline support, or claim PWA installability.

The maskable icon uses a full white background. All non-background pixels,
including antialiasing, fit inside the centered circle with radius 40% of the
image width. The Apple icon is opaque and has no pre-rendered platform mask.
Platform launchers apply their own crop. See the [manifest icon reference](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons).

## Regeneration

From the repository root, using Pillow already pinned in backend requirements:

```powershell
.\venv\Scripts\python.exe frontend/scripts/generate_icons.py
```

The generator reads the existing SVG rectangles and renders each ICO size
individually with supersampling. It rejects a changed viewBox or unsupported
shape type so future logo revisions require updating the renderer. Commit the
generated assets with their source changes; ordinary frontend builds only copy
the checked-in assets and do not need Python.

## Hosting and verification

Vite copies the public assets to the dist root. Serve the manifest as
`application/manifest+json`, PNG as `image/png`, SVG as `image/svg+xml`, and ICO as
`image/x-icon` or another supported ICO MIME type. Do not rewrite missing icon
URLs to the SPA HTML. These stable filenames need revalidation when replaced;
they are not hashed assets eligible for the existing immutable-cache rule.

Local verification checks the source head links, manifest declarations, decoded
PNG dimensions/opacity, every ICO frame, maskable safe-zone pixels, repeatable
generation, and source-to-dist byte equality. Light/dark contact-sheet inspection
covers small ICO frames and larger app icons.

Chrome checks the production build at 1440px and 390px widths on Home, About, and
catalog: six samples, seven asset URLs per sample, successful image decoding,
zero manifest parse errors, and no registered service workers or runtime errors.
The local static harness applies the generated frontend response headers and
mocks read-only API responses; it does not contact a real deployment.

Required repository verification passed on 2026-10-16:

- Full Django suite with normal password hashing: 181 tests ran in 744.689s;
  178 passed and three optional live Redis integration tests were skipped
  because `REDIS_TEST_URL` was not configured. Those tests are not counted as
  passing in this run.
- Full frontend rerun: 162 tests passed across 33 files using
  `npm test -- --pool=threads --maxWorkers=1`.
  The first attempt passed 149 tests across 32 files but failed to start the
  `pagination.test.jsx` worker. That attempt was a failed run. The complete
  rerun passed without application or test configuration changes.
- Django system checks, migration drift, backend Ruff, icon-generator Ruff,
  frontend ESLint, production build, and `git diff --check` passed.
- All 276 checked source files were within 300 lines; largest was 289.
- Production-mode Django checks reported only the intentional staged HSTS
  warnings W005/W021. No security policy was changed for this item.

Browser work finished before the frontend suite, and the full frontend and
Django suites ran sequentially. Build origins were verification-only:
`https://frontend.verification-only.example` and
`https://api.verification-only.example/api`.

Physical iOS/Android home-screen installation, Safari-specific rendering,
production host MIME/cache configuration, and search-engine favicon refreshes
are not certified by these local checks. No deployment occurred.
